import { app, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import {
  getConfig,
  getEditableApps,
  getPublicConfig,
  getSyncInfo,
  hasParentPin,
  setParentPin,
  updateConfig,
  verifyParentPin,
} from './config';
import { launchAllowedApp } from './appLauncher';
import { getFileRoots, listFileFolder, readFilePreview } from './files';
import { sendKeyboardInput } from './keyboard';
import {
  closeChildWindows,
  focusMainWindow,
  getWindowRecord,
  openChildWindow,
  openFilesWindow,
} from './windowRegistry';
import {
  connectWifi,
  disconnectWifi,
  getWifiStatus,
  scanWifiNetworks,
} from './wifi';
import { getVolumeState, setVolumeLevel, setVolumeMuted } from './volume';
import { getBatteryStatus } from './battery';
import { runPowerAction } from './power';
import { activateTaskbarItem, getTaskbarItems } from './taskbar';
import {
  checkForUpdates,
  getUpdateState,
  installUpdate,
  openReleasePage,
} from './updater';
import { syncFromEndpoint } from './remoteConfig';
import { IPC } from '../shared/ipc';
import type { KeyboardInput } from '../shared/types';
import {
  dismissVirtualKeyboard,
  getVirtualKeyboardTarget,
  hideVirtualKeyboard,
  resizeVirtualKeyboard,
  setChildTextFocus,
} from './virtualKeyboard';

const PARENT_SESSION_MS = 5 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30 * 1000;

let parentUnlockedAt: number | null = null;
let failedPinAttempts = 0;
let pinBlockedUntil = 0;

function isParentUnlocked(): boolean {
  return (
    parentUnlockedAt !== null &&
    Date.now() - parentUnlockedAt < PARENT_SESSION_MS
  );
}

function requireParent(): void {
  if (!isParentUnlocked()) {
    throw new Error('Los ajustes de adultos están bloqueados');
  }

  parentUnlockedAt = Date.now();
}

function hasTrustedSender(
  event: IpcMainInvokeEvent,
  kind: 'main' | 'files',
): boolean {
  const record = getWindowRecord(event.sender);

  return Boolean(
    record &&
    record.kind === kind &&
    event.senderFrame &&
    event.senderFrame.frameTreeNodeId ===
      record.win.webContents.mainFrame.frameTreeNodeId,
  );
}

function assertMainWindowSender(event: IpcMainInvokeEvent): void {
  if (!hasTrustedSender(event, 'main')) {
    throw new Error('Esta acción no está permitida');
  }
}

function assertFilesWindowSender(event: IpcMainInvokeEvent): void {
  if (!hasTrustedSender(event, 'files')) {
    throw new Error('Esta acción no está permitida');
  }
}

/** File reads are allowed from the home window and the Files app window. */
function assertFileApiSender(event: IpcMainInvokeEvent): void {
  const record = getWindowRecord(event.sender);

  if (
    !record ||
    (record.kind !== 'main' && record.kind !== 'files') ||
    !event.senderFrame ||
    event.senderFrame.frameTreeNodeId !==
      record.win.webContents.mainFrame.frameTreeNodeId
  ) {
    throw new Error('Esta acción no está permitida');
  }
}

/** Close overlays and app windows, then raise Kite's home screen. */
function goHome(): void {
  closeChildWindows();
  focusMainWindow();
}

interface IpcContext {
  quit: () => void;
}

export function registerIpcHandlers(context: IpcContext) {
  ipcMain.handle(IPC.configGet, (event) => {
    assertMainWindowSender(event);
    return getPublicConfig();
  });

  ipcMain.handle(IPC.configGetEditableApps, (event) => {
    assertMainWindowSender(event);
    requireParent();
    return getEditableApps();
  });

  ipcMain.handle(IPC.configUpdate, (event, update: unknown) => {
    assertMainWindowSender(event);
    requireParent();

    if (typeof update !== 'object' || update === null) {
      throw new Error('La actualización de la configuración no es válida');
    }

    const next = updateConfig(update);

    if ((update as { childKeyboard?: unknown }).childKeyboard === false) {
      hideVirtualKeyboard();
    }

    return next;
  });

  ipcMain.handle(IPC.appLaunch, async (event, appId: unknown) => {
    assertMainWindowSender(event);

    if (typeof appId !== 'string') {
      throw new Error('Identificador de aplicación no válido');
    }

    await launchAllowedApp(appId);
  });

  ipcMain.handle(IPC.webOpen, (event, rawUrl: unknown) => {
    assertMainWindowSender(event);

    if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
      throw new Error('Dirección de sitio web no válida');
    }

    openChildWindow(rawUrl);
  });

  ipcMain.handle(IPC.webCloseAll, (event) => {
    assertMainWindowSender(event);
    closeChildWindows();
  });

  ipcMain.handle(IPC.filesRoots, (event) => {
    assertFileApiSender(event);
    return getFileRoots();
  });

  ipcMain.handle(IPC.filesList, (event, root: unknown, path: unknown) => {
    assertFileApiSender(event);
    return listFileFolder(root, path);
  });

  ipcMain.handle(IPC.filesRead, (event, root: unknown, path: unknown) => {
    assertFileApiSender(event);
    return readFilePreview(root, path);
  });

  ipcMain.handle(IPC.filesOpen, (event) => {
    assertMainWindowSender(event);
    openFilesWindow();
  });

  ipcMain.handle(IPC.filesClose, (event) => {
    assertFilesWindowSender(event);
    getWindowRecord(event.sender)?.win.destroy();
  });

  ipcMain.handle(IPC.wifiScan, async (event) => {
    assertMainWindowSender(event);
    return scanWifiNetworks();
  });

  ipcMain.handle(
    IPC.wifiConnect,
    async (event, ssid: unknown, password: unknown) => {
      assertMainWindowSender(event);

      if (typeof ssid !== 'string' || typeof password !== 'string') {
        throw new Error('Credenciales de Wi-Fi no válidas');
      }

      await connectWifi(ssid, password);
    },
  );

  ipcMain.handle(IPC.wifiDisconnect, async (event) => {
    assertMainWindowSender(event);
    await disconnectWifi();
  });

  ipcMain.handle(IPC.wifiStatus, (event) => {
    assertMainWindowSender(event);
    return getWifiStatus();
  });

  ipcMain.handle(IPC.volumeGet, (event) => {
    assertMainWindowSender(event);
    return getVolumeState(getConfig().volumeCap);
  });

  ipcMain.handle(IPC.volumeSet, (event, level: unknown) => {
    assertMainWindowSender(event);

    if (typeof level !== 'number') {
      throw new Error('El volumen debe ser un número');
    }

    return setVolumeLevel(level, getConfig().volumeCap);
  });

  ipcMain.handle(IPC.volumeMute, (event, muted: unknown) => {
    assertMainWindowSender(event);

    if (typeof muted !== 'boolean') {
      throw new Error('El estado de silencio debe ser verdadero o falso');
    }

    return setVolumeMuted(muted, getConfig().volumeCap);
  });

  ipcMain.handle(IPC.systemBattery, (event) => {
    assertMainWindowSender(event);
    return getBatteryStatus();
  });

  ipcMain.handle(IPC.keyboardSend, (event, input: KeyboardInput) => {
    const record = getWindowRecord(event.sender);

    if (record?.kind === 'keyboard') {
      const target = getVirtualKeyboardTarget();

      if (!target) {
        throw new Error('No hay ningún campo de texto activo');
      }

      sendKeyboardInput(target, input);
      return;
    }

    assertMainWindowSender(event);
    sendKeyboardInput(event.sender, input);
  });

  ipcMain.handle(IPC.keyboardHide, (event) => {
    if (getWindowRecord(event.sender)?.kind !== 'keyboard') {
      throw new Error('Esta acción no está permitida');
    }

    dismissVirtualKeyboard();
  });

  ipcMain.handle(IPC.keyboardResize, (event, height: unknown) => {
    if (getWindowRecord(event.sender)?.kind !== 'keyboard') {
      throw new Error('Esta acción no está permitida');
    }

    if (typeof height !== 'number') {
      throw new Error('Altura del teclado no válida');
    }

    resizeVirtualKeyboard(height);
  });

  ipcMain.on(IPC.childTextFocus, (event, focused: unknown) => {
    const record = getWindowRecord(event.sender);

    if (
      !record ||
      record.kind !== 'child-web' ||
      typeof focused !== 'boolean'
    ) {
      return;
    }

    setChildTextFocus(record.win, focused);
  });

  ipcMain.handle(IPC.parentStatus, (event) => {
    assertMainWindowSender(event);

    return {
      hasPin: hasParentPin(),
      unlocked: isParentUnlocked(),
    };
  });

  ipcMain.handle(IPC.parentSetPin, (event, pin: unknown) => {
    assertMainWindowSender(event);

    if (typeof pin !== 'string') {
      throw new Error('PIN no válido');
    }

    if (hasParentPin() && !isParentUnlocked()) {
      throw new Error('Los ajustes de adultos están bloqueados');
    }

    setParentPin(pin);
    parentUnlockedAt = Date.now();
  });

  ipcMain.handle(IPC.parentUnlock, (event, pin: unknown) => {
    assertMainWindowSender(event);

    if (Date.now() < pinBlockedUntil) {
      throw new Error(
        'Demasiados intentos de PIN. Espera un momento e inténtalo de nuevo.',
      );
    }

    if (typeof pin !== 'string') {
      return false;
    }

    const valid = verifyParentPin(pin);

    if (valid) {
      parentUnlockedAt = Date.now();
      failedPinAttempts = 0;
      pinBlockedUntil = 0;
      return true;
    }

    failedPinAttempts += 1;

    if (failedPinAttempts >= MAX_PIN_ATTEMPTS) {
      failedPinAttempts = 0;
      pinBlockedUntil = Date.now() + PIN_LOCKOUT_MS;
      throw new Error(
        'Demasiados intentos de PIN. Espera un momento e inténtalo de nuevo.',
      );
    }

    return false;
  });

  ipcMain.handle(IPC.parentLock, (event) => {
    assertMainWindowSender(event);
    parentUnlockedAt = null;
  });

  ipcMain.handle(IPC.systemVersion, (event) => {
    assertMainWindowSender(event);
    return app.getVersion();
  });

  ipcMain.handle(IPC.updateStatus, (event) => {
    assertMainWindowSender(event);
    return getUpdateState();
  });

  ipcMain.handle(IPC.updateCheck, (event) => {
    assertMainWindowSender(event);
    requireParent();
    return checkForUpdates();
  });

  ipcMain.handle(IPC.updateInstall, async (event) => {
    assertMainWindowSender(event);
    requireParent();
    await installUpdate();
  });

  ipcMain.handle(IPC.updateOpenRelease, async (event) => {
    assertMainWindowSender(event);
    requireParent();
    await openReleasePage();
  });

  ipcMain.handle(IPC.syncStatus, (event) => {
    assertMainWindowSender(event);
    requireParent();
    return getSyncInfo();
  });

  ipcMain.handle(IPC.syncApply, async (event, endpoint: unknown) => {
    assertMainWindowSender(event);
    requireParent();
    return syncFromEndpoint(endpoint);
  });

  ipcMain.handle(IPC.taskbarList, (event) => {
    assertMainWindowSender(event);
    return getTaskbarItems();
  });

  ipcMain.handle(IPC.taskbarActivate, async (event, id: unknown) => {
    assertMainWindowSender(event);
    await activateTaskbarItem(id);
  });

  ipcMain.handle(IPC.taskbarHome, (event) => {
    assertMainWindowSender(event);
    goHome();
  });

  ipcMain.handle(IPC.systemHome, (event) => {
    assertMainWindowSender(event);
    goHome();
  });

  ipcMain.handle(IPC.systemQuit, (event) => {
    assertMainWindowSender(event);
    requireParent();
    context.quit();
  });

  ipcMain.handle(IPC.systemPower, (event, action: unknown) => {
    assertMainWindowSender(event);
    runPowerAction(action);
  });
}

import { app, BrowserWindow, powerMonitor } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipcHandlers';
import { initUpdater, stopUpdater } from './updater';
import { installKioskMenu } from './menu';
import {
  configureDefaultSession,
  installGlobalShortcuts,
  installSecurityHandlers,
  uninstallGlobalShortcuts,
} from './security';
import {
  configureChildSession,
  focusMainWindow,
  keepWindowInLayout,
  layoutWindow,
  setMainWindow,
} from './windowRegistry';
import { refreshSwayLayout, stopSwayLayout } from './sway';

app.enableSandbox();
app.setAppUserModelId('com.kite.safekiosk');

let isAuthorizedShutdown = false;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    skipTaskbar: true,
    closable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Keep this resizable: `resizable: false` makes Chromium advertise a
    // fixed size on Wayland, and a compositor fullscreen then hands back the
    // output size plus the decoration shadow extents (1398x778 on a 1366x768
    // screen), clipping the right and bottom edges. The window is frameless
    // and the kiosk layout re-applies its bounds, so it stays put.
    resizable: true,
    movable: false,
    autoHideMenuBar: true,
    backgroundColor: '#f6f1e4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      disableDialogs: true,
      backgroundThrottling: false,
    },
  });

  setMainWindow(win);
  win.setMenuBarVisibility(false);
  win.webContents.setIgnoreMenuShortcuts(true);

  win.once('ready-to-show', () => {
    layoutWindow(win);
    win.show();
    win.focus();
  });

  keepWindowInLayout(win);

  win.on('close', (event) => {
    if (!isAuthorizedShutdown) {
      event.preventDefault();
      focusMainWindow();
    }
  });

  win.on('session-end', () => {
    // Windows is signing out or shutting down; allow the process to exit.
    isAuthorizedShutdown = true;
  });

  win.webContents.on('render-process-gone', () => {
    if (!isAuthorizedShutdown) {
      win.reload();
    }
  });

  const loadPromise = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    : win.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );

  void loadPromise.catch((error: unknown) => {
    console.error('Kite failed to load its window', error);
  });

  if (!app.isPackaged && process.env.KITE_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

function requestQuit() {
  isAuthorizedShutdown = true;
  app.quit();
}

function configureAutoLaunch(): void {
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: app.isPackaged });
    return;
  }

  if (process.platform !== 'win32') {
    return;
  }

  // Squirrel moves the app into a new `app-<version>` folder on every update.
  // Registering `process.execPath` would leave the login item pointing at a
  // removed folder after the first update. Launch through Squirrel's stable
  // `Update.exe` stub instead, which resolves the current version.
  const updateExe = path.resolve(
    path.dirname(process.execPath),
    '..',
    'Update.exe',
  );

  if (app.isPackaged && existsSync(updateExe)) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: updateExe,
      args: ['--processStart', `"${path.basename(process.execPath)}"`],
    });
    return;
  }

  app.setLoginItemSettings({ openAtLogin: app.isPackaged });
}

function bootstrap() {
  app.on('second-instance', () => {
    focusMainWindow();
  });

  app.on('before-quit', (event) => {
    if (!isAuthorizedShutdown) {
      event.preventDefault();
      focusMainWindow();
    }
  });

  app.on('window-all-closed', () => {
    if (isAuthorizedShutdown) {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });

  app.on('will-quit', () => {
    stopUpdater();
    stopSwayLayout();
    uninstallGlobalShortcuts();
  });

  void app.whenReady().then(async () => {
    powerMonitor.on('shutdown', () => {
      isAuthorizedShutdown = true;
    });

    if (process.platform === 'win32' || process.platform === 'darwin') {
      try {
        configureAutoLaunch();
      } catch {
        // Auto-launch can be unavailable on managed devices.
      }
    }

    installKioskMenu();
    installSecurityHandlers();
    configureDefaultSession();
    configureChildSession();
    installGlobalShortcuts();
    registerIpcHandlers({ quit: requestQuit });
    initUpdater({
      onBeforeInstall: () => {
        isAuthorizedShutdown = true;
      },
    });

    await refreshSwayLayout();

    const mainWindow = createMainWindow();

    mainWindow.on('closed', () => {
      if (!isAuthorizedShutdown) {
        createMainWindow();
      }
    });
  });
}

if (started) {
  app.quit();
} else if (app.requestSingleInstanceLock()) {
  bootstrap();
} else {
  app.quit();
}

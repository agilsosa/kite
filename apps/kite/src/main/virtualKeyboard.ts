import { app, BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import path from 'node:path';
import { getConfig } from './config';
import {
  KEYBOARD_WINDOW_TITLE,
  getLayoutArea,
  positionKeyboardWindow,
} from './sway';
import { registerWindow } from './windowRegistry';
import { IPC } from '../shared/ipc';

const KEYBOARD_INITIAL_HEIGHT = 320;
const KEYBOARD_MIN_HEIGHT = 120;

let keyboardWindow: BrowserWindow | null = null;
let keyboardReady = false;
let keyboardHeight = KEYBOARD_INITIAL_HEIGHT;
let target: BrowserWindow | null = null;
let pendingTarget: BrowserWindow | null = null;
let dismissedTarget: BrowserWindow | null = null;

/** Windows whose `closed` event already hides the keyboard. */
const watchedTargets = new WeakSet<BrowserWindow>();

function watchTarget(win: BrowserWindow): void {
  if (watchedTargets.has(win)) {
    return;
  }

  watchedTargets.add(win);
  win.once('closed', () => {
    if (target === win) {
      hideVirtualKeyboard();
    }

    if (pendingTarget === win) {
      pendingTarget = null;
    }

    if (dismissedTarget === win) {
      dismissedTarget = null;
    }
  });
}

function layoutKeyboard(win: BrowserWindow, height: number): void {
  const area = getLayoutArea();
  const width = area.width;
  const clampedHeight = Math.max(
    KEYBOARD_MIN_HEIGHT,
    Math.min(area.height, Math.ceil(height)),
  );

  win.setBounds({
    x: area.x,
    y: area.y + area.height - clampedHeight,
    width,
    height: clampedHeight,
  });
  void positionKeyboardWindow(width, clampedHeight);
}

function revealKeyboard(win: BrowserWindow): void {
  layoutKeyboard(win, keyboardHeight);

  if (win.isVisible()) {
    win.moveTop();
  } else {
    // Never take focus away from the page: the keys are sent to the child
    // window explicitly and the page keeps its caret.
    win.showInactive();
  }

  // Sway may map the transient window a moment after `showInactive()`.
  setTimeout(() => {
    if (!win.isDestroyed() && win.isVisible()) {
      layoutKeyboard(win, keyboardHeight);
    }
  }, 300);
}

function createKeyboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f2e7',
    title: KEYBOARD_WINDOW_TITLE,
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

  keyboardWindow = win;
  keyboardReady = false;
  registerWindow(win, 'keyboard');
  win.setMenuBarVisibility(false);
  win.setTitle(KEYBOARD_WINDOW_TITLE);
  win.on('page-title-updated', (event) => event.preventDefault());

  win.once('ready-to-show', () => {
    keyboardReady = true;
    win.setTitle(KEYBOARD_WINDOW_TITLE);

    const next = pendingTarget;
    pendingTarget = null;

    if (
      next &&
      !next.isDestroyed() &&
      target === next &&
      getConfig().childKeyboard
    ) {
      revealKeyboard(win);
    }
  });

  win.on('closed', () => {
    if (keyboardWindow !== win) {
      return;
    }

    keyboardWindow = null;
    keyboardReady = false;
    target = null;
    pendingTarget = null;
    dismissedTarget = null;
  });

  const loadPromise = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#keyboard`)
    : win.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: 'keyboard' },
      );

  void loadPromise.catch(() => {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  });

  return win;
}

function ensureKeyboardWindow(): BrowserWindow {
  if (keyboardWindow && !keyboardWindow.isDestroyed()) {
    return keyboardWindow;
  }

  return createKeyboardWindow();
}

/** WebContents that should receive the keys pressed on the keyboard. */
export function getVirtualKeyboardTarget(): WebContents | null {
  return target && !target.isDestroyed() ? target.webContents : null;
}

/**
 * Called when the child page reports that a text field gained or lost focus.
 * Only acts while the parent enabled the on-screen keyboard.
 */
export function setChildTextFocus(win: BrowserWindow, focused: boolean): void {
  if (!getConfig().childKeyboard) {
    hideVirtualKeyboard();
    return;
  }

  if (!focused) {
    if (dismissedTarget === win) {
      dismissedTarget = null;
    }

    if (target === win) {
      hideVirtualKeyboard();
    }

    return;
  }

  if (dismissedTarget === win) {
    // The page only sends `true` after a focus change or after the user taps a
    // text field, so an explicit tap brings the keyboard back after **Ocultar**.
    dismissedTarget = null;
  }

  if (target === win && keyboardWindow?.isVisible()) {
    return;
  }

  watchTarget(win);
  target = win;

  const keyboard = ensureKeyboardWindow();
  keyboard.setParentWindow(win);

  if (keyboardReady) {
    revealKeyboard(keyboard);
  } else {
    pendingTarget = win;
  }

  win.webContents.send(IPC.keyboardReveal);
}

export function hideVirtualKeyboard(): void {
  target = null;
  pendingTarget = null;
  dismissedTarget = null;

  if (keyboardWindow && !keyboardWindow.isDestroyed()) {
    keyboardWindow.hide();
  }
}

/** Hide the keyboard until the page reports text focus again. */
export function dismissVirtualKeyboard(): void {
  if (target) {
    dismissedTarget = target;
  }

  target = null;
  pendingTarget = null;

  if (keyboardWindow && !keyboardWindow.isDestroyed()) {
    keyboardWindow.hide();
  }
}

/** Match the window height to the rendered keyboard. */
export function resizeVirtualKeyboard(height: number): void {
  if (!Number.isFinite(height)) {
    return;
  }

  const area = getLayoutArea();
  keyboardHeight = Math.max(
    KEYBOARD_MIN_HEIGHT,
    Math.min(area.height, Math.ceil(height)),
  );

  if (keyboardWindow && !keyboardWindow.isDestroyed()) {
    layoutKeyboard(keyboardWindow, keyboardHeight);
  }
}

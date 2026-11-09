import { BrowserWindow, screen, session } from 'electron';
import type { WebContents } from 'electron';
import path from 'node:path';
import { getConfig } from './config';
import {
  FILES_WINDOW_TITLE,
  focusKiteWindow,
  getLayoutArea,
  positionFilesWindow,
  positionKiteWindows,
  refreshSwayLayout,
} from './sway';

export const CHILD_PARTITION = 'persist:child-web';
export const CHILD_HOME_URL = 'https://kite.invalid/home';

export type WindowKind =
  | 'main'
  | 'child-web'
  | 'files'
  | 'parent-settings'
  | 'keyboard';

interface WindowRecord {
  win: BrowserWindow;
  kind: WindowKind;
  parentId?: number;
}

const records = new Map<number, WindowRecord>();
let mainWindow: BrowserWindow | null = null;

export function registerWindow(
  win: BrowserWindow,
  kind: WindowKind,
  parentId?: number,
) {
  records.set(win.id, { win, kind, parentId });
  win.on('closed', () => {
    records.delete(win.id);
  });
}

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win;
  registerWindow(win, 'main');
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

export function getWindowRecord(
  webContents: WebContents,
): WindowRecord | undefined {
  for (const record of records.values()) {
    if (record.win.webContents.id === webContents.id) {
      return record;
    }
  }

  return undefined;
}

export function closeChildWindows() {
  for (const record of records.values()) {
    if (
      (record.kind === 'child-web' || record.kind === 'files') &&
      !record.win.isDestroyed()
    ) {
      record.win.destroy();
    }
  }

  focusMainWindow();
}

export function focusMainWindow() {
  const win = getMainWindow();

  if (!win) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
  win.moveTop();
  positionKiteWindows();
  void focusKiteWindow('Kite');
}

/** Keep every Kite window inside the usable area of the primary display. */
export function layoutWindow(win: BrowserWindow) {
  if (win.isDestroyed() || win.isFullScreen()) {
    // A compositor fullscreen owns the window geometry; re-applying bounds
    // here would fight it. `leave-full-screen` restores the layout.
    return;
  }

  const area = getLayoutArea();
  const display = screen.getPrimaryDisplay().bounds;

  // Clamp to the display so a work area that overshoots the screen (some
  // Wayland panels report odd rects) can never push the taskbar off-screen.
  const x = Math.max(display.x, area.x);
  const y = Math.max(display.y, area.y);
  const right = Math.min(display.x + display.width, area.x + area.width);
  const bottom = Math.min(display.y + display.height, area.y + area.height);

  win.setBounds({
    x,
    y,
    width: Math.max(320, right - x),
    height: Math.max(320, bottom - y),
  });

  positionKiteWindows();
}

/** Re-apply the work-area layout if the display setup changes. */
export function keepWindowInLayout(win: BrowserWindow) {
  const reflow = () => {
    void refreshSwayLayout().then(() => layoutWindow(win));
  };

  screen.on('display-metrics-changed', reflow);
  screen.on('display-added', reflow);
  screen.on('display-removed', reflow);

  /*
   * `layoutWindow` fills the compositor's usable area. Entering fullscreen is
   * handled by the compositor (with `resizable: true` it reports the exact
   * output size on Wayland); leaving it restores the pre-fullscreen bounds,
   * which are re-applied here in case the display setup changed meanwhile.
   */
  win.on('leave-full-screen', () => {
    setTimeout(() => {
      if (win.isDestroyed()) {
        return;
      }

      // On Windows the kiosk surface is a real fullscreen window so the
      // taskbar stays hidden. Re-enter if anything drops it out of fullscreen.
      if (process.platform === 'win32') {
        win.setFullScreen(true);
        return;
      }

      void refreshSwayLayout().then(() => layoutWindow(win));
    }, 50);
  });

  win.on('closed', () => {
    screen.removeListener('display-metrics-changed', reflow);
    screen.removeListener('display-added', reflow);
    screen.removeListener('display-removed', reflow);
  });
}

export function listChildWindows() {
  return [...records.values()]
    .filter(
      (record) =>
        (record.kind === 'child-web' || record.kind === 'files') &&
        !record.win.isDestroyed(),
    )
    .map((record) => ({
      id: record.win.id,
      kind: record.kind,
      title: record.win.getTitle().trim() || 'Sitio web',
      active: record.win.isFocused(),
    }));
}

export function focusChildWindow(id: number) {
  const record = records.get(id);

  if (
    !record ||
    (record.kind !== 'child-web' && record.kind !== 'files') ||
    record.win.isDestroyed()
  ) {
    return;
  }

  if (record.win.isMinimized()) {
    record.win.restore();
  }

  record.win.show();
  record.win.focus();
  record.win.moveTop();
  positionKiteWindows();
  void focusKiteWindow(
    record.kind === 'files'
      ? FILES_WINDOW_TITLE
      : record.win.getTitle().trim() || 'Sitio web',
  );
}

function appWindowBounds() {
  const area = getLayoutArea();
  const width = Math.min(
    area.width,
    Math.max(720, Math.round(area.width * 0.86)),
  );
  const height = Math.min(
    area.height,
    Math.max(520, Math.round(area.height * 0.82)),
  );

  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
  };
}

function getFilesWindow(): BrowserWindow | null {
  for (const record of records.values()) {
    if (record.kind === 'files' && !record.win.isDestroyed()) {
      return record.win;
    }
  }

  return null;
}

export function openFilesWindow(): BrowserWindow {
  const existing = getFilesWindow();

  if (existing) {
    if (existing.isMinimized()) {
      existing.restore();
    }

    existing.show();
    existing.focus();
    existing.moveTop();
    positionKiteWindows();
    void positionFilesWindow();
    return existing;
  }

  const parent = getMainWindow();
  const win = new BrowserWindow({
    ...appWindowBounds(),
    parent: parent ?? undefined,
    modal: false,
    frame: false,
    show: false,
    skipTaskbar: true,
    title: FILES_WINDOW_TITLE,
    closable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    resizable: true,
    movable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: false,
      disableDialogs: true,
      backgroundThrottling: false,
    },
  });

  registerWindow(win, 'files', parent?.id);
  win.setMenuBarVisibility(false);
  win.setTitle(FILES_WINDOW_TITLE);

  const reflow = () => {
    if (win.isDestroyed()) {
      return;
    }

    win.setBounds(appWindowBounds());
    void positionFilesWindow();
  };

  screen.on('display-metrics-changed', reflow);
  screen.on('display-added', reflow);
  screen.on('display-removed', reflow);

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      win.destroy();
    }
  });

  win.once('ready-to-show', () => {
    win.setTitle(FILES_WINDOW_TITLE);
    win.show();
    win.focus();
    void positionFilesWindow();
    setTimeout(() => {
      if (!win.isDestroyed()) {
        void positionFilesWindow();
      }
    }, 400);
  });

  win.webContents.on('did-finish-load', () => {
    win.setTitle(FILES_WINDOW_TITLE);
    void positionFilesWindow();
  });

  win.on('closed', () => {
    screen.removeListener('display-metrics-changed', reflow);
    screen.removeListener('display-added', reflow);
    screen.removeListener('display-removed', reflow);
    focusMainWindow();
  });

  const loadPromise = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#files`)
    : win.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        { hash: 'files' },
      );

  void loadPromise.catch(() => {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  });

  return win;
}

export function isAllowedWebUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    return (
      url.protocol === 'https:' &&
      getConfig().allowedOrigins.includes(url.origin)
    );
  } catch {
    return false;
  }
}

function installHomeButton(win: BrowserWindow) {
  const css = `
    #kite-home-button {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 2147483647;
      min-width: 104px;
      min-height: 60px;
      padding: 0 24px;
      border: 3px solid #173f35;
      border-radius: 999px;
      background: #f4b942;
      color: #173f35;
      box-shadow: 5px 5px 0 #173f35;
      font: 800 20px/1 ui-rounded, "Avenir Next Rounded", "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
    }
    #kite-home-button:focus-visible {
      outline: 4px solid #8ecae6;
      outline-offset: 4px;
    }
  `;

  win.webContents.on('did-finish-load', () => {
    void win.webContents.insertCSS(css);
    void win.webContents
      .executeJavaScript(
        `(() => {
          const ID = 'kite-home-button';

          const createButton = () => {
            const button = document.createElement('button');
            button.id = ID;
            button.type = 'button';
            button.textContent = 'Home';
            button.setAttribute('aria-label', 'Return to Kite home');
            button.addEventListener('click', () => {
              window.location.assign(${JSON.stringify(CHILD_HOME_URL)});
            });
            return button;
          };

          const attach = () => {
            if (!document.body || document.getElementById(ID)) return;
            document.body.appendChild(createButton());
          };

          attach();

          // Single-page sites may replace the body; put the button back.
          new MutationObserver(attach).observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        })();`,
      )
      .catch(() => {
        // The page may block script execution; Escape still returns home.
      });
  });
}

export function openChildWindow(rawUrl: string): BrowserWindow {
  if (!isAllowedWebUrl(rawUrl)) {
    throw new Error('Ese sitio web no está en la lista de permitidos');
  }

  const parent = getMainWindow();
  const child = new BrowserWindow({
    parent: parent ?? undefined,
    modal: false,
    frame: false,
    skipTaskbar: true,
    closable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // Reports text-field focus to the main process for the on-screen
      // keyboard. It deliberately exposes no API to the page.
      preload: path.join(__dirname, 'child-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: false,
      disableDialogs: true,
      partition: CHILD_PARTITION,
    },
  });

  registerWindow(child, 'child-web', parent?.id);
  child.setMenuBarVisibility(false);
  keepWindowInLayout(child);
  child.once('ready-to-show', () => {
    layoutWindow(child);
    child.show();
    child.focus();
  });
  child.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      child.destroy();
    }
  });
  child.on('closed', () => {
    focusMainWindow();
  });

  installHomeButton(child);
  void child.loadURL(rawUrl).catch(() => {
    if (!child.isDestroyed()) {
      child.destroy();
    }

    focusMainWindow();
  });

  return child;
}

export function configureChildSession() {
  const childSession = session.fromPartition(CHILD_PARTITION);

  childSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => {
      callback(false);
    },
  );
  childSession.setPermissionCheckHandler(() => false);
  childSession.setDevicePermissionHandler(() => false);
  childSession.on('will-download', (event) => {
    event.preventDefault();
  });
  childSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self' https: data: blob:",
            "script-src 'self' 'unsafe-inline' https:",
            "style-src 'self' 'unsafe-inline' https:",
            "img-src 'self' https: data: blob:",
            "font-src 'self' https: data:",
            "media-src 'self' https: data: blob:",
            "connect-src 'self' https: wss:",
            "object-src 'none'",
            "frame-src 'none'",
            "base-uri 'self'",
            "form-action 'self' https:",
          ].join('; '),
        ],
      },
    });
  });
}

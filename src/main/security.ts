import { app, globalShortcut, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWindowRecord,
  isAllowedWebUrl,
  openChildWindow,
} from './windowRegistry';

const BLOCKED_SHORTCUTS = [
  'Alt+F4',
  'Alt+Tab',
  'Ctrl+Shift+Esc',
  'Ctrl+Esc',
  'Super',
  'Command+Tab',
  'Command+Q',
];

function isInternalNavigation(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL !== undefined) {
      return url.origin === new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL).origin;
    }

    if (url.protocol !== 'file:') {
      return false;
    }

    const rendererRoot = path.resolve(
      __dirname,
      '../renderer',
      MAIN_WINDOW_VITE_NAME,
    );
    const target = path.resolve(fileURLToPath(url));

    return (
      target === rendererRoot || target.startsWith(`${rendererRoot}${path.sep}`)
    );
  } catch {
    return false;
  }
}

function isChildHomeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);

    return url.origin === 'https://kite.invalid' && url.pathname === '/home';
  } catch {
    return false;
  }
}

function isBlockedInput(input: Electron.Input): boolean {
  if (input.type !== 'keyDown') {
    return false;
  }

  const key = input.key.toLowerCase();

  if (['f5', 'f11', 'f12'].includes(key)) {
    return true;
  }

  if (input.control && ['r', 'w', 'n', 't', 'p'].includes(key)) {
    return true;
  }

  if (input.meta && ['q', 'w', 'r', 'n', 't'].includes(key)) {
    return true;
  }

  if (input.control && input.shift && ['i', 'j', 'c'].includes(key)) {
    return true;
  }

  if (
    input.alt &&
    (key === 'f4' || key === 'arrowleft' || key === 'arrowright')
  ) {
    return true;
  }

  return false;
}

export function configureDefaultSession() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => {
      callback(false);
    },
  );
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.setDevicePermissionHandler(() => false);
  defaultSession.on('will-download', (event) => {
    event.preventDefault();
  });
}

export function installSecurityHandlers() {
  app.on('web-contents-created', (_event, contents) => {
    const navigate = (event: Electron.Event, rawUrl: string) => {
      const record = getWindowRecord(contents);

      if (record?.kind === 'child-web') {
        if (isChildHomeUrl(rawUrl)) {
          event.preventDefault();
          record.win.destroy();
          return;
        }

        if (!isAllowedWebUrl(rawUrl)) {
          event.preventDefault();
        }

        return;
      }

      if (!isInternalNavigation(rawUrl)) {
        event.preventDefault();
      }
    };

    contents.on('will-navigate', navigate);
    contents.on('will-redirect', navigate);
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedWebUrl(url)) {
        queueMicrotask(() => {
          try {
            openChildWindow(url);
          } catch {
            // Invalid or blocked URLs are denied silently.
          }
        });
      }

      return { action: 'deny' };
    });

    contents.on('before-input-event', (event, input) => {
      if (isBlockedInput(input)) {
        event.preventDefault();
      }
    });
  });
}

export function installGlobalShortcuts() {
  for (const accelerator of BLOCKED_SHORTCUTS) {
    try {
      globalShortcut.register(accelerator, () => {});
    } catch {
      // Some accelerators are reserved by the OS and cannot be registered.
    }
  }
}

export function uninstallGlobalShortcuts() {
  globalShortcut.unregisterAll();
}

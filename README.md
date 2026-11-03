# Kite

Kite is a kiosk-locked desktop launcher for a shared child device. It replaces
the desktop with a small, parent-curated world: a grid of allowed native apps,
an allow-list of HTTPS websites, a built-in Archivos app for Documentos and
Descargas, a taskbar for the running apps, an optional on-screen keyboard,
Wi-Fi setup, and volume control with a hard cap. The interface is in Spanish.

Kite is built with Electron, React, TypeScript, Tailwind CSS v4, Base UI, and
Lucide. All UI copy, accessibility labels, and user-facing errors are in
Spanish, and every icon is drawn with Lucide rather than an emoji. It runs on
Windows and macOS, with Linux supported for development and kiosk deployments
that provide the expected system tools.

## What it does

- Fills the usable screen area with a frameless window that has no menu, no
  operating-system taskbar entry, and no close button. The window cannot be
  closed, minimized, or moved by the child.
- Draws its own taskbar along the bottom of the window. It lists every
  launched native app, the Files window, and open websites, highlights the
  focused one, shows the clock, and offers Restart and Shut down after an
  in-app confirmation.
- Keeps Kite behind the apps it launches, so a native app opens above the
  launcher. Switching back to Kite or to another app is done from the
  taskbar.
- Blocks window closing, refresh/devtools shortcuts, navigation away from the
  app, `window.open` escapes, downloads, and all permission requests.
- Launches only native apps that a parent added to the allow-list. The renderer
  sends an app ID; the main process resolves the executable path. Firefox is
  added automatically on first run when it is already installed.
- Opens only parent-approved HTTPS origins in sandboxed, isolated child windows.
  Child windows include a large **Inicio** button and close on `Escape`.
- Includes a built-in **Archivos** app. It opens its own sandboxed, app-sized
  window above Kite, lists Documents and Downloads in a sidebar, and previews
  pictures and text in a side pane. The renderer never sends a filesystem path,
  only a folder ID and validated relative segments; the main process resolves
  and confines every request. Nothing can be edited, renamed, moved, or deleted
  from Kite. The window appears in the taskbar and closes from its **Inicio**
  button or `Escape`.
- Includes an on-screen keyboard that types through
  `webContents.sendInputEvent`, so it works without OS-level input tools. It is
  currently disabled in `src/renderer/lib/features.ts` while Kite is used with a
  physical keyboard.
- Scans and joins Wi-Fi networks from a compact popover on the home screen; no
  parent PIN is needed.
- Controls system volume and mute from a compact popover, enforced against a
  parent-set maximum.
- Shows a subtle `kite vX.Y.Z` label in the taskbar. Three quick clicks on it
  open the PIN gate; the label itself never reveals the gesture.
  PINs are stored as salted scrypt hashes, and five bad attempts trigger a
  30-second lockout.
- On Windows, checks GitHub Releases for updates, downloads them in the
  background, and installs only when a parent approves the restart from adult
  settings. See [Publishing updates](docs/UPDATES.md).
- Lets a parent replace the whole child profile (name, volume cap, apps, and
  websites) with JSON from an HTTPS endpoint. See
  [Remote configuration API](docs/REMOTE-CONFIG.md).

## Requirements

- Node.js 22 or newer (the project is developed on Node 26 and Electron 45).
- npm.
- Linux only: `alsa-utils` for volume (`amixer`) and NetworkManager for Wi-Fi
  (`nmcli`), if you use those features.

## Development

```bash
npm install
npm start
```

`npm start` runs Electron Forge with the Vite dev server. Set
`KITE_DEVTOOLS=1` to open detached DevTools in development. DevTools are always
disabled in packaged builds.

Quality checks:

```bash
npm run typecheck
npm run lint
npm run lint:fix
```

Package the app for the current platform:

```bash
npm run package
```

Build installers with Electron Forge makers:

```bash
npm run make
```

Both commands clear `.vite` first. The dev server and the production build share
that output folder, so a stale development bundle could otherwise end up in the
packaged app. Stop `npm start` before packaging for the same reason.

## First run

1. Start Kite. The home screen opens with empty app and website lists.
2. Click the `kite vX.Y.Z` label in the taskbar three times quickly.
3. Create a 4–8 digit parent PIN. This also unlocks parent settings.
4. Add apps (full executable paths), websites (`https://` origins only), the
   child's name, and a maximum volume.
5. Close settings. The parent session locks immediately.

The PIN is stored in the encrypted Kite configuration. There is no recovery
flow: removing the configuration file resets the PIN and all settings.

## Project layout

```text
src/
  main/        Electron main process: lifecycle, security, windows, IPC,
               app launcher, Wi-Fi, volume, keyboard input
  preload/     contextBridge API exposed as window.api
  renderer/    React child UI and parent dialogs
  shared/      IPC channel names, shared types, Node module declarations
```

Important modules:

| Path                                   | Responsibility                                     |
| -------------------------------------- | -------------------------------------------------- |
| `src/main/index.ts`                    | App lifecycle, single-instance lock, quit approval |
| `src/main/security.ts`                 | Navigation guards, shortcut blocking, permissions  |
| `src/main/windowRegistry.ts`           | Window registry, work-area layout, child windows   |
| `src/main/taskbar.ts`                  | Taskbar item list and taskbar actions              |
| `src/main/appLauncher.ts`              | Allow-listed native app launching and tracking     |
| `src/main/files.ts`                    | Confined, read-only Documents/Downloads browsing   |
| `src/renderer/screens/FilesWindow.tsx` | Built-in Files app window with both folders        |
| `src/main/sway.ts`                     | Sway window placement and launched-app reveal      |
| `src/main/power.ts`                    | Restart and shut-down commands                     |
| `src/main/ipcHandlers.ts`              | Typed IPC allow-list, parent session, input checks |
| `src/main/config.ts`                   | Encrypted config, validation, PIN hashing          |
| `src/main/wifi.ts`                     | `node-wifi` wrapper                                |
| `src/main/volume.ts`                   | `easy-volume` wrapper with cap enforcement         |
| `src/main/keyboard.ts`                 | `sendInputEvent` key injection                     |

## Data and credentials

Kite stores its settings with `electron-store` in Electron's `userData`
directory as `kiosk-config.json`. The file is encrypted with a key derived from
the app, user data path, machine hostname, and username. This protects against
casual inspection, not against an attacker who already controls the machine.
Use full-disk encryption and OS accounts for real protection.

Wi-Fi passwords are passed to the operating system when joining a network.
Kite does not store them, and it never returns them to the renderer.

The file explorer does not keep a history or index. It reads the two folders on
demand and sends only the names, sizes, timestamps, and preview bytes needed for
the current screen. Hidden entries, symlinks that point outside the folder, and
files larger than the preview limits are skipped or refused.

## Security and deployment

Electron kiosk mode is only one layer. It cannot stop `Ctrl+Alt+Del`, the
Windows key, macOS task switching, or a user with physical access to the
machine. A complete deployment also locks the operating system to Kite.

- [Security model and limitations](docs/SECURITY.md)
- [Windows, macOS, and Linux deployment](docs/DEPLOYMENT.md)
- [Publishing updates](docs/UPDATES.md)
- [Remote configuration API](docs/REMOTE-CONFIG.md)
- [Acceptance checklist](docs/ACCEPTANCE.md)
- [Windows verification checklist](docs/WINDOWS-VERIFICATION.md)

## Known platform notes

- The taskbar is drawn inside Kite's window, like an application toolbar. When
  a native app covers the bottom of the screen, it hides the taskbar too. Close
  or move the app to see it again, or use the app's own window controls.
- On Sway, Wayland ignores client-requested window positions. Kite asks
  `swaymsg` for the usable workspace, places its window there, and floats and
  sizes native apps when they open so they appear above Kite. Other Wayland
  compositors fall back to their own placement rules.
- Native apps launched from Kite are outside Kite's sandbox. Firefox in
  particular is a full browser: it can reach any website, so the website
  allow-list no longer limits where the child can go. Remove it in parent
  settings if that is not acceptable.
- `node-wifi` uses `netsh` on Windows, `networksetup` on macOS, and `nmcli` on
  Linux. Scanning may require the app to run in a user session with network
  permissions.
- `easy-volume` uses `amixer` on Linux. Without it, the volume popover reports
  that the system volume cannot be changed.
- Some sites refuse to render inside a frame or require permissions Kite
  denies. Add only sites that work without camera, microphone, location, or
  notifications.
- The file explorer uses Electron's Documents and Downloads locations. On Linux
  it reads `user-dirs.dirs` and falls back to `~/Documents` and `~/Downloads`
  when Electron reports the home directory instead. If a folder does not exist,
  the explorer says so instead of creating it. Only the first 500 entries of a
  folder are listed; folders with more entries show a truncation note.
- The Files window is deliberately app-sized (about 86% of the usable area),
  not full-screen, so Kite's taskbar stays visible. On Sway the main process
  floats it, moves it onto Kite's workspace, and focuses it by window title.
- Native child apps can expose their own menus and task switching. Use the
  operating system kiosk configuration, and only add apps that behave well
  full-screen.

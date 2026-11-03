# Security model

Kite is designed for a shared device where the child should not be able to
leave the app, reach arbitrary files or websites, or change parent settings.
It is a launcher and UI lockdown, not a replacement for operating-system kiosk
configuration.

## Trust boundaries

| Boundary          | Trusted?  | Notes                                                    |
| ----------------- | --------- | -------------------------------------------------------- |
| Main process      | Yes       | Owns config, secrets, app paths, windows, and OS calls   |
| Preload bridge    | Yes       | Exposes a small typed API; no raw `ipcRenderer`          |
| Kite renderer     | Limited   | Sandboxed, no Node, no direct filesystem or shell access |
| Child web content | Untrusted | Separate session, sandboxed, no preload, no Node         |
| Native child apps | Varies    | Outside Kite's process boundary and outside its control  |
| Operating system  | Varies    | Must enforce kiosk/single-app mode for real lockdown     |

The child home screen receives only app IDs, names, and icons. Executable paths
are fetched only after the parent session is unlocked, for editing. The
renderer cannot launch anything that is not in the main-process allow-list, and
launch requests contain only an app ID.

## Controls in this codebase

### Renderer isolation

Every BrowserWindow sets:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`
- `spellcheck: false`
- `devTools: false` when packaged

The main renderer gets a production Content Security Policy with no inline
scripts. The development server uses a relaxed policy for React Refresh and
HMR only.

The asar package enables Electron fuses that disable `ELECTRON_RUN_AS_NODE`,
Node CLI inspect arguments, and `NODE_OPTIONS`, plus asar integrity validation
and `OnlyLoadAppFromAsar`.

### IPC

`src/shared/ipc.ts` is the complete channel list. The preload bridge in
`src/preload/index.ts` maps those channels to `window.api`; the renderer never
receives `ipcRenderer`.

`src/main/ipcHandlers.ts` validates every payload in the main process:

- Every request must come from the main window's top frame. Subframes and other
  windows are rejected. The taskbar shares this window, so it uses the same
  guard.
- App launches accept only a string ID. The path is resolved from config and
  must exist.
- Taskbar activations accept only `app:<id>` or `web:<window id>` strings, and
  the referenced app or window must still exist.
- Power actions accept only `restart` or `shutdown`, and only after the
  renderer has shown its confirmation dialog.
- URLs must be strings under 2048 characters and are checked against the
  HTTPS origin allow-list.
- Volume must be a number, mute must be a boolean, and Wi-Fi credentials must be
  strings.
- Config updates are normalized and length-limited in `src/main/config.ts`.
- Parent-only actions require an unlocked parent session.
- Wi-Fi scan, connect, and disconnect are intentionally available without the
  parent session, so the child can fix connectivity from the home screen. The
  same main-window and payload checks still apply.

### File explorer confinement

`src/main/files.ts` is the only module that touches the filesystem for the
explorer. The renderer never supplies a path:

- Requests contain a root ID (`documents` or `downloads`) and at most 24 path
  segments. Unknown roots, absolute paths, `..`, empty segments, path separators,
  NUL bytes, and segments starting with `.` are rejected.
- The root is resolved from Electron's Documents/Downloads location. On Linux,
  if Electron reports the home directory, Kite reads `user-dirs.dirs` and falls
  back to `~/Documents` or `~/Downloads`. The home directory is never used as a
  root.
- Both the root and the target are passed through `realpath`, and the target
  must remain inside the real root. Symlinks that resolve outside the root are
  rejected on read and omitted from listings.
- Dotfiles are hidden and unreachable. Listings are capped at 500 entries.
- Previews are read-only: raster images (PNG, JPEG, GIF, WebP, BMP, AVIF, ICO)
  up to 12 MB become data URLs; text files from an extension allow-list up to
  256 KB are read and truncated; other files return a message. SVG is excluded
  because it can reference external content.
- Filesystem errors are mapped to short messages, so raw paths and error codes
  do not reach the renderer.

The built-in Files app is a separate frameless `BrowserWindow` with the same
sandbox flags and preload bridge, loading the packaged renderer with a `#files`
hash. It is not a web partition and cannot navigate to a website. The main
process scopes its bridge:

- `files:roots`, `files:list`, and `files:read` accept the main window and the
  Files window.
- `files:open` is accepted only from the main window, so a Files window cannot
  spawn more windows.
- `files:close` is accepted only from the Files window.
- Every other IPC handler still requires the main window, so the Files window
  cannot change config, launch apps, or unlock parent settings.

The Files window is app-sized above Kite, appears in the taskbar, and closes
from its Home button, `Escape`, or the taskbar Kite home button.

### Parent authentication

- PINs are 4–8 digits and stored as a random-salt scrypt hash (64-byte output).
- Verification uses `timingSafeEqual`.
- Five failed attempts trigger a 30-second lockout.
- The unlock session lives in main-process memory and expires after five
  minutes. Opening settings refreshes the session; closing settings clears it.
- There is no PIN recovery path other than deleting the Kite config.

### Navigation and new windows

`src/main/security.ts`:

- `will-navigate` and `will-redirect` parse the URL and compare the exact
  `origin` for child windows.
- The main renderer may navigate only within its packaged renderer directory
  (or the dev-server origin).
- `setWindowOpenHandler` always returns `deny`. If the target is an allowed
  origin, Kite opens its own isolated child window instead.
- Webviews are blocked.
- `file:`, `javascript:`, `data:`, and arbitrary `https:` navigations are not
  accepted outside the rules above.
- Child windows close on `Escape` or via the injected Home button, which is
  intercepted as a navigation to an internal sentinel URL.

### Permissions and devices

Both the default session and `persist:child-web`:

- Deny every permission request.
- Return `false` from permission checks.
- Deny HID, USB, and serial device permissions.
- Block downloads.

The child session also receives a CSP on every response. It allows HTTPS
content so real sites work, but blocks plugins (`object-src 'none'`) and
embedded frames (`frame-src 'none'`). Some sites that depend on iframes or
camera/microphone access will not work, by design.

### Kiosk lifecycle

- The app holds a single-instance lock; a second launch focuses the main window.
- The main window is frameless, not closable, not
  minimizable/maximizable/movable, skipped from the OS taskbar, and sized to
  the usable work area of the primary display. Its own taskbar is part of that
  window, below the home screen.
- The main window is constructed with `resizable: true` on purpose. On
  Wayland, `resizable: false` makes Chromium advertise a fixed size, and a
  compositor fullscreen then reports the output size plus the decoration
  shadow extents (for example `1398×778` on a `1366×768` screen), which pushes
  the right and bottom of the taskbar off-screen. There is no resize handle:
  the window is frameless, not movable, and the layout is re-applied when
  display metrics change or fullscreen ends.
- Kite is deliberately not always-on-top. Launched apps appear above it, and
  the child switches between them with the in-window taskbar. Closing an app
  reveals Kite again.
- The Files app and website windows are separate sandboxed BrowserWindows. The
  Files window is app-sized so the taskbar stays visible; both kinds are listed
  in the taskbar and are destroyed by the taskbar Kite home button.
- Layout is re-applied when the display configuration changes.
- On Sway, Wayland ignores client-requested positions, so the main process asks
  `swaymsg` for the usable workspace and moves Kite's windows there. Launched
  native apps are floated and sized so they stay above Kite. These calls are
  best-effort and use only numeric window IDs read from Sway's own tree.
- Closing the main window is prevented unless a parent-authorized quit is in
  progress.
- `before-quit` is prevented during normal operation.
- Renderer crashes reload the main window.
- Global shortcuts are registered as no-ops for common escape accelerators.
- The application menu is removed.
- The window ignores menu shortcuts.

## Known limitations

- **OS shortcuts cannot all be blocked.** `Ctrl+Alt+Del`, the Windows key,
  `Cmd+Tab`, Mission Control, and similar combinations are handled by the OS.
  `globalShortcut` registration can also fail for reserved accelerators.
- **Native apps are outside the sandbox.** Once launched, an allowed app can
  behave however it wants. Choose apps carefully and use OS-level kiosk mode.
  A native app can also cover Kite's in-window taskbar, and on some compositors
  it may ignore the size Kite requests.
- **Window placement is compositor-specific.** Sway is supported explicitly.
  Other Wayland compositors may ignore Kite's requested window position or keep
  launched apps behind it; use a single-window compositor or add your own window
  rules there.
- **Physical access wins.** A user with a keyboard, boot device, or admin
  account can bypass an Electron kiosk. Use a standard user account, firmware
  passwords, and full-disk encryption.
- **Encryption is deterrence, not a vault.** The `electron-store` key is derived
  from machine and user details. It prevents casual reading of settings, not an
  attacker who controls the machine.
- **Child site CSP is intentionally permissive about HTTPS and inline assets**
  to keep approved sites functional. Origin isolation and the navigation
  allow-list are the primary boundaries, not the CSP.
- **Injected Home button can be removed by a hostile page.** `Escape` remains
  available, and the main process still blocks navigation outside the
  allow-list.
- **Power actions trust the OS.** Restart and shut down call
  `systemctl reboot`/`poweroff`, `shutdown`, or `osascript`. The kiosk user must
  be allowed to perform them (for example through polkit), otherwise the
  confirmation appears but the command is refused by the OS.
- **Wi-Fi is open to the child by design.** The home-screen popover can scan,
  join, and disconnect networks without the parent PIN. A child can therefore
  join an arbitrary network, including a hotspot. Use OS/network policy if
  that is not acceptable.
- **Wi-Fi and volume depend on OS tools.** Failures are reported in the UI;
  they do not crash the kiosk.
- **The file explorer sees whatever is in Documents and Downloads.** The child
  can read any non-hidden file in those two folders that matches the preview
  rules, including files another app saved there. Keep private material out of
  those folders or use OS permissions. Text previews are capped at 256 KB and
  images at 12 MB; larger files and unsupported formats are listed but not
  shown.

## Hardening checklist

Before shipping a device:

- [ ] Use a non-admin OS account for the kiosk user.
- [ ] Configure Assigned Access / Single App Mode / a minimal window manager.
- [ ] Disable physical ports and boot devices where appropriate.
- [ ] Enable full-disk encryption.
- [ ] Code-sign the installer and app.
- [ ] Review the allowed app and website lists.
- [ ] Create a parent PIN and store it safely.
- [ ] Run the acceptance checklist in `docs/ACCEPTANCE.md`.

# Deployment and OS lockdown

Kite's kiosk mode only covers its own windows. The operating system must also
prevent the child from switching apps, reaching a desktop, or opening a shell.
This document describes the supported packaging paths and the extra OS
configuration each platform needs.

## Build and package

Run these commands on the target operating system; Electron Forge does not
cross-compile installers reliably.

```bash
npm ci
npm run typecheck
npm run lint
npm run make
```

Stop any running `npm start` before building. The dev server and the packaging
build share `.vite`, and `npm run make` / `npm run package` clear it first to
avoid shipping a development bundle that points at `localhost`.

Outputs:

- `out/make/squirrel.windows/x64/` — Windows Squirrel installer
- `out/make/zip/darwin/` — macOS `.zip`
- `out/make/deb/x64/` and `out/make/rpm/x64/` — Linux `.deb` and `.rpm`
- `out/kite-linux-x64/` — unpacked Linux app from `npm run package`

On Linux, `npm run make:linux` builds the `.deb` and `.rpm` directly. Every
GitHub Release includes both packages and their `SHA256SUMS`. Windows releases
are produced by the `windows` job and Linux packages by the `linux` job. Use
`npm run release:linux` to build and upload them manually, then attach
`SHA256SUMS` as described in
[Publishing updates](UPDATES.md#publish-manually-on-linux). Packaged Linux
installs update through the helper in [Linux updates](UPDATES.md#linux-updates).

Sign and notarize production builds using your normal Electron code-signing
setup. Unsigned builds will trigger Gatekeeper or SmartScreen warnings and may
be blocked by managed devices.

Windows keeps itself up to date through GitHub Releases. See
[Publishing updates](UPDATES.md) for the release workflow, version rules, and
the parent-approved install flow.

## Auto-launch

Kite calls `app.setLoginItemSettings({ openAtLogin: app.isPackaged })` at
startup on Windows and macOS. This registers the packaged app to start when the
kiosk user logs in. It is intentionally disabled in development.

Linux does not use this API. Configure auto-start through the display manager
or the kiosk session itself (see below).

## Windows 10/11

1. Install Kite for the kiosk user with the Squirrel installer.
2. Sign in as that user once and complete first-run setup (parent PIN, apps,
   sites, volume cap).
3. Use a **standard user account**. The kiosk user must not be an administrator
   and must not be able to install software or change network settings.
4. Lock the device to Kite with one of:
   - **Assigned Access** single-app kiosk, if your Windows edition and build
     support the installed Win32 app.
   - **Shell Launcher v2** on Enterprise/Education for a custom Win32 shell.
   - A managed kiosk/MDM profile that launches Kite as the shell.
5. Apply supporting policy where available:
   - Disable Task Manager and Fast User Switching.
   - Remove or restrict the Start menu, Run dialog, and notification center.
   - Disable removable media and boot-device changes in firmware.
   - Enable BitLocker.
6. Verify that `Alt+F4`, `Alt+Tab`, `Ctrl+Shift+Esc`, `Ctrl+W`, and `Win`
   combinations cannot leave Kite. Keys reserved by Windows (`Ctrl+Alt+Del`,
   the Secure Attention Sequence) cannot be intercepted by Electron; the OS
   policy is the only defence there.

Track the known Windows gaps and their test steps in the
[Windows verification checklist](WINDOWS-VERIFICATION.md).

Notes:

- Windows may require approval for login-item registration. Verify auto-launch
  after a reboot.
- Squirrel installs per user under `%LOCALAPPDATA%`. Assigned Access support for
  that install location varies by Windows version; test on the exact image you
  will deploy.
- Kite denies camera, microphone, location, USB/HID, and download requests. Do
  not add sites or apps that require them.

## macOS

1. Build on macOS, then sign and notarize the app.
2. Install it for the kiosk user and complete first-run setup.
3. Use a **standard user account** that cannot install software or change
   security settings.
4. Enable **Single App Mode** through MDM. Single App Mode requires a
   supervised device. Guided Access is an iOS/iPadOS feature and does not lock
   a Mac.
5. Alternatively, use a managed launch agent that starts Kite at login and
   combine it with MDM restrictions on app switching, Mission Control, and
   terminal access.
6. Optionally disable automatic login and require the kiosk account to be the
   only login account.
7. Verify `Cmd+Q`, `Cmd+W`, `Cmd+Tab`, `Cmd+Space`, and Mission Control gestures
   cannot leave Kite. Some of these are OS-owned and must be disabled by policy.

Notes:

- `setLoginItemSettings` registers a login item; macOS may ask the user to
  approve it. Approve it once during provisioning.
- The Forge config produces a ZIP, not a DMG. Wrap the signed `.app` in a DMG
  or use your MDM's installer if you need one.
- Kite keeps native apps above its own window and switches through its in-window
  taskbar, but macOS spaces and Mission Control can still reveal other windows
  unless MDM locks them down.

## Linux

Kite is developed and packaged on Linux, but Linux deployments vary widely.

1. Install the `.deb`/`.rpm` from the latest GitHub Release, or unpack the
   packaged app. Adult settings can install later releases in place on Linux:
   Kite checks for a newer release, and after a parent approves it, a root-owned
   helper verifies the published `SHA256SUMS`, installs the package, and
   restarts Kite. The first build that includes the helper must be installed
   manually. See [Publishing updates](UPDATES.md#linux-updates).
2. Create a dedicated non-admin kiosk user with an automatic graphical login.
3. Start only Kite, using one of:
   - A minimal compositor/window manager such as `cage`, which maps only the
     kiosk window.
   - A stripped session that runs Kite instead of a desktop shell.
   - A systemd user service tied to the graphical session, as a fallback.
4. Install the system dependencies:
   - `alsa-utils` for volume (`amixer`).
   - NetworkManager for Wi-Fi (`nmcli`).
5. Disable virtual terminals, tty switching, and other sessions where possible.
   A user who can press `Ctrl+Alt+F2` can usually reach a login prompt unless
   the OS is configured otherwise.

Notes:

- `node-wifi` uses `nmcli` on Linux. Connections are stored by NetworkManager;
  Kite does not keep Wi-Fi passwords.
- Without `amixer`, the volume popover reports an error instead of crashing.
- Wayland compositors do not let clients position windows. On **Sway**, Kite
  reads the usable workspace with `swaymsg`, places its window there, and
  floats and sizes native apps when they open so they appear above Kite. The
  `swaymsg` binary must be installed and `SWAYSOCK` must be set in Kite's
  environment (normal for a Sway session). Kite's own windows are floated
  explicitly, because `move absolute position` only applies to floating
  containers.
- Compositor fullscreen on Wayland (for example Sway's `$mod+f`) fills the
  whole output. Kite's window is built with `resizable: true` so Chromium does
  not advertise a fixed size; fixed-size windows receive the output size plus
  the decoration shadow extents when fullscreened, which clips the taskbar's
  right and bottom edges. Leaving fullscreen restores the work-area layout.
- On other compositors, Kite asks for the full work area, but the compositor
  decides the final position. Launched apps may open behind Kite or cover its
  taskbar. Prefer a single-window compositor such as `cage`, or add window
  rules to float and raise launched apps.
- The taskbar is drawn inside Kite's window rather than as a separate
  always-on-top surface, so a native app can cover it. If the child must always
  be able to switch apps, run the app windowed or add compositor rules that keep
  it below the taskbar area.
- Restart and shut down use `systemctl reboot` and `systemctl poweroff`. The
  kiosk user must be allowed to run them (for example through a polkit rule);
  otherwise the command is refused by the OS.

## Documents and downloads

Kite browses only the operating system's Documents and Downloads folders. It
does not create them. Provision both folders for the kiosk user and put any
material the child should see there before deployment.

- **Windows:** Electron resolves both known folders per user, including OneDrive
  redirection. The kiosk user's `Documents` and `Downloads` are used.
- **macOS:** the first access may trigger the system privacy prompt for
  Documents/Downloads. Approve it once during provisioning, or grant Full Disk
  Access to Kite through MDM. If access is denied, the explorer reports that the
  folder is unavailable.
- **Linux:** Electron uses the XDG user directories. If `user-dirs.dirs` is
  missing or points at the home directory, Kite falls back to `~/Documents` and
  `~/Downloads`. The home directory is never exposed as a root.

The explorer is read-only, hides dotfiles, and omits symlinks that leave the
folder. Text previews stop at 256 KB, images at 12 MB, and listings at 500
entries. Files outside those limits remain visible in the list but show a short
message instead of a preview. Keep private files out of these two folders; the
child can preview anything readable there that matches the supported formats.

**Archivos** opens as its own app-sized window above Kite, with both folders in a
sidebar, a preview pane, and a taskbar entry. It closes from **Inicio**, `Escape`,
or the taskbar Kite button. On Sway, Kite moves the window onto the main
window's workspace and floats it; on other platforms it opens centered in the
usable work area.

## Network and content policy

Kite allows only exact HTTPS origins in the parent settings list. It does not
inspect page content. If you need content filtering, put the device behind a
filtering DNS resolver or proxy in addition to Kite's allow-list.

Do not allow sites that require:

- camera or microphone access,
- geolocation,
- USB/HID/serial devices,
- downloads or external protocol handlers,
- iframes or embedded players (blocked by the child CSP).

## Updating

Plan updates while the device is unlocked and supervised. The kiosk prevents
normal quitting, so use the parent settings → **Device → Exit kiosk** flow or
your MDM/OS deployment tooling. Re-run the acceptance checklist after every
update.

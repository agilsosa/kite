# Windows verification checklist

Windows-specific findings and checks for Kite. The review was static, from
Linux, on 2026-10-31; no Windows host was available. Use this file on a real
Windows machine before calling Windows supported, and again after every Electron
or Squirrel update.

General behaviour (kiosk layout, Spanish UI, icons, files, websites) is covered by
[the acceptance checklist](ACCEPTANCE.md). This file tracks the Windows gaps and
the steps needed to confirm or close them.

## How to use this file

1. Build the Squirrel installer **on Windows**; Forge does not cross-compile it
   reliably.
2. Install as the standard (non-administrator) kiosk user.
3. Run the checks first in a **normal desktop session** and then under the
   deployed kiosk method (Shell Launcher v2 or Assigned Access). Several findings
   only reproduce in a normal session.
4. Mark each item with `Pass`, `Fail`, or `Not tested`, and record the date,
   build, and Windows build in the [results log](#results-log).
5. Do not mark Windows support complete while any **P1** item is open.

Severity:

- **P1** — a feature does not work. Blocks Windows support.
- **P2** — kiosk, security, or usability gap. Fix or document a mitigation.
- **P3** — compatibility or polish. Can ship with a note.

## Environment under test

Fill this in before starting.

| Field                                                               | Value |
| ------------------------------------------------------------------- | ----- |
| Windows edition and build (`winver`)                                |       |
| Architecture (x64 / arm64)                                          |       |
| Kite version / commit                                               |       |
| Installer used (`out/make/squirrel.windows/...`)                    |       |
| Install location                                                    |       |
| Kiosk method (Shell Launcher v2 / Assigned Access / normal session) |       |
| Display, resolution, scaling                                        |       |
| Windows display language                                            |       |
| Wi-Fi adapter and driver                                            |       |
| Audio output device                                                 |       |
| Tester and date                                                     |       |

## Findings summary

| ID   | Severity | Area           | Finding                                                                                                                                                | Status                        |
| ---- | -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| W-01 | P1       | Volume         | `easy-volume`'s Windows `volume.exe` is not packaged, so volume reads and writes fail.                                                                 | Open                          |
| W-02 | P2       | Native apps    | No focus, raise, active state, or placement on Windows; repeated taps spawn again.                                                                     | Open                          |
| W-03 | P2       | Auto-launch    | Login item pointed at the versioned `app-<version>` executable and would break after a Squirrel update. Code now targets Squirrel's `Update.exe` stub. | Fixed in code; verify         |
| W-04 | P2       | Wi-Fi          | Wrong error text, unverified `connect`, brittle output parsing.                                                                                        | Open                          |
| W-05 | P2       | Wi-Fi security | `node-wifi` builds a `cmd.exe` command from the scanned SSID and writes the password to a temp file.                                                   | Open                          |
| W-06 | P2       | Kiosk          | Normal sessions leave the Windows taskbar visible; reserved shortcuts cannot be claimed by Electron.                                                   | By design; verify OS lockdown |
| W-07 | P3       | Apps           | Firefox detection misses per-user installs.                                                                                                            | Open                          |
| W-08 | P3       | Files          | Windows hidden/system files are listed; UTF-16LE text previews are rejected.                                                                           | Open                          |
| W-09 | P3       | Packaging      | No app/setup icon or code signing; default Electron icon and SmartScreen warnings.                                                                     | Open                          |
| W-10 | P3       | Apps           | `.lnk`, UWP/Store apps, and `.bat`/`.cmd` targets are not launchable via `spawn`.                                                                      | Open                          |
| W-11 | P3       | UI             | Injected child-window button still says "Home" instead of "Inicio".                                                                                    | Open                          |

## W-01 — System volume does not work (P1)

**Expected:** the volume popover reads the real system level, enforces the parent
cap, and changes mute and volume.

**Why it likely fails:**

- `src/main/volume.ts` imports `easy-volume`.
- Vite bundles `easy-volume` into `.vite/build/main.cjs`; the Forge Vite plugin
  ships only `/.vite`, so `node_modules/easy-volume/dist/platforms/windows/volume.exe`
  is not included.
- easy-volume's Windows backend runs `path.join(path.dirname(__filename), "volume.exe")`.
  After bundling that resolves inside `app.asar/.vite/build`, and
  `toElectronPath()` only redirects `app.asar` to an equally empty
  `app.asar.unpacked`.
- easy-volume also builds an **unquoted** shell command, so a correctly packaged
  copy still fails when the profile path contains a space
  (`C:\Users\John Smith\...`).
- `getVolumeState()` catches the failure and silently returns its `50 / unmuted`
  fallback; `setVolumeLevel()` and `setVolumeMuted()` throw
  "No se pudo cambiar el volumen del sistema".

**Checks:**

- [ ] Inspect the installed package: `resources/app.asar` contains no
      `volume.exe`, and `resources/app.asar.unpacked` contains no `volume.exe`.
      (`npx asar list "...\resources\app.asar" | findstr volume.exe`)
- [ ] Open the volume popover. Note the level shown.
- [ ] Change the Windows volume with the hardware keys or the Sound settings
      flyout, reopen the popover, and compare.
- [ ] Move Kite's slider. Check the Windows volume mixer.
- [ ] Mute and unmute from Kite. Check the Windows mixer.
- [ ] Set the parent cap to 30, raise the system volume above 30, and reopen the
      popover. The system level should be lowered to 30.
- [ ] Repeat with a Windows user whose profile path contains a space.

**Pass criteria:** the displayed level matches Windows, writes change the system
level, mute works, and the cap is enforced.

**Likely fix:** bypass easy-volume on Windows. Ship `volume.exe` through
`packagerConfig.extraResource`, call it with `execFile` (no shell) from
`process.resourcesPath`, and keep an unpackaged fallback for `npm start`.
Alternatively copy it into `.vite/build`, add
`asar.unpack: ['**/volume.exe']`, and patch easy-volume's quoting.

## W-02 — Native apps are not focused, raised, or placed (P2)

**Expected:** running apps are highlighted, tapping a running app raises its
window instead of starting another process, and the app does not permanently
hide Kite's taskbar.

**Why it likely fails:**

- `getActiveAppIds()` in `src/main/appLauncher.ts` returns early because
  `swayWindowIds` is only filled by `revealSwayWindow()`.
- `revealSwayWindow()` and `focusSwayWindow()` are Sway-only (`src/main/sway.ts`).
- `launchAllowedApp()` therefore cannot find an existing window and spawns the
  app again.
- Nothing sizes or floats Windows apps, so a maximized app covers Kite's
  taskbar. Returning to Kite depends on closing the app, Alt+Tab, or relaunching
  Kite (the single-instance handler raises it).

**Checks:**

- [ ] Launch Firefox from the Aplicaciones grid.
- [ ] Confirm Kite's taskbar shows a Firefox item.
- [ ] Focus Firefox, then look at Kite's taskbar item. It should be highlighted.
- [ ] With Firefox still running, tap its Kite tile again. It should raise the
      existing window, not open a second one.
- [ ] Repeat with a second, non-single-instance app if available.
- [ ] Maximize Firefox. Check whether Kite's taskbar can be reached.
- [ ] Close Firefox. Check whether Kite regains focus.
- [ ] Relaunch Kite while another window is focused. It should raise the existing
      kiosk (single-instance path).

**Pass criteria:** one instance per app, a truthful active state, a way back to
Kite without closing the app, and no duplicate processes from repeated taps.

**Likely fix:** a small Win32 helper keyed by PID (`GetForegroundWindow`,
`SetForegroundWindow`, `MoveWindow`, `ShowWindow`) or a separate always-on-top
52 px taskbar strip. Document the behaviour if neither is added.

## W-03 — Auto-launch breaks after a Squirrel update (P2)

**Expected:** Kite starts automatically after login and keeps doing so after an
update.

**Why it failed:**

- The original code called
  `app.setLoginItemSettings({ openAtLogin: app.isPackaged })`.
- On Windows this registers the current versioned executable, for example
  `%LOCALAPPDATA%\kite\app-1.0.0\kite.exe`.
- Squirrel installs updates into a new `app-<version>` directory, so the Run
  entry would point at a removed path.
- The fix uses Squirrel's stable `Update.exe` one directory up with
  `--processStart`, which resolves the current version after every update.

**Checks:**

- [ ] Install version A, sign in, and confirm Kite appears in Task Manager >
      Startup apps and under
      `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- [ ] Reboot. Kite starts automatically.
- [ ] Install a newer Squirrel build over version A.
- [ ] Reboot. Kite still starts automatically.
- [ ] Inspect the Run entry again; it should not point at a removed
      `app-<old-version>` directory.
- [ ] Disable the entry from Task Manager; confirm whether a standard user can
      do so (it affects the kiosk design).

**Pass criteria:** auto-launch survives an update and is not trivially disabled
by the child in a normal session.

**Fix applied:** `configureAutoLaunch()` in `src/main/index.ts` registers
`Update.exe --processStart "kite.exe"` when Squirrel's stub is present. Under
Shell Launcher, let the OS launch the shell and treat the login item as a
normal-session fallback. This still needs a real Windows update cycle to confirm
it survives Squirrel's folder switch.

## W-04 — Wi-Fi error text, false success, and parsing (P2)

**Expected:** scan, connect, disconnect, and status work, and failures are
reported accurately.

**Known issues:**

- `src/main/wifi.ts` reports "Comprueba que NetworkManager esté en ejecución" on
  scan failure; NetworkManager is Linux-only. On Windows, mention the WLAN
  AutoConfig service or use a generic message.
- `wifi.connect()` can resolve before Windows associates. `node-wifi`'s README
  warns about this. Verify with `getCurrentConnections()` for a few seconds and
  fail if the SSID never appears.
- `node-wifi`'s Windows profile builder only handles WPA2/WPA/WEP/open. WPA3 and
  non-ASCII SSIDs are likely to fail.
- `windows-current-connections.js` indexes `netsh` output by line number. A
  Windows build or locale that adds/removes a field can silently mis-report the
  SSID. Test the exact image.

**Checks:**

- [ ] `netsh wlan show networks mode=Bssid` works in the kiosk user's session.
- [ ] Kite lists nearby networks with sensible signal strengths.
- [ ] The connected network is marked and sorted first.
- [ ] Connect to a WPA2 network with a password containing spaces.
- [ ] Connect to a network whose SSID contains spaces or accents.
- [ ] Connect to a WPA3-only network (expected to fail; record the message).
- [ ] Enter a wrong password. Kite reports an error and stays usable.
- [ ] Disconnect. The status changes and the network list remains usable.
- [ ] Rename or disable the WLAN adapter, then scan. The message is accurate for
      Windows.
- [ ] Compare `netsh wlan show interfaces` output with what Kite shows as the
      current SSID, including the Windows 11 `Interface type` field if present.

**Pass criteria:** accurate status, no false "connected", correct Spanish error
text, and successful association on the common WPA2 case.

## W-05 — `node-wifi` Windows connect risks (P2)

**Expected:** connecting to a scanned network cannot run arbitrary commands and
does not leave the Wi-Fi password on disk.

**Known issues in `node-wifi/src/windows-connect.js`:**

- `execFile('netsh', params, { shell: true })` builds a `cmd.exe` command from
  the scanned SSID, which is attacker-controlled by a nearby access point. A
  crafted SSID can inject a command when the child tries to join it.
- The profile XML interpolates the SSID and password without escaping.
- The password is written to `%TEMP%\nodeWifiConnect.xml`; the cleanup uses an
  unquoted `del` command, so a profile path with spaces can leave the file
  behind after a crash or failure.

**Checks:**

- [ ] Code-review any update to `node-wifi` before shipping it.
- [ ] On a lab AP with a benign test SSID containing `"`, `&`, and `|`, confirm
      the app fails safely and no command runs.
- [ ] After a failed connect, check `%TEMP%` for `nodeWifiConnect.xml`.
- [ ] After a successful connect, check `%TEMP%` again.

**Pass criteria:** no shell interpolation of network-controlled strings, and no
leftover credential file.

**Likely fix:** replace the Windows connect path with our own `netsh` wrapper
using `execFile` without `shell`, validate/escape the SSID, and delete the temp
profile reliably.

## W-06 — Kiosk escape in a normal session (P2, by design)

**Expected:** the child cannot reach the desktop, Start menu, Task Manager, or
another app.

**Current behaviour:**

- `layoutWindow()` uses `screen.getPrimaryDisplay().workArea`, so Kite
  deliberately leaves the Windows taskbar visible.
- `globalShortcut.register()` generally cannot claim Win, Alt+Tab, Ctrl+Esc, or
  Ctrl+Shift+Esc; Windows reserves or shell-owns them. Registration failures are
  ignored.
- `closable: false` plus the `close` handler protect Kite's own window, not the
  OS.
- `docs/DEPLOYMENT.md` already requires Shell Launcher v2 or Assigned Access.
  Under Shell Launcher there is no Explorer taskbar, `workArea` equals the screen
  bounds, and the same layout becomes a real kiosk.

**Checks (normal session, expected to fail):**

- [ ] Press the Windows key. Start opens.
- [ ] Press Ctrl+Esc. Start opens.
- [ ] Press Ctrl+Shift+Esc. Task Manager opens.
- [ ] Press Alt+Tab. Other windows are reachable.
- [ ] Click the Windows taskbar.

**Checks (deployed kiosk profile, expected to pass):**

- [ ] Reboot into the kiosk profile. No Explorer taskbar or desktop appears.
- [ ] Kite fills the screen edge to edge.
- [ ] Win, Ctrl+Esc, Alt+Tab, and Ctrl+Shift+Esc do not leave the kiosk.
- [ ] Ctrl+Alt+Del reaches the secure screen but Task Manager and other options
      are disabled by policy.
- [ ] Logging off or shutting down ends the session cleanly (see the power
      checks in `ACCEPTANCE.md`).

**Pass criteria:** only the deployed kiosk profile counts. A normal session is
not a supported kiosk.

## W-07 — Firefox detection misses per-user installs (P3)

**Expected:** a sample Firefox tile appears when Firefox is installed.

**Known issue:** `detectSampleApps()` in `src/main/config.ts` checks
`Program Files` and `Program Files (x86)` only. A per-user install under
`%LOCALAPPDATA%\Mozilla Firefox\firefox.exe` is missed.

**Checks:**

- [ ] With an all-users install, the Firefox sample is seeded on first run.
- [ ] With a per-user install and no `Program Files` copy, add Firefox through
      parent settings and confirm it launches.
- [ ] Optionally add `%LOCALAPPDATA%\Mozilla Firefox\firefox.exe` to the
      candidates and re-test on a clean profile.

**Pass criteria:** both common install locations are detected, or the parent can
add the app manually without confusion.

## W-08 — Files: hidden/system entries and UTF-16 text (P3)

**Expected:** only ordinary child-visible files appear, and common text files
preview.

**Known issues:**

- `src/main/files.ts` hides names starting with `.` only. Windows hidden/system
  files such as `desktop.ini` and `Thumbs.db` are listed.
- UTF-16LE text files (Notepad's "Unicode" encoding) contain NUL bytes and are
  rejected as unsupported.

**Checks:**

- [ ] Put `desktop.ini`, `Thumbs.db`, and a `.lnk` shortcut in Documents.
      Confirm which appear in Archivos.
- [ ] Create a UTF-16LE `.txt` with Notepad and preview it.
- [ ] Create a UTF-8 `.txt` and preview it (control).
- [ ] Confirm Documents and Downloads still resolve when OneDrive redirects
      them.
- [ ] Confirm a file outside the folders cannot be reached through path
      traversal or a junction.

**Pass criteria:** system clutter is hidden, UTF-8 previews work, and OneDrive
paths resolve. UTF-16 support is desirable but not a blocker.

## W-09 — Packaging polish (P3)

**Checks:**

- [ ] `npm run make` produces
      `out/make/squirrel.windows/x64/` on Windows.
- [ ] The installer and installed app show a Kite icon, not the default Electron
      icon.
- [ ] The app name and publisher shown by Windows are intentional
      (`productName` is currently lowercase `kite`).
- [ ] A signed build installs without a SmartScreen block on the target image.
- [ ] The installer works for a standard user and does not require elevation.

## W-10 — App path types (P3)

**Checks:**

- [ ] Add a normal `.exe` by full path and launch it.
- [ ] Try a `.lnk` shortcut; record the error.
- [ ] Try a `.bat` or `.cmd`; record the error.
- [ ] Try a Microsoft Store/UWP app; record the error.
- [ ] Try a path to a folder; record the error.
- [ ] Decide whether the UI should reject non-`.exe` paths or document the
      restriction.

## W-11 — Child-window button language (P3, not Windows-only)

`src/main/windowRegistry.ts` injects:

```ts
button.textContent = 'Home';
button.setAttribute('aria-label', 'Return to Kite home');
```

The rest of the UI and `ACCEPTANCE.md` say **Inicio**.

**Checks:**

- [ ] Open an allowed website and confirm the injected button reads "Inicio".
- [ ] Confirm its accessibility label is Spanish.

## End-to-end sequence

Run this order once per candidate build. Tick each step only when it passes in
the deployed kiosk profile.

1. [ ] Install as the standard user; complete first-run setup (PIN, apps, sites,
       volume cap).
2. [ ] Reboot; Kite starts automatically.
3. [ ] Volume: read, write, mute, and cap (W-01).
4. [ ] Wi-Fi: scan, connect, wrong password, disconnect, status (W-04, W-05).
5. [ ] Launch Firefox; raise it from the taskbar; close it (W-02).
6. [ ] Open Archivos; browse, preview an image and a text file; close it
       (W-08).
7. [ ] Open an allowed website; close it with **Inicio** and with Escape.
8. [ ] Try Win, Alt+Tab, Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4 under the kiosk policy
       (W-06).
9. [ ] Lock the parent gate, try five wrong PINs, confirm the lockout, then
       unlock.
10. [ ] Restart from the power menu; after boot, Kite returns.
11. [ ] Install an update; reboot; confirm auto-launch (W-03).

## Results log

| Date | Tester | Kite build | Windows build | Kiosk method | Result | Notes |
| ---- | ------ | ---------- | ------------- | ------------ | ------ | ----- |
|      |        |            |               |              |        |       |

## Known limitations to avoid re-reporting

These are intentional or already documented; do not file them as new findings
unless the decision changes:

- Native apps run outside Kite's sandbox, and Firefox can reach any website.
- Ctrl+Alt+Del and the secure attention sequence cannot be intercepted by
  Electron; OS policy is required.
- Kite's taskbar is drawn inside its window and can be covered by a native app.
- Unsigned builds trigger SmartScreen.
- Linux/Sway-specific placement code is inert on Windows; that is expected.

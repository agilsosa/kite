# Acceptance checklist

Use this checklist on the exact OS image and hardware you will deploy. Items
marked **manual** require a real display, keyboard, and network; they cannot be
fully verified from a CI container.

## Build and launch

- [ ] `npm ci` completes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run make` succeeds on Windows and macOS (and Linux if targeted).
- [ ] The packaged app starts frameless, with no OS taskbar/dock entry and no
      close button.
- [ ] On Linux and macOS it fills the usable work area; on Windows it enters
      OS fullscreen and the Windows taskbar is not visible below or above it.
- [ ] Kite's own taskbar is visible along the bottom of the window, showing the
      Kite button, the clock, and the power button.
- [ ] Entering compositor fullscreen fills exactly the display: the taskbar's
      bottom edge, clock, and power button stay fully visible, and leaving
      fullscreen restores the work-area layout.
- [ ] There are no black borders at 100%, 125%, and 150% display scaling, and
      after the display resolution changes.
- [ ] A second launch focuses the existing window instead of starting a second
      kiosk.

## Escape prevention — manual

- [ ] `Alt+F4` does not close the app (Windows/Linux).
- [ ] `Ctrl+W`, `Ctrl+R`, `Ctrl+Shift+I`, `F5`, `F11`, `F12` do not reload or
      open developer tools.
- [ ] `Cmd+Q`, `Cmd+W`, `Cmd+R`, `Cmd+Tab` do not close or switch away from Kite
      (macOS; OS policy may be required for `Cmd+Tab`).
- [ ] Killing the renderer process reloads the kiosk instead of leaving a blank
      screen (developer test only).

## Language and icons

- [ ] Every visible label, dialog, notice, error, placeholder, and
      accessibility label is in Spanish.
- [ ] Taskbar times and file dates use Spanish locale formatting.
- [ ] No emoji appears anywhere in the UI, taskbar, tiles, file list, or
      preview pane. Icons are Lucide drawings.
- [ ] The parent app form offers a Lucide icon picker, and a saved app renders
      the chosen icon on the home screen and taskbar.
- [ ] A config saved by an older Kite version with emoji icons still renders an
      icon (mapped to the closest Lucide key) instead of a missing glyph.

## App launcher

- [ ] An allow-listed app launches from a home tile.
- [ ] Removing an app from parent settings removes its tile.
- [ ] A tile cannot launch an app that is not in the list (test through the IPC
      bridge, not by editing the UI).
- [ ] An app path that does not exist produces an error message, not a crash.

## Websites

- [ ] An allowed origin opens in a separate child window above the home
      screen.
- [ ] The child window has a visible **Inicio** button.
- [ ] `Escape` closes the child window and returns to Kite.
- [ ] `window.location = 'https://example.com'` from the child is blocked.
- [ ] `window.open('https://example.com')` is blocked.
- [ ] Navigating to a non-allowed path or origin is blocked.
- [ ] A download link does not save a file.
- [ ] The child page has no `window.api`, no Node globals, and cannot reach the
      filesystem or shell.

## Files

- [ ] The home screen shows one **Archivos** app tile in the **Aplicaciones**
      grid, next to the allowed apps; no separate Documents or Downloads tiles
      exist.
- [ ] Opening the tile creates one app-sized **Archivos** window above Kite with
      both **Documentos** and **Descargas** in a sidebar.
- [ ] Kite's taskbar stays visible and shows a highlighted **Archivos** item while
      the window is focused.
- [ ] The **Archivos** item raises the existing window instead of creating a
      second one.
- [ ] The **Inicio** button and `Escape` close the Files window, focus Kite, and
      remove the taskbar item.
- [ ] Selecting the taskbar Kite button while the Files window is open closes
      it and returns to the home screen.
- [ ] Switching between **Documentos** and **Descargas** resets the folder path
      and preview.
- [ ] A folder opens with folders first, then files.
- [ ] Choosing a folder navigates into it; the breadcrumb and **Atrás** match the
      current location.
- [ ] Choosing a picture shows it in the side preview pane.
- [ ] Choosing a text file shows its contents in the side preview pane.
- [ ] A text file over 256 KB shows only the beginning with a truncation note.
- [ ] An image over 12 MB, a binary file, and an unknown extension show a short
      message instead of a preview.
- [ ] Dotfiles are not listed and cannot be opened through the IPC bridge.
- [ ] `..`, absolute segments, nested `..`, and unknown roots are rejected
      through the IPC bridge.
- [ ] A symlink inside a folder that points outside it is not listed; reading
      it through the IPC bridge is rejected.
- [ ] If Documents or Downloads does not exist, the Files window says so and
      does not create the folder.
- [ ] No file can be created, edited, renamed, moved, or deleted from the Files
      window.

## Virtual keyboard

The on-screen keyboard is off by default. Enable **Ajustes de adultos → Equipo →
Teclado en pantalla** to run these checks.

- [ ] Focusing a text input in Kite's own UI (PIN gate, settings) opens the
      keyboard.
- [ ] Focusing a text input inside a child window opens the keyboard above the
      page.
- [ ] Letters, digits, punctuation, space, backspace, and enter type into the
      focused field.
- [ ] Shift applies to one letter and then resets.
- [ ] The keyboard does not take focus away from the page or clear the field.
- [ ] Tapping a non-text part of the page hides the keyboard.
- [ ] **Ocultar** hides it; tapping a text field brings it back.
- [ ] The keyboard stays above the page after clicking inside the page again.
- [ ] It remains usable at the largest supported touch resolution.
- [ ] With the setting off, no keyboard appears in Kite's own UI or in child
      windows.

## Wi-Fi

Wi-Fi is deliberately open to the child: the popover in the top bar scans,
joins, and disconnects without the parent PIN.

- [ ] The Wi-Fi pill opens a compact popover, not a full-screen dialog.
- [ ] The popover lists nearby networks without unlocking parent settings.
- [ ] Joining an open network works.
- [ ] Joining a secured network with the correct password works.
- [ ] A wrong password reports an error and leaves the kiosk usable.
- [ ] Disconnect works and the home screen shows the offline state.
- [ ] The home screen reflects connected/offline state.
- [ ] Wi-Fi password is not shown again after connecting.
- [ ] `Escape` or a click outside closes the popover.
- [ ] Focusing the pill and pressing `Enter` or `Space` opens the popover and
      moves focus into it.

## Volume

- [ ] The volume pill opens a compact popover, not a full-screen dialog.
- [ ] The slider changes system volume.
- [ ] Mute and unmute work.
- [ ] The slider cannot exceed the parent cap.
- [ ] Lowering the cap immediately lowers the reported/system volume.
- [ ] With the cap at 0, the slider is disabled.
- [ ] `Escape` or a click outside closes the popover.
- [ ] Focusing the pill and pressing `Enter` or `Space` opens the popover and
      moves focus into it.
- [ ] On Linux without `amixer`, the UI shows an error and the kiosk does not
      crash.

## Battery

The battery pill sits in the home-screen top bar and is hidden when the machine
has no battery. Linux reads `/sys/class/power_supply`, Windows asks
`Win32_Battery` through PowerShell, and macOS uses `pmset`.

- [ ] On a Linux laptop, the pill shows the same percentage as
      `cat /sys/class/power_supply/BAT0/capacity`.
- [ ] On Windows, the pill shows the percentage reported by
      `Get-CimInstance Win32_Battery`.
- [ ] Plugging in the charger switches the pill to the charging style within a
      minute, or immediately after Kite regains focus.
- [ ] Unplugging it returns the pill to the discharging style.
- [ ] At 20% or less while discharging, the pill uses the low-battery style.
- [ ] On a desktop without a battery, the pill is absent and the top bar still
      lays out correctly.
- [ ] A screen reader announces the percentage and charging state.

## Taskbar and power

- [ ] Launching an allow-listed app adds an item with its name and icon to the
      taskbar.
- [ ] The item is highlighted while that app has focus, and not while Kite has
      focus.
- [ ] Selecting the item while the app is running switches to it instead of
      starting a second copy, where the compositor allows it.
- [ ] Closing the app removes its item and reveals Kite again.
- [ ] An open website appears in the taskbar; selecting it raises its window.
- [ ] Selecting the Kite button closes open website windows and shows the home
      screen.
- [ ] The clock shows local time and stays current.
- [ ] The power button opens a menu with **Reiniciar el equipo** and
      **Apagar el equipo**.
- [ ] Choosing an action opens a confirmation dialog.
- [ ] **Cancelar** closes the dialog and leaves the machine running.
- [ ] On a disposable test device, confirming restarts or powers off the
      machine.

## Parent settings

- [ ] The taskbar shows `kite` with the current version.
- [ ] Two quick clicks on the taskbar version label open the PIN gate.
- [ ] One click, or two slow clicks, leave the gate closed.
- [ ] With no PIN, creating a PIN works and opens settings.
- [ ] A wrong PIN is rejected.
- [ ] Five wrong PINs lock attempts for 30 seconds.
- [ ] Closing settings locks the parent session.
- [ ] Config updates fail while the session is locked.
- [ ] Changing the child name, apps, origins, and volume cap persists after
      restart.
- [ ] Exit kiosk requires the parent session and a second confirmation.

## Dialogs

- [ ] Every modal keeps a visible margin between its border and all four screen
      edges, including at the smallest supported resolution.
- [ ] Short modals are centered vertically.
- [ ] When the parent settings content is taller than the screen, only the
      modal body scrolls; the title, description, close button, and footer stay
      fixed.
- [ ] The modal never makes the whole page scroll behind it.

## Permissions

- [ ] A child page requesting camera or microphone gets `NotAllowedError`.
- [ ] Geolocation is denied.
- [ ] Notifications, MIDI, clipboard-read, HID, USB, and serial requests are
      denied.
- [ ] No permission prompt is ever shown to the child.

## OS lockdown and deployment

- [ ] Standard/non-admin kiosk account is in use.
- [ ] Assigned Access / Single App Mode / minimal window manager is configured.
- [ ] Auto-launch works after reboot.
- [ ] Task switching, terminal, and desktop access are blocked by OS policy.
- [ ] Full-disk encryption and firmware passwords are enabled.
- [ ] Installer and app are code-signed/notarized where required.
- [ ] Recovery procedure is documented and tested.

## Local verification performed

On 2026-10-28, on Linux (Wayland session, packaged Linux build), the following
were exercised through Electron's remote debugging protocol:

- The packaged app started and rendered the React home screen.
- On Sway (Wayland), the window used the compositor's usable workspace
  (`0,32 1366×736` on a 1366×768 screen with a 30 px bar) instead of covering
  the bar.
- The taskbar rendered inside the window at the bottom, with the Kite button,
  the open-app area, the clock, and the power button.
- The Firefox sample app appeared on the home screen and launched above Kite,
  floated and sized to `1175×604` so the taskbar stayed visible.
- The Firefox taskbar item appeared with the app icon, was highlighted while
  Firefox had focus, and returned to normal when Kite was raised.
- Selecting the item while Firefox was running focused the existing window
  instead of opening a second one.
- Closing Firefox removed the item from the taskbar.
- The power button opened an in-app menu; choosing **Apagar** opened the
  confirmation dialog, and **Cancelar** closed it without running a command.
- Long website names wrapped inside their tiles instead of overlapping the next
  tile at 1366×768 and 1024×768.
- The taskbar rendered `kite v1.0.0` from `app.getVersion()`.
- Two quick clicks on the taskbar version label opened the PIN creation gate.
  One click and two slow clicks left it closed.
- Focusing the PIN field displayed the on-screen keyboard, and a virtual key
  inserted `1` into the field. The launcher keyboard now follows the parent
  setting instead of a hard-coded flag.
- `window.api.config.update` was rejected while the parent session was locked.
- Launching an unknown app ID was rejected by the main process.
- The volume and Wi-Fi pills opened compact popovers that closed on `Escape`
  and on a click outside.
- The Wi-Fi popover scanned and listed nearby networks without a parent
  session, including signal strength, security, and the connected network.
- Selecting a secured network showed the password field and join form.
- Both pills opened with the keyboard, moved focus into the panel, and returned
  focus to the pill on `Escape`; the volume pill also opened with `Space`.
- A real mouse click opened the pill without leaving a focus ring on it.
- Parent settings showed only Apps, Websites, and Device tabs; Wi-Fi is no
  longer in the PIN-protected settings.
- `window.open('https://example.com')` returned `null`.
- `window.location.assign('https://example.com/evil')` did not navigate.
- Opening `https://example.com` through the IPC bridge was rejected as
  not allow-listed.
- Opening `https://pbskids.org` created an isolated child window with the
  injected Home button and no `window.api`.
- The Home button stayed in place while the page rendered and closed the child
  window when clicked.
- `getUserMedia({ audio: true })` returned `NotAllowedError`, and geolocation
  was denied.
- `npm run typecheck`, `npm run lint`, and `npm run package` passed.
- The restart and shut-down commands were not executed.

### Fullscreen geometry (2026-10-29)

Measured on Linux/Wayland (Sway, 1366×768 output, 32 px bar):

- With `resizable: false`, Sway's fullscreen gave the window
  `1398×778` (output plus 32×10 decoration shadow extents), so the taskbar's
  right end and bottom edge were clipped and the power button was off-screen.
- With `resizable: true`, the same fullscreen produced exactly `1366×768`,
  with `innerWidth/innerHeight` of 1366×768 and the taskbar bottom at 768.
- Because `move absolute position` only works on floating containers, Kite's
  windows are now floated explicitly before being sized and moved. Normal mode
  is `0,32 1366×736` (the usable work area) with the taskbar bottom at 736.
- Entering and leaving fullscreen twice returned to `0,32 1366×736` and
  1366×736 each time.
- With a website window open over fullscreen Kite, closing the website left
  the main window fullscreen at `1366×768`; closing a native app re-laid out
  the main window correctly.

### File explorer (2026-10-29)

On the same Linux/Wayland test display, with fixtures placed in the real
`~/Documents` and `~/Downloads`:

- The built-in **Archivos** tile opened one app-sized `1175×604` frameless window
  at `96,98` above Kite on the `1366×736` usable area, leaving the taskbar
  visible. The window was moved onto Kite's Sway workspace automatically.
- The Files window showed Documents and Downloads in its sidebar. Switching
  roots reset the breadcrumb and preview; each root listed its own fixture.
- The taskbar showed one highlighted **Archivos** item. Activating it after
  focusing Kite raised the Files window, and opening the tile twice still left
  exactly one Files window.
- **Inicio**, `Escape`, and the taskbar Kite button all closed the Files window,
  focused Kite, and removed the taskbar item.
- The `documents` root resolved to `~/Documents`, even with `XDG_CONFIG_HOME`
  pointing at a directory without `user-dirs.dirs`; it did not fall back to the
  home directory.
- The Files window listed a test folder and showed a 480×320 PNG in the side
  preview.
- A small text file rendered in the preview pane; a 390 KB text file was
  truncated at 262,144 characters and showed the truncation banner.
- Folder navigation, the breadcrumb, and **Atrás** returned to the expected
  views.
- A `.zip` file reported that it cannot be previewed; a 13 MB `.png` reported
  that it is too large.
- An empty folder showed **Esta carpeta está vacía**.
- Hidden entries were absent from listings. Reading a dotfile, `..`, a nested
  `..`, an absolute segment, an unknown root, and symlinks to `/etc` or
  `/etc/hostname` was rejected with a short error. A Files window request for
  `files:open` was rejected by the main window guard.
- Missing folders and empty read requests returned short errors without
  exposing absolute paths.
- `npm run typecheck`, `npm run lint`, and `npm run package` passed.

Windows and macOS shortcut behaviour, installed-app auto-launch, Wi-Fi hardware,
system volume, battery reporting, and OS kiosk configuration still require
manual verification on the target devices.

# Publishing updates

Kite updates itself on Windows through Electron's built-in Squirrel updater.
Releases live in a **public** GitHub repository and are served by
[`update.electronjs.org`](https://github.com/electron/update.electronjs.org).
The app never installs an update on its own: it downloads in the background and
waits for a parent to approve the restart.

| Item       | Value                                                                        |
| ---------- | ---------------------------------------------------------------------------- |
| Repository | `agilsosa/kite` (must be public)                                             |
| Feed       | `https://update.electronjs.org/agilsosa/kite/win32-<arch>/<current version>` |
| Updater    | Electron `autoUpdater` (Squirrel.Windows); GitHub Releases check on Linux    |
| Publisher  | `@electron-forge/publisher-github`                                           |
| Platforms  | Windows packaged builds and Linux `.deb`/`.rpm` packages (automatic updates) |

The repository owner and name live in `src/shared/release.ts`. `package.json`
carries the matching `repository` URL. Change both if the project moves.

## One-time setup

1. Create the **public** repository `agilsosa/kite` on GitHub. Do not enable
   "Private"; `update.electronjs.org` only reads public releases.
2. Push this project to it (there are no commits yet):

   ```bash
   git add .
   git commit -m "Initial Kite"
   git branch -M main
   git remote add origin https://github.com/agilsosa/kite.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Actions → General → Workflow
   permissions** and select **Read and write permissions**. The release workflow
   requests `contents: write` so Forge can create the GitHub Release.
4. Leave Actions enabled. The workflow uses the automatic `GITHUB_TOKEN`; no
   personal token needs to be stored in the repository.

## How updates behave

- On a packaged Windows build, Kite configures the feed at startup, performs a
  first check after about one minute, then checks every six hours.
- Squirrel's first launch (`--squirrel-firstrun`) skips the immediate check and
  waits ten minutes, because Squirrel still holds a lock on the app folder.
- A newer release is downloaded automatically in the background.
- `update.electronjs.org` caches the latest release for about 15 minutes, so a
  version that was just published can still be reported as “up to date”. Retry
  the check after that window; Kite does not need to be restarted.
- Kite never restarts itself. A parent can open **Ajustes de adultos → Equipo →
  Actualizaciones** and choose **Reiniciar e instalar**, which authorizes
  shutdown and calls `quitAndInstall()`.
- A downloaded update also applies the next time Kite starts normally, even if
  nobody pressed the button. It is never applied while the app is running.
- On a packaged Linux build, Kite follows the GitHub `releases/latest`
  redirect every six hours to learn the newest published version. When a newer
  version exists, adult settings offer **Instalar actualización**. The
  parent-approved install goes through a root-owned helper launched with
  `pkexec`, which downloads the matching `.deb`/`.rpm`, verifies its SHA-256,
  installs it, and restarts Kite into the new version. See
  [Linux updates](#linux-updates).
- Development builds and macOS show the feature as unavailable. macOS in-app
  updates would additionally require Developer ID signing and notarization.

The first build that contains this updater has to be installed manually.
Builds published before the updater existed cannot update themselves.

## Linux updates

Linux installs update themselves through a small privileged helper instead of
Electron's Squirrel updater. The parent still makes the decision: Kite only
checks, downloads, and installs after **Ajustes de adultos → Equipo →
Actualizaciones → Instalar actualización** is confirmed.

| Piece                          | Location                                              |
| ------------------------------ | ----------------------------------------------------- |
| Update helper                  | `/usr/lib/kite/kite-update` (root-owned, mode `0755`) |
| Polkit rule                    | `/usr/share/polkit-1/rules.d/50-kite-update.rules`    |
| Payload source                 | `build/linux/` in the repository                      |
| Package checksums              | `SHA256SUMS` attached to each GitHub Release          |
| Installer packages that use it | Debian/Ubuntu `.deb` and Fedora/RHEL `.rpm`           |

The flow:

1. Kite's periodic check finds a newer release and exposes its version in adult
   settings. Kite never installs anything on its own.
2. After the parent confirms, Kite runs
   `pkexec /usr/lib/kite/kite-update` through the IPC handler that already
   requires an unlocked parent session.
3. The helper follows the `/releases/latest` redirect to the published tag,
   builds the expected asset name, and downloads the package and `SHA256SUMS`
   over HTTPS.
4. It verifies the SHA-256, checks the package's `Package`/`Version` or
   `NAME`/`VERSION` metadata, and installs it with `apt-get install` or
   `dnf install`.
5. It confirms the installed version, and Kite relaunches itself into it with
   `app.relaunch()`.

The helper accepts no caller-supplied URL, path, or package. That keeps a local
process from turning the polkit rule into a generic root installer. The polkit
rule only matches `org.freedesktop.policykit.exec` for
`/usr/lib/kite/kite-update` in an active local session; without it `pkexec`
would ask for an admin password that the kiosk user does not have.

The `postinst`/`%post` script copies the helper and polkit rule out of the app's
`resources/linux` directory on install, and `postrm`/`%postun` removes them.
The Debian package depends on `curl`, `ca-certificates`, and
`pkexec | policykit-1`; the RPM requires `curl` and `polkit`.

Limitations:

- The first build that ships the helper must be installed manually. Older
  packages do not have it, and Kite falls back to **Abrir página de la
  versión**.
- Releases must include `SHA256SUMS`. The `linux` job in the release workflow
  generates it from the packages it built.
- Only `amd64`/`arm64` Debian packages and `x86_64`/`aarch64` RPMs are
  supported by the asset-name mapping. Add architectures deliberately.
- `curl` trusts GitHub's TLS certificate chain. There is no second signature
  yet, so a GitHub account compromise is equivalent to a package-signing key
  compromise. Sign `SHA256SUMS` with a project key before treating the fleet as
  high-value.
- Kite only relaunches itself. If a native app launched from Kite is still
  open, the kiosk window returns but that app may stay above it; close child
  apps before installing.

## Publish a new version

Run these steps from a clean `main` branch.

1. Bump the version. Use SemVer and keep `package.json` in sync with the tag:

   ```bash
   npm version patch --no-git-tag-version
   ```

   Use `minor` or `major` when appropriate. `--no-git-tag-version` only edits
   `package.json` and `package-lock.json`; the tag is created below.

2. Commit the version bump:

   ```bash
   git add package.json package-lock.json
   git commit -m "Release 1.0.1"
   ```

3. Create an annotated tag whose name is `v` plus the exact package version:

   ```bash
   git tag v1.0.1
   ```

4. Push the commit and the tag:

   ```bash
   git push origin main
   git push origin v1.0.1
   ```

5. Watch **Actions → Release**. The workflow has two jobs:
   - `windows` installs dependencies with `npm ci`, runs `npm run typecheck` and
     `npm run lint`, verifies that the tag matches `package.json`, and runs
     `npm run release`. That packages, makes the Squirrel installer, creates a
     **non-draft, non-prerelease** GitHub Release, and uploads the Windows
     assets.
   - `linux` runs after `windows` and builds the Debian and RPM packages with
     `npm run make:linux`, then uploads them to the same release with
     `electron-forge release --from-make`.

6. Open the new release and confirm it contains all assets:
   - `RELEASES`
   - `kite-<version>-full.nupkg` (plus a `-delta.nupkg` after the first release)
   - `kite-<version> Setup.exe`
   - `kite_<version>_amd64.deb`
   - `kite-<version>-1.x86_64.rpm`
   - `SHA256SUMS`

   `update.electronjs.org` needs `RELEASES` and the `.nupkg`. Keep them public.
   The Linux packages are optional for Windows users and ignored by the
   Windows update feed. Kite's Linux helper refuses to install a package whose
   name or SHA-256 is missing from `SHA256SUMS`.

7. Verify the feed for the version you are updating **from**, for example:

   ```text
   https://update.electronjs.org/agilsosa/kite/win32-x64/1.0.0
   ```

   It may take a few minutes to reflect a new release because the service
   caches GitHub results. A `404` before that is normal.

8. On a Windows machine running the older version, open the parent settings and
   press **Buscar actualizaciones**. The state should move through
   "Buscando…", "Descargando…", and "Actualización descargada". Press
   **Reiniciar e instalar** and confirm that the version in the taskbar changes.

### Linux packages

The `linux` job builds two packages on `ubuntu-latest` and attaches them to the
same GitHub Release:

- `kite_<version>_amd64.deb` for Debian, Ubuntu, and derivatives.
- `kite-<version>-1.x86_64.rpm` for Fedora, RHEL, and derivatives. The `%{?dist}`
  suffix is only added when the build host defines it.

The job installs `rpm` first because the RPM maker needs `rpmbuild`. The Debian
maker uses `dpkg-deb --root-owner-group`, so `fakeroot` is not required.

Linux updates use the helper described in [Linux updates](#linux-updates).
The package is still installable by hand, which is the fallback for builds that
predate the helper and for recovery:

```bash
sudo apt install ./kite_<version>_amd64.deb
sudo dnf install ./kite-<version>-1.x86_64.rpm
```

The job depends on `windows` so the release already exists when it uploads. If
the Linux job fails after the Windows job created the release, re-run only the
failed `linux` job. The GitHub publisher **skips assets that already exist**, so
delete a stale `.deb`/`.rpm` from the release before retrying the same version,
or publish a higher version.

### Version rules

- The tag must be `v` + the `package.json` version (`v1.0.1` for `1.0.1`). The
  workflow fails the build if they differ.
- Always increase the version. Squirrel will not install an equal or lower
  version.
- Drafts and prereleases are ignored by `update.electronjs.org`. The Forge
  configuration explicitly publishes with `draft: false` and
  `prerelease: false`.
- Deleting or editing a release is not a rollback for installed machines.
  Publish a higher version with the fix.

## Publish manually on Windows

Use this when Actions is unavailable, or to test the packaging path before
automating it. Run it on Windows, not Linux; Squirrel building is not reliable
across platforms.

```powershell
$env:GITHUB_TOKEN = "<token with Contents: read and write>"
npm ci
npm run typecheck
npm run lint
npm run release
```

A classic token needs the `repo` scope. A fine-grained token needs **Contents:
Read and write** on `agilsosa/kite`. Do not commit the token or put it in
`forge.config.ts`; Forge reads `GITHUB_TOKEN` from the environment.

`npm run release` clears `.vite`, packages the app, builds every maker for the
current platform, and uploads the results. On Windows the Squirrel artifacts are
under `out/make/squirrel.windows/x64/`.

## Publish manually on Linux

Use this to test the Linux packaging path, or as a fallback when Actions is
unavailable. It needs `dpkg-deb` and `rpmbuild` (the `rpm` package on
Debian/Ubuntu). Run it after the Windows release exists; otherwise Forge creates
the release itself from the current `package.json` version.

```bash
export GITHUB_TOKEN="<token with Contents: read and write>"
npm ci
npm run typecheck
npm run lint
npm run release:linux
```

`npm run release:linux` clears `.vite`, packages the app, builds the `.deb` and
`.rpm`, and uploads them to the GitHub Release for the current version. To build
the packages without uploading, run `npm run make:linux`. Artifacts land in
`out/make/deb/x64/` and `out/make/rpm/x64/`.

The Linux updater also needs the checksum list. After a manual upload, generate
and attach it, matching the release the packages were uploaded to:

```bash
cd out/make
{
  (cd deb/x64 && sha256sum *.deb)
  (cd rpm/x64 && sha256sum *.rpm)
} > SHA256SUMS
gh release upload "v<version>" SHA256SUMS --clobber
```

`gh` uses the same `GITHUB_TOKEN`/`GH_TOKEN`. Without `SHA256SUMS`, the helper
refuses to install the release.

The RPM build uses `build/rpm.spec.ejs` so `%install` works with both rpm 4 and
rpm 6, and `build/rpm.desktop.ejs` to avoid an upstream duplicate
`StartupWMClass` line. Keep those templates in sync with the upstream maker if it
changes.

## Release checklist

- [ ] The working tree is clean and `main` is up to date.
- [ ] `package.json` version is higher than the last release.
- [ ] `npm run typecheck` and `npm run lint` pass locally.
- [ ] The tag is `v<package.json version>`.
- [ ] The GitHub Release is public, not a draft, and not a prerelease.
- [ ] `RELEASES` and the matching `.nupkg` are attached.
- [ ] `kite_<version>_amd64.deb` and `kite-<version>-1.x86_64.rpm` are attached.
- [ ] `SHA256SUMS` is attached and lists both Linux packages.
- [ ] The Debian package installs on a clean Debian/Ubuntu machine
      (`sudo apt install ./kite_<version>_amd64.deb`) and Kite starts.
- [ ] The RPM package installs on a clean Fedora/RHEL machine
      (`sudo dnf install ./kite-<version>-1.x86_64.rpm`) and Kite starts.
- [ ] On Linux, adult settings install the update without a password prompt and
      Kite restarts into the new version.
- [ ] The feed URL for the previous version resolves.
- [ ] A Windows install of the previous version finds, downloads, and installs
      the update.
- [ ] After the restart, Kite reports the new version.
- [ ] After a reboot, Kite still starts automatically (see
      [W-03](WINDOWS-VERIFICATION.md#w-03--auto-launch-breaks-after-a-squirrel-update-p2)).
- [ ] Parent settings and the kiosk layout still work after the update.

## Troubleshooting

| Symptom                                                            | Likely cause                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release workflow fails with `Please set GITHUB_TOKEN`              | Repository workflow permissions are read-only, or Actions is disabled.                                                                                                    |
| Workflow fails with a tag/version mismatch                         | The tag is not `v` + `package.json` version.                                                                                                                              |
| Release exists but Kite sees no update                             | Release is a draft/prerelease, `RELEASES` or `.nupkg` is missing, the tag is not SemVer, or the service cache has not refreshed.                                          |
| `update.electronjs.org` returns `404`                              | Repository is private, the release is not published, or the requested platform/version has no compatible asset.                                                           |
| Kite always reports "Kite está actualizado" on the old version     | The installed build predates the updater, or the release version is not greater than the installed one.                                                                   |
| Kite says "actualizado" right after a release                      | `update.electronjs.org` caches the latest release for about 15 minutes. Check the feed URL; it returns `204` until the cache expires and then `200` with the new version. |
| An update downloads but never installs                             | Parent approval was not given. Open **Ajustes de adultos → Equipo → Actualizaciones**.                                                                                    |
| Auto-launch stops after an update                                  | Check the Run entry points at Squirrel's `Update.exe`, not a removed `app-<version>` folder. The code now uses the stub, but verify it on the target Windows image.       |
| SmartScreen warns on install                                       | The build is unsigned. Sign the Squirrel installer and executable for production use.                                                                                     |
| `linux` job fails with `rpmbuild not found`                        | The runner is missing the `rpm` package. The workflow installs it; re-run the job if the install step was skipped.                                                        |
| Re-running `linux` skips the `.deb`/`.rpm`                         | The publisher does not overwrite existing assets. Delete the stale asset from the release, or publish a higher version.                                                   |
| Linux offers only "Abrir página de la versión"                     | The installed package predates the helper, `/usr/lib/kite/kite-update` is missing, or `/usr/bin/pkexec` is absent. Reinstall the current package once.                    |
| Linux install fails with "No se autorizó la instalación"           | The polkit rule is missing or the session is not local/active. Reinstall the package and check `/usr/share/polkit-1/rules.d/50-kite-update.rules`.                        |
| Linux install fails with "No se encontró la lista de comprobación" | The release has no `SHA256SUMS`. Re-run the `linux` workflow job after fixing the checksum step.                                                                          |
| Linux install fails with "no coincide con la suma de comprobación" | The downloaded package and `SHA256SUMS` do not match, or the download was corrupted. Re-run the release job; do not bypass the check.                                     |
| Linux install finishes but Kite stays on the old version           | The upgrade installed elsewhere (check `dpkg -l kite` or `rpm -q kite`), or Kite did not relaunch. Start Kite again; the next launch uses `/usr/lib/kite/kite`.           |
| `.deb`/`.rpm` installs but Kite has no menu icon                   | The desktop environment caches its menu. Log out and back in, or refresh the icon cache for `/usr/share/pixmaps/kite.png`.                                                |

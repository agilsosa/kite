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
| Updater    | Electron `autoUpdater` (Squirrel.Windows)                                    |
| Publisher  | `@electron-forge/publisher-github`                                           |
| Platforms  | Windows packaged builds only (CI builds x64)                                 |

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
- Kite never restarts itself. A parent can open **Ajustes de adultos → Equipo →
  Actualizaciones** and choose **Reiniciar e instalar**, which authorizes
  shutdown and calls `quitAndInstall()`.
- A downloaded update also applies the next time Kite starts normally, even if
  nobody pressed the button. It is never applied while the app is running.
- Development builds, Linux, and macOS show the feature as unavailable. macOS
  in-app updates would additionally require Developer ID signing and
  notarization.

The first build that contains this updater has to be installed manually.
Builds published before the updater existed cannot update themselves.

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

5. Watch **Actions → Release Windows**. The workflow:
   - installs dependencies with `npm ci`,
   - runs `npm run typecheck` and `npm run lint`,
   - verifies that the tag matches `package.json`,
   - runs `npm run release`, which packages, makes the Squirrel installer, and
     publishes a **non-draft, non-prerelease** GitHub Release.

6. Open the new release and confirm it contains all three assets:
   - `RELEASES`
   - `kite-<version>-full.nupkg` (plus a `-delta.nupkg` after the first release)
   - `kite-<version> Setup.exe`

   `update.electronjs.org` needs `RELEASES` and the `.nupkg`. Keep both public.

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

## Release checklist

- [ ] The working tree is clean and `main` is up to date.
- [ ] `package.json` version is higher than the last release.
- [ ] `npm run typecheck` and `npm run lint` pass locally.
- [ ] The tag is `v<package.json version>`.
- [ ] The GitHub Release is public, not a draft, and not a prerelease.
- [ ] `RELEASES` and the matching `.nupkg` are attached.
- [ ] The feed URL for the previous version resolves.
- [ ] A Windows install of the previous version finds, downloads, and installs
      the update.
- [ ] After the restart, Kite reports the new version.
- [ ] After a reboot, Kite still starts automatically (see
      [W-03](WINDOWS-VERIFICATION.md#w-03--auto-launch-breaks-after-a-squirrel-update-p2)).
- [ ] Parent settings and the kiosk layout still work after the update.

## Troubleshooting

| Symptom                                                        | Likely cause                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release workflow fails with `Please set GITHUB_TOKEN`          | Repository workflow permissions are read-only, or Actions is disabled.                                                                                              |
| Workflow fails with a tag/version mismatch                     | The tag is not `v` + `package.json` version.                                                                                                                        |
| Release exists but Kite sees no update                         | Release is a draft/prerelease, `RELEASES` or `.nupkg` is missing, the tag is not SemVer, or the service cache has not refreshed.                                    |
| `update.electronjs.org` returns `404`                          | Repository is private, the release is not published, or the requested platform/version has no compatible asset.                                                     |
| Kite always reports "Kite está actualizado" on the old version | The installed build predates the updater, or the release version is not greater than the installed one.                                                             |
| An update downloads but never installs                         | Parent approval was not given. Open **Ajustes de adultos → Equipo → Actualizaciones**.                                                                              |
| Auto-launch stops after an update                              | Check the Run entry points at Squirrel's `Update.exe`, not a removed `app-<version>` folder. The code now uses the stub, but verify it on the target Windows image. |
| SmartScreen warns on install                                   | The build is unsigned. Sign the Squirrel installer and executable for production use.                                                                               |

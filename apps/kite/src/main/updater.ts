import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { promisify } from 'node:util';
import { app, autoUpdater, net, shell } from 'electron';
import type { UpdateState } from '../shared/types';
import { GITHUB_REPOSITORY, UPDATE_FEED_ORIGIN } from '../shared/release';

const execFileAsync = promisify(execFile);

const INITIAL_CHECK_DELAY_MS = 60 * 1000;
const FIRST_RUN_CHECK_DELAY_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;
const RELEASE_REQUEST_TIMEOUT_MS = 30 * 1000;
const INSTALL_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_INSTALL_OUTPUT = 4 * 1024 * 1024;

/** Installed root-owned by the Debian/RPM package post-install script. */
const LINUX_HELPER_PATH = '/usr/lib/kite/kite-update';
const PKEXEC_PATH = '/usr/bin/pkexec';
const LATEST_RELEASE_URL = `https://github.com/${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.name}/releases/latest`;

let state: UpdateState = {
  phase: 'disabled',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseUrl: null,
  canInstall: false,
  checkedAt: null,
  error: null,
};
let initialized = false;
let checkInFlight = false;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let authorizeShutdown: (() => void) | null = null;

/** Automatic downloads only exist for the Squirrel.Windows updater. */
function canInstallUpdates(): boolean {
  return app.isPackaged && process.platform === 'win32';
}

/**
 * Windows checks through Electron's updater. Linux follows the GitHub
 * `releases/latest` redirect to learn whether a newer version exists.
 */
function canCheckForUpdates(): boolean {
  return (
    app.isPackaged &&
    (process.platform === 'win32' || process.platform === 'linux')
  );
}

/**
 * Linux installs go through the root-owned update helper, invoked with pkexec.
 * The helper must exist, be owned by root, not be writable by anyone else, and
 * pkexec must be available. Development builds never take this path.
 */
function canInstallLinuxUpdates(): boolean {
  if (!app.isPackaged || process.platform !== 'linux') {
    return false;
  }

  try {
    const stats = statSync(LINUX_HELPER_PATH);

    if (stats.uid !== 0 || (stats.mode & 0o022) !== 0) {
      return false;
    }
  } catch {
    return false;
  }

  return existsSync(PKEXEC_PATH);
}

function setState(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
}

function feedUrl(): string {
  const { owner, name } = GITHUB_REPOSITORY;

  return `${UPDATE_FEED_ORIGIN}/${owner}/${name}/win32-${process.arch}/${app.getVersion()}`;
}

function clearTimers(): void {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }

  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }

  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

function clearCheckTimer(): void {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }
}

function scheduleChecks(): void {
  // Squirrel's first launch still holds a lock on the versioned app folder, so
  // an update run that starts immediately can fail. Wait longer on that run.
  const firstRun = process.argv.includes('--squirrel-firstrun');
  const delay = firstRun ? FIRST_RUN_CHECK_DELAY_MS : INITIAL_CHECK_DELAY_MS;

  initialTimer = setTimeout(() => {
    initialTimer = null;
    checkForUpdates();
    intervalTimer = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
    intervalTimer.unref();
  }, delay);
  initialTimer.unref();
}

/** Extract `major.minor.patch` from an app version or a release tag. */
function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(value.trim());

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Returns null when either version cannot be parsed. */
function isNewerVersion(candidate: string, current: string): boolean | null {
  const next = parseVersion(candidate);
  const installed = parseVersion(current);

  if (!next || !installed) {
    return null;
  }

  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== installed[index]) {
      return next[index] > installed[index];
    }
  }

  return false;
}

interface LatestRelease {
  version: string;
  pageUrl: string;
}

/**
 * Read the version and page URL from the final URL of a `releases/latest`
 * redirect. Following the redirect instead of the GitHub API avoids the
 * unauthenticated API rate limit, which a fleet behind one address can exhaust.
 * The URL is rebuilt from the validated parts so {@link openReleasePage} only
 * ever opens a Kite release on github.com.
 */
function parseReleaseUrl(value: string): LatestRelease | null {
  let page: URL;

  try {
    page = new URL(value);
  } catch {
    return null;
  }

  if (page.protocol !== 'https:' || page.hostname !== 'github.com') {
    return null;
  }

  const prefix = `/${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.name}/releases/tag/v`;

  if (!page.pathname.startsWith(prefix)) {
    return null;
  }

  const version = page.pathname.slice(prefix.length);

  if (!parseVersion(version)) {
    return null;
  }

  return {
    version,
    pageUrl: `https://github.com${page.pathname}`,
  };
}

function linuxCheckError(cause: unknown): string {
  if (cause instanceof Error) {
    if (cause.name === 'TimeoutError' || /timed? out/iu.test(cause.message)) {
      return 'La comprobación de actualizaciones tardó demasiado. Inténtalo de nuevo.';
    }

    if (
      /fetch failed|network|ENOTFOUND|ECONN|EAI_AGAIN/iu.test(cause.message)
    ) {
      return 'No se pudo conectar con GitHub para comprobar si hay actualizaciones.';
    }

    if (cause.message) {
      return cause.message;
    }
  }

  return 'No se pudo comprobar si hay actualizaciones.';
}

/**
 * Linux check path: follow the `releases/latest` redirect, compare the version
 * with the installed one, and expose the release page. Kite never installs
 * anything until a parent approves the update.
 */
async function checkLinuxRelease(): Promise<void> {
  try {
    const response = await net.fetch(LATEST_RELEASE_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(RELEASE_REQUEST_TIMEOUT_MS),
    });

    if (response.status === 404) {
      throw new Error('No se encontró ninguna versión publicada de Kite.');
    }

    if (!response.ok) {
      throw new Error(
        `El servidor de actualizaciones respondió con HTTP ${response.status}.`,
      );
    }

    const release = parseReleaseUrl(response.url);

    if (!release) {
      throw new Error(
        'La respuesta del servidor de actualizaciones no es válida.',
      );
    }

    const newer = isNewerVersion(release.version, app.getVersion());

    if (newer === null) {
      throw new Error(
        'No se pudo comparar la versión instalada con la última publicada.',
      );
    }

    setState({
      phase: newer ? 'available' : 'up-to-date',
      availableVersion: newer ? release.version : null,
      releaseUrl: newer && !canInstallLinuxUpdates() ? release.pageUrl : null,
      checkedAt: Date.now(),
      error: null,
    });
  } catch (cause) {
    setState({
      phase: 'error',
      releaseUrl: null,
      checkedAt: Date.now(),
      error: linuxCheckError(cause),
    });
  } finally {
    checkInFlight = false;
  }
}

export function getUpdateState(): UpdateState {
  return { ...state };
}

/**
 * Ask the update server whether a newer release exists. On Windows Electron
 * downloads the release in the background; it is only applied by
 * {@link installUpdate}. On Linux this only records that a newer release is
 * available and where to download it.
 */
export function checkForUpdates(): UpdateState {
  if (!canCheckForUpdates()) {
    return getUpdateState();
  }

  // A second check would download the same release again. Do not interrupt an
  // in-flight check, an install, or a download that is already ready to install.
  if (
    checkInFlight ||
    state.phase === 'downloaded' ||
    state.phase === 'installing'
  ) {
    return getUpdateState();
  }

  if (process.platform === 'linux') {
    checkInFlight = true;
    setState({ phase: 'checking', error: null });
    void checkLinuxRelease();

    return getUpdateState();
  }

  checkInFlight = true;
  setState({ phase: 'checking', error: null });
  clearCheckTimer();
  checkTimer = setTimeout(() => {
    checkTimer = null;
    checkInFlight = false;
    setState({
      phase: 'error',
      checkedAt: Date.now(),
      error:
        'La comprobación de actualizaciones tardó demasiado. Inténtalo de nuevo.',
    });
  }, CHECK_TIMEOUT_MS);
  checkTimer.unref();

  try {
    autoUpdater.checkForUpdates();
  } catch (cause) {
    checkInFlight = false;
    clearCheckTimer();
    setState({
      phase: 'error',
      checkedAt: Date.now(),
      error:
        cause instanceof Error
          ? cause.message
          : 'No se pudo comprobar si hay actualizaciones.',
    });
  }

  return getUpdateState();
}

/**
 * Turn an execFile failure from pkexec or the helper into a parent-readable
 * message. The helper prefixes its own errors with `kite-update:`; the UI does
 * not need that prefix.
 */
function linuxInstallError(cause: unknown): string {
  const failure = cause as {
    code?: unknown;
    killed?: unknown;
    message?: unknown;
    stderr?: unknown;
  };

  if (failure?.killed) {
    return 'La instalación tardó demasiado y se canceló. Inténtalo de nuevo.';
  }

  if (failure?.code === 126) {
    return 'No se autorizó la instalación de la actualización.';
  }

  if (failure?.code === 127) {
    return 'El sistema no autorizó al asistente de actualización.';
  }

  if (typeof failure?.stderr === 'string') {
    const detail = failure.stderr
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);

    if (detail) {
      return `No se pudo instalar la actualización: ${detail.replace(/^kite-update:\s*/u, '')}`;
    }
  }

  if (typeof failure?.message === 'string' && failure.message) {
    return `No se pudo instalar la actualización: ${failure.message}`;
  }

  return 'No se pudo instalar la actualización.';
}

/**
 * Linux path: pkexec runs the root-owned helper, which downloads, verifies, and
 * installs the package. The parent session already approved the action before
 * the IPC handler calls this. Kite relaunches itself into the new version.
 */
async function installLinuxUpdate(): Promise<void> {
  if (!canInstallLinuxUpdates()) {
    throw new Error(
      'Esta instalación de Kite no incluye el asistente de actualizaciones. Descarga el paquete desde la página de la versión.',
    );
  }

  if (state.phase !== 'available') {
    throw new Error(
      'Todavía no hay una actualización disponible para instalar.',
    );
  }

  setState({ phase: 'installing', error: null });

  let installed = false;

  try {
    const result = await execFileAsync(PKEXEC_PATH, [LINUX_HELPER_PATH], {
      encoding: 'utf8',
      timeout: INSTALL_TIMEOUT_MS,
      maxBuffer: MAX_INSTALL_OUTPUT,
      windowsHide: true,
    });

    installed = /^KITE_UPDATE_OK\b/mu.test(result.stdout);

    // The helper compares versions itself. If a release was withdrawn between
    // the check and the install, it reports no installation and nothing needs
    // to restart.
    if (!installed && !/^KITE_UPDATE_CURRENT\b/mu.test(result.stdout)) {
      throw new Error('El asistente no confirmó la instalación.');
    }
  } catch (cause) {
    const message = linuxInstallError(cause);

    setState({
      phase: 'error',
      checkedAt: Date.now(),
      error: message,
    });
    throw new Error(message);
  }

  if (!installed) {
    setState({
      phase: 'up-to-date',
      availableVersion: null,
      releaseUrl: null,
      checkedAt: Date.now(),
      error: null,
    });
    return;
  }

  // The package replaced the running binary; start the installed version.
  // `app.exit` skips the kiosk close handler. Relaunch is scheduled by Electron
  // and runs after this process exits.
  authorizeShutdown?.();
  app.relaunch();
  app.exit(0);
}

/**
 * Restart Kite and apply the update. On Windows Electron has already
 * downloaded it and `quitAndInstall()` applies it. On Linux the helper installs
 * the package and Kite relaunches itself. The main process must already
 * consider this a parent-approved shutdown, otherwise the kiosk window's close
 * handler prevents the restart.
 */
export async function installUpdate(): Promise<void> {
  if (process.platform === 'linux') {
    await installLinuxUpdate();
    return;
  }

  if (!canInstallUpdates()) {
    throw new Error(
      'Las actualizaciones automáticas solo están disponibles en Windows.',
    );
  }

  if (state.phase !== 'downloaded') {
    throw new Error('Todavía no hay una actualización lista para instalar.');
  }

  authorizeShutdown?.();
  autoUpdater.quitAndInstall();
}

/**
 * Open the release page recorded by the latest Linux check. The URL is
 * reconstructed from the validated redirect in {@link parseReleaseUrl}.
 */
export async function openReleasePage(): Promise<void> {
  if (!state.releaseUrl) {
    throw new Error('Todavía no hay una versión nueva para abrir.');
  }

  await shell.openExternal(state.releaseUrl);
}

interface UpdaterOptions {
  /** Marks the shutdown as parent-approved before Squirrel closes the windows. */
  onBeforeInstall: () => void;
}

export function initUpdater(options: UpdaterOptions): void {
  if (initialized) {
    return;
  }

  initialized = true;
  authorizeShutdown = options.onBeforeInstall;

  if (process.platform === 'linux') {
    if (app.isPackaged) {
      setState({ phase: 'idle', canInstall: canInstallLinuxUpdates() });
      scheduleChecks();
    } else {
      setState({ phase: 'disabled', canInstall: false });
    }

    return;
  }

  if (!canInstallUpdates()) {
    setState({ phase: 'disabled', canInstall: false });
    return;
  }

  try {
    autoUpdater.setFeedURL({ url: feedUrl() });
  } catch (cause) {
    setState({
      phase: 'error',
      checkedAt: Date.now(),
      error:
        cause instanceof Error
          ? cause.message
          : 'No se pudo configurar el servicio de actualizaciones.',
    });
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    setState({ phase: 'checking', error: null });
  });

  autoUpdater.on('update-available', () => {
    clearCheckTimer();
    setState({ phase: 'downloading', error: null });
  });

  autoUpdater.on('update-not-available', () => {
    checkInFlight = false;
    clearCheckTimer();
    setState({
      phase: 'up-to-date',
      availableVersion: null,
      checkedAt: Date.now(),
      error: null,
    });
  });

  autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName) => {
    checkInFlight = false;
    clearCheckTimer();
    setState({
      phase: 'downloaded',
      availableVersion: releaseName || null,
      checkedAt: Date.now(),
      error: null,
    });
  });

  autoUpdater.on('error', (error) => {
    checkInFlight = false;
    clearCheckTimer();
    setState({
      phase: 'error',
      checkedAt: Date.now(),
      error: error.message || 'No se pudo actualizar Kite.',
    });
  });

  autoUpdater.on('before-quit-for-update', () => {
    authorizeShutdown?.();
  });

  setState({ phase: 'idle', canInstall: true });
  scheduleChecks();
}

export function stopUpdater(): void {
  clearTimers();
}

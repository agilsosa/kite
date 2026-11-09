import { app, autoUpdater, net, shell } from 'electron';
import type { UpdateState } from '../shared/types';
import { GITHUB_REPOSITORY, UPDATE_FEED_ORIGIN } from '../shared/release';

const INITIAL_CHECK_DELAY_MS = 60 * 1000;
const FIRST_RUN_CHECK_DELAY_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;
const RELEASE_REQUEST_TIMEOUT_MS = 30 * 1000;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.name}/releases/latest`;
const RELEASE_PAGE_PREFIX = `/${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.name}/releases/`;

let state: UpdateState = {
  phase: 'disabled',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseUrl: null,
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
 * Windows checks through Electron's updater. Linux has no updater backend, so
 * it asks the GitHub Releases API whether a newer version exists.
 */
function canCheckForUpdates(): boolean {
  return (
    app.isPackaged &&
    (process.platform === 'win32' || process.platform === 'linux')
  );
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
 * Read the fields Kite needs from a GitHub `releases/latest` response. The
 * release page URL is validated so {@link openReleasePage} only ever opens a
 * Kite release on github.com.
 */
function parseLatestRelease(value: unknown): LatestRelease | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.draft === true || record.prerelease === true) {
    return null;
  }

  if (
    typeof record.tag_name !== 'string' ||
    typeof record.html_url !== 'string'
  ) {
    return null;
  }

  const version = record.tag_name.trim().replace(/^v/u, '');

  if (!parseVersion(version)) {
    return null;
  }

  let page: URL;

  try {
    page = new URL(record.html_url);
  } catch {
    return null;
  }

  if (
    page.protocol !== 'https:' ||
    page.hostname !== 'github.com' ||
    !page.pathname.startsWith(RELEASE_PAGE_PREFIX)
  ) {
    return null;
  }

  return { version, pageUrl: page.toString() };
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
 * Linux check-only path: ask GitHub for the latest published release, compare
 * it with the installed version, and expose the release page. Kite never
 * downloads or installs Linux packages by itself.
 */
async function checkLinuxRelease(): Promise<void> {
  try {
    const response = await net.fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `kite/${app.getVersion()}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(RELEASE_REQUEST_TIMEOUT_MS),
    });

    if (response.status === 403 || response.status === 429) {
      throw new Error(
        'GitHub limitó temporalmente las comprobaciones. Inténtalo más tarde.',
      );
    }

    if (response.status === 404) {
      throw new Error('No se encontró ninguna versión publicada de Kite.');
    }

    if (!response.ok) {
      throw new Error(
        `El servidor de actualizaciones respondió con HTTP ${response.status}.`,
      );
    }

    const release = parseLatestRelease(await response.json());

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
      releaseUrl: newer ? release.pageUrl : null,
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
  // in-flight check or a download that is already ready to install.
  if (checkInFlight || state.phase === 'downloaded') {
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
 * Restart Kite and apply the downloaded update. The main process must already
 * consider this a parent-approved shutdown, otherwise the kiosk window's close
 * handler prevents `quitAndInstall()` from finishing.
 */
export function installUpdate(): void {
  if (process.platform === 'linux') {
    throw new Error(
      'En Linux, descarga el paquete desde la página de la versión e instálalo manualmente.',
    );
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
 * Open the release page recorded by the latest Linux check. The URL comes from
 * the GitHub API and is validated in {@link parseLatestRelease}.
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
      setState({ phase: 'idle' });
      scheduleChecks();
    } else {
      setState({ phase: 'disabled' });
    }

    return;
  }

  if (!canInstallUpdates()) {
    setState({ phase: 'disabled' });
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

  setState({ phase: 'idle' });
  scheduleChecks();
}

export function stopUpdater(): void {
  clearTimers();
}

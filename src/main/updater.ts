import { app, autoUpdater } from 'electron';
import type { UpdateState } from '../shared/types';
import { GITHUB_REPOSITORY, UPDATE_FEED_ORIGIN } from '../shared/release';

const INITIAL_CHECK_DELAY_MS = 60 * 1000;
const FIRST_RUN_CHECK_DELAY_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_TIMEOUT_MS = 5 * 60 * 1000;

let state: UpdateState = {
  phase: 'disabled',
  currentVersion: app.getVersion(),
  availableVersion: null,
  checkedAt: null,
  error: null,
};
let initialized = false;
let checkInFlight = false;
let checkTimer: ReturnType<typeof setTimeout> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let authorizeShutdown: (() => void) | null = null;

function isSupported(): boolean {
  return app.isPackaged && process.platform === 'win32';
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

export function getUpdateState(): UpdateState {
  return { ...state };
}

/**
 * Ask the update server whether a newer release exists. Electron downloads the
 * release in the background; it is only applied by {@link installUpdate}.
 */
export function checkForUpdates(): UpdateState {
  if (!isSupported()) {
    return getUpdateState();
  }

  // A second check would download the same release again. Do not interrupt an
  // in-flight check or a download that is already ready to install.
  if (checkInFlight || state.phase === 'downloaded') {
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
  if (!isSupported()) {
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

  if (!isSupported()) {
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

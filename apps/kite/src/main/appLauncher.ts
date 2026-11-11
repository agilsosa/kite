import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AllowedApp } from '../shared/types';
import { getConfig } from './config';
import {
  focusLinuxWindow,
  revealLinuxWindow,
  snapshotLinuxWindows,
  type LinuxWindowTarget,
} from './linuxWindowActivation';
import {
  focusSwayWindow,
  getFocusedSwayWindowIds,
  revealSwayWindow,
  snapshotSwayWindows,
} from './sway';
import { focusWindowsApp } from './windowActivation';

const runningApps = new Map<string, Set<ChildProcess>>();
/** Window ids reported by Sway, so an app can be raised instead of relaunched. */
const swayWindowIds = new Map<string, number[]>();
/** Wayland app id or X11 window id recorded for a launched app. */
const linuxWindows = new Map<string, LinuxWindowTarget>();
/**
 * Pending window detection. A second click while the first launch is still
 * opening its window waits for it instead of starting another copy.
 */
const linuxReveals = new Map<string, Promise<LinuxWindowTarget | null>>();

function trackRunningApp(appEntry: AllowedApp, child: ChildProcess) {
  let processes = runningApps.get(appEntry.id);

  if (!processes) {
    processes = new Set();
    runningApps.set(appEntry.id, processes);
  }

  processes.add(child);

  const remove = () => {
    const current = runningApps.get(appEntry.id);

    if (!current) {
      return;
    }

    current.delete(child);

    if (current.size === 0) {
      runningApps.delete(appEntry.id);
      swayWindowIds.delete(appEntry.id);
      linuxWindows.delete(appEntry.id);
    }
  };

  child.once('exit', remove);
  child.once('error', remove);
}

export interface RunningApp {
  appId: string;
  name: string;
  icon: string;
}

/** Native apps launched by Kite whose processes are still alive. */
export function getRunningApps(): RunningApp[] {
  const allowed = getConfig().allowedApps;

  return [...runningApps.keys()].flatMap((appId) => {
    const entry = allowed.find((candidate) => candidate.id === appId);

    return entry
      ? [{ appId: entry.id, name: entry.name, icon: entry.icon }]
      : [];
  });
}

function spawnApp(appEntry: AllowedApp): Promise<ChildProcess> {
  const isMacBundle =
    process.platform === 'darwin' && appEntry.path.endsWith('.app');
  const command = isMacBundle ? 'open' : appEntry.path;
  const args = isMacBundle
    ? [
        '-W',
        appEntry.path,
        ...(appEntry.args && appEntry.args.length > 0
          ? ['--args', ...appEntry.args]
          : []),
      ]
    : (appEntry.args ?? []);

  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });

    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(child);
    });
  });
}

/** Apps whose window currently has focus. */
export async function getActiveAppIds(): Promise<Set<string>> {
  const active = new Set<string>();

  if (swayWindowIds.size === 0) {
    return active;
  }

  const focusedWindows = await getFocusedSwayWindowIds();

  if (process.env['KITE_DEBUG'] === '1') {
    console.log(
      'Kite focus check',
      [...focusedWindows],
      JSON.stringify([...swayWindowIds]),
    );
  }

  for (const [appId, windowIds] of swayWindowIds) {
    if (windowIds.some((id) => focusedWindows.has(id))) {
      active.add(appId);
    }
  }

  return active;
}

export async function launchAllowedApp(appId: string): Promise<void> {
  if (typeof appId !== 'string' || appId.length === 0 || appId.length > 64) {
    throw new Error('Identificador de aplicación no válido');
  }

  const appEntry = getConfig().allowedApps.find((entry) => entry.id === appId);

  if (!appEntry) {
    throw new Error('Esa aplicación no está en la lista de permitidas');
  }

  if (!existsSync(appEntry.path)) {
    throw new Error(`No se encontró ${appEntry.name} en la ruta guardada`);
  }

  if (runningApps.has(appId)) {
    for (const windowId of swayWindowIds.get(appId) ?? []) {
      if (await focusSwayWindow(windowId)) {
        return;
      }
    }

    if (process.platform === 'win32') {
      /*
       * Windows has no Electron API for focusing another process's window.
       * Raise the existing window instead of launching a second copy.
       */
      await focusWindowsApp(appEntry.path);
      return;
    }

    if (process.platform === 'linux') {
      const recorded = linuxWindows.get(appId);

      if (recorded && (await focusLinuxWindow(recorded, appEntry.path))) {
        return;
      }

      const pending = linuxReveals.get(appId);

      if (pending) {
        const revealed = await pending;

        if (revealed && (await focusLinuxWindow(revealed, appEntry.path))) {
          return;
        }
      }

      // The app may have recreated its window after the launch snapshot.
      if (await focusLinuxWindow(null, appEntry.path)) {
        return;
      }
    }
  }

  const knownWindows = await snapshotSwayWindows();
  const knownLinuxWindows = knownWindows
    ? null
    : process.platform === 'linux'
      ? await snapshotLinuxWindows()
      : null;
  const child = await spawnApp(appEntry);

  trackRunningApp(appEntry, child);

  if (knownWindows) {
    void revealSwayWindow(knownWindows).then((windowId) => {
      if (windowId !== null) {
        const ids = swayWindowIds.get(appId) ?? [];
        swayWindowIds.set(appId, [...ids, windowId]);
      }
    });
    return;
  }

  if (knownLinuxWindows) {
    let reveal: Promise<LinuxWindowTarget | null>;
    reveal = revealLinuxWindow(knownLinuxWindows, appEntry.path)
      .then((window) => {
        if (
          window &&
          runningApps.has(appId) &&
          linuxReveals.get(appId) === reveal
        ) {
          linuxWindows.set(appId, window);
        }

        return window;
      })
      .finally(() => {
        if (linuxReveals.get(appId) === reveal) {
          linuxReveals.delete(appId);
        }
      });

    linuxReveals.set(appId, reveal);
  }
}

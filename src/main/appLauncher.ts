import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { AllowedApp } from '../shared/types';
import { getConfig } from './config';
import {
  focusSwayWindow,
  getFocusedSwayWindowIds,
  revealSwayWindow,
  snapshotSwayWindows,
} from './sway';

const runningApps = new Map<string, Set<ChildProcess>>();
/** Window ids reported by Sway, so an app can be raised instead of relaunched. */
const swayWindowIds = new Map<string, number[]>();

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
  }

  const knownWindows = await snapshotSwayWindows();
  const child = await spawnApp(appEntry);

  trackRunningApp(appEntry, child);

  void revealSwayWindow(knownWindows).then((windowId) => {
    if (windowId !== null) {
      const ids = swayWindowIds.get(appId) ?? [];
      swayWindowIds.set(appId, [...ids, windowId]);
    }
  });
}

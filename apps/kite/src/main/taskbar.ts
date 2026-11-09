import type { TaskbarItem } from '../shared/types';
import {
  getActiveAppIds,
  getRunningApps,
  launchAllowedApp,
} from './appLauncher';
import { focusChildWindow, listChildWindows } from './windowRegistry';

export async function getTaskbarItems(): Promise<TaskbarItem[]> {
  const activeApps = await getActiveAppIds();

  const apps = getRunningApps().map((app) => ({
    id: `app:${app.appId}`,
    kind: 'app' as const,
    title: app.name,
    icon: app.icon,
    active: activeApps.has(app.appId),
  }));

  const websites = listChildWindows().map((entry) => ({
    id: `web:${entry.id}`,
    kind: entry.kind === 'files' ? ('files' as const) : ('website' as const),
    title: entry.kind === 'files' ? 'Archivos' : entry.title,
    icon: entry.kind === 'files' ? 'folder' : 'globe',
    active: entry.active,
  }));

  return [...apps, ...websites];
}

export async function activateTaskbarItem(rawId: unknown) {
  if (typeof rawId !== 'string' || rawId.length === 0 || rawId.length > 80) {
    throw new Error('Elemento de la barra de tareas no válido');
  }

  if (rawId.startsWith('web:')) {
    focusChildWindow(Number(rawId.slice(4)));
    return;
  }

  if (rawId.startsWith('app:')) {
    await launchAllowedApp(rawId.slice(4));
    return;
  }

  throw new Error('Elemento de la barra de tareas no válido');
}

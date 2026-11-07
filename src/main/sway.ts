import { app, screen } from 'electron';
import { execFile } from 'node:child_process';
import path from 'node:path';

/**
 * Sway ignores client-requested window positions and centres new windows on
 * the output, which can leave Kite shifted or overlapping the status bar.
 * Wayland also reports the whole output as Electron's work area, so Kite
 * cannot see the bar's reserved space.
 *
 * When Kite runs under Sway we ask the compositor for the usable workspace
 * and move Kite's windows into it. On other compositors the Electron work
 * area is used unchanged.
 */
const SWAY_ENABLED =
  process.platform === 'linux' && (process.env['SWAYSOCK'] ?? '') !== '';

/**
 * The built-in Files window is a normal app-sized window, not a full-screen
 * Kite surface. Sway cannot map Electron window ids to containers directly,
 * so the window title is used as the selector for both exclusion from the
 * full-area layout and the app-window placement below.
 */
export const FILES_WINDOW_TITLE = 'Archivos';

/**
 * The on-screen keyboard is a transient window of the active child window, so
 * Sway keeps it above the page. It is positioned as a bottom strip instead of
 * filling the Kite layout area.
 */
export const KEYBOARD_WINDOW_TITLE = 'Teclado';

export interface LayoutArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SwayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SwayNode {
  id?: number;
  type?: string;
  name?: string;
  app_id?: string | null;
  class?: string | null;
  fullscreen_mode?: number;
  rect?: SwayRect;
  visible?: boolean;
  focused?: boolean;
  nodes?: SwayNode[];
  floating_nodes?: SwayNode[];
}

/** Tiled and floating children, which Sway keeps in separate arrays. */
function childrenOf(node: SwayNode): SwayNode[] {
  return [...(node.nodes ?? []), ...(node.floating_nodes ?? [])];
}

let swayArea: LayoutArea | null = null;
let retryTimer: NodeJS.Timeout | null = null;

function runSway(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'swaymsg',
      args,
      { maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

/** The area Kite should fill, including any reserved panels. */
export function getLayoutArea(): LayoutArea {
  return swayArea ?? screen.getPrimaryDisplay().workArea;
}

function appSelector(): string {
  return path
    .basename(app.getPath('exe'))
    .replace(/\.exe$/i, '')
    .toLowerCase();
}

/**
 * Float Kite's own windows into the layout area. `move absolute position`
 * only works on floating containers, and with `resizable: true` Sway tiles
 * new windows by default, so floating is requested explicitly. Fullscreen
 * containers are skipped: their geometry belongs to the compositor until they
 * leave fullscreen, and moving one can drag the workspace.
 */
async function moveKiteWindows() {
  if (!SWAY_ENABLED || !swayArea) {
    return;
  }

  const tree = await readSwayTree();
  const ids = new Set<number>();

  if (tree) {
    collectKiteWindowIds(tree, appSelector(), ids);
  }

  for (const id of ids) {
    const commands = [
      `[con_id=${id}] floating enable`,
      `[con_id=${id}] resize set ${swayArea.width} ${swayArea.height}`,
      `[con_id=${id}] move absolute position ${swayArea.x} ${swayArea.y}`,
    ];

    for (const command of commands) {
      try {
        await runSway([command]);
      } catch {
        // The window may have closed again; nothing to do.
      }
    }
  }
}

/** Raise and focus one of Kite's own windows by its current title. */
export async function focusKiteWindow(title: string): Promise<void> {
  if (!SWAY_ENABLED) {
    return;
  }

  const tree = await readSwayTree();
  const id = tree ? findWindowIdByTitle(tree, title) : null;

  if (id === null) {
    return;
  }

  try {
    await runSway([`[con_id=${id}] focus`]);
  } catch {
    // The window may have closed in the meantime.
  }
}

/**
 * Ask Sway for the usable workspace and re-position Kite's windows. Windows
 * map a moment after `show()`, so the position is pushed again shortly after.
 */
export function positionKiteWindows() {
  if (!SWAY_ENABLED) {
    return;
  }

  void moveKiteWindows();

  if (retryTimer !== null) {
    clearTimeout(retryTimer);
  }

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void moveKiteWindows();
  }, 400);
}

export async function refreshSwayLayout(): Promise<void> {
  if (!SWAY_ENABLED) {
    return;
  }

  try {
    const tree = JSON.parse(await runSway(['-t', 'get_tree'])) as SwayNode;
    const bounds = screen.getPrimaryDisplay().bounds;
    const outputs = (tree.nodes ?? []).filter(
      (node) => node.type === 'output' && node.name !== '__i3' && node.rect,
    );
    const output =
      outputs.find(
        (node) => node.rect?.x === bounds.x && node.rect?.y === bounds.y,
      ) ?? outputs[0];
    const workspaces = output?.nodes ?? [];
    const workspace =
      workspaces.find((node) => node.type === 'workspace' && node.visible) ??
      workspaces.find((node) => node.type === 'workspace');

    if (!output?.rect || !workspace?.rect) {
      swayArea = null;
    } else {
      swayArea = {
        x: 0,
        y: workspace.rect.y,
        width: output.rect.width,
        height: output.rect.height - workspace.rect.y,
      };
    }
  } catch {
    swayArea = null;
  }

  if (process.env['KITE_DEBUG'] === '1') {
    console.log(
      'Kite Sway layout:',
      swayArea ? JSON.stringify(swayArea) : 'unavailable',
    );
  }

  positionKiteWindows();
}

export function stopSwayLayout() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function collectWindowIds(node: SwayNode, ids: Set<number>) {
  if (
    (node.type === 'con' || node.type === 'floating_con') &&
    typeof node.id === 'number'
  ) {
    ids.add(node.id);
  }

  for (const child of childrenOf(node)) {
    collectWindowIds(child, ids);
  }
}

/**
 * Collect Kite's own window containers. Fullscreen containers are skipped:
 * their size and position belong to the compositor until they leave
 * fullscreen. `app_id` matches native Wayland windows, `class` XWayland ones.
 */
function collectKiteWindowIds(node: SwayNode, appId: string, ids: Set<number>) {
  const ownsWindow = node.app_id === appId || node.class === appId;

  if (
    ownsWindow &&
    node.name !== FILES_WINDOW_TITLE &&
    node.name !== KEYBOARD_WINDOW_TITLE &&
    (node.type === 'con' || node.type === 'floating_con') &&
    node.fullscreen_mode !== 1 &&
    typeof node.id === 'number'
  ) {
    ids.add(node.id);
  }

  for (const child of childrenOf(node)) {
    collectKiteWindowIds(child, appId, ids);
  }
}

function findNewWindow(node: SwayNode, known: Set<number>): SwayNode | null {
  if (
    typeof node.id === 'number' &&
    node.app_id !== undefined &&
    node.app_id !== appSelector() &&
    (node.type === 'con' || node.type === 'floating_con') &&
    !known.has(node.id)
  ) {
    return node;
  }

  for (const child of childrenOf(node)) {
    const found = findNewWindow(child, known);

    if (found) {
      return found;
    }
  }

  return null;
}

async function applyFloatingLayout(id: number) {
  const area = getLayoutArea();
  const width = Math.round(area.width * 0.86);
  const height = Math.round(area.height * 0.82);
  const x = area.x + Math.round((area.width - width) / 2);
  const y = area.y + Math.round((area.height - height) / 2);
  const selector = `con_id=${id}`;

  for (const command of [
    `[${selector}] floating enable`,
    `[${selector}] resize set ${width} ${height}`,
    `[${selector}] move absolute position ${x} ${y}`,
    `[${selector}] focus`,
  ]) {
    try {
      await runSway([command]);
    } catch {
      // The window may have closed again; nothing to do.
    }
  }
}

async function readSwayTree(): Promise<SwayNode | null> {
  if (!SWAY_ENABLED) {
    return null;
  }

  try {
    return JSON.parse(await runSway(['-t', 'get_tree'])) as SwayNode;
  } catch {
    return null;
  }
}

/**
 * Place the app-sized Files window above Kite without covering the workspace
 * panel. This mirrors the size native apps receive when Kite floats them.
 */
export async function positionFilesWindow(): Promise<void> {
  if (!SWAY_ENABLED) {
    return;
  }

  // A transient window can be mapped on whichever workspace is focused. Keep
  // the Files app with the main Kite window instead of on a background
  // workspace the child cannot see.
  const tree = await readSwayTree();

  if (tree) {
    const mainWorkspace = findWorkspaceForWindow(tree, 'Kite');
    const filesWorkspace = findWorkspaceForWindow(tree, FILES_WINDOW_TITLE);

    if (
      mainWorkspace !== null &&
      filesWorkspace !== null &&
      mainWorkspace !== filesWorkspace
    ) {
      try {
        await runSway([
          `[title="${FILES_WINDOW_TITLE}"] move container to workspace ${quoteWorkspace(mainWorkspace)}`,
        ]);
      } catch {
        // Best effort; the window stays on its current workspace.
      }
    }
  }

  const area = getLayoutArea();
  const width = Math.min(
    area.width,
    Math.max(720, Math.round(area.width * 0.86)),
  );
  const height = Math.min(
    area.height,
    Math.max(520, Math.round(area.height * 0.82)),
  );
  const x = area.x + Math.round((area.width - width) / 2);
  const y = area.y + Math.round((area.height - height) / 2);
  const selector = `title="${FILES_WINDOW_TITLE}"`;

  for (const command of [
    `[${selector}] floating enable`,
    `[${selector}] resize set ${width} ${height}`,
    `[${selector}] move absolute position ${x} ${y}`,
    `[${selector}] focus`,
  ]) {
    try {
      await runSway([command]);
    } catch {
      // The window may not be mapped yet; the next call retries.
    }
  }
}

/**
 * Place the on-screen keyboard as a bottom strip. Sway ignores the bounds a
 * Wayland client requests, so the position is pushed through the compositor.
 */
export async function positionKeyboardWindow(
  width: number,
  height: number,
): Promise<void> {
  if (!SWAY_ENABLED) {
    return;
  }

  const area = getLayoutArea();
  const keyboardWidth = Math.min(area.width, width);
  const keyboardHeight = Math.min(area.height, height);
  const x = area.x + Math.round((area.width - keyboardWidth) / 2);
  const y = area.y + area.height - keyboardHeight;
  const selector = `title="${KEYBOARD_WINDOW_TITLE}"`;

  for (const command of [
    `[${selector}] floating enable`,
    `[${selector}] resize set ${keyboardWidth} ${keyboardHeight}`,
    `[${selector}] move absolute position ${x} ${y}`,
  ]) {
    try {
      await runSway([command]);
    } catch {
      // The window may not be mapped yet; the next call retries.
    }
  }
}

/** Workspace name that contains a window with this title, if any. */
function findWorkspaceForWindow(node: SwayNode, title: string): string | null {
  if (
    node.type === 'workspace' &&
    node.name !== undefined &&
    containsWindow(node, title)
  ) {
    return node.name;
  }

  for (const child of childrenOf(node)) {
    const found = findWorkspaceForWindow(child, title);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function containsWindow(node: SwayNode, title: string): boolean {
  if (
    node.name === title &&
    (node.type === 'con' || node.type === 'floating_con')
  ) {
    return true;
  }

  return childrenOf(node).some((child) => containsWindow(child, title));
}

function findWindowIdByTitle(node: SwayNode, title: string): number | null {
  const appId = appSelector();
  const ownsWindow = node.app_id === appId || node.class === appId;

  if (
    ownsWindow &&
    node.name === title &&
    (node.type === 'con' || node.type === 'floating_con') &&
    typeof node.id === 'number'
  ) {
    return node.id;
  }

  for (const child of childrenOf(node)) {
    const found = findWindowIdByTitle(child, title);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

function quoteWorkspace(name: string): string {
  return `"${name.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
}

/** Window ids that existed before a native app was launched. */
export async function snapshotSwayWindows(): Promise<Set<number> | null> {
  const tree = await readSwayTree();

  if (!tree) {
    return null;
  }

  const ids = new Set<number>();
  collectWindowIds(tree, ids);
  return ids;
}

/**
 * Native apps tile by default in Sway, which puts them underneath Kite's
 * full-screen window. Once the launched app has opened a window, float it and
 * size it to the middle of the screen so it stays usable above Kite.
 */
export async function revealSwayWindow(
  known: Set<number> | null,
): Promise<number | null> {
  if (!SWAY_ENABLED || !known) {
    return null;
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tree = await readSwayTree();
    const found = tree ? findNewWindow(tree, known) : null;

    if (found && typeof found.id === 'number') {
      const id = found.id;

      await applyFloatingLayout(id);
      // Freshly mapped apps often re-apply their own size once ready, so the
      // layout is nudged again after the window has settled.
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await applyFloatingLayout(id);
      return id;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return null;
}

/** Window ids that currently have focus, including their floating container. */
export async function getFocusedSwayWindowIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  const tree = await readSwayTree();

  if (!tree) {
    return ids;
  }

  const visit = (node: SwayNode, parentId: number | null) => {
    if (node.focused) {
      if (typeof node.id === 'number') {
        ids.add(node.id);
      }

      if (parentId !== null) {
        ids.add(parentId);
      }

      for (const child of childrenOf(node)) {
        if (typeof child.id === 'number') {
          ids.add(child.id);
        }
      }
    }

    for (const child of childrenOf(node)) {
      visit(child, typeof node.id === 'number' ? node.id : null);
    }
  };

  visit(tree, null);
  return ids;
}

/** Bring back a native window that was already launched by Kite. */
export async function focusSwayWindow(id: number): Promise<boolean> {
  if (!SWAY_ENABLED) {
    return false;
  }

  try {
    await runSway([`[con_id=${id}] focus`]);
    return true;
  } catch {
    return false;
  }
}

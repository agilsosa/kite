import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Bring an already running Linux app back to the front.
 *
 * Electron has no API for focusing another process's window. On Wayland the
 * only portable option is the compositor's wlroots foreign-toplevel protocol,
 * which `wlrctl` speaks (Sway, labwc, Wayfire, River, and similar). On X11 the
 * EWMH client list gives window IDs and `wmctrl` activates them.
 *
 * Windows are recorded when Kite launches an app: snapshot the visible windows
 * first, then wait for the new one to appear. The recorded Wayland `app_id` or
 * X11 window ID is reused on later taskbar clicks.
 */

const COMMAND_TIMEOUT_MS = 5 * 1000;
const REVEAL_TIMEOUT_MS = 20 * 1000;
const REVEAL_INTERVAL_MS = 250;

const WAYLAND_ENABLED = (process.env['WAYLAND_DISPLAY'] ?? '') !== '';
const X11_ENABLED = (process.env['DISPLAY'] ?? '') !== '';

interface WaylandWindow {
  appId: string;
  title: string;
}

interface X11Window {
  windowId: string;
  pid: number;
}

export type LinuxWindowTarget =
  | { kind: 'wayland'; appId: string }
  | { kind: 'x11'; windowId: string };

export type LinuxWindowSnapshot =
  | { kind: 'wayland'; keys: Set<string> }
  | { kind: 'x11'; keys: Set<string> };

function run(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        resolve(error ? null : stdout);
      },
    );
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waylandKey(window: WaylandWindow): string {
  return `${window.appId}\u0000${window.title}`;
}

function parseWaylandWindows(output: string): WaylandWindow[] {
  return output.split('\n').flatMap((line) => {
    // `wlrctl toplevel list` prints one `app_id: title` pair per window. Titles
    // may contain colons, so only the first separator is structural.
    const separator = line.indexOf(':');

    if (separator <= 0) {
      return [];
    }

    return [
      {
        appId: line.slice(0, separator),
        title: line.slice(separator + 1).replace(/^ /u, ''),
      },
    ];
  });
}

function parseX11Windows(output: string): X11Window[] {
  return output.split('\n').flatMap((line) => {
    // Example: `0x03a00007  0 12345  host title with spaces`
    const match = /^(0x[0-9a-f]+)\s+-?\d+\s+(\d+)\s+\S+(?:\s+(.*))?$/iu.exec(
      line.trim(),
    );

    if (!match) {
      return [];
    }

    const pid = Number(match[2]);

    return Number.isInteger(pid) && pid > 0
      ? [{ windowId: match[1], pid }]
      : [];
  });
}

async function listWaylandWindows(): Promise<WaylandWindow[] | null> {
  if (!WAYLAND_ENABLED) {
    return null;
  }

  const output = await run('wlrctl', ['toplevel', 'list']);

  return output === null ? null : parseWaylandWindows(output);
}

async function listX11Windows(): Promise<X11Window[] | null> {
  if (!X11_ENABLED) {
    return null;
  }

  const output = await run('wmctrl', ['-lp']);

  return output === null ? null : parseX11Windows(output);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.desktop$/u, '')
    .replace(/[^a-z0-9]/gu, '');
}

function executableName(appPath: string): string {
  return normalizeName(path.basename(appPath));
}

/** Wayland app ids are usually reverse DNS and end with the binary name. */
function appIdMatches(appId: string, executable: string): boolean {
  if (executable.length === 0) {
    return false;
  }

  if (normalizeName(appId) === executable) {
    return true;
  }

  const lastSegment = appId.split('.').at(-1) ?? '';

  return normalizeName(lastSegment) === executable;
}

function processName(pid: number): string | null {
  try {
    return readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
  } catch {
    return null;
  }
}

/** The kernel truncates `comm` to 15 characters, so prefix matches count too. */
function processNameMatches(name: string, executable: string): boolean {
  return (
    name.length > 0 &&
    (name === executable || (name.length >= 5 && executable.startsWith(name)))
  );
}

async function focusWaylandAppId(appId: string): Promise<boolean> {
  if (!WAYLAND_ENABLED || appId.length === 0) {
    return false;
  }

  return (
    (await run('wlrctl', ['toplevel', 'focus', `app_id:${appId}`])) !== null
  );
}

async function focusWaylandByExecutable(appPath: string): Promise<boolean> {
  const executable = executableName(appPath);

  if (executable.length === 0) {
    return false;
  }

  const windows = await listWaylandWindows();
  const match = windows?.find((window) =>
    appIdMatches(window.appId, executable),
  );

  return match ? focusWaylandAppId(match.appId) : false;
}

async function activateX11Window(windowId: string): Promise<boolean> {
  if (!X11_ENABLED || windowId.length === 0) {
    return false;
  }

  return (await run('wmctrl', ['-i', '-a', windowId])) !== null;
}

async function focusX11ByExecutable(appPath: string): Promise<boolean> {
  const executable = executableName(appPath);
  const windows = await listX11Windows();

  if (executable.length === 0 || !windows) {
    return false;
  }

  for (const window of windows) {
    const name = normalizeName(processName(window.pid) ?? '');

    if (processNameMatches(name, executable)) {
      if (await activateX11Window(window.windowId)) {
        return true;
      }
    }
  }

  return false;
}

/** Record the windows that are already open before an app is launched. */
export async function snapshotLinuxWindows(): Promise<LinuxWindowSnapshot | null> {
  const wayland = await listWaylandWindows();

  if (wayland) {
    return {
      kind: 'wayland',
      keys: new Set(wayland.map((window) => waylandKey(window))),
    };
  }

  const x11 = await listX11Windows();

  return x11
    ? { kind: 'x11', keys: new Set(x11.map((window) => window.windowId)) }
    : null;
}

/**
 * Wait for the window a just-launched app creates. Returns null when the
 * compositor exposes no usable window list or the window took too long. A new
 * window whose app id or process name matches the executable is preferred, so
 * another window changing its title mid-launch is not mistaken for the new app.
 */
export async function revealLinuxWindow(
  snapshot: LinuxWindowSnapshot | null,
  appPath: string,
): Promise<LinuxWindowTarget | null> {
  if (!snapshot) {
    return null;
  }

  const executable = executableName(appPath);
  const deadline = Date.now() + REVEAL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (snapshot.kind === 'wayland') {
      const windows = await listWaylandWindows();
      const found = windows?.filter(
        (window) => !snapshot.keys.has(waylandKey(window)),
      );
      const match =
        found?.find((window) => appIdMatches(window.appId, executable)) ??
        found?.[0];

      if (match) {
        return { kind: 'wayland', appId: match.appId };
      }
    } else {
      const windows = await listX11Windows();
      const found = windows?.filter(
        (window) => !snapshot.keys.has(window.windowId),
      );
      const match =
        found?.find((window) =>
          processNameMatches(
            normalizeName(processName(window.pid) ?? ''),
            executable,
          ),
        ) ?? found?.[0];

      if (match) {
        return { kind: 'x11', windowId: match.windowId };
      }
    }

    await sleep(REVEAL_INTERVAL_MS);
  }

  return null;
}

/**
 * Focus a recorded window. When it has closed, fall back to the current
 * windows and match the launched executable, which catches apps that recreated
 * their window after the launch snapshot.
 */
export async function focusLinuxWindow(
  target: LinuxWindowTarget | null,
  appPath: string,
): Promise<boolean> {
  if (target?.kind === 'wayland') {
    if (await focusWaylandAppId(target.appId)) {
      return true;
    }
  } else if (target?.kind === 'x11') {
    if (await activateX11Window(target.windowId)) {
      return true;
    }
  }

  if (await focusWaylandByExecutable(appPath)) {
    return true;
  }

  return focusX11ByExecutable(appPath);
}

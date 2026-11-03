import { spawn } from 'node:child_process';
import type { PowerAction } from '../shared/types';

/** Restart or power off the machine. Callers must confirm with the user. */
export function runPowerAction(rawAction: unknown) {
  if (rawAction !== 'restart' && rawAction !== 'shutdown') {
    throw new Error('Acción de energía no válida');
  }

  const action: PowerAction = rawAction;

  if (process.platform === 'win32') {
    spawn('shutdown', [action === 'restart' ? '/r' : '/s', '/t', '0'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    spawn(
      'osascript',
      [
        '-e',
        `tell application "System Events" to ${
          action === 'restart' ? 'restart' : 'shut down'
        }`,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
    return;
  }

  spawn('systemctl', [action === 'restart' ? 'reboot' : 'poweroff'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

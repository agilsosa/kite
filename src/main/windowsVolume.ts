import { execFile } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';

/**
 * easy-volume ships a small Windows helper, but its bundled path points inside
 * the Vite bundle. The helper is copied to the resources folder at package
 * time, so call it directly instead of going through the library.
 */
const VOLUME_HELPER = app.isPackaged
  ? path.join(process.resourcesPath, 'volume.exe')
  : path.join(
      app.getAppPath(),
      'node_modules',
      'easy-volume',
      'dist',
      'platforms',
      'windows',
      'volume.exe',
    );

function runHelper(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      VOLUME_HELPER,
      args,
      { timeout: 5000, windowsHide: true },
      (error, stdout, stderr) => {
        const message = stderr.trim();

        if (error || message.length > 0) {
          reject(error ?? new Error(message));
        } else {
          resolve(stdout.trim());
        }
      },
    );
  });
}

function parseLevel(raw: string): number {
  const level = Number.parseInt(raw, 10);

  if (!Number.isFinite(level) || level < 0 || level > 100) {
    throw new Error('El ayudante de volumen devolvió un valor no válido');
  }

  return level;
}

export async function getWindowsVolume(): Promise<number> {
  return parseLevel(await runHelper(['get']));
}

export async function setWindowsVolume(level: number): Promise<void> {
  parseLevel(await runHelper(['set', String(level)]));
}

export async function getWindowsMute(): Promise<boolean> {
  const status = await runHelper(['mute_status']);
  return status !== '0';
}

export async function setWindowsMute(muted: boolean): Promise<void> {
  await runHelper([muted ? 'mute' : 'unmute']);
}

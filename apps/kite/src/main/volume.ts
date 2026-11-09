import {
  getMute as getSystemMute,
  getVolume as getSystemVolume,
  setMute as setSystemMute,
  setVolume as setSystemVolume,
} from 'easy-volume';
import type { VolumeState } from '../shared/types';
import {
  getWindowsMute,
  getWindowsVolume,
  setWindowsMute,
  setWindowsVolume,
} from './windowsVolume';

const systemVolume =
  process.platform === 'win32'
    ? {
        getVolume: getWindowsVolume,
        setVolume: setWindowsVolume,
        getMute: getWindowsMute,
        setMute: setWindowsMute,
      }
    : {
        getVolume: getSystemVolume,
        setVolume: setSystemVolume,
        getMute: getSystemMute,
        setMute: setSystemMute,
      };

let lastKnownLevel = 50;

function clampLevel(level: number, cap: number): number {
  return Math.max(0, Math.min(cap, Math.round(level)));
}

export async function getVolumeState(cap: number): Promise<VolumeState> {
  const safeCap = Math.max(0, Math.min(100, Math.round(cap)));

  try {
    const [level, muted] = await Promise.all([
      systemVolume.getVolume(),
      systemVolume.getMute(),
    ]);
    lastKnownLevel = clampLevel(level, safeCap);

    if (level > safeCap) {
      await systemVolume.setVolume(safeCap).catch(() => {
        // Report the capped level even if the system call is unavailable.
      });
    }

    return { level: lastKnownLevel, muted, cap: safeCap };
  } catch {
    return { level: lastKnownLevel, muted: false, cap: safeCap };
  }
}

export async function setVolumeLevel(
  level: number,
  cap: number,
): Promise<VolumeState> {
  if (!Number.isFinite(level)) {
    throw new Error('El volumen debe ser un número');
  }

  const safeCap = Math.max(0, Math.min(100, Math.round(cap)));
  const nextLevel = clampLevel(level, safeCap);
  lastKnownLevel = nextLevel;

  try {
    await systemVolume.setVolume(nextLevel);
  } catch {
    throw new Error('No se pudo cambiar el volumen del sistema');
  }

  return getVolumeState(safeCap);
}

export async function setVolumeMuted(
  muted: boolean,
  cap: number,
): Promise<VolumeState> {
  try {
    await systemVolume.setMute(Boolean(muted));
  } catch {
    throw new Error('No se pudo cambiar el silencio del sistema');
  }

  return getVolumeState(cap);
}

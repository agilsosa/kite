import { useCallback, useEffect, useState } from 'react';
import type { VolumeState } from '../../shared/types';
import { errorMessage } from '../lib/format';

const INITIAL_VOLUME: VolumeState = { level: 50, muted: false, cap: 70 };

export function useVolume() {
  const [volume, setVolume] = useState<VolumeState>(INITIAL_VOLUME);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.volume.get();
      setError(null);
      setVolume(next);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const setLevel = useCallback(async (level: number) => {
    try {
      setError(null);
      setVolume(await window.api.volume.set(level));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    try {
      setError(null);
      setVolume(await window.api.volume.mute(muted));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { volume, error, refresh, setLevel, setMuted };
}

import { useCallback, useEffect, useState } from 'react';
import type { PublicConfig } from '../../shared/types';
import { errorMessage } from '../lib/format';

export function useKioskConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setConfig(await window.api.config.get());
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { config, error, reload, setConfig };
}

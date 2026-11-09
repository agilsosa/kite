import { useCallback, useEffect, useState } from 'react';
import type { WifiStatus } from '../../shared/types';

const INITIAL_STATUS: WifiStatus = { connected: false, ssid: null };

export function useWifiStatus() {
  const [status, setStatus] = useState<WifiStatus>(INITIAL_STATUS);

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.api.wifi.status());
    } catch {
      setStatus(INITIAL_STATUS);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 20_000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  return { status, refresh };
}

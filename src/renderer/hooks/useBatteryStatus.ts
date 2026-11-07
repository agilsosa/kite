import { useCallback, useEffect, useState } from 'react';
import type { BatteryStatus } from '../../shared/types';

const INITIAL_STATUS: BatteryStatus = { level: null, charging: false };
const POLL_MS = 60_000;

export function useBatteryStatus() {
  const [status, setStatus] = useState<BatteryStatus>(INITIAL_STATUS);

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.api.system.battery());
    } catch {
      setStatus(INITIAL_STATUS);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    // Re-check after a full-screen app closes, since timers can be throttled.
    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (!document.hidden) {
        void refresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  return { status, refresh };
}

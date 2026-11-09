import { useCallback, useEffect, useState } from 'react';
import type { ParentStatus } from '../../shared/types';

const INITIAL_STATUS: ParentStatus = { hasPin: false, unlocked: false };

export function useParentStatus() {
  const [status, setStatus] = useState<ParentStatus>(INITIAL_STATUS);

  const refresh = useCallback(async () => {
    try {
      setStatus(await window.api.parent.status());
    } catch {
      setStatus(INITIAL_STATUS);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, refresh, setStatus };
}

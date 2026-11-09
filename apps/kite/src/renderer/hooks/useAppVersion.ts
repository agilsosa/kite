import { useEffect, useState } from 'react';

/** Reads the packaged app version from the main process. */
export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    window.api.system
      .version()
      .then((next) => {
        if (active) {
          setVersion(next);
        }
      })
      .catch(() => {
        // The version label is cosmetic; omit it if the call fails.
      });

    return () => {
      active = false;
    };
  }, []);

  return version;
}

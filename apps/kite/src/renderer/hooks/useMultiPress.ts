import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs the callback after `count` activations within a short sliding window.
 * The taskbar version label uses it with two presses to open adult settings.
 */
export function useMultiPress(
  onComplete: () => void,
  count = 2,
  windowMs = 1200,
) {
  const callbackRef = useRef(onComplete);
  const pressesRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  const reset = useCallback(() => {
    pressesRef.current = 0;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const press = useCallback(() => {
    pressesRef.current += 1;

    if (pressesRef.current >= count) {
      reset();
      callbackRef.current();
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(reset, windowMs);
  }, [count, reset, windowMs]);

  useEffect(() => reset, [reset]);

  return { onClick: press };
}

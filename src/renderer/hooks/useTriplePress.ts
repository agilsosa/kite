import { useCallback, useEffect, useRef } from 'react';

/** Runs the callback after three activations within a short sliding window. */
export function useTriplePress(onTriplePress: () => void, windowMs = 1200) {
  const callbackRef = useRef(onTriplePress);
  const pressesRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onTriplePress;
  }, [onTriplePress]);

  const reset = useCallback(() => {
    pressesRef.current = 0;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const press = useCallback(() => {
    pressesRef.current += 1;

    if (pressesRef.current >= 3) {
      reset();
      callbackRef.current();
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(reset, windowMs);
  }, [reset, windowMs]);

  useEffect(() => reset, [reset]);

  return { onClick: press };
}

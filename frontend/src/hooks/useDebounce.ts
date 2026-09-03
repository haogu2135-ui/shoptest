import { useEffect, useRef, useState } from 'react';

export const DEFAULT_DEBOUNCE_MS = 300;

export const useDebounce = <T,>(
  value: T,
  delayMs: number = DEFAULT_DEBOUNCE_MS,
  onDebounced?: (value: T) => void,
) => {
  const normalizedDelayMs = Number.isFinite(delayMs)
    ? Math.max(0, Math.min(Math.floor(delayMs), 60_000))
    : DEFAULT_DEBOUNCE_MS;
  const [debouncedValue, setDebouncedValue] = useState(value);
  const onDebouncedRef = useRef(onDebounced);

  useEffect(() => {
    onDebouncedRef.current = onDebounced;
  }, [onDebounced]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
      onDebouncedRef.current?.(value);
    }, normalizedDelayMs);
    return () => window.clearTimeout(timer);
  }, [normalizedDelayMs, value]);

  return debouncedValue;
};

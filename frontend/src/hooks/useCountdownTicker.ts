import { useEffect } from 'react';

export const useCountdownTicker = (value: number, setValue: (update: (current: number) => number) => void) => {
  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) return;
    const timer = window.setTimeout(() => {
      setValue((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [setValue, value]);
};

export default useCountdownTicker;

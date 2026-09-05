import { useEffect, useRef } from 'react';
import useDocumentVisibility from './useDocumentVisibility';

type UseVisiblePollingOptions = {
  enabled: boolean;
  intervalMs: number;
  run: () => void | Promise<void>;
  runImmediately?: boolean;
};

const normalizeInterval = (value: number) => (
  Number.isFinite(value) ? Math.max(250, Math.floor(value)) : 1000
);

export const useVisiblePolling = ({
  enabled,
  intervalMs,
  run,
  runImmediately = true,
}: UseVisiblePollingOptions) => {
  const visible = useDocumentVisibility();
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled || !visible || typeof window === 'undefined') return;
    let disposed = false;
    let timer: number | null = null;
    let running = false;
    const delay = normalizeInterval(intervalMs);

    const schedule = () => {
      if (disposed || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (disposed || document.visibilityState === 'hidden') return;
        running = true;
        Promise.resolve()
          .then(() => runRef.current())
          .catch(() => undefined)
          .finally(() => {
            running = false;
            schedule();
          });
      }, delay);
    };

    const execute = () => {
      if (disposed || running) return;
      running = true;
      Promise.resolve()
        .then(() => runRef.current())
        .catch(() => undefined)
        .finally(() => {
          running = false;
          schedule();
        });
    };

    if (runImmediately) execute();
    else schedule();

    return () => {
      disposed = true;
      running = false;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
  }, [enabled, intervalMs, runImmediately, visible]);

  return visible;
};

export default useVisiblePolling;

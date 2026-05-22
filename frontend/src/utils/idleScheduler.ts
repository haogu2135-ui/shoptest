export type ScheduledIdleTask = {
  type: 'idle' | 'timeout';
  id: number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export const scheduleIdleTask = (callback: () => void, timeout = 1400): ScheduledIdleTask => {
  const win = window as WindowWithIdleCallback;
  if (typeof win.requestIdleCallback === 'function') {
    return { type: 'idle', id: win.requestIdleCallback(callback, { timeout }) };
  }
  return { type: 'timeout', id: window.setTimeout(callback, Math.min(timeout, 700)) };
};

export const cancelIdleTask = (task: ScheduledIdleTask) => {
  const win = window as WindowWithIdleCallback;
  if (task.type === 'idle' && typeof win.cancelIdleCallback === 'function') {
    win.cancelIdleCallback(task.id);
    return;
  }
  window.clearTimeout(task.id);
};

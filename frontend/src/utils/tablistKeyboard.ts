/**
 * WAI-ARIA Tabs Pattern helpers for commercial keyboard navigation.
 * Supports horizontal/vertical roving tabindex with Home/End.
 */

export type TablistOrientation = 'horizontal' | 'vertical';

const PREV_KEYS: Record<TablistOrientation, string[]> = {
  horizontal: ['ArrowLeft'],
  vertical: ['ArrowUp'],
};

const NEXT_KEYS: Record<TablistOrientation, string[]> = {
  horizontal: ['ArrowRight'],
  vertical: ['ArrowDown'],
};

export const resolveRovingTabIndex = (
  tabKeys: string[],
  activeKey: string,
  eventKey: string,
  options?: { orientation?: TablistOrientation; loop?: boolean },
): number | null => {
  if (!tabKeys.length) return null;
  const orientation = options?.orientation || 'horizontal';
  const loop = options?.loop !== false;
  const currentIndex = Math.max(0, tabKeys.indexOf(activeKey));
  let nextIndex: number | null = null;

  if (PREV_KEYS[orientation].includes(eventKey)) {
    if (currentIndex > 0) nextIndex = currentIndex - 1;
    else if (loop) nextIndex = tabKeys.length - 1;
  } else if (NEXT_KEYS[orientation].includes(eventKey)) {
    if (currentIndex < tabKeys.length - 1) nextIndex = currentIndex + 1;
    else if (loop) nextIndex = 0;
  } else if (eventKey === 'Home') {
    nextIndex = 0;
  } else if (eventKey === 'End') {
    nextIndex = tabKeys.length - 1;
  }

  if (nextIndex == null || nextIndex === currentIndex) return null;
  return nextIndex;
};

const scheduleTabFocus = (focusTarget: () => void) => {
  // Prefer a macrotask so React 18 state commits finish before moving focus.
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(focusTarget, 0);
    return;
  }
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focusTarget);
    return;
  }
  focusTarget();
};

export type RovingTablistKeyDownOptions = {
  tabKeys: string[];
  activeKey: string;
  onActivate: (key: string) => void;
  getTabElementId?: (key: string) => string;
  orientation?: TablistOrientation;
  loop?: boolean;
};

export const handleRovingTablistKeyDown = (
  event: { key: string; preventDefault: () => void },
  options: RovingTablistKeyDownOptions,
): boolean => {
  const nextIndex = resolveRovingTabIndex(options.tabKeys, options.activeKey, event.key, {
    orientation: options.orientation,
    loop: options.loop,
  });
  if (nextIndex == null) return false;

  const nextKey = options.tabKeys[nextIndex];
  if (!nextKey) return false;

  event.preventDefault();
  options.onActivate(nextKey);

  if (options.getTabElementId && typeof document !== 'undefined') {
    scheduleTabFocus(() => {
      document.getElementById(options.getTabElementId!(nextKey))?.focus();
    });
  }

  return true;
};

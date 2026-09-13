/**
 * Commercial focus-trap helpers for modal/drawer dialogs (WAI-ARIA APG).
 */

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type GetFocusableElementsOptions = {
  /** Extra class names that should never receive trapped focus (e.g. mask buttons). */
  excludeClassNames?: string[];
};

export const getFocusableElements = (
  root: HTMLElement | null,
  options?: GetFocusableElementsOptions,
): HTMLElement[] => {
  if (!root) return [];
  const excluded = new Set(options?.excludeClassNames || []);
  const focusables: HTMLElement[] = [];
  const candidates = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  for (let index = 0; index < candidates.length; index += 1) {
    const element = candidates[index];
    if (element.getAttribute('aria-hidden') === 'true') continue;
    if (element.hasAttribute('disabled')) continue;
    let isExcluded = false;
    for (let classIndex = 0; classIndex < element.classList.length; classIndex += 1) {
      const className = element.classList[classIndex];
      if (excluded.has(className)) {
        isExcluded = true;
        break;
      }
    }
    if (isExcluded) continue;
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
    }
    focusables.push(element);
  }
  return focusables;
};

export type ActivateFocusTrapOptions = {
  /** Panel/dialog root that owns the trap. */
  getPanel: () => HTMLElement | null;
  /** Optional preferred first-focus target inside the panel. */
  getInitialFocus?: () => HTMLElement | null;
  /** Called on Escape when enabled. */
  onEscape?: () => void;
  /** Whether Escape should close. Defaults to true when onEscape is provided. */
  escapeEnabled?: boolean;
  /** Class names excluded from focusable candidates. */
  excludeClassNames?: string[];
  /** Delay before initial focus so mounted content is ready. */
  initialFocusDelayMs?: number;
  /** Lock body scroll while active. Defaults to true. */
  lockBodyScroll?: boolean;
};

/**
 * Activates a focus trap while a dialog is open.
 * Returns a cleanup function that restores body scroll and prior focus.
 */
export const activateFocusTrap = (options: ActivateFocusTrapOptions): (() => void) => {
  if (typeof document === 'undefined') return () => undefined;

  const {
    getPanel,
    getInitialFocus,
    onEscape,
    escapeEnabled = Boolean(onEscape),
    excludeClassNames,
    initialFocusDelayMs = 0,
    lockBodyScroll = true,
  } = options;

  const { body } = document;
  const previousOverflow = body.style.overflow;
  if (lockBodyScroll) {
    body.style.overflow = 'hidden';
  }
  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  const focusInitial = () => {
    const panel = getPanel();
    if (!panel) return;
    const focusables = getFocusableElements(panel, { excludeClassNames });
    const preferred = getInitialFocus?.();
    let preferredIsFocusable = preferred === panel;
    if (preferred && !preferredIsFocusable) {
      for (const focusable of focusables) {
        if (focusable === preferred) {
          preferredIsFocusable = true;
          break;
        }
      }
    }
    const target = preferred && preferredIsFocusable
      ? preferred
      : focusables[0] || panel;
    target.focus();
  };

  const timerId = window.setTimeout(focusInitial, initialFocusDelayMs);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && escapeEnabled) {
      event.preventDefault();
      onEscape?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = getPanel();
    if (!panel) return;
    const focusables = getFocusableElements(panel, { excludeClassNames });
    if (!focusables.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (!active || active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (!active || active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  window.addEventListener('keydown', onKeyDown);

  return () => {
    window.clearTimeout(timerId);
    if (lockBodyScroll) {
      body.style.overflow = previousOverflow;
    }
    window.removeEventListener('keydown', onKeyDown);
    if (previouslyFocused?.isConnected && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
};

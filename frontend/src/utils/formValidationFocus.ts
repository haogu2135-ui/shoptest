/**
 * Commercial form UX: after submit validation fails, scroll the first invalid
 * Ant Design Form.Item into view and move keyboard focus to its control.
 */
export type FocusFirstFormErrorOptions = {
  rootSelector: string;
  scrollOffset?: number;
  /** Optional scrollable parent (e.g. auth card) to adjust before window scroll. */
  scrollContainerSelector?: string;
};

export const focusFirstFormError = ({
  rootSelector,
  scrollOffset = 120,
  scrollContainerSelector,
}: FocusFirstFormErrorOptions): boolean => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const root = document.querySelector(rootSelector);
  if (!root) {
    return false;
  }

  const firstInvalidItem = root.querySelector('.ant-form-item-has-error') as HTMLElement | null;
  if (!firstInvalidItem) {
    return false;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
  const safeOffset = Number.isFinite(scrollOffset) ? Math.max(0, Math.floor(scrollOffset)) : 120;

  if (scrollContainerSelector) {
    const container = firstInvalidItem.closest(scrollContainerSelector) as HTMLElement | null;
    if (container && container.scrollHeight > container.clientHeight + 1) {
      const containerRect = container.getBoundingClientRect();
      const fieldRect = firstInvalidItem.getBoundingClientRect();
      container.scrollTo({
        top: Math.max(0, container.scrollTop + fieldRect.top - containerRect.top - 16),
        behavior,
      });
    }
  }

  if (typeof firstInvalidItem.scrollIntoView === 'function') {
    firstInvalidItem.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
  }

  const fieldTop = firstInvalidItem.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({
    top: Math.max(0, fieldTop - safeOffset),
    behavior,
  });

  const firstControl = firstInvalidItem.querySelector(
    'input:not([type="hidden"]), textarea, select, button, .ant-select-selector, .ant-picker, [tabindex]:not([tabindex="-1"])',
  ) as HTMLElement | null;

  if (firstControl && typeof firstControl.focus === 'function') {
    try {
      firstControl.focus({ preventScroll: true });
    } catch {
      firstControl.focus();
    }
  }

  return true;
};

export default focusFirstFormError;

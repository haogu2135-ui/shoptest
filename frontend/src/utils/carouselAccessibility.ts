const focusableSelector = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
].join(',');

const ORIGINAL_TAB_INDEX_ATTR = 'data-shop-original-tab-index';

export const syncHiddenCarouselSlideFocus = (root?: ParentNode | null) => {
  if (!root) return;

  root.querySelectorAll<HTMLElement>('.slick-slide').forEach((slide) => {
    const hidden = slide.getAttribute('aria-hidden') === 'true';
    slide.querySelectorAll<HTMLElement>(focusableSelector).forEach((element) => {
      if (hidden) {
        if (!element.hasAttribute(ORIGINAL_TAB_INDEX_ATTR)) {
          element.setAttribute(ORIGINAL_TAB_INDEX_ATTR, element.getAttribute('tabindex') ?? '');
        }
        element.setAttribute('tabindex', '-1');
        return;
      }

      if (!element.hasAttribute(ORIGINAL_TAB_INDEX_ATTR)) return;
      const originalTabIndex = element.getAttribute(ORIGINAL_TAB_INDEX_ATTR) ?? '';
      if (originalTabIndex) {
        element.setAttribute('tabindex', originalTabIndex);
      } else {
        element.removeAttribute('tabindex');
      }
      element.removeAttribute(ORIGINAL_TAB_INDEX_ATTR);
    });
  });
};

import { focusFirstFormError } from './formValidationFocus';
import {
  CHECKOUT_VALIDATION_SCROLL_OFFSET,
  type CheckoutValidationField,
} from './checkoutHelpers';

export const CHECKOUT_MOBILE_MEDIA_QUERY = '(max-width: 780px)';

export const scrollCheckoutElementIntoView = (elementId: string, behavior: ScrollBehavior = 'smooth') => {
  if (typeof document === 'undefined') return;
  const element = document.getElementById(elementId);
  if (!element || typeof element.scrollIntoView !== 'function') return;
  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia(CHECKOUT_MOBILE_MEDIA_QUERY).matches;
  element.scrollIntoView({ behavior, block: isMobile ? 'center' : 'start' });
};

export const scrollCheckoutElementIntoMobileView = (elementId: string, behavior: ScrollBehavior = 'smooth') => {
  if (!window.matchMedia?.(CHECKOUT_MOBILE_MEDIA_QUERY).matches) return;
  scrollCheckoutElementIntoView(elementId, behavior);
};

export const scrollCheckoutFieldIntoMobileView = (
  target: EventTarget | null,
  fallbackElementId: string,
  behavior: ScrollBehavior = 'smooth',
) => {
  if (!window.matchMedia?.(CHECKOUT_MOBILE_MEDIA_QUERY).matches) return;
  if (target instanceof HTMLElement) {
    const field = target.closest('.ant-form-item') || target.closest('.checkout-page__addressChoice') || target;
    window.setTimeout(() => {
      if (typeof field.scrollIntoView === 'function') {
        field.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
      }
    }, 80);
    return;
  }
  scrollCheckoutElementIntoMobileView(fallbackElementId, behavior);
};

export const focusFirstCheckoutValidationError = (errorFields?: CheckoutValidationField[]) => {
  const firstFieldName = String(errorFields?.[0]?.name?.[0] || '');
  if (firstFieldName === 'paymentMethod') {
    scrollCheckoutElementIntoView('checkout-payment-card');
    const paymentOption = document.querySelector(
      '#checkout-payment-card .checkout-page__paymentMethod, #checkout-payment-card button, #checkout-payment-card [role="radio"]',
    ) as HTMLElement | null;
    if (paymentOption && typeof paymentOption.focus === 'function') {
      try {
        paymentOption.focus({ preventScroll: true });
      } catch (error) {
        void error;
        paymentOption.focus();
      }
    }
    return;
  }
  if (firstFieldName === 'guestEmail') {
    scrollCheckoutElementIntoView('checkout-contact-card');
  } else if (['recipientName', 'phone', 'region', 'shippingAddress', 'postalCode'].includes(firstFieldName)) {
    scrollCheckoutElementIntoView('checkout-address-card');
  }
  window.requestAnimationFrame(() => {
    focusFirstFormError({
      rootSelector: '.checkout-page',
      scrollOffset: CHECKOUT_VALIDATION_SCROLL_OFFSET,
    });
  });
};

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { loadRegionData, type RegionOption } from '../regionData';
import type { Language } from '../i18n';
import type { CheckoutMessageType, CheckoutTranslationFn } from '../utils/checkoutHelpers';
import { reportNonBlockingError } from '../utils/nonBlockingError';

type UseCheckoutRegionCascaderParams = {
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  showCheckoutMessage: (type: CheckoutMessageType, messageText: string) => void;
  t: CheckoutTranslationFn;
};

/**
 * Commercial checkout region Cascader lifecycle:
 * - lazy language-scoped region option load
 * - controlled open state + portal hide/remove on close
 * - close on scroll/viewport move/escape while open
 */
export const useCheckoutRegionCascader = ({
  language,
  mountedRef,
  showCheckoutMessage,
  t,
}: UseCheckoutRegionCascaderParams) => {
  const [checkoutRegionCascaderOpen, setCheckoutRegionCascaderOpen] = useState(false);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [regionOptionsLanguage, setRegionOptionsLanguage] = useState('');
  const [regionOptionsLoading, setRegionOptionsLoading] = useState(false);
  const regionRequestSeqRef = useRef(0);

  const loadCheckoutRegionOptions = useCallback(async () => {
    if (regionOptions.length > 0 && regionOptionsLanguage === language) {
      return regionOptions;
    }
    const requestSeq = regionRequestSeqRef.current + 1;
    regionRequestSeqRef.current = requestSeq;
    const isCurrentRequest = () => (
      mountedRef.current && regionRequestSeqRef.current === requestSeq
    );
    setRegionOptionsLoading(true);
    try {
      const options = await loadRegionData(language);
      if (isCurrentRequest()) {
        setRegionOptions(options);
        setRegionOptionsLanguage(language);
      }
      return options;
    } catch (error) {
      reportNonBlockingError('Checkout.loadRegionData', error);
      if (isCurrentRequest()) {
        showCheckoutMessage('error', t('pages.checkout.regionLoadFailed'));
      }
      return [] as RegionOption[];
    } finally {
      if (isCurrentRequest()) {
        setRegionOptionsLoading(false);
      }
    }
  }, [language, mountedRef, regionOptions, regionOptionsLanguage, showCheckoutMessage, t]);

  const setCheckoutRegionCascaderVisibility = useCallback((open: boolean) => {
    if (open) {
      void loadCheckoutRegionOptions();
    }
    setCheckoutRegionCascaderOpen(open);
    document.body.classList.toggle('checkout-region-cascader-open', open);
    const syncPortalVisibility = () => {
      document.querySelectorAll<HTMLElement>('.ant-cascader-dropdown').forEach((element) => {
        if (open) {
          element.style.removeProperty('display');
          element.style.removeProperty('visibility');
          element.style.removeProperty('opacity');
          element.style.removeProperty('width');
          element.style.removeProperty('height');
          element.style.removeProperty('pointer-events');
          return;
        }
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('width', '0', 'important');
        element.style.setProperty('height', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        element.remove();
      });
    };
    syncPortalVisibility();
    window.requestAnimationFrame(syncPortalVisibility);
  }, [loadCheckoutRegionOptions]);

  const closeCheckoutRegionCascader = useCallback(() => {
    setCheckoutRegionCascaderVisibility(false);
  }, [setCheckoutRegionCascaderVisibility]);

  useEffect(() => {
    if (!checkoutRegionCascaderOpen) return;
    const closeOnViewportMove = () => closeCheckoutRegionCascader();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCheckoutRegionCascader();
    };
    const passiveCaptureOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('scroll', closeOnViewportMove, true);
    window.addEventListener('resize', closeOnViewportMove);
    document.addEventListener('scroll', closeOnViewportMove, true);
    document.addEventListener('touchmove', closeOnViewportMove, passiveCaptureOptions);
    document.addEventListener('wheel', closeOnViewportMove, passiveCaptureOptions);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      window.removeEventListener('scroll', closeOnViewportMove, true);
      window.removeEventListener('resize', closeOnViewportMove);
      document.removeEventListener('scroll', closeOnViewportMove, true);
      document.removeEventListener('touchmove', closeOnViewportMove, passiveCaptureOptions);
      document.removeEventListener('wheel', closeOnViewportMove, passiveCaptureOptions);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [checkoutRegionCascaderOpen, closeCheckoutRegionCascader]);

  return {
    checkoutRegionCascaderOpen,
    regionOptions,
    regionOptionsLoading,
    loadCheckoutRegionOptions,
    setCheckoutRegionCascaderVisibility,
    closeCheckoutRegionCascader,
  };
};

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { couponApi } from '../api';
import type { CartItem, CouponQuote } from '../types';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import { conversionConfig } from '../utils/conversionConfig';
import {
  findBestCoupon,
  getCheckoutCouponErrorMessage,
  normalizeCouponQuote,
  type CheckoutMessageType,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import type { Language } from '../i18n';

type CheckoutLocalization = {
  t: CheckoutTranslationFn;
  language: Language;
};

type UseCheckoutCouponQuoteParams = {
  cartItems: CartItem[];
  cartTotal: number;
  couponManuallyChanged: boolean;
  selectedUserCouponId: number | null;
  mountedRef: MutableRefObject<boolean>;
  couponAutoSelectedQuoteRef: MutableRefObject<{ cartKey: string; couponId: number } | null>;
  checkoutLocalizationRef: MutableRefObject<CheckoutLocalization>;
  setCouponQuote: Dispatch<SetStateAction<CouponQuote | null>>;
  setCouponQuoteStatus: Dispatch<SetStateAction<'idle' | 'loading' | 'ready' | 'error'>>;
  setCouponQuoteErrorMessage: Dispatch<SetStateAction<string | null>>;
  setCouponSelectionErrorMessage: Dispatch<SetStateAction<string | null>>;
  setSelectedUserCouponId: Dispatch<SetStateAction<number | null>>;
  showCheckoutMessage: (type: CheckoutMessageType, messageText: string) => void;
};

/**
 * Commercial coupon quote lifecycle for authenticated checkout carts.
 * Auto-selects best coupon once per cart key; ignores language-only re-runs.
 */
export const useCheckoutCouponQuote = ({
  cartItems,
  cartTotal,
  couponManuallyChanged,
  selectedUserCouponId,
  mountedRef,
  couponAutoSelectedQuoteRef,
  checkoutLocalizationRef,
  setCouponQuote,
  setCouponQuoteStatus,
  setCouponQuoteErrorMessage,
  setCouponSelectionErrorMessage,
  setSelectedUserCouponId,
  showCheckoutMessage,
}: UseCheckoutCouponQuoteParams) => {
  const couponQuoteSeqRef = useRef(0);

  useEffect(() => {
    const hasToken = hasAuthenticatedCartSession();
    const couponQuoteCartKey = `${cartItems.map((item) => item.id).join(',')}|${cartTotal}`;
    if (!hasToken || cartItems.length === 0) {
      couponQuoteSeqRef.current += 1;
      couponAutoSelectedQuoteRef.current = null;
      setCouponQuote(null);
      setCouponQuoteStatus('idle');
      setCouponQuoteErrorMessage(null);
      setCouponSelectionErrorMessage(null);
      return;
    }
    if (
      selectedUserCouponId
      && couponAutoSelectedQuoteRef.current?.cartKey === couponQuoteCartKey
      && couponAutoSelectedQuoteRef.current.couponId === selectedUserCouponId
    ) {
      couponAutoSelectedQuoteRef.current = null;
      setCouponSelectionErrorMessage(null);
      return;
    }
    const requestSeq = couponQuoteSeqRef.current + 1;
    couponQuoteSeqRef.current = requestSeq;
    setCouponQuote(null);
    setCouponQuoteStatus('loading');
    setCouponQuoteErrorMessage(null);
    if (selectedUserCouponId) {
      setCouponSelectionErrorMessage(null);
    }
    let disposed = false;
    couponApi.quote({
      cartItemIds: cartItems.map((item) => item.id),
      userCouponId: selectedUserCouponId,
    })
      .then((res) => {
        if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;
        const nextCouponQuote = normalizeCouponQuote(res.data);
        if (!nextCouponQuote) {
          const { t: latestT } = checkoutLocalizationRef.current;
          setCouponQuote(null);
          setCouponQuoteStatus('error');
          setCouponQuoteErrorMessage(latestT('pages.checkout.couponUnavailable'));
          return;
        }
        const nextAvailableCoupons = nextCouponQuote?.availableCoupons || [];
        setCouponQuote(nextCouponQuote);
        setCouponQuoteStatus('ready');
        setCouponQuoteErrorMessage(null);
        if (selectedUserCouponId) {
          setCouponSelectionErrorMessage(null);
        }
        if (!selectedUserCouponId && !couponManuallyChanged) {
          const bestCoupon = conversionConfig.checkout.autoSelectBestCoupon
            ? findBestCoupon(nextAvailableCoupons, cartTotal)?.coupon
            : null;
          const nextCouponId = bestCoupon?.id || nextCouponQuote?.selectedUserCouponId;
          if (nextCouponId) {
            if (nextCouponQuote.selectedUserCouponId === nextCouponId) {
              couponAutoSelectedQuoteRef.current = { cartKey: couponQuoteCartKey, couponId: nextCouponId };
            }
            setSelectedUserCouponId(nextCouponId);
          }
        }
      })
      .catch((error) => {
        if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;
        setCouponQuote(null);
        setCouponQuoteStatus('error');
        const { t: latestT, language: latestLanguage } = checkoutLocalizationRef.current;
        const couponErrorMessage = getCheckoutCouponErrorMessage(error, latestT('pages.checkout.couponUnavailable'), latestT, latestLanguage);
        setCouponQuoteErrorMessage(couponErrorMessage);
        if (selectedUserCouponId) {
          setCouponSelectionErrorMessage(couponErrorMessage);
          showCheckoutMessage('error', couponErrorMessage);
          couponAutoSelectedQuoteRef.current = null;
          setSelectedUserCouponId(null);
        }
      });
    return () => {
      disposed = true;
    };
  }, [
    cartItems,
    cartTotal,
    checkoutLocalizationRef,
    couponAutoSelectedQuoteRef,
    couponManuallyChanged,
    mountedRef,
    selectedUserCouponId,
    setCouponQuote,
    setCouponQuoteErrorMessage,
    setCouponQuoteStatus,
    setCouponSelectionErrorMessage,
    setSelectedUserCouponId,
    showCheckoutMessage,
  ]);
};

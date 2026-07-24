import React, { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { UserCoupon } from '../types';
import type { CartBenefitTarget } from '../utils/cartBenefits';
import {
  buildCheckoutCouponOpportunity,
  findNextCheckoutCouponUnlock,
  pickCheckoutNextAction,
  resolveCheckoutNextActionLabelKey,
  scoreCheckoutReadiness,
  SUPPORT_PANEL_DISMISS_SUPPRESS_MS,
  type CheckoutMoneyFormatter,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import { scrollCheckoutElementIntoView } from '../utils/checkoutDom';
import { useNativeBackHandler } from '../utils/nativeBack';

type PaymentMethodDetail = {
  value: string;
  title: string;
};

type UseCheckoutConversionCoachParams = {
  addOnTarget: CartBenefitTarget | null;
  availableCoupons: UserCoupon[];
  cartItemCount: number;
  cartTotal: number;
  checkoutItemCount: number;
  closeCheckoutRegionCascader: () => void;
  discountAmount: number;
  formatMoney: CheckoutMoneyFormatter;
  freeShippingRemaining: number;
  freeShippingUnlocked: boolean;
  giftCelebrationOpen: boolean;
  giftEligible: boolean;
  giftName: string;
  giftRemaining: number;
  giftUnlocked: boolean;
  isGuestCheckout: boolean;
  navigate: NavigateFunction;
  openSupport: () => void;
  paymentMethodsAvailable: boolean;
  paymentMethodDetails: PaymentMethodDetail[];
  recommendedPaymentMethod?: string | null;
  selectedAddressReady: boolean;
  selectedCoupon?: UserCoupon | null;
  selectedIsBestCoupon: boolean;
  setSupportPanelOpen: Dispatch<SetStateAction<boolean>>;
  supportPanelOpen: boolean;
  t: CheckoutTranslationFn;
  watchedPaymentMethod?: string;
};

/**
 * Commercial checkout conversion coach:
 * readiness scoring, savings coaching, coupon opportunity, support-panel auto-open,
 * and next-action navigation that keeps place-order unblocked by savings-only gaps.
 */
export const useCheckoutConversionCoach = ({
  addOnTarget,
  availableCoupons,
  cartItemCount,
  cartTotal,
  checkoutItemCount,
  closeCheckoutRegionCascader,
  discountAmount,
  formatMoney,
  freeShippingRemaining,
  freeShippingUnlocked,
  giftCelebrationOpen,
  giftEligible,
  giftName,
  giftRemaining,
  giftUnlocked,
  isGuestCheckout,
  navigate,
  openSupport,
  paymentMethodsAvailable,
  paymentMethodDetails,
  recommendedPaymentMethod,
  selectedAddressReady,
  selectedCoupon,
  selectedIsBestCoupon,
  setSupportPanelOpen,
  supportPanelOpen,
  t,
  watchedPaymentMethod,
}: UseCheckoutConversionCoachParams) => {
  const supportPanelDismissedKeyRef = React.useRef<string | null>(null);
  const supportPanelDismissedUntilRef = React.useRef(0);

  const nextCouponUnlock = useMemo(
    () => findNextCheckoutCouponUnlock(availableCoupons, cartTotal),
    [availableCoupons, cartTotal],
  );

  const couponOpportunity = useMemo(() => buildCheckoutCouponOpportunity({
    isGuestCheckout,
    availableCoupons,
    selectedCoupon,
    selectedIsBestCoupon,
    discountAmount,
    nextCouponUnlock,
    formatMoney,
    t,
  }), [availableCoupons, discountAmount, formatMoney, isGuestCheckout, nextCouponUnlock, selectedCoupon, selectedIsBestCoupon, t]);

  const savingsCoachItems = useMemo(() => ([
    {
      key: 'shipping',
      icon: <ShopIcon path={SI.truck} />,
      ready: freeShippingUnlocked,
      title: t('pages.checkout.savingsFreeShippingTitle'),
      text: freeShippingUnlocked
        ? t('pages.checkout.savingsFreeShippingUnlocked')
        : t('pages.checkout.savingsFreeShippingText', { amount: formatMoney(freeShippingRemaining) }),
    },
    giftEligible ? {
      key: 'gift',
      icon: <ShopIcon path={SI.gift} />,
      ready: giftUnlocked,
      title: t('pages.checkout.savingsGiftTitle'),
      text: giftUnlocked
        ? t('pages.checkout.savingsGiftUnlocked', { gift: giftName })
        : t('pages.checkout.savingsGiftText', { amount: formatMoney(giftRemaining), gift: giftName }),
    } : null,
    !isGuestCheckout ? {
      key: 'coupon',
      icon: <ShopIcon path={SI.safety} />,
      ready: discountAmount > 0,
      title: t('pages.checkout.savingsCouponTitle'),
      text: discountAmount > 0
        ? t('pages.checkout.savingsCouponReady', { amount: formatMoney(discountAmount) })
        : nextCouponUnlock
          ? t('pages.checkout.savingsCouponGap', {
            amount: formatMoney(nextCouponUnlock.gap),
            value: formatMoney(nextCouponUnlock.estimatedValue),
          })
          : t('pages.checkout.savingsCouponEmpty'),
    } : null,
  ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; ready: boolean; title: string; text: string }>), [
    discountAmount,
    formatMoney,
    freeShippingRemaining,
    freeShippingUnlocked,
    giftEligible,
    giftName,
    giftRemaining,
    giftUnlocked,
    isGuestCheckout,
    nextCouponUnlock,
    t,
  ]);

  const selectedPaymentDetail = paymentMethodDetails.find((method) => method.value === watchedPaymentMethod);

  const checkoutReadinessItems = useMemo(() => ([
    {
      key: 'items',
      ready: cartItemCount > 0,
      label: t('pages.checkout.readinessItems'),
      text: t('pages.checkout.readinessItemsText', { count: checkoutItemCount }),
    },
    {
      key: 'address',
      ready: selectedAddressReady,
      label: t('pages.checkout.readinessAddress'),
      text: selectedAddressReady
        ? t('pages.checkout.readinessAddressReady')
        : t('pages.checkout.readinessAddressNeeded'),
    },
    {
      key: 'payment',
      ready: paymentMethodsAvailable && Boolean(watchedPaymentMethod || recommendedPaymentMethod),
      label: t('pages.checkout.readinessPayment'),
      text: !paymentMethodsAvailable
        ? t('pages.checkout.paymentUnavailable')
        : selectedPaymentDetail
          ? t('pages.checkout.readinessPaymentSelected', { method: selectedPaymentDetail.title })
          : t('pages.checkout.readinessPaymentNeeded'),
    },
    {
      key: 'savings',
      ready: freeShippingUnlocked || discountAmount > 0 || giftUnlocked,
      label: t('pages.checkout.readinessSavings'),
      text: freeShippingUnlocked
        ? t('pages.checkout.readinessFreeShippingReady')
        : t('pages.checkout.readinessFreeShippingGap', { amount: formatMoney(freeShippingRemaining) }),
    },
  ]), [
    cartItemCount,
    checkoutItemCount,
    discountAmount,
    formatMoney,
    freeShippingRemaining,
    freeShippingUnlocked,
    giftUnlocked,
    paymentMethodsAvailable,
    recommendedPaymentMethod,
    selectedAddressReady,
    selectedPaymentDetail,
    t,
    watchedPaymentMethod,
  ]);

  const checkoutReadinessScore = scoreCheckoutReadiness(checkoutReadinessItems);
  const checkoutNextAction = pickCheckoutNextAction(checkoutReadinessItems);
  // Savings coaching must never block place-order. Only items/address/payment gate submit CTAs.
  const checkoutBlockingAction = pickCheckoutNextAction(checkoutReadinessItems, { blockingOnly: true });
  const needsCheckoutSupport = Boolean(addOnTarget || couponOpportunity || checkoutNextAction);

  const supportPanelAutoOpenKey = useMemo(() => {
    if (!needsCheckoutSupport) return '';
    return [
      checkoutNextAction?.key || 'ready',
      addOnTarget ? `${addOnTarget.reason}:${Math.round(addOnTarget.remainingAmount * 100)}` : 'no-addon',
      couponOpportunity ? `${couponOpportunity.type}:${selectedCoupon?.id || nextCouponUnlock?.coupon?.id || 'coupon'}` : 'no-coupon',
    ].join('|');
  }, [
    addOnTarget,
    checkoutNextAction?.key,
    couponOpportunity,
    needsCheckoutSupport,
    nextCouponUnlock?.coupon?.id,
    selectedCoupon?.id,
  ]);

  useEffect(() => {
    if (!needsCheckoutSupport) {
      supportPanelDismissedKeyRef.current = null;
      return;
    }
    if (supportPanelDismissedUntilRef.current > Date.now()) {
      return;
    }
    if (supportPanelDismissedKeyRef.current === supportPanelAutoOpenKey) {
      return;
    }
    setSupportPanelOpen(true);
  }, [needsCheckoutSupport, setSupportPanelOpen, supportPanelAutoOpenKey]);

  const handleSupportPanelToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    setSupportPanelOpen(nextOpen);
    if (nextOpen) {
      supportPanelDismissedKeyRef.current = null;
      supportPanelDismissedUntilRef.current = 0;
      return;
    }
    supportPanelDismissedKeyRef.current = supportPanelAutoOpenKey || null;
    supportPanelDismissedUntilRef.current = Date.now() + SUPPORT_PANEL_DISMISS_SUPPRESS_MS;
  }, [setSupportPanelOpen, supportPanelAutoOpenKey]);

  const closeSupportPanelForNativeBack = useCallback(() => {
    if (giftCelebrationOpen || !supportPanelOpen) {
      return false;
    }
    supportPanelDismissedKeyRef.current = supportPanelAutoOpenKey || null;
    supportPanelDismissedUntilRef.current = Date.now() + SUPPORT_PANEL_DISMISS_SUPPRESS_MS;
    setSupportPanelOpen(false);
    return true;
  }, [giftCelebrationOpen, setSupportPanelOpen, supportPanelAutoOpenKey, supportPanelOpen]);

  useNativeBackHandler(supportPanelOpen, closeSupportPanelForNativeBack);

  const scrollToAddOns = useCallback(() => {
    scrollCheckoutElementIntoView('checkout-add-on-assistant');
  }, []);

  const handleCheckoutNextAction = useCallback(() => {
    const action = checkoutBlockingAction || checkoutNextAction;
    if (!action) {
      openSupport();
      return;
    }
    if (action.key === 'items') {
      navigate('/cart');
      return;
    }
    if (action.key === 'address') {
      scrollCheckoutElementIntoView('checkout-address-card');
      return;
    }
    if (action.key === 'payment') {
      closeCheckoutRegionCascader();
      scrollCheckoutElementIntoView('checkout-payment-card');
      return;
    }
    if (action.key === 'savings') {
      if (addOnTarget) {
        scrollToAddOns();
        return;
      }
      scrollCheckoutElementIntoView('checkout-coupon-card');
    }
  }, [
    addOnTarget,
    checkoutBlockingAction,
    checkoutNextAction,
    closeCheckoutRegionCascader,
    navigate,
    openSupport,
    scrollToAddOns,
  ]);

  const handleCouponOpportunityAction = useCallback(() => {
    const couponCard = document.getElementById('checkout-coupon-card');
    if (couponCard && typeof couponCard.scrollIntoView === 'function') {
      couponCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const checkoutCoachActionLabel = t(resolveCheckoutNextActionLabelKey(checkoutNextAction?.key));
  const checkoutNextActionLabel = t(resolveCheckoutNextActionLabelKey(checkoutBlockingAction?.key));
  const checkoutReadinessActionLabel = `${t('pages.checkout.readinessTitle')}: ${checkoutCoachActionLabel}`;
  const checkoutSavingsAddOnsActionLabel = addOnTarget
    ? `${t('pages.checkout.savingsShopAddOns')}: ${t('pages.checkout.savingsCoachTitle')}, ${formatMoney(addOnTarget.remainingAmount)}`
    : `${t('pages.checkout.savingsShopAddOns')}: ${t('pages.checkout.savingsCoachTitle')}`;
  const checkoutCouponOpportunityActionLabel = couponOpportunity
    ? `${couponOpportunity.action}: ${couponOpportunity.title}`
    : `${t('pages.checkout.coupon')}: ${t('pages.checkout.selectCoupon')}`;

  return {
    checkoutBlockingAction,
    checkoutCoachActionLabel,
    checkoutCouponOpportunityActionLabel,
    checkoutNextAction,
    checkoutNextActionLabel,
    checkoutReadinessActionLabel,
    checkoutReadinessItems,
    checkoutReadinessScore,
    checkoutSavingsAddOnsActionLabel,
    couponOpportunity,
    handleCheckoutNextAction,
    handleCouponOpportunityAction,
    handleSupportPanelToggle,
    nextCouponUnlock,
    savingsCoachItems,
    scrollToAddOns,
    selectedPaymentDetail,
  };
};

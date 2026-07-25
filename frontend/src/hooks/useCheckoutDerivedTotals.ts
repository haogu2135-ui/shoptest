import { useMemo } from 'react';
import type { CartItem, CouponQuote, UserCoupon } from '../types';
import { conversionConfig } from '../utils/conversionConfig';
import {
  buildCheckoutCouponSelectOptions,
  buildCheckoutShippingCopy,
  deriveCheckoutAddOnTarget,
  deriveCheckoutCartTotal,
  deriveCheckoutDeliveryPromise,
  deriveCheckoutEstimatedShippingSummary,
  deriveCheckoutGiftMetrics,
  deriveCheckoutItemCount,
  deriveCheckoutShippingQuoteState,
  describeCheckoutCoupon,
  estimateCouponDiscount,
  findBestCoupon,
  resolveAvailableCheckoutCoupons,
  type CheckoutCouponQuoteStatus,
  type CheckoutMoneyFormatter,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';

type MarketLike = {
  freeShippingThreshold: number;
  defaultShippingFee: number;
  locale: string;
};

type UseCheckoutDerivedTotalsArgs = {
  cartItems: CartItem[];
  cartTotal: number;
  market: MarketLike;
  currency: string;
  isGuestCheckout: boolean;
  couponQuote: CouponQuote | null;
  couponQuoteStatus: CheckoutCouponQuoteStatus;
  selectedUserCouponId: number | null;
  couponQuoteErrorMessage: string | null;
  formatMoney: CheckoutMoneyFormatter;
  t: CheckoutTranslationFn;
};

export const useCheckoutCartTotals = (cartItems: CartItem[]) => {
  const cartTotal = useMemo(() => deriveCheckoutCartTotal(cartItems), [cartItems]);
  const checkoutItemCount = useMemo(() => deriveCheckoutItemCount(cartItems), [cartItems]);
  return { cartTotal, checkoutItemCount };
};

export const useCheckoutDerivedTotals = ({
  cartItems,
  cartTotal,
  market,
  currency,
  isGuestCheckout,
  couponQuote,
  couponQuoteStatus,
  selectedUserCouponId,
  couponQuoteErrorMessage,
  formatMoney,
  t,
}: UseCheckoutDerivedTotalsArgs) => {
  const estimatedShippingSummary = useMemo(
    () => deriveCheckoutEstimatedShippingSummary(cartItems, market.freeShippingThreshold, cartTotal),
    [cartItems, cartTotal, market.freeShippingThreshold],
  );

  const shippingQuoteState = useMemo(
    () => deriveCheckoutShippingQuoteState({
      cartTotal,
      freeShippingThreshold: market.freeShippingThreshold,
      defaultShippingFee: market.defaultShippingFee,
      isGuestCheckout,
      cartItemCount: cartItems.length,
      couponQuote,
      couponQuoteStatus,
      selectedUserCouponId,
      estimatedFreeShippingUnlocked: estimatedShippingSummary.freeShippingUnlocked,
      estimatedRemainingAmount: estimatedShippingSummary.remainingAmount,
      estimatedProgressPercent: estimatedShippingSummary.progressPercent,
    }),
    [
      cartItems.length,
      cartTotal,
      couponQuote,
      couponQuoteStatus,
      estimatedShippingSummary.freeShippingUnlocked,
      estimatedShippingSummary.progressPercent,
      estimatedShippingSummary.remainingAmount,
      isGuestCheckout,
      market.defaultShippingFee,
      market.freeShippingThreshold,
      selectedUserCouponId,
    ],
  );

  const availableCoupons = useMemo(
    () => resolveAvailableCheckoutCoupons(couponQuote),
    [couponQuote],
  );

  const shippingCopy = useMemo(
    () => buildCheckoutShippingCopy({
      t,
      formatMoney,
      shippingQuotePending: shippingQuoteState.shippingQuotePending,
      shippingQuoteFallbackActive: shippingQuoteState.shippingQuoteFallbackActive,
      shippingQuoteUnavailable: shippingQuoteState.shippingQuoteUnavailable,
      shippingQuoteReady: shippingQuoteState.shippingQuoteReady,
      shippingFee: shippingQuoteState.shippingFee,
      payableAmount: shippingQuoteState.payableAmount,
      freeShippingThreshold: market.freeShippingThreshold,
      defaultShippingFee: market.defaultShippingFee,
      couponQuoteErrorMessage,
    }),
    [
      couponQuoteErrorMessage,
      formatMoney,
      market.defaultShippingFee,
      market.freeShippingThreshold,
      shippingQuoteState.payableAmount,
      shippingQuoteState.shippingFee,
      shippingQuoteState.shippingQuoteFallbackActive,
      shippingQuoteState.shippingQuotePending,
      shippingQuoteState.shippingQuoteReady,
      shippingQuoteState.shippingQuoteUnavailable,
      t,
    ],
  );

  const selectedCoupon = useMemo(
    () => availableCoupons.find((coupon) => coupon.id === selectedUserCouponId),
    [availableCoupons, selectedUserCouponId],
  );

  const bestCouponCandidate = useMemo(
    () => findBestCoupon(availableCoupons, cartTotal),
    [availableCoupons, cartTotal],
  );

  const selectedIsBestCoupon = Boolean(
    selectedUserCouponId && bestCouponCandidate?.coupon.id === selectedUserCouponId,
  );

  const deliveryPromise = useMemo(
    () => deriveCheckoutDeliveryPromise({ currency, locale: market.locale }),
    [currency, market.locale],
  );

  const giftMetrics = useMemo(
    () => deriveCheckoutGiftMetrics({ cartTotal, currency }),
    [cartTotal, currency],
  );

  const giftName = t(conversionConfig.giftAtCheckout.giftNameKey);
  const giftConfirmActionLabel = `${t('common.confirm')}: ${t('pages.checkout.giftModalTitle')}, ${giftName}`;

  const addOnTarget = useMemo(
    () => deriveCheckoutAddOnTarget({
      cartTotal,
      freeShippingUnlocked: shippingQuoteState.freeShippingUnlocked,
      freeShippingThreshold: market.freeShippingThreshold,
      currency,
    }),
    [cartTotal, currency, market.freeShippingThreshold, shippingQuoteState.freeShippingUnlocked],
  );

  const calculateCouponDiscount = (coupon: UserCoupon) => estimateCouponDiscount(coupon, cartTotal);
  const describeCoupon = (coupon: UserCoupon) => describeCheckoutCoupon(coupon, cartTotal, formatMoney, t);

  const checkoutCouponSelectOptions = useMemo(
    () => buildCheckoutCouponSelectOptions({
      availableCoupons,
      cartTotal,
      bestCouponId: bestCouponCandidate?.coupon.id,
      formatMoney,
      t,
    }),
    [availableCoupons, bestCouponCandidate?.coupon.id, cartTotal, formatMoney, t],
  );

  return {
    estimatedShippingSummary,
    availableCoupons,
    selectedCoupon,
    bestCouponCandidate,
    selectedIsBestCoupon,
    deliveryPromise,
    giftName,
    giftConfirmActionLabel,
    addOnTarget,
    calculateCouponDiscount,
    describeCoupon,
    checkoutCouponSelectOptions,
    ...shippingQuoteState,
    ...shippingCopy,
    ...giftMetrics,
  };
};

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { cartApi, clearStoredAuthSession, createApiAbortController, orderApi, paymentApi, productApi } from '../api';
import type { CartItem, CouponQuote, OrderCustomer, PaymentCustomer, ProductPublic as Product, UserAddress } from '../types';
import type { Language } from '../i18n';
import {
  buildCheckoutRecipientPayload,
  buildCheckoutShippingAddressLine,
  buildGuestCheckoutOrderItems,
  buildGuestRestoreCartLine,
  clearCheckoutIdempotencyKey,
  clearCheckoutPendingOrder,
      getOrCreateCheckoutIdempotencyKey,
  isFinalCheckoutOrderError,
  isPurchasable,
  normalizeCheckoutEmail,
  normalizeCheckoutPhone,
  normalizeCheckoutText,
  persistCheckoutPendingOrder,
  resolveCheckoutCartSubmitGuard,
  resolveCheckoutContactSubmitGuard,
  type CheckoutFormFieldName,
  type CheckoutFormValues,
  type CheckoutMessageType,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, syncCheckoutCartItemIds } from '../utils/cartSession';
import { addGuestCartItem, removeGuestCartItems } from '../utils/guestCart';
import { dispatchDomEvent } from '../utils/domEvents';
import { saveGuestSupportContext } from '../utils/guestSupportContext';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { removeSessionStorageItem } from '../utils/safeStorage';
import { navigateToCommercialPaymentUrl } from '../utils/paymentRecovery';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { normalizePositiveProductId } from '../utils/cartUi';
type PaymentMethodDetail = { value: string };

type UseCheckoutOrderActionsParams = {
  addresses: UserAddress[];
  cartItems: CartItem[];
  checkoutCartItemName: (item: Pick<CartItem, 'productId' | 'productName'>) => string;
  getCheckoutRegionValue: (values?: CheckoutFormValues) => string[] | undefined;
  getCheckoutTextValue: (fieldName: CheckoutFormFieldName, values?: CheckoutFormValues) => string;
  closeCheckoutRegionCascader: () => void;
  createdOrder: OrderCustomer | null;
  guestPaymentEmail?: string;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  navigate: NavigateFunction;
  payment: PaymentCustomer | null;
  paymentCreateRequestSeqRef: MutableRefObject<number>;
  paymentMethodsAvailable: boolean;
  paymentMethodDetails: PaymentMethodDetail[];
  paymentRetryingRef: MutableRefObject<boolean>;
  paymentSimulatingRef: MutableRefObject<boolean>;
  pendingPaymentMethod: string;
  requiresBackendShippingQuote: boolean;
  selectedAddressId: number | 'new';
  selectedSavedAddress: UserAddress | null;
  selectedSavedAddressDetail: string;
  selectedSavedAddressPostalCode: string;
  selectedSavedAddressRegion: string[];
  selectedUserCouponId: number | null;
  setAddresses: Dispatch<SetStateAction<UserAddress[]>>;
  setCancelingPayment: Dispatch<SetStateAction<boolean>>;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setCouponQuote: Dispatch<SetStateAction<CouponQuote | null>>;
  setCreatedOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setGuestPaymentEmail: Dispatch<SetStateAction<string | undefined>>;
  setPaying: Dispatch<SetStateAction<boolean>>;
  setPayment: Dispatch<SetStateAction<PaymentCustomer | null>>;
  setPaymentCreateError: Dispatch<SetStateAction<string | null>>;
  setPendingPaymentMethod: Dispatch<SetStateAction<string>>;
  setRollbackConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedAddressId: Dispatch<SetStateAction<number | 'new'>>;
  setSelectedUserCouponId: Dispatch<SetStateAction<number | null>>;
  setSimulatingPayment: Dispatch<SetStateAction<boolean>>;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  setCheckoutValidationAnnouncement: Dispatch<SetStateAction<string>>;
  shippingQuoteReady: boolean;
  shippingQuoteUnavailable: boolean;
  showCheckoutMessage: (type: CheckoutMessageType, messageText: string) => void;
  submittedCartItemsRef: MutableRefObject<CartItem[]>;
  submittingRef: MutableRefObject<boolean>;
  t: CheckoutTranslationFn;
  readGuestCartSnapshot: () => CartItem[];
};

const clearExpiredCheckoutSession = () => {
  clearStoredAuthSession();
};

/**
 * Commercial checkout order/payment action surface:
 * - place order (auth + guest) with idempotency + payment create
 * - retry payment / open payment URL / track order
 * - simulate payment (ops mode)
 * - restore cart + rollback pending payment
 */
export const useCheckoutOrderActions = ({
  addresses,
  cartItems,
  checkoutCartItemName,
  getCheckoutRegionValue,
  getCheckoutTextValue,
  closeCheckoutRegionCascader,
  createdOrder,
  guestPaymentEmail,
  language,
  mountedRef,
  navigate,
  payment,
  paymentCreateRequestSeqRef,
  paymentMethodsAvailable,
  paymentMethodDetails,
  paymentRetryingRef,
  paymentSimulatingRef,
  pendingPaymentMethod,
  requiresBackendShippingQuote,
  selectedAddressId,
  selectedSavedAddress,
  selectedSavedAddressDetail,
  selectedSavedAddressPostalCode,
  selectedSavedAddressRegion,
  selectedUserCouponId,
  setAddresses,
  setCancelingPayment,
  setCartItems,
  setCouponQuote,
  setCreatedOrder,
  setGuestPaymentEmail,
  setPaying,
  setPayment,
  setPaymentCreateError,
  setPendingPaymentMethod,
  setRollbackConfirmOpen,
  setSelectedAddressId,
  setSelectedUserCouponId,
  setSimulatingPayment,
  setSubmitting,
  setCheckoutValidationAnnouncement,
  shippingQuoteReady,
  shippingQuoteUnavailable,
  showCheckoutMessage,
  submittedCartItemsRef,
  submittingRef,
  t,
  readGuestCartSnapshot,
}: UseCheckoutOrderActionsParams) => {
  const suggestedProductCartAbortRef = useRef<AbortController | null>(null);
  const simulatePaymentAbortRef = useRef<AbortController | null>(null);
  const restoreProductsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    suggestedProductCartAbortRef.current?.abort();
    suggestedProductCartAbortRef.current = null;
    simulatePaymentAbortRef.current?.abort();
    simulatePaymentAbortRef.current = null;
    restoreProductsAbortRef.current?.abort();
    restoreProductsAbortRef.current = null;
  }, []);

  const buildAddress = (values: CheckoutFormValues) => {
    const address = selectedAddressId !== 'new'
      ? addresses.find((item) => String(item.id) === String(selectedAddressId)) || null
      : null;
    return buildCheckoutShippingAddressLine({
      selectedAddressId,
      selectedSavedAddress: address,
      selectedSavedAddressRegion,
      selectedSavedAddressPostalCode,
      selectedSavedAddressDetail,
      recipientName: getCheckoutTextValue('recipientName', values),
      phone: getCheckoutTextValue('phone', values),
      regionPath: getCheckoutRegionValue(values),
      postalCode: getCheckoutTextValue('postalCode', values),
      detailAddress: getCheckoutTextValue('shippingAddress', values),
      addressRequiredMessage: t('pages.checkout.addressRequired'),
    });
  };

  const buildRecipientPayload = (values: CheckoutFormValues) => buildCheckoutRecipientPayload({
    selectedAddressId,
    selectedSavedAddress,
    recipientName: getCheckoutTextValue('recipientName', values),
    phone: getCheckoutTextValue('phone', values),
  });

  const addSuggestedProduct = async (product: Product) => {
    const productId = normalizePositiveProductId(product.id);
    if (productId === null) {
      throw new Error(t('messages.addFailed'));
    }
    const productWithSafeId = { ...product, id: productId };
    const hasToken = hasAuthenticatedCartSession();
    if (hasToken) {
      const abortController = createApiAbortController();
      suggestedProductCartAbortRef.current?.abort();
      suggestedProductCartAbortRef.current = abortController;
      try {
        await cartApi.addItem(0, productId, 1);
        if (!mountedRef.current || abortController.signal.aborted) return;
        const response = await cartApi.getItems(0, { signal: abortController.signal });
        if (!mountedRef.current || abortController.signal.aborted) return;
        const purchasableItems = response.data.filter(isPurchasable);
        setCartItems(purchasableItems);
        syncCheckoutCartItemIds(purchasableItems);
        dispatchDomEvent('shop:cart-updated');
        return;
      } catch (error: unknown) {
        if (!mountedRef.current || abortController.signal.aborted) return;
        if (!isAuthExpiredError(error)) {
          throw error;
        }
      } finally {
        if (suggestedProductCartAbortRef.current === abortController) suggestedProductCartAbortRef.current = null;
      }
    }
    const addedItem = addGuestCartItem(productWithSafeId, 1);
    if (!addedItem) {
      throw new Error(t('messages.addFailed'));
    }
    const nextItems = readGuestCartSnapshot().filter(isPurchasable);
    setCartItems(nextItems);
    syncCheckoutCartItemIds(nextItems);
  };

  const handleSubmit = async (values: CheckoutFormValues) => {
    closeCheckoutRegionCascader();
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    try {
      setCheckoutValidationAnnouncement('');
      const hasToken = hasAuthenticatedCartSession();
      const cartSubmitGuard = resolveCheckoutCartSubmitGuard({
        cartItemCount: cartItems.length,
        hasUnavailableSelected: cartItems.some((item) => !isPurchasable(item)),
        paymentMethodsAvailable,
      });
      if (cartSubmitGuard === 'empty_cart') {
        showCheckoutMessage('error', t('pages.checkout.emptyCart'));
        return;
      }
      if (cartSubmitGuard === 'unavailable_selected') {
        showCheckoutMessage('error', t('pages.checkout.unavailableSelected'));
        return;
      }
      if (cartSubmitGuard === 'payment_unavailable') {
        showCheckoutMessage('error', t('pages.checkout.paymentUnavailable'));
        return;
      }
      const normalizedPaymentMethod = normalizeCheckoutText(values.paymentMethod, 40);
      const normalizedGuestEmail = hasToken ? undefined : normalizeCheckoutEmail(values.guestEmail);
      if (!paymentMethodDetails.some((method) => method.value === normalizedPaymentMethod)) {
        showCheckoutMessage('error', t('pages.checkout.paymentRequired'));
        return;
      }
      const contactSubmitGuard = resolveCheckoutContactSubmitGuard({
        hasToken,
        paymentMethod: normalizedPaymentMethod,
        guestEmail: normalizedGuestEmail,
        requiresBackendShippingQuote,
        shippingQuoteReady,
        shippingQuoteUnavailable,
      });
      if (contactSubmitGuard === 'payment_required') {
        showCheckoutMessage('error', t('pages.checkout.paymentRequired'));
        return;
      }
      if (contactSubmitGuard === 'email_invalid') {
        showCheckoutMessage('error', t('pages.checkout.emailInvalid'));
        return;
      }
      if (contactSubmitGuard === 'shipping_unavailable') {
        showCheckoutMessage('error', t('pages.checkout.shippingFeeUnavailable'));
        return;
      }
      if (contactSubmitGuard === 'shipping_calculating') {
        showCheckoutMessage('error', t('pages.checkout.shippingFeeCalculating'));
        return;
      }

      const checkoutIdempotencyKey = getOrCreateCheckoutIdempotencyKey();
      setSubmitting(true);
      try {
        const shippingAddress = buildAddress(values);
        const recipientPayload = buildRecipientPayload(values);
        const orderRes = hasToken
          ? await orderApi.checkout({
              cartItemIds: cartItems.map((item) => item.id),
              shippingAddress,
              recipientName: recipientPayload.recipientName,
              recipientPhone: recipientPayload.recipientPhone,
              paymentMethod: normalizedPaymentMethod,
              userCouponId: selectedUserCouponId,
            }, { idempotencyKey: checkoutIdempotencyKey })
          : await orderApi.guestCheckout({
              guestEmail: normalizedGuestEmail as string,
              guestName: normalizeCheckoutText(values.recipientName, 80),
              guestPhone: normalizeCheckoutPhone(values.phone),
              shippingAddress,
              paymentMethod: normalizedPaymentMethod,
              items: buildGuestCheckoutOrderItems(cartItems),
            }, { idempotencyKey: checkoutIdempotencyKey });
        const submittedCartItems = cartItems.map((item) => ({ ...item }));
        submittedCartItemsRef.current = submittedCartItems;
        persistCheckoutPendingOrder(orderRes.data, normalizedPaymentMethod, normalizedGuestEmail, submittedCartItems);
        setCreatedOrder(orderRes.data);
        setPendingPaymentMethod(normalizedPaymentMethod);
        setGuestPaymentEmail(normalizedGuestEmail);
        if (!hasToken && normalizedGuestEmail && orderRes.data.orderNo) {
          saveGuestSupportContext({ orderNo: orderRes.data.orderNo, email: normalizedGuestEmail });
        }
        clearCheckoutCartItemIds();
        removeSessionStorageItem('checkoutPaymentMethod');
        if (!hasToken) {
          removeGuestCartItems(cartItems.map((item) => item.id));
        } else {
          dispatchDomEvent('shop:cart-updated');
        }
        dispatchDomEvent('shop:coupons-updated');
        setPaymentCreateError(null);
        let paymentRes;
        try {
          paymentRes = await paymentApi.create(
            orderRes.data.id,
            normalizedPaymentMethod,
            normalizedGuestEmail,
            hasToken ? undefined : orderRes.data.orderNo,
          );
        } catch (paymentError: unknown) {
          setPayment(null);
          setPaymentCreateError(getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language));
          showCheckoutMessage('warning', t('pages.checkout.orderCreatedPaymentPending'));
          return;
        }
        setPayment(paymentRes.data);
        clearCheckoutIdempotencyKey();
        clearCheckoutPendingOrder();
        showCheckoutMessage('success', t('pages.checkout.orderCreated'));
        if (paymentRes.data.paymentUrl) {
          if (!navigateToCommercialPaymentUrl(paymentRes.data.paymentUrl)) {
            showCheckoutMessage('error', t('pages.payment.failed'));
          }
        }
      } catch (error: unknown) {
        if (hasToken && isAuthExpiredError(error)) {
          clearExpiredCheckoutSession();
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
          setAddresses([]);
          setSelectedAddressId('new');
          setSelectedUserCouponId(null);
          setCouponQuote(null);
          setGuestPaymentEmail(undefined);
          syncCheckoutCartItemIds([]);
          setCartItems([]);
          showCheckoutMessage('warning', t('pages.checkout.authExpired'));
          navigate(buildLoginUrlFromWindow(), { replace: true });
          return;
        }
        if (isFinalCheckoutOrderError(error)) {
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
        }
        showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));
      } finally {
        setSubmitting(false);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const retryCreatePayment = async () => {
    if (!createdOrder || paymentRetryingRef.current) return;
    paymentRetryingRef.current = true;
    const requestSeq = paymentCreateRequestSeqRef.current + 1;
    paymentCreateRequestSeqRef.current = requestSeq;
    setPaying(true);
    try {
      const guestOrderNo = guestPaymentEmail ? createdOrder.orderNo : undefined;
      const paymentRes = await paymentApi.create(createdOrder.id, pendingPaymentMethod, guestPaymentEmail, guestOrderNo);
      if (paymentCreateRequestSeqRef.current !== requestSeq) return;
      setPayment(paymentRes.data);
      clearCheckoutIdempotencyKey();
      clearCheckoutPendingOrder();
      setPaymentCreateError(null);
      showCheckoutMessage('success', t('pages.checkout.paymentReady'));
      if (paymentRes.data.paymentUrl && !navigateToCommercialPaymentUrl(paymentRes.data.paymentUrl)) {
        showCheckoutMessage('error', t('pages.payment.failed'));
      }
    } catch (error: unknown) {
      if (paymentCreateRequestSeqRef.current !== requestSeq) return;
      const localizedError = getApiErrorMessage(error, t('pages.payment.createFailed'), language);
      setPaymentCreateError(localizedError);
      showCheckoutMessage('error', localizedError);
    } finally {
      if (paymentCreateRequestSeqRef.current === requestSeq) {
        setPaying(false);
      }
      paymentRetryingRef.current = false;
    }
  };

  const openPaymentUrl = () => {
    if (payment?.paymentUrl && !navigateToCommercialPaymentUrl(payment.paymentUrl)) {
      showCheckoutMessage('error', t('pages.payment.failed'));
    }
  };

  const openTrackedOrder = () => {
    const orderNo = createdOrder?.orderNo || (createdOrder?.id ? String(createdOrder.id) : '');
    if (guestPaymentEmail && orderNo) {
      saveGuestSupportContext({ orderNo, email: guestPaymentEmail });
      navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}`);
      return;
    }
    navigate('/track-order');
  };

  const simulatePayment = async () => {
    if (!payment || paymentSimulatingRef.current) return;
    paymentSimulatingRef.current = true;
    const abortController = createApiAbortController();
    simulatePaymentAbortRef.current?.abort();
    simulatePaymentAbortRef.current = abortController;
    setSimulatingPayment(true);
    try {
      const paymentRes = await paymentApi.simulateCallback(payment.id, { signal: abortController.signal });
      if (!mountedRef.current || abortController.signal.aborted) return;
      setPayment(paymentRes.data);
      if (createdOrder?.id && hasAuthenticatedCartSession()) {
        const orderRes = await orderApi.getById(createdOrder.id, undefined, undefined, { signal: abortController.signal });
        if (!mountedRef.current || abortController.signal.aborted) return;
        setCreatedOrder(orderRes.data);
      } else if (createdOrder) {
        if (!mountedRef.current || abortController.signal.aborted) return;
        setCreatedOrder({ ...createdOrder, status: 'PENDING_SHIPMENT' });
      }
    } catch (error: unknown) {
      if (!mountedRef.current || abortController.signal.aborted) return;
      showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.simulatePaymentFailed'), language));
    } finally {
      if (simulatePaymentAbortRef.current === abortController) {
        simulatePaymentAbortRef.current = null;
        if (mountedRef.current && !abortController.signal.aborted) setSimulatingPayment(false);
        paymentSimulatingRef.current = false;
      }
    }
  };

  const restoreSubmittedCartItems = async () => {
    const hasToken = hasAuthenticatedCartSession();
    const submittedCartItems = submittedCartItemsRef.current.length > 0 ? submittedCartItemsRef.current : cartItems;
    if (hasToken) {
      const results = await allSettledWithConcurrency(
        submittedCartItems,
        (item) => cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs),
      );
      if (!mountedRef.current) return false;
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        throw failed.reason;
      }
      dispatchDomEvent('shop:cart-updated');
      return true;
    }
    const productIds = Array.from(new Set(submittedCartItems.map((item) => item.productId).filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)));
    let latestProducts = new Map<number, Product>();
    if (productIds.length > 0) {
      const abortController = createApiAbortController();
      restoreProductsAbortRef.current?.abort();
      restoreProductsAbortRef.current = abortController;
      try {
        const res = await productApi.getByIds(productIds, { bypassCache: true, signal: abortController.signal });
        if (!mountedRef.current || abortController.signal.aborted) return false;
        latestProducts = new Map((Array.isArray(res.data) ? res.data : []).map((product) => [Number(product.id), product]));
      } catch (error) {
        if (!mountedRef.current || abortController.signal.aborted) return false;
        reportNonBlockingError('checkout.restoreSubmittedCartItems product refresh failed', error);
      } finally {
        if (restoreProductsAbortRef.current === abortController) restoreProductsAbortRef.current = null;
      }
    }
    if (!mountedRef.current) return false;
    submittedCartItems.forEach((item) => {
      const latestProduct = latestProducts.get(item.productId);
      const restoreLine = buildGuestRestoreCartLine(item, latestProduct, checkoutCartItemName(item));
      addGuestCartItem(restoreLine.product, restoreLine.quantity, restoreLine.selectedSpecs, restoreLine.restorePrice);
    });
    return true;
  };

  const rollbackPendingPayment = () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    setRollbackConfirmOpen(true);
  };

  const handleRollbackConfirm = async () => {
    if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT') return;
    setCancelingPayment(true);
    try {
      await orderApi.cancel(createdOrder.id, guestPaymentEmail, guestPaymentEmail ? createdOrder.orderNo : undefined);
      const restored = await restoreSubmittedCartItems();
      if (!restored || !mountedRef.current) return;
      clearCheckoutIdempotencyKey();
      clearCheckoutPendingOrder();
      setPayment(null);
      setCreatedOrder(null);
      setPaymentCreateError(null);
      setRollbackConfirmOpen(false);
      showCheckoutMessage('success', t('pages.checkout.rollbackPaymentSuccess'));
      navigate('/cart');
    } catch (error: unknown) {
      if (mountedRef.current) {
        showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.rollbackPaymentFailed'), language));
      }
    } finally {
      if (mountedRef.current) setCancelingPayment(false);
    }
  };


  return {
    addSuggestedProduct,
    handleRollbackConfirm,
    handleSubmit,
    openPaymentUrl,
    openTrackedOrder,
    retryCreatePayment,
    rollbackPendingPayment,
    simulatePayment,
  };
};

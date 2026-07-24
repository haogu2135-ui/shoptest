import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import type { NavigateFunction } from 'react-router-dom';
import { addressApi, cartApi, clearStoredAuthSession } from '../api';
import type { CartItem, CouponQuote, UserAddress } from '../types';
import { getGuestCartItems } from '../utils/guestCart';
import {
  hasAuthenticatedCartSession,
  readCheckoutCartItemIds,
  syncCheckoutCartItemIds,
} from '../utils/cartSession';
import {
  areSameIds,
  clearCheckoutIdempotencyKey,
  clearCheckoutPendingOrder,
  isPurchasable,
  readCheckoutGuestDraftFields,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
  type CheckoutMessageType,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import type { Language } from '../i18n';

type CheckoutFormInstance = FormInstance<CheckoutFormValues>;

const readGuestCartSnapshot = () => {
  const items = getGuestCartItems();
  return Array.isArray(items) ? items : [];
};

const clearExpiredCheckoutSession = () => {
  clearStoredAuthSession();
};

type UseCheckoutCartBootstrapParams = {
  checkoutReloadKey: number;
  form: CheckoutFormInstance;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  mergeCheckoutFormSnapshot: (updates: CheckoutFormSnapshot, preserveHydratedValues?: boolean) => void;
  navigate: NavigateFunction;
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  setAddresses: Dispatch<SetStateAction<UserAddress[]>>;
  setAddressLoadFailed: Dispatch<SetStateAction<boolean>>;
  setCartLoadError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedAddressId: Dispatch<SetStateAction<number | 'new'>>;
  setSelectedUserCouponId: Dispatch<SetStateAction<number | null>>;
  setCouponQuote: Dispatch<SetStateAction<CouponQuote | null>>;
  setCouponQuoteErrorMessage: Dispatch<SetStateAction<string | null>>;
  setCouponSelectionErrorMessage: Dispatch<SetStateAction<string | null>>;
  setFormHydrationRevision: Dispatch<SetStateAction<number>>;
  showCheckoutMessage: (type: CheckoutMessageType, messageText: string) => void;
  t: CheckoutTranslationFn;
};

/**
 * Commercial checkout cart/address bootstrap:
 * - guest cart snapshot + draft hydration
 * - authenticated cart+address load with purchasability filter
 * - auth-expired session clear + login redirect
 * - independent of address/payment field watches (reload key only)
 */
export const useCheckoutCartBootstrap = ({
  checkoutReloadKey,
  form,
  language,
  mountedRef,
  mergeCheckoutFormSnapshot,
  navigate,
  setCartItems,
  setAddresses,
  setAddressLoadFailed,
  setCartLoadError,
  setLoading,
  setSelectedAddressId,
  setSelectedUserCouponId,
  setCouponQuote,
  setCouponQuoteErrorMessage,
  setCouponSelectionErrorMessage,
  setFormHydrationRevision,
  showCheckoutMessage,
  t,
}: UseCheckoutCartBootstrapParams) => {
  useEffect(() => {
    const selectedCartItemIds = readCheckoutCartItemIds();
    const hasToken = hasAuthenticatedCartSession();
    let disposed = false;
    if (!hasToken) {
      const guestItems = readGuestCartSnapshot().filter((item) => selectedCartItemIds.length === 0 || selectedCartItemIds.includes(item.id));
      const purchasableItems = guestItems.filter(isPurchasable);
      const purchasableIds = purchasableItems.map((item) => item.id);
      if (purchasableItems.length !== guestItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
        showCheckoutMessage('warning', t('pages.checkout.unavailableSelected'));
        syncCheckoutCartItemIds(purchasableItems);
      }
      setCartItems(purchasableItems);
      setAddresses([]);
      setAddressLoadFailed(false);
      setCartLoadError(null);
      const draftFields = readCheckoutGuestDraftFields();
      if (draftFields) {
        form.setFieldsValue(draftFields);
        mergeCheckoutFormSnapshot(draftFields);
        setFormHydrationRevision((revision) => revision + 1);
      }
      setLoading(false);
      return;
    }

    const loadCheckout = async () => {
      setLoading(true);
      setAddressLoadFailed(false);
      setCartLoadError(null);
      try {
        const [cartRes, addressRes] = await Promise.all([
          cartApi.getItems(0),
          addressApi.getByUser(0).catch((error) => {
            reportNonBlockingError('Checkout.loadAddresses', error);
            if (!disposed && mountedRef.current) {
              setAddressLoadFailed(true);
              showCheckoutMessage('warning', t('pages.checkout.addressLoadFailed'));
            }
            return { data: [] as UserAddress[] };
          }),
        ]);
        if (disposed || !mountedRef.current) return;
        const selectedItems = selectedCartItemIds.length === 0
          ? cartRes.data
          : cartRes.data.filter((item) => selectedCartItemIds.includes(item.id));
        const purchasableItems = selectedItems.filter(isPurchasable);
        const purchasableIds = purchasableItems.map((item) => item.id);
        if (purchasableItems.length !== selectedItems.length || (selectedCartItemIds.length > 0 && !areSameIds(selectedCartItemIds, purchasableIds))) {
          showCheckoutMessage('warning', t('pages.checkout.unavailableSelected'));
          syncCheckoutCartItemIds(purchasableItems);
        }
        setCartItems(purchasableItems);
        setCartLoadError(null);
        setAddresses(addressRes.data);
        const defaultAddress = addressRes.data.find((address) => address.isDefault) || addressRes.data[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
      } catch (error: unknown) {
        if (disposed || !mountedRef.current) return;
        if (isAuthExpiredError(error)) {
          clearExpiredCheckoutSession();
          clearCheckoutIdempotencyKey();
          clearCheckoutPendingOrder();
          syncCheckoutCartItemIds([]);
          setCartItems([]);
          setAddresses([]);
          setAddressLoadFailed(false);
          setSelectedAddressId('new');
          setSelectedUserCouponId(null);
          setCouponQuote(null);
          setCouponQuoteErrorMessage(null);
          setCouponSelectionErrorMessage(null);
          showCheckoutMessage('warning', t('pages.checkout.authExpired'));
          navigate(buildLoginUrlFromWindow(), { replace: true });
        } else {
          const errorMessage = getApiErrorMessage(error, t('pages.checkout.loadFailed'), language);
          setCartLoadError(errorMessage);
          showCheckoutMessage('error', t('pages.checkout.loadFailed'));
        }
      } finally {
        if (!disposed && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void loadCheckout();
    return () => {
      disposed = true;
    };
  }, [
    checkoutReloadKey,
    form,
    language,
    mergeCheckoutFormSnapshot,
    mountedRef,
    navigate,
    setAddressLoadFailed,
    setAddresses,
    setCartItems,
    setCartLoadError,
    setCouponQuote,
    setCouponQuoteErrorMessage,
    setCouponSelectionErrorMessage,
    setFormHydrationRevision,
    setLoading,
    setSelectedAddressId,
    setSelectedUserCouponId,
    showCheckoutMessage,
    t,
  ]);
};

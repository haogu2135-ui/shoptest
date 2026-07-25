import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { addressApi, orderApi, petProfileApi, userApi } from '../api';
import type { Language } from '../i18n';
import type { OrderCustomer, OrderItemCustomer, PetProfile, UserAddress, UserProfile } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import {
  PROFILE_ORDER_ITEM_PREVIEW_LIMIT,
  sortOrdersNewestFirst,
  type OrderItemsPreviewResult,
} from '../utils/profileHelpers';
import { getLocalStorageItem } from '../utils/safeStorage';

type ProfileLocalization = {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type UseProfileSessionDataParams = {
  profileLocalizationRef: MutableRefObject<ProfileLocalization>;
  setAddresses: Dispatch<SetStateAction<UserAddress[]>>;
  setAddressesLoadFailed: Dispatch<SetStateAction<boolean>>;
  setAuthRequired: Dispatch<SetStateAction<boolean>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setOrderItemPreviewFailedByOrderId: Dispatch<SetStateAction<Record<number, boolean>>>;
  setOrderItemsByOrderId: Dispatch<SetStateAction<Record<number, OrderItemCustomer[]>>>;
  setOrders: Dispatch<SetStateAction<OrderCustomer[]>>;
  setOrdersInitialLoadComplete: Dispatch<SetStateAction<boolean>>;
  setOrdersLoadFailed: Dispatch<SetStateAction<boolean>>;
  setPetProfiles: Dispatch<SetStateAction<PetProfile[]>>;
  setUser: Dispatch<SetStateAction<UserProfile | null>>;
};

/**
 * Commercial profile session bootstrap:
 * auth gate, profile/orders/addresses/pets loaders, and mount lifecycle.
 */
export const useProfileSessionData = ({
  profileLocalizationRef,
  setAddresses,
  setAddressesLoadFailed,
  setAuthRequired,
  setLoading,
  setOrderItemPreviewFailedByOrderId,
  setOrderItemsByOrderId,
  setOrders,
  setOrdersInitialLoadComplete,
  setOrdersLoadFailed,
  setPetProfiles,
  setUser,
}: UseProfileSessionDataParams) => {
  const mountedRef = useRef(false);
  const ordersRef = useRef<OrderCustomer[]>([]);
  const ordersRequestSeqRef = useRef(0);
  const paymentReturnSyncSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ordersRequestSeqRef.current += 1;
      paymentReturnSyncSeqRef.current += 1;
    };
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const response = await userApi.getProfile();
      if (!mountedRef.current) return;
      setUser(response.data);
    } catch (error) {
      reportNonBlockingError('Profile.fetchUserInfo', error);
      if (mountedRef.current) {
        announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.fetchUserFailed'), 'error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [profileLocalizationRef, setLoading, setUser]);

  const fetchOrders = useCallback(async () => {
    const requestSeq = ordersRequestSeqRef.current + 1;
    ordersRequestSeqRef.current = requestSeq;
    try {
      const response = await orderApi.getMine();
      const sortedOrders = sortOrdersNewestFirst(response.data || []);
      if (!mountedRef.current || ordersRequestSeqRef.current !== requestSeq) return;
      ordersRef.current = sortedOrders;
      setOrders(sortedOrders);
      setOrdersLoadFailed(false);
      setOrdersInitialLoadComplete(true);
      const itemResults = await allSettledWithConcurrency(
        sortedOrders.slice(0, PROFILE_ORDER_ITEM_PREVIEW_LIMIT),
        async (order) => {
          try {
            const res = await orderApi.getItems(order.id);
            return { orderId: order.id, items: res.data || [], failed: false } as OrderItemsPreviewResult;
          } catch (error) {
            reportNonBlockingError('Profile.fetchOrderItemsPreview', error);
            return { orderId: order.id, items: [], failed: true } as OrderItemsPreviewResult;
          }
        },
      );
      const previewResults = itemResults
        .filter((result): result is PromiseFulfilledResult<OrderItemsPreviewResult> => result.status === 'fulfilled')
        .map((result) => result.value);
      if (!mountedRef.current || ordersRequestSeqRef.current !== requestSeq) return;
      setOrderItemsByOrderId(Object.fromEntries(previewResults.map((result) => [result.orderId, result.items] as const)));
      setOrderItemPreviewFailedByOrderId(Object.fromEntries(
        previewResults
          .filter((result) => result.failed)
          .map((result) => [result.orderId, true] as const),
      ));
    } catch (error) {
      reportNonBlockingError('Profile.fetchOrders', error);
      if (mountedRef.current && ordersRequestSeqRef.current === requestSeq) {
        setOrdersLoadFailed(true);
        setOrdersInitialLoadComplete(true);
        announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.fetchOrdersFailed'), 'error');
      }
    }
  }, [
    profileLocalizationRef,
    setOrderItemPreviewFailedByOrderId,
    setOrderItemsByOrderId,
    setOrders,
    setOrdersInitialLoadComplete,
    setOrdersLoadFailed,
  ]);

  const fetchAddresses = useCallback(async () => {
    try {
      const response = await addressApi.getByUser(0);
      if (!mountedRef.current) return;
      setAddresses(response.data);
      setAddressesLoadFailed(false);
    } catch (error) {
      reportNonBlockingError('Profile.fetchAddresses', error);
      if (mountedRef.current) {
        setAddressesLoadFailed(true);
      }
    }
  }, [setAddresses, setAddressesLoadFailed]);

  const fetchPetProfiles = useCallback(async () => {
    try {
      const response = await petProfileApi.getMine();
      if (!mountedRef.current) return;
      setPetProfiles(response.data || []);
    } catch (error) {
      reportNonBlockingError('Profile.fetchPetProfiles', error);
      if (mountedRef.current) {
        setPetProfiles([]);
        announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.fetchPetProfilesFailed'), 'error');
      }
    }
  }, [profileLocalizationRef, setPetProfiles]);

  useEffect(() => {
    const token = getLocalStorageItem('token');
    if (!token) {
      setAuthRequired(true);
      setLoading(false);
      setUser(null);
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    fetchUserInfo();
    fetchOrders();
    fetchAddresses();
    fetchPetProfiles();
  }, [fetchAddresses, fetchOrders, fetchPetProfiles, fetchUserInfo, setAuthRequired, setLoading, setUser]);

  return {
    fetchAddresses,
    fetchOrders,
    fetchPetProfiles,
    fetchUserInfo,
    mountedRef,
    ordersRef,
    paymentReturnSyncSeqRef,
  };
};

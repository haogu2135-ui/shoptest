import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopModal from '../components/ShopModal';
import ShopConfirm from '../components/ShopConfirm';
import { Form } from 'antd';
import ShopSelect from '../components/ShopSelect';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addressApi, orderApi, paymentApi, petProfileApi, userApi } from '../api';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer, PaymentChannel, PetProfile, UserAddress, UserProfile } from '../types';
import type { RegionOption } from '../regionData';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrl, buildLoginUrlFromWindow } from '../utils/authRedirect';
import { createPaymentMethodDetails, createPaymentMethodOptions } from '../utils/paymentMethods';
import { useAppConfig } from '../hooks/useAppConfig';
import { useMarket } from '../hooks/useMarket';
import './Profile.css';
import { dispatchDomEvent } from '../utils/domEvents';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageEmpty from '../components/PageEmpty';
import '../styles/mobile-page-contrast.css';
import { getPaymentRecoveryState } from '../utils/paymentRecovery';
import { handleRovingTablistKeyDown } from '../utils/tablistKeyboard';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  ORDER_STATUS_LABEL_KEYS,
  PAYMENT_STATUS_LABEL_KEYS,
  PROFILE_MOBILE_ENTRY_TAB_KEYS,
  PROFILE_ORDER_ITEM_PREVIEW_LIMIT,
  PROFILE_TAB_KEYS,
  getPreferredPaymentChannel,
  isCompleteProfileAddress,
  isLikelyProfilePhone,
  normalizeLikelyProfilePhone,
  normalizeProfileEmail,
  normalizeProfileOrderNo,
  normalizeProfileTab,
  normalizeStatusCode,
  profileOrderLabel,
  sortOrdersNewestFirst,
  statusColors,
  type OrderActionHint,
  type OrderItemsPreviewResult,
} from '../utils/profileHelpers';
import { useProfilePaymentActions } from '../hooks/useProfilePaymentActions';
import { useProfileAddressActions } from '../hooks/useProfileAddressActions';
import { useProfilePetActions } from '../hooks/useProfilePetActions';
import { useProfileAccountActions } from '../hooks/useProfileAccountActions';
import { useProfileOrderActions } from '../hooks/useProfileOrderActions';
import { ProfileOrdersPanel } from './profileOrdersPanel';
import { ProfileAddressesPanel } from './profileAddressesPanel';
import { ProfilePetsPanel } from './profilePetsPanel';
import { ProfileOrderDetailModal } from './profileOrderDetailModal';
import { ProfileReturnModals } from './profileReturnModals';
import { ProfilePaymentModal } from './profilePaymentModal';
import { ProfileInfoPanel } from './profileInfoPanel';
import { ProfileAccountModals } from './profileAccountModals';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProfileTab = normalizeProfileTab(searchParams.get('tab'));
  const paymentReturnStatus = String(searchParams.get('payment') || '').trim().toLowerCase();
  const paymentReturnOrderNo = normalizeProfileOrderNo(searchParams.get('orderNo'));
  const paymentReturnOrderId = Number(searchParams.get('orderId') || '');
  const { t, language } = useLanguage();
  const profileLocalizationRef = useRef({ t, language });
  profileLocalizationRef.current = { t, language };
  usePageTitle(t('pages.profile.title'));
  useDocumentMeta({
    title: t('pages.profile.title'),
    description: t('common.siteDescription'),
    path: '/profile',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const { config: appConfig } = useAppConfig();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderCustomer[]>([]);
  const [ordersInitialLoadComplete, setOrdersInitialLoadComplete] = useState(false);
  const [ordersLoadFailed, setOrdersLoadFailed] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoadFailed, setAddressesLoadFailed] = useState(false);
  const addressesStale = addressesLoadFailed && addresses.length > 0;
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(() => Boolean(getLocalStorageItem('token')));
  const [authRequired, setAuthRequired] = useState(() => !getLocalStorageItem('token'));
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const [editingPet, setEditingPet] = useState<PetProfile | null>(null);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderCustomer | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemCustomer[]>([]);
  const [orderItemsByOrderId, setOrderItemsByOrderId] = useState<Record<number, OrderItemCustomer[]>>({});
  const [orderItemPreviewFailedByOrderId, setOrderItemPreviewFailedByOrderId] = useState<Record<number, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentCustomer | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
  const [paymentChannelsLoaded, setPaymentChannelsLoaded] = useState(false);
  const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);
  const [paymentChannelsError, setPaymentChannelsError] = useState('');
  const [orderPayments, setOrderPayments] = useState<PaymentCustomer[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [returnShipmentOrder, setReturnShipmentOrder] = useState<OrderCustomer | null>(null);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState('');
  const [submittingReturnShipment, setSubmittingReturnShipment] = useState(false);
  const [returnRequestOrder, setReturnRequestOrder] = useState<OrderCustomer | null>(null);
  const [receiptConfirmOrder, setReceiptConfirmOrder] = useState<OrderCustomer | null>(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileEmailCodeSending, setProfileEmailCodeSending] = useState(false);
  const [profileEmailCodeCountdown, setProfileEmailCodeCountdown] = useState(0);
  const [profileEmailCodeTtlMinutes, setProfileEmailCodeTtlMinutes] = useState(0);
  const [profileEmailCodeSentTo, setProfileEmailCodeSentTo] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [regionOptionsLanguage, setRegionOptionsLanguage] = useState('');
  const [regionOptionsLoading, setRegionOptionsLoading] = useState(false);
  const [petSubmitting, setPetSubmitting] = useState(false);
  const [trackingVisible, setTrackingVisible] = useState(false);
  const [selectedTrackingNumber, setSelectedTrackingNumber] = useState('');
  const [selectedTrackingCarrierCode, setSelectedTrackingCarrierCode] = useState<string | undefined>();
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<number | undefined>();
  const isPaymentReturnSuccess = paymentReturnStatus === 'success';
  const isPaymentReturnIncomplete = paymentReturnStatus === 'cancelled'
    || paymentReturnStatus === 'canceled'
    || paymentReturnStatus === 'failed';
  const [profileActiveTab, setProfileActiveTab] = useState(requestedProfileTab || ((isPaymentReturnSuccess || isPaymentReturnIncomplete) ? 'orders' : 'info'));
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderSearchText, setOrderSearchText] = useState('');
  // Notification/order deep-link: open orders tab and prefill search when orderNo is present without payment return status.
  useEffect(() => {
    if (paymentReturnStatus) return;
    const deepLinkOrderNo = paymentReturnOrderNo;
    if (!deepLinkOrderNo) return;
    setProfileActiveTab('orders');
    setOrderSearchText((current) => (current.trim() ? current : deepLinkOrderNo));
  }, [paymentReturnOrderNo, paymentReturnStatus]);

  const handledPaymentReturnRef = useRef('');
  const autoResumePaymentReturnRef = useRef('');
  const paymentReturnSyncSeqRef = useRef(0);
  const ordersRef = useRef<OrderCustomer[]>([]);
  const mountedRef = useRef(false);
  const ordersRequestSeqRef = useRef(0);
  const orderDetailRequestSeqRef = useRef(0);
  const continuingPaymentRef = useRef<number | null>(null);
  const profileOrderItemName = (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  );
  const [editForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [addressForm] = Form.useForm();
  const [petForm] = Form.useForm();
  const watchedProfileEmail = Form.useWatch('email', editForm);
  const emailCodeEnabled = appConfig.emailCodeEnabled === true;
  const profileEmailChanged = normalizeProfileEmail(watchedProfileEmail) !== normalizeProfileEmail(user?.email);
  const formatKnownStatusLabel = useCallback((status: string | undefined, knownStatuses: Set<string>) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = normalizeStatusCode(rawStatus);
    if (!normalizedStatus) return t('common.unknown');
    if (knownStatuses.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
    return rawStatus;
  }, [t]);
  const formatOrderStatusLabel = useCallback(
    (status?: string) => formatKnownStatusLabel(status, ORDER_STATUS_LABEL_KEYS),
    [formatKnownStatusLabel],
  );
  const formatPaymentStatusLabel = useCallback(
    (status?: string) => formatKnownStatusLabel(status, PAYMENT_STATUS_LABEL_KEYS),
    [formatKnownStatusLabel],
  );
  const getKnownStatusColor = useCallback((status: string | undefined, knownStatuses: Set<string>) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!knownStatuses.has(normalizedStatus)) return 'default';
    return statusColors[normalizedStatus] || 'default';
  }, []);
  const getOrderStatusColor = useCallback(
    (status?: string) => getKnownStatusColor(status, ORDER_STATUS_LABEL_KEYS),
    [getKnownStatusColor],
  );
  const getPaymentStatusColor = useCallback(
    (status?: string) => getKnownStatusColor(status, PAYMENT_STATUS_LABEL_KEYS),
    [getKnownStatusColor],
  );

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
  }, []);

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
  }, []);

  const syncPaymentReturnState = useCallback(async (order: OrderCustomer) => {
    const syncSeq = paymentReturnSyncSeqRef.current + 1;
    paymentReturnSyncSeqRef.current = syncSeq;
    const isCurrentPaymentReturnSync = () => mountedRef.current && paymentReturnSyncSeqRef.current === syncSeq;
    const paymentListRes = await paymentApi.syncByOrder(order.id);
    if (!isCurrentPaymentReturnSync()) return;
    const mergedPayments = paymentListRes.data || [];
    const latestPayment = mergedPayments[0] || null;
    setOrderPayments(mergedPayments);
    if (latestPayment) {
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(getPreferredPaymentChannel(paymentChannels, latestPayment.channel));
    }
    await fetchOrders();
    if (!isCurrentPaymentReturnSync()) return;
    const { t: latestT } = profileLocalizationRef.current;
    if (mergedPayments.some((payment) => normalizeStatusCode(payment.status) === 'RECONCILE_REQUIRED')) {
      announceAccessibleMessage(latestT('pages.profile.paymentReturnReconcileRequired'), 'warning');
    } else if (mergedPayments.some((payment) => normalizeStatusCode(payment.status) === 'PAID')) {
      announceAccessibleMessage(latestT('pages.profile.paymentReturnSynced'), 'success');
    } else {
      announceAccessibleMessage(latestT('pages.profile.paymentReturnPending'), 'info');
    }
  }, [fetchOrders, paymentChannels]);

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
  }, []);

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
  }, []);

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
  }, [fetchAddresses, fetchOrders, fetchPetProfiles, fetchUserInfo]);

  useEffect(() => {
    if (!addressModalVisible) return;
    const timer = window.setTimeout(() => {
      document.querySelector('.profile-address-modal .ant-modal-body')?.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addressModalVisible, editingAddress?.id]);

  useEffect(() => {
    if (requestedProfileTab || isPaymentReturnSuccess || isPaymentReturnIncomplete) {
      const nextTab = requestedProfileTab || 'orders';
      setProfileActiveTab((current) => nextTab === current ? current : nextTab);
    }
  }, [isPaymentReturnIncomplete, isPaymentReturnSuccess, requestedProfileTab]);

  useEffect(() => {
    if (paymentReturnStatus !== 'success') return;
    if (!paymentChannelsLoaded) return;
    if (!ordersInitialLoadComplete) return;
    const targetOrderId = Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0 ? paymentReturnOrderId : null;
    const targetOrder = ordersRef.current.find((order) => paymentReturnOrderNo && normalizeProfileOrderNo(order.orderNo) === paymentReturnOrderNo)
      || ordersRef.current.find((order) => targetOrderId !== null && order.id === targetOrderId);
    if (!targetOrder) return;
    const returnKey = `${paymentReturnStatus}:${targetOrder.id}:${paymentReturnOrderNo || targetOrder.orderNo || ''}`;
    if (handledPaymentReturnRef.current === returnKey) return;
    handledPaymentReturnRef.current = returnKey;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    nextParams.delete('orderNo');
    nextParams.delete('orderId');
    if (!normalizeProfileTab(nextParams.get('tab'))) {
      nextParams.set('tab', 'orders');
    }
    setSearchParams(nextParams, { replace: true });
    syncPaymentReturnState(targetOrder).catch(() => {
      if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {
        announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.paymentReturnSyncFailed'), 'error');
        fetchOrders();
      }
    });
  }, [fetchOrders, ordersInitialLoadComplete, paymentChannelsLoaded, paymentReturnOrderId, paymentReturnOrderNo, paymentReturnStatus, searchParams, setSearchParams, syncPaymentReturnState]);

  useEffect(() => {
    if (!isPaymentReturnIncomplete) return;
    if (!ordersInitialLoadComplete) return;
    const returnKey = `incomplete:${paymentReturnStatus}:${paymentReturnOrderNo || paymentReturnOrderId || ''}`;
    if (handledPaymentReturnRef.current === returnKey) return;
    handledPaymentReturnRef.current = returnKey;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('payment');
    if (!normalizeProfileTab(nextParams.get('tab'))) {
      nextParams.set('tab', 'orders');
    }
    // Keep orderNo so orders list can surface the pending order when present.
    setSearchParams(nextParams, { replace: true });
    setProfileActiveTab('orders');
    setOrderStatusFilter('PENDING_PAYMENT');
    if (paymentReturnOrderNo) {
      setOrderSearchText(paymentReturnOrderNo);
    }
    const { t: latestT } = profileLocalizationRef.current;
    if (paymentReturnStatus === 'failed') {
      announceAccessibleMessage(paymentReturnOrderNo
        ? latestT('pages.profile.paymentReturnFailedOrder', { orderNo: paymentReturnOrderNo })
        : latestT('pages.profile.paymentReturnFailed'), 'error');
    } else {
      announceAccessibleMessage(paymentReturnOrderNo
        ? latestT('pages.profile.paymentReturnCancelledOrder', { orderNo: paymentReturnOrderNo })
        : latestT('pages.profile.paymentReturnCancelled'), 'warning');
    }
  }, [isPaymentReturnIncomplete, ordersInitialLoadComplete, paymentReturnOrderId, paymentReturnOrderNo, paymentReturnStatus, searchParams, setSearchParams]);

  useEffect(() => {
    if (profileEmailCodeCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setProfileEmailCodeCountdown((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [profileEmailCodeCountdown]);

  const {
    handleContinuePayment,
    handleRefreshPayment,
    loadPaymentChannels,
    refreshPaymentState,
  } = useProfilePaymentActions({
    continuingPaymentRef,
    fetchOrders,
    language,
    mountedRef,
    paymentChannels,
    profileLocalizationRef,
    selectedOrder,
    selectedPayment,
    selectedPaymentMethod,
    setOrderPayments,
    setPayingOrderId,
    setPaymentChannels,
    setPaymentChannelsError,
    setPaymentChannelsLoaded,
    setPaymentChannelsLoading,
    setPaymentModalVisible,
    setRefreshingPayment,
    setSelectedOrder,
    setSelectedPayment,
    setSelectedPaymentMethod,
    t,
  });

  const {
    closeAddressModal,
    handleDeleteAddress,
    handleSaveAddress,
    handleSetDefault,
    loadProfileRegionOptions,
    openAddressModal,
  } = useProfileAddressActions({
    addressForm,
    addressSubmitting,
    addressesStale,
    editingAddress,
    fetchAddresses,
    language,
    mountedRef,
    regionOptions,
    regionOptionsLanguage,
    setAddressModalVisible,
    setAddressSubmitting,
    setEditingAddress,
    setRegionOptions,
    setRegionOptionsLanguage,
    setRegionOptionsLoading,
    t,
  });

  const {
    closePetModal,
    handleDeletePet,
    handleSavePet,
    openPetModal,
  } = useProfilePetActions({
    editingPet,
    fetchPetProfiles,
    language,
    petForm,
    petSubmitting,
    setEditingPet,
    setPetModalVisible,
    setPetSubmitting,
    t,
  });

  const {
    closePasswordModal,
    handleChangePassword,
    handleEditProfile,
    handleSendProfileEmailCode,
    openEditModal,
  } = useProfileAccountActions({
    editForm,
    emailCodeEnabled,
    fetchUserInfo,
    language,
    passwordForm,
    passwordSubmitting,
    setEditModalVisible,
    setPasswordModalVisible,
    setPasswordSubmitting,
    setProfileEmailCodeCountdown,
    setProfileEmailCodeSending,
    setProfileEmailCodeSentTo,
    setProfileEmailCodeTtlMinutes,
    setProfileSubmitting,
    t,
    user,
  });

  const {
    confirmReceiptOrder,
    handleCancelOrder,
    handleConfirmReceipt,
    handleReorder,
    handleReturnOrder,
    handleSubmitReturnShipment,
    handleTrackShipment,
    handleViewOrder,
    openProductDetail,
    openReturnModal,
  } = useProfileOrderActions({
    fetchOrders,
    language,
    mountedRef,
    navigate,
    orderDetailRequestSeqRef,
    orderItems,
    returnReason,
    returnRequestOrder,
    returnShipmentOrder,
    returnTrackingNumber,
    setConfirmingReceipt,
    setOrderDetailVisible,
    setOrderItems,
    setReceiptConfirmOrder,
    setReordering,
    setRequestingReturn,
    setReturnReason,
    setReturnRequestOrder,
    setReturnShipmentOrder,
    setReturnTrackingNumber,
    setSelectedOrder,
    setSelectedTrackingCarrierCode,
    setSelectedTrackingNumber,
    setSelectedTrackingOrderId,
    setSubmittingReturnShipment,
    setTrackingVisible,
    t,
  });

  // After cancelled/failed gateway return, open continue-payment for the matching pending order.
  useEffect(() => {
    if (!ordersInitialLoadComplete || !paymentChannelsLoaded) return;
    if (!paymentReturnOrderNo && !(Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0)) return;
    // Resume is keyed off the incomplete return handling ref once URL payment= is cleared.
    const handledKey = handledPaymentReturnRef.current;
    if (!handledKey.startsWith('incomplete:')) return;

    const targetOrderId = Number.isFinite(paymentReturnOrderId) && paymentReturnOrderId > 0 ? paymentReturnOrderId : null;
    const targetOrder = ordersRef.current.find((order) => paymentReturnOrderNo && normalizeProfileOrderNo(order.orderNo) === paymentReturnOrderNo)
      || ordersRef.current.find((order) => targetOrderId !== null && order.id === targetOrderId);
    if (!targetOrder || normalizeStatusCode(targetOrder.status) !== 'PENDING_PAYMENT') return;

    const resumeKey = `resume:${handledKey}:${targetOrder.id}`;
    if (autoResumePaymentReturnRef.current === resumeKey) return;
    autoResumePaymentReturnRef.current = resumeKey;
    void handleContinuePayment(targetOrder);
  }, [handleContinuePayment, ordersInitialLoadComplete, paymentChannelsLoaded, paymentReturnOrderId, paymentReturnOrderNo]);

  useEffect(() => {
    const orderId = selectedOrder?.id;
    if (!paymentModalVisible || !orderId) return;
    let polling = false;
    let disposed = false;
    const isActive = () => !disposed && mountedRef.current;
    const syncPaymentState = async () => {
      if (polling || !isActive()) return;
      polling = true;
      try {
        await refreshPaymentState(orderId, isActive);
      } catch (error) {
        if (isActive()) {
          reportNonBlockingError('Profile.pollPaymentState', error);
        }
      } finally {
        polling = false;
      }
    };
    syncPaymentState();
    const timer = window.setInterval(syncPaymentState, 5000);
    return () => {
      disposed = true;
      polling = false;
      window.clearInterval(timer);
    };
  }, [paymentModalVisible, refreshPaymentState, selectedOrder?.id]);

  useEffect(() => {
    let disposed = false;
    void loadPaymentChannels(() => !disposed && mountedRef.current);
    return () => {
      disposed = true;
    };
  }, [loadPaymentChannels]);

  const openSupport = useCallback(() => {
    if (!getLocalStorageItem('token')) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    dispatchDomEvent('shop:open-support');
  }, [navigate, t]);

  const afterSaleStatuses = ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED'];
  const orderFilterStatusMap: Record<string, string[]> = {
    PENDING_PAYMENT: ['PENDING_PAYMENT'],
    PENDING_SHIPMENT: ['PENDING_SHIPMENT'],
    SHIPPED: ['SHIPPED'],
    COMPLETED: ['COMPLETED'],
    RETURN_APPROVED: ['RETURN_APPROVED'],
    AFTER_SALE: afterSaleStatuses,
    CANCELLED: ['CANCELLED'],
  };
  const isReturnableOrder = (order: OrderCustomer) => order.status === 'COMPLETED' && Boolean(order.returnable);
  const orderStatusTabs = [
    { key: 'all', label: t('pages.profile.allOrders') },
    { key: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT'), statuses: orderFilterStatusMap.PENDING_PAYMENT },
    { key: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT'), statuses: orderFilterStatusMap.PENDING_SHIPMENT },
    { key: 'SHIPPED', label: t('status.SHIPPED'), statuses: orderFilterStatusMap.SHIPPED },
    { key: 'COMPLETED', label: t('status.COMPLETED'), statuses: orderFilterStatusMap.COMPLETED },
    { key: 'RETURNABLE', label: t('pages.profile.afterSaleReturnable') },
    { key: 'AFTER_SALE', label: t('pages.profile.afterSale'), statuses: orderFilterStatusMap.AFTER_SALE },
    { key: 'CANCELLED', label: t('status.CANCELLED'), statuses: orderFilterStatusMap.CANCELLED },
  ];
  const matchesOrderFilter = (order: OrderCustomer) => {
    if (orderStatusFilter === 'all') return true;
    if (orderStatusFilter === 'RETURNABLE') return isReturnableOrder(order);
    return orderFilterStatusMap[orderStatusFilter]?.includes(order.status) || false;
  };
  const normalizedSearchText = orderSearchText.trim().toLowerCase();
  const filteredOrders = sortOrdersNewestFirst(orders.filter(matchesOrderFilter))
    .filter((order) => {
      if (!normalizedSearchText) return true;
      const items = orderItemsByOrderId[order.id] || [];
      return [
        order.orderNo,
        order.id,
        order.trackingNumber,
        order.shippingAddress,
        ...items.map((item) => profileOrderItemName(item)),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearchText));
    });
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const { formatMoney, currency } = useMarket();
  const paymentOptions = createPaymentMethodOptions(t, paymentChannels, { currency });
  const paymentMethodDetails = createPaymentMethodDetails(paymentChannels, { currency });
  const selectedPaymentMethodDetail = paymentMethodDetails.find((method) => method.value === selectedPaymentMethod);
  const selectedPaymentStatus = normalizeStatusCode(selectedPayment?.status);
  const selectedPaymentPaid = selectedPaymentStatus === 'PAID';
  const selectedPaymentFailed = selectedPaymentStatus === 'FAILED';
  const selectedPaymentReconcileRequired = selectedPaymentStatus === 'RECONCILE_REQUIRED';
  const selectedPaymentRecovery = getPaymentRecoveryState(selectedPayment);
  const selectedPaymentExpiredOrFailed = selectedPaymentFailed || selectedPaymentRecovery.isExpired;
  const pendingPaymentCount = orders.filter((order) => order.status === 'PENDING_PAYMENT').length;
  const inTransitCount = orders.filter((order) => order.status === 'SHIPPED').length;
  const afterSaleCount = orders.filter((order) => afterSaleStatuses.includes(order.status)).length;
  const returnableOrdersCount = orders.filter(isReturnableOrder).length;
  const returnApprovedCount = orders.filter((order) => order.status === 'RETURN_APPROVED').length;
  const returnShippedCount = orders.filter((order) => order.status === 'RETURN_SHIPPED').length;
  const returnRefundingCount = orders.filter((order) => order.status === 'RETURN_REFUNDING').length;
  const ordersStale = ordersLoadFailed && orders.length > 0;
  const defaultAddressReady = addresses.some((address) => address.isDefault);
  const completedPetProfiles = petProfiles.filter((pet) => pet.name && pet.petType && pet.size && pet.weight && pet.birthday).length;
  const petProfileProgress = petProfiles.length > 0 ? Math.round((completedPetProfiles / petProfiles.length) * 100) : 0;
  const petsMissingBirthdayCount = petProfiles.filter((pet) => !pet.birthday).length;
  const petsMissingFitCount = petProfiles.filter((pet) => !pet.weight || !pet.size).length;
  const completeAddressCount = addresses.filter(isCompleteProfileAddress).length;
  const addressesMissingPhoneCount = addresses.filter((address) => !isLikelyProfilePhone(address.phone)).length;
  const addressesMissingDetailCount = addresses.filter((address) => !isCompleteProfileAddress(address)).length;
  const addressReadinessProgress = addresses.length > 0
    ? Math.round(((completeAddressCount + (defaultAddressReady ? 1 : 0)) / (addresses.length + 1)) * 100)
    : 0;
  const accountHealthSignals = [
    Boolean(user?.email),
    Boolean(user?.phone),
    defaultAddressReady,
    petProfiles.length > 0,
  ];
  const accountHealthScore = Math.round((accountHealthSignals.filter(Boolean).length / accountHealthSignals.length) * 100);
  const nextReturnDeadline = useMemo(() => {
    const deadlines = orders
      .filter((order) => isReturnableOrder(order) && order.returnDeadline)
      .map((order) => new Date(order.returnDeadline as string))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => left.getTime() - right.getTime());
    return deadlines[0] ? deadlines[0].toLocaleDateString(dateLocale) : '';
  }, [dateLocale, orders]);
  const afterSaleFocusText = ordersStale
    ? t('pages.profile.ordersStaleAfterSaleText')
    : returnApprovedCount > 0
      ? t('pages.profile.afterSaleFocusShipment', { count: returnApprovedCount })
      : returnShippedCount > 0
        ? t('pages.profile.afterSaleFocusRefund', { count: returnShippedCount })
        : returnRefundingCount > 0
          ? t('pages.profile.afterSaleFocusRefunding', { count: returnRefundingCount })
          : returnableOrdersCount > 0
            ? nextReturnDeadline
              ? t('pages.profile.afterSaleFocusWindowWithDate', { count: returnableOrdersCount, date: nextReturnDeadline })
              : t('pages.profile.afterSaleFocusWindow', { count: returnableOrdersCount })
            : t('pages.profile.afterSaleFocusHealthy');
  const petCompletenessText = petProfiles.length === 0
    ? t('pages.profile.petCompletenessEmpty')
    : petProfileProgress === 100
      ? t('pages.profile.petCompletenessReady')
      : t('pages.profile.petCompletenessImprove', { count: petProfiles.length - completedPetProfiles });
  const petProfileFocus = petProfiles.find((pet) => !pet.birthday || !pet.weight || !pet.size || !pet.breed) || null;
  const petProfileFocusText = petProfiles.length === 0
    ? t('pages.profile.petProfileActionEmpty')
    : petProfileFocus
      ? t('pages.profile.petProfileActionImprove', {
        name: petProfileFocus.name || t('pages.profile.petName'),
        fields: [
          !petProfileFocus.birthday ? t('pages.profile.petBirthday') : null,
          !petProfileFocus.weight ? t('pages.profile.petWeight') : null,
          !petProfileFocus.size ? t('pages.profile.petSize') : null,
          !petProfileFocus.breed ? t('pages.profile.petBreed') : null,
        ].filter(Boolean).join(', '),
      })
      : t('pages.profile.petProfileActionReady');
  const addressReadinessText = addresses.length === 0
    ? t('pages.profile.addressReadinessEmpty')
    : addressReadinessProgress === 100
      ? t('pages.profile.addressReadinessReady')
      : t('pages.profile.addressReadinessImprove');
  const petTypeLabel = (value?: string) => {
    if (value === 'DOG') return t('pages.profile.petDog');
    if (value === 'CAT') return t('pages.profile.petCat');
    if (value === 'SMALL_PET') return t('pages.profile.petSmall');
    return value || t('common.unset');
  };
  const petSizeLabel = (value?: string) => {
    if (value === 'SMALL') return t('pages.profile.petSizeSmall');
    if (value === 'MEDIUM') return t('pages.profile.petSizeMedium');
    if (value === 'LARGE') return t('pages.profile.petSizeLarge');
    return value || t('common.unset');
  };
  const profilePetShoppingFocus = petProfiles.find((pet) => pet.petType && (pet.size || pet.breed)) || petProfiles[0] || null;
  const petShoppingSizeValue = (value?: string) => {
    if (value === 'SMALL') return 'Small';
    if (value === 'MEDIUM') return 'Medium';
    if (value === 'LARGE') return 'Large';
    return '';
  };
  const petShoppingKeyword = (pet?: PetProfile | null) => {
    if (!pet) return '';
    if (pet.breed) return pet.breed;
    if (pet.petType === 'DOG') return 'dog';
    if (pet.petType === 'CAT') return 'cat';
    return 'small pet';
  };
  const openPetShoppingPath = (pet?: PetProfile | null) => {
    const targetPet = pet || profilePetShoppingFocus;
    const params = new URLSearchParams();
    const keywordValue = petShoppingKeyword(targetPet);
    const sizeValue = petShoppingSizeValue(targetPet?.size);
    if (keywordValue) params.set('keyword', keywordValue);
    if (sizeValue) params.set('petSize', sizeValue);
    params.set('sort', 'personalized-desc');
    navigate(`/products?${params.toString()}`);
  };
  const getOrderActionHint = (order: OrderCustomer): OrderActionHint => {
    const returnDeadline = order.returnDeadline ? new Date(order.returnDeadline).toLocaleDateString(dateLocale) : '';
    if (ordersStale) {
      return {
        tone: 'neutral',
        title: t('pages.profile.nextOrderStaleTitle'),
        text: t('pages.profile.nextOrderStaleText'),
      };
    }
    if (order.status === 'PENDING_PAYMENT') {
      return {
        tone: 'pay',
        title: t('pages.profile.nextPayTitle'),
        text: t('pages.profile.nextPayText'),
      };
    }
    if (order.status === 'PENDING_SHIPMENT') {
      return {
        tone: 'wait',
        title: t('pages.profile.nextShipTitle'),
        text: t('pages.profile.nextShipText'),
      };
    }
    if (order.status === 'SHIPPED') {
      return {
        tone: 'ship',
        title: t('pages.profile.nextReceiveTitle'),
        text: order.trackingNumber
          ? t('pages.profile.nextReceiveWithTrackingText', { number: order.trackingNumber })
          : t('pages.profile.nextReceiveText'),
      };
    }
    if (isReturnableOrder(order)) {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnWindowTitle'),
        text: returnDeadline
          ? t('pages.profile.nextReturnWindowText', { date: returnDeadline })
          : t('pages.profile.nextReturnWindowNoDateText'),
      };
    }
    if (order.status === 'RETURN_REQUESTED') {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnReviewTitle'),
        text: t('pages.profile.nextReturnReviewText'),
      };
    }
    if (order.status === 'RETURN_APPROVED') {
      return {
        tone: 'return',
        title: t('pages.profile.nextReturnShipTitle'),
        text: t('pages.profile.nextReturnShipText'),
      };
    }
    if (order.status === 'RETURN_SHIPPED' || order.status === 'RETURN_REFUNDING') {
      return {
        tone: 'return',
        title: t('pages.profile.nextRefundTitle'),
        text: t('pages.profile.nextRefundText'),
      };
    }
    if (order.status === 'RETURNED') {
      return {
        tone: 'done',
        title: t('pages.profile.nextReturnedTitle'),
        text: order.refundedAt
          ? t('pages.profile.nextReturnedWithRefundText', { date: new Date(order.refundedAt).toLocaleDateString(dateLocale) })
          : t('pages.profile.nextReturnedText'),
      };
    }
    if (order.status === 'COMPLETED') {
      return {
        tone: 'done',
        title: t('pages.profile.nextCompletedTitle'),
        text: t('pages.profile.nextCompletedText'),
      };
    }
    if (order.status === 'CANCELLED') {
      return {
        tone: 'neutral',
        title: t('pages.profile.nextCancelledTitle'),
        text: t('pages.profile.nextCancelledText'),
      };
    }
    return {
      tone: 'neutral',
      title: t('pages.profile.nextOrderTitle'),
      text: t('pages.profile.nextOrderText'),
    };
  };
  const syncProfileTabToUrl = useCallback((tabKey: string) => {
    const nextTab = normalizeProfileTab(tabKey) || 'info';
    setProfileActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'info') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openProfileTab = (tabKey: string) => {
    syncProfileTabToUrl(tabKey);
    if (tabKey === 'orders') {
      setOrderStatusFilter('all');
    }
  };
  const openAddressSetup = () => {
    syncProfileTabToUrl('addresses');
    openAddressModal();
  };
  const openOrdersWithFilter = (filter: string) => {
    syncProfileTabToUrl('orders');
    setOrderStatusFilter(filter);
  };

  if (authRequired) {
    const loginLabel = t('pages.profile.authGateLogin');
    const registerLabel = t('pages.profile.authGateRegister');
    return (
      <div
        className={`profile-page profile-page--${language} profile-page--empty profile-page--authGate`}
        data-auth-gate="profile-login-required"
      >
        <PageEmpty
          className="profile-page__authGate"
          description={(
            <div className="profile-page__authGateCopy">
              <h1 className="profile-page__title">{t('pages.profile.authGateTitle')}</h1>
              <div className="profile-page__authGateHint">{t('pages.profile.authGateHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'login',
              label: loginLabel,
              onClick: () => navigate(buildLoginUrl('/profile')),
            },
            {
              key: 'register',
              label: registerLabel,
              onClick: () => navigate('/register?redirect=%2Fprofile'),
              type: 'default',
            },
            {
              key: 'orders',
              label: t('pages.profile.authGateTrackOrder'),
              onClick: () => navigate('/track-order'),
              type: 'default',
            },
            {
              key: 'browse',
              label: t('pages.cart.browse'),
              onClick: () => navigate('/products'),
              type: 'default',
            },
            {
              key: 'coupons',
              label: t('pages.profile.emptyOrdersCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
          ]}
        />
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="profile-loading" role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
        <span className="profile-page__spinner" aria-hidden="true" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  const selectedOrderLabel = selectedOrder ? profileOrderLabel(selectedOrder) : '';
  const selectedOrderTrackActionLabel = selectedOrder?.trackingNumber
    ? `${t('pages.adminOrders.track')}: ${selectedOrderLabel} / ${selectedOrder.trackingNumber}`
    : `${t('pages.adminOrders.track')}: ${selectedOrderLabel}`;
  const profileTargetLabel = user.username || user.email || user.phone || t('pages.profile.title');
  const editProfileActionLabel = `${t('common.save')}: ${t('pages.profile.editProfileTitle')}, ${profileTargetLabel}`;
  const changePasswordActionLabel = `${t('pages.profile.changePassword')}: ${profileTargetLabel}`;
  const addressEditorTargetLabel = editingAddress
    ? [editingAddress.recipientName, editingAddress.phone, editingAddress.address].filter(Boolean).join(' / ') || `#${editingAddress.id}`
    : t('pages.profile.addAddressTitle');
  const saveAddressActionLabel = `${t('common.save')}: ${addressEditorTargetLabel}`;
  const profilePhoneInputLabel = `${t('pages.profile.editProfileTitle')}: ${t('pages.profile.phone')}`;
  const addressPhoneInputLabel = `${saveAddressActionLabel}: ${t('pages.profile.phone')}`;
  const addressRegionInputLabel = `${saveAddressActionLabel}: ${t('pages.profile.regionRequired')}`;
  const petEditorTargetLabel = editingPet?.name || (editingPet ? `#${editingPet.id}` : t('pages.profile.addPet'));
  const savePetActionLabel = `${t('common.save')}: ${petEditorTargetLabel}`;
  const returnShipmentOrderLabel = returnShipmentOrder ? profileOrderLabel(returnShipmentOrder) : t('pages.profile.submitReturnShipment');
  const submitReturnShipmentActionLabel = `${t('pages.profile.submitReturnShipment')}: ${returnShipmentOrderLabel}`;
  const returnRequestOrderLabel = returnRequestOrder ? profileOrderLabel(returnRequestOrder) : t('pages.profile.returnOrder');
  const submitReturnRequestActionLabel = `${t('pages.profile.returnOrder')}: ${returnRequestOrderLabel}`;
  const paymentOrderLabel = selectedOrder ? profileOrderLabel(selectedOrder) : t('pages.profile.continuePay');
  const openPaymentActionLabel = `${t('pages.checkout.openPayment')}: ${paymentOrderLabel}`;
  const refreshPaymentActionLabel = `${t('pages.profile.refreshPayment')}: ${paymentOrderLabel}`;
  const retryPaymentChannelsActionLabel = `${t('common.retry')}: ${paymentOrderLabel} ${t('pages.checkout.paymentMethod')}`;
  const closePaymentActionLabel = `${t('common.cancel')}: ${t('pages.profile.continuePay')}, ${paymentOrderLabel}`;
  const profilePendingPayActionLabel = `${t('pages.profile.actionPendingPay')}: ${pendingPaymentCount}`;
  const profileInTransitActionLabel = `${t('pages.profile.actionInTransit')}: ${inTransitCount}`;
  const profileAfterSaleActionLabel = `${t('pages.profile.actionAfterSale')}: ${afterSaleCount}`;
  const profileCompletionActionLabel = defaultAddressReady
    ? `${t('pages.profile.actionPetProfile')}: ${petProfileProgress}%`
    : `${t('pages.profile.actionDefaultAddress')}: ${addressReadinessProgress}%`;
  const currentOrderFilterLabel = orderStatusTabs.find((tab) => tab.key === orderStatusFilter)?.label || t('pages.profile.allOrders');
  const orderListContextLabel = `${t('pages.profile.orders', { count: orders.length })}: ${currentOrderFilterLabel}, ${filteredOrders.length}`;
  const orderSearchInputLabel = `${t('common.search')}: ${orderListContextLabel}`;
  const reorderSelectedOrderActionLabel = `${t('pages.profile.reorder')}: ${selectedOrderLabel}`;
  const returnTrackingInputLabel = `${t('pages.profile.returnTrackingPlaceholder')}: ${returnShipmentOrderLabel}`;
  const returnReasonInputLabel = `${t('pages.profile.returnReasonPlaceholder')}: ${returnRequestOrderLabel}`;
  const paymentMethodSelectLabel = `${t('pages.checkout.paymentMethod')}: ${paymentOrderLabel}`;
  const paymentLinkActionLabel = `${t('pages.checkout.paymentLink')}: ${paymentOrderLabel}`;

  return (
    <div className={`profile-page profile-page--${language}`}>
      <div className="profile-overview">
        <div className="profile-overview__copy">
          <span className="profile-page__text profile-overview__eyebrow">{t('pages.profile.title')}</span>
          <h1 className="profile-page__title">{user.username}</h1>
          <span className="profile-page__text profile-overview__text">
            {defaultAddressReady ? petProfileFocusText : addressReadinessText}
          </span>
          <div className="profile-overview__actions">
            <ShopButton type="primary" onClick={() => openProfileTab('orders')}>
              {t('pages.profile.orders', { count: orders.length })}
            </ShopButton>
            <ShopButton onClick={() => (defaultAddressReady ? openProfileTab('pets') : openAddressSetup())}>
              {defaultAddressReady
                ? (petProfiles.length > 0 ? t('pages.profile.completePetProfile') : t('pages.profile.addPet'))
                : t('pages.profile.addAddress')}
            </ShopButton>
          </div>
        </div>
        <div className="profile-overview__stats" aria-label={t('pages.profile.actionCenterTitle')}>
          <div className="profile-overview__stat">
            <strong>{orders.length}</strong>
            <span>{t('pages.profile.allOrders')}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{addresses.length}</strong>
            <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{petProfiles.length}</strong>
            <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{accountHealthScore}%</strong>
            <span>{t('pages.profile.accountHealthTitle')}</span>
          </div>
        </div>
      </div>

      <div className="profile-action-center" aria-label={t('pages.profile.actionCenterTitle')}>
        <div className="profile-action-center__intro">
          <ShopIcon path={SI.user} />
          <div>
            <span className="profile-page__text profile-page__text--strong">{t('pages.profile.actionCenterTitle')}</span>
            <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.actionCenterSubtitle')}</span>
          </div>
        </div>
        <div className="profile-action-center__cards">
          <button type="button" className="profile-action-center__card profile-action-center__card--pay" aria-label={profilePendingPayActionLabel} title={profilePendingPayActionLabel} onClick={() => openOrdersWithFilter('PENDING_PAYMENT')}>
            <ShopIcon path={SI.cart} />
            <span>
              <strong>{pendingPaymentCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionPendingPay')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" aria-label={profileInTransitActionLabel} title={profileInTransitActionLabel} onClick={() => openOrdersWithFilter('SHIPPED')}>
            <ShopIcon path={SI.environment} />
            <span>
              <strong>{inTransitCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionInTransit')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card profile-action-center__card--return" aria-label={profileAfterSaleActionLabel} title={profileAfterSaleActionLabel} onClick={() => openOrdersWithFilter('AFTER_SALE')}>
            <ShopIcon path={SI.heart} />
            <span>
              <strong>{afterSaleCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionAfterSale')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" aria-label={profileCompletionActionLabel} title={profileCompletionActionLabel} onClick={() => (defaultAddressReady ? openProfileTab('pets') : openAddressSetup())}>
            {defaultAddressReady ? <ShopIcon path={SI.heart} /> : <ShopIcon path={SI.environment} />}
            <span>
              <strong>{defaultAddressReady ? `${petProfileProgress}%` : '!'}</strong>
              <span className="profile-page__text">{defaultAddressReady ? t('pages.profile.actionPetProfile') : t('pages.profile.actionDefaultAddress')}</span>
            </span>
          </button>
        </div>
      </div>

      <div className="profile-mobile-entry" role="tablist" aria-orientation="horizontal" aria-label={t('pages.profile.title')}>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-orders"
          className={profileActiveTab === 'orders' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'orders'}
          tabIndex={profileActiveTab === 'orders' ? 0 : -1}
          onClick={() => openProfileTab('orders')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.cart} />
          <span>{t('pages.profile.orders', { count: orders.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-addresses"
          className={profileActiveTab === 'addresses' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'addresses'}
          tabIndex={profileActiveTab === 'addresses' ? 0 : -1}
          onClick={() => openProfileTab('addresses')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.environment} />
          <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-info"
          className={profileActiveTab === 'info' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'info'}
          tabIndex={profileActiveTab === 'info' ? 0 : -1}
          onClick={() => openProfileTab('info')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.user} />
          <span>{t('pages.profile.info')}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-pets"
          className={profileActiveTab === 'pets' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'pets'}
          tabIndex={profileActiveTab === 'pets' ? 0 : -1}
          onClick={() => openProfileTab('pets')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.heart} />
          <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
        </button>
      </div>

      <div className="profile-tabs">
        <div
          className="profile-tabs__nav"
          role="tablist"
          aria-orientation="horizontal"
          aria-label={t('pages.profile.title')}
        >
          <button
            type="button"
            role="tab"
            id="profile-tab-info"
            className={profileActiveTab === 'info' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'info'}
            aria-controls="profile-panel-info"
            tabIndex={profileActiveTab === 'info' ? 0 : -1}
            onClick={() => openProfileTab('info')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.info')}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-addresses"
            className={profileActiveTab === 'addresses' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'addresses'}
            aria-controls="profile-panel-addresses"
            tabIndex={profileActiveTab === 'addresses' ? 0 : -1}
            onClick={() => openProfileTab('addresses')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.addresses', { count: addresses.length })}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-orders"
            className={profileActiveTab === 'orders' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'orders'}
            aria-controls="profile-panel-orders"
            tabIndex={profileActiveTab === 'orders' ? 0 : -1}
            onClick={() => openProfileTab('orders')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.orders', { count: orders.length })}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-pets"
            className={profileActiveTab === 'pets' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'pets'}
            aria-controls="profile-panel-pets"
            tabIndex={profileActiveTab === 'pets' ? 0 : -1}
            onClick={() => openProfileTab('pets')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.pets', { count: petProfiles.length })}</span>
          </button>
        </div>
        <div className="profile-tabs__panels">
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-info"
          aria-labelledby="profile-tab-info"
          hidden={profileActiveTab !== 'info'}
        >
          <ProfileInfoPanel
            accountHealthScore={accountHealthScore}
            addresses={addresses}
            defaultAddressReady={defaultAddressReady}
            openEditModal={openEditModal}
            petProfiles={petProfiles}
            setPasswordModalVisible={setPasswordModalVisible}
            t={t}
            user={user}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-addresses"
          aria-labelledby="profile-tab-addresses"
          hidden={profileActiveTab !== 'addresses'}
        >
          <ProfileAddressesPanel
            addressReadinessProgress={addressReadinessProgress}
            addressReadinessText={addressReadinessText}
            addresses={addresses}
            addressesLoadFailed={addressesLoadFailed}
            addressesMissingDetailCount={addressesMissingDetailCount}
            addressesMissingPhoneCount={addressesMissingPhoneCount}
            addressesStale={addressesStale}
            defaultAddressReady={defaultAddressReady}
            fetchAddresses={fetchAddresses}
            handleDeleteAddress={handleDeleteAddress}
            handleSetDefault={handleSetDefault}
            navigate={navigate}
            openAddressModal={openAddressModal}
            t={t}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-orders"
          aria-labelledby="profile-tab-orders"
          hidden={profileActiveTab !== 'orders'}
        >
          <ProfileOrdersPanel
            afterSaleCount={afterSaleCount}
            afterSaleFocusText={afterSaleFocusText}
            afterSaleStatuses={afterSaleStatuses}
            confirmReceiptOrder={confirmReceiptOrder}
            dateLocale={dateLocale}
            fetchOrders={fetchOrders}
            filteredOrders={filteredOrders}
            formatMoney={formatMoney}
            formatOrderStatusLabel={formatOrderStatusLabel}
            getOrderActionHint={getOrderActionHint}
            getOrderStatusColor={getOrderStatusColor}
            handleCancelOrder={handleCancelOrder}
            handleContinuePayment={handleContinuePayment}
            handleTrackShipment={handleTrackShipment}
            handleViewOrder={handleViewOrder}
            isPaymentReturnIncomplete={isPaymentReturnIncomplete}
            isPaymentReturnSuccess={isPaymentReturnSuccess}
            isReturnableOrder={isReturnableOrder}
            language={language}
            navigate={navigate}
            openProductDetail={openProductDetail}
            openReturnModal={openReturnModal}
            openSupport={openSupport}
            orderItemPreviewFailedByOrderId={orderItemPreviewFailedByOrderId}
            orderItemsByOrderId={orderItemsByOrderId}
            orderListContextLabel={orderListContextLabel}
            orderSearchInputLabel={orderSearchInputLabel}
            orderSearchText={orderSearchText}
            orderStatusFilter={orderStatusFilter}
            orderStatusTabs={orderStatusTabs}
            orders={orders}
            ordersLoadFailed={ordersLoadFailed}
            ordersStale={ordersStale}
            payingOrderId={payingOrderId}
            paymentReturnOrderNo={paymentReturnOrderNo}
            paymentReturnStatus={paymentReturnStatus}
            profileOrderItemName={profileOrderItemName}
            returnApprovedCount={returnApprovedCount}
            returnableOrdersCount={returnableOrdersCount}
            setOrderSearchText={setOrderSearchText}
            setOrderStatusFilter={setOrderStatusFilter}
            setReturnShipmentOrder={setReturnShipmentOrder}
            setReturnTrackingNumber={setReturnTrackingNumber}
            t={t}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-pets"
          aria-labelledby="profile-tab-pets"
          hidden={profileActiveTab !== 'pets'}
        >
          <ProfilePetsPanel
            handleDeletePet={handleDeletePet}
            navigate={navigate}
            openPetModal={openPetModal}
            openPetShoppingPath={openPetShoppingPath}
            petCompletenessText={petCompletenessText}
            petProfileFocus={petProfileFocus}
            petProfileFocusText={petProfileFocusText}
            petProfileProgress={petProfileProgress}
            petProfiles={petProfiles}
            petSizeLabel={petSizeLabel}
            petTypeLabel={petTypeLabel}
            petsMissingBirthdayCount={petsMissingBirthdayCount}
            petsMissingFitCount={petsMissingFitCount}
            profilePetShoppingFocus={profilePetShoppingFocus}
            t={t}
          />
        </div>
        </div>
      </div>

      <ProfileAccountModals
        addressForm={addressForm}
        addressModalVisible={addressModalVisible}
        addressPhoneInputLabel={addressPhoneInputLabel}
        addressRegionInputLabel={addressRegionInputLabel}
        addressSubmitting={addressSubmitting}
        changePasswordActionLabel={changePasswordActionLabel}
        closeAddressModal={closeAddressModal}
        closePasswordModal={closePasswordModal}
        closePetModal={closePetModal}
        editForm={editForm}
        editModalVisible={editModalVisible}
        editProfileActionLabel={editProfileActionLabel}
        editingAddress={editingAddress}
        editingPet={editingPet}
        emailCodeEnabled={emailCodeEnabled}
        handleChangePassword={handleChangePassword}
        handleEditProfile={handleEditProfile}
        handleSaveAddress={handleSaveAddress}
        handleSavePet={handleSavePet}
        handleSendProfileEmailCode={handleSendProfileEmailCode}
        loadProfileRegionOptions={loadProfileRegionOptions}
        passwordForm={passwordForm}
        passwordModalVisible={passwordModalVisible}
        passwordSubmitting={passwordSubmitting}
        petForm={petForm}
        petModalVisible={petModalVisible}
        petSubmitting={petSubmitting}
        profilePhoneInputLabel={profilePhoneInputLabel}
        profileEmailChanged={profileEmailChanged}
        profileEmailCodeCountdown={profileEmailCodeCountdown}
        profileEmailCodeSending={profileEmailCodeSending}
        profileEmailCodeSentTo={profileEmailCodeSentTo}
        profileEmailCodeTtlMinutes={profileEmailCodeTtlMinutes}
        profileSubmitting={profileSubmitting}
        regionOptions={regionOptions}
        regionOptionsLoading={regionOptionsLoading}
        saveAddressActionLabel={saveAddressActionLabel}
        savePetActionLabel={savePetActionLabel}
        setAddressModalVisible={setAddressModalVisible}
        setEditModalVisible={setEditModalVisible}
        setEditingAddress={setEditingAddress}
        setEditingPet={setEditingPet}
        setPasswordModalVisible={setPasswordModalVisible}
        setPetModalVisible={setPetModalVisible}
        setProfileEmailCodeCountdown={setProfileEmailCodeCountdown}
        setProfileEmailCodeSentTo={setProfileEmailCodeSentTo}
        t={t}
        user={user}
      />

      <ProfileOrderDetailModal
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        formatOrderStatusLabel={formatOrderStatusLabel}
        getOrderStatusColor={getOrderStatusColor}
        handleReorder={handleReorder}
        handleTrackShipment={handleTrackShipment}
        language={language}
        openProductDetail={openProductDetail}
        orderDetailVisible={orderDetailVisible}
        orderItems={orderItems}
        profileOrderItemName={profileOrderItemName}
        reorderSelectedOrderActionLabel={reorderSelectedOrderActionLabel}
        reordering={reordering}
        selectedOrder={selectedOrder}
        selectedOrderTrackActionLabel={selectedOrderTrackActionLabel}
        setOrderDetailVisible={setOrderDetailVisible}
        t={t}
      />

      <ProfileReturnModals
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        handleReturnOrder={handleReturnOrder}
        handleSubmitReturnShipment={handleSubmitReturnShipment}
        requestingReturn={requestingReturn}
        returnReason={returnReason}
        returnReasonInputLabel={returnReasonInputLabel}
        returnRequestOrder={returnRequestOrder}
        returnShipmentOrder={returnShipmentOrder}
        returnTrackingInputLabel={returnTrackingInputLabel}
        returnTrackingNumber={returnTrackingNumber}
        selectedTrackingCarrierCode={selectedTrackingCarrierCode}
        selectedTrackingNumber={selectedTrackingNumber}
        selectedTrackingOrderId={selectedTrackingOrderId}
        setReturnReason={setReturnReason}
        setReturnRequestOrder={setReturnRequestOrder}
        setReturnShipmentOrder={setReturnShipmentOrder}
        setReturnTrackingNumber={setReturnTrackingNumber}
        setTrackingVisible={setTrackingVisible}
        submitReturnRequestActionLabel={submitReturnRequestActionLabel}
        submitReturnShipmentActionLabel={submitReturnShipmentActionLabel}
        submittingReturnShipment={submittingReturnShipment}
        t={t}
        trackingVisible={trackingVisible}
      />

      <ProfilePaymentModal
        closePaymentActionLabel={closePaymentActionLabel}
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        formatPaymentStatusLabel={formatPaymentStatusLabel}
        getPaymentStatusColor={getPaymentStatusColor}
        handleRefreshPayment={handleRefreshPayment}
        loadPaymentChannels={loadPaymentChannels}
        navigate={navigate}
        openPaymentActionLabel={openPaymentActionLabel}
        orderPayments={orderPayments}
        paymentChannelsError={paymentChannelsError}
        paymentChannelsLoading={paymentChannelsLoading}
        paymentLinkActionLabel={paymentLinkActionLabel}
        paymentMethodSelectLabel={paymentMethodSelectLabel}
        paymentModalVisible={paymentModalVisible}
        paymentOptions={paymentOptions}
        refreshPaymentActionLabel={refreshPaymentActionLabel}
        refreshingPayment={refreshingPayment}
        retryPaymentChannelsActionLabel={retryPaymentChannelsActionLabel}
        selectedOrder={selectedOrder}
        selectedPayment={selectedPayment}
        selectedPaymentExpiredOrFailed={selectedPaymentExpiredOrFailed}
        selectedPaymentFailed={selectedPaymentFailed}
        selectedPaymentMethod={selectedPaymentMethod}
        selectedPaymentMethodDetail={selectedPaymentMethodDetail}
        selectedPaymentPaid={selectedPaymentPaid}
        selectedPaymentReconcileRequired={selectedPaymentReconcileRequired}
        selectedPaymentRecovery={selectedPaymentRecovery}
        setPaymentModalVisible={setPaymentModalVisible}
        setSelectedPaymentMethod={setSelectedPaymentMethod}
        t={t}
      />
      <ShopConfirm
        open={Boolean(receiptConfirmOrder)}
        title={t('pages.profile.confirmReceiptTitle')}
        description={receiptConfirmOrder ? t('pages.profile.confirmReceiptContent', { orderNo: receiptConfirmOrder.orderNo || receiptConfirmOrder.id }) : undefined}
        okText={t('pages.profile.confirmReceipt')}
        cancelText={t('common.cancel')}
        confirmLoading={confirmingReceipt}
        okButtonProps={{
          'aria-label': receiptConfirmOrder ? `${t('pages.profile.confirmReceipt')}: ${profileOrderLabel(receiptConfirmOrder)}` : t('pages.profile.confirmReceipt'),
          title: receiptConfirmOrder ? `${t('pages.profile.confirmReceipt')}: ${profileOrderLabel(receiptConfirmOrder)}` : t('pages.profile.confirmReceipt'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
          title: `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
        }}
        className="profile-mobile-safe-modal profile-page__receiptConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={() => receiptConfirmOrder ? handleConfirmReceipt(receiptConfirmOrder.id) : undefined}
        onCancel={() => { if (!confirmingReceipt) setReceiptConfirmOrder(null); }}
      />
    </div>
  );
};

export default Profile;
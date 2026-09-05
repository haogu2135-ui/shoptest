import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer, PaymentChannel, PetProfile, UserAddress, UserProfile } from '../types';
import type { RegionOption } from '../regionData';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useCountdownTicker } from '../hooks/useCountdownTicker';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { createPaymentMethodDetails, createPaymentMethodOptions } from '../utils/paymentMethods';
import { useAppConfig } from '../hooks/useAppConfig';
import { useMarket } from '../hooks/useMarket';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { getPaymentRecoveryState } from '../utils/paymentRecovery';
import {
  PROFILE_AFTER_SALE_STATUSES,
  buildProfileActionLabels,
  buildProfileAddressReadinessText,
  buildProfileAfterSaleFocusText,
  buildProfileMainShellProps,
  buildProfileOrderStatusTabs,
  buildProfilePetCompletenessText,
  buildProfilePetFocusText,
  buildProfilePetShoppingPath,
  deriveProfileDashboardMetrics,
  filterProfileOrders,
  formatOrderStatusLabel as formatOrderStatusLabelHelper,
  formatPaymentStatusLabel as formatPaymentStatusLabelHelper,
  getOrderActionHint as getOrderActionHintHelper,
  getOrderStatusColor as getOrderStatusColorHelper,
  getPaymentStatusColor as getPaymentStatusColorHelper,
  isReturnableOrder,
  normalizeProfileEmail,
  normalizeProfileOrderNo,
  normalizeProfileTab,
  normalizeStatusCode,
  profileOrderLabel,
  resolveNextReturnDeadlineLabel,
  resolveProfileDateLocale,
  resolveProfilePetFocus,
  resolveProfilePetShoppingFocus,
  resolveProfilePetSizeLabel,
  resolveProfilePetTypeLabel,
  type OrderActionHint,
} from '../utils/profileHelpers';
import { useProfilePaymentActions } from '../hooks/useProfilePaymentActions';
import { useProfileAddressActions } from '../hooks/useProfileAddressActions';
import { useProfilePetActions } from '../hooks/useProfilePetActions';
import { useProfileAccountActions } from '../hooks/useProfileAccountActions';
import { useProfileOrderActions } from '../hooks/useProfileOrderActions';
import { useProfileSessionData } from '../hooks/useProfileSessionData';
import { useProfilePaymentReturn } from '../hooks/useProfilePaymentReturn';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import {
  ProfileAuthGateShell,
  ProfileLoadingShell,
  ProfileMainShell,
  type ProfileMainShellProps,
} from './profileShellPanels';
import './Profile.css';

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
  const formatOrderStatusLabel = useCallback(
    (status?: string) => formatOrderStatusLabelHelper(status, t),
    [t],
  );
  const formatPaymentStatusLabel = useCallback(
    (status?: string) => formatPaymentStatusLabelHelper(status, t),
    [t],
  );
  const getOrderStatusColor = useCallback(
    (status?: string) => getOrderStatusColorHelper(status),
    [],
  );
  const getPaymentStatusColor = useCallback(
    (status?: string) => getPaymentStatusColorHelper(status),
    [],
  );

  const {
    fetchAddresses,
    fetchOrders,
    fetchPetProfiles,
    fetchUserInfo,
    mountedRef,
    ordersRef,
    paymentReturnSyncSeqRef,
  } = useProfileSessionData({
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
  });

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

  useCountdownTicker(profileEmailCodeCountdown, setProfileEmailCodeCountdown);

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
    mountedRef,
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
    mountedRef,
    passwordForm,
    profileEmailCodeSending,
    profileSubmitting,
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

  useProfilePaymentReturn({
    fetchOrders,
    handleContinuePayment,
    isPaymentReturnIncomplete,
    mountedRef,
    ordersInitialLoadComplete,
    ordersRef,
    paymentChannels,
    paymentChannelsLoaded,
    paymentReturnOrderId,
    paymentReturnOrderNo,
    paymentReturnStatus,
    paymentReturnSyncSeqRef,
    profileLocalizationRef,
    searchParams,
    setOrderPayments,
    setOrderSearchText,
    setOrderStatusFilter,
    setProfileActiveTab,
    setSearchParams,
    setSelectedPayment,
    setSelectedPaymentMethod,
  });

  const selectedPaymentOrderId = selectedOrder?.id;
  const pollPaymentState = useCallback(async () => {
    if (!selectedPaymentOrderId || !mountedRef.current) return;
    const isActive = () => mountedRef.current;
    try {
      await refreshPaymentState(selectedPaymentOrderId, isActive);
    } catch (error) {
      if (isActive()) reportNonBlockingError('Profile.pollPaymentState', error);
    }
  }, [refreshPaymentState, selectedPaymentOrderId]);

  useVisiblePolling({
    enabled: process.env.NODE_ENV !== 'test' && paymentModalVisible && Boolean(selectedPaymentOrderId),
    intervalMs: 5000,
    run: pollPaymentState,
  });

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

  const afterSaleStatuses = [...PROFILE_AFTER_SALE_STATUSES];
  const orderStatusTabs = buildProfileOrderStatusTabs(t);
  const filteredOrders = filterProfileOrders({
    orders,
    orderStatusFilter,
    orderSearchText,
    orderItemsByOrderId,
    resolveItemName: profileOrderItemName,
  });
  const dateLocale = resolveProfileDateLocale(language);
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
  const {
    pendingPaymentCount,
    inTransitCount,
    afterSaleCount,
    returnableOrdersCount,
    returnApprovedCount,
    returnShippedCount,
    returnRefundingCount,
    ordersStale,
    defaultAddressReady,
    completedPetProfiles,
    petProfileProgress,
    petsMissingBirthdayCount,
    petsMissingFitCount,
    completeAddressCount,
    addressesMissingPhoneCount,
    addressesMissingDetailCount,
    addressReadinessProgress,
    accountHealthScore,
  } = deriveProfileDashboardMetrics({
    orders,
    ordersLoadFailed,
    addresses,
    petProfiles,
    user,
  });
  const nextReturnDeadline = useMemo(
    () => resolveNextReturnDeadlineLabel(orders, dateLocale),
    [dateLocale, orders],
  );
  const afterSaleFocusText = buildProfileAfterSaleFocusText({
    t,
    ordersStale,
    returnApprovedCount,
    returnShippedCount,
    returnRefundingCount,
    returnableOrdersCount,
    nextReturnDeadline,
  });
  const petCompletenessText = buildProfilePetCompletenessText({
    t,
    petProfilesLength: petProfiles.length,
    petProfileProgress,
    completedPetProfiles,
  });
  const petProfileFocus = resolveProfilePetFocus(petProfiles);
  const petProfileFocusText = buildProfilePetFocusText({ t, petProfiles });
  const addressReadinessText = buildProfileAddressReadinessText({
    t,
    addressesLength: addresses.length,
    addressReadinessProgress,
  });
  const petTypeLabel = (value?: string) => resolveProfilePetTypeLabel(value, t);
  const petSizeLabel = (value?: string) => resolveProfilePetSizeLabel(value, t);
  const profilePetShoppingFocus = resolveProfilePetShoppingFocus(petProfiles);
  const openPetShoppingPath = (pet?: PetProfile | null) => {
    const targetPet = pet || profilePetShoppingFocus;
    navigate(buildProfilePetShoppingPath(targetPet));
  };
  const getOrderActionHint = (order: OrderCustomer): OrderActionHint => getOrderActionHintHelper({
    order,
    ordersStale,
    dateLocale,
    t,
  });
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
    return <ProfileAuthGateShell language={language} t={t} navigate={navigate} />;
  }

  if (loading || !user) {
    return <ProfileLoadingShell t={t} />;
  }


  const {
    selectedOrderTrackActionLabel,
    editProfileActionLabel,
    changePasswordActionLabel,
    saveAddressActionLabel,
    profilePhoneInputLabel,
    addressPhoneInputLabel,
    addressRegionInputLabel,
    savePetActionLabel,
    submitReturnShipmentActionLabel,
    submitReturnRequestActionLabel,
    openPaymentActionLabel,
    refreshPaymentActionLabel,
    retryPaymentChannelsActionLabel,
    closePaymentActionLabel,
    profilePendingPayActionLabel,
    profileInTransitActionLabel,
    profileAfterSaleActionLabel,
    profileCompletionActionLabel,
    orderListContextLabel,
    orderSearchInputLabel,
    reorderSelectedOrderActionLabel,
    returnTrackingInputLabel,
    returnReasonInputLabel,
    paymentMethodSelectLabel,
    paymentLinkActionLabel,
  } = buildProfileActionLabels({
    t,
    user,
    selectedOrder,
    editingAddress,
    editingPet,
    returnShipmentOrder,
    returnRequestOrder,
    pendingPaymentCount,
    inTransitCount,
    afterSaleCount,
    defaultAddressReady,
    petProfileProgress,
    addressReadinessProgress,
    orderStatusTabs,
    orderStatusFilter,
    orders,
    filteredOrders,
  });

  const shellProps: ProfileMainShellProps = buildProfileMainShellProps({
    language,
    t,
    user,
    defaultAddressReady,
    petProfileFocusText,
    addressReadinessText,
    openProfileTab,
    openAddressSetup,
    orders,
    petProfiles,
    addresses,
    accountHealthScore,
    profilePendingPayActionLabel,
    pendingPaymentCount,
    openOrdersWithFilter,
    profileInTransitActionLabel,
    inTransitCount,
    profileAfterSaleActionLabel,
    afterSaleCount,
    profileCompletionActionLabel,
    petProfileProgress,
    profileActiveTab,
    openEditModal,
    setPasswordModalVisible,
    addressReadinessProgress,
    addressesLoadFailed,
    addressesMissingDetailCount,
    addressesMissingPhoneCount,
    addressesStale,
    fetchAddresses,
    handleDeleteAddress,
    handleSetDefault,
    navigate,
    openAddressModal,
    afterSaleFocusText,
    afterSaleStatuses,
    confirmReceiptOrder,
    dateLocale,
    fetchOrders,
    filteredOrders,
    formatMoney,
    formatOrderStatusLabel,
    getOrderActionHint,
    getOrderStatusColor,
    handleCancelOrder,
    handleContinuePayment,
    handleTrackShipment,
    handleViewOrder,
    isPaymentReturnIncomplete,
    isPaymentReturnSuccess,
    isReturnableOrder,
    openProductDetail,
    openReturnModal,
    openSupport,
    orderItemPreviewFailedByOrderId,
    orderItemsByOrderId,
    orderListContextLabel,
    orderSearchInputLabel,
    orderSearchText,
    orderStatusFilter,
    orderStatusTabs,
    ordersLoadFailed,
    ordersStale,
    payingOrderId,
    paymentReturnOrderNo,
    paymentReturnStatus,
    profileOrderItemName,
    returnApprovedCount,
    returnableOrdersCount,
    setOrderSearchText,
    setOrderStatusFilter,
    setReturnShipmentOrder,
    setReturnTrackingNumber,
    handleDeletePet,
    openPetModal,
    openPetShoppingPath,
    petCompletenessText,
    petProfileFocus,
    petSizeLabel,
    petTypeLabel,
    petsMissingBirthdayCount,
    petsMissingFitCount,
    profilePetShoppingFocus,
    addressForm,
    addressModalVisible,
    addressPhoneInputLabel,
    addressRegionInputLabel,
    addressSubmitting,
    changePasswordActionLabel,
    closeAddressModal,
    closePasswordModal,
    closePetModal,
    editForm,
    editModalVisible,
    editProfileActionLabel,
    editingAddress,
    editingPet,
    emailCodeEnabled,
    handleChangePassword,
    handleEditProfile,
    handleSaveAddress,
    handleSavePet,
    handleSendProfileEmailCode,
    loadProfileRegionOptions,
    passwordForm,
    passwordModalVisible,
    passwordSubmitting,
    petForm,
    petModalVisible,
    petSubmitting,
    profileEmailChanged,
    profileEmailCodeCountdown,
    profileEmailCodeSending,
    profileEmailCodeSentTo,
    profileEmailCodeTtlMinutes,
    profilePhoneInputLabel,
    profileSubmitting,
    regionOptions,
    regionOptionsLoading,
    saveAddressActionLabel,
    savePetActionLabel,
    setAddressModalVisible,
    setEditModalVisible,
    setEditingAddress,
    setEditingPet,
    setPetModalVisible,
    setProfileEmailCodeCountdown,
    setProfileEmailCodeSentTo,
    formatPaymentStatusLabel,
    getPaymentStatusColor,
    handleReorder,
    handleReturnOrder,
    orderDetailVisible,
    orderItems,
    orderPayments,
    reorderSelectedOrderActionLabel,
    reordering,
    selectedOrder,
    selectedOrderTrackActionLabel,
    setOrderDetailVisible,
    handleSubmitReturnShipment,
    requestingReturn,
    returnReason,
    returnReasonInputLabel,
    returnRequestOrder,
    returnShipmentOrder,
    returnTrackingInputLabel,
    returnTrackingNumber,
    setReturnReason,
    setReturnRequestOrder,
    setTrackingVisible,
    submitReturnRequestActionLabel,
    submitReturnShipmentActionLabel,
    submittingReturnShipment,
    selectedTrackingCarrierCode,
    selectedTrackingNumber,
    selectedTrackingOrderId,
    trackingVisible,
    closePaymentActionLabel,
    handleRefreshPayment,
    loadPaymentChannels,
    openPaymentActionLabel,
    paymentChannelsError,
    paymentChannelsLoading,
    paymentLinkActionLabel,
    paymentMethodSelectLabel,
    paymentModalVisible,
    paymentOptions,
    refreshPaymentActionLabel,
    refreshingPayment,
    retryPaymentChannelsActionLabel,
    selectedPayment,
    selectedPaymentExpiredOrFailed,
    selectedPaymentFailed,
    selectedPaymentMethod,
    selectedPaymentMethodDetail,
    selectedPaymentPaid,
    selectedPaymentReconcileRequired,
    selectedPaymentRecovery,
    setPaymentModalVisible,
    setSelectedPaymentMethod,
    confirmingReceipt,
    handleConfirmReceipt,
    receiptConfirmOrder,
    setReceiptConfirmOrder,
  });

  return <ProfileMainShell {...shellProps} />;
};

export default Profile;

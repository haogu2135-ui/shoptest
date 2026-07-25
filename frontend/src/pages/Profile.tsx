import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { Form } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer, PaymentChannel, PetProfile, UserAddress, UserProfile } from '../types';
import type { RegionOption } from '../regionData';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { createPaymentMethodDetails, createPaymentMethodOptions } from '../utils/paymentMethods';
import { useAppConfig } from '../hooks/useAppConfig';
import { useMarket } from '../hooks/useMarket';
import './Profile.css';
import { dispatchDomEvent } from '../utils/domEvents';
import { getLocalStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import '../styles/mobile-page-contrast.css';
import { getPaymentRecoveryState } from '../utils/paymentRecovery';

import {
  ORDER_STATUS_LABEL_KEYS,
  PAYMENT_STATUS_LABEL_KEYS,
  isCompleteProfileAddress,
  isLikelyProfilePhone,
  normalizeProfileEmail,
  normalizeProfileOrderNo,
  normalizeProfileTab,
  normalizeStatusCode,
  profileOrderLabel,
  sortOrdersNewestFirst,
  statusColors,
  type OrderActionHint,
} from '../utils/profileHelpers';
import { useProfilePaymentActions } from '../hooks/useProfilePaymentActions';
import { useProfileAddressActions } from '../hooks/useProfileAddressActions';
import { useProfilePetActions } from '../hooks/useProfilePetActions';
import { useProfileAccountActions } from '../hooks/useProfileAccountActions';
import { useProfileOrderActions } from '../hooks/useProfileOrderActions';
import { useProfileSessionData } from '../hooks/useProfileSessionData';
import { useProfilePaymentReturn } from '../hooks/useProfilePaymentReturn';

import {
  ProfileAuthGateShell,
  ProfileLoadingShell,
  ProfileMainShell,
} from './profileShellPanels';

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
    return <ProfileAuthGateShell language={language} t={t} navigate={navigate} />;
  }

  if (loading || !user) {
    return <ProfileLoadingShell t={t} />;
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

  const shellProps = {
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
  };

  return <ProfileMainShell {...shellProps} />;
};

export default Profile;

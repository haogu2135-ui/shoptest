import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Alert, Button, Card, Cascader, Checkbox, DatePicker, Descriptions, Form, Input, InputNumber, List, Modal, Popconfirm, Progress, Select, Spin, Tabs, Tag } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addressApi, cartApi, orderApi, paymentApi, petProfileApi, userApi } from '../api';
import type { OrderCustomer, OrderItemCustomer, PaymentCustomer, PaymentChannel, PetProfile, UserAddress, UserProfile } from '../types';
import { findRegionPath, loadRegionData, type RegionOption } from '../regionData';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrl, buildLoginUrlFromWindow } from '../utils/authRedirect';
import { createPaymentMethodDetails, createPaymentMethodOptions, filterPaymentChannelsForMarket, paymentMethodLabel } from '../utils/paymentMethods';
import { useAppConfig } from '../hooks/useAppConfig';
import { useMarket } from '../hooks/useMarket';
import { getCurrency } from '../utils/market';
import './Profile.css';
import dayjs from 'dayjs';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { dispatchDomEvent } from '../utils/domEvents';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
  RETURN_REASON_PRESET_KEYS,
  returnReasonPresetI18nKey,
  returnFlowStepI18nKeys,
} from '../utils/returnFlow';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import { isLikelyPhoneNumber, normalizeLikelyPhoneNumber, normalizePhoneNumber } from '../utils/phone';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import '../styles/mobile-page-contrast.css';
import { focusFirstFormError } from '../utils/formValidationFocus';
import { navigateToCommercialPaymentUrl, formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';

const profileModalPopupClassNames = { popup: { root: 'shop-mobile-popup-layer profile-modal-popup' } };
const orderImageFallback = productImageFallback;
const resolveOrderImage = resolveProductImage;
const PROFILE_ORDER_ITEM_PREVIEW_LIMIT = 30;
type FormValidationError = { errorFields: unknown[] };
type OrderItemsPreviewResult = { orderId: number; items: OrderItemCustomer[]; failed: boolean };

const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};


const focusProfileModalFormError = (rootSelector: string) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      focusFirstFormError({
        rootSelector,
        scrollOffset: 80,
        scrollContainerSelector: `${rootSelector} .ant-modal-body`,
      });
    });
  });
};


const getProfileApiErrorData = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') return {};
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return {};
  const data = (response as { data?: unknown }).data;
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
};

const getProfileApiErrorCode = (error: unknown) => {
  const code = getProfileApiErrorData(error).code;
  return typeof code === 'string' ? code : '';
};

const getPreferredPaymentChannel = (
  channels: PaymentChannel[],
  preferred?: string | null,
  currency: string = getCurrency(),
) => {
  const normalizedPreferred = String(preferred || '').trim();
  const marketChannels = filterPaymentChannelsForMarket(channels, { currency });
  if (normalizedPreferred) {
    if (marketChannels.some((channel) => channel.code === normalizedPreferred)) {
      return normalizedPreferred;
    }
    // Preserve historical order channel so continue-pay can finish an existing charge.
    if (channels.some((channel) => channel.code === normalizedPreferred)) {
      return normalizedPreferred;
    }
  }
  return marketChannels.find((channel) => channel.recommended)?.code || marketChannels[0]?.code || '';
};

const useImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== orderImageFallback) {
    event.currentTarget.src = orderImageFallback;
  }
};

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURN_REFUNDING: 'magenta',
  RETURNED: 'purple',
  PENDING: 'orange',
  PAID: 'blue',
  REFUNDED: 'purple',
  FAILED: 'red',
  EXPIRED: 'volcano',
  RECONCILE_REQUIRED: 'magenta',
  DELIVERED: 'green',
};

const ORDER_STATUS_LABEL_KEYS = new Set([
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'SHIPPED',
  'PENDING_RECEIPT',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_SHIPPED',
  'RETURN_REFUNDING',
  'RETURNED',
  'REFUNDED',
  'DELIVERED',
]);
const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);

const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

const getOrderSortTime = (order: OrderCustomer) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

const profileOrderLabel = (order: Pick<OrderCustomer, 'id' | 'orderNo'>) => order.orderNo || `#${order.id}`;

const sortOrdersNewestFirst = (items: OrderCustomer[]) =>
  [...items].sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left) || right.id - left.id);

const normalizeProfileTab = (value: string | null) =>
  value === 'info' || value === 'addresses' || value === 'orders' || value === 'pets' ? value : null;

const normalizeProfileOrderNo = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeProfileEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const profilePhoneOptions = { minDigits: 6, maxDigits: 20, maxInputLength: 40 };
const normalizeProfilePhone = (value: unknown) => normalizePhoneNumber(value, profilePhoneOptions);
const isLikelyProfilePhone = (value: unknown) => isLikelyPhoneNumber(value, profilePhoneOptions);
const normalizeLikelyProfilePhone = (value: unknown) =>
  normalizeLikelyPhoneNumber(value, profilePhoneOptions);
const normalizeProfileAddressText = (value: unknown, maxLength: number) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const getProfileSavedAddressRegionPath = (address?: UserAddress | null) => {
  const region = address?.region;
  return (Array.isArray(region) ? region : [])
    .map((item) => normalizeProfileAddressText(item, 120))
    .filter(Boolean);
};
const getProfileSavedAddressPostalCode = (address?: UserAddress | null) =>
  normalizeRegionalPostalCode(address?.postalCode);
const getProfileSavedAddressDetail = (address?: UserAddress | null) =>
  normalizeProfileAddressText(address?.detailAddress, 260);
const isCompleteProfileAddress = (address?: UserAddress | null) => {
  const regionPath = getProfileSavedAddressRegionPath(address);
  const postalCode = getProfileSavedAddressPostalCode(address);
  return Boolean(
    address
      && normalizeProfileAddressText(address.recipientName, 80)
      && isLikelyProfilePhone(address.phone)
      && regionPath.length > 0
      && isValidRegionalPostalCode(postalCode, regionPath)
      && getProfileSavedAddressDetail(address),
  );
};
const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
const scrollProfileAddressFieldIntoMobileView = (target: EventTarget | null) => {
  if (typeof window === 'undefined' || window.innerWidth > 780 || !(target instanceof HTMLElement)) return;
  const field = target.closest('.ant-form-item') || target;
  window.setTimeout(() => {
    field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, 80);
};

type OrderActionHintTone = 'pay' | 'wait' | 'ship' | 'return' | 'done' | 'neutral';

type OrderActionHint = {
  tone: OrderActionHintTone;
  title: string;
  text: string;
};

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

  const refreshPaymentState = useCallback(async (orderId: number, isActive: () => boolean = () => true) => {
    const [orderRes, paymentListRes] = await Promise.all([
      orderApi.getById(orderId),
      paymentApi.getByOrder(orderId),
    ]);
    if (!mountedRef.current || !isActive()) return;
    const paymentList = paymentListRes.data || [];
    const latestPayment = paymentList[0] || null;
    setSelectedOrder(orderRes.data);
    setOrderPayments(paymentList);
    if (latestPayment) {
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(getPreferredPaymentChannel(paymentChannels, latestPayment.channel));
    }
  }, [paymentChannels]);

  const handleEditProfile = async () => {
    try {
      const values = await editForm.validateFields();
      const normalizedEmail = normalizeProfileEmail(values.email);
      const emailChanged = normalizedEmail !== normalizeProfileEmail(user?.email);
      if (emailChanged && !emailCodeEnabled) {
        const msg = t('pages.auth.emailCodeUnavailable');
        editForm.setFields([{ name: 'emailCode', errors: [msg] }]);
        announceAccessibleMessage(msg, 'warning');
        return;
      }
      if (emailChanged && normalizeEmailCode(values.emailCode).length !== 6) {
        editForm.setFields([{ name: 'emailCode', errors: [t('pages.auth.emailCodeLength')] }]);
        return;
      }
      setProfileSubmitting(true);
      await userApi.updateProfile({
        email: normalizedEmail,
        phone: normalizeProfilePhone(values.phone),
        emailCode: emailChanged ? values.emailCode : '',
      });
      announceAccessibleMessage(t('pages.profile.updated'), 'success');
      setEditModalVisible(false);
      editForm.resetFields(['emailCode']);
      setProfileEmailCodeSentTo('');
      setProfileEmailCodeCountdown(0);
      fetchUserInfo();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      const errorCode = getProfileApiErrorCode(err);
      if (errorCode === 'INVALID_CODE' || errorCode === 'TOO_MANY_ATTEMPTS') {
        const msg = errorCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : t('pages.auth.emailCodeInvalid');
        editForm.setFields([{ name: 'emailCode', errors: [msg] }]);
        announceAccessibleMessage(msg, 'error');
      } else {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.updateFailed'), language), 'error');
      }
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleSendProfileEmailCode = async () => {
    if (!emailCodeEnabled) {
      announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
      return;
    }
    try {
      const { email } = await editForm.validateFields(['email']);
      const normalizedEmail = normalizeProfileEmail(email);
      editForm.setFieldValue('email', normalizedEmail);
      if (normalizedEmail === normalizeProfileEmail(user?.email)) {
        announceAccessibleMessage(t('pages.profile.emailCodeUnchanged'), 'info');
        return;
      }
      setProfileEmailCodeSending(true);
      const response = await userApi.sendProfileEmailCode(normalizedEmail);
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setProfileEmailCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setProfileEmailCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      setProfileEmailCodeSentTo(normalizedEmail);
      editForm.setFieldValue('emailCode', '');
      editForm.setFields([{ name: 'emailCode', errors: [] }]);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: normalizedEmail }), 'success');
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      const retryAfterSeconds = Number(getProfileApiErrorData(err).retryAfterSeconds);
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        setProfileEmailCodeCountdown(Math.ceil(retryAfterSeconds));
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.auth.emailCodeSendFailed'), language), 'error');
    } finally {
      setProfileEmailCodeSending(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordSubmitting) return;
    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);
      await userApi.updatePassword(values.oldPassword, values.newPassword);
      announceAccessibleMessage(t('pages.profile.passwordChanged'), 'success');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.passwordFailed'), language), 'error');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleViewOrder = async (order: OrderCustomer) => {
    const requestSeq = orderDetailRequestSeqRef.current + 1;
    orderDetailRequestSeqRef.current = requestSeq;
    setSelectedOrder(order);
    setOrderDetailVisible(true);
    setOrderItems([]);
    try {
      const res = await orderApi.getItems(order.id);
      if (!mountedRef.current || orderDetailRequestSeqRef.current !== requestSeq) return;
      setOrderItems(res.data);
    } catch (error) {
      if (!mountedRef.current || orderDetailRequestSeqRef.current !== requestSeq) return;
      reportNonBlockingError('Profile.loadOrderItems', error);
      setOrderItems([]);
    }
  };

  const openProductDetail = (productId: number) => {
    setOrderDetailVisible(false);
    navigate(`/products/${productId}`);
  };

  const handleReorder = async () => {
    if (!getLocalStorageItem('token') || orderItems.length === 0) return;
    setReordering(true);
    let added = 0;
    const expectedQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    try {
      for (const item of orderItems) {
        if (!mountedRef.current) return;
        try {
          await cartApi.addItem(0, item.productId, item.quantity, item.selectedSpecs);
          if (!mountedRef.current) return;
          added += item.quantity;
        } catch (error) {
          if (!mountedRef.current) return;
          reportNonBlockingError('Profile.reorderItem', error);
        }
      }
      if (!mountedRef.current) return;
      if (added === 0) {
        announceAccessibleMessage(t('pages.profile.reorderFailed'), 'error');
        return;
      }
      announceAccessibleMessage(
        added === expectedQuantity
          ? t('pages.profile.reordered', { count: added })
          : t('pages.profile.reorderPartial', { count: added }), 'success');
      dispatchDomEvent('shop:cart-updated');
      dispatchDomEvent('shop:open-cart');
    } finally {
      if (mountedRef.current) {
        setReordering(false);
      }
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      await orderApi.cancel(orderId);
      announceAccessibleMessage(t('pages.profile.orderCancelled'), 'success');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.cancelFailed'), language), 'error');
    } finally {
      fetchOrders();
    }
  };

  const handleContinuePayment = useCallback(async (order: OrderCustomer) => {
    if (continuingPaymentRef.current !== null) return;
    continuingPaymentRef.current = order.id;
    setPayingOrderId(order.id);
    try {
      const paymentListRes = await paymentApi.getByOrder(order.id);
      const paymentList = paymentListRes.data;
      const preferredMethod = getPreferredPaymentChannel(paymentChannels, order.paymentMethod || paymentList[0]?.channel);
      const paidPayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'PAID');
      const reconcilePayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'RECONCILE_REQUIRED');
      const pendingPayment = paymentList.find((item) => normalizeStatusCode(item.status) === 'PENDING' && !getPaymentRecoveryState(item).isExpired);
      // Reconcile payments must surface for review — never open/create a competing gateway charge.
      const reusablePayment = paidPayment || reconcilePayment || pendingPayment;
      if (!reusablePayment && !preferredMethod) {
        throw new Error(profileLocalizationRef.current.t('pages.checkout.paymentUnavailable'));
      }
      const latestPayment = reusablePayment || (await paymentApi.create(order.id, preferredMethod)).data;
      setSelectedOrder(order);
      setOrderPayments(paymentList.some((item) => item.id === latestPayment.id) ? paymentList : [latestPayment, ...paymentList]);
      setSelectedPayment(latestPayment);
      setSelectedPaymentMethod(latestPayment.channel || preferredMethod);
      setPaymentModalVisible(true);
    } catch (err: unknown) {
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      announceAccessibleMessage(getApiErrorMessage(err, latestT('pages.profile.continuePayFailed'), latestLanguage, { includeClientMessage: true }), 'error');
      fetchOrders();
    } finally {
      if (continuingPaymentRef.current === order.id) {
        continuingPaymentRef.current = null;
      }
      setPayingOrderId(null);
    }
  }, [fetchOrders, paymentChannels]);

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

  const handleRefreshPayment = async () => {
    if (!selectedOrder) return;
    if (normalizeStatusCode(selectedPayment?.status) === 'RECONCILE_REQUIRED') {
      announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning');
      return;
    }
    const method = getPreferredPaymentChannel(paymentChannels, selectedPaymentMethod || selectedPayment?.channel || selectedOrder.paymentMethod);
    if (!method) {
      announceAccessibleMessage(t('pages.checkout.paymentUnavailable'), 'error');
      return;
    }
    setRefreshingPayment(true);
    try {
      const paymentRes = await paymentApi.create(selectedOrder.id, method);
      setSelectedPayment(paymentRes.data);
      setSelectedPaymentMethod(paymentRes.data.channel);
      setOrderPayments((items) => [paymentRes.data, ...items.filter((item) => item.id !== paymentRes.data.id)]);
      announceAccessibleMessage(t('pages.profile.paymentRefreshed'), 'success');
      await fetchOrders();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.continuePayFailed'), language, { includeClientMessage: true }), 'error');
      await fetchOrders();
    } finally {
      setRefreshingPayment(false);
    }
  };

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

  const loadPaymentChannels = useCallback(async (isActive: () => boolean = () => mountedRef.current) => {
    setPaymentChannelsLoading(true);
    setPaymentChannelsError('');
    try {
      const res = await paymentApi.getChannels();
      if (!isActive()) return;
      setPaymentChannels(res.data || []);
      setPaymentChannelsLoaded(true);
    } catch (error: unknown) {
      if (!isActive()) return;
      setPaymentChannels([]);
      setPaymentChannelsLoaded(true);
      const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;
      setPaymentChannelsError(getApiErrorMessage(error, latestT('pages.checkout.paymentUnavailableDescription'), latestLanguage));
    } finally {
      if (isActive()) {
        setPaymentChannelsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void loadPaymentChannels(() => !disposed && mountedRef.current);
    return () => {
      disposed = true;
    };
  }, [loadPaymentChannels]);

  const handleConfirmReceipt = async (orderId: number) => {
    try {
      await orderApi.confirm(orderId);
      announceAccessibleMessage(t('pages.profile.receiptConfirmed'), 'success');
      fetchOrders();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.confirmFailed'), language), 'error');
    }
  };

  const confirmReceiptOrder = (order: OrderCustomer) => {
    const orderLabel = profileOrderLabel(order);
    const confirmReceiptActionLabel = `${t('pages.profile.confirmReceipt')}: ${orderLabel}`;
    Modal.confirm({
      title: t('pages.profile.confirmReceiptTitle'),
      content: t('pages.profile.confirmReceiptContent', { orderNo: order.orderNo || order.id }),
      okText: t('pages.profile.confirmReceipt'),
      cancelText: t('common.cancel'),
      okButtonProps: { 'aria-label': confirmReceiptActionLabel, title: confirmReceiptActionLabel },
      cancelButtonProps: { 'aria-label': `${t('common.cancel')}: ${confirmReceiptActionLabel}`, title: `${t('common.cancel')}: ${confirmReceiptActionLabel}` },
      className: 'profile-mobile-safe-modal profile-page__receiptConfirmModal',
      onOk: () => handleConfirmReceipt(order.id),
    });
  };

  const openReturnModal = (order: OrderCustomer) => {
    setReturnRequestOrder(order);
    setReturnReason(order.returnReason || '');
  };

  const handleReturnOrder = async () => {
    if (!returnRequestOrder) return;
    const cleanedReason = normalizeReturnReason(returnReason);
    if (!isReturnReasonReady(cleanedReason)) {
      announceAccessibleMessage(t('pages.profile.returnReasonRequired'), 'warning');
      return;
    }
    try {
      setRequestingReturn(true);
      await orderApi.returnOrder(returnRequestOrder.id, cleanedReason);
      announceAccessibleMessage(t('pages.profile.returnRequested'), 'success');
      setReturnRequestOrder(null);
      setReturnReason('');
      fetchOrders();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.returnFailed'), language), 'error');
    } finally {
      setRequestingReturn(false);
    }
  };

  const handleSubmitReturnShipment = async () => {
    if (!returnShipmentOrder) return;
    const cleanedTracking = normalizeReturnTrackingNumber(returnTrackingNumber);
    if (!isReturnTrackingReady(cleanedTracking)) {
      announceAccessibleMessage(t('pages.profile.returnTrackingInvalid'), 'error');
      return;
    }
    try {
      setSubmittingReturnShipment(true);
      await orderApi.submitReturnShipment(returnShipmentOrder.id, cleanedTracking);
      announceAccessibleMessage(t('pages.profile.returnShipmentSubmitted'), 'success');
      setReturnShipmentOrder(null);
      setReturnTrackingNumber('');
      fetchOrders();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.returnShipmentFailed'), language), 'error');
    } finally {
      setSubmittingReturnShipment(false);
    }
  };

  const handleTrackShipment = (trackingNumber?: string, carrierCode?: string, orderId?: number) => {
    if (!trackingNumber) {
      announceAccessibleMessage(t('pages.adminOrders.noTrackingNumber'), 'warning');
      return;
    }
    setSelectedTrackingNumber(trackingNumber);
    setSelectedTrackingCarrierCode(carrierCode);
    setSelectedTrackingOrderId(orderId);
    setTrackingVisible(true);
  };

  const openSupport = useCallback(() => {
    if (!getLocalStorageItem('token')) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    dispatchDomEvent('shop:open-support');
  }, [navigate, t]);

  const handleSaveAddress = async () => {
    if (addressSubmitting) return;
    try {
      const values = await addressForm.validateFields();
      setAddressSubmitting(true);
      const regionPath = Array.isArray(values.region)
        ? values.region.map((item: unknown) => normalizeProfileAddressText(item, 120)).filter(Boolean)
        : [];
      const postalCode = normalizeRegionalPostalCode(values.postalCode);
      const detailAddress = normalizeProfileAddressText(values.detail, 260);
      if (!isValidRegionalPostalCode(postalCode, regionPath)) {
        addressForm.setFields([{ name: 'postalCode', errors: [t('pages.profile.postalCodeInvalid')] }]);
        focusProfileModalFormError('.profile-address-modal');
        return;
      }
      const regionStr = regionPath.join(' ');
      const fullAddress = [regionStr, postalCode, detailAddress].filter(Boolean).join(' ');
      const payload = {
        recipientName: values.recipientName,
        phone: normalizeProfilePhone(values.phone),
        region: regionPath,
        postalCode,
        detailAddress,
        address: fullAddress,
        isDefault: Boolean(values.isDefault),
      };
      if (editingAddress) {
        await addressApi.update(editingAddress.id, payload);
        announceAccessibleMessage(t('pages.profile.addressUpdated'), 'success');
      } else {
        await addressApi.create(payload);
        announceAccessibleMessage(t('pages.profile.addressAdded'), 'success');
      }
      setAddressModalVisible(false);
      setEditingAddress(null);
      addressForm.resetFields();
      fetchAddresses();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-address-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.addressSaveFailed'), language), 'error');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    try {
      await addressApi.delete(id);
      announceAccessibleMessage(t('pages.profile.addressDeleted'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    }
  };

  const handleSetDefault = async (id: number) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    try {
      await addressApi.setDefault(id);
      announceAccessibleMessage(t('pages.profile.defaultSet'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.setFailed'), language), 'error');
    }
  };

  const loadProfileRegionOptions = useCallback(async () => {
    if (regionOptions.length > 0 && regionOptionsLanguage === language) {
      return regionOptions;
    }
    setRegionOptionsLoading(true);
    try {
      const options = await loadRegionData(language);
      if (mountedRef.current) {
        setRegionOptions(options);
        setRegionOptionsLanguage(language);
      }
      return options;
    } catch (error) {
      reportNonBlockingError('Profile.loadRegionData', error);
      if (mountedRef.current) {
        announceAccessibleMessage(t('pages.profile.regionLoadFailed'), 'error');
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setRegionOptionsLoading(false);
      }
    }
  }, [language, regionOptions, regionOptionsLanguage, t]);

  const openAddressModal = (address?: UserAddress) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    addressForm.resetFields();
    if (address) {
      setEditingAddress(address);
      const savedRegionPath = getProfileSavedAddressRegionPath(address);
      const savedDetail = getProfileSavedAddressDetail(address);
      const savedPostalCode = getProfileSavedAddressPostalCode(address);
      addressForm.setFieldsValue({
        recipientName: address.recipientName,
        phone: address.phone,
        region: savedRegionPath,
        postalCode: savedPostalCode,
        detail: savedDetail || address.address,
        isDefault: Boolean(address.isDefault),
      });
      if (savedRegionPath.length === 0) {
        void loadProfileRegionOptions().then((options) => {
          if (!mountedRef.current) return;
          const { region, detail } = findRegionPath(address.address, options);
          addressForm.setFieldsValue({ region, detail });
        });
      } else {
        void loadProfileRegionOptions();
      }
    } else {
      setEditingAddress(null);
      addressForm.resetFields();
      void loadProfileRegionOptions();
    }
    setAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    if (addressSubmitting) return;
    setAddressModalVisible(false);
    addressForm.resetFields();
    setEditingAddress(null);
  };

  const closePasswordModal = () => {
    if (passwordSubmitting) return;
    setPasswordModalVisible(false);
    passwordForm.resetFields();
  };

  const openEditModal = () => {
    editForm.setFieldsValue({ email: user?.email, phone: user?.phone, emailCode: '' });
    setProfileEmailCodeSentTo('');
    setProfileEmailCodeCountdown(0);
    setProfileEmailCodeTtlMinutes(0);
    setEditModalVisible(true);
  };

  const openPetModal = (pet?: PetProfile) => {
    petForm.resetFields();
    setEditingPet(pet || null);
    if (pet) {
      petForm.setFieldsValue({
        ...pet,
        birthday: pet.birthday ? dayjs(pet.birthday) : undefined,
      });
    } else {
      petForm.resetFields();
      petForm.setFieldsValue({ petType: 'DOG', size: 'MEDIUM' });
    }
    setPetModalVisible(true);
  };

  const handleSavePet = async () => {
    if (petSubmitting) return;
    try {
      const values = await petForm.validateFields();
      setPetSubmitting(true);
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
      };
      if (editingPet) {
        await petProfileApi.update(editingPet.id, payload);
        announceAccessibleMessage(t('messages.updateSuccess'), 'success');
      } else {
        await petProfileApi.create(payload);
        announceAccessibleMessage(t('pages.profile.petAdded'), 'success');
      }
      setPetModalVisible(false);
      setEditingPet(null);
      petForm.resetFields();
      fetchPetProfiles();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    } finally {
      setPetSubmitting(false);
    }
  };

  const closePetModal = () => {
    if (petSubmitting) return;
    setPetModalVisible(false);
    setEditingPet(null);
    petForm.resetFields();
  };

  const handleDeletePet = async (id: number) => {
    try {
      await petProfileApi.delete(id);
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
      fetchPetProfiles();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    }
  };

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
        <Spin />
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
  const validateStrongPassword = (_rule: unknown, value?: string) => {
    if (!value) return Promise.resolve();
    if (isCommonPassword(value)) {
      return Promise.reject(new Error(t('pages.profile.newPasswordCommon')));
    }
    if (!hasRequiredPasswordClasses(value)) {
      return Promise.reject(new Error(t('pages.profile.newPasswordPattern')));
    }
    return Promise.resolve();
  };
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
  const refreshOrdersActionLabel = `${t('common.refresh')}: ${orderListContextLabel}`;
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
            <Button type="primary" onClick={() => openProfileTab('orders')}>
              {t('pages.profile.orders', { count: orders.length })}
            </Button>
            <Button onClick={() => (defaultAddressReady ? openProfileTab('pets') : openAddressSetup())}>
              {defaultAddressReady
                ? (petProfiles.length > 0 ? t('pages.profile.completePetProfile') : t('pages.profile.addPet'))
                : t('pages.profile.addAddress')}
            </Button>
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

      <div className="profile-mobile-entry" role="tablist" aria-label={t('pages.profile.title')}>
        <button
          type="button"
          role="tab"
          className={profileActiveTab === 'orders' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'orders'}
          tabIndex={profileActiveTab === 'orders' ? 0 : -1}
          onClick={() => openProfileTab('orders')}
        >
          <ShopIcon path={SI.cart} />
          <span>{t('pages.profile.orders', { count: orders.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={profileActiveTab === 'addresses' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'addresses'}
          tabIndex={profileActiveTab === 'addresses' ? 0 : -1}
          onClick={() => openProfileTab('addresses')}
        >
          <ShopIcon path={SI.environment} />
          <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={profileActiveTab === 'info' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'info'}
          tabIndex={profileActiveTab === 'info' ? 0 : -1}
          onClick={() => openProfileTab('info')}
        >
          <ShopIcon path={SI.user} />
          <span>{t('pages.profile.info')}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={profileActiveTab === 'pets' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'pets'}
          tabIndex={profileActiveTab === 'pets' ? 0 : -1}
          onClick={() => openProfileTab('pets')}
        >
          <ShopIcon path={SI.heart} />
          <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
        </button>
      </div>

      <Tabs
        className="profile-tabs"
        activeKey={profileActiveTab}
        onChange={openProfileTab}
        items={[
          {
            key: 'info',
            label: t('pages.profile.info'),
            children: (
              <Card className="profile-section-card">
                <div className="profile-health-panel">
                  <div>
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.accountHealthTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.accountHealthText')}</span>
                  </div>
                  <Progress type="circle" percent={accountHealthScore} size={72} strokeColor="#124734" />
                  <div className="profile-health-panel__chips">
                    <Tag color={user.email ? 'green' : 'gold'}>{t('pages.profile.accountHealthEmail')}</Tag>
                    <Tag color={user.phone ? 'green' : 'gold'}>{t('pages.profile.accountHealthPhone')}</Tag>
                    <Tag color={defaultAddressReady ? 'green' : 'gold'}>{t('pages.profile.accountHealthDefaultAddress')}</Tag>
                    <Tag color={petProfiles.length > 0 ? 'green' : 'gold'}>{t('pages.profile.accountHealthPet')}</Tag>
                  </div>
                </div>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label={t('pages.profile.username')}>{user.username}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.email')}>{user.email || t('common.unset')}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.phone')}>{user.phone || t('common.unset')}</Descriptions.Item>
                  <Descriptions.Item label={t('pages.profile.defaultAddress')}>{addresses.find((item) => item.isDefault)?.address || t('common.unset')}</Descriptions.Item>
                </Descriptions>
                <div className="profile-info-actions">
                  <Button icon={<ShopIcon path={SI.edit} />} onClick={openEditModal}>{t('pages.profile.editProfile')}</Button>
                  <Button icon={<ShopIcon path={SI.lock} />} onClick={() => setPasswordModalVisible(true)}>{t('pages.profile.changePassword')}</Button>
                </div>
              </Card>
            ),
          },
          {
            key: 'addresses',
            label: t('pages.profile.addresses', { count: addresses.length }),
            children: (
              <div>
                <div className="profile-address-readiness">
                  <div className="profile-address-readiness__copy">
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.addressReadinessTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{addressReadinessText}</span>
                    <Progress percent={addressReadinessProgress} size="small" strokeColor="#124734" />
                  </div>
                  <div className="profile-address-readiness__stats">
                    <span>
                      <strong>{defaultAddressReady ? 1 : 0}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressDefaultReady')}</span>
                    </span>
                    <span>
                      <strong>{addressesMissingPhoneCount}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressMissingPhone')}</span>
                    </span>
                    <span>
                      <strong>{addressesMissingDetailCount}</strong>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.addressMissingDetail')}</span>
                    </span>
                  </div>
                </div>
                <Button
                  className="profile-block-button profile-section-action"
                  type="dashed"
                  icon={<ShopIcon path={SI.plus} />}
                  block
                  disabled={addressesStale}
                  title={addressesStale ? t('pages.profile.addressesStaleWarning') : undefined}
                  onClick={() => openAddressModal()}
                >
                  {t('pages.profile.addAddress')}
                </Button>
                {addressesStale && (
                  <Alert
                    type="warning"
                    showIcon
                    message={t('pages.profile.addressesStaleTitle')}
                    description={t('pages.profile.addressesStaleWarning')}
                    action={<Button size="small" onClick={() => fetchAddresses()}>{t('common.retry')}</Button>}
                  />
                )}
                {addressesLoadFailed && addresses.length === 0 ? (
                  <div data-profile-addresses-load-recovery="true">
                    <PageError
                      className="profile-section-card profile-load-error"
                      title={t('common.loadFailed')}
                      description={t('common.loadFailedRetry')}
                      actions={[
                        {
                          key: 'retry',
                          label: t('common.retry'),
                          onClick: () => fetchAddresses(),
                          type: 'primary',
                        },
                        {
                          key: 'checkout',
                          label: t('pages.cart.checkout'),
                          onClick: () => navigate('/checkout'),
                          type: 'default',
                        },
                        {
                          key: 'track',
                          label: t('nav.trackOrder'),
                          onClick: () => navigate('/track-order'),
                          type: 'default',
                        },
                        {
                          key: 'support',
                          label: t('pages.productList.loadRecoverySupport'),
                          onClick: () => dispatchDomEvent('shop:open-support'),
                          type: 'default',
                        },
                      ]}
                    />
                  </div>
                ) : addresses.length === 0 ? (
                  <PageEmpty
                    className="profile-empty-addresses"
                    data-profile-addresses-empty-actions="true"
                    description={(
                      <div className="profile-empty-orders__copy">
                        <div>{t('pages.profile.noAddresses')}</div>
                        <div className="profile-empty-orders__hint">{t('pages.profile.addressReadinessEmpty')}</div>
                      </div>
                    )}
                    actions={[
                      {
                        key: 'add-address',
                        label: t('pages.profile.addAddress'),
                        onClick: () => openAddressModal(),
                      },
                      {
                        key: 'shop',
                        label: t('pages.profile.goShopping'),
                        onClick: () => navigate('/products'),
                        type: 'default',
                      },
                      {
                        key: 'coupons',
                        label: t('pages.profile.emptyOrdersCoupons'),
                        onClick: () => navigate('/coupons'),
                        type: 'default',
                      },
                      {
                        key: 'track',
                        label: t('pages.profile.authGateTrackOrder'),
                        onClick: () => navigate('/track-order'),
                        type: 'default',
                      },
                    ]}
                  />
                ) : (
                  <List
                    dataSource={addresses}
                    renderItem={(address) => {
                      const addressLabel = [address.recipientName, address.phone, address.address].filter(Boolean).join(' / ') || `#${address.id}`;
                      const defaultActionLabel = `${t('pages.profile.setDefault')}: ${addressLabel}`;
                      const editActionLabel = `${t('common.edit')}: ${addressLabel}`;
                      const deleteActionLabel = `${t('common.delete')}: ${addressLabel}`;
                      return (
                      <Card key={address.id} className="profile-section-card profile-address-card">
                        <div className="profile-address-card__content">
                          <div>
                            <div className="profile-page__inlineRow">
                              <span className="profile-page__text profile-page__text--strong">{address.recipientName}</span>
                              <span className="profile-page__text profile-page__text--secondary">{address.phone}</span>
                              {address.isDefault && <Tag color="orange">{t('pages.checkout.defaultAddress')}</Tag>}
                            </div>
                            <div className="profile-address-card__address"><span className="profile-page__text">{address.address}</span></div>
                          </div>
                            <div className="profile-page__chipRow">
                              {!address.isDefault ? (
                              <Button size="small" icon={<ShopIcon path={SI.starOutline} />} aria-label={defaultActionLabel} title={defaultActionLabel} disabled={addressesStale} onClick={() => handleSetDefault(address.id)}>{t('pages.profile.setDefault')}</Button>
                            ) : (
                              <Button size="small" icon={<ShopIcon path={SI.star} />} disabled type="primary">{t('pages.profile.defaultAddressButton')}</Button>
                            )}
                            <Button size="small" icon={<ShopIcon path={SI.edit} />} aria-label={editActionLabel} title={editActionLabel} disabled={addressesStale} onClick={() => openAddressModal(address)}>{t('common.edit')}</Button>
                            <Popconfirm
                              classNames={{ root: 'shop-mobile-popup-layer profile-popconfirm' }}
                              title={t('pages.profile.deleteAddressConfirm')}
                              onConfirm={() => handleDeleteAddress(address.id)}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                            >
                              <Button size="small" danger icon={<ShopIcon path={SI.delete} />} aria-label={deleteActionLabel} title={deleteActionLabel} disabled={addressesStale}>{t('common.delete')}</Button>
                            </Popconfirm>
                          </div>
                        </div>
                      </Card>
                      );
                    }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'orders',
            label: t('pages.profile.orders', { count: orders.length }),
            children: ordersLoadFailed && orders.length === 0 ? (
              <div data-profile-orders-load-recovery="true">
                <PageError
                  className="profile-section-card profile-load-error"
                  title={t('pages.profile.fetchOrdersFailed')}
                  description={t('common.loadFailedRetry')}
                  actions={[
                    {
                      key: 'retry',
                      label: t('common.retry'),
                      onClick: () => fetchOrders(),
                      type: 'primary',
                    },
                    {
                      key: 'shop',
                      label: t('pages.profile.goShopping'),
                      onClick: () => navigate('/products'),
                      type: 'default',
                    },
                    {
                      key: 'track',
                      label: t('nav.trackOrder'),
                      onClick: () => navigate('/track-order'),
                      type: 'default',
                    },
                    {
                      key: 'coupons',
                      label: t('pages.profile.emptyOrdersCoupons'),
                      onClick: () => navigate('/coupons'),
                      type: 'default',
                    },
                    {
                      key: 'support',
                      label: t('pages.productList.loadRecoverySupport'),
                      onClick: () => dispatchDomEvent('shop:open-support'),
                      type: 'default',
                    },
                  ]}
                />
              </div>
            ) : orders.length === 0 ? (
              <PageEmpty
                className="profile-empty-orders"
                data-profile-orders-empty-actions="true"
                description={(
                  <div className="profile-empty-orders__copy">
                    <div>{t('pages.profile.noOrders')}</div>
                    <div className="profile-empty-orders__hint">{t('pages.profile.noOrdersHint')}</div>
                  </div>
                )}
                actions={[
                  {
                    key: 'shop',
                    label: t('pages.profile.goShopping'),
                    onClick: () => navigate('/products'),
                  },
                  {
                    key: 'coupons',
                    label: t('pages.profile.emptyOrdersCoupons'),
                    onClick: () => navigate('/coupons'),
                    type: 'default',
                  },
                  {
                    key: 'pet-finder',
                    label: t('pages.profile.emptyOrdersPetFinder'),
                    onClick: () => navigate('/pet-finder'),
                    type: 'default',
                  },
                  {
                    key: 'track',
                    label: t('pages.profile.authGateTrackOrder'),
                    onClick: () => navigate('/track-order'),
                    type: 'default',
                  },
                ]}
              />
            ) : (
              <div className="profile-orders">
                {(isPaymentReturnSuccess || isPaymentReturnIncomplete) ? (
                  <Alert
                    className="profile-payment-return"
                    data-profile-payment-return={isPaymentReturnSuccess ? 'success' : paymentReturnStatus === 'failed' ? 'failed' : 'cancelled'}
                    type={isPaymentReturnSuccess ? 'success' : paymentReturnStatus === 'failed' ? 'error' : 'warning'}
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={isPaymentReturnSuccess
                      ? t('pages.profile.paymentReturnSynced')
                      : paymentReturnStatus === 'failed'
                        ? (paymentReturnOrderNo
                          ? t('pages.profile.paymentReturnFailedOrder', { orderNo: paymentReturnOrderNo })
                          : t('pages.profile.paymentReturnFailed'))
                        : (paymentReturnOrderNo
                          ? t('pages.profile.paymentReturnCancelledOrder', { orderNo: paymentReturnOrderNo })
                          : t('pages.profile.paymentReturnCancelled'))}
                    description={isPaymentReturnSuccess
                      ? t('pages.checkout.paymentRecoveryNextPaid')
                      : t('pages.checkout.paymentRecoveryNextRetry')}
                    action={(
                      <div className="profile-payment-return__actions" data-profile-payment-return-recovery="true">
                        {isPaymentReturnSuccess ? (
                          <>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => navigate(paymentReturnOrderNo
                                ? `/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
                                : '/track-order')}
                            >
                              {t('pages.paymentInstructions.stickyTrackOrder')}
                            </Button>
                            <Button size="small" onClick={() => navigate('/products')}>
                              {t('pages.profile.goShopping')}
                            </Button>
                            <Button size="small" onClick={() => navigate('/coupons')}>
                              {t('pages.profile.emptyOrdersCoupons')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="small"
                              type="primary"
                              onClick={() => navigate('/products')}
                            >
                              {t('pages.orderTracking.shopAgain')}
                            </Button>
                            <Button size="small" onClick={() => navigate('/coupons')}>
                              {t('pages.profile.emptyOrdersCoupons')}
                            </Button>
                            <Button
                              size="small"
                              onClick={() => navigate(paymentReturnOrderNo
                                ? `/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
                                : '/track-order')}
                            >
                              {t('pages.paymentInstructions.stickyTrackOrder')}
                            </Button>
                            <Button
                              size="small"
                              onClick={() => dispatchDomEvent('shop:open-support', paymentReturnOrderNo
                                ? { orderNo: paymentReturnOrderNo }
                                : undefined)}
                            >
                              {t('pages.profile.contactSupport')}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  />
                ) : null}
                <div className="profile-after-sale-panel">
                  <div className="profile-after-sale-panel__main">
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.afterSaleAssistantTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{afterSaleFocusText}</span>
                  </div>
                  <div className="profile-after-sale-panel__metrics">
                    <button
                      type="button"
                      className={orderStatusFilter === 'RETURNABLE' ? 'is-active' : ''}
                      aria-pressed={orderStatusFilter === 'RETURNABLE'}
                      aria-label={`${t('pages.profile.afterSaleReturnable')}: ${returnableOrdersCount}`}
                      onClick={() => setOrderStatusFilter('RETURNABLE')}
                    >
                      <strong>{returnableOrdersCount}</strong>
                      <span>{t('pages.profile.afterSaleReturnable')}</span>
                    </button>
                    <button
                      type="button"
                      className={orderStatusFilter === 'AFTER_SALE' ? 'is-active' : ''}
                      aria-pressed={orderStatusFilter === 'AFTER_SALE'}
                      aria-label={`${t('pages.profile.afterSaleActiveCases')}: ${afterSaleCount}`}
                      onClick={() => setOrderStatusFilter('AFTER_SALE')}
                    >
                      <strong>{afterSaleCount}</strong>
                      <span>{t('pages.profile.afterSaleActiveCases')}</span>
                    </button>
                    <button
                      type="button"
                      className={orderStatusFilter === 'RETURN_APPROVED' ? 'is-active' : ''}
                      aria-pressed={orderStatusFilter === 'RETURN_APPROVED'}
                      aria-label={`${t('pages.profile.afterSaleNeedShipment')}: ${returnApprovedCount}`}
                      onClick={() => setOrderStatusFilter('RETURN_APPROVED')}
                    >
                      <strong>{returnApprovedCount}</strong>
                      <span>{t('pages.profile.afterSaleNeedShipment')}</span>
                    </button>
                  </div>
                </div>
                {ordersStale ? (
                  <Alert
                    type="warning"
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={t('pages.profile.ordersStaleWarning')}
                    action={<Button size="small" onClick={() => fetchOrders()}>{t('common.retry')}</Button>}
                  />
                ) : null}
                <div className="profile-orders__tabs">
                  {orderStatusTabs.map((tab) => {
                    const count = tab.key === 'all'
                      ? orders.length
                      : tab.key === 'RETURNABLE'
                        ? returnableOrdersCount
                        : orders.filter((order) => tab.statuses?.includes(order.status)).length;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={orderStatusFilter === tab.key ? 'profile-orders__tab profile-orders__tab--active' : 'profile-orders__tab'}
                        aria-pressed={orderStatusFilter === tab.key}
                        onClick={() => setOrderStatusFilter(tab.key)}
                      >
                        {tab.label}{tab.key !== 'all' && count > 0 ? ` ${count}` : ''}
                      </button>
                    );
                  })}
                </div>
                <div className="profile-orders__toolbar">
                  <Input.Search
                    className="profile-orders__searchInput"
                    allowClear
                    value={orderSearchText}
                    onChange={(event) => setOrderSearchText(event.target.value)}
                    placeholder={t('pages.profile.orderSearchPlaceholder')}
                    aria-label={orderSearchInputLabel}
                    title={orderSearchInputLabel}
                  />
                  <Button aria-label={refreshOrdersActionLabel} title={refreshOrdersActionLabel} onClick={() => fetchOrders()}>{t('common.refresh')}</Button>
                </div>
                <div className="profile-orders__header">
                  <span>{t('pages.profile.orderInfo')}</span>
                  <span>{t('pages.profile.goodsAmount')}</span>
                  <span>{t('pages.profile.paidAmount')}</span>
                  <span>{t('pages.profile.orderActions')}</span>
                </div>
                {filteredOrders.length === 0 ? (
                  <div data-profile-orders-filter-empty="true">
                    <PageEmpty
                      className="profile-empty-orders profile-empty-orders--filtered"
                      description={(
                        <div className="profile-empty-orders__copy">
                          <div>{t('pages.profile.noFilterOrders')}</div>
                          <div className="profile-empty-orders__hint">{t('pages.profile.noFilterOrdersHint')}</div>
                        </div>
                      )}
                      actions={[
                        {
                          key: 'clear-filter',
                          label: t('pages.profile.clearOrderFilter'),
                          onClick: () => setOrderStatusFilter('all'),
                          type: 'primary',
                        },
                        {
                          key: 'shop',
                          label: t('pages.profile.goShopping'),
                          onClick: () => navigate('/products'),
                          type: 'default',
                        },
                        {
                          key: 'coupons',
                          label: t('pages.profile.emptyOrdersCoupons'),
                          onClick: () => navigate('/coupons'),
                          type: 'default',
                        },
                        {
                          key: 'track',
                          label: t('pages.profile.authGateTrackOrder'),
                          onClick: () => navigate('/track-order'),
                          type: 'default',
                        },
                      ]}
                    />
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const items = orderItemsByOrderId[order.id] || [];
                    const itemPreviewFailed = Boolean(orderItemPreviewFailedByOrderId[order.id]);
                    const primaryItem = items[0];
                    const primaryItemName = primaryItem ? profileOrderItemName(primaryItem) : '';
                    const primaryItemActionLabel = primaryItem ? `${t('pages.productList.viewDetails')}: ${primaryItemName}` : '';
                    const actionHint = getOrderActionHint(order);
                    const orderLabel = profileOrderLabel(order);
                    const retryOrderItemsActionLabel = `${t('common.retry')}: ${t('pages.profile.orderItems')} ${orderLabel}`;
                    const detailActionLabel = `${t('pages.profile.detail')}: ${orderLabel}`;
                    const continuePayActionLabel = `${t('pages.profile.continuePay')}: ${orderLabel}`;
                    const confirmReceiptActionLabel = `${t('pages.profile.confirmReceipt')}: ${orderLabel}`;
                    const returnActionLabel = `${t('pages.profile.returnOrder')}: ${orderLabel}`;
                    const submitReturnShipmentActionLabel = `${t('pages.profile.submitReturnShipment')}: ${orderLabel}`;
                    const contactSupportActionLabel = `${t('pages.profile.contactSupport')}: ${orderLabel}`;
                    const trackShipmentActionLabel = order.trackingNumber
                      ? `${t('pages.orderTracking.trackShipment')}: ${orderLabel} / ${order.trackingNumber}`
                      : `${t('pages.orderTracking.trackShipment')}: ${orderLabel}`;
                    const cancelOrderActionLabel = `${t('pages.profile.cancelOrder')}: ${orderLabel}`;
                    return (
                      <div className="profile-order-card" key={order.id}>
                        <div className="profile-order-card__top">
                          <div className="profile-page__chipRow">
                            <span className="profile-page__text">{order.createdAt ? new Date(order.createdAt).toLocaleDateString(dateLocale) : '-'}</span>
                            <span className="profile-page__text profile-page__text--strong">{t('pages.profile.orderNo')}{order.orderNo || order.id}</span>
                            <Tag color={getOrderStatusColor(order.status)}>{formatOrderStatusLabel(order.status)}</Tag>
                            <button type="button" className="profile-order-card__link" aria-label={detailActionLabel} title={detailActionLabel} onClick={() => handleViewOrder(order)}>
                              {t('pages.profile.detail')}
                            </button>
                          </div>
                          <span className="profile-page__text profile-page__text--secondary">{order.trackingNumber ? t('pages.profile.trackingNo', { number: order.trackingNumber }) : ''}</span>
                        </div>
                        <div className="profile-order-card__body">
                          <div className="profile-order-card__items">
                            {primaryItem ? (
                              <div className="profile-order-item">
                                <button
                                  type="button"
                                  className="profile-order-item__imageButton"
                                  aria-label={primaryItemActionLabel}
                                  title={primaryItemActionLabel}
                                  onClick={() => openProductDetail(primaryItem.productId)}
                                >
                                  <img
                                    src={resolveOrderImage(primaryItem.imageUrl)}
                                    alt={primaryItemName}
                                    loading="lazy"
                                    decoding="async"
                                    onError={useImageFallback}
                                  />
                                </button>
                                <div className="profile-order-item__main">
                                  <button
                                    type="button"
                                    aria-label={primaryItemActionLabel}
                                    title={primaryItemActionLabel}
                                    onClick={() => openProductDetail(primaryItem.productId)}
                                  >
                                    {primaryItemName}
                                  </button>
                                  <span className="profile-page__text profile-page__text--secondary profile-order-item__unit commerce-atomic commerce-price-quantity">
                                    <span className="commerce-money">{formatMoney(primaryItem.price)}</span>
                                    <span className="commerce-quantity">x {primaryItem.quantity}</span>
                                  </span>
                                  {primaryItem.selectedSpecs ? <span className="profile-page__text profile-page__text--secondary">{formatSelectedSpecs(primaryItem.selectedSpecs, t, language)}</span> : null}
                                  {items.length > 1 ? <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.moreItems', { count: items.length - 1 })}</span> : null}
                                  {order.shippingAddress ? <span className="profile-page__text profile-page__text--secondary">{order.shippingAddress}</span> : null}
                                </div>
                              </div>
                            ) : itemPreviewFailed ? (
                              <div className="profile-order-item__previewError">
                                <span className="profile-page__text profile-page__text--warning">{t('pages.profile.orderItemsPreviewFailed')}</span>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<ShopIcon path={SI.reload} />}
                                  aria-label={retryOrderItemsActionLabel}
                                  title={retryOrderItemsActionLabel}
                                  onClick={() => fetchOrders()}
                                >
                                  {t('common.retry')}
                                </Button>
                              </div>
                            ) : (
                              <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.noOrderItems')}</span>
                            )}
                          </div>
                          <div className="profile-order-card__amount">
                            <span className="profile-page__text profile-page__text--secondary profile-order-card__mobileLabel">{t('pages.profile.goodsAmount')}</span>
                            <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(order.originalAmount || order.totalAmount)}</span>
                            {order.discountAmount && order.discountAmount > 0 ? <span className="profile-page__text profile-page__text--secondary profile-price-text commerce-money">-{formatMoney(order.discountAmount)}</span> : null}
                            <span className="profile-page__text profile-page__text--secondary profile-quantity-text commerce-quantity">x{items.reduce((sum, item) => sum + item.quantity, 0) || 1}</span>
                          </div>
                          <div className="profile-order-card__paid">
                            <span className="profile-page__text profile-page__text--secondary profile-order-card__mobileLabel">{t('pages.profile.paidAmount')}</span>
                            <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(order.totalAmount)}</span>
                            <span className="profile-page__text profile-page__text--secondary profile-order-card__shippingIncluded commerce-atomic">
                              <span>{t('pages.profile.includesShipping', { amount: '' }).trim()}</span>
                              <span className="commerce-money">{formatMoney(order.shippingFee || 0)}</span>
                            </span>
                            <Tag>{t('pages.profile.onlineOrder')}</Tag>
                          </div>
                          <div className="profile-order-card__actions">
                            <div className={`profile-order-card__next profile-order-card__next--${actionHint.tone}`}>
                              <span className="profile-page__text profile-page__text--strong">{actionHint.title}</span>
                              <span className="profile-page__text profile-page__text--secondary">{actionHint.text}</span>
                            </div>
                            {order.status === 'PENDING_PAYMENT' && (
                              <Button type="primary" aria-label={continuePayActionLabel} title={continuePayActionLabel} loading={payingOrderId === order.id} disabled={ordersStale || payingOrderId !== null} onClick={() => handleContinuePayment(order)}>
                                {t('pages.profile.continuePay')}
                              </Button>
                            )}
                            {order.status === 'SHIPPED' && (
                              <Button type="primary" aria-label={confirmReceiptActionLabel} title={confirmReceiptActionLabel} disabled={ordersStale} onClick={() => confirmReceiptOrder(order)}>{t('pages.profile.confirmReceipt')}</Button>
                            )}
                            {isReturnableOrder(order) && (
                              <Button danger aria-label={returnActionLabel} title={returnActionLabel} disabled={ordersStale} onClick={() => openReturnModal(order)}>{t('pages.profile.returnOrder')}</Button>
                            )}
                            {order.status === 'RETURN_REQUESTED' && (
                              <Tag color="gold">{t('status.RETURN_REQUESTED')}</Tag>
                            )}
                            {order.status === 'RETURN_APPROVED' && (
                              <Button type="link" aria-label={submitReturnShipmentActionLabel} title={submitReturnShipmentActionLabel} disabled={ordersStale} onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || ''); }}>
                                {t('pages.profile.submitReturnShipment')}
                              </Button>
                            )}
                            {order.status === 'RETURN_SHIPPED' && (
                              <Tag color="cyan">{t('status.RETURN_SHIPPED')}</Tag>
                            )}
                            {(isReturnableOrder(order) || afterSaleStatuses.includes(order.status)) && (
                              <Button type="link" aria-label={contactSupportActionLabel} title={contactSupportActionLabel} onClick={openSupport}>{t('pages.profile.contactSupport')}</Button>
                            )}
                            <Button type="link" aria-label={detailActionLabel} title={detailActionLabel} onClick={() => handleViewOrder(order)}>{t('pages.profile.detail')}</Button>
                            {order.trackingNumber ? <Button type="link" aria-label={trackShipmentActionLabel} title={trackShipmentActionLabel} onClick={() => handleTrackShipment(order.trackingNumber, order.trackingCarrierCode, order.id)}>{t('pages.orderTracking.trackShipment')}</Button> : null}
                            {order.status === 'PENDING_PAYMENT' && (
                              <Popconfirm
                                classNames={{ root: 'shop-mobile-popup-layer profile-popconfirm' }}
                                title={t('pages.profile.cancelOrderConfirm')}
                                disabled={ordersStale}
                                onConfirm={() => handleCancelOrder(order.id)}
                                okText={t('common.confirm')}
                                cancelText={t('common.cancel')}
                                okButtonProps={{ danger: true, 'aria-label': cancelOrderActionLabel, title: cancelOrderActionLabel }}
                                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cancelOrderActionLabel}`, title: `${t('common.cancel')}: ${cancelOrderActionLabel}` }}
                              >
                                <Button type="link" danger aria-label={cancelOrderActionLabel} title={cancelOrderActionLabel} disabled={ordersStale}>{t('pages.profile.cancelOrder')}</Button>
                              </Popconfirm>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ),
          },
          {
            key: 'pets',
            label: t('pages.profile.pets', { count: petProfiles.length }),
            children: (
              <div>
                <div className="profile-pet-insights">
                  <Card className="profile-pet-insights__card">
                    <div className="profile-page__stack">
                      <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petCompletenessTitle')}</span>
                      <span className="profile-page__text profile-page__text--secondary">{petCompletenessText}</span>
                      <Progress percent={petProfileProgress} size="small" strokeColor="#ff4d00" />
                    </div>
                  </Card>
                  <Card className="profile-pet-insights__card">
                    <div className="profile-page__stack">
                      <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petBirthdayPerkTitle')}</span>
                      <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.petBirthdayPerkText')}</span>
                      <div className="profile-page__chipRow">
                        <Tag color={petsMissingBirthdayCount > 0 ? 'gold' : 'green'}>{t('pages.profile.petMissingBirthday', { count: petsMissingBirthdayCount })}</Tag>
                        <Tag color={petsMissingFitCount > 0 ? 'orange' : 'green'}>{t('pages.profile.petMissingFit', { count: petsMissingFitCount })}</Tag>
                      </div>
                    </div>
                  </Card>
                </div>
                <div className="profile-pet-next-step">
                  <div>
                    <span className="profile-page__text profile-page__text--strong">{t('pages.profile.petProfileActionTitle')}</span>
                    <span className="profile-page__text profile-page__text--secondary">{petProfileFocusText}</span>
                  </div>
                  <Button
                    type="primary"
                    onClick={() => petProfileFocus ? openPetModal(petProfileFocus) : openPetModal()}
                  >
                    {petProfileFocus ? t('pages.profile.completePetProfile') : t('pages.profile.addPet')}
                  </Button>
                </div>
                <div className="profile-pet-shop-path">
                  <div>
                    <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.petShopPathEyebrow')}</span>
                    <span className="profile-page__text profile-page__text--strong">
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathTitleWithName', { name: profilePetShoppingFocus.name })
                        : t('pages.profile.petShopPathTitle')}
                    </span>
                    <span className="profile-page__text profile-page__text--secondary">
                      {profilePetShoppingFocus
                        ? t('pages.profile.petShopPathText', {
                          type: petTypeLabel(profilePetShoppingFocus.petType),
                          size: petSizeLabel(profilePetShoppingFocus.size),
                        })
                        : t('pages.profile.petShopPathEmpty')}
                    </span>
                  </div>
                  <div className="profile-pet-shop-path__actions">
                    {profilePetShoppingFocus ? (
                      <Tag color="green">{t('pages.profile.petShopPathSignalReady')}</Tag>
                    ) : (
                      <Tag color="gold">{t('pages.profile.petShopPathNeedsProfile')}</Tag>
                    )}
                    <Button
                      icon={<ShopIcon path={SI.cart} />}
                      onClick={() => profilePetShoppingFocus ? openPetShoppingPath(profilePetShoppingFocus) : openPetModal()}
                    >
                      {profilePetShoppingFocus ? t('pages.profile.shopForThisPet') : t('pages.profile.addPet')}
                    </Button>
                  </div>
                </div>
                <Button className="profile-block-button profile-section-action" type="dashed" icon={<ShopIcon path={SI.plus} />} block onClick={() => openPetModal()}>
                  {t('pages.profile.addPet')}
                </Button>
                {petProfiles.length === 0 ? (
                  <PageEmpty
                    className="profile-pets-empty"
                    description={(
                      <div className="profile-pets-empty__copy">
                        <div>{t('pages.profile.noPets')}</div>
                        <div className="profile-pets-empty__hint">{t('pages.profile.noPetsHint')}</div>
                      </div>
                    )}
                    actions={[
                      {
                        key: 'add-pet',
                        label: t('pages.profile.addPet'),
                        onClick: () => openPetModal(),
                      },
                      {
                        key: 'pet-finder',
                        label: t('pages.profile.noPetsFindFit'),
                        onClick: () => navigate('/pet-finder'),
                        type: 'default',
                      },
                      {
                        key: 'browse',
                        label: t('pages.profile.noPetsBrowse'),
                        onClick: () => navigate('/products'),
                        type: 'default',
                      },
                    ]}
                  />
                ) : (
                  <List
                    grid={{ gutter: 16, xs: 1, sm: 2, md: 2 }}
                    dataSource={petProfiles}
                    renderItem={(pet) => {
                      const petLabel = pet.name || `#${pet.id}`;
                      const editActionLabel = `${t('common.edit')}: ${petLabel}`;
                      const deleteActionLabel = `${t('common.delete')}: ${petLabel}`;
                      const shopActionLabel = `${t('pages.profile.shopForThisPet')}: ${petLabel}`;
                      return (
                      <List.Item>
                        <Card
                          className="profile-section-card profile-pet-card"
                          title={pet.name}
                          extra={<Tag color="green">{petTypeLabel(pet.petType)}</Tag>}
                          actions={[
                            <Button type="link" icon={<ShopIcon path={SI.edit} />} aria-label={editActionLabel} title={editActionLabel} onClick={() => openPetModal(pet)}>{t('common.edit')}</Button>,
                            <Popconfirm
                              classNames={{ root: 'shop-mobile-popup-layer profile-popconfirm' }}
                              title={t('pages.profile.deletePetConfirm')}
                              onConfirm={() => handleDeletePet(pet.id)}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                            >
                              <Button type="link" danger icon={<ShopIcon path={SI.delete} />} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
                            </Popconfirm>,
                          ]}
                        >
                          <div className="profile-page__stack">
                            <span className="profile-page__text">{t('pages.profile.petBreed')}: {pet.breed || t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petBirthday')}: {pet.birthday || t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petWeight')}: {pet.weight ? t('pages.profile.petWeightValue', { weight: pet.weight }) : t('common.unset')}</span>
                            <span className="profile-page__text">{t('pages.profile.petSize')}: {petSizeLabel(pet.size)}</span>
                            {pet.birthday ? <Tag color="gold">{t('pages.profile.birthdayCouponEnabled')}</Tag> : null}
                            <Button size="small" icon={<ShopIcon path={SI.cart} />} aria-label={shopActionLabel} title={shopActionLabel} onClick={() => openPetShoppingPath(pet)}>
                              {t('pages.profile.shopForThisPet')}
                            </Button>
                          </div>
                        </Card>
                      </List.Item>
                      );
                    }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={t('pages.profile.editProfileTitle')}
        open={editModalVisible}
        onOk={handleEditProfile}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields(['emailCode']);
          setProfileEmailCodeSentTo('');
          setProfileEmailCodeCountdown(0);
        }}
        confirmLoading={profileSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': editProfileActionLabel, title: editProfileActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${editProfileActionLabel}`, title: `${t('common.cancel')}: ${editProfileActionLabel}` }}
        className="profile-mobile-safe-modal"
      >
        <Form form={editForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item
            name="email"
            label={t('pages.profile.email')}
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.profile.emailInvalid') },
            ]}
          >
            <Input prefix={<ShopIcon path={SI.mail} />} />
          </Form.Item>
          {profileEmailChanged && !emailCodeEnabled && (
            <div className="profile-email-code-warning" role="status">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.emailCodeUnavailable')}</span>
            </div>
          )}
          {profileEmailCodeSentTo && (
            <span className="profile-page__text profile-page__text--secondary">
              {t('pages.profile.emailCodeSentHint', {
                email: profileEmailCodeSentTo,
                minutes: profileEmailCodeTtlMinutes || 0,
              })}
            </span>
          )}
          <Form.Item
            name="emailCode"
            label={t('pages.profile.emailVerificationCode')}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const normalizedEmail = normalizeProfileEmail(getFieldValue('email'));
                  if (normalizedEmail === normalizeProfileEmail(user?.email)) return Promise.resolve();
                  if (normalizeEmailCode(value).length === 6) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.auth.emailCodeLength')));
                },
              }),
            ]}
          >
            <Input
              prefix={<ShopIcon path={SI.safety} />}
              maxLength={12}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={profileSubmitting || (profileEmailChanged && !emailCodeEnabled)}
              onChange={(event) => {
                const normalized = normalizeEmailCode(event.target.value);
                if (normalized !== event.target.value) {
                  editForm.setFieldValue('emailCode', normalized);
                }
              }}
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  loading={profileEmailCodeSending}
                  disabled={profileSubmitting || profileEmailCodeSending || profileEmailCodeCountdown > 0 || !emailCodeEnabled}
                  onClick={handleSendProfileEmailCode}
                >
                  {profileEmailCodeSending
                    ? t('pages.auth.emailCodeSending')
                    : profileEmailCodeCountdown > 0
                    ? t('pages.auth.resendIn', { seconds: profileEmailCodeCountdown })
                    : t('pages.auth.sendCode')}
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('pages.profile.phone')}
            rules={[
              { validator: (_, value) => (!value || isLikelyProfilePhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.auth.phoneInvalid')))) },
            ]}
          >
            <Input
              maxLength={40}
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              aria-label={profilePhoneInputLabel}
              title={profilePhoneInputLabel}
              onBlur={(event) => editForm.setFieldValue('phone', normalizeLikelyProfilePhone(event.target.value))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('pages.profile.changePassword')}
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={closePasswordModal}
        confirmLoading={passwordSubmitting}
        okText={t('pages.profile.changePassword')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': changePasswordActionLabel, title: changePasswordActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${changePasswordActionLabel}`, title: `${t('common.cancel')}: ${changePasswordActionLabel}` }}
        className="profile-mobile-safe-modal"
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item name="oldPassword" label={t('pages.profile.oldPassword')} rules={[{ required: true, message: t('pages.profile.oldPasswordRequired') }]}>
            <Input.Password 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', lineHeight: 0, cursor: 'pointer' }}
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
          <Form.Item name="newPassword" label={t('pages.profile.newPassword')} rules={[
            { required: true, min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.profile.newPasswordMin') },
            { validator: validateStrongPassword }
          ]}>
            <Input.Password maxLength={STRONG_PASSWORD_MAX_LENGTH} 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', lineHeight: 0, cursor: 'pointer' }}
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('pages.profile.confirmNewPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('pages.profile.confirmNewRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.profile.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', lineHeight: 0, cursor: 'pointer' }}
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingAddress ? t('pages.profile.editAddressTitle') : t('pages.profile.addAddressTitle')}
        open={addressModalVisible}
        onOk={handleSaveAddress}
        onCancel={closeAddressModal}
        confirmLoading={addressSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': saveAddressActionLabel, title: saveAddressActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${saveAddressActionLabel}`, title: `${t('common.cancel')}: ${saveAddressActionLabel}` }}
        width={560}
        className="profile-mobile-safe-modal profile-address-modal"
        destroyOnHidden
      >
        <Form form={addressForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']} onFocusCapture={(event) => scrollProfileAddressFieldIntoMobileView(event.target)}>
          <Form.Item name="recipientName" label={t('pages.profile.recipient')} rules={[{ required: true, message: t('pages.profile.recipientRequired') }]}>
            <Input placeholder={t('pages.profile.recipientRequired')} autoComplete="name" maxLength={80} />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('pages.profile.phone')}
            rules={[
              { required: true, message: t('pages.profile.phoneRequired') },
              { validator: (_, value) => (!value || isLikelyProfilePhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.auth.phoneInvalid')))) },
            ]}
          >
            <Input
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              aria-label={addressPhoneInputLabel}
              title={addressPhoneInputLabel}
              onBlur={(event) => addressForm.setFieldValue('phone', normalizeLikelyProfilePhone(event.target.value))}
            />
          </Form.Item>
          <Form.Item name="region" label={t('pages.profile.region')} rules={[{ required: true, message: t('pages.profile.regionRequired') }]}>
            <Cascader
              options={regionOptions}
              placeholder={regionOptionsLoading ? t('common.loading') : t('pages.profile.regionPlaceholder')}
              showSearch
              aria-label={addressRegionInputLabel}
              title={addressRegionInputLabel}
              onClick={() => {
                void loadProfileRegionOptions();
              }}
              onFocus={() => {
                void loadProfileRegionOptions();
              }}
              classNames={profileModalPopupClassNames}
              getPopupContainer={() => document.body}
              placement="bottomLeft"
            />
          </Form.Item>
          <Form.Item
            name="postalCode"
            label={t('pages.profile.postalCode')}
            dependencies={['region']}
            rules={[
              { required: true, message: t('pages.profile.postalCodeRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value) => (
                  !value || isValidRegionalPostalCode(value, getFieldValue('region'))
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('pages.profile.postalCodeInvalid')))
                ),
              }),
            ]}
          >
            <Input
              placeholder={t('pages.profile.postalCodePlaceholder')}
              autoComplete="postal-code"
              inputMode="text"
              maxLength={20}
              onBlur={(event) => addressForm.setFieldValue('postalCode', normalizeRegionalPostalCode(event.target.value))}
            />
          </Form.Item>
          <Form.Item name="detail" label={t('pages.profile.detailAddress')} rules={[{ required: true, message: t('pages.profile.detailRequired') }]}>
            <Input.TextArea rows={3} placeholder={t('pages.profile.detailRequired')} autoComplete="street-address" maxLength={260} showCount />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Checkbox>{t('pages.profile.makeDefaultAddress')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPet ? t('pages.profile.editPet') : t('pages.profile.addPet')}
        open={petModalVisible}
        onOk={handleSavePet}
        onCancel={closePetModal}
        confirmLoading={petSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': savePetActionLabel, title: savePetActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${savePetActionLabel}`, title: `${t('common.cancel')}: ${savePetActionLabel}` }}
        className="profile-mobile-safe-modal"
        destroyOnHidden
      >
        <Form form={petForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item name="name" label={t('pages.profile.petName')} rules={[{ required: true, message: t('pages.profile.petNameRequired') }]}>
            <Input placeholder={t('pages.profile.petNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="petType" label={t('pages.profile.petType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DOG', label: t('pages.profile.petDog') },
                { value: 'CAT', label: t('pages.profile.petCat') },
                { value: 'SMALL_PET', label: t('pages.profile.petSmall') },
              ]}
              classNames={profileModalPopupClassNames}
              getPopupContainer={() => document.body}
              placement="bottomLeft"
            />
          </Form.Item>
          <Form.Item name="breed" label={t('pages.profile.petBreed')}>
            <Input placeholder={t('pages.profile.petBreedPlaceholder')} />
          </Form.Item>
          <Form.Item name="birthday" label={t('pages.profile.petBirthday')}>
            <DatePicker className="profile-pet-modal__field" classNames={profileModalPopupClassNames} getPopupContainer={() => document.body} placement="bottomLeft" />
          </Form.Item>
          <Form.Item name="weight" label={t('pages.profile.petWeightKg')}>
            <InputNumber min={0} precision={2} className="profile-pet-modal__field" />
          </Form.Item>
          <Form.Item name="size" label={t('pages.profile.petSize')}>
            <Select
              allowClear
              options={[
                { value: 'SMALL', label: t('pages.profile.petSizeSmall') },
                { value: 'MEDIUM', label: t('pages.profile.petSizeMedium') },
                { value: 'LARGE', label: t('pages.profile.petSizeLarge') },
              ]}
              classNames={profileModalPopupClassNames}
              getPopupContainer={() => document.body}
              placement="bottomLeft"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pages.profile.orderDetail', { id: selectedOrder?.orderNo || selectedOrder?.id || '' })} open={orderDetailVisible} onCancel={() => setOrderDetailVisible(false)} footer={null} width={640} className="profile-mobile-safe-modal profile-order-detail-modal">
        {selectedOrder && (
          <div>
            <Descriptions column={1} bordered size="small" className="profile-order-detail__descriptions">
              <Descriptions.Item label={t('common.status')}><Tag color={getOrderStatusColor(selectedOrder.status)}>{formatOrderStatusLabel(selectedOrder.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}><span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(selectedOrder.totalAmount)}</span></Descriptions.Item>
              {selectedOrder.originalAmount ? <Descriptions.Item label={t('common.subtotal')}><span className="commerce-money">{formatMoney(selectedOrder.originalAmount)}</span></Descriptions.Item> : null}
              {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 ? (
                <Descriptions.Item label={t('pages.checkout.coupon')}>{selectedOrder.couponName || '-'} / <span className="commerce-money">-{formatMoney(selectedOrder.discountAmount)}</span></Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('pages.checkout.address')}>{selectedOrder.shippingAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>{selectedOrder.paymentMethod ? paymentMethodLabel(selectedOrder.paymentMethod, t) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.adminOrders.tracking')}>
                {selectedOrder.trackingNumber ? (
                  <div className="profile-page__inlineRow">
                    <span>{selectedOrder.trackingNumber}</span>
                    {selectedOrder.trackingCarrierName ? <Tag>{selectedOrder.trackingCarrierName}</Tag> : null}
                    <Button size="small" aria-label={selectedOrderTrackActionLabel} title={selectedOrderTrackActionLabel} onClick={() => handleTrackShipment(selectedOrder.trackingNumber, selectedOrder.trackingCarrierCode, selectedOrder.id)}>{t('pages.adminOrders.track')}</Button>
                  </div>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnTracking')}>{selectedOrder.returnTrackingNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnDeadline')}>
                {selectedOrder.returnDeadline ? new Date(selectedOrder.returnDeadline).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.returnReason')}>{selectedOrder.returnReason || '-'}</Descriptions.Item>
              {selectedOrder.returnRequestedAt ? (
                <Descriptions.Item label={t('pages.profile.returnRequestedAt')}>{new Date(selectedOrder.returnRequestedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnApprovedAt ? (
                <Descriptions.Item label={t('pages.profile.returnApprovedAt')}>{new Date(selectedOrder.returnApprovedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnRejectedAt ? (
                <Descriptions.Item label={t('pages.profile.returnRejectedAt')}>{new Date(selectedOrder.returnRejectedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnShippedAt ? (
                <Descriptions.Item label={t('pages.profile.returnShippedAt')}>{new Date(selectedOrder.returnShippedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.returnedAt ? (
                <Descriptions.Item label={t('pages.profile.returnedAt')}>{new Date(selectedOrder.returnedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              {selectedOrder.refundedAt ? (
                <Descriptions.Item label={t('pages.profile.refundedAt')}>{new Date(selectedOrder.refundedAt).toLocaleString(dateLocale)}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label={t('pages.profile.shippedAt')}>{selectedOrder.shippedAt ? new Date(selectedOrder.shippedAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.completedAt')}>{selectedOrder.completedAt ? new Date(selectedOrder.completedAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('pages.adminOrders.createdAt')}>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString(dateLocale) : '-'}</Descriptions.Item>
            </Descriptions>
            <div className="profile-order-detail__itemsHeader">
              <h5 className="profile-page__title profile-order-detail__itemsTitle">{t('pages.profile.orderItems')}</h5>
              <Button icon={<ShopIcon path={SI.cart} />} loading={reordering} disabled={orderItems.length === 0} aria-label={reorderSelectedOrderActionLabel} title={reorderSelectedOrderActionLabel} onClick={handleReorder}>
                {t('pages.profile.reorder')}
              </Button>
            </div>
            {orderItems.length > 0 ? (
              <List
                dataSource={orderItems}
                renderItem={(item) => {
                  const itemName = profileOrderItemName(item);
                  const itemActionLabel = `${t('pages.productList.viewDetails')}: ${itemName}`;
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <button
                            type="button"
                            aria-label={itemActionLabel}
                            title={itemActionLabel}
                            onClick={() => openProductDetail(item.productId)}
                            className="profile-order-detail__imageButton"
                          >
                            <img
                              src={resolveOrderImage(item.imageUrl)}
                              alt={itemName}
                              className="profile-order-detail__image"
                              loading="lazy"
                              decoding="async"
                              onError={useImageFallback}
                            />
                          </button>
                        }
                        title={
                          <button
                            type="button"
                            aria-label={itemActionLabel}
                            title={itemActionLabel}
                            onClick={() => openProductDetail(item.productId)}
                            className="profile-order-detail__productButton"
                          >
                            {itemName}
                          </button>
                        }
                        description={
                          <div className="profile-page__stackTight">
                            {item.selectedSpecs ? <span className="profile-page__text profile-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                            <span className="profile-page__text profile-page__text--secondary profile-order-detail__unit commerce-atomic commerce-price-quantity">
                              <span className="commerce-money">{formatMoney(item.price)}</span>
                              <span className="commerce-quantity">x {item.quantity}</span>
                            </span>
                          </div>
                        }
                      />
                      <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(item.price * item.quantity)}</span>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.noOrderItems')}</span>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={t('pages.profile.submitReturnShipment')}
        open={!!returnShipmentOrder}
        confirmLoading={submittingReturnShipment}
        okText={t('pages.profile.submitReturnShipment')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': submitReturnShipmentActionLabel,
          title: submitReturnShipmentActionLabel,
          disabled: !isReturnTrackingReady(returnTrackingNumber),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${submitReturnShipmentActionLabel}`, title: `${t('common.cancel')}: ${submitReturnShipmentActionLabel}` }}
        onOk={handleSubmitReturnShipment}
        onCancel={() => { setReturnShipmentOrder(null); setReturnTrackingNumber(''); }}
        className="profile-mobile-safe-modal profile-return-modal"
      >
        <div className="profile-return-modal__content">
          {returnShipmentOrder ? (
            <div className="profile-return-modal__summary">
              <span className="profile-page__text profile-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: returnShipmentOrder.orderNo || returnShipmentOrder.id,
                  amount: formatMoney(returnShipmentOrder.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnShipmentStepsTitle')}>
            <span className="profile-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnShipmentStepsTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.returnShipmentHint')}</span>
          <Input
            value={returnTrackingNumber}
            onChange={(e) => setReturnTrackingNumber(e.target.value)}
            placeholder={t('pages.profile.returnTrackingPlaceholder')}
            autoComplete="off"
            inputMode="text"
            maxLength={120}
            status={returnTrackingNumber && !isReturnTrackingReady(returnTrackingNumber) ? 'error' : undefined}
            aria-label={returnTrackingInputLabel}
            title={returnTrackingInputLabel}
            onBlur={() => setReturnTrackingNumber((value) => normalizeReturnTrackingNumber(value))}
          />
        </div>
      </Modal>

      <Modal
        title={t('pages.profile.returnOrder')}
        open={!!returnRequestOrder}
        confirmLoading={requestingReturn}
        okText={t('pages.profile.returnOrder')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': submitReturnRequestActionLabel,
          title: submitReturnRequestActionLabel,
          disabled: !isReturnReasonReady(returnReason),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${submitReturnRequestActionLabel}`, title: `${t('common.cancel')}: ${submitReturnRequestActionLabel}` }}
        onOk={handleReturnOrder}
        onCancel={() => { setReturnRequestOrder(null); setReturnReason(''); }}
        className="profile-mobile-safe-modal profile-return-modal"
      >
        <div className="profile-return-modal__content">
          {returnRequestOrder ? (
            <div className="profile-return-modal__summary" aria-label={t('pages.profile.returnOrderSummary', {
              orderNo: returnRequestOrder.orderNo || returnRequestOrder.id,
              amount: formatMoney(returnRequestOrder.totalAmount),
            })}>
              <span className="profile-page__text profile-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: returnRequestOrder.orderNo || returnRequestOrder.id,
                  amount: formatMoney(returnRequestOrder.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnTimelineTitle')}>
            <span className="profile-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnTimelineTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.returnReviewHint')}</span>
          {returnRequestOrder?.returnDeadline ? (
            <span className="profile-page__text profile-page__text--secondary">
              {t('pages.profile.returnAvailableUntil', { time: new Date(returnRequestOrder.returnDeadline).toLocaleString(dateLocale) })}
            </span>
          ) : null}
          <div className="profile-return-modal__presets" role="group" aria-label={t('pages.profile.returnReasonPresetsLabel')}>
            <span className="profile-page__text profile-return-modal__presetsLabel">{t('pages.profile.returnReasonPresetsLabel')}</span>
            <div className="profile-return-modal__presetGrid">
              {RETURN_REASON_PRESET_KEYS.map((preset) => {
                const label = t(returnReasonPresetI18nKey(preset));
                const selected = normalizeReturnReason(returnReason).toLowerCase() === label.toLowerCase();
                return (
                  <Button
                    key={preset}
                    size="small"
                    type={selected ? 'primary' : 'default'}
                    className="profile-return-modal__preset"
                    aria-label={label}
                    title={label}
                    aria-pressed={selected}
                    onClick={() => setReturnReason(label)}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            value={returnReason}
            status={returnReason && !isReturnReasonReady(returnReason) ? 'error' : undefined}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder={t('pages.profile.returnReasonPlaceholder')}
            aria-label={returnReasonInputLabel}
            title={returnReasonInputLabel}
          />
        </div>
      </Modal>

      <Modal
        title={t('pages.adminOrders.logisticsTracking')}
        open={trackingVisible}
        onCancel={() => setTrackingVisible(false)}
        footer={null}
        width={720}
        className="profile-mobile-safe-modal profile-tracking-modal"
      >
        <SeventeenTrackWidget trackingNumber={selectedTrackingNumber} carrierCode={selectedTrackingCarrierCode} orderId={selectedTrackingOrderId} />
      </Modal>

      <Modal
        title={t('pages.profile.continuePay')}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        className="profile-mobile-safe-modal profile-payment-modal"
        footer={[
          selectedPayment?.status === 'PENDING' && selectedPayment.paymentUrl && (
            <Button
              key="pay"
              type="primary"
              aria-label={openPaymentActionLabel}
              title={openPaymentActionLabel}
              onClick={() => {
                if (!navigateToCommercialPaymentUrl(selectedPayment.paymentUrl)) {
                  announceAccessibleMessage(t('pages.payment.failed'), 'error');
                }
              }}
            >
              {t('pages.checkout.openPayment')}
            </Button>
          ),
          selectedPayment && !selectedPaymentPaid && !selectedPaymentReconcileRequired && (
            <Button key="refresh" loading={refreshingPayment} disabled={paymentChannelsLoading || paymentOptions.length === 0} aria-label={refreshPaymentActionLabel} title={refreshPaymentActionLabel} onClick={handleRefreshPayment}>
              {t('pages.profile.refreshPayment')}
            </Button>
          ),
          <Button key="close" aria-label={closePaymentActionLabel} title={closePaymentActionLabel} onClick={() => setPaymentModalVisible(false)}>{t('common.cancel')}</Button>,
        ].filter(Boolean)}
      >
        {selectedOrder && selectedPayment && (
          <div className="profile-payment-modal__content">
            <div className="profile-payment-recovery" role="status" aria-live="polite">
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryStatus')}</span>
                <Tag color={selectedPaymentReconcileRequired ? 'magenta' : selectedPaymentPaid ? 'green' : selectedPaymentExpiredOrFailed ? 'red' : selectedPaymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                  {selectedPaymentReconcileRequired
                    ? t('pages.checkout.paymentRecoveryReconcileRequired')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                    ? t('status.REFUNDED')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDING'
                    ? t('status.REFUNDING')
                    : selectedPaymentPaid
                    ? t('pages.checkout.paymentRecoveryPaid')
                    : selectedPaymentFailed
                      ? t('pages.checkout.paymentRecoveryFailed')
                      : selectedPaymentRecovery.isExpired
                        ? t('pages.checkout.paymentRecoveryExpired')
                        : t('pages.checkout.paymentRecoveryPending')}
                </Tag>
              </div>
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryWindow')}</span>
                <span className={`profile-page__text ${selectedPaymentRecovery.isExpired ? 'danger' : selectedPaymentRecovery.isExpiringSoon ? 'profile-page__text--warning' : 'profile-page__text--secondary'}`}>
                  {selectedPaymentRecovery.minutesLeft === null
                    ? t('pages.checkout.paymentRecoveryWindowUnknown')
                    : selectedPaymentRecovery.isExpired
                      ? t('pages.checkout.paymentRecoveryWindowExpired')
                      : t('pages.checkout.paymentRecoveryWindowMinutes', { count: selectedPaymentRecovery.minutesLeft })}
                </span>
              </div>
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryNext')}</span>
                <span className="profile-page__text profile-page__text--secondary">
                  {selectedPaymentReconcileRequired
                    ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                    ? t('pages.profile.paymentRefundedNext')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDING'
                    ? t('pages.profile.paymentRefundingNext')
                    : selectedPaymentPaid
                    ? t('pages.checkout.paymentRecoveryNextPaid')
                    : selectedPaymentFailed
                      ? t('pages.checkout.paymentRecoveryNextFailed')
                      : selectedPaymentRecovery.isExpired
                        ? t('pages.checkout.paymentRecoveryNextRetry')
                        : selectedPayment.paymentUrl
                          ? t('pages.checkout.paymentRecoveryNextOpen')
                          : t('pages.checkout.paymentRecoveryNextRetry')}
                </span>
              </div>
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('pages.profile.orderNo')}>{selectedOrder.orderNo || selectedOrder.id}</Descriptions.Item>
              <Descriptions.Item label={t('common.amount')}>
                <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(selectedOrder.totalAmount)}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentMethod')}>
                <Select
                  className="profile-payment-modal__methodSelect"
                  value={selectedPaymentMethod}
                  options={paymentOptions}
                  onChange={setSelectedPaymentMethod}
                  classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
                  getPopupContainer={() => document.body}
                  disabled={selectedPaymentPaid || selectedPaymentReconcileRequired || paymentChannelsLoading || paymentOptions.length === 0}
                  aria-label={paymentMethodSelectLabel}
                  title={paymentMethodSelectLabel}
                />
                {paymentOptions.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={t('pages.checkout.paymentUnavailable')}
                    description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
                    action={(
                      <Button
                        size="small"
                        loading={paymentChannelsLoading}
                        aria-label={retryPaymentChannelsActionLabel}
                        title={retryPaymentChannelsActionLabel}
                        onClick={() => void loadPaymentChannels()}
                      >
                        {t('common.retry')}
                      </Button>
                    )}
                  />
                ) : null}
                {selectedPaymentMethodDetail ? (
                  <div className="profile-payment-method-hint">
                    <Tag color={selectedPaymentMethodDetail.value === 'OXXO' ? 'orange' : selectedPaymentMethodDetail.value === 'SPEI' ? 'blue' : 'green'}>
                      {t(selectedPaymentMethodDetail.badgeKey)}
                    </Tag>
                    <span className="profile-page__text profile-page__text--secondary">{t(selectedPaymentMethodDetail.descriptionKey)}</span>
                  </div>
                ) : null}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                <Tag color={getPaymentStatusColor(selectedPayment.status)}>
                  {formatPaymentStatusLabel(selectedPayment.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.checkout.paymentLink')}>
                {selectedPayment.paymentUrl && !selectedPaymentPaid && !selectedPaymentReconcileRequired && !selectedPaymentExpiredOrFailed ? (
                  <Button
                    type="link"
                    className="profile-payment-link"
                    aria-label={paymentLinkActionLabel}
                    title={paymentLinkActionLabel}
                    onClick={() => {
                      if (!navigateToCommercialPaymentUrl(selectedPayment.paymentUrl)) {
                        announceAccessibleMessage(t('pages.payment.failed'), 'error');
                      }
                    }}
                  >
                    {formatPaymentUrlLabel(selectedPayment.paymentUrl)}
                  </Button>
                ) : selectedPaymentReconcileRequired ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextReconcileRequired')}</span>
                ) : selectedPaymentFailed ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextFailed')}</span>
                ) : selectedPaymentRecovery.isExpired ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextRetry')}</span>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.profile.paymentExpiresAt')}>
                {selectedPayment.expiresAt ? new Date(selectedPayment.expiresAt).toLocaleString(dateLocale) : '-'}
              </Descriptions.Item>
              {selectedPayment.paidAt ? (
                <Descriptions.Item label={t('pages.profile.paidAt')}>
                  {new Date(selectedPayment.paidAt).toLocaleString(dateLocale)}
                </Descriptions.Item>
              ) : null}
              {selectedPayment.refundedAt ? (
                <Descriptions.Item label={t('pages.profile.refundedAt')}>
                  {new Date(selectedPayment.refundedAt).toLocaleString(dateLocale)}
                </Descriptions.Item>
              ) : null}
              {selectedPayment.transactionId && (
                <Descriptions.Item label={t('pages.checkout.transactionId')}>{selectedPayment.transactionId}</Descriptions.Item>
              )}
            </Descriptions>
            {normalizeStatusCode(selectedPayment.status) === 'REFUNDED' || normalizeStatusCode(selectedPayment.status) === 'REFUNDING' ? (
              <Alert
                type={normalizeStatusCode(selectedPayment.status) === 'REFUNDED' ? 'success' : 'info'}
                showIcon
                className="profile-payment-refund-audit"
                message={normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                  ? t('pages.profile.paymentRefundedTitle')
                  : t('pages.profile.paymentRefundingTitle')}
                description={normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                  ? t('pages.profile.paymentRefundedText', {
                    date: selectedPayment.refundedAt
                      ? new Date(selectedPayment.refundedAt).toLocaleString(dateLocale)
                      : t('common.unknown'),
                  })
                  : t('pages.profile.paymentRefundingText')}
              />
            ) : null}
            <div>
              <span className="profile-page__text profile-page__text--strong">{t('pages.profile.paymentHistory')}</span>
              <List
                size="small"
                dataSource={orderPayments}
                locale={{
                  emptyText: (
                    <div className="profile-payment-history__empty" data-profile-payment-history-empty="true">
                      <div className="profile-payment-history__emptyCopy">
                        <div>{t('pages.profile.noPaymentHistory')}</div>
                        <div className="profile-payment-history__emptyHint">{t('pages.profile.noPaymentHistoryHint')}</div>
                      </div>
                      <div className="profile-payment-history__emptyActions" data-profile-payment-history-empty-actions="true">
                        <Button
                          type="primary"
                          aria-label={t('pages.profile.authGateTrackOrder')}
                          title={t('pages.profile.authGateTrackOrder')}
                          onClick={() => navigate('/track-order')}
                        >
                          {t('pages.profile.authGateTrackOrder')}
                        </Button>
                        <Button
                          aria-label={t('pages.profile.goShopping')}
                          title={t('pages.profile.goShopping')}
                          onClick={() => navigate('/products')}
                        >
                          {t('pages.profile.goShopping')}
                        </Button>
                        <Button
                          aria-label={t('pages.profile.emptyOrdersCoupons')}
                          title={t('pages.profile.emptyOrdersCoupons')}
                          onClick={() => navigate('/coupons')}
                        >
                          {t('pages.profile.emptyOrdersCoupons')}
                        </Button>
                        <Button
                          aria-label={t('pages.productList.loadRecoverySupport')}
                          title={t('pages.productList.loadRecoverySupport')}
                          onClick={() => dispatchDomEvent('shop:open-support')}
                        >
                          {t('pages.productList.loadRecoverySupport')}
                        </Button>
                      </div>
                    </div>
                  ),
                }}
                renderItem={(payment) => (
                  <List.Item>
                    <div className="profile-payment-history__item">
                      <div className="profile-page__chipRow">
                        <Tag color={getPaymentStatusColor(payment.status)}>
                          {formatPaymentStatusLabel(payment.status)}
                        </Tag>
                        <span className="profile-page__text">{paymentMethodLabel(payment.channel, t)}</span>
                        {payment.amount ? <span className="profile-page__text profile-page__text--secondary commerce-money">{formatMoney(payment.amount)}</span> : null}
                      </div>
                      <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleString(dateLocale) : ''}
                      </span>
                      {payment.paidAt ? (
                        <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                          {t('pages.profile.paidAt')}: {new Date(payment.paidAt).toLocaleString(dateLocale)}
                        </span>
                      ) : null}
                      {payment.refundedAt ? (
                        <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                          {t('pages.profile.refundedAt')}: {new Date(payment.refundedAt).toLocaleString(dateLocale)}
                        </span>
                      ) : null}
                    </div>
                  </List.Item>
                )}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Profile;

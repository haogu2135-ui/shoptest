import type React from 'react';
import type { OrderCustomer, OrderItemCustomer, PaymentChannel, PetProfile, UserAddress, UserProfile } from '../types';
import { focusFirstFormError } from './formValidationFocus';
import { getCurrency } from './market';
import { filterPaymentChannelsForMarket } from './paymentMethods';
import { isLikelyPhoneNumber, normalizeLikelyPhoneNumber, normalizePhoneNumber } from './phone';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from './postalCode';
import { productImageFallback, resolveProductImage } from './productMedia';

export const orderImageFallback = productImageFallback;
export const resolveOrderImage = resolveProductImage;
export const PROFILE_ORDER_ITEM_PREVIEW_LIMIT = 30;
export type FormValidationError = { errorFields: unknown[] };
export type OrderItemsPreviewResult = { orderId: number; items: OrderItemCustomer[]; failed: boolean };

export const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};

export const focusProfileModalFormError = (rootSelector: string) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      focusFirstFormError({
        rootSelector,
        scrollOffset: 80,
        scrollContainerSelector: `${rootSelector} .shop-modal__body, ${rootSelector} .ant-modal-body`,
      });
    });
  });
};

export const getProfileApiErrorData = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') return {};
  const response = (error as { response?: unknown }).response;
  if (!response || typeof response !== 'object') return {};
  const data = (response as { data?: unknown }).data;
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
};

export const getProfileApiErrorCode = (error: unknown) => {
  const code = getProfileApiErrorData(error).code;
  return typeof code === 'string' ? code : '';
};

export const getPreferredPaymentChannel = (
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

export const useImageFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== orderImageFallback) {
    event.currentTarget.src = orderImageFallback;
  }
};

export const statusColors: Record<string, string> = {
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

export const ORDER_STATUS_LABEL_KEYS = new Set([
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
export const PAYMENT_STATUS_LABEL_KEYS = new Set(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED']);

export const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

export const getOrderSortTime = (order: OrderCustomer) => {
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

export const profileOrderLabel = (order: Pick<OrderCustomer, 'id' | 'orderNo'>) => order.orderNo || `#${order.id}`;

export const sortOrdersNewestFirst = (items: OrderCustomer[]) =>
  [...items].sort((left, right) => getOrderSortTime(right) - getOrderSortTime(left) || right.id - left.id);

export const PROFILE_TAB_KEYS = ['info', 'addresses', 'orders', 'pets'] as const;
export const PROFILE_MOBILE_ENTRY_TAB_KEYS = ['orders', 'addresses', 'info', 'pets'] as const;
export const normalizeProfileTab = (value: string | null) =>
  value === 'info' || value === 'addresses' || value === 'orders' || value === 'pets' ? value : null;

export const normalizeProfileOrderNo = (value: unknown) => String(value || '').trim().toUpperCase();
export const normalizeProfileEmail = (value: unknown) => String(value || '').trim().toLowerCase();
export const profilePhoneOptions = { minDigits: 6, maxDigits: 20, maxInputLength: 40 };
export const normalizeProfilePhone = (value: unknown) => normalizePhoneNumber(value, profilePhoneOptions);
export const isLikelyProfilePhone = (value: unknown) => isLikelyPhoneNumber(value, profilePhoneOptions);
export const normalizeLikelyProfilePhone = (value: unknown) =>
  normalizeLikelyPhoneNumber(value, profilePhoneOptions);
export const normalizeProfileAddressText = (value: unknown, maxLength: number) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
export const getProfileSavedAddressRegionPath = (address?: UserAddress | null) => {
  const region = address?.region;
  return (Array.isArray(region) ? region : [])
    .map((item) => normalizeProfileAddressText(item, 120))
    .filter(Boolean);
};
export const getProfileSavedAddressPostalCode = (address?: UserAddress | null) =>
  normalizeRegionalPostalCode(address?.postalCode);
export const getProfileSavedAddressDetail = (address?: UserAddress | null) =>
  normalizeProfileAddressText(address?.detailAddress, 260);
export const isCompleteProfileAddress = (address?: UserAddress | null) => {
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
export const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\D+/g, '').slice(0, 6);
export const scrollProfileAddressFieldIntoMobileView = (target: EventTarget | null) => {
  if (typeof window === 'undefined' || window.innerWidth > 780 || !(target instanceof HTMLElement)) return;
  const field = target.closest('.ant-form-item') || target;
  window.setTimeout(() => {
    field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, 80);
};

export type OrderActionHintTone = 'pay' | 'wait' | 'ship' | 'return' | 'done' | 'neutral';

export type OrderActionHint = {
  tone: OrderActionHintTone;
  title: string;
  text: string;
};


export type ProfileTranslate = (key: string, params?: Record<string, string | number>) => string;

export const PROFILE_AFTER_SALE_STATUSES = [
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_SHIPPED',
  'RETURN_REFUNDING',
  'RETURNED',
] as const;

export const PROFILE_ORDER_FILTER_STATUS_MAP: Record<string, string[]> = {
  PENDING_PAYMENT: ['PENDING_PAYMENT'],
  PENDING_SHIPMENT: ['PENDING_SHIPMENT'],
  SHIPPED: ['SHIPPED'],
  COMPLETED: ['COMPLETED'],
  RETURN_APPROVED: ['RETURN_APPROVED'],
  AFTER_SALE: [...PROFILE_AFTER_SALE_STATUSES],
  CANCELLED: ['CANCELLED'],
};

export const isReturnableOrder = (order: Pick<OrderCustomer, 'status' | 'returnable'>) => (
  order.status === 'COMPLETED' && Boolean(order.returnable)
);

export const resolveProfileDateLocale = (language: string) => (
  language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US'
);

export const formatKnownStatusLabel = (
  status: string | undefined,
  knownStatuses: Set<string>,
  t: ProfileTranslate,
) => {
  const rawStatus = String(status || '').trim();
  const normalizedStatus = normalizeStatusCode(rawStatus);
  if (!normalizedStatus) return t('common.unknown');
  if (knownStatuses.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
  return rawStatus;
};

export const formatOrderStatusLabel = (status: string | undefined, t: ProfileTranslate) => (
  formatKnownStatusLabel(status, ORDER_STATUS_LABEL_KEYS, t)
);

export const formatPaymentStatusLabel = (status: string | undefined, t: ProfileTranslate) => (
  formatKnownStatusLabel(status, PAYMENT_STATUS_LABEL_KEYS, t)
);

export const getKnownStatusColor = (
  status: string | undefined,
  knownStatuses: Set<string>,
) => {
  const normalizedStatus = normalizeStatusCode(status);
  if (!knownStatuses.has(normalizedStatus)) return 'default';
  return statusColors[normalizedStatus] || 'default';
};

export const getOrderStatusColor = (status?: string) => getKnownStatusColor(status, ORDER_STATUS_LABEL_KEYS);
export const getPaymentStatusColor = (status?: string) => getKnownStatusColor(status, PAYMENT_STATUS_LABEL_KEYS);

export const buildProfileOrderStatusTabs = (t: ProfileTranslate) => ([
  { key: 'all', label: t('pages.profile.allOrders') },
  { key: 'PENDING_PAYMENT', label: t('status.PENDING_PAYMENT'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.PENDING_PAYMENT },
  { key: 'PENDING_SHIPMENT', label: t('status.PENDING_SHIPMENT'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.PENDING_SHIPMENT },
  { key: 'SHIPPED', label: t('status.SHIPPED'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.SHIPPED },
  { key: 'COMPLETED', label: t('status.COMPLETED'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.COMPLETED },
  { key: 'RETURNABLE', label: t('pages.profile.afterSaleReturnable') },
  { key: 'AFTER_SALE', label: t('pages.profile.afterSale'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.AFTER_SALE },
  { key: 'CANCELLED', label: t('status.CANCELLED'), statuses: PROFILE_ORDER_FILTER_STATUS_MAP.CANCELLED },
]);

export const matchesProfileOrderFilter = (
  order: OrderCustomer,
  orderStatusFilter: string,
) => {
  if (orderStatusFilter === 'all') return true;
  if (orderStatusFilter === 'RETURNABLE') return isReturnableOrder(order);
  return PROFILE_ORDER_FILTER_STATUS_MAP[orderStatusFilter]?.includes(order.status) || false;
};

export const filterProfileOrders = (params: {
  orders: OrderCustomer[];
  orderStatusFilter: string;
  orderSearchText: string;
  orderItemsByOrderId: Record<number, OrderItemCustomer[]>;
  resolveItemName: (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => string;
}) => {
  const normalizedSearchText = params.orderSearchText.trim().toLowerCase();
  return sortOrdersNewestFirst(params.orders.filter((order) => matchesProfileOrderFilter(order, params.orderStatusFilter)))
    .filter((order) => {
      if (!normalizedSearchText) return true;
      const items = params.orderItemsByOrderId[order.id] || [];
      return [
        order.orderNo,
        order.id,
        order.trackingNumber,
        order.shippingAddress,
        ...items.map((item) => params.resolveItemName(item)),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearchText));
    });
};

export const resolveNextReturnDeadlineLabel = (
  orders: OrderCustomer[],
  dateLocale: string,
) => {
  const deadlines = orders
    .filter((order) => isReturnableOrder(order) && order.returnDeadline)
    .map((order) => new Date(order.returnDeadline as string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  return deadlines[0] ? deadlines[0].toLocaleDateString(dateLocale) : '';
};

export const deriveProfileDashboardMetrics = (params: {
  orders: OrderCustomer[];
  ordersLoadFailed: boolean;
  addresses: UserAddress[];
  petProfiles: PetProfile[];
  user?: Pick<UserProfile, 'email' | 'phone'> | null;
}) => {
  const pendingPaymentCount = params.orders.filter((order) => order.status === 'PENDING_PAYMENT').length;
  const inTransitCount = params.orders.filter((order) => order.status === 'SHIPPED').length;
  const afterSaleCount = params.orders.filter((order) => (PROFILE_AFTER_SALE_STATUSES as readonly string[]).includes(order.status)).length;
  const returnableOrdersCount = params.orders.filter(isReturnableOrder).length;
  const returnApprovedCount = params.orders.filter((order) => order.status === 'RETURN_APPROVED').length;
  const returnShippedCount = params.orders.filter((order) => order.status === 'RETURN_SHIPPED').length;
  const returnRefundingCount = params.orders.filter((order) => order.status === 'RETURN_REFUNDING').length;
  const ordersStale = params.ordersLoadFailed && params.orders.length > 0;
  const defaultAddressReady = params.addresses.some((address) => address.isDefault);
  const completedPetProfiles = params.petProfiles.filter((pet) => pet.name && pet.petType && pet.size && pet.weight && pet.birthday).length;
  const petProfileProgress = params.petProfiles.length > 0
    ? Math.round((completedPetProfiles / params.petProfiles.length) * 100)
    : 0;
  const petsMissingBirthdayCount = params.petProfiles.filter((pet) => !pet.birthday).length;
  const petsMissingFitCount = params.petProfiles.filter((pet) => !pet.weight || !pet.size).length;
  const completeAddressCount = params.addresses.filter(isCompleteProfileAddress).length;
  const addressesMissingPhoneCount = params.addresses.filter((address) => !isLikelyProfilePhone(address.phone)).length;
  const addressesMissingDetailCount = params.addresses.filter((address) => !isCompleteProfileAddress(address)).length;
  const addressReadinessProgress = params.addresses.length > 0
    ? Math.round(((completeAddressCount + (defaultAddressReady ? 1 : 0)) / (params.addresses.length + 1)) * 100)
    : 0;
  const accountHealthSignals = [
    Boolean(params.user?.email),
    Boolean(params.user?.phone),
    defaultAddressReady,
    params.petProfiles.length > 0,
  ];
  const accountHealthScore = Math.round((accountHealthSignals.filter(Boolean).length / accountHealthSignals.length) * 100);
  return {
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
  };
};

export const buildProfileAfterSaleFocusText = (params: {
  t: ProfileTranslate;
  ordersStale: boolean;
  returnApprovedCount: number;
  returnShippedCount: number;
  returnRefundingCount: number;
  returnableOrdersCount: number;
  nextReturnDeadline: string;
}) => {
  if (params.ordersStale) return params.t('pages.profile.ordersStaleAfterSaleText');
  if (params.returnApprovedCount > 0) {
    return params.t('pages.profile.afterSaleFocusShipment', { count: params.returnApprovedCount });
  }
  if (params.returnShippedCount > 0) {
    return params.t('pages.profile.afterSaleFocusRefund', { count: params.returnShippedCount });
  }
  if (params.returnRefundingCount > 0) {
    return params.t('pages.profile.afterSaleFocusRefunding', { count: params.returnRefundingCount });
  }
  if (params.returnableOrdersCount > 0) {
    return params.nextReturnDeadline
      ? params.t('pages.profile.afterSaleFocusWindowWithDate', {
        count: params.returnableOrdersCount,
        date: params.nextReturnDeadline,
      })
      : params.t('pages.profile.afterSaleFocusWindow', { count: params.returnableOrdersCount });
  }
  return params.t('pages.profile.afterSaleFocusHealthy');
};

export const buildProfilePetCompletenessText = (params: {
  t: ProfileTranslate;
  petProfilesLength: number;
  petProfileProgress: number;
  completedPetProfiles: number;
}) => {
  if (params.petProfilesLength === 0) return params.t('pages.profile.petCompletenessEmpty');
  if (params.petProfileProgress === 100) return params.t('pages.profile.petCompletenessReady');
  return params.t('pages.profile.petCompletenessImprove', {
    count: params.petProfilesLength - params.completedPetProfiles,
  });
};

export const resolveProfilePetFocus = (petProfiles: PetProfile[]) => (
  petProfiles.find((pet) => !pet.birthday || !pet.weight || !pet.size || !pet.breed) || null
);

export const buildProfilePetFocusText = (params: {
  t: ProfileTranslate;
  petProfiles: PetProfile[];
}) => {
  if (params.petProfiles.length === 0) return params.t('pages.profile.petProfileActionEmpty');
  const petProfileFocus = resolveProfilePetFocus(params.petProfiles);
  if (!petProfileFocus) return params.t('pages.profile.petProfileActionReady');
  return params.t('pages.profile.petProfileActionImprove', {
    name: petProfileFocus.name || params.t('pages.profile.petName'),
    fields: [
      !petProfileFocus.birthday ? params.t('pages.profile.petBirthday') : null,
      !petProfileFocus.weight ? params.t('pages.profile.petWeight') : null,
      !petProfileFocus.size ? params.t('pages.profile.petSize') : null,
      !petProfileFocus.breed ? params.t('pages.profile.petBreed') : null,
    ].filter(Boolean).join(', '),
  });
};

export const buildProfileAddressReadinessText = (params: {
  t: ProfileTranslate;
  addressesLength: number;
  addressReadinessProgress: number;
}) => {
  if (params.addressesLength === 0) return params.t('pages.profile.addressReadinessEmpty');
  if (params.addressReadinessProgress === 100) return params.t('pages.profile.addressReadinessReady');
  return params.t('pages.profile.addressReadinessImprove');
};

export const resolveProfilePetTypeLabel = (value: string | undefined, t: ProfileTranslate) => {
  if (value === 'DOG') return t('pages.profile.petDog');
  if (value === 'CAT') return t('pages.profile.petCat');
  if (value === 'SMALL_PET') return t('pages.profile.petSmall');
  return value || t('common.unset');
};

export const resolveProfilePetSizeLabel = (value: string | undefined, t: ProfileTranslate) => {
  if (value === 'SMALL') return t('pages.profile.petSizeSmall');
  if (value === 'MEDIUM') return t('pages.profile.petSizeMedium');
  if (value === 'LARGE') return t('pages.profile.petSizeLarge');
  return value || t('common.unset');
};

export const resolveProfilePetShoppingSizeValue = (value?: string) => {
  if (value === 'SMALL') return 'Small';
  if (value === 'MEDIUM') return 'Medium';
  if (value === 'LARGE') return 'Large';
  return '';
};

export const resolveProfilePetShoppingKeyword = (pet?: PetProfile | null) => {
  if (!pet) return '';
  if (pet.breed) return pet.breed;
  if (pet.petType === 'DOG') return 'dog';
  if (pet.petType === 'CAT') return 'cat';
  return 'small pet';
};

export const resolveProfilePetShoppingFocus = (petProfiles: PetProfile[]) => (
  petProfiles.find((pet) => pet.petType && (pet.size || pet.breed)) || petProfiles[0] || null
);

export const buildProfilePetShoppingPath = (pet?: PetProfile | null) => {
  const params = new URLSearchParams();
  const keywordValue = resolveProfilePetShoppingKeyword(pet);
  const sizeValue = resolveProfilePetShoppingSizeValue(pet?.size);
  if (keywordValue) params.set('keyword', keywordValue);
  if (sizeValue) params.set('petSize', sizeValue);
  params.set('sort', 'personalized-desc');
  return `/products?${params.toString()}`;
};

export const getOrderActionHint = (params: {
  order: OrderCustomer;
  ordersStale: boolean;
  dateLocale: string;
  t: ProfileTranslate;
}): OrderActionHint => {
  const { order, t } = params;
  const returnDeadline = order.returnDeadline
    ? new Date(order.returnDeadline).toLocaleDateString(params.dateLocale)
    : '';
  if (params.ordersStale) {
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
        ? t('pages.profile.nextReturnedWithRefundText', {
          date: new Date(order.refundedAt).toLocaleDateString(params.dateLocale),
        })
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

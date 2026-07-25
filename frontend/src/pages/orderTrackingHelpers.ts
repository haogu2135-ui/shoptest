import type { OrderCustomer } from '../types';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';

export const orderTrackingImageFallback = productImageFallback;
export const resolveOrderTrackingImage = resolveProductImage;

export const cleanTrackingParam = (value: string | null, maxLength = 120) =>
  Array.from(String(value || ''), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim().slice(0, maxLength);

export const statusColor: Record<string, string> = {
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

export const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

export const getTrackingStep = (status?: string) => {
  if (status === 'COMPLETED' || status === 'RETURN_REFUNDING' || status === 'RETURNED') return 3;
  if (status === 'SHIPPED' || status === 'RETURN_SHIPPED') return 2;
  if (status === 'PENDING_SHIPMENT' || status === 'RETURN_APPROVED') return 1;
  return 0;
};

export const ORDER_TRACKING_AUTO_REFRESH_MS = 30_000;

export const ORDER_TRACKING_TERMINAL_STATUSES = new Set([
  'CANCELLED',
  'COMPLETED',
  'DELIVERED',
  'REFUNDED',
  'RETURN_REFUNDING',
  'RETURNED',
]);

export const shouldAutoRefreshTrackedOrder = (order?: Pick<OrderCustomer, 'status'> | null) => {
  if (!order) return false;
  const normalizedStatus = normalizeStatusCode(order.status);
  if (!normalizedStatus) return true;
  return !ORDER_TRACKING_TERMINAL_STATUSES.has(normalizedStatus);
};

export const isGuestTrackedOrder = (order?: OrderCustomer | null) => Boolean(
  order?.guestOrder || String(order?.shippingAddress || '').startsWith('[Guest]'),
);


export type OrderTrackingTranslate = (key: string, params?: Record<string, string | number>) => string;

export type OrderTrackingNextActionTone = 'info' | 'warning' | 'success';

export type OrderTrackingNextActionDescriptor = {
  title: string;
  text: string;
  tone: OrderTrackingNextActionTone;
};

export type OrderTrackingAssurancePlanDescriptor = {
  itemCount: number;
  title: string;
  text: string;
  primaryLabel: string;
  intent: 'shop-again' | 'support';
};

export const resolveOrderTrackingDateLocale = (language: string) => (
  language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US'
);

export const formatOrderTrackingStatusLabel = (params: {
  t: OrderTrackingTranslate;
  status?: string;
}): string => {
  const rawStatus = String(params.status || '').trim();
  const normalizedStatus = normalizeStatusCode(rawStatus);
  if (!normalizedStatus) return params.t('common.unknown');
  if (ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return params.t(`status.${normalizedStatus}`);
  return rawStatus;
};

export const resolveOrderTrackingStatusColor = (status?: string) => {
  const normalizedStatus = normalizeStatusCode(status);
  if (!ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
  return statusColor[normalizedStatus] || 'default';
};

export const resolveOrderTrackingAccessFlags = (params: {
  order?: OrderCustomer | null;
  trackedEmail?: string | null;
  isSignedIn: boolean;
  detailsRestricted: boolean;
  isAdmin: boolean;
}) => {
  const canUseGuestActions = Boolean(isGuestTrackedOrder(params.order) && params.trackedEmail && params.order?.orderNo);
  const canUseSignedInActions = Boolean(
    params.isSignedIn
    && params.order
    && !isGuestTrackedOrder(params.order)
    && (params.isAdmin || !params.detailsRestricted),
  );
  const canOperateTrackedOrder = !params.detailsRestricted && (canUseSignedInActions || canUseGuestActions);
  const canShowFullTrackingDetails = Boolean(params.order && !params.detailsRestricted);
  return {
    canUseGuestActions,
    canUseSignedInActions,
    canOperateTrackedOrder,
    canShowFullTrackingDetails,
  };
};

export const resolveOrderTrackingOrderLabel = (params: {
  t: OrderTrackingTranslate;
  order?: Pick<OrderCustomer, 'id' | 'orderNo'> | null;
}) => (
  params.order
    ? params.order.orderNo || `#${params.order.id}`
    : params.t('pages.orderTracking.title')
);

export const buildOrderTrackingActionLabels = (params: {
  t: OrderTrackingTranslate;
  trackedOrderLabel: string;
}) => ({
  trackActionLabel: (action: string) => `${action}: ${params.trackedOrderLabel}`,
  returnRequestActionLabel: `${params.t('pages.profile.returnOrder')}: ${params.trackedOrderLabel}`,
  returnShipmentActionLabel: `${params.t('pages.profile.submitReturnShipment')}: ${params.trackedOrderLabel}`,
  returnReasonInputLabel: `${params.t('pages.profile.returnReason')}: ${params.trackedOrderLabel}`,
  returnTrackingInputLabel: `${params.t('pages.profile.returnTracking')}: ${params.trackedOrderLabel}`,
});

export const resolveOrderTrackingNextActionDescriptor = (params: {
  t: OrderTrackingTranslate;
  order?: OrderCustomer | null;
  canOperateTrackedOrder: boolean;
}): OrderTrackingNextActionDescriptor | null => {
  if (!params.order) return null;
  if (!params.canOperateTrackedOrder) {
    return {
      title: params.t('pages.orderTracking.accountOrderTitle'),
      text: params.t('pages.orderTracking.accountOrderText'),
      tone: 'info',
    };
  }
  if (params.order.status === 'PENDING_PAYMENT') {
    return {
      title: params.t('pages.orderTracking.nextPayTitle'),
      text: params.t('pages.orderTracking.nextPayText'),
      tone: 'warning',
    };
  }
  if (params.order.status === 'PENDING_SHIPMENT') {
    return {
      title: params.t('pages.orderTracking.nextPrepareTitle'),
      text: params.t('pages.orderTracking.nextPrepareText'),
      tone: 'info',
    };
  }
  if (params.order.status === 'COMPLETED') {
    return {
      title: params.t('pages.orderTracking.nextDeliveredTitle'),
      text: params.t('pages.orderTracking.nextDeliveredText'),
      tone: 'success',
    };
  }
  if (params.order.trackingNumber) {
    return {
      title: params.t('pages.orderTracking.nextTrackTitle'),
      text: params.t('pages.orderTracking.nextTrackText', { number: params.order.trackingNumber }),
      tone: 'success',
    };
  }
  return {
    title: params.t('pages.orderTracking.nextSupportTitle'),
    text: params.t('pages.orderTracking.nextSupportText'),
    tone: 'info',
  };
};

export const resolveOrderTrackingAssurancePlanDescriptor = (params: {
  t: OrderTrackingTranslate;
  order?: OrderCustomer | null;
  detailsRestricted: boolean;
  items: Array<{ quantity?: number | null }>;
}): OrderTrackingAssurancePlanDescriptor | null => {
  if (!params.order || params.detailsRestricted) return null;
  const itemCount = params.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const isDelivered = params.order.status === 'COMPLETED';
  const isShipped = Boolean(params.order.trackingNumber);
  return {
    itemCount,
    title: isDelivered
      ? params.t('pages.orderTracking.assuranceDeliveredTitle')
      : params.t('pages.orderTracking.assuranceActiveTitle'),
    text: isDelivered
      ? params.t('pages.orderTracking.assuranceDeliveredText', { count: itemCount })
      : isShipped
        ? params.t('pages.orderTracking.assuranceShippedText', { count: itemCount })
        : params.t('pages.orderTracking.assurancePreparingText', { count: itemCount }),
    primaryLabel: isDelivered
      ? params.t('pages.orderTracking.shopAgain')
      : params.t('pages.profile.contactSupport'),
    intent: isDelivered ? 'shop-again' : 'support',
  };
};

/** Assemble OrderTracking panel prop bag in one pure surface for residual modularization. */
export const buildOrderTrackingPanelProps = <T extends Record<string, unknown>>(props: T): T => props;

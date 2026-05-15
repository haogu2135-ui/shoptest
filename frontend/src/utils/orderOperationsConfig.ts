import type { Order } from '../types';

const HOUR_MS = 60 * 60 * 1000;
const SLA_DUE_SOON_RATIO = 0.25;
const SLA_DUE_SOON_MAX_HOURS = 6;

export const orderNeedsActionStatuses = ['PENDING_SHIPMENT', 'RETURN_REQUESTED', 'RETURN_SHIPPED'];
export const orderShippableStatus = 'PENDING_SHIPMENT';

export const orderStatusColors: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURNED: 'purple',
  REFUNDED: 'purple',
};

export const orderValidTransitions: Record<string, string[]> = {
  PENDING_PAYMENT: ['PENDING_SHIPMENT', 'CANCELLED'],
  PENDING_SHIPMENT: ['SHIPPED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  RETURN_REQUESTED: ['RETURN_APPROVED', 'COMPLETED'],
  RETURN_APPROVED: [],
  RETURN_SHIPPED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
  REFUNDED: [],
};

export const orderPriority: Record<string, number> = {
  RETURN_SHIPPED: 0,
  RETURN_REQUESTED: 1,
  PENDING_SHIPMENT: 2,
  SHIPPED: 3,
  PENDING_PAYMENT: 4,
  RETURN_APPROVED: 5,
  COMPLETED: 6,
  RETURNED: 7,
  REFUNDED: 7,
  CANCELLED: 8,
};

export const orderSlaHours: Record<string, number> = {
  PENDING_SHIPMENT: 24,
  RETURN_REQUESTED: 24,
  RETURN_SHIPPED: 72,
};

export type AdminOrderNextActionTone = 'urgent' | 'warning' | 'info' | 'success' | 'neutral';

export type AdminOrderNextAction = {
  tone: AdminOrderNextActionTone;
  titleKey: string;
  textKey: string;
};

export const orderNextActionByStatus: Record<string, AdminOrderNextAction> = {
  PENDING_PAYMENT: {
    tone: 'neutral',
    titleKey: 'pages.adminOrders.nextAwaitPayment',
    textKey: 'pages.adminOrders.nextAwaitPaymentHint',
  },
  PENDING_SHIPMENT: {
    tone: 'urgent',
    titleKey: 'pages.adminOrders.nextShip',
    textKey: 'pages.adminOrders.nextShipHint',
  },
  SHIPPED: {
    tone: 'info',
    titleKey: 'pages.adminOrders.nextTrack',
    textKey: 'pages.adminOrders.nextTrackHint',
  },
  RETURN_REQUESTED: {
    tone: 'warning',
    titleKey: 'pages.adminOrders.nextReviewReturn',
    textKey: 'pages.adminOrders.nextReviewReturnHint',
  },
  RETURN_APPROVED: {
    tone: 'info',
    titleKey: 'pages.adminOrders.nextWaitReturn',
    textKey: 'pages.adminOrders.nextWaitReturnHint',
  },
  RETURN_SHIPPED: {
    tone: 'urgent',
    titleKey: 'pages.adminOrders.nextRefund',
    textKey: 'pages.adminOrders.nextRefundHint',
  },
  RETURNED: {
    tone: 'success',
    titleKey: 'pages.adminOrders.nextRefunded',
    textKey: 'pages.adminOrders.nextRefundedHint',
  },
  REFUNDED: {
    tone: 'success',
    titleKey: 'pages.adminOrders.nextRefunded',
    textKey: 'pages.adminOrders.nextRefundedHint',
  },
  COMPLETED: {
    tone: 'success',
    titleKey: 'pages.adminOrders.nextCompleted',
    textKey: 'pages.adminOrders.nextCompletedHint',
  },
  CANCELLED: {
    tone: 'neutral',
    titleKey: 'pages.adminOrders.nextClosed',
    textKey: 'pages.adminOrders.nextClosedHint',
  },
};

export const getOrderSlaStart = (order: Order) => {
  if (order.status === 'RETURN_REQUESTED') return order.returnRequestedAt || order.createdAt;
  if (order.status === 'RETURN_SHIPPED') return order.returnShippedAt || order.createdAt;
  return order.createdAt;
};

export const isOrderNeedsAction = (order: Order) => orderNeedsActionStatuses.includes(order.status);

export const isOrderShippable = (order: Order) => order.status === orderShippableStatus;

export const isOrderRefunded = (order: Order) => order.status === 'RETURNED' || order.status === 'REFUNDED' || Boolean(order.refundedAt);

export type OrderSlaState = {
  overdue: boolean;
  dueSoon: boolean;
  diffHours: number;
};

export const getOrderSlaState = (order: Order, now = Date.now()): OrderSlaState | null => {
  const limitHours = orderSlaHours[order.status];
  const start = getOrderSlaStart(order);
  if (!limitHours || !start) return null;

  const startTime = new Date(start).getTime();
  if (Number.isNaN(startTime)) return null;

  const elapsedHours = Math.max(0, (now - startTime) / HOUR_MS);
  const overdue = elapsedHours > limitHours;
  const diffHours = overdue ? elapsedHours - limitHours : limitHours - elapsedHours;
  const dueSoonThreshold = Math.min(SLA_DUE_SOON_MAX_HOURS, limitHours * SLA_DUE_SOON_RATIO);

  return {
    overdue,
    dueSoon: !overdue && diffHours <= dueSoonThreshold,
    diffHours,
  };
};

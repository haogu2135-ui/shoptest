import type { AppNotification } from '../types';
import { dispatchDomEvent } from '../utils/domEvents';

export type NotificationsTranslate = (key: string, params?: Record<string, string | number>) => string;

export type NotificationQuickFilter = 'ALL' | 'UNREAD' | 'PROMOTION' | 'ORDER' | 'DELIVERY';

export const typeColors: Record<string, string> = {
  ORDER: 'blue',
  PROMOTION: 'orange',
  SYSTEM: 'default',
  DELIVERY: 'green',
};

export const NOTIFICATION_TYPE_KEYS = new Set(['ORDER', 'PROMOTION', 'SYSTEM', 'DELIVERY']);
export const NOTIFICATION_PAGE_SIZE = 50;

export const extractOrderNoFromNotification = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
  const haystack = `${item.title || ''} ${item.message || ''}`;
  const patterns = [
    /\border\s+([A-Za-z0-9_-]{4,})/i,
    /\bpedido\s+([A-Za-z0-9_-]{4,})/i,
    /\b订单\s*([A-Za-z0-9_-]{4,})/i,
    /\border\s*#?\s*([A-Za-z0-9_-]{4,})/i,
    /\b(SO\d{6,})\b/i,
  ];
  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[.,;:!?]+$/, '');
    }
  }
  return '';
};

export const notificationLooksLikeShipment = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
  const type = String(item.type || '').trim().toUpperCase();
  if (type === 'DELIVERY') return true;
  const haystack = `${item.title || ''} ${item.message || ''}`;
  return /\bshipped\b|has shipped|tracking number|已发货|运单号|enviado|n[uú]mero de gu[ií]a/i.test(haystack);
};

export const notificationLooksLikeReturnFlow = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
  const haystack = `${item.title || ''} ${item.message || ''}`;
  return /\breturn\b|refund|退货|退款|devoluci[oó]n|reembolso/i.test(haystack);
};

export const notifyNavbarChanged = () => {
  dispatchDomEvent('shop:notifications-updated');
};

export const sortNotifications = (items: AppNotification[]) =>
  [...items].sort((left, right) => {
    if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });

export const mergeNotificationPages = (current: AppNotification[], next: AppNotification[]) => {
  const itemsById = new Map<number, AppNotification>();
  current.forEach((item) => itemsById.set(item.id, item));
  next.forEach((item) => itemsById.set(item.id, item));
  return sortNotifications(Array.from(itemsById.values()));
};

export const formatNotificationType = (type: string | undefined, t: NotificationsTranslate) => {
  const rawType = String(type || '').trim();
  const normalizedType = rawType.toUpperCase();
  if (NOTIFICATION_TYPE_KEYS.has(normalizedType)) {
    return t(`pages.notifications.typeValues.${normalizedType}`);
  }
  return rawType || '-';
};

export type NotificationInsights = {
  unread: number;
  promotions: number;
  orders: number;
  deliveries: number;
};

export const deriveNotificationInsights = (notifications: AppNotification[]): NotificationInsights => {
  return notifications.reduce((summary, item) => {
    if (!item.isRead) summary.unread += 1;
    if (item.type === 'PROMOTION') summary.promotions += 1;
    if (item.type === 'ORDER') summary.orders += 1;
    if (item.type === 'DELIVERY') summary.deliveries += 1;
    return summary;
  }, { unread: 0, promotions: 0, orders: 0, deliveries: 0 });
};

export const filterNotificationsByQuickFilter = (
  notifications: AppNotification[],
  quickFilter: NotificationQuickFilter,
) => {
  if (quickFilter === 'UNREAD') return notifications.filter((item) => !item.isRead);
  if (quickFilter === 'ALL') return notifications;
  return notifications.filter((item) => item.type === quickFilter);
};

export type NotificationRelatedPathIntent =
  | { kind: 'path'; path: string; markRead: boolean }
  | { kind: 'none' };

/** Resolve related navigation target for a notification without side effects. */
export const resolveNotificationRelatedPath = (
  item: AppNotification,
): NotificationRelatedPathIntent => {
  const orderNo = extractOrderNoFromNotification(item);
  const type = String(item.type || '').trim().toUpperCase();
  if (orderNo) {
    const path = notificationLooksLikeShipment(item)
      ? `/track-order?orderNo=${encodeURIComponent(orderNo)}`
      : `/profile?tab=orders&orderNo=${encodeURIComponent(orderNo)}`;
    return { kind: 'path', path, markRead: !item.isRead };
  }
  if (type === 'DELIVERY' || notificationLooksLikeShipment(item)) {
    return { kind: 'path', path: '/track-order', markRead: false };
  }
  if (type === 'PROMOTION') {
    return { kind: 'path', path: '/coupons', markRead: false };
  }
  if (type === 'ORDER') {
    return { kind: 'path', path: '/profile?tab=orders', markRead: false };
  }
  return { kind: 'none' };
};

export type NotificationActionPlanIntent =
  | 'filter-unread'
  | 'coupons'
  | 'track-order'
  | 'orders'
  | 'browse';

export type NotificationActionPlanDescriptor = {
  title: string;
  text: string;
  label: string;
  intent: NotificationActionPlanIntent;
};

export const resolveNotificationActionPlanDescriptor = (params: {
  t: NotificationsTranslate;
  insights: NotificationInsights;
}): NotificationActionPlanDescriptor => {
  const { t, insights } = params;
  if (insights.unread > 0) {
    return {
      title: t('pages.notifications.actionUnreadTitle'),
      text: t('pages.notifications.actionUnreadText', { count: insights.unread }),
      label: t('pages.notifications.actionReviewUnread'),
      intent: 'filter-unread',
    };
  }
  if (insights.promotions > 0) {
    return {
      title: t('pages.notifications.actionPromotionTitle'),
      text: t('pages.notifications.actionPromotionText', { count: insights.promotions }),
      label: t('pages.notifications.actionOpenCoupons'),
      intent: 'coupons',
    };
  }
  if (insights.deliveries > 0) {
    return {
      title: t('pages.notifications.actionDeliveryTitle'),
      text: t('pages.notifications.actionDeliveryText', { count: insights.deliveries }),
      label: t('pages.notifications.actionTrackOrder'),
      intent: 'track-order',
    };
  }
  if (insights.orders > 0) {
    return {
      title: t('pages.notifications.actionOrderTitle'),
      text: t('pages.notifications.actionOrderText', { count: insights.orders }),
      label: t('pages.notifications.actionOpenOrders'),
      intent: 'orders',
    };
  }
  return {
    title: t('pages.notifications.actionBrowseTitle'),
    text: t('pages.notifications.actionBrowseText'),
    label: t('pages.notifications.actionBrowseProducts'),
    intent: 'browse',
  };
};

export const buildNotificationQuickFilterLabels = (t: NotificationsTranslate) => ({
  ALL: t('common.all'),
  UNREAD: t('pages.notifications.unreadCount'),
  PROMOTION: t('pages.notifications.promotionCount'),
  ORDER: t('pages.notifications.orderCount'),
  DELIVERY: t('pages.notifications.deliveryCount'),
});

/** Build a11y / CTA labels for Notifications residual modularization. */
export const buildNotificationsActionLabels = (params: {
  t: NotificationsTranslate;
  unreadCount: number;
  quickFilterLabel: string;
  actionPlanLabel: string;
  actionPlanTitle: string;
  loadedCount: number;
}) => {
  const { t, unreadCount, quickFilterLabel, actionPlanLabel, actionPlanTitle, loadedCount } = params;
  return {
    markAllActionLabel: `${t('pages.notifications.markAll')}: ${unreadCount}`,
    clearFilterActionLabel: `${t('pages.notifications.clearFilter')}: ${quickFilterLabel}`,
    notificationActionPlanLabel: `${actionPlanLabel}: ${actionPlanTitle}`,
    loadMoreActionLabel: `${t('pages.notifications.loadMore')}: ${t('pages.notifications.loadedCount', { count: loadedCount })}`,
    authGateLoginLabel: t('pages.notifications.authGateLogin'),
    authGateRegisterLabel: t('pages.notifications.authGateRegister'),
  };
};

export const buildNotificationItemActionLabels = (params: {
  t: NotificationsTranslate;
  notificationName: string;
  relatedOrderNo: string;
  relatedType: string;
}) => {
  const { t, notificationName, relatedOrderNo, relatedType } = params;
  const openRelatedLabel = relatedOrderNo
    ? `${relatedType === 'DELIVERY' ? t('pages.notifications.actionTrackOrder') : t('pages.notifications.actionOpenOrders')}: ${relatedOrderNo}`
    : relatedType === 'DELIVERY'
      ? t('pages.notifications.actionTrackOrder')
      : relatedType === 'PROMOTION'
        ? t('pages.notifications.actionOpenCoupons')
        : relatedType === 'ORDER'
          ? t('pages.notifications.actionOpenOrders')
          : t('pages.notifications.openRelated');
  return {
    openRelatedLabel,
    markReadActionLabel: `${t('pages.notifications.markRead')}: ${notificationName}`,
    deleteActionLabel: `${t('common.delete')}: ${notificationName}`,
    cancelDeleteActionLabel: `${t('common.cancel')}: ${t('common.delete')}: ${notificationName}`,
  };
};

/** Assemble Notifications panel prop bag in one pure surface for residual modularization. */
export const buildNotificationsPanelProps = <T extends Record<string, unknown>>(props: T): T => props;

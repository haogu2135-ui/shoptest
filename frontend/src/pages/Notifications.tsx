import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import type { AppNotification } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildLoginUrl } from '../utils/authRedirect';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import PageError from '../components/PageError';
import PageEmpty from '../components/PageEmpty';
import { hasStoredValue } from '../utils/safeStorage';
import './Notifications.css';
import '../styles/mobile-page-contrast.css';
import ShopButton from '../components/ShopButton';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
const typeColors: Record<string, string> = {
  ORDER: 'blue',
  PROMOTION: 'orange',
  SYSTEM: 'default',
  DELIVERY: 'green',
};
const NOTIFICATION_TYPE_KEYS = new Set(['ORDER', 'PROMOTION', 'SYSTEM', 'DELIVERY']);
const NOTIFICATION_PAGE_SIZE = 50;

const extractOrderNoFromNotification = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
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

const notificationLooksLikeShipment = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
  const type = String(item.type || '').trim().toUpperCase();
  if (type === 'DELIVERY') return true;
  const haystack = `${item.title || ''} ${item.message || ''}`;
  return /\bshipped\b|has shipped|tracking number|已发货|运单号|enviado|n[uú]mero de gu[ií]a/i.test(haystack);
};

const notificationLooksLikeReturnFlow = (item: Pick<AppNotification, 'title' | 'message' | 'type'>) => {
  const haystack = `${item.title || ''} ${item.message || ''}`;
  return /\breturn\b|refund|退货|退款|devoluci[oó]n|reembolso/i.test(haystack);
};

const notifyNavbarChanged = () => {
  dispatchDomEvent('shop:notifications-updated');
};

const sortNotifications = (items: AppNotification[]) =>
  [...items].sort((left, right) => {
    if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });

const mergeNotificationPages = (current: AppNotification[], next: AppNotification[]) => {
  const itemsById = new Map<number, AppNotification>();
  current.forEach((item) => itemsById.set(item.id, item));
  next.forEach((item) => itemsById.set(item.id, item));
  return sortNotifications(Array.from(itemsById.values()));
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(() => hasStoredValue('token'));
  const [authRequired, setAuthRequired] = useState(() => !hasStoredValue('token'));
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [notificationPage, setNotificationPage] = useState(1);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'UNREAD' | 'PROMOTION' | 'ORDER' | 'DELIVERY'>('ALL');
  const mountedRef = useRef(true);
  const notificationFetchSeqRef = useRef(0);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.notifications.title'));
  useDocumentMeta({
    title: t('pages.notifications.title'),
    description: t('common.siteDescription'),
    path: '/notifications',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });

  const formatNotificationType = useCallback((type?: string) => {
    const rawType = String(type || '').trim();
    const normalizedType = rawType.toUpperCase();
    if (NOTIFICATION_TYPE_KEYS.has(normalizedType)) {
      return t(`pages.notifications.typeValues.${normalizedType}`);
    }
    return rawType || '-';
  }, [t]);

  const fetchNotifications = useCallback(async (nextPage = 1, append = false) => {
    const requestSeq = notificationFetchSeqRef.current + 1;
    notificationFetchSeqRef.current = requestSeq;
    const isCurrentRequest = () => mountedRef.current && notificationFetchSeqRef.current === requestSeq;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setFetchError('');
    }
    try {
      const res = await notificationApi.getByUser(0, false, nextPage, NOTIFICATION_PAGE_SIZE);
      if (!isCurrentRequest()) return;
      const nextNotifications = sortNotifications(res.data);
      setNotifications((current) => append ? mergeNotificationPages(current, nextNotifications) : nextNotifications);
      setNotificationPage(nextPage);
      setHasMoreNotifications(nextNotifications.length === NOTIFICATION_PAGE_SIZE);
      setFetchError('');
    } catch (error) {
      if (!isCurrentRequest()) return;
      reportNonBlockingError('Notifications.fetchNotifications', error);
      if (!append) {
        setFetchError(t('pages.notifications.fetchFailed'));
        setHasMoreNotifications(false);
      }
      announceAccessibleMessage(t('pages.notifications.fetchFailed'), 'error');
    } finally {
      if (!isCurrentRequest()) return;
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      notificationFetchSeqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!hasStoredValue('token')) {
      setAuthRequired(true);
      setLoading(false);
      setNotifications([]);
      setFetchError('');
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((current) => current.map(n => n.id === id ? { ...n, isRead: true } : n));
      notifyNavbarChanged();
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAsRead', error);
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    }
  }, [t]);

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((current) => current.map(n => ({ ...n, isRead: true })));
      notifyNavbarChanged();
      announceAccessibleMessage(t('pages.notifications.allRead'), 'success');
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAllAsRead', error);
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationApi.delete(id);
      setNotifications((current) => current.filter(n => n.id !== id));
      notifyNavbarChanged();
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
    } catch (error) {
      reportNonBlockingError('Notifications.handleDelete', error);
      announceAccessibleMessage(t('messages.deleteFailed'), 'error');
    }
  };

  const renderMessage = (item: AppNotification) => {
    if (item.contentFormat === 'HTML') {
      return (
        <div
          className="notification-rich-content"
          dangerouslySetInnerHTML={{ __html: stripUnsafeHtml(item.message || '') }}
        />
      );
    }
    return <div className="notifications-page__plainText">{item.message}</div>;
  };

  const notificationInsights = useMemo(() => {
    const unread = notifications.filter((item) => !item.isRead).length;
    const promotions = notifications.filter((item) => item.type === 'PROMOTION').length;
    const orders = notifications.filter((item) => item.type === 'ORDER').length;
    const deliveries = notifications.filter((item) => item.type === 'DELIVERY').length;
    return { unread, promotions, orders, deliveries };
  }, [notifications]);

  const openRelatedNotification = useCallback((item: AppNotification) => {
    const orderNo = extractOrderNoFromNotification(item);
    const type = String(item.type || '').trim().toUpperCase();
    if (orderNo) {
      if (notificationLooksLikeShipment(item)) {
        navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}`);
      } else if (notificationLooksLikeReturnFlow(item)) {
        navigate(`/profile?tab=orders&orderNo=${encodeURIComponent(orderNo)}`);
      } else {
        navigate(`/profile?tab=orders&orderNo=${encodeURIComponent(orderNo)}`);
      }
      if (!item.isRead) {
        void handleMarkAsRead(item.id);
      }
      return;
    }
    if (type === 'DELIVERY' || notificationLooksLikeShipment(item)) {
      navigate('/track-order');
      return;
    }
    if (type === 'PROMOTION') {
      navigate('/coupons');
      return;
    }
    if (type === 'ORDER') {
      navigate('/profile?tab=orders');
    }
  }, [handleMarkAsRead, navigate]);

    const actionPlan = useMemo(() => {
    if (notificationInsights.unread > 0) {
      return {
        title: t('pages.notifications.actionUnreadTitle'),
        text: t('pages.notifications.actionUnreadText', { count: notificationInsights.unread }),
        label: t('pages.notifications.actionReviewUnread'),
        onClick: () => setQuickFilter('UNREAD' as const),
      };
    }
    if (notificationInsights.promotions > 0) {
      return {
        title: t('pages.notifications.actionPromotionTitle'),
        text: t('pages.notifications.actionPromotionText', { count: notificationInsights.promotions }),
        label: t('pages.notifications.actionOpenCoupons'),
        onClick: () => navigate('/coupons'),
      };
    }
    if (notificationInsights.deliveries > 0) {
      return {
        title: t('pages.notifications.actionDeliveryTitle'),
        text: t('pages.notifications.actionDeliveryText', { count: notificationInsights.deliveries }),
        label: t('pages.notifications.actionTrackOrder'),
        onClick: () => navigate('/track-order'),
      };
    }
    if (notificationInsights.orders > 0) {
      return {
        title: t('pages.notifications.actionOrderTitle'),
        text: t('pages.notifications.actionOrderText', { count: notificationInsights.orders }),
        label: t('pages.notifications.actionOpenOrders'),
        onClick: () => navigate('/profile?tab=orders'),
      };
    }
    return {
      title: t('pages.notifications.actionBrowseTitle'),
      text: t('pages.notifications.actionBrowseText'),
      label: t('pages.notifications.actionBrowseProducts'),
      onClick: () => navigate('/products'),
    };
  }, [navigate, notificationInsights, t]);

  const filteredNotifications = useMemo(() => {
    if (quickFilter === 'UNREAD') return notifications.filter((item) => !item.isRead);
    if (quickFilter === 'ALL') return notifications;
    return notifications.filter((item) => item.type === quickFilter);
  }, [notifications, quickFilter]);
  const notificationQuickFilterLabels = {
    ALL: t('common.all'),
    UNREAD: t('pages.notifications.unreadCount'),
    PROMOTION: t('pages.notifications.promotionCount'),
    ORDER: t('pages.notifications.orderCount'),
    DELIVERY: t('pages.notifications.deliveryCount'),
  };
  const markAllActionLabel = `${t('pages.notifications.markAll')}: ${notificationInsights.unread}`;
  const clearFilterActionLabel = `${t('pages.notifications.clearFilter')}: ${notificationQuickFilterLabels[quickFilter]}`;
  const notificationActionPlanLabel = `${actionPlan.label}: ${actionPlan.title}`;
  const loadMoreActionLabel = `${t('pages.notifications.loadMore')}: ${t('pages.notifications.loadedCount', { count: notifications.length })}`;
  const notificationActionsDisabled = Boolean(fetchError);

  if (authRequired) {
    const loginLabel = t('pages.notifications.authGateLogin');
    const registerLabel = t('pages.notifications.authGateRegister');
    return (
      <div
        className={`notifications-page notifications-page--${language} notifications-page--empty notifications-page--authGate`}
        data-auth-gate="notifications-login-required"
      >
        <PageEmpty
          className="notifications-page__authGate"
          description={(
            <div className="notifications-page__emptyCopy">
              <h1 className="notifications-page__title">{t('pages.notifications.authGateTitle')}</h1>
              <div className="notifications-page__emptyHint">{t('pages.notifications.authGateHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'login',
              label: loginLabel,
              onClick: () => navigate(buildLoginUrl('/notifications')),
            },
            {
              key: 'register',
              label: registerLabel,
              onClick: () => navigate('/register?redirect=%2Fnotifications'),
              type: 'default',
            },
            {
              key: 'browse',
              label: t('pages.cart.browse'),
              onClick: () => navigate('/products'),
              type: 'default',
            },
            {
              key: 'track',
              label: t('pages.notifications.emptyTrackOrder'),
              onClick: () => navigate('/track-order'),
              type: 'default',
            },
            {
              key: 'coupons',
              label: t('pages.notifications.emptyCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
          ]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="notifications-page notifications-page--loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <h1 className="notifications-page__title">{t('pages.notifications.title')}</h1>
        <span className="notifications-page__spinner" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="notifications-page__header">
        <div className="notifications-page__title">
          <ShopIcon path={SI.bell} />
          <h1 className="notifications-page__title">{t('pages.notifications.title')}</h1>
        </div>
        {notifications.some(n => !n.isRead) && (
          <ShopButton
            icon={<ShopIcon path={SI.check} />}
            aria-label={markAllActionLabel}
            title={markAllActionLabel}
            onClick={handleMarkAllAsRead}
            disabled={notificationActionsDisabled}
          >
            {t('pages.notifications.markAll')}
          </ShopButton>
        )}
      </div>
      {notifications.length > 0 ? (
        <section className="notifications-page__assistant" aria-label={t('pages.notifications.assistantTitle')}>
          <div className="notifications-page__assistantCopy">
            <span className="notifications-page__text notifications-page__eyebrow">{t('pages.notifications.assistantEyebrow')}</span>
            <h4 className="notifications-page__title">{t('pages.notifications.assistantTitle')}</h4>
            <span className="notifications-page__text notifications-page__text--secondary">{t('pages.notifications.assistantSubtitle')}</span>
          </div>
          <div className="notifications-page__signalGrid">
            <button
              type="button"
              className={`notifications-page__signal ${quickFilter === 'UNREAD' ? 'is-active' : ''}`}
              aria-pressed={quickFilter === 'UNREAD'}
              aria-label={`${t('pages.notifications.unreadCount')}: ${notificationInsights.unread}`}
              title={`${t('pages.notifications.unreadCount')}: ${notificationInsights.unread}`}
              onClick={() => setQuickFilter('UNREAD')}
            >
              <ShopIcon path={SI.bell} />
              <strong>{notificationInsights.unread}</strong>
              <span>{t('pages.notifications.unreadCount')}</span>
            </button>
            <button
              type="button"
              className={`notifications-page__signal ${quickFilter === 'PROMOTION' ? 'is-active' : ''}`}
              aria-pressed={quickFilter === 'PROMOTION'}
              aria-label={`${t('pages.notifications.promotionCount')}: ${notificationInsights.promotions}`}
              title={`${t('pages.notifications.promotionCount')}: ${notificationInsights.promotions}`}
              onClick={() => setQuickFilter('PROMOTION')}
            >
              <ShopIcon path={SI.gift} />
              <strong>{notificationInsights.promotions}</strong>
              <span>{t('pages.notifications.promotionCount')}</span>
            </button>
            <button
              type="button"
              className={`notifications-page__signal ${quickFilter === 'ORDER' ? 'is-active' : ''}`}
              aria-pressed={quickFilter === 'ORDER'}
              aria-label={`${t('pages.notifications.orderCount')}: ${notificationInsights.orders}`}
              title={`${t('pages.notifications.orderCount')}: ${notificationInsights.orders}`}
              onClick={() => setQuickFilter('ORDER')}
            >
              <ShopIcon path={SI.shopping} />
              <strong>{notificationInsights.orders}</strong>
              <span>{t('pages.notifications.orderCount')}</span>
            </button>
            <button
              type="button"
              className={`notifications-page__signal ${quickFilter === 'DELIVERY' ? 'is-active' : ''}`}
              aria-pressed={quickFilter === 'DELIVERY'}
              aria-label={`${t('pages.notifications.deliveryCount')}: ${notificationInsights.deliveries}`}
              title={`${t('pages.notifications.deliveryCount')}: ${notificationInsights.deliveries}`}
              onClick={() => setQuickFilter('DELIVERY')}
            >
              <ShopIcon path={SI.truck} />
              <strong>{notificationInsights.deliveries}</strong>
              <span>{t('pages.notifications.deliveryCount')}</span>
            </button>
          </div>
          {quickFilter !== 'ALL' ? (
            <ShopButton size="small" aria-label={clearFilterActionLabel} title={clearFilterActionLabel} onClick={() => setQuickFilter('ALL')}>{t('pages.notifications.clearFilter')}</ShopButton>
          ) : null}
        </section>
      ) : null}
      {notifications.length > 0 ? (
        <section className="notifications-page__actionPlan" aria-label={t('pages.notifications.actionPlanTitle')}>
          <div>
            <span className="notifications-page__text notifications-page__eyebrow">{t('pages.notifications.actionPlanEyebrow')}</span>
            <h4 className="notifications-page__title">{actionPlan.title}</h4>
            <span className="notifications-page__text notifications-page__text--secondary">{actionPlan.text}</span>
          </div>
          <div className="notifications-page__actionSignals">
            <span><ShopIcon path={SI.bell} /> {t('pages.notifications.actionSignalUnread', { count: notificationInsights.unread })}</span>
            <span><ShopIcon path={SI.gift} /> {t('pages.notifications.actionSignalOffers', { count: notificationInsights.promotions })}</span>
            <span><ShopIcon path={SI.truck} /> {t('pages.notifications.actionSignalDelivery', { count: notificationInsights.deliveries })}</span>
          </div>
          <ShopButton type="primary" aria-label={notificationActionPlanLabel} title={notificationActionPlanLabel} onClick={actionPlan.onClick}>{actionPlan.label}</ShopButton>
        </section>
      ) : null}
      {fetchError && notifications.length === 0 ? (
        <div data-notifications-load-recovery="true">
          <PageError
            className="notifications-page__loadError"
            title={t('common.loadFailed')}
            description={t('common.loadFailedRetry')}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: () => fetchNotifications(),
                type: 'primary',
              },
              {
                key: 'browse',
                label: t('pages.cart.browse'),
                onClick: () => navigate('/products'),
                type: 'default',
              },
              {
                key: 'coupons',
                label: t('pages.notifications.emptyCoupons'),
                onClick: () => navigate('/coupons'),
                type: 'default',
              },
              {
                key: 'track',
                label: t('pages.notifications.emptyTrackOrder'),
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
      ) : notifications.length === 0 ? (
        <PageEmpty
          className="notifications-page__emptyPanel"
          description={(
            <div className="notifications-page__emptyCopy">
              <h1 className="notifications-page__title">{t('pages.notifications.empty')}</h1>
              <div className="notifications-page__emptyHint">{t('pages.notifications.emptyHint')}</div>
            </div>
          )}
          actions={[
            {
              key: 'browse',
              label: t('pages.cart.browse'),
              onClick: () => navigate('/products'),
            },
            {
              key: 'coupons',
              label: t('pages.notifications.emptyCoupons'),
              onClick: () => navigate('/coupons'),
              type: 'default',
            },
            {
              key: 'track',
              label: t('pages.notifications.emptyTrackOrder'),
              onClick: () => navigate('/track-order'),
              type: 'default',
            },
          ]}
        />
      ) : (
        <>
          {fetchError ? (
            <ShopAlert
              className="notifications-page__staleAlert"
              type="warning"
              showIcon
              message={t('pages.notifications.fetchFailed')}
              description={t('pages.notifications.staleDataWarning')}
              action={<ShopButton size="small" onClick={() => fetchNotifications()}>{t('common.retry')}</ShopButton>}
            />
          ) : null}
          {filteredNotifications.length === 0 ? (
                <div className="notifications-page__filterEmpty" data-notifications-filter-empty="true">
                  <div className="notifications-page__emptyCopy">
                    <div>{t('pages.notifications.noFilterResults')}</div>
                    <div className="notifications-page__emptyHint">{t('pages.notifications.noFilterResultsHint')}</div>
                  </div>
                  <div className="notifications-page__filterEmptyActions" data-notifications-filter-empty-actions="true">
                    <ShopButton
                      type="primary"
                      aria-label={t('pages.notifications.clearFilter')}
                      title={t('pages.notifications.clearFilter')}
                      onClick={() => setQuickFilter('ALL')}
                    >
                      {t('pages.notifications.clearFilter')}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.shopping} />}
                      aria-label={t('pages.cart.browse')}
                      title={t('pages.cart.browse')}
                      onClick={() => navigate('/products')}
                    >
                      {t('pages.cart.browse')}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.gift} />}
                      aria-label={t('pages.notifications.emptyCoupons')}
                      title={t('pages.notifications.emptyCoupons')}
                      onClick={() => navigate('/coupons')}
                    >
                      {t('pages.notifications.emptyCoupons')}
                    </ShopButton>
                    <ShopButton
                      icon={<ShopIcon path={SI.truck} />}
                      aria-label={t('pages.notifications.emptyTrackOrder')}
                      title={t('pages.notifications.emptyTrackOrder')}
                      onClick={() => navigate('/track-order')}
                    >
                      {t('pages.notifications.emptyTrackOrder')}
                    </ShopButton>
                  </div>
                </div>
          ) : (
            <>
            <ul className="notifications-page__itemList" role="list">
              {filteredNotifications.map((item) => {
              const notificationName = item.title || formatNotificationType(item.type) || `#${item.id}`;
              const relatedOrderNo = extractOrderNoFromNotification(item);
              const relatedType = String(item.type || '').trim().toUpperCase();
              const openRelatedLabel = relatedOrderNo
                ? `${relatedType === 'DELIVERY' ? t('pages.notifications.actionTrackOrder') : t('pages.notifications.actionOpenOrders')}: ${relatedOrderNo}`
                : relatedType === 'DELIVERY'
                  ? t('pages.notifications.actionTrackOrder')
                  : relatedType === 'PROMOTION'
                    ? t('pages.notifications.actionOpenCoupons')
                    : relatedType === 'ORDER'
                      ? t('pages.notifications.actionOpenOrders')
                      : t('pages.notifications.openRelated');
              const showOpenRelated = Boolean(relatedOrderNo || relatedType === 'DELIVERY' || relatedType === 'ORDER' || relatedType === 'PROMOTION');
              const markReadActionLabel = `${t('pages.notifications.markRead')}: ${notificationName}`;
              const deleteActionLabel = `${t('common.delete')}: ${notificationName}`;
              return (
              <li
                key={item.id}
                className={item.isRead ? 'notifications-page__item' : 'notifications-page__item notifications-page__item--unread'}
              >
                <div className="notifications-page__itemMeta">
                  <div className="notifications-page__itemBody">
                    <div className="notifications-page__itemActions">
                      <ShopTag color={typeColors[String(item.type || '').trim().toUpperCase()] || 'default'}>
                        {formatNotificationType(item.type)}
                      </ShopTag>
                      <button
                        type="button"
                        className="notifications-page__titleButton"
                        onClick={() => openRelatedNotification(item)}
                        aria-label={openRelatedLabel}
                        title={openRelatedLabel}
                      >
                        <span className={`notifications-page__text${!item.isRead ? ' notifications-page__text--strong' : ''}`}>{item.title}</span>
                      </button>
                      {item.isRead && <ShopIcon path={SI.checkCircle} style={{ color: '#52c41a' }} />}
                    </div>
                    <div>
                      {renderMessage(item)}
                      <span className="notifications-page__text notifications-page__text--secondary" style={{ fontSize: 12 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="notifications-page__itemSideActions">
                  {showOpenRelated ? (
                    <ShopButton
                      size="small"
                      type="link"
                      aria-label={openRelatedLabel}
                      title={openRelatedLabel}
                      onClick={() => openRelatedNotification(item)}
                      disabled={notificationActionsDisabled}
                    >
                      {relatedOrderNo
                        ? (relatedType === 'DELIVERY' ? t('pages.notifications.actionTrackOrder') : t('pages.notifications.actionOpenOrders'))
                        : openRelatedLabel}
                    </ShopButton>
                  ) : null}
                  {!item.isRead ? (
                    <ShopButton
                      size="small"
                      type="link"
                      aria-label={markReadActionLabel}
                      title={markReadActionLabel}
                      onClick={() => handleMarkAsRead(item.id)}
                      disabled={notificationActionsDisabled}
                    >
                      {t('pages.notifications.markRead')}
                    </ShopButton>
                  ) : null}
                  <ShopPopconfirm
                    rootClassName='shop-mobile-popup-layer notifications-delete-popconfirm'
                    title={t('pages.notifications.deleteConfirm')}
                    onConfirm={() => handleDelete(item.id)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    disabled={notificationActionsDisabled}
                  >
                    <ShopButton
                      className="notifications-page__deleteButton"
                      size="small"
                      type="link"
                      danger
                      icon={<ShopIcon path={SI.delete} />}
                      aria-label={deleteActionLabel}
                      title={deleteActionLabel}
                      disabled={notificationActionsDisabled}
                    />
                  </ShopPopconfirm>
                </div>
              </li>
              );
            })}
            </ul>
            {hasMoreNotifications ? (
              <div className="notifications-page__loadMore">
                <span className="notifications-page__text notifications-page__text--secondary">{t('pages.notifications.loadedCount', { count: notifications.length })}</span>
                <ShopButton
                  onClick={() => fetchNotifications(notificationPage + 1, true)}
                  loading={loadingMore}
                  disabled={loadingMore}
                  aria-label={loadMoreActionLabel}
                  title={loadMoreActionLabel}
                >
                  {loadingMore ? t('pages.notifications.loadingMore') : t('pages.notifications.loadMore')}
                </ShopButton>
              </div>
            ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, List, Typography, Tag, Button, Empty, Spin, message, Popconfirm, Space } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined, GiftOutlined, ShoppingOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import type { AppNotification } from '../types';
import { useLanguage } from '../i18n';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import { dispatchDomEvent } from '../utils/domEvents';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { hasStoredValue } from '../utils/safeStorage';
import './Notifications.css';
import '../styles/mobile-page-contrast.css';

const { Text, Title } = Typography;

const typeColors: Record<string, string> = {
  ORDER: 'blue',
  PROMOTION: 'orange',
  SYSTEM: 'default',
  DELIVERY: 'green',
};
const NOTIFICATION_TYPE_KEYS = new Set(['ORDER', 'PROMOTION', 'SYSTEM', 'DELIVERY']);
const NOTIFICATION_PAGE_SIZE = 50;

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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [notificationPage, setNotificationPage] = useState(1);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'UNREAD' | 'PROMOTION' | 'ORDER' | 'DELIVERY'>('ALL');
  const mountedRef = useRef(true);
  const notificationFetchSeqRef = useRef(0);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

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
      message.error(t('pages.notifications.fetchFailed'));
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
      message.warning(t('messages.loginRequired'));
      navigate(buildLoginUrlFromWindow());
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, navigate, t]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((current) => current.map(n => n.id === id ? { ...n, isRead: true } : n));
      notifyNavbarChanged();
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAsRead', error);
      message.error(t('messages.operationFailed'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((current) => current.map(n => ({ ...n, isRead: true })));
      notifyNavbarChanged();
      message.success(t('pages.notifications.allRead'));
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAllAsRead', error);
      message.error(t('messages.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationApi.delete(id);
      setNotifications((current) => current.filter(n => n.id !== id));
      notifyNavbarChanged();
      message.success(t('messages.deleteSuccess'));
    } catch (error) {
      reportNonBlockingError('Notifications.handleDelete', error);
      message.error(t('messages.deleteFailed'));
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

  if (loading) {
    return (
      <div
        className="notifications-page notifications-page--loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={t('common.loading')}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="notifications-page__header">
        <div className="notifications-page__title">
          <BellOutlined />
          <Title level={3}>{t('pages.notifications.title')}</Title>
        </div>
        {notifications.some(n => !n.isRead) && (
          <Button
            icon={<CheckOutlined />}
            aria-label={markAllActionLabel}
            title={markAllActionLabel}
            onClick={handleMarkAllAsRead}
            disabled={notificationActionsDisabled}
          >
            {t('pages.notifications.markAll')}
          </Button>
        )}
      </div>
      {notifications.length > 0 ? (
        <section className="notifications-page__assistant" aria-label={t('pages.notifications.assistantTitle')}>
          <div className="notifications-page__assistantCopy">
            <Text className="notifications-page__eyebrow">{t('pages.notifications.assistantEyebrow')}</Text>
            <Title level={4}>{t('pages.notifications.assistantTitle')}</Title>
            <Text type="secondary">{t('pages.notifications.assistantSubtitle')}</Text>
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
              <BellOutlined />
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
              <GiftOutlined />
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
              <ShoppingOutlined />
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
              <TruckOutlined />
              <strong>{notificationInsights.deliveries}</strong>
              <span>{t('pages.notifications.deliveryCount')}</span>
            </button>
          </div>
          {quickFilter !== 'ALL' ? (
            <Button size="small" aria-label={clearFilterActionLabel} title={clearFilterActionLabel} onClick={() => setQuickFilter('ALL')}>{t('pages.notifications.clearFilter')}</Button>
          ) : null}
        </section>
      ) : null}
      {notifications.length > 0 ? (
        <section className="notifications-page__actionPlan" aria-label={t('pages.notifications.actionPlanTitle')}>
          <div>
            <Text className="notifications-page__eyebrow">{t('pages.notifications.actionPlanEyebrow')}</Text>
            <Title level={4}>{actionPlan.title}</Title>
            <Text type="secondary">{actionPlan.text}</Text>
          </div>
          <div className="notifications-page__actionSignals">
            <span><BellOutlined /> {t('pages.notifications.actionSignalUnread', { count: notificationInsights.unread })}</span>
            <span><GiftOutlined /> {t('pages.notifications.actionSignalOffers', { count: notificationInsights.promotions })}</span>
            <span><TruckOutlined /> {t('pages.notifications.actionSignalDelivery', { count: notificationInsights.deliveries })}</span>
          </div>
          <Button type="primary" aria-label={notificationActionPlanLabel} title={notificationActionPlanLabel} onClick={actionPlan.onClick}>{actionPlan.label}</Button>
        </section>
      ) : null}
      {fetchError && notifications.length === 0 ? (
        <Alert
          type="error"
          showIcon
          message={t('common.loadFailed')}
          description={t('common.loadFailedRetry')}
          action={<Button size="small" onClick={() => fetchNotifications()}>{t('common.retry')}</Button>}
        />
      ) : notifications.length === 0 ? (
        <Empty description={t('pages.notifications.empty')} />
      ) : (
        <>
          {fetchError ? (
            <Alert
              className="notifications-page__staleAlert"
              type="warning"
              showIcon
              message={t('pages.notifications.fetchFailed')}
              description={t('pages.notifications.staleDataWarning')}
              action={<Button size="small" onClick={() => fetchNotifications()}>{t('common.retry')}</Button>}
            />
          ) : null}
          <List
            dataSource={filteredNotifications}
            locale={{ emptyText: t('pages.notifications.noFilterResults') }}
            footer={hasMoreNotifications ? (
              <div className="notifications-page__loadMore">
                <Text type="secondary">{t('pages.notifications.loadedCount', { count: notifications.length })}</Text>
                <Button
                  onClick={() => fetchNotifications(notificationPage + 1, true)}
                  loading={loadingMore}
                  disabled={loadingMore}
                  aria-label={loadMoreActionLabel}
                  title={loadMoreActionLabel}
                >
                  {loadingMore ? t('pages.notifications.loadingMore') : t('pages.notifications.loadMore')}
                </Button>
              </div>
            ) : null}
            renderItem={(item) => {
              const notificationName = item.title || formatNotificationType(item.type) || `#${item.id}`;
              const markReadActionLabel = `${t('pages.notifications.markRead')}: ${notificationName}`;
              const deleteActionLabel = `${t('common.delete')}: ${notificationName}`;
              return (
              <List.Item
                className={item.isRead ? 'notifications-page__item' : 'notifications-page__item notifications-page__item--unread'}
                actions={[
                  !item.isRead && (
                    <Button
                      key="mark-read"
                      size="small"
                      type="link"
                      aria-label={markReadActionLabel}
                      title={markReadActionLabel}
                      onClick={() => handleMarkAsRead(item.id)}
                      disabled={notificationActionsDisabled}
                    >
                      {t('pages.notifications.markRead')}
                    </Button>
                  ),
                  <Popconfirm
                    key="delete"
                    classNames={{ root: 'shop-mobile-popup-layer notifications-delete-popconfirm' }}
                    title={t('pages.notifications.deleteConfirm')}
                    onConfirm={() => handleDelete(item.id)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                    disabled={notificationActionsDisabled}
                  >
                    <Button
                      className="notifications-page__deleteButton"
                      size="small"
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={deleteActionLabel}
                      title={deleteActionLabel}
                      disabled={notificationActionsDisabled}
                    />
                  </Popconfirm>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={typeColors[String(item.type || '').trim().toUpperCase()] || 'default'}>
                        {formatNotificationType(item.type)}
                      </Tag>
                      <Text strong={!item.isRead}>{item.title}</Text>
                      {item.isRead && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    </Space>
                  }
                  description={
                    <div>
                      {renderMessage(item)}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : ''}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
              );
            }}
          />
        </>
      )}
    </div>
  );
};

export default Notifications;

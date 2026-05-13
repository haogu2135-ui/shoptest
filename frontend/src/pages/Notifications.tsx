import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { List, Typography, Tag, Button, Empty, Spin, message, Popconfirm, Space } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined, GiftOutlined, ShoppingOutlined, TruckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import type { AppNotification } from '../types';
import { useLanguage } from '../i18n';
import { stripUnsafeHtml } from '../utils/sanitizeHtml';
import './Notifications.css';

const { Text, Title } = Typography;

const typeColors: Record<string, string> = {
  ORDER: 'blue',
  PROMOTION: 'orange',
  SYSTEM: 'default',
  DELIVERY: 'green',
};

const notifyNavbarChanged = () => {
  window.dispatchEvent(new Event('shop:notifications-updated'));
};

const sortNotifications = (items: AppNotification[]) =>
  [...items].sort((left, right) => {
    if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'UNREAD' | 'PROMOTION' | 'ORDER' | 'DELIVERY'>('ALL');
  const navigate = useNavigate();
  const userId = Number(localStorage.getItem('userId'));
  const { t, language } = useLanguage();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.getByUser(userId);
      setNotifications(sortNotifications(res.data));
    } catch {
      message.error(t('pages.notifications.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  useEffect(() => {
    if (!userId) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, userId, navigate, t]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id, userId);
      setNotifications((current) => current.map(n => n.id === id ? { ...n, isRead: true } : n));
      notifyNavbarChanged();
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead(userId);
      setNotifications((current) => current.map(n => ({ ...n, isRead: true })));
      notifyNavbarChanged();
      message.success(t('pages.notifications.allRead'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationApi.delete(id, userId);
      setNotifications((current) => current.filter(n => n.id !== id));
      notifyNavbarChanged();
      message.success(t('messages.deleteSuccess'));
    } catch {
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

  if (loading) {
    return <div className="notifications-page notifications-page--loading"><Spin size="large" /></div>;
  }

  return (
    <div className="notifications-page">
      <div className="notifications-page__header">
        <div className="notifications-page__title">
          <BellOutlined />
          <Title level={3}>{t('pages.notifications.title')}</Title>
        </div>
        {notifications.some(n => !n.isRead) && (
          <Button icon={<CheckOutlined />} onClick={handleMarkAllAsRead}>{t('pages.notifications.markAll')}</Button>
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
            <button type="button" className={`notifications-page__signal ${quickFilter === 'UNREAD' ? 'is-active' : ''}`} onClick={() => setQuickFilter('UNREAD')}>
              <BellOutlined />
              <strong>{notificationInsights.unread}</strong>
              <span>{t('pages.notifications.unreadCount')}</span>
            </button>
            <button type="button" className={`notifications-page__signal ${quickFilter === 'PROMOTION' ? 'is-active' : ''}`} onClick={() => setQuickFilter('PROMOTION')}>
              <GiftOutlined />
              <strong>{notificationInsights.promotions}</strong>
              <span>{t('pages.notifications.promotionCount')}</span>
            </button>
            <button type="button" className={`notifications-page__signal ${quickFilter === 'ORDER' ? 'is-active' : ''}`} onClick={() => setQuickFilter('ORDER')}>
              <ShoppingOutlined />
              <strong>{notificationInsights.orders}</strong>
              <span>{t('pages.notifications.orderCount')}</span>
            </button>
            <button type="button" className={`notifications-page__signal ${quickFilter === 'DELIVERY' ? 'is-active' : ''}`} onClick={() => setQuickFilter('DELIVERY')}>
              <TruckOutlined />
              <strong>{notificationInsights.deliveries}</strong>
              <span>{t('pages.notifications.deliveryCount')}</span>
            </button>
          </div>
          {quickFilter !== 'ALL' ? (
            <Button size="small" onClick={() => setQuickFilter('ALL')}>{t('pages.notifications.clearFilter')}</Button>
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
          <Button type="primary" onClick={actionPlan.onClick}>{actionPlan.label}</Button>
        </section>
      ) : null}
      {notifications.length === 0 ? (
        <Empty description={t('pages.notifications.empty')} />
      ) : (
        <List
          dataSource={filteredNotifications}
          locale={{ emptyText: t('pages.notifications.noFilterResults') }}
          renderItem={item => (
            <List.Item
              className={item.isRead ? 'notifications-page__item' : 'notifications-page__item notifications-page__item--unread'}
              actions={[
                !item.isRead && (
                  <Button key="mark-read" size="small" type="link" onClick={() => handleMarkAsRead(item.id)}>{t('pages.notifications.markRead')}</Button>
                ),
                <Popconfirm key="delete" title={t('pages.notifications.deleteConfirm')} onConfirm={() => handleDelete(item.id)}>
                  <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={typeColors[item.type] || 'default'}>{t(`status.${item.type}`)}</Tag>
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
          )}
        />
      )}
    </div>
  );
};

export default Notifications;

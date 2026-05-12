import React, { useCallback, useEffect, useState } from 'react';
import { List, Typography, Tag, Button, Empty, Spin, message, Popconfirm, Space } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
      await notificationApi.markAsRead(id);
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
      await notificationApi.delete(id);
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
      {notifications.length === 0 ? (
        <Empty description={t('pages.notifications.empty')} />
      ) : (
        <List
          dataSource={notifications}
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

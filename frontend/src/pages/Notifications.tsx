import React, { useCallback, useEffect, useState } from 'react';
import { List, Typography, Tag, Button, Empty, Spin, message, Popconfirm, Space } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import type { AppNotification } from '../types';
import { useLanguage } from '../i18n';

const { Text, Title } = Typography;

const typeColors: Record<string, string> = {
  ORDER: 'blue',
  PROMOTION: 'orange',
  SYSTEM: 'default',
  DELIVERY: 'green',
};

const stripUnsafeHtml = (html: string) => {
  const scriptProtocol = ['java', 'script:'].join('');
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith(scriptProtocol)) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const userId = Number(localStorage.getItem('userId'));
  const { t, language } = useLanguage();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.getByUser(userId);
      setNotifications(res.data);
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
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead(userId);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      message.success(t('pages.notifications.allRead'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationApi.delete(id);
      setNotifications(notifications.filter(n => n.id !== id));
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
    return <div style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{item.message}</div>;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div className="notifications-page" style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BellOutlined style={{ fontSize: 24, marginRight: 8 }} />
          <Title level={3} style={{ margin: 0 }}>{t('pages.notifications.title')}</Title>
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
              style={{ background: item.isRead ? '#fff' : '#fff8f0', padding: '16px', marginBottom: 8, borderRadius: 8, border: '1px solid #f0f0f0' }}
              actions={[
                !item.isRead && (
                  <Button size="small" type="link" onClick={() => handleMarkAsRead(item.id)}>{t('pages.notifications.markRead')}</Button>
                ),
                <Popconfirm title={t('pages.notifications.deleteConfirm')} onConfirm={() => handleDelete(item.id)}>
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

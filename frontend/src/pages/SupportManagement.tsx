import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, message, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { AlertOutlined, CheckCircleOutlined, CustomerServiceOutlined, SendOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminSupportApi, apiBaseUrl, orderApi, supportWebSocketUrl } from '../api';
import type { Order, OrderItem, SupportMessage, SupportSession } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';
import './SupportManagement.css';

const { Text, Title } = Typography;
const ORDER_PREFIX = '[ORDER]';
const supportOrderImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveSupportOrderImage = (imageUrl?: string) => {
  if (!imageUrl) return supportOrderImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

const SupportManagement: React.FC = () => {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState<string | undefined>('OPEN');
  const [content, setContent] = useState('');
  const [connected, setConnected] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionRef = useRef<SupportSession | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();

  const playTone = () => {
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioContextRef.current || new AudioCtor();
      audioContextRef.current = context;
      if (context.state === 'suspended') {
        void context.resume();
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
      oscillator.stop(context.currentTime + 0.2);
    } catch {
      // best effort
    }
  };

  const decodeOrderMessage = (text: string) => {
    if (!text.startsWith(ORDER_PREFIX)) return null;
    try {
      return JSON.parse(text.slice(ORDER_PREFIX.length));
    } catch {
      return null;
    }
  };

  const displayLastMessage = (content?: string) => {
    if (!content) return t('pages.support.noMessages');
    const order = decodeOrderMessage(content);
    return order ? `${t('pages.support.order')} ${order.orderNo || `#${order.id}`}` : content;
  };

  const sortSupportSessions = (items: SupportSession[]) =>
    [...items].sort((left, right) => {
      const unreadDelta = Number(right.unreadByAdmin || 0) - Number(left.unreadByAdmin || 0);
      if (unreadDelta !== 0) return unreadDelta;
      const leftOpen = left.status === 'OPEN' ? 1 : 0;
      const rightOpen = right.status === 'OPEN' ? 1 : 0;
      if (leftOpen !== rightOpen) return rightOpen - leftOpen;
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime || right.id - left.id;
    });

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  const loadSessions = useCallback(async (status = filter) => {
    try {
      const apiStatus = status === 'NEEDS_REPLY' ? 'OPEN' : status;
      const res = await adminSupportApi.getSessions(apiStatus);
      setSessions(sortSupportSessions(res.data));
      const currentSession = selectedSessionRef.current;
      if (currentSession) {
        const fresh = res.data.find((item) => item.id === currentSession.id);
        if (fresh) setSelectedSession(fresh);
      }
    } catch {
      message.error(t('pages.adminSupport.loadFailed'));
    }
  }, [filter, t]);

  const loadMessages = async (session: SupportSession) => {
    setSelectedSession(session);
    try {
      const res = await adminSupportApi.getMessages(session.id);
      setMessages(res.data);
      await loadSessions();
    } catch {
      message.error(t('pages.adminSupport.loadFailed'));
    }
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    let shouldReconnect = true;
    const connect = () => {
      if (!shouldReconnect) return;
      const socket = new WebSocket(supportWebSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (shouldReconnect) {
          reconnectTimerRef.current = window.setTimeout(connect, 2500);
        }
      };
      socket.onerror = () => setConnected(false);
      socket.onmessage = (event) => {
        const payload = parseSupportSocketPayload(event.data);
        if (payload.type === 'ERROR') {
          message.warning(payload.message || t('pages.support.messageRejected'));
          return;
        }
        if (payload.type === 'MESSAGE') {
          setSessions((items) => sortSupportSessions([payload.session, ...items.filter((item) => item.id !== payload.session.id)]));
          if (selectedSessionRef.current?.id === payload.message.sessionId) {
            setMessages((items) => {
              if (items.some((item) => item.id === payload.message.id)) {
                return items;
              }
              if (payload.message.senderRole === 'USER') {
                playTone();
              }
              return [...items, payload.message];
            });
            adminSupportApi.markRead(payload.message.sessionId).catch(() => undefined);
          } else if (payload.message.senderRole === 'USER') {
            playTone();
          }
        }
        if (payload.type === 'SESSION_CLOSED' || payload.type === 'SESSION_UPDATED') {
          setSessions((items) => items.map((item) => item.id === payload.session.id ? payload.session : item));
          if (selectedSessionRef.current?.id === payload.session.id) setSelectedSession(payload.session);
        }
      };
    };
    connect();
    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [t]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      await loadSessions();
      const activeSession = selectedSessionRef.current;
      if (activeSession) {
        try {
          const res = await adminSupportApi.getMessages(activeSession.id);
          setMessages(res.data);
        } catch {
          // Polling is a backup path for missed socket events.
        }
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, selectedSession]);

  const send = async () => {
    const text = content.trim();
    if (!text || !selectedSession) return;
    if (text.length > supportChatConfig.maxMessageChars) {
      message.warning(t('pages.support.messageTooLong', { count: supportChatConfig.maxMessageChars }));
      return;
    }
    if (selectedSession.status !== 'OPEN') {
      message.warning(t('pages.adminSupport.sessionClosed'));
      return;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'SEND', sessionId: selectedSession.id, content: text }));
      setContent('');
      return;
    }
    try {
      const res = await adminSupportApi.sendMessage(selectedSession.id, text);
      setSelectedSession(res.data.session);
      setSessions((items) => [res.data.session, ...items.filter((item) => item.id !== res.data.session.id)]);
      setMessages((items) => items.some((item) => item.id === res.data.message.id) ? items : [...items, res.data.message]);
      setContent('');
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.support.connectFailed'));
    }
  };

  const closeSession = async () => {
    if (!selectedSession) return;
    try {
      const res = await adminSupportApi.closeSession(selectedSession.id);
      setSelectedSession(res.data);
      setSessions((items) => items.map((item) => item.id === res.data.id ? res.data : item));
      message.success(t('pages.adminSupport.sessionClosed'));
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const openOrderDetail = async (orderId: number) => {
    setDetailLoading(true);
    try {
      const [orderRes, itemsRes] = await Promise.all([
        orderApi.getById(orderId),
        orderApi.getItems(orderId),
      ]);
      setDetailOrder(orderRes.data);
      setDetailItems(itemsRes.data);
    } catch {
      message.error(t('pages.support.orderLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const openSessionCount = sessions.filter((item) => item.status === 'OPEN').length;
  const closedSessionCount = sessions.filter((item) => item.status === 'CLOSED').length;
  const unreadSessionCount = sessions.filter((item) => Number(item.unreadByAdmin || 0) > 0).length;
  const unreadMessageCount = sessions.reduce((sum, item) => sum + Number(item.unreadByAdmin || 0), 0);
  const filteredQueueSessions = filter === 'NEEDS_REPLY'
    ? sessions.filter((item) => Number(item.unreadByAdmin || 0) > 0)
    : sessions;

  return (
    <div className="support-management">
      <div className="support-management__header">
        <Space>
          <CustomerServiceOutlined style={{ fontSize: 22, color: '#ee4d2d' }} />
          <Title level={4} style={{ margin: 0 }}>{t('pages.adminSupport.title')}</Title>
          <Badge status={connected ? 'success' : 'default'} text={connected ? t('pages.support.online') : t('pages.support.offline')} />
        </Space>
        <Select
          value={filter || 'ALL'}
          style={{ width: 150 }}
          onChange={(value) => setFilter(value === 'ALL' ? undefined : value)}
          options={[
            { value: 'OPEN', label: t('status.OPEN') },
            { value: 'CLOSED', label: t('status.CLOSED') },
            { value: 'NEEDS_REPLY', label: t('pages.adminSupport.needsReply') },
            { value: 'ALL', label: t('common.all') },
          ]}
        />
      </div>

      <div className="support-management__insightBar" aria-label={t('pages.adminSupport.queueTitle')}>
        <div className="support-management__insightIntro">
          <ThunderboltOutlined />
          <div>
            <Text strong>{t('pages.adminSupport.queueTitle')}</Text>
            <Text type="secondary">{t('pages.adminSupport.queueSubtitle')}</Text>
          </div>
        </div>
        <div className="support-management__insightStats">
          <Tag color={unreadMessageCount > 0 ? 'red' : 'default'}>{t('pages.adminSupport.unreadMessages', { count: unreadMessageCount })}</Tag>
          <Tag color={openSessionCount > 0 ? 'green' : 'default'}>{t('pages.adminSupport.openSessions', { count: openSessionCount })}</Tag>
          <Tag color="default">{t('pages.adminSupport.closedSessions', { count: closedSessionCount })}</Tag>
        </div>
        <div className="support-management__insightActions">
          <Button size="small" icon={<AlertOutlined />} onClick={() => setFilter('NEEDS_REPLY')} disabled={unreadSessionCount === 0}>
            {t('pages.adminSupport.showNeedsReply')}
          </Button>
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => setFilter('OPEN')}>
            {t('pages.adminSupport.showOpen')}
          </Button>
        </div>
      </div>

      <div className="support-management__layout">
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
          {filteredQueueSessions.length === 0 ? (
            <Empty style={{ marginTop: 80 }} description={t('pages.adminSupport.noSessions')} />
          ) : (
            <List
              dataSource={filteredQueueSessions}
              renderItem={(item) => (
                <List.Item
                  onClick={() => loadMessages(item)}
                  style={{
                    cursor: 'pointer',
                    padding: 14,
                    background: selectedSession?.id === item.id ? '#fff2ee' : '#fff',
                    borderLeft: selectedSession?.id === item.id ? '3px solid #ee4d2d' : '3px solid transparent',
                  }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.username || `${t('pages.adminSupport.user')} #${item.userId}`}</Text>
                        <Tag color={item.status === 'OPEN' ? 'green' : 'default'}>{t(`status.${item.status}`)}</Tag>
                        {!!item.unreadByAdmin && <Badge count={item.unreadByAdmin} size="small" />}
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary" ellipsis>{displayLastMessage(item.lastMessage)}</Text>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString(dateLocale) : ''}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedSession ? (
            <Empty style={{ marginTop: 180 }} description={t('pages.adminSupport.selectSession')} />
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  <Text strong>{selectedSession.username || `${t('pages.adminSupport.user')} #${selectedSession.userId}`}</Text>
                  <Tag color={selectedSession.status === 'OPEN' ? 'green' : 'default'}>{t(`status.${selectedSession.status}`)}</Tag>
                </Space>
                <Button disabled={selectedSession.status !== 'OPEN'} onClick={closeSession}>{t('pages.adminSupport.closeSession')}</Button>
              </div>
              <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
                {messages.length === 0 ? (
                  <Empty description={t('pages.support.noMessages')} />
                ) : (
                  <List
                    dataSource={messages}
                    renderItem={(item) => {
                      const mine = item.senderRole === 'ADMIN';
                      const order = decodeOrderMessage(item.content);
                      return (
                        <List.Item style={{ justifyContent: mine ? 'flex-end' : 'flex-start', border: 0, padding: '7px 0' }}>
                          <div style={{ maxWidth: '70%', textAlign: mine ? 'right' : 'left' }}>
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>
                              {mine ? t('pages.support.agent') : (item.senderName || t('pages.adminSupport.user'))}
                              {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </div>
                            {order ? (
                              <Card size="small" style={{ display: 'inline-block', minWidth: 220, maxWidth: '100%', borderColor: mine ? '#f6c1b3' : '#eee', background: mine ? '#fff7f4' : '#fff', textAlign: 'left' }}>
                                <Space align="start">
                                  <ShoppingOutlined style={{ color: '#ee4d2d', marginTop: 4 }} />
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{order.orderNo || `${t('pages.support.order')} #${order.id}`}</div>
                                    <div style={{ color: '#ee4d2d', fontWeight: 600 }}>{formatMoney(order.totalAmount)}</div>
                                    <div style={{ marginTop: 4 }}>
                                      <Tag color="blue">{order.status}</Tag>
                                      {order.paymentMethod ? <Tag>{order.paymentMethod}</Tag> : null}
                                    </div>
                                    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openOrderDetail(order.id)}>
                                      {t('pages.support.viewOrder')}
                                    </Button>
                                  </div>
                                </Space>
                              </Card>
                            ) : (
                              <div style={{ display: 'inline-block', padding: '8px 10px', borderRadius: 8, background: mine ? '#ee4d2d' : '#fff', color: mine ? '#fff' : '#333', border: mine ? 0 : '1px solid #eee', whiteSpace: 'pre-wrap' }}>
                                {item.content}
                              </div>
                            )}
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                )}
              </div>
              <div style={{ padding: 12, borderTop: '1px solid #eee' }}>
                <Input.TextArea
                  value={content}
                  disabled={selectedSession.status !== 'OPEN'}
                  maxLength={supportChatConfig.maxMessageChars}
                  showCount
                  onChange={(event) => setContent(event.target.value)}
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder={t('pages.adminSupport.messagePlaceholder')}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={selectedSession.status !== 'OPEN'}>{t('common.send')}</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        title={detailOrder ? `${t('pages.support.order')} ${detailOrder.orderNo || `#${detailOrder.id}`}` : t('pages.support.order')}
        open={!!detailOrder || detailLoading}
        onCancel={() => {
          setDetailOrder(null);
          setDetailItems([]);
        }}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
        ) : detailOrder ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <Tag color="blue">{detailOrder.status}</Tag>
              {detailOrder.paymentMethod ? <Tag>{detailOrder.paymentMethod}</Tag> : null}
              <Text strong style={{ color: '#ee4d2d' }}>{formatMoney(detailOrder.totalAmount)}</Text>
            </Space>
            {detailOrder.shippingAddress ? <Text type="secondary">{detailOrder.shippingAddress}</Text> : null}
            <List
              dataSource={detailItems}
              locale={{ emptyText: t('pages.support.noOrderItems') }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <img
                        src={resolveSupportOrderImage(item.imageUrl)}
                        alt={item.productName}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }}
                        onError={(event) => {
                          if (event.currentTarget.src !== supportOrderImageFallback) {
                            event.currentTarget.src = supportOrderImageFallback;
                          }
                        }}
                      />
                    }
                    title={item.productName || `#${item.productId}`}
                    description={`${formatMoney(item.price)} x ${item.quantity}`}
                  />
                  <Text strong>{formatMoney(item.price * item.quantity)}</Text>
                </List.Item>
              )}
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};

export default SupportManagement;

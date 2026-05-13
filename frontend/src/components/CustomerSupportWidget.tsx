import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, message, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { CloseOutlined, CustomerServiceOutlined, SendOutlined, ShoppingOutlined, SoundOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl, orderApi, supportApi, supportWebSocketUrl, userApi } from '../api';
import type { Order, OrderItem, SupportMessage, SupportSession } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';

const { Text } = Typography;
const ORDER_PREFIX = '[ORDER]';
const SUPPORT_BUTTON_POSITION_KEY = 'shop-support-button-position';
const SUPPORT_BUTTON_SIZE = 56;
const SUPPORT_BUTTON_MARGIN = 12;
const supportOrderImageFallback = 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80';

const resolveSupportOrderImage = (imageUrl?: string) => {
  if (!imageUrl) return supportOrderImageFallback;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) {
    return imageUrl;
  }
  return `${apiBaseUrl}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
};

type SupportButtonPosition = {
  left: number;
  top: number;
};

const CustomerSupportWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadFailed, setOrdersLoadFailed] = useState(false);
  const [orderSelectOpen, setOrderSelectOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [unread, setUnread] = useState(0);
  const [buttonPosition, setButtonPosition] = useState<SupportButtonPosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SupportSession | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const token = localStorage.getItem('token');
  const activeSessionId = session?.id;
  const quickReplies = useMemo(() => [
    t('pages.support.quickShipping'),
    t('pages.support.quickPayment'),
    t('pages.support.quickReturn'),
  ], [t]);
  const trimmedContent = content.trim();
  const messageLength = trimmedContent.length;
  const messageTooLong = messageLength > supportChatConfig.maxMessageChars;
  const hasSharedOrder = useMemo(
    () => messages.some((item) => item.senderRole === 'USER' && item.content.startsWith(ORDER_PREFIX)),
    [messages]
  );
  const supportIntent = useMemo(() => {
    const normalizedContent = trimmedContent.toLowerCase();
    const matchedQuickReplyIndex = quickReplies.findIndex((reply) => normalizedContent.includes(reply.toLowerCase()));
    if (matchedQuickReplyIndex === 0) {
      return {
        label: t('pages.support.triageDelivery'),
        helper: hasSharedOrder ? t('pages.support.triageOrderShared') : t('pages.support.triageDeliveryHint'),
      };
    }
    if (matchedQuickReplyIndex === 1) {
      return {
        label: t('pages.support.triagePayment'),
        helper: hasSharedOrder ? t('pages.support.triageOrderShared') : t('pages.support.triagePaymentHint'),
      };
    }
    if (matchedQuickReplyIndex === 2) {
      return {
        label: t('pages.support.triageReturn'),
        helper: hasSharedOrder ? t('pages.support.triageOrderShared') : t('pages.support.triageReturnHint'),
      };
    }
    return {
      label: t('pages.support.triageGeneral'),
      helper: hasSharedOrder ? t('pages.support.triageOrderShared') : t('pages.support.triageGeneralHint'),
    };
  }, [hasSharedOrder, quickReplies, t, trimmedContent]);
  const messageQualityText = messageTooLong
    ? t('pages.support.messageTooLongInline', { count: supportChatConfig.maxMessageChars })
    : messageLength > 0
      ? t('pages.support.messageReady')
      : t('pages.support.messageDraftHint');

  const getDefaultButtonPosition = useCallback((): SupportButtonPosition => ({
    left: Math.max(SUPPORT_BUTTON_MARGIN, window.innerWidth - SUPPORT_BUTTON_SIZE - 24),
    top: Math.max(SUPPORT_BUTTON_MARGIN, window.innerHeight - SUPPORT_BUTTON_SIZE - 24),
  }), []);

  const clampButtonPosition = useCallback((position: SupportButtonPosition): SupportButtonPosition => ({
    left: Math.min(Math.max(SUPPORT_BUTTON_MARGIN, position.left), Math.max(SUPPORT_BUTTON_MARGIN, window.innerWidth - SUPPORT_BUTTON_SIZE - SUPPORT_BUTTON_MARGIN)),
    top: Math.min(Math.max(SUPPORT_BUTTON_MARGIN, position.top), Math.max(SUPPORT_BUTTON_MARGIN, window.innerHeight - SUPPORT_BUTTON_SIZE - SUPPORT_BUTTON_MARGIN)),
  }), []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SUPPORT_BUTTON_POSITION_KEY) || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        setButtonPosition(clampButtonPosition(saved));
        return;
      }
    } catch {
      // Fall back to the default corner if saved coordinates are invalid.
    }
    setButtonPosition(getDefaultButtonPosition());
  }, [clampButtonPosition, getDefaultButtonPosition]);

  useEffect(() => {
    const handleResize = () => {
      setButtonPosition((position) => {
        const next = clampButtonPosition(position || getDefaultButtonPosition());
        localStorage.setItem(SUPPORT_BUTTON_POSITION_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampButtonPosition, getDefaultButtonPosition]);

  useEffect(() => {
    if (!token) return;
    supportApi.getUnreadCount()
      .then((res) => setUnread(res.data.count))
      .catch(() => setUnread(0));
  }, [token]);

  const fetchSupportOrders = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    setOrdersLoading(true);
    setOrdersLoadFailed(false);
    try {
      let ordersData: Order[] = [];
      let currentUserId = Number(localStorage.getItem('userId') || 0);
      try {
        const res = await orderApi.getMine();
        ordersData = res.data || [];
      } catch {
        ordersData = [];
      }

      if (ordersData.length === 0) {
        if (!currentUserId) {
          const profileRes = await userApi.getProfile();
          currentUserId = Number(profileRes.data.id || 0);
          if (currentUserId) {
            localStorage.setItem('userId', String(currentUserId));
            if (profileRes.data.username) localStorage.setItem('username', profileRes.data.username);
            if (profileRes.data.role) localStorage.setItem('role', profileRes.data.role);
          }
        }
        if (currentUserId) {
          const res = await orderApi.getByUser(currentUserId);
          ordersData = res.data || [];
        }
      }

      if (ordersData.length === 0 && currentUserId) {
        const res = await orderApi.getAll();
        ordersData = (res.data || []).filter((order) => Number(order.userId) === currentUserId);
      }

      const sortedOrders = [...ordersData].sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime || right.id - left.id;
      });
      setOrders(sortedOrders.slice(0, 30));
    } catch {
      setOrders([]);
      setOrdersLoadFailed(true);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    fetchSupportOrders();
  }, [open, token, fetchSupportOrders]);

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
      // Browser audio permission is best-effort.
    }
  };

  const encodeOrderMessage = (order: Order) => `${ORDER_PREFIX}${JSON.stringify({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    totalAmount: order.totalAmount,
    originalAmount: order.originalAmount,
    discountAmount: order.discountAmount,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
  })}`;

  const decodeOrderMessage = (text: string) => {
    if (!text.startsWith(ORDER_PREFIX)) return null;
    try {
      return JSON.parse(text.slice(ORDER_PREFIX.length));
    } catch {
      return null;
    }
  };

  const orderOptions = useMemo(() => orders.map((order) => ({
    value: order.id,
    label: `${order.createdAt ? new Date(order.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') + ' - ' : ''}${order.orderNo || `#${order.id}`} - ${formatMoney(order.totalAmount)}`,
  })), [orders, formatMoney, language]);

  useEffect(() => {
    if (!open || !token) return;

    const load = async () => {
      try {
        const sessionRes = await supportApi.getSession();
        setSession(sessionRes.data);
        const messagesRes = await supportApi.getMessages(sessionRes.data.id);
        setMessages(messagesRes.data);
        setUnread(0);
      } catch {
        message.error(t('pages.support.loadFailed'));
      }
    };

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
          setSession(payload.session);
          setMessages((items) => {
            const currentSessionId = sessionRef.current?.id;
            const incomingFromAgent = payload.message.senderRole === 'ADMIN';
            if (currentSessionId && payload.message.sessionId !== currentSessionId) {
              if (incomingFromAgent) playTone();
              return [payload.message];
            }
            if (items.some((item) => item.id === payload.message.id)) {
              return items;
            }
            if (incomingFromAgent) playTone();
            return [...items, payload.message];
          });
          if (payload.message.senderRole === 'ADMIN') {
            supportApi.markRead(payload.message.sessionId).catch(() => undefined);
          }
        }
        if (payload.type === 'SESSION_CLOSED' || payload.type === 'SESSION_UPDATED') {
          setSession(payload.session);
        }
      };
    };

    load();
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
  }, [open, token, t]);

  useEffect(() => {
    if (!open || !activeSessionId) return;
    const timer = window.setInterval(async () => {
      try {
        const sessionRes = await supportApi.getSession();
        const messagesRes = await supportApi.getMessages(sessionRes.data.id);
        setSession(sessionRes.data);
        setMessages(messagesRes.data);
        setUnread(0);
      } catch {
        // The socket path handles transient failures; polling is best-effort.
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [open, activeSessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const openPanel = () => {
    if (!localStorage.getItem('token')) {
      message.warning(t('messages.loginRequired'));
      navigate('/login');
      return;
    }
    setOpen(true);
    fetchSupportOrders();
  };

  const handleSupportButtonPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const position = buttonPosition || getDefaultButtonPosition();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: position.left,
      top: position.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSupportButtonPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    setButtonPosition(clampButtonPosition({
      left: drag.left + deltaX,
      top: drag.top + deltaY,
    }));
  };

  const finishSupportButtonPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setButtonPosition((position) => {
      const next = clampButtonPosition(position || getDefaultButtonPosition());
      localStorage.setItem(SUPPORT_BUTTON_POSITION_KEY, JSON.stringify(next));
      return next;
    });
    if (!moved) {
      openPanel();
    }
  };

  useEffect(() => {
    const handleOpenSupport = () => {
      if (!localStorage.getItem('token')) {
        message.warning(t('messages.loginRequired'));
        navigate('/login');
        return;
      }
      setOpen(true);
      fetchSupportOrders();
    };
    window.addEventListener('shop:open-support', handleOpenSupport);
    return () => window.removeEventListener('shop:open-support', handleOpenSupport);
  }, [fetchSupportOrders, navigate, t]);

  const send = async () => {
    const text = content.trim();
    if (!text) return;
    if (text.length > supportChatConfig.maxMessageChars) {
      message.warning(t('pages.support.messageTooLong', { count: supportChatConfig.maxMessageChars }));
      return;
    }
    const activeSession = sessionRef.current;
    if (activeSession && activeSession.status !== 'OPEN') {
      setSession(null);
      sessionRef.current = null;
      setMessages([]);
    }
    const activeSessionId = sessionRef.current?.status === 'OPEN' ? sessionRef.current.id : undefined;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'SEND',
        sessionId: activeSessionId,
        content: text,
      }));
      setContent('');
      return;
    }
    try {
      const res = await supportApi.sendMessage(text, activeSessionId);
      setSession(res.data.session);
      setMessages((items) => items.some((item) => item.id === res.data.message.id) ? items : [...items, res.data.message]);
      setContent('');
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.support.connectFailed'));
    }
  };

  const sendOrder = async (orderId: number) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    setSendingOrderId(orderId);
    try {
      const text = encodeOrderMessage(order);
      const activeSession = sessionRef.current;
      if (activeSession && activeSession.status !== 'OPEN') {
        setSession(null);
        sessionRef.current = null;
        setMessages([]);
      }
      const activeSessionId = sessionRef.current?.status === 'OPEN' ? sessionRef.current.id : undefined;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'SEND',
          sessionId: activeSessionId,
          content: text,
        }));
      } else {
        const res = await supportApi.sendMessage(text, activeSessionId);
        setSession(res.data.session);
        setMessages((items) => items.some((item) => item.id === res.data.message.id) ? items : [...items, res.data.message]);
      }
      message.success(t('pages.support.orderSent'));
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.support.connectFailed'));
    } finally {
      setSendingOrderId(null);
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

  const closeSession = async () => {
    if (!session) return;
    const closingSession = session;
    const closedSession = { ...closingSession, status: 'CLOSED' };
    setSession(closedSession);
    sessionRef.current = closedSession;
    try {
      const res = await supportApi.closeSession(closingSession.id);
      setSession(res.data);
    } catch {
      setSession(closingSession);
      sessionRef.current = closingSession;
      message.error(t('messages.operationFailed'));
    }
  };

  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

  return (
    <>
      <button
        type="button"
        onPointerDown={handleSupportButtonPointerDown}
        onPointerMove={handleSupportButtonPointerMove}
        onPointerUp={finishSupportButtonPointer}
        onPointerCancel={finishSupportButtonPointer}
        aria-label={t('pages.support.title')}
        style={{
          position: 'fixed',
          left: buttonPosition?.left ?? 'auto',
          top: buttonPosition?.top ?? 'auto',
          right: buttonPosition ? 'auto' : 24,
          bottom: buttonPosition ? 'auto' : 24,
          zIndex: 1200,
          width: SUPPORT_BUTTON_SIZE,
          height: SUPPORT_BUTTON_SIZE,
          border: 0,
          borderRadius: '50%',
          background: '#124734',
          color: '#fff',
          boxShadow: '0 8px 22px rgba(0,0,0,.22)',
          cursor: 'pointer',
          fontSize: 24,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <Badge count={unread} size="small">
          <CustomerServiceOutlined style={{ color: '#fff' }} />
        </Badge>
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 92,
            zIndex: 1200,
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 120px))',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #eee',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 12px 34px rgba(0,0,0,.2)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', background: '#ee4d2d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <CustomerServiceOutlined />
              <Text style={{ color: '#fff' }} strong>{t('pages.support.title')}</Text>
              <Badge status={connected ? 'success' : 'default'} text={<span style={{ color: '#fff' }}>{connected ? t('pages.support.online') : t('pages.support.offline')}</span>} />
            </Space>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)} style={{ color: '#fff' }} />
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#fafafa' }}>
            {messages.length === 0 ? (
              <Empty description={t('pages.support.welcome')} />
            ) : (
              <List
                dataSource={messages}
                renderItem={(item) => {
                  const mine = item.senderRole === 'USER';
                  const order = decodeOrderMessage(item.content);
                  return (
                    <List.Item style={{ justifyContent: mine ? 'flex-end' : 'flex-start', border: 0, padding: '6px 0' }}>
                      <div style={{ maxWidth: '78%', textAlign: mine ? 'right' : 'left' }}>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 3 }}>
                          {mine ? t('pages.support.you') : t('pages.support.agent')}
                          {item.createdAt ? ` - ${new Date(item.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}` : ''}
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
                          <div style={{ display: 'inline-block', padding: '8px 10px', borderRadius: 8, background: mine ? '#ee4d2d' : '#fff', color: mine ? '#fff' : '#333', border: mine ? 0 : '1px solid #eee', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
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

          {session?.status === 'CLOSED' && content.trim().length === 0 && (
            <div style={{ padding: '8px 12px', background: '#fff7e6', borderTop: '1px solid #ffe7ba' }}>
              <Text type="secondary">{t('pages.support.closed')}</Text>
            </div>
          )}

          <div style={{ padding: 12, borderTop: '1px solid #eee', background: '#fff' }}>
            <div style={{ border: '1px solid #d8eadf', background: '#f4fbf6', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text strong style={{ color: '#124734', display: 'block' }}>{t('pages.support.triageTitle')}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{supportIntent.helper}</Text>
                </div>
                <Tag color={connected ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {connected ? t('pages.support.connectedHint') : t('pages.support.reconnectingHint')}
                </Tag>
              </Space>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap' }}>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>{supportIntent.label}</Tag>
                <Text type={messageTooLong ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                  {messageQualityText}
                </Text>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  size="small"
                  onClick={() => setContent((current) => current.trim() ? `${current.trim()}\n${reply}` : reply)}
                >
                  {reply}
                </Button>
              ))}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text type="secondary">{t('pages.support.sendOrder')}</Text>
                <SoundOutlined style={{ color: '#ee4d2d' }} />
              </Space>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: '100%', marginTop: 6 }}
                placeholder={t('pages.support.pickOrder')}
                options={orderOptions}
                open={orderSelectOpen}
                onSelect={(value) => {
                  setOrderSelectOpen(false);
                  sendOrder(Number(value));
                }}
                onOpenChange={(visible) => {
                  setOrderSelectOpen(visible);
                  if (visible) {
                    fetchSupportOrders();
                  }
                }}
                popupClassName="support-order-select-popup"
                getPopupContainer={() => document.body}
                notFoundContent={ordersLoading ? <Spin size="small" /> : ordersLoadFailed ? t('messages.operationFailed') : t('pages.support.noOrderItems')}
                loading={ordersLoading || sendingOrderId !== null}
              />
            </div>
            <Input.TextArea
              value={content}
              maxLength={supportChatConfig.maxMessageChars}
              showCount
              onChange={(event) => setContent(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={t('pages.support.inputPlaceholder')}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Button style={{ flex: '1 1 150px' }} disabled={!session || session.status !== 'OPEN'} onClick={closeSession}>{t('pages.support.closeSession')}</Button>
              <Button style={{ flex: '1 1 110px' }} type="primary" icon={<SendOutlined />} disabled={messageTooLong || messageLength === 0} onClick={send}>{t('common.send')}</Button>
            </div>
          </div>
        </div>
      )}
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
                    description={
                      <Space direction="vertical" size={0}>
                        {item.selectedSpecs ? <Text type="secondary">{formatSelectedSpecs(item.selectedSpecs, t)}</Text> : null}
                        <Text type="secondary">{formatMoney(item.price)} x {item.quantity}</Text>
                      </Space>
                    }
                  />
                  <Text strong>{formatMoney(item.price * item.quantity)}</Text>
                </List.Item>
              )}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
};

export default CustomerSupportWidget;

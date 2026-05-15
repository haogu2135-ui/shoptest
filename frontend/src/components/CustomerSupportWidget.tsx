import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, message, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { CloseOutlined, CustomerServiceOutlined, SendOutlined, ShoppingOutlined, SoundOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiBaseUrl, orderApi, supportApi, supportWebSocketUrl, userApi } from '../api';
import type { Order, OrderItem, SupportMessage, SupportSession } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';
import './CustomerSupportWidget.css';

const { Text } = Typography;
const ORDER_PREFIX = '[ORDER]';
const SUPPORT_BUTTON_POSITION_KEY = 'shop-support-button-position';
const SUPPORT_BUTTON_SIZE = 56;
const SUPPORT_BUTTON_MARGIN = 12;
const SUPPORT_BUTTON_MOBILE_BOTTOM_MARGIN = 20;
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

const getSupportButtonBottomMargin = () =>
  window.innerWidth <= 720 ? SUPPORT_BUTTON_MOBILE_BOTTOM_MARGIN : 24;

const CustomerSupportWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<SupportSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SupportSession[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadFailed, setOrdersLoadFailed] = useState(false);
  const [orderSelectOpen, setOrderSelectOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
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
  const location = useLocation();
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

  const latestOrder = orders[0];
  const conversationUpdatedAt = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const assignedAgentText = session?.assignedAdminName || t('pages.support.unassignedAgent');

  const sortSupportSessions = useCallback((items: SupportSession[]) =>
    [...items].sort((left, right) => {
      const leftOpen = left.status === 'OPEN' ? 1 : 0;
      const rightOpen = right.status === 'OPEN' ? 1 : 0;
      if (leftOpen !== rightOpen) return rightOpen - leftOpen;
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightTime - leftTime || right.id - left.id;
    }), []);

  const upsertSessionHistory = useCallback((nextSession: SupportSession) => {
    setSessionHistory((items) => sortSupportSessions([nextSession, ...items.filter((item) => item.id !== nextSession.id)]));
  }, [sortSupportSessions]);

  const getDefaultButtonPosition = useCallback((): SupportButtonPosition => ({
    left: Math.max(SUPPORT_BUTTON_MARGIN, window.innerWidth - SUPPORT_BUTTON_SIZE - 24),
    top: Math.max(SUPPORT_BUTTON_MARGIN, window.innerHeight - SUPPORT_BUTTON_SIZE - getSupportButtonBottomMargin()),
  }), []);

  const clampButtonPosition = useCallback((position: SupportButtonPosition): SupportButtonPosition => ({
    left: Math.min(Math.max(SUPPORT_BUTTON_MARGIN, position.left), Math.max(SUPPORT_BUTTON_MARGIN, window.innerWidth - SUPPORT_BUTTON_SIZE - SUPPORT_BUTTON_MARGIN)),
    top: Math.min(Math.max(SUPPORT_BUTTON_MARGIN, position.top), Math.max(SUPPORT_BUTTON_MARGIN, window.innerHeight - SUPPORT_BUTTON_SIZE - getSupportButtonBottomMargin())),
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
            if (profileRes.data.roleCode || profileRes.data.role) {
              localStorage.setItem('role', profileRes.data.roleCode || profileRes.data.role);
            }
          }
        }
        if (currentUserId) {
          const res = await orderApi.getByUser(currentUserId);
          ordersData = res.data || [];
        }
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
        upsertSessionHistory(sessionRes.data);
        const messagesRes = await supportApi.getMessages(sessionRes.data.id);
        setMessages(messagesRes.data);
        supportApi.getSessions()
          .then((res) => setSessionHistory(sortSupportSessions(res.data || [])))
          .catch(() => undefined);
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
          upsertSessionHistory(payload.session);
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
          upsertSessionHistory(payload.session);
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
  }, [open, token, t, sortSupportSessions, upsertSessionHistory]);

  useEffect(() => {
    if (!open || !activeSessionId) return;
    const timer = window.setInterval(async () => {
      try {
        const [messagesRes, sessionsRes] = await Promise.all([
          supportApi.getMessages(activeSessionId),
          supportApi.getSessions(),
        ]);
        const sortedSessions = sortSupportSessions(sessionsRes.data || []);
        const selectedSession = sortedSessions.find((item) => item.id === activeSessionId);
        if (selectedSession) {
          setSession(selectedSession);
          sessionRef.current = selectedSession;
        }
        setSessionHistory(sortedSessions);
        setMessages(messagesRes.data);
        setUnread(0);
      } catch {
        // The socket path handles transient failures; polling is best-effort.
      }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [open, activeSessionId, sortSupportSessions]);

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
    if (sending) return;
    const text = content.trim();
    if (!text) return;
    if (text.length > supportChatConfig.maxMessageChars) {
      message.warning(t('pages.support.messageTooLong', { count: supportChatConfig.maxMessageChars }));
      return;
    }
    setSending(true);
    try {
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
      const res = await supportApi.sendMessage(text, activeSessionId);
      setSession(res.data.session);
      upsertSessionHistory(res.data.session);
      setMessages((items) => items.some((item) => item.id === res.data.message.id) ? items : [...items, res.data.message]);
      setContent('');
    } catch (err: any) {
      message.error(err.response?.data?.error || t('pages.support.connectFailed'));
    } finally {
      setSending(false);
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
        upsertSessionHistory(res.data.session);
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
      upsertSessionHistory(res.data);
    } catch {
      setSession(closingSession);
      sessionRef.current = closingSession;
      message.error(t('messages.operationFailed'));
    }
  };

  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const sessionOptions = sessionHistory.map((item) => ({
    value: item.id,
    label: `${item.status === 'OPEN' ? t('status.OPEN') : t('status.CLOSED')} - ${item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString(dateLocale) : `#${item.id}`}`,
  }));

  const switchSession = async (sessionId: number) => {
    const target = sessionHistory.find((item) => item.id === sessionId);
    if (target) {
      setSession(target);
      sessionRef.current = target;
    }
    try {
      const messagesRes = await supportApi.getMessages(sessionId);
      setMessages(messagesRes.data);
      supportApi.getSessions()
        .then((res) => setSessionHistory(sortSupportSessions(res.data || [])))
        .catch(() => undefined);
    } catch {
      message.error(t('pages.support.loadFailed'));
    }
  };
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 720;
  const isCatalogSurface = location.pathname === '/' || location.pathname.startsWith('/products');
  const hideFloatingButton = isMobileViewport && isCatalogSurface;

  return (
    <>
      {!hideFloatingButton ? (
        <button
          type="button"
          className="customer-support-widget__button"
          onPointerDown={handleSupportButtonPointerDown}
          onPointerMove={handleSupportButtonPointerMove}
          onPointerUp={finishSupportButtonPointer}
          onPointerCancel={finishSupportButtonPointer}
          aria-label={t('pages.support.title')}
          style={{
            position: 'fixed',
            left: isMobileViewport ? 'auto' : buttonPosition?.left ?? 'auto',
            top: isMobileViewport ? 'auto' : buttonPosition?.top ?? 'auto',
            right: isMobileViewport ? 18 : buttonPosition ? 'auto' : 24,
            bottom: isMobileViewport ? 'calc(20px + env(safe-area-inset-bottom))' : buttonPosition ? 'auto' : 24,
            width: isMobileViewport ? 46 : SUPPORT_BUTTON_SIZE,
            height: isMobileViewport ? 46 : SUPPORT_BUTTON_SIZE,
            fontSize: isMobileViewport ? 20 : 24,
          }}
        >
          <Badge count={unread} size="small">
            <CustomerServiceOutlined style={{ color: '#fff' }} />
          </Badge>
        </button>
      ) : null}

      {open && (
        <div className="customer-support-widget__panel">
          <div className="customer-support-widget__header">
            <Space>
              <CustomerServiceOutlined />
              <Text className="customer-support-widget__headerTitle" strong>{t('pages.support.title')}</Text>
              <Badge status={connected ? 'success' : 'default'} text={<span className="customer-support-widget__presenceText">{connected ? t('pages.support.online') : t('pages.support.offline')}</span>} />
            </Space>
            <Button className="customer-support-widget__headerClose" type="text" size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
          </div>
          {sessionHistory.length > 1 ? (
            <div className="customer-support-widget__sessionPicker">
              <Select
                size="small"
                style={{ width: '100%' }}
                value={session?.id}
                onChange={(value) => switchSession(Number(value))}
                options={sessionOptions}
                optionFilterProp="label"
              />
            </div>
          ) : null}

          <div className="customer-support-widget__brief">
            <div>
              <Text strong className="customer-support-widget__briefTitle">{t('pages.support.conversationBrief')}</Text>
              <Text type="secondary" className="customer-support-widget__briefMeta">
                {t('pages.support.assignedAgent')}: {assignedAgentText}
              </Text>
            </div>
            <div className="customer-support-widget__briefSide">
              <Tag color={hasSharedOrder ? 'green' : 'default'}>{hasSharedOrder ? t('pages.support.orderContextReady') : t('pages.support.orderContextMissing')}</Tag>
              {conversationUpdatedAt ? (
                <Text type="secondary" className="customer-support-widget__briefMeta">
                  {t('pages.support.lastUpdated')}: {new Date(conversationUpdatedAt).toLocaleString(dateLocale)}
                </Text>
              ) : null}
            </div>
          </div>

          <div ref={listRef} className="customer-support-widget__messages">
            {messages.length === 0 ? (
              <Empty description={t('pages.support.welcome')} />
            ) : (
              <List
                dataSource={messages}
                renderItem={(item) => {
                  const mine = item.senderRole === 'USER';
                  const order = decodeOrderMessage(item.content);
                  return (
                    <List.Item className={`customer-support-widget__messageRow ${mine ? 'customer-support-widget__messageRow--mine' : ''}`}>
                      <div className={`customer-support-widget__message ${mine ? 'customer-support-widget__message--mine' : ''}`}>
                        <div className="customer-support-widget__messageMeta">
                          {mine ? t('pages.support.you') : t('pages.support.agent')}
                          {item.createdAt ? ` - ${new Date(item.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </div>
                        {order ? (
                          <Card size="small" className={`customer-support-widget__orderCard ${mine ? 'customer-support-widget__orderCard--mine' : ''}`}>
                            <Space align="start">
                              <ShoppingOutlined className="customer-support-widget__orderIcon" />
                              <div>
                                <div className="customer-support-widget__orderTitle">{order.orderNo || `${t('pages.support.order')} #${order.id}`}</div>
                                <div className="customer-support-widget__orderAmount">{formatMoney(order.totalAmount)}</div>
                                <div className="customer-support-widget__orderTags">
                                  <Tag color="blue">{order.status}</Tag>
                                  {order.paymentMethod ? <Tag>{order.paymentMethod}</Tag> : null}
                                </div>
                                <Button className="customer-support-widget__linkButton" type="link" size="small" onClick={() => openOrderDetail(order.id)}>
                                  {t('pages.support.viewOrder')}
                                </Button>
                              </div>
                            </Space>
                          </Card>
                        ) : (
                          <div className={`customer-support-widget__bubble ${mine ? 'customer-support-widget__bubble--mine' : ''}`}>
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
            <div className="customer-support-widget__closedNotice">
              <Text type="secondary">{t('pages.support.closed')}</Text>
            </div>
          )}

          <div className="customer-support-widget__composer">
            <div className="customer-support-widget__triage">
              <Space className="customer-support-widget__triageHeader">
                <div>
                  <Text strong className="customer-support-widget__triageTitle">{t('pages.support.triageTitle')}</Text>
                  <Text type="secondary" className="customer-support-widget__triageHelper">{supportIntent.helper}</Text>
                </div>
                <Tag color={connected ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {connected ? t('pages.support.connectedHint') : t('pages.support.reconnectingHint')}
                </Tag>
              </Space>
              <div className="customer-support-widget__triageMeta">
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>{supportIntent.label}</Tag>
                <Text type={messageTooLong ? 'danger' : 'secondary'} className="customer-support-widget__messageQuality">
                  {messageQualityText}
                </Text>
              </div>
              {!hasSharedOrder && latestOrder ? (
                <Button
                  className="customer-support-widget__shareLatest"
                  size="small"
                  type="primary"
                  ghost
                  icon={<ShoppingOutlined />}
                  loading={sendingOrderId === latestOrder.id}
                  onClick={() => sendOrder(latestOrder.id)}
                >
                  {t('pages.support.shareLatestOrder')}
                </Button>
              ) : null}
            </div>
            <div className="customer-support-widget__quickReplies">
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
            <div className="customer-support-widget__orderPicker">
              <Space className="customer-support-widget__orderPickerHeader">
                <Text type="secondary">{t('pages.support.sendOrder')}</Text>
                <SoundOutlined className="customer-support-widget__soundIcon" />
              </Space>
              <Select
                showSearch
                optionFilterProp="label"
                className="customer-support-widget__orderSelect"
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
            <div className="customer-support-widget__actions">
              <Button className="customer-support-widget__secondaryAction" disabled={!session || session.status !== 'OPEN'} onClick={closeSession}>{t('pages.support.closeSession')}</Button>
              <Button className="customer-support-widget__primaryAction" type="primary" icon={<SendOutlined />} loading={sending} disabled={messageTooLong || messageLength === 0 || sending} onClick={send}>{t('common.send')}</Button>
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

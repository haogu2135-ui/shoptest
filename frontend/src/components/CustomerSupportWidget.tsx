import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';
import { Alert, Avatar, Button, Tag } from 'antd';
import { ShopTextArea } from './ShopInput';
import ShopBadge from './ShopBadge';
import ShopModal from './ShopModal';
import ShopSelect from './ShopSelect';
import { useNavigate } from 'react-router-dom';
import { orderApi, supportApi, supportWebSocketProtocols, supportWebSocketUrl } from '../api';
import type { OrderCustomer, OrderItemCustomer, SupportMessageCustomer, SupportSessionCustomer } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';
import { buildSupportOrderWorkflowActions, type SupportOrderWorkflowAction } from '../utils/supportWorkflow';
import { getApiErrorMessage } from '../utils/apiError';
import { decodeSupportOrderMessage, encodeSupportOrderMessage, type SupportOrderContext } from '../utils/supportOrderMessage';
import { formatSafeDate, formatSafeDateTime, formatSafeTime, getSafeTime } from '../utils/dateFormat';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { clearGuestSupportContext, loadGuestSupportContext, normalizeGuestSupportContext, saveGuestSupportContext, type GuestSupportContext } from '../utils/guestSupportContext';
import { useReconnectingWebSocket } from '../hooks/useReconnectingWebSocket';
import { useNativeBackHandler } from '../utils/nativeBack';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import './CustomerSupportWidget.css';
import '../styles/mobile-page-contrast.css';

const SUPPORT_BUTTON_POSITION_KEY = 'shop-support-button-position';
const SUPPORT_BUTTON_SIZE = 56;
const SUPPORT_BUTTON_MARGIN = 12;
const SUPPORT_BUTTON_MOBILE_BOTTOM_MARGIN = 20;
const SUPPORT_MESSAGE_WINDOW = 80;
const SUPPORT_SESSION_HISTORY_WINDOW = 12;
const SUPPORT_ORDER_OVERLAY_Z_INDEX = 10020;
const SUPPORT_MOBILE_VIEWPORT_MAX_WIDTH = 780;
const SUPPORT_SHORT_LANDSCAPE_MAX_WIDTH = 900;
const SUPPORT_SHORT_LANDSCAPE_MAX_HEIGHT = 430;
const SUPPORT_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');
const supportOrderImageFallback = productImageFallback;
const resolveSupportOrderImage = resolveProductImage;
const SUPPORT_ORDER_STATUS_KEYS = new Set([
  'PENDING_PAYMENT',
  'PENDING_SHIPMENT',
  'SHIPPED',
  'PENDING_RECEIPT',
  'COMPLETED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_APPROVED',
  'RETURN_SHIPPED',
  'RETURN_REFUNDING',
  'RETURNED',
  'REFUNDING',
  'REFUNDED',
]);

type SupportButtonPosition = {
  left: number;
  top: number;
};

type SupportOpenRequest = {
  id: number;
  guestOrderNo?: string;
  guestEmail?: string;
  clearGuestContext?: boolean;
};

type SupportOpenSourceDetail = SupportOpenRequest & {
  clearGuestSupportContext?: boolean;
};

type CustomerSupportWidgetProps = {
  initialOpenRequest?: SupportOpenRequest | null;
  onReady?: () => void;
};

type SupportOrderIdentity = {
  id?: unknown;
  orderNo?: unknown;
};

type LegacyAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const normalizeSupportOrderId = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const getSupportOrderToken = (order?: SupportOrderIdentity | null) => {
  const orderNo = order?.orderNo === undefined || order.orderNo === null ? '' : String(order.orderNo).trim();
  if (orderNo) return orderNo;
  const orderId = normalizeSupportOrderId(order?.id);
  return orderId ? `#${orderId}` : '';
};

const isSupportMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= SUPPORT_MOBILE_VIEWPORT_MAX_WIDTH
    || (window.innerWidth <= SUPPORT_SHORT_LANDSCAPE_MAX_WIDTH && window.innerHeight <= SUPPORT_SHORT_LANDSCAPE_MAX_HEIGHT);
};

const getSupportButtonBottomMargin = () =>
  isSupportMobileViewport() ? SUPPORT_BUTTON_MOBILE_BOTTOM_MARGIN : 24;

const isSupportOpenCustomEvent = (source?: SupportOpenRequest | Event | null): source is CustomEvent =>
  Boolean(typeof Event !== 'undefined' && source && typeof source === 'object' && 'detail' in source && source instanceof Event);

const getGuestContextFromOpenSource = (source?: SupportOpenRequest | Event | null): GuestSupportContext | null => {
  if (!source) return null;
  if (isSupportOpenCustomEvent(source)) {
    return normalizeGuestSupportContext(source.detail);
  }
  return normalizeGuestSupportContext(source);
};

const shouldClearGuestContext = (source?: SupportOpenRequest | Event | null) => {
  const detail = isSupportOpenCustomEvent(source) ? source.detail : source;
  if (!detail || typeof detail !== 'object') return false;
  const request = detail as SupportOpenSourceDetail;
  return request.clearGuestContext === true || request.clearGuestSupportContext === true;
};

const newestSupportMessageId = (items: SupportMessageCustomer[]) =>
  items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) || undefined;

const mergeSupportMessages = (current: SupportMessageCustomer[], incoming: SupportMessageCustomer[]) => {
  const byId = new Map<number, SupportMessageCustomer>();
  [...current, ...incoming].forEach((item) => {
    if (Number.isSafeInteger(item.id) && item.id > 0) {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values())
    .sort((left, right) => left.id - right.id)
    .slice(-SUPPORT_MESSAGE_WINDOW);
};

const getFocusableSupportElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(SUPPORT_FOCUSABLE_SELECTOR))
    .filter((element) => element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true');

const CustomerSupportWidget: React.FC<CustomerSupportWidgetProps> = ({ initialOpenRequest, onReady }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<SupportSessionCustomer | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionSwitching, setSessionSwitching] = useState(false);
  const [sessionSwitchError, setSessionSwitchError] = useState('');
  const [sessionHistory, setSessionHistory] = useState<SupportSessionCustomer[]>([]);
  const [messages, setMessages] = useState<SupportMessageCustomer[]>([]);
  const [orders, setOrders] = useState<OrderCustomer[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoadFailed, setOrdersLoadFailed] = useState(false);
  const [orderSelectOpen, setOrderSelectOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderCustomer | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItemCustomer[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState('');
  const [unread, setUnread] = useState(0);
  const [guestContext, setGuestContext] = useState<GuestSupportContext | null>(null);
  const [buttonPosition, setButtonPosition] = useState<SupportButtonPosition | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(isSupportMobileViewport);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SupportSessionCustomer | null>(null);
  const messagesRef = useRef<SupportMessageCustomer[]>([]);
  const activeGuestContextRef = useRef<GuestSupportContext | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const supportButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const orderSelectOpenRef = useRef(false);
  const orderDetailOpenRef = useRef(false);
  const handledOpenRequestRef = useRef<number | null>(null);
  const detailRequestSeqRef = useRef(0);
  const sessionSwitchRequestSeqRef = useRef(0);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const supportOrderItemName = (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => (
    (item.productName || '').trim() || t('pages.profile.productFallback', { id: item.productId })
  );
  const supportOrderLabel = useCallback((order?: SupportOrderIdentity | null) => {
    const token = getSupportOrderToken(order);
    if (!token) return t('pages.support.order');
    return token.startsWith('#') ? `${t('pages.support.order')} ${token}` : token;
  }, [t]);
  const supportOrderTitle = useCallback((order?: SupportOrderIdentity | null) => {
    const token = getSupportOrderToken(order);
    return token ? `${t('pages.support.order')} ${token}` : t('pages.support.order');
  }, [t]);
  const supportSessionLabel = useCallback((item: Pick<SupportSessionCustomer, 'id' | 'status' | 'lastMessageAt'>) => (
    `${item.status === 'OPEN' ? t('status.OPEN') : t('status.CLOSED')} - ${formatSafeDateTime(item.lastMessageAt, dateLocale, `#${item.id}`)}`
  ), [dateLocale, t]);
  const formatOrderStatusLabel = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = rawStatus.toUpperCase();
    if (!normalizedStatus) return t('common.unknown');
    if (SUPPORT_ORDER_STATUS_KEYS.has(normalizedStatus)) {
      return t(`status.${normalizedStatus}`);
    }
    return rawStatus;
  }, [t]);
  const token = getLocalStorageItem('token');
  const activeGuestContext = !token ? guestContext : null;
  activeGuestContextRef.current = activeGuestContext;
  const canSendSupportMessage = Boolean(token || activeGuestContext);
  const supportOnline = activeGuestContext ? Boolean(session) : connected;
  const supportPresenceText = !canSendSupportMessage
    ? t('pages.support.loginOrOrderStatus')
    : supportOnline
      ? t('pages.support.online')
      : t('pages.support.offline');
  const supportConnectionHint = !canSendSupportMessage
    ? t('pages.support.loginOrOrderStatus')
    : supportOnline
      ? t('pages.support.connectedHint')
      : t('pages.support.reconnectingHint');
  const activeSessionId = session?.id;
  const supportMessageCount = messages.length;
  const latestSupportMessageId = useMemo(() => newestSupportMessageId(messages), [messages]);
  const orderDetailOpen = Boolean(detailOrder || detailLoading);
  orderSelectOpenRef.current = orderSelectOpen;
  orderDetailOpenRef.current = orderDetailOpen;
  const quickReplies = useMemo(() => [
    t('pages.support.quickShipping'),
    t('pages.support.quickPayment'),
    t('pages.support.quickReturn'),
  ], [t]);
  const trimmedContent = content.trim();
  const messageLength = trimmedContent.length;
  const messageTooLong = messageLength > supportChatConfig.maxMessageChars;
  const sharedOrderContext = useMemo<SupportOrderContext | null>(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index];
      if (item.senderRole !== 'USER') continue;
      const order = decodeSupportOrderMessage(item.content);
      if (order) return order;
    }
    return null;
  }, [messages]);
  const hasSharedOrder = Boolean(sharedOrderContext);
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
  const workflowOrder = sharedOrderContext || latestOrder || null;
  const workflowActions = useMemo(
    () => workflowOrder
      ? buildSupportOrderWorkflowActions(workflowOrder, language, formatOrderStatusLabel(workflowOrder.status))
      : [],
    [formatOrderStatusLabel, language, workflowOrder]
  );
  const conversationUpdatedAt = session?.lastMessageAt || session?.updatedAt || session?.createdAt;
  const assignedAgentText = session?.assignedAdminName || t('pages.support.unassignedAgent');
  const conversationUnavailable = Boolean(sessionLoading || sessionSwitching || sessionSwitchError);

  const sortSupportSessions = useCallback((items: SupportSessionCustomer[]) =>
    [...items].sort((left, right) => {
      const leftOpen = left.status === 'OPEN' ? 1 : 0;
      const rightOpen = right.status === 'OPEN' ? 1 : 0;
      if (leftOpen !== rightOpen) return rightOpen - leftOpen;
      const leftTime = getSafeTime(left.updatedAt);
      const rightTime = getSafeTime(right.updatedAt);
      return rightTime - leftTime || right.id - left.id;
    }), []);

  const upsertSessionHistory = useCallback((nextSession: SupportSessionCustomer) => {
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
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    try {
      const saved = JSON.parse(getLocalStorageItem(SUPPORT_BUTTON_POSITION_KEY) || 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
        setButtonPosition(clampButtonPosition(saved));
        return;
      }
    } catch (error) {
      reportNonBlockingError('CustomerSupportWidget.restoreButtonPosition', error);
    }
    setButtonPosition(getDefaultButtonPosition());
  }, [clampButtonPosition, getDefaultButtonPosition]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(isSupportMobileViewport());
      setButtonPosition((position) => {
        const next = clampButtonPosition(position || getDefaultButtonPosition());
        setLocalStorageItem(SUPPORT_BUTTON_POSITION_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampButtonPosition, getDefaultButtonPosition]);

  useEffect(() => {
    if (!open || !isMobileViewport) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isMobileViewport, open]);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    supportApi.getUnreadCount()
      .then((res) => {
        if (!disposed) setUnread(res.data.count);
      })
      .catch((error) => {
        if (!disposed) setUnread(0);
        if (!disposed) reportNonBlockingError('CustomerSupportWidget.loadUnreadCount', error);
      });
    return () => {
      disposed = true;
    };
  }, [token]);

  useEffect(() => {
    if (token && guestContext) {
      setGuestContext(null);
    }
  }, [guestContext, token]);

  const fetchSupportOrders = useCallback(async () => {
    if (!getLocalStorageItem('token')) return;
    setOrdersLoading(true);
    setOrdersLoadFailed(false);
    try {
      const res = await orderApi.getMine();
      const ordersData = res.data || [];

      const sortedOrders = [...ordersData].sort((left, right) => {
        const leftTime = getSafeTime(left.createdAt);
        const rightTime = getSafeTime(right.createdAt);
        return rightTime - leftTime || right.id - left.id;
      });
      setOrders(sortedOrders.slice(0, 30));
    } catch (error) {
      reportNonBlockingError('CustomerSupportWidget.fetchSupportOrders', error);
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

  useEffect(() => {
    return () => {
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== 'closed') {
        void context.close()
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.closeAudioContext', error));
      }
    };
  }, []);

  const playTone = () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const legacyWindow = window as LegacyAudioWindow;
      const AudioCtor = window.AudioContext || legacyWindow.webkitAudioContext;
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
    } catch (error) {
      reportNonBlockingError('CustomerSupportWidget.playTone', error);
    }
  };

  const encodeOrderMessage = encodeSupportOrderMessage;
  const decodeOrderMessage = decodeSupportOrderMessage;

  const orderOptions = useMemo(() => orders.map((order) => ({
    value: String(order.id),
    label: `${formatSafeDate(order.createdAt, dateLocale, '') ? `${formatSafeDate(order.createdAt, dateLocale)} - ` : ''}${supportOrderLabel(order)} - ${formatMoney(order.totalAmount)}`,
  })), [orders, formatMoney, dateLocale, supportOrderLabel]);

  useEffect(() => {
    if (!open || !token) return;
    let disposed = false;

    const load = async () => {
      setSessionLoading(true);
      try {
        const sessionRes = await supportApi.createSession();
        if (disposed) return;
        setSession(sessionRes.data);
        upsertSessionHistory(sessionRes.data);
        const messagesRes = await supportApi.getMessages(sessionRes.data.id, { limit: SUPPORT_MESSAGE_WINDOW });
        if (disposed) return;
        setMessages(mergeSupportMessages([], messagesRes.data));
        supportApi.markRead(sessionRes.data.id)
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.markReadAfterSessionLoad', error));
        supportApi.getSessions({ limit: SUPPORT_SESSION_HISTORY_WINDOW })
          .then((res) => {
            if (!disposed) setSessionHistory(sortSupportSessions(res.data || []));
          })
          .catch((error) => {
            if (!disposed) reportNonBlockingError('CustomerSupportWidget.loadSessionHistory', error);
          });
        setUnread(0);
      } catch (error) {
        if (disposed) return;
        reportNonBlockingError('CustomerSupportWidget.loadSession', error);
        announceAccessibleMessage(t('pages.support.loadFailed'), 'error');
      } finally {
        if (!disposed) {
          setSessionLoading(false);
        }
      }
    };

    load();
    return () => {
      disposed = true;
    };
  }, [open, token, t, sortSupportSessions, upsertSessionHistory]);

  const socketRef = useReconnectingWebSocket({
    enabled: Boolean(open && token) && process.env.NODE_ENV !== 'test',
    connectionKey: token || '',
    createSocket: async () => {
      const ticketResponse = await supportApi.createWebSocketTicket();
      return new WebSocket(supportWebSocketUrl(), supportWebSocketProtocols(ticketResponse.data.ticket));
    },
    onConnectError: () => setConnected(false),
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
    onError: () => setConnected(false),
    onReconnectExhausted: (attempts) => {
      announceAccessibleMessage(t('pages.support.connectFailed'), 'warning');
      reportNonBlockingError('CustomerSupportWidget.websocketReconnectExhausted', { attempts });
    },
    onMessage: (event) => {
      const payload = parseSupportSocketPayload(event.data);
      if (payload.type === 'ERROR') {
        announceAccessibleMessage(payload.message || t('pages.support.messageRejected'), 'warning');
        return;
      }
      if (payload.type === 'MESSAGE') {
        upsertSessionHistory(payload.session);
        const currentSessionId = sessionRef.current?.id;
        const isActiveSessionMessage = !currentSessionId || payload.message.sessionId === currentSessionId;
        const incomingFromAgent = payload.message.senderRole === 'ADMIN';
        if (!isActiveSessionMessage) {
          if (incomingFromAgent) {
            playTone();
            setUnread((count) => Math.max(count + 1, Number(payload.session.unreadByUser || 0)));
          }
          return;
        }
        setSession(payload.session);
        sessionRef.current = payload.session;
        setMessages((items) => {
          if (items.some((item) => item.id === payload.message.id)) {
            return items;
          }
          if (incomingFromAgent) playTone();
          return mergeSupportMessages(items, [payload.message]);
        });
        if (incomingFromAgent) {
          supportApi.markRead(payload.message.sessionId)
            .catch((error) => reportNonBlockingError('CustomerSupportWidget.markReadAfterIncomingMessage', error));
        }
      }
      if (payload.type === 'SESSION_CLOSED' || payload.type === 'SESSION_UPDATED') {
        upsertSessionHistory(payload.session);
        if (!sessionRef.current || sessionRef.current.id === payload.session.id) {
          setSession(payload.session);
          sessionRef.current = payload.session;
        }
      }
    },
  });

  useEffect(() => {
    if (!open || !activeGuestContext) return;
    let disposed = false;

    const load = async () => {
      setSessionLoading(true);
      try {
        const [sessionRes, orderTrackRes] = await Promise.all([
          supportApi.createGuestSession(activeGuestContext.orderNo, activeGuestContext.email),
          orderApi.track(activeGuestContext.orderNo, activeGuestContext.email)
            .catch((error) => {
              reportNonBlockingError('CustomerSupportWidget.trackGuestOrderForContext', error);
              return null;
            }),
        ]);
        if (disposed) return;
        setSession(sessionRes.data);
        sessionRef.current = sessionRes.data;
        setSessionHistory([sessionRes.data]);
        if (orderTrackRes?.data?.order) {
          setOrders([orderTrackRes.data.order]);
        }
        const messagesRes = await supportApi.getGuestMessages(sessionRes.data.id, activeGuestContext.orderNo, activeGuestContext.email, { limit: SUPPORT_MESSAGE_WINDOW });
        if (disposed) return;
        setMessages(mergeSupportMessages([], messagesRes.data));
        setUnread(0);
        supportApi.markGuestRead(sessionRes.data.id, activeGuestContext.orderNo, activeGuestContext.email)
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.markGuestReadAfterSessionLoad', error));
      } catch (err: unknown) {
        if (disposed) return;
        announceAccessibleMessage(getApiErrorMessage(err, t('pages.support.loadFailed'), language), 'error');
      } finally {
        if (!disposed) {
          setSessionLoading(false);
        }
      }
    };

    load();
    return () => {
      disposed = true;
    };
  }, [activeGuestContext, language, open, t]);

  useEffect(() => {
    if (!open || !activeSessionId) return;
    if (!activeGuestContext && connected) return;
    if (process.env.NODE_ENV === 'test') return;
    let disposed = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const pollSessionId = sessionRef.current?.id;
        if (!pollSessionId) return;
        const afterId = newestSupportMessageId(messagesRef.current);
        const guestContextForPoll = activeGuestContextRef.current;
        const [messagesRes, sessionsRes] = guestContextForPoll
          ? await Promise.all([
            supportApi.getGuestMessages(pollSessionId, guestContextForPoll.orderNo, guestContextForPoll.email, { afterId, limit: SUPPORT_MESSAGE_WINDOW }),
            Promise.resolve({ data: sessionRef.current ? [sessionRef.current] : [] }),
          ])
          : await Promise.all([
            supportApi.getMessages(pollSessionId, { afterId, limit: SUPPORT_MESSAGE_WINDOW }),
            supportApi.getSessions({ limit: SUPPORT_SESSION_HISTORY_WINDOW }),
          ]);
        if (
          guestContextForPoll
          && (
            activeGuestContextRef.current?.orderNo !== guestContextForPoll.orderNo
            || activeGuestContextRef.current?.email !== guestContextForPoll.email
          )
        ) return;
        if (disposed || sessionRef.current?.id !== pollSessionId) return;
        const sortedSessions = sortSupportSessions(sessionsRes.data || []);
        const selectedSession = sortedSessions.find((item) => item.id === pollSessionId);
        if (selectedSession) {
          setSession(selectedSession);
          sessionRef.current = selectedSession;
        }
        setSessionHistory(sortedSessions);
        setMessages((items) => mergeSupportMessages(items, messagesRes.data));
        setUnread(0);
        if (guestContextForPoll) {
          supportApi.markGuestRead(pollSessionId, guestContextForPoll.orderNo, guestContextForPoll.email)
            .catch((error) => reportNonBlockingError('CustomerSupportWidget.markGuestReadAfterPoll', error));
        } else {
          supportApi.markRead(pollSessionId)
            .catch((error) => reportNonBlockingError('CustomerSupportWidget.markReadAfterPoll', error));
        }
      } catch (error) {
        reportNonBlockingError('CustomerSupportWidget.pollMessages', error);
      } finally {
        polling = false;
      }
    }, 10000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeGuestContext, connected, open, activeSessionId, sortSupportSessions]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeSessionId, latestSupportMessageId, open, supportMessageCount]);

  const openPanel = useCallback((source?: SupportOpenRequest | Event | null) => {
    const nextGuestContext = getGuestContextFromOpenSource(source);
    const clearGuestContext = shouldClearGuestContext(source);
    const existingGuestContext = !clearGuestContext && !getLocalStorageItem('token') ? (guestContext || loadGuestSupportContext()) : null;
    if (nextGuestContext) {
      saveGuestSupportContext(nextGuestContext);
      setGuestContext(nextGuestContext);
      setSession(null);
      sessionRef.current = null;
      setSessionHistory([]);
      setMessages([]);
      setOrders([]);
    } else if (clearGuestContext) {
      clearGuestSupportContext();
      setGuestContext(null);
      setSession(null);
      sessionRef.current = null;
      setSessionHistory([]);
      setMessages([]);
      setOrders([]);
    } else if (!getLocalStorageItem('token') && existingGuestContext) {
      setGuestContext(existingGuestContext);
    } else if (getLocalStorageItem('token')) {
      setGuestContext(null);
    }
    setOpen(true);
  }, [guestContext]);

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
      setLocalStorageItem(SUPPORT_BUTTON_POSITION_KEY, JSON.stringify(next));
      return next;
    });
    if (!moved) {
      openPanel();
    }
  };

  const closeOrderDetail = useCallback(() => {
    detailRequestSeqRef.current += 1;
    setDetailLoading(false);
    setDetailOrder(null);
    setDetailItems([]);
  }, []);

  const closeSupportForNativeBack = useCallback(() => {
    if (orderSelectOpen) {
      setOrderSelectOpen(false);
      return true;
    }
    setOpen(false);
    return true;
  }, [orderSelectOpen]);

  useNativeBackHandler(open, closeSupportForNativeBack);
  useNativeBackHandler(Boolean(detailOrder || detailLoading), () => {
    closeOrderDetail();
    return true;
  });

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (orderSelectOpen) {
        setOrderSelectOpen(false);
        return;
      }
      if (detailOrder || detailLoading) {
        closeOrderDetail();
        return;
      }
      setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeOrderDetail, detailLoading, detailOrder, open, orderSelectOpen]);

  useEffect(() => {
    if (!open || !isMobileViewport) return;
    const panel = panelRef.current;
    if (!panel) return;
    const supportButtonNode = supportButtonRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFirstElement = () => {
      if (orderDetailOpenRef.current || orderSelectOpenRef.current) return;
      const currentPanel = panelRef.current;
      if (!currentPanel) return;
      const [firstElement] = getFocusableSupportElements(currentPanel);
      (firstElement || currentPanel).focus({ preventScroll: true });
    };
    const focusTimer = window.setTimeout(focusFirstElement, 0);
    const handleFocusIn = (event: FocusEvent) => {
      if (orderDetailOpenRef.current || orderSelectOpenRef.current) return;
      if (event.target instanceof Node && panel.contains(event.target)) return;
      focusFirstElement();
    };
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || orderDetailOpenRef.current || orderSelectOpenRef.current) return;
      const focusableElements = getFocusableSupportElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement) || !panel.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus({ preventScroll: true });
        return;
      }
      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('keydown', handleTabKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('keydown', handleTabKey);
      if (previousFocus && previousFocus !== document.body && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
        return;
      }
      supportButtonNode?.focus({ preventScroll: true });
    };
  }, [isMobileViewport, open]);

  useEffect(() => {
    if (!open) {
      setSessionLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const handleOpenSupport = (event: Event) => openPanel(event);
    window.addEventListener('shop:open-support', handleOpenSupport);
    onReady?.();
    return () => window.removeEventListener('shop:open-support', handleOpenSupport);
  }, [onReady, openPanel]);

  useEffect(() => {
    if (!initialOpenRequest || handledOpenRequestRef.current === initialOpenRequest.id) return;
    handledOpenRequestRef.current = initialOpenRequest.id;
    openPanel(initialOpenRequest);
  }, [initialOpenRequest, openPanel]);

  const send = async () => {
    if (sending) return;
    if (conversationUnavailable) return;
    const text = content.trim();
    if (!text) return;
    if (!canSendSupportMessage) {
      announceAccessibleMessage(t('pages.support.loginOrOrderRequired'), 'warning');
      return;
    }
    if (text.length > supportChatConfig.maxMessageChars) {
      announceAccessibleMessage(t('pages.support.messageTooLong', { count: supportChatConfig.maxMessageChars }), 'warning');
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
      if (activeGuestContext) {
        const res = await supportApi.sendGuestMessage(text, activeGuestContext.orderNo, activeGuestContext.email, activeSessionId);
        setSession(res.data.session);
        sessionRef.current = res.data.session;
        setSessionHistory([res.data.session]);
        setMessages((items) => mergeSupportMessages(items, [res.data.message]));
        setContent('');
        return;
      }
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
      setMessages((items) => mergeSupportMessages(items, [res.data.message]));
      setContent('');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.support.connectFailed'), language), 'error');
    } finally {
      setSending(false);
    }
  };

  const sendOrder = async (orderId: number) => {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return;
    if (conversationUnavailable) return;
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
      if (activeGuestContext) {
        const res = await supportApi.sendGuestMessage(text, activeGuestContext.orderNo, activeGuestContext.email, activeSessionId);
        setSession(res.data.session);
        sessionRef.current = res.data.session;
        setSessionHistory([res.data.session]);
        setMessages((items) => mergeSupportMessages(items, [res.data.message]));
      } else if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'SEND',
          sessionId: activeSessionId,
          content: text,
        }));
      } else {
        const res = await supportApi.sendMessage(text, activeSessionId);
        setSession(res.data.session);
        upsertSessionHistory(res.data.session);
        setMessages((items) => mergeSupportMessages(items, [res.data.message]));
      }
      announceAccessibleMessage(t('pages.support.orderSent'), 'success');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.support.connectFailed'), language), 'error');
    } finally {
      setSendingOrderId(null);
    }
  };

  const applyWorkflowAction = (action: SupportOrderWorkflowAction, order: SupportOrderContext) => {
    if (conversationUnavailable) return;
    const nextText = action.customerPrefill;
    setContent((current) => current.trim() ? `${current.trim()}\n${nextText}` : nextText);
    if (!sharedOrderContext || sharedOrderContext.id !== order.id) {
      void sendOrder(order.id);
    }
  };

  const openOrderDetail = async (orderId: unknown) => {
    const normalizedOrderId = normalizeSupportOrderId(orderId);
    if (!normalizedOrderId) return;
    const requestId = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestId;
    setDetailLoading(true);
    try {
      const guestEmail = activeGuestContext?.email;
      const guestOrderNo = activeGuestContext?.orderNo;
      const [orderRes, itemsRes] = await Promise.all([
        orderApi.getById(normalizedOrderId, guestEmail, guestOrderNo),
        orderApi.getItems(normalizedOrderId, guestEmail, guestOrderNo),
      ]);
      if (detailRequestSeqRef.current !== requestId) return;
      setDetailOrder(orderRes.data);
      setDetailItems(itemsRes.data);
    } catch (error) {
      if (detailRequestSeqRef.current === requestId) {
        reportNonBlockingError('CustomerSupportWidget.openOrderDetail', error);
        announceAccessibleMessage(t('pages.support.orderLoadFailed'), 'error');
      }
    } finally {
      if (detailRequestSeqRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  const closeSession = async () => {
    if (!session || activeGuestContext) return;
    const closingSession = session;
    const closedSession = { ...closingSession, status: 'CLOSED' };
    setSession(closedSession);
    sessionRef.current = closedSession;
    try {
      const res = await supportApi.closeSession(closingSession.id);
      setSession(res.data);
      upsertSessionHistory(res.data);
    } catch (error) {
      reportNonBlockingError('CustomerSupportWidget.closeSession', error);
      setSession(closingSession);
      sessionRef.current = closingSession;
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    }
  };

  const sessionOptions = sessionHistory.map((item) => ({
    value: String(item.id),
    label: supportSessionLabel(item),
  }));
  const supportPanelCloseLabel = `${t('common.close')}: ${t('pages.support.title')}`;
  const supportSessionSelectLabel = `${t('pages.support.conversationBrief')}: ${assignedAgentText}`;
  const supportOrderSelectLabel = `${t('pages.support.sendOrder')}: ${t('pages.support.title')}`;
  const supportMessageInputLabel = canSendSupportMessage ? t('pages.support.inputPlaceholder') : t('pages.support.loginOrOrderRequired');
  const supportCloseSessionLabel = `${t('pages.support.closeSession')}: ${session ? supportSessionLabel(session) : t('pages.support.title')}`;
  const supportSendLabel = `${canSendSupportMessage ? t('common.send') : t('pages.auth.login')}: ${supportIntent.label}`;
  const supportQuickReplyLabel = (reply: string) => `${reply}: ${t('pages.support.triageTitle')}`;
  const supportWorkflowActionLabel = (action: SupportOrderWorkflowAction, order: SupportOrderContext) => `${action.label}: ${supportOrderLabel(order)}`;
  const supportViewOrderLabel = (order: Pick<SupportOrderContext, 'id' | 'orderNo'>) => `${t('pages.support.viewOrder')}: ${supportOrderLabel(order)}`;
  const supportShareOrderLabel = (order: Pick<SupportOrderContext, 'id' | 'orderNo'>) => `${t('pages.support.shareLatestOrder')}: ${supportOrderLabel(order)}`;

  const switchSession = async (sessionId: number) => {
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return;
    const requestId = sessionSwitchRequestSeqRef.current + 1;
    sessionSwitchRequestSeqRef.current = requestId;
    const target = sessionHistory.find((item) => item.id === sessionId);
    if (target) {
      setSession(target);
      sessionRef.current = target;
    }
    setSessionSwitching(true);
    setSessionSwitchError('');
    setMessages([]);
    try {
      const messagesRes = activeGuestContext
        ? await supportApi.getGuestMessages(sessionId, activeGuestContext.orderNo, activeGuestContext.email, { limit: SUPPORT_MESSAGE_WINDOW })
        : await supportApi.getMessages(sessionId, { limit: SUPPORT_MESSAGE_WINDOW });
      if (sessionSwitchRequestSeqRef.current !== requestId || sessionRef.current?.id !== sessionId) return;
      setMessages(mergeSupportMessages([], messagesRes.data));
      if (!activeGuestContext) {
        supportApi.getSessions({ limit: SUPPORT_SESSION_HISTORY_WINDOW })
          .then((res) => {
            if (sessionSwitchRequestSeqRef.current === requestId) {
              setSessionHistory(sortSupportSessions(res.data || []));
            }
          })
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.loadSessionHistoryAfterSwitch', error));
        supportApi.markRead(sessionId)
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.markReadAfterSwitch', error));
      } else {
        supportApi.markGuestRead(sessionId, activeGuestContext.orderNo, activeGuestContext.email)
          .catch((error) => reportNonBlockingError('CustomerSupportWidget.markGuestReadAfterSwitch', error));
      }
    } catch (error) {
      reportNonBlockingError('CustomerSupportWidget.switchSession', error);
      if (sessionSwitchRequestSeqRef.current === requestId && sessionRef.current?.id === sessionId) {
        setSessionSwitchError(t('pages.support.loadFailed'));
      }
      announceAccessibleMessage(t('pages.support.loadFailed'), 'error');
    } finally {
      if (sessionSwitchRequestSeqRef.current === requestId && sessionRef.current?.id === sessionId) {
        setSessionSwitching(false);
      }
    }
  };
  return (
    <>
      <button
        ref={supportButtonRef}
        type="button"
        className={`customer-support-widget__button customer-support-widget__button--${language}${open ? ' customer-support-widget__button--open' : ''}`}
        onPointerDown={handleSupportButtonPointerDown}
        onPointerMove={handleSupportButtonPointerMove}
        onPointerUp={finishSupportButtonPointer}
        onPointerCancel={finishSupportButtonPointer}
        aria-label={t('pages.support.title')}
        aria-expanded={open}
        style={{
          position: 'fixed',
          left: isMobileViewport ? 'auto' : buttonPosition?.left ?? 'auto',
          top: isMobileViewport ? 'auto' : buttonPosition?.top ?? 'auto',
          right: isMobileViewport ? 16 : buttonPosition ? 'auto' : 24,
          bottom: isMobileViewport ? 'calc(92px + env(safe-area-inset-bottom))' : buttonPosition ? 'auto' : 24,
          width: isMobileViewport ? 52 : SUPPORT_BUTTON_SIZE,
          height: isMobileViewport ? 52 : SUPPORT_BUTTON_SIZE,
          fontSize: isMobileViewport ? 22 : 24,
        }}
      >
        <ShopBadge count={unread} size="small">
          <ShopIcon path={SI.support} style={{ color: '#fff' }} />
        </ShopBadge>
      </button>

      {open ? (
        <div
          className="customer-support-widget__backdrop"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open && (
        <div
          ref={panelRef}
          className={`customer-support-widget__panel customer-support-widget__panel--${language}`}
          role="dialog"
          aria-modal={isMobileViewport ? true : undefined}
          aria-label={t('pages.support.title')}
          tabIndex={-1}
        >
          <div className="customer-support-widget__header">
            <div className="customer-support-widget__stack">
              <span className="customer-support-widget__headerIcon" aria-hidden="true">
                <ShopIcon path={SI.support} />
              </span>
              <span className="customer-support-widget__headerCopy">
                <span className="customer-support-widget__headerTitle customer-support-widget__text customer-support-widget__text--strong">{t('pages.support.title')}</span>
                <span className="customer-support-widget__headerSubtitle customer-support-widget__text">
                  {assignedAgentText}
                </span>
              </span>
              <span className={`customer-support-widget__presence customer-support-widget__presence--${supportOnline ? 'online' : 'offline'}`} role="status">
                <span className="customer-support-widget__presenceDot" aria-hidden="true" />
                <span className="customer-support-widget__presenceText">{supportPresenceText}</span>
              </span>
            </div>
            <Button className="customer-support-widget__headerClose" type="text" size="small" icon={<ShopIcon path={SI.close} />} aria-label={supportPanelCloseLabel} title={supportPanelCloseLabel} onClick={() => setOpen(false)} />
          </div>
          <div className="customer-support-widget__mobileStatus" aria-label={t('pages.support.conversationBrief')}>
            <span className={supportOnline ? 'is-online' : ''}>{supportPresenceText}</span>
            <span>{hasSharedOrder ? t('pages.support.orderContextReady') : t('pages.support.orderContextMissing')}</span>
            {unread > 0 ? <span>{unread}</span> : null}
          </div>
          {!activeGuestContext && sessionHistory.length > 1 ? (
            <div className="customer-support-widget__sessionPicker">
              <ShopSelect
                size="small"
                className="customer-support-widget__sessionSelect"
                value={session?.id != null ? String(session.id) : undefined}
                ariaLabel={supportSessionSelectLabel}
                title={supportSessionSelectLabel}
                disabled={sessionSwitching}
                onChange={(value) => {
                  if (value) void switchSession(Number(value));
                }}
                options={sessionOptions}
                popupClassName="shop-mobile-popup-layer"
                popupZIndex={SUPPORT_ORDER_OVERLAY_Z_INDEX + 1}
              />
            </div>
          ) : null}

          <div className="customer-support-widget__brief">
            <div>
              <span className="customer-support-widget__briefTitle customer-support-widget__text customer-support-widget__text--strong">{t('pages.support.conversationBrief')}</span>
              <span className="customer-support-widget__briefMeta customer-support-widget__text customer-support-widget__text--secondary">
                {t('pages.support.assignedAgent')}: {assignedAgentText}
              </span>
            </div>
            <div className="customer-support-widget__briefSide">
              <Tag color={hasSharedOrder ? 'green' : 'default'}>{hasSharedOrder ? t('pages.support.orderContextReady') : t('pages.support.orderContextMissing')}</Tag>
              {conversationUpdatedAt ? (
                <span className="customer-support-widget__briefMeta customer-support-widget__text customer-support-widget__text--secondary">
                  {t('pages.support.lastUpdated')}: {formatSafeDateTime(conversationUpdatedAt, dateLocale, '-')}
                </span>
              ) : null}
            </div>
          </div>

          {sessionLoading || sessionSwitching ? (
            <div
              className="customer-support-widget__loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label={t('common.loading')}
            >
              <span className="customer-support-widget__spinner customer-support-widget__spinner--sm" aria-hidden="true" />
              <span className="customer-support-widget__text">{t('common.loading')}</span>
            </div>
          ) : null}

          <div ref={listRef} className="customer-support-widget__messages">
            {sessionSwitching ? (
              <div
                className="customer-support-widget__loading customer-support-widget__loading--messages"
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label={t('common.loading')}
              >
                <span className="customer-support-widget__spinner customer-support-widget__spinner--sm" aria-hidden="true" />
                <span className="customer-support-widget__text">{t('common.loading')}</span>
              </div>
            ) : sessionSwitchError ? (
              <Alert
                className="customer-support-widget__sessionError"
                data-support-session-recovery="true"
                type="warning"
                showIcon
                message={sessionSwitchError}
                action={(
                  <div className="customer-support-widget__recoveryActions" data-support-recovery-actions="true">
                    <Button size="small" type="primary" onClick={() => session?.id && switchSession(session.id)} aria-label={t('common.retry')} title={t('common.retry')}>
                      {t('common.retry')}
                    </Button>
                    <Button size="small" icon={<ShopIcon path={SI.fileSearch} />} onClick={() => navigate('/track-order')} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                      {t('nav.trackOrder')}
                    </Button>
                    <Button size="small" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                      {t('pages.cart.browse')}
                    </Button>
                    <Button size="small" icon={<ShopIcon path={SI.gift} />} onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                      {t('nav.coupons')}
                    </Button>
                  </div>
                )}
              />
            ) : messages.length === 0 ? (
              <div className="customer-support-widget__emptyState" data-support-empty-actions="true">
                <div className="customer-support-widget__welcomeCard">
                  <div className="customer-support-widget__welcomeIcon">
                    <ShopIcon path={SI.support} />
                  </div>
                  <div className="customer-support-widget__emptyDescription">{t('pages.support.welcome')}</div>
                  <div className="customer-support-widget__welcomeQuickReplies">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        aria-label={supportQuickReplyLabel(reply)}
                        title={supportQuickReplyLabel(reply)}
                        onClick={() => setContent(reply)}
                        disabled={conversationUnavailable}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                  <div className="customer-support-widget__emptyMultipath" data-support-empty-multipath="true">
                    <Button size="small" icon={<ShopIcon path={SI.fileSearch} />} onClick={() => navigate('/track-order')} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                      {t('nav.trackOrder')}
                    </Button>
                    <Button size="small" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                      {t('pages.cart.browse')}
                    </Button>
                    <Button size="small" icon={<ShopIcon path={SI.gift} />} onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                      {t('nav.coupons')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="customer-support-widget__messageList" role="list">
                {messages.map((item) => {
                  const mine = item.senderRole === 'USER';
                  const order = decodeOrderMessage(item.content);
                  const orderId = normalizeSupportOrderId(order?.id);
                  return (
                    <li key={item.id} className={`customer-support-widget__messageRow ${mine ? 'customer-support-widget__messageRow--mine' : ''}`} role="listitem">
                      <div className={`customer-support-widget__messageShell ${mine ? 'customer-support-widget__messageShell--mine' : ''}`}>
                        <Avatar
                          size={30}
                          className={`customer-support-widget__avatar ${mine ? 'customer-support-widget__avatar--mine' : ''}`}
                          icon={mine ? <ShopIcon path={SI.user} /> : <ShopIcon path={SI.support} />}
                        />
                        <div className={`customer-support-widget__message ${mine ? 'customer-support-widget__message--mine' : ''}`}>
                          <div className="customer-support-widget__messageMeta">
                            {mine ? t('pages.support.you') : t('pages.support.agent')}
                            {formatSafeTime(item.createdAt, dateLocale, { hour: '2-digit', minute: '2-digit' }, '') ? ` - ${formatSafeTime(item.createdAt, dateLocale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </div>
                          {order ? (
                            <section className={`customer-support-widget__orderCard ${mine ? 'customer-support-widget__orderCard--mine' : ''}`}>
                              <div className="customer-support-widget__stack customer-support-widget__stack--start">
                                <ShopIcon path={SI.shopping} className="customer-support-widget__orderIcon" />
                                <div>
                                  <div className="customer-support-widget__orderTitle">{supportOrderLabel(order)}</div>
                                  <div className="customer-support-widget__orderAmount commerce-money">{formatMoney(order.totalAmount)}</div>
                                  <div className="customer-support-widget__orderTags">
                                    <Tag color="blue">{formatOrderStatusLabel(order.status)}</Tag>
                                    {order.paymentMethod ? <Tag>{order.paymentMethod}</Tag> : null}
                                  </div>
                                  <Button className="customer-support-widget__linkButton" type="link" size="small" aria-label={supportViewOrderLabel(order)} title={supportViewOrderLabel(order)} disabled={!orderId} onClick={() => openOrderDetail(orderId)}>
                                    {t('pages.support.viewOrder')}
                                  </Button>
                                </div>
                              </div>
                            </section>
                          ) : (
                            <div className={`customer-support-widget__bubble ${mine ? 'customer-support-widget__bubble--mine' : ''}`}>
                              {item.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {session?.status === 'CLOSED' && content.trim().length === 0 && (
            <div className="customer-support-widget__closedNotice">
              <span className="customer-support-widget__text customer-support-widget__text--secondary">{canSendSupportMessage ? t('pages.support.closed') : t('pages.support.loginOrOrderRequired')}</span>
            </div>
          )}

          <div className="customer-support-widget__composer">
            <div className="customer-support-widget__triage">
              <div className="customer-support-widget__triageHeader customer-support-widget__stack">
                <div>
                  <span className="customer-support-widget__triageTitle customer-support-widget__text customer-support-widget__text--strong">{t('pages.support.triageTitle')}</span>
                  <span className="customer-support-widget__triageHelper customer-support-widget__text customer-support-widget__text--secondary">{supportIntent.helper}</span>
                </div>
                <Tag color={supportOnline ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                  {supportConnectionHint}
                </Tag>
              </div>
              <div className="customer-support-widget__triageMeta">
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>{supportIntent.label}</Tag>
                <span className={`customer-support-widget__messageQuality customer-support-widget__text ${messageTooLong ? 'customer-support-widget__text--danger' : 'customer-support-widget__text--secondary'}`}>
                  {messageQualityText}
                </span>
              </div>
              {!hasSharedOrder && latestOrder ? (
                <Button
                  className="customer-support-widget__shareLatest"
                  size="small"
                  type="primary"
                  ghost
                  icon={<ShopIcon path={SI.shopping} />}
                  loading={sendingOrderId === latestOrder.id}
                  disabled={conversationUnavailable || sendingOrderId !== null}
                  aria-label={supportShareOrderLabel(latestOrder)}
                  title={supportShareOrderLabel(latestOrder)}
                  onClick={() => sendOrder(latestOrder.id)}
                >
                  {t('pages.support.shareLatestOrder')}
                </Button>
              ) : null}
            </div>
            {workflowOrder && workflowActions.length > 0 ? (
              <div className="customer-support-widget__workflowActions">
                <span className="customer-support-widget__workflowLabel customer-support-widget__text customer-support-widget__text--secondary">
                  {hasSharedOrder ? t('pages.support.recommendedActions') : t('pages.support.recommendedActionsWithOrder')}
                </span>
                <div className="customer-support-widget__workflowList">
                  {workflowActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="customer-support-widget__workflowChip"
                      disabled={conversationUnavailable || sendingOrderId !== null}
                      aria-label={supportWorkflowActionLabel(action, workflowOrder)}
                      title={supportWorkflowActionLabel(action, workflowOrder)}
                      onClick={() => applyWorkflowAction(action, workflowOrder)}
                    >
                      <strong>{action.label}</strong>
                      <span>{action.helper}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="customer-support-widget__quickReplies">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  size="small"
                  aria-label={supportQuickReplyLabel(reply)}
                  title={supportQuickReplyLabel(reply)}
                  onClick={() => setContent((current) => current.trim() ? `${current.trim()}\n${reply}` : reply)}
                  disabled={conversationUnavailable}
                >
                  {reply}
                </Button>
              ))}
            </div>
            <div className="customer-support-widget__orderPicker">
              <div className="customer-support-widget__orderPickerHeader customer-support-widget__stack">
                <span className="customer-support-widget__text customer-support-widget__text--secondary">{t('pages.support.sendOrder')}</span>
                <ShopIcon path={SI.sound} className="customer-support-widget__soundIcon" />
              </div>
              {ordersLoadFailed ? (
                <Alert
                  className="customer-support-widget__orderAlert"
                  data-support-orders-recovery="true"
                  type="warning"
                  showIcon
                  message={t('messages.operationFailed')}
                  action={(
                    <div className="customer-support-widget__recoveryActions" data-support-recovery-actions="true">
                      <Button size="small" type="primary" onClick={fetchSupportOrders} aria-label={t('common.retry')} title={t('common.retry')}>
                        {t('common.retry')}
                      </Button>
                      <Button size="small" icon={<ShopIcon path={SI.fileSearch} />} onClick={() => navigate('/track-order')} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                        {t('nav.trackOrder')}
                      </Button>
                      <Button size="small" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                        {t('pages.cart.browse')}
                      </Button>
                    </div>
                  )}
                />
              ) : null}
              <ShopSelect
                className="customer-support-widget__orderSelect"
                placeholder={t('pages.support.pickOrder')}
                ariaLabel={supportOrderSelectLabel}
                title={supportOrderSelectLabel}
                options={orderOptions}
                open={orderSelectOpen}
                onChange={(value) => {
                  if (!value) return;
                  setOrderSelectOpen(false);
                  sendOrder(Number(value));
                }}
                onOpenChange={(visible) => {
                  setOrderSelectOpen(visible);
                  if (visible) {
                    fetchSupportOrders();
                  }
                }}
                popupClassName="shop-mobile-popup-layer support-order-select-popup"
                popupZIndex={SUPPORT_ORDER_OVERLAY_Z_INDEX + 1}
                popupMaxHeight={isMobileViewport ? 220 : 280}
                loading={ordersLoading || sendingOrderId !== null}
                disabled={conversationUnavailable || sendingOrderId !== null}
                emptyContent={
                  ordersLoading ? (
                    <span
                      className="customer-support-widget__orderSelectLoading"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                      aria-label={t('common.loading')}
                    >
                      <span className="customer-support-widget__spinner customer-support-widget__spinner--sm" aria-hidden="true" />
                      <span className="customer-support-widget__text">{t('common.loading')}</span>
                    </span>
                  ) : ordersLoadFailed ? (
                    t('messages.operationFailed')
                  ) : (
                    <div className="customer-support-widget__orderSelectEmpty" data-support-order-select-empty="true">
                      <span className="customer-support-widget__text customer-support-widget__text--secondary">{t('pages.support.noOrderItems')}</span>
                      <span className="customer-support-widget__orderSelectEmptyHint customer-support-widget__text customer-support-widget__text--secondary">
                        {t('pages.support.noOrderItemsHint')}
                      </span>
                      <div className="customer-support-widget__recoveryActions" data-support-order-select-empty-actions="true">
                        <Button size="small" type="primary" icon={<ShopIcon path={SI.fileSearch} />} onClick={() => navigate('/track-order')} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                          {t('nav.trackOrder')}
                        </Button>
                        <Button size="small" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                          {t('pages.cart.browse')}
                        </Button>
                        <Button size="small" icon={<ShopIcon path={SI.gift} />} onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                          {t('nav.coupons')}
                        </Button>
                      </div>
                    </div>
                  )
                }
              />
            </div>
            <ShopTextArea
              value={content}
              disabled={conversationUnavailable}
              maxLength={supportChatConfig.maxMessageChars}
              showCount
              onChange={(event) => setContent(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={canSendSupportMessage ? t('pages.support.inputPlaceholder') : t('pages.support.loginOrOrderRequired')}
              className="customer-support-widget__messageInput"
              aria-label={supportMessageInputLabel}
              title={supportMessageInputLabel}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            <div className="customer-support-widget__actions">
              <Button className="customer-support-widget__secondaryAction" aria-label={supportCloseSessionLabel} title={supportCloseSessionLabel} disabled={conversationUnavailable || Boolean(activeGuestContext) || !session || session.status !== 'OPEN'} onClick={closeSession}>{t('pages.support.closeSession')}</Button>
              <Button className="customer-support-widget__primaryAction" type="primary" icon={<ShopIcon path={SI.send} />} aria-label={supportSendLabel} title={supportSendLabel} loading={sending} disabled={conversationUnavailable || messageTooLong || messageLength === 0 || sending} onClick={send}>{canSendSupportMessage ? t('common.send') : t('pages.auth.login')}</Button>
            </div>
          </div>
        </div>
      )}
      <ShopModal
        rootClassName="customer-support-widget__orderModalRoot"
        className="profile-mobile-safe-modal customer-support-widget__orderModal"
        width={isMobileViewport ? 'calc(100vw - 20px)' : 520}
        title={supportOrderTitle(detailOrder)}
        open={!!detailOrder || detailLoading}
        onClose={closeOrderDetail}
        footer={null}
        ariaLabel={supportOrderTitle(detailOrder) || t('pages.support.title')}
        closeLabel={t('common.close', { defaultValue: 'Close' })}
      >
        {detailLoading ? (
          <div
            className="customer-support-widget__orderLoading"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t('common.loading')}
          >
            <span className="customer-support-widget__spinner" aria-hidden="true" />
          </div>
        ) : detailOrder ? (
          <div className="customer-support-widget__orderDetail customer-support-widget__stack customer-support-widget__stack--vertical">
            <div className="customer-support-widget__stack customer-support-widget__stack--wrap">
              <Tag color="blue">{formatOrderStatusLabel(detailOrder.status)}</Tag>
              {detailOrder.paymentMethod ? <Tag>{detailOrder.paymentMethod}</Tag> : null}
              <span className="customer-support-widget__money customer-support-widget__text customer-support-widget__text--strong commerce-money">{formatMoney(detailOrder.totalAmount)}</span>
            </div>
            {detailOrder.shippingAddress ? <span className="customer-support-widget__text customer-support-widget__text--secondary">{detailOrder.shippingAddress}</span> : null}
            {detailItems.length === 0 ? (
              <div className="customer-support-widget__orderItemsEmpty" data-support-order-items-empty="true">
                <span className="customer-support-widget__text customer-support-widget__text--secondary">{t('pages.support.noOrderItems')}</span>
                <span className="customer-support-widget__orderSelectEmptyHint customer-support-widget__text customer-support-widget__text--secondary">
                  {t('pages.support.noOrderItemsHint')}
                </span>
                <div className="customer-support-widget__recoveryActions" data-support-order-items-empty-actions="true">
                  <Button size="small" type="primary" icon={<ShopIcon path={SI.fileSearch} />} onClick={() => navigate('/track-order')} aria-label={t('nav.trackOrder')} title={t('nav.trackOrder')}>
                    {t('nav.trackOrder')}
                  </Button>
                  <Button size="small" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')} aria-label={t('pages.cart.browse')} title={t('pages.cart.browse')}>
                    {t('pages.cart.browse')}
                  </Button>
                  <Button size="small" icon={<ShopIcon path={SI.gift} />} onClick={() => navigate('/coupons')} aria-label={t('nav.coupons')} title={t('nav.coupons')}>
                    {t('nav.coupons')}
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="customer-support-widget__orderItemList" role="list">
                {detailItems.map((item, index) => {
                  const productName = supportOrderItemName(item);
                  return (
                    <li key={`${item.productId}-${index}`} className="customer-support-widget__orderItem" role="listitem">
                      <div className="customer-support-widget__orderItemMeta">
                        <img
                          src={resolveSupportOrderImage(item.imageUrl)}
                          alt={productName}
                          className="customer-support-widget__orderItemImage"
                          onError={(event) => {
                            if (event.currentTarget.src !== supportOrderImageFallback) {
                              event.currentTarget.src = supportOrderImageFallback;
                            }
                          }}
                        />
                        <div className="customer-support-widget__orderItemCopy">
                          <div className="customer-support-widget__orderItemTitle">{productName}</div>
                          {item.selectedSpecs ? (
                            <span className="customer-support-widget__text customer-support-widget__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span>
                          ) : null}
                          <span className="customer-support-widget__itemUnit customer-support-widget__text customer-support-widget__text--secondary commerce-atomic commerce-price-quantity">
                            <span className="commerce-money">{formatMoney(item.price)}</span>
                            <span className="commerce-quantity">x {item.quantity}</span>
                          </span>
                        </div>
                      </div>
                      <span className="customer-support-widget__itemTotal customer-support-widget__text customer-support-widget__text--strong commerce-money">{formatMoney(item.price * item.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </ShopModal>
    </>
  );
};

export default CustomerSupportWidget;

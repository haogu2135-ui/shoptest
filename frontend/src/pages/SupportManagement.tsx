import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, message, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { AlertOutlined, CheckCircleOutlined, CustomerServiceOutlined, GiftOutlined, SendOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminApi, adminSupportApi, supportWebSocketProtocols, supportWebSocketUrl, userApi } from '../api';
import type { Order, OrderItem, SupportAdminSummary, SupportMessage, SupportSession } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { productImageFallback, resolveProductImage } from '../utils/productMedia';
import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';
import { buildSupportOrderWorkflowActions } from '../utils/supportWorkflow';
import { getApiErrorMessage } from '../utils/apiError';
import { decodeSupportOrderMessage, type SupportOrderContext } from '../utils/supportOrderMessage';
import { formatSafeDateTime, formatSafeTime, getSafeTime } from '../utils/dateFormat';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getReconnectDelayMs } from '../utils/reconnectBackoff';
import {
  COUPONS_BIRTHDAY_REISSUE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
  SUPPORT_ASSIGN_PERMISSION,
  SUPPORT_CLOSE_PERMISSION,
  SUPPORT_READ_STATE_PERMISSION,
  SUPPORT_REOPEN_PERMISSION,
  SUPPORT_REPLY_PERMISSION,
} from '../utils/roles';
import './SupportManagement.css';

const { Text, Title } = Typography;
const SUPPORT_MESSAGE_WINDOW = 80;
const SUPPORT_QUEUE_PAGE_SIZE = 20;
const supportOrderImageFallback = productImageFallback;
const resolveSupportOrderImage = resolveProductImage;
const SUPPORT_MANAGEMENT_STATUS_LABEL_KEYS = new Set([
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
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDING',
  'REFUNDED',
  'DELIVERED',
  'OPEN',
  'CLOSED',
]);

const newestSupportMessageId = (items: SupportMessage[]) =>
  items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) || undefined;

const mergeSupportMessages = (current: SupportMessage[], incoming: SupportMessage[]) => {
  const byId = new Map<number, SupportMessage>();
  [...current, ...incoming].forEach((item) => {
    if (Number.isSafeInteger(item.id) && item.id > 0) {
      byId.set(item.id, item);
    }
  });
  return Array.from(byId.values())
    .sort((left, right) => left.id - right.id)
    .slice(-SUPPORT_MESSAGE_WINDOW);
};

const readAdminSupportToken = () => {
  return getLocalStorageItem('token') || '';
};

const supportSessionMatchesQueue = (session: SupportSession, filter?: string, search?: string) => {
  const normalizedFilter = String(filter || 'ALL').toUpperCase();
  if (normalizedFilter === 'NEEDS_REPLY' && (session.status !== 'OPEN' || Number(session.unreadByAdmin || 0) <= 0)) {
    return false;
  }
  if (normalizedFilter !== 'ALL' && normalizedFilter !== 'NEEDS_REPLY' && session.status !== normalizedFilter) {
    return false;
  }
  const normalizedSearch = String(search || '').trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  const searchable = [
    session.id,
    session.userId,
    session.username,
    session.status,
    session.contextKey,
    session.assignedAdminName,
    session.lastMessage,
  ].join(' ').toLowerCase();
  return searchable.includes(normalizedSearch);
};

const SupportManagement: React.FC = () => {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [summary, setSummary] = useState<SupportAdminSummary | null>(null);
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState<string | undefined>('OPEN');
  const [queueSearch, setQueueSearch] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(SUPPORT_QUEUE_PAGE_SIZE);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [content, setContent] = useState('');
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reissueLoading, setReissueLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState(0);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionsRef = useRef<SupportSession[]>([]);
  const queueTotalRef = useRef(0);
  const messagesRef = useRef<SupportMessage[]>([]);
  const selectedSessionRef = useRef<SupportSession | null>(null);
  const queueFilterRef = useRef<string | undefined>(filter);
  const queueSearchRef = useRef(queueSearch);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const formatStatusLabel = useCallback((value?: string) => {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.toUpperCase();
    if (!normalized) return '-';
    if (SUPPORT_MANAGEMENT_STATUS_LABEL_KEYS.has(normalized)) {
      return t(`status.${normalized}`);
    }
    return rawValue;
  }, [t]);
  const formatOrderStatus = formatStatusLabel;
  const canReplySupport = hasAdminPermission(adminPermissions, currentRole, SUPPORT_REPLY_PERMISSION);
  const canAssignSupport = hasAdminPermission(adminPermissions, currentRole, SUPPORT_ASSIGN_PERMISSION);
  const canCloseSupport = hasAdminPermission(adminPermissions, currentRole, SUPPORT_CLOSE_PERMISSION);
  const canReopenSupport = hasAdminPermission(adminPermissions, currentRole, SUPPORT_REOPEN_PERMISSION);
  const canUpdateSupportReadState = hasAdminPermission(adminPermissions, currentRole, SUPPORT_READ_STATE_PERMISSION);
  const canReissueBirthdayCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_BIRTHDAY_REISSUE_PERMISSION);
  const canViewOrders = hasAdminPermission(adminPermissions, currentRole, 'orders');

  useEffect(() => {
    if (!readAdminSupportToken()) return;
    userApi.getProfile()
      .then((res) => setCurrentAdminId(Number(res.data.id || 0)))
      .catch(() => setCurrentAdminId(0));
  }, []);

  useEffect(() => {
    if (!readAdminSupportToken()) return;
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

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

  const decodeOrderMessage = useCallback(decodeSupportOrderMessage, []);

  const displayLastMessage = (content?: string) => {
    if (!content) return t('pages.support.noMessages');
    const order = decodeOrderMessage(content);
    return order ? `${t('pages.support.order')} ${order.orderNo || `#${order.id}`}` : content;
  };

  const latestOrderContext = useMemo<SupportOrderContext | null>(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const order = decodeOrderMessage(messages[index].content);
      if (order?.id && order?.status) return order;
    }
    return null;
  }, [decodeOrderMessage, messages]);

  const workflowActions = useMemo(
    () => latestOrderContext
      ? buildSupportOrderWorkflowActions(latestOrderContext, language, formatOrderStatus(latestOrderContext.status))
      : [],
    [formatOrderStatus, language, latestOrderContext]
  );

  const replyText = content.trim();
  const replyTooLong = replyText.length > supportChatConfig.maxMessageChars;
  const replyReady = Boolean(canReplySupport && selectedSession && selectedSession.status === 'OPEN' && replyText && !replyTooLong);
  const replyReadinessText = !canReplySupport
    ? t('adminLayout.noPermission')
    : !selectedSession
    ? t('pages.adminSupport.replySelectSession')
    : selectedSession.status !== 'OPEN'
      ? t('pages.adminSupport.replyClosedSession')
      : replyTooLong
        ? t('pages.support.messageTooLongInline', { count: supportChatConfig.maxMessageChars })
        : replyText
          ? t('pages.adminSupport.replyReady')
          : latestOrderContext
            ? t('pages.adminSupport.replyUseWorkflow')
            : t('pages.adminSupport.replyNeedsContext');

  const sortSupportSessions = (items: SupportSession[]) =>
    [...items].sort((left, right) => {
      const unreadDelta = Number(right.unreadByAdmin || 0) - Number(left.unreadByAdmin || 0);
      if (unreadDelta !== 0) return unreadDelta;
      const leftOpen = left.status === 'OPEN' ? 1 : 0;
      const rightOpen = right.status === 'OPEN' ? 1 : 0;
      if (leftOpen !== rightOpen) return rightOpen - leftOpen;
      const leftTime = getSafeTime(left.updatedAt);
      const rightTime = getSafeTime(right.updatedAt);
      return rightTime - leftTime || right.id - left.id;
    });

  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    queueTotalRef.current = queueTotal;
  }, [queueTotal]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    queueFilterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    queueSearchRef.current = queueSearch;
  }, [queueSearch]);

  const mergeSessionIntoCurrentQueue = useCallback((session: SupportSession, options?: { countNewMatch?: boolean }) => {
    const matchesQueue = supportSessionMatchesQueue(session, queueFilterRef.current, queueSearchRef.current);
    const currentItems = sessionsRef.current;
    const existed = currentItems.some((item) => item.id === session.id);
    const remaining = currentItems.filter((item) => item.id !== session.id);
    setSelectedSession((current) => current?.id === session.id ? session : current);
    const nextItems = matchesQueue ? sortSupportSessions([session, ...remaining]) : remaining;
    sessionsRef.current = nextItems;
    setSessions(nextItems);
    if (!matchesQueue && existed) {
      const nextTotal = Math.max(0, queueTotalRef.current - 1);
      queueTotalRef.current = nextTotal;
      setQueueTotal(nextTotal);
    } else if (matchesQueue && !existed && options?.countNewMatch) {
      const nextTotal = queueTotalRef.current + 1;
      queueTotalRef.current = nextTotal;
      setQueueTotal(nextTotal);
    }
  }, []);

  const loadSessions = useCallback(async (options?: { status?: string; page?: number; pageSize?: number; search?: string }) => {
    try {
      setQueueLoading(true);
      const effectiveStatus = options?.status === undefined ? filter : options.status;
      const effectivePage = options?.page || queuePage;
      const effectivePageSize = options?.pageSize || queuePageSize;
      const effectiveSearch = options?.search === undefined ? queueSearch : options.search;
      const apiStatus = effectiveStatus === 'NEEDS_REPLY' ? 'OPEN' : effectiveStatus;
      const [sessionsRes, summaryRes] = await Promise.all([
        adminSupportApi.getSessions({
          status: apiStatus,
          needsReply: effectiveStatus === 'NEEDS_REPLY',
          search: effectiveSearch,
          page: effectivePage,
          size: effectivePageSize,
        }),
        adminSupportApi.getSummary().catch(() => null),
      ]);
      const nextSessions = sortSupportSessions(sessionsRes.data.items);
      sessionsRef.current = nextSessions;
      queueTotalRef.current = sessionsRes.data.total;
      setSessions(nextSessions);
      setQueueTotal(sessionsRes.data.total);
      setQueuePage(sessionsRes.data.page);
      setQueuePageSize(sessionsRes.data.size);

      setSummary(summaryRes?.data || null);
      const currentSession = selectedSessionRef.current;
      if (currentSession) {
        const fresh = sessionsRes.data.items.find((item) => item.id === currentSession.id);
        if (fresh) setSelectedSession(fresh);
      }
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminSupport.loadFailed'), language));
    } finally {
      setQueueLoading(false);
    }
  }, [filter, language, queuePage, queuePageSize, queueSearch, t]);

  const loadMessages = async (session: SupportSession) => {
    setSelectedSession(session);
    try {
      const res = await adminSupportApi.getMessages(session.id, { limit: SUPPORT_MESSAGE_WINDOW });
      setMessages(mergeSupportMessages([], res.data));
      if (canUpdateSupportReadState) {
        await adminSupportApi.markRead(session.id).catch(() => undefined);
      }
      await loadSessions();
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminSupport.loadFailed'), language));
    }
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const token = readAdminSupportToken();
    if (!token) return;
    let shouldReconnect = true;
    const scheduleReconnect = () => {
      if (!shouldReconnect) return;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const delay = getReconnectDelayMs(reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };
    function connect() {
      if (!shouldReconnect) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(supportWebSocketUrl(token), supportWebSocketProtocols(token));
      } catch {
        setConnected(false);
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;
      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
      };
      socket.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };
      socket.onerror = () => setConnected(false);
      socket.onmessage = (event) => {
        const payload = parseSupportSocketPayload(event.data);
        if (payload.type === 'ERROR') {
          message.warning(payload.message || t('pages.support.messageRejected'));
          return;
        }
        if (payload.type === 'MESSAGE') {
          mergeSessionIntoCurrentQueue(payload.session, { countNewMatch: true });
          if (selectedSessionRef.current?.id === payload.message.sessionId) {
            setMessages((items) => {
              if (items.some((item) => item.id === payload.message.id)) {
                return items;
              }
              if (payload.message.senderRole === 'USER') {
                playTone();
              }
              return mergeSupportMessages(items, [payload.message]);
            });
            if (canUpdateSupportReadState) {
              adminSupportApi.markRead(payload.message.sessionId).catch(() => undefined);
            }
          } else if (payload.message.senderRole === 'USER') {
            playTone();
          }
        }
        if (payload.type === 'SESSION_CLOSED' || payload.type === 'SESSION_UPDATED') {
          mergeSessionIntoCurrentQueue(payload.session);
        }
      };
    }
    connect();
    return () => {
      shouldReconnect = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [canUpdateSupportReadState, mergeSessionIntoCurrentQueue, t]);

  useEffect(() => {
    let polling = false;

    const timer = window.setInterval(async () => {

      if (polling) return;
      polling = true;
      await loadSessions();
      const activeSession = selectedSessionRef.current;
      if (activeSession) {
        try {
          const afterId = newestSupportMessageId(messagesRef.current);
          const res = await adminSupportApi.getMessages(activeSession.id, { afterId, limit: SUPPORT_MESSAGE_WINDOW });
          setMessages((items) => mergeSupportMessages(items, res.data));
          if (canUpdateSupportReadState) {
            await adminSupportApi.markRead(activeSession.id).catch(() => undefined);
          }
        } catch {
          // Polling is a backup path for missed socket events.
        }
      }
      polling = false;
    }, 10000);
    return () => {
      polling = false;
      window.clearInterval(timer);
    };
  }, [canUpdateSupportReadState, loadSessions]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, selectedSession]);

  const send = async () => {
    const text = content.trim();
    if (sending) return;
    if (!canReplySupport) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (!text || !selectedSession) return;
    if (text.length > supportChatConfig.maxMessageChars) {
      message.warning(t('pages.support.messageTooLong', { count: supportChatConfig.maxMessageChars }));
      return;
    }
    if (selectedSession.status !== 'OPEN') {
      message.warning(t('pages.adminSupport.sessionClosed'));
      return;
    }
    setSending(true);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'SEND', sessionId: selectedSession.id, content: text }));
      setContent('');
      setSending(false);
      return;
    }
    try {
      const res = await adminSupportApi.sendMessage(selectedSession.id, text);
      mergeSessionIntoCurrentQueue(res.data.session);
      setMessages((items) => mergeSupportMessages(items, [res.data.message]));
      setContent('');
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.support.connectFailed'), language));
    } finally {
      setSending(false);
    }
  };

  const closeSession = async () => {
    if (!selectedSession || closing) return;
    if (!canCloseSupport) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setClosing(true);
    try {
      const res = await adminSupportApi.closeSession(selectedSession.id);
      mergeSessionIntoCurrentQueue(res.data);
      message.success(t('pages.adminSupport.sessionClosed'));
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setClosing(false);
    }
  };

  const reissueBirthdayCoupons = async () => {
    if (!selectedSession) return;
    if (!canReissueBirthdayCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setReissueLoading(true);
    try {
      const res = await adminSupportApi.reissueBirthdayCoupons(selectedSession.id);
      if (res.data.granted > 0) {
        message.success(t('pages.adminSupport.reissueBirthdayCouponSuccess', { count: res.data.granted }));
      } else {
        message.warning(t('pages.adminSupport.noBirthdayCouponReissued'));
      }
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.adminSupport.reissueBirthdayCouponFailed'), language));
    } finally {
      setReissueLoading(false);
    }
  };

  const openOrderDetail = async (orderId: number) => {
    if (!canViewOrders) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setDetailLoading(true);
    try {
      const [orderRes, itemsRes] = await Promise.all([
        adminApi.getOrder(orderId),
        adminApi.getOrderItems(orderId),
      ]);
      setDetailOrder(orderRes.data);
      setDetailItems(itemsRes.data);
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('pages.support.orderLoadFailed'), language));
    } finally {
      setDetailLoading(false);
    }
  };

  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const localOpenSessionCount = sessions.filter((item) => item.status === 'OPEN').length;
  const localClosedSessionCount = sessions.filter((item) => item.status === 'CLOSED').length;
  const localUnreadSessionCount = sessions.filter((item) => Number(item.unreadByAdmin || 0) > 0).length;
  const localUnreadMessageCount = sessions.reduce((sum, item) => sum + Number(item.unreadByAdmin || 0), 0);
  const localMySessionCount = sessions.filter((item) => currentAdminId && Number(item.assignedAdminId) === currentAdminId && item.status === 'OPEN').length;
  const openSessionCount = summary?.openSessions ?? localOpenSessionCount;
  const closedSessionCount = summary?.closedSessions ?? localClosedSessionCount;
  const unreadSessionCount = summary?.unreadSessions ?? localUnreadSessionCount;
  const unreadMessageCount = summary?.unreadMessages ?? localUnreadMessageCount;
  const mySessionCount = summary?.myOpenSessions ?? localMySessionCount;
  const unassignedOpenSessionCount = summary?.unassignedOpenSessions ?? sessions.filter((item) => item.status === 'OPEN' && !item.assignedAdminId).length;
  const staleOpenSessionCount = summary?.staleOpenSessions ?? 0;
  const staleMinutes = summary?.staleMinutes ?? 30;
  const responseScore = summary?.responseScore ?? null;
  const queueSessions = sessions;

  const upsertSession = (session: SupportSession) => {
    mergeSessionIntoCurrentQueue(session);
  };

  const resetCurrentQueue = () => {
    sessionsRef.current = [];
    queueTotalRef.current = 0;
    setSessions([]);
    setQueueTotal(0);
  };

  const assignToMe = async () => {
    if (!selectedSession) return;
    if (!canAssignSupport) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setAssigning(true);
    try {
      const res = await adminSupportApi.assignSession(selectedSession.id);
      upsertSession(res.data);
      message.success(t('pages.adminSupport.assignedToMe'));
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setAssigning(false);
    }
  };

  const reopenSession = async () => {
    if (!selectedSession) return;
    if (!canReopenSupport) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setReopening(true);
    try {
      const res = await adminSupportApi.reopenSession(selectedSession.id);
      upsertSession(res.data);
      setFilter('OPEN');
      setQueuePage(1);
      message.success(t('pages.adminSupport.sessionReopened'));
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setReopening(false);
    }
  };

  const applyQuickReply = (text: string) => {
    if (!canReplySupport) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setContent((current) => current.trim() ? `${current.trim()}\n${text}` : text);
  };

  const changeQueueFilter = (nextFilter?: string) => {
    queueFilterRef.current = nextFilter;
    resetCurrentQueue();
    setFilter(nextFilter);
    setQueuePage(1);
  };

  const changeQueuePage = (page: number, pageSize: number) => {
    setQueuePage(page);
    setQueuePageSize(pageSize);
  };

  const submitQueueSearch = (value: string) => {
    const nextSearch = value.trim();
    queueSearchRef.current = nextSearch;
    resetCurrentQueue();
    setQueueSearch(nextSearch);
    setQueuePage(1);
  };

  return (
    <div className={`support-management support-management--${language}`}>
      <div className="support-management__header">
        <Space>
          <CustomerServiceOutlined style={{ fontSize: 22, color: '#ee4d2d' }} />
          <Title level={4} style={{ margin: 0 }}>{t('pages.adminSupport.title')}</Title>
          <Badge status={connected ? 'success' : 'default'} text={connected ? t('pages.support.online') : t('pages.support.offline')} />
        </Space>
        <Space className="support-management__headerControls" wrap>
          <Input.Search
            allowClear
            defaultValue={queueSearch}
            placeholder={t('pages.adminSupport.queueSearchPlaceholder')}
            onSearch={submitQueueSearch}
            onChange={(event) => {
              if (!event.target.value) submitQueueSearch('');
            }}
            style={{ width: 240 }}
          />
          <Select
            value={filter || 'ALL'}
            style={{ width: 150 }}
            onChange={(value) => changeQueueFilter(value === 'ALL' ? undefined : value)}
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={[
              { value: 'OPEN', label: t('status.OPEN') },
              { value: 'CLOSED', label: t('status.CLOSED') },
              { value: 'NEEDS_REPLY', label: t('pages.adminSupport.needsReply') },
              { value: 'ALL', label: t('common.all') },
            ]}
          />
        </Space>
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
          <Tag color={mySessionCount > 0 ? 'blue' : 'default'}>{t('pages.adminSupport.mySessions', { count: mySessionCount })}</Tag>
          <Tag color={unassignedOpenSessionCount > 0 ? 'orange' : 'default'}>{t('pages.adminSupport.unassignedSessions', { count: unassignedOpenSessionCount })}</Tag>
          <Tag color={staleOpenSessionCount > 0 ? 'red' : 'default'}>{t('pages.adminSupport.staleSessions', { count: staleOpenSessionCount, minutes: staleMinutes })}</Tag>
          {responseScore !== null ? <Tag color={responseScore < 70 ? 'volcano' : 'green'}>{t('pages.adminSupport.responseScore', { score: responseScore })}</Tag> : null}
          <Tag color="default">{t('pages.adminSupport.closedSessions', { count: closedSessionCount })}</Tag>
        </div>
        <div className="support-management__insightActions">
          <Button size="small" icon={<AlertOutlined />} onClick={() => changeQueueFilter('NEEDS_REPLY')} disabled={unreadSessionCount === 0}>
            {t('pages.adminSupport.showNeedsReply')}
          </Button>
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => changeQueueFilter('OPEN')}>
            {t('pages.adminSupport.showOpen')}
          </Button>
          <Button size="small" onClick={() => changeQueueFilter('CLOSED')} disabled={closedSessionCount === 0}>
            {t('status.CLOSED')}
          </Button>
          <Button size="small" onClick={() => changeQueueFilter(undefined)}>
            {t('common.all')}
          </Button>
        </div>
      </div>

      <div className="support-management__layout">
        <div className="support-management__queuePane">
          {queueSessions.length === 0 ? (
            <Empty style={{ marginTop: 80 }} description={t('pages.adminSupport.noSessions')}>
              <Space wrap>
                {filter !== 'OPEN' ? (
                  <Button size="small" onClick={() => changeQueueFilter('OPEN')}>
                    {t('status.OPEN')}
                  </Button>
                ) : null}
                {filter !== 'CLOSED' ? (
                  <Button size="small" onClick={() => changeQueueFilter('CLOSED')} disabled={closedSessionCount === 0}>
                    {t('status.CLOSED')}
                  </Button>
                ) : null}
                {filter ? (
                  <Button size="small" onClick={() => changeQueueFilter(undefined)}>
                    {t('common.all')}
                  </Button>
                ) : null}
              </Space>
            </Empty>
          ) : (
            <List
              loading={queueLoading}
              dataSource={queueSessions}
              pagination={{
                current: queuePage,
                pageSize: queuePageSize,
                total: queueTotal,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '30', '50'],
                size: 'small',
                showTotal: (total) => t('pages.adminSupport.queueTotal', { count: total }),
                onChange: changeQueuePage,
                onShowSizeChange: changeQueuePage,
              }}
              renderItem={(item) => (
                <List.Item
                  onClick={() => loadMessages(item)}
                  className={`support-management__queueItem ${selectedSession?.id === item.id ? 'is-active' : ''} ${Number(item.unreadByAdmin || 0) > 0 ? 'support-management__queueItem--high' : ''}`}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.username || `${t('pages.adminSupport.user')} #${item.userId}`}</Text>
                        <Tag color={item.status === 'OPEN' ? 'green' : 'default'}>{formatStatusLabel(item.status)}</Tag>
                        {!!item.unreadByAdmin && <Badge count={item.unreadByAdmin} size="small" />}
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary" ellipsis>{displayLastMessage(item.lastMessage)}</Text>
                        <div className="support-management__queueMeta">
                          <span>{item.assignedAdminName ? `${t('pages.adminSupport.assignedTo')}: ${item.assignedAdminName}` : t('pages.adminSupport.unassigned')}</span>
                          {formatSafeDateTime(item.updatedAt, dateLocale, '') ? <span>{formatSafeDateTime(item.updatedAt, dateLocale)}</span> : null}
                        </div>
                        <div className={`support-management__queueReason ${Number(item.unreadByAdmin || 0) > 0 ? 'is-pending' : 'is-complete'}`}>
                          {Number(item.unreadByAdmin || 0) > 0 ? t('pages.adminSupport.replyCustomerWaiting') : t('pages.adminSupport.replyNoUnread')}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>

        <div className="support-management__conversationPane">
          {!selectedSession ? (
            <Empty style={{ marginTop: 180 }} description={t('pages.adminSupport.selectSession')} />
          ) : (
            <>
              <div className="support-management__conversationHeader">
                <Space>
                  <Text strong>{selectedSession.username || `${t('pages.adminSupport.user')} #${selectedSession.userId}`}</Text>
                  <Tag color={selectedSession.status === 'OPEN' ? 'green' : 'default'}>{formatStatusLabel(selectedSession.status)}</Tag>
                  <Tag color={selectedSession.assignedAdminId ? 'blue' : 'default'}>
                    {selectedSession.assignedAdminName || t('pages.adminSupport.unassigned')}
                  </Tag>
                </Space>
                <Space>
                  {selectedSession.status === 'OPEN' && canAssignSupport ? (
                    <Button loading={assigning} onClick={assignToMe}>
                      {t('pages.adminSupport.assignToMe')}
                    </Button>
                  ) : selectedSession.status !== 'OPEN' && canReopenSupport ? (
                    <Button loading={reopening} onClick={reopenSession}>
                      {t('pages.adminSupport.reopenSession')}
                    </Button>
                  ) : null}
                  {canReissueBirthdayCoupons ? (
                    <Button icon={<GiftOutlined />} loading={reissueLoading} onClick={reissueBirthdayCoupons}>
                      {t('pages.adminSupport.reissueBirthdayCoupon')}
                    </Button>
                  ) : null}
                  {canCloseSupport ? (
                    <Button loading={closing} disabled={selectedSession.status !== 'OPEN'} onClick={closeSession}>{t('pages.adminSupport.closeSession')}</Button>
                  ) : null}
                </Space>
              </div>
              <div ref={listRef} className="support-management__messagesPane">
                {messages.length === 0 ? (
                  <Empty description={t('pages.support.noMessages')} />
                ) : (
                  <List
                    dataSource={messages}
                    renderItem={(item) => {
                      const mine = item.senderRole === 'ADMIN';
                      const order = decodeOrderMessage(item.content);
                      return (
                        <List.Item className={`support-management__messageRow ${mine ? 'is-mine' : ''}`}>
                          <div className="support-management__messageWrap">
                            <div className="support-management__messageMeta">
                              {mine ? t('pages.support.agent') : (item.senderName || t('pages.adminSupport.user'))}
                              {formatSafeTime(item.createdAt, dateLocale, { hour: '2-digit', minute: '2-digit' }, '') ? ` · ${formatSafeTime(item.createdAt, dateLocale, { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </div>
                            {order ? (
                              <Card size="small" className={`support-management__orderCard ${mine ? 'is-mine' : ''}`}>
                                <Space align="start">
                                  <ShoppingOutlined className="support-management__orderIcon" />
                                  <div>
                                    <div className="support-management__orderTitle">{order.orderNo || `${t('pages.support.order')} #${order.id}`}</div>
                                    <div className="support-management__orderPrice commerce-money">{formatMoney(order.totalAmount)}</div>
                                    <div className="support-management__orderTags">
                                      <Tag color="blue">{formatOrderStatus(order.status)}</Tag>
                                      {order.paymentMethod ? <Tag>{order.paymentMethod}</Tag> : null}
                                    </div>
                                    {canViewOrders ? (
                                      <Button type="link" size="small" className="support-management__orderLink" onClick={() => openOrderDetail(order.id)}>
                                        {t('pages.support.viewOrder')}
                                      </Button>
                                    ) : null}
                                  </div>
                                </Space>
                              </Card>
                            ) : (
                              <div className={`support-management__bubble ${mine ? 'is-mine' : 'is-user'}`}>
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
              {latestOrderContext && canReplySupport ? (
                <div className="support-management__orderWorkflow">
                  <div className="support-management__orderWorkflowHeader">
                    <span>{t('pages.adminSupport.orderWorkflowTitle')}</span>
                    <strong>
                      {latestOrderContext.orderNo || `${t('pages.support.order')} #${latestOrderContext.id}`} · {formatOrderStatus(latestOrderContext.status)}
                    </strong>
                  </div>
                  <div className="support-management__orderWorkflowActions">
                    {workflowActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className="support-management__orderWorkflowCard"
                        disabled={!canReplySupport || selectedSession.status !== 'OPEN'}
                        onClick={() => applyQuickReply(action.adminReply)}
                      >
                        <strong>{action.label}</strong>
                        <span>{action.helper}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {canReplySupport ? (
                <div className="support-management__composer">
                  <div className="support-management__replyReadiness">
                    <div>
                      <span>{t('pages.adminSupport.replyReadiness')}</span>
                      <strong>{replyReadinessText}</strong>
                    </div>
                    <div className="support-management__replyReadinessChips">
                      <span className={`support-management__replyReadinessChip ${selectedSession.status === 'OPEN' ? 'is-ready' : 'is-pending'}`}>
                        {formatStatusLabel(selectedSession.status)}
                      </span>
                      <span className={`support-management__replyReadinessChip ${latestOrderContext ? 'is-ready' : 'is-pending'}`}>
                        {latestOrderContext ? t('pages.support.orderContextReady') : t('pages.support.orderContextMissing')}
                      </span>
                      <span className={`support-management__replyReadinessChip ${replyText && !replyTooLong ? 'is-ready' : 'is-pending'}`}>
                        {replyText ? t('pages.adminSupport.draftReady') : t('pages.adminSupport.draftMissing')}
                      </span>
                    </div>
                  </div>
                  <Input.TextArea
                    value={content}
                    disabled={selectedSession.status !== 'OPEN' || sending}
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
                  <div className="support-management__composerActions">
                    <span className={`support-management__sendReadiness ${replyReady ? 'is-ready' : 'is-pending'}`}>
                      {replyReady ? t('pages.adminSupport.replyReady') : replyReadinessText}
                    </span>
                    <Button type="primary" icon={<SendOutlined />} onClick={send} loading={sending} disabled={!replyReady}>{t('common.send')}</Button>
                  </div>
                </div>
              ) : null}
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
        className="profile-mobile-safe-modal support-management__orderModal"
      >
        {detailLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
        ) : detailOrder ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <Tag color="blue">{formatOrderStatus(detailOrder.status)}</Tag>
              {detailOrder.paymentMethod ? <Tag>{detailOrder.paymentMethod}</Tag> : null}
              <Text strong className="commerce-money" style={{ color: '#ee4d2d' }}>{formatMoney(detailOrder.totalAmount)}</Text>
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
                    description={(
                      <Text type="secondary" className="support-management__orderItemUnit commerce-atomic commerce-price-quantity">
                        <span className="commerce-money">{formatMoney(item.price)}</span>
                        <span className="commerce-quantity">x {item.quantity}</span>
                      </Text>
                    )}
                  />
                  <Text strong className="support-management__orderItemTotal commerce-money">{formatMoney(item.price * item.quantity)}</Text>
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


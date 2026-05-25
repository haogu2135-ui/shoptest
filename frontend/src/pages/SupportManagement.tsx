import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, message, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { AlertOutlined, CheckCircleOutlined, CustomerServiceOutlined, GiftOutlined, SendOutlined, ShoppingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminSupportApi, orderApi, supportWebSocketUrl, userApi } from '../api';
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
import './SupportManagement.css';

const { Text, Title } = Typography;
const supportOrderImageFallback = productImageFallback;
const resolveSupportOrderImage = resolveProductImage;

const readAdminSupportToken = () => {
  return getLocalStorageItem('token');
};

const SupportManagement: React.FC = () => {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [summary, setSummary] = useState<SupportAdminSummary | null>(null);
  const [selectedSession, setSelectedSession] = useState<SupportSession | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [filter, setFilter] = useState<string | undefined>('OPEN');
  const [content, setContent] = useState('');
  const [connected, setConnected] = useState(false);
  const [reissueLoading, setReissueLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionRef = useRef<SupportSession | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();

  useEffect(() => {
    if (!readAdminSupportToken()) return;
    userApi.getProfile()
      .then((res) => setCurrentAdminId(Number(res.data.id || 0)))
      .catch(() => setCurrentAdminId(0));
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
      ? buildSupportOrderWorkflowActions(latestOrderContext, language, t(`status.${latestOrderContext.status}`))
      : [],
    [language, latestOrderContext, t]
  );

  const replyText = content.trim();
  const replyTooLong = replyText.length > supportChatConfig.maxMessageChars;
  const replyReady = Boolean(selectedSession && selectedSession.status === 'OPEN' && replyText && !replyTooLong);
  const replyReadinessText = !selectedSession
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

  const loadSessions = useCallback(async (status = filter) => {
    try {
      const apiStatus = status === 'NEEDS_REPLY' ? 'OPEN' : status;
      const [sessionsRes, summaryRes] = await Promise.all([
        adminSupportApi.getSessions(apiStatus),
        adminSupportApi.getSummary().catch(() => null),
      ]);
      setSessions(sortSupportSessions(sessionsRes.data));

      setSummary(summaryRes?.data || null);
      const currentSession = selectedSessionRef.current;
      if (currentSession) {
        const fresh = sessionsRes.data.find((item) => item.id === currentSession.id);
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
    const token = readAdminSupportToken();
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
    let polling = false;

    const timer = window.setInterval(async () => {

      if (polling) return;
      polling = true;
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
      polling = false;
    }, 10000);
    return () => {
      polling = false;
      window.clearInterval(timer);
    };
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
      message.error(getApiErrorMessage(err, t('pages.support.connectFailed'), language));
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

  const reissueBirthdayCoupons = async () => {
    if (!selectedSession) return;
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
  const filteredQueueSessions = filter === 'NEEDS_REPLY'
    ? sessions.filter((item) => Number(item.unreadByAdmin || 0) > 0)
    : sessions;

  const upsertSession = (session: SupportSession) => {
    setSelectedSession((current) => current?.id === session.id ? session : current);
    setSessions((items) => sortSupportSessions([session, ...items.filter((item) => item.id !== session.id)]));
  };

  const assignToMe = async () => {
    if (!selectedSession) return;
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
    setReopening(true);
    try {
      const res = await adminSupportApi.reopenSession(selectedSession.id);
      upsertSession(res.data);
      setFilter('OPEN');
      message.success(t('pages.adminSupport.sessionReopened'));
    } catch (err: any) {
      message.error(getApiErrorMessage(err, t('messages.operationFailed'), language));
    } finally {
      setReopening(false);
    }
  };

  const applyQuickReply = (text: string) => {
    setContent((current) => current.trim() ? `${current.trim()}\n${text}` : text);
  };

  return (
    <div className={`support-management support-management--${language}`}>
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
          <Tag color={mySessionCount > 0 ? 'blue' : 'default'}>{t('pages.adminSupport.mySessions', { count: mySessionCount })}</Tag>
          <Tag color={unassignedOpenSessionCount > 0 ? 'orange' : 'default'}>{t('pages.adminSupport.unassignedSessions', { count: unassignedOpenSessionCount })}</Tag>
          <Tag color={staleOpenSessionCount > 0 ? 'red' : 'default'}>{t('pages.adminSupport.staleSessions', { count: staleOpenSessionCount, minutes: staleMinutes })}</Tag>
          {responseScore !== null ? <Tag color={responseScore < 70 ? 'volcano' : 'green'}>{t('pages.adminSupport.responseScore', { score: responseScore })}</Tag> : null}
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
        <div className="support-management__queuePane">
          {filteredQueueSessions.length === 0 ? (
            <Empty style={{ marginTop: 80 }} description={t('pages.adminSupport.noSessions')} />
          ) : (
            <List
              dataSource={filteredQueueSessions}
              renderItem={(item) => (
                <List.Item
                  onClick={() => loadMessages(item)}
                  className={`support-management__queueItem ${selectedSession?.id === item.id ? 'is-active' : ''} ${Number(item.unreadByAdmin || 0) > 0 ? 'support-management__queueItem--high' : ''}`}
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
                  <Tag color={selectedSession.status === 'OPEN' ? 'green' : 'default'}>{t(`status.${selectedSession.status}`)}</Tag>
                  <Tag color={selectedSession.assignedAdminId ? 'blue' : 'default'}>
                    {selectedSession.assignedAdminName || t('pages.adminSupport.unassigned')}
                  </Tag>
                </Space>
                <Space>
                  {selectedSession.status === 'OPEN' ? (
                    <Button loading={assigning} onClick={assignToMe}>
                      {t('pages.adminSupport.assignToMe')}
                    </Button>
                  ) : (
                    <Button loading={reopening} onClick={reopenSession}>
                      {t('pages.adminSupport.reopenSession')}
                    </Button>
                  )}
                  <Button icon={<GiftOutlined />} loading={reissueLoading} onClick={reissueBirthdayCoupons}>
                    {t('pages.adminSupport.reissueBirthdayCoupon')}
                  </Button>
                  <Button disabled={selectedSession.status !== 'OPEN'} onClick={closeSession}>{t('pages.adminSupport.closeSession')}</Button>
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
                                    <div className="support-management__orderPrice">{formatMoney(order.totalAmount)}</div>
                                    <div className="support-management__orderTags">
                                      <Tag color="blue">{t(`status.${order.status}`)}</Tag>
                                      {order.paymentMethod ? <Tag>{order.paymentMethod}</Tag> : null}
                                    </div>
                                    <Button type="link" size="small" className="support-management__orderLink" onClick={() => openOrderDetail(order.id)}>
                                      {t('pages.support.viewOrder')}
                                    </Button>
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
              {latestOrderContext ? (
                <div className="support-management__orderWorkflow">
                  <div className="support-management__orderWorkflowHeader">
                    <span>{t('pages.adminSupport.orderWorkflowTitle')}</span>
                    <strong>
                      {latestOrderContext.orderNo || `${t('pages.support.order')} #${latestOrderContext.id}`} · {t(`status.${latestOrderContext.status}`)}
                    </strong>
                  </div>
                  <div className="support-management__orderWorkflowActions">
                    {workflowActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className="support-management__orderWorkflowCard"
                        disabled={selectedSession.status !== 'OPEN'}
                        onClick={() => applyQuickReply(action.adminReply)}
                      >
                        <strong>{action.label}</strong>
                        <span>{action.helper}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="support-management__composer">
                <div className="support-management__replyReadiness">
                  <div>
                    <span>{t('pages.adminSupport.replyReadiness')}</span>
                    <strong>{replyReadinessText}</strong>
                  </div>
                  <div className="support-management__replyReadinessChips">
                    <span className={`support-management__replyReadinessChip ${selectedSession.status === 'OPEN' ? 'is-ready' : 'is-pending'}`}>
                      {selectedSession.status === 'OPEN' ? t('status.OPEN') : t('status.CLOSED')}
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
                <div className="support-management__composerActions">
                  <span className={`support-management__sendReadiness ${replyReady ? 'is-ready' : 'is-pending'}`}>
                    {replyReady ? t('pages.adminSupport.replyReady') : replyReadinessText}
                  </span>
                  <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={!replyReady}>{t('common.send')}</Button>
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


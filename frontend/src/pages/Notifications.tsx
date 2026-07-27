import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { useNavigate } from 'react-router-dom';
import { createApiAbortController, notificationApi } from '../api';
import type { AppNotification } from '../types';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { hasStoredValue } from '../utils/safeStorage';
import './Notifications.css';
import '../styles/mobile-page-contrast.css';
import {
  NOTIFICATION_PAGE_SIZE,
  buildNotificationQuickFilterLabels,
  buildNotificationsActionLabels,
  buildNotificationsPanelProps,
  deriveNotificationInsights,
  filterNotificationsByQuickFilter,
  mergeNotificationPages,
  notifyNavbarChanged,
  resolveNotificationActionPlanDescriptor,
  resolveNotificationRelatedPath,
  sortNotifications,
  type NotificationQuickFilter,
} from './notificationsHelpers';
import {
  NotificationsAuthGateShell,
  NotificationsLoadingShell,
  NotificationsMainPanels,
  type NotificationsActionPlan,
  type NotificationsPanelsProps,
} from './notificationsPanels';

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(() => hasStoredValue('token'));
  const [authRequired, setAuthRequired] = useState(() => !hasStoredValue('token'));
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [notificationPage, setNotificationPage] = useState(1);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [quickFilter, setQuickFilter] = useState<NotificationQuickFilter>('ALL');
  const mountedRef = useRef(true);
  const notificationFetchSeqRef = useRef(0);
  const notificationAbortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  usePageTitle(t('pages.notifications.title'));
  useDocumentMeta({
    title: t('pages.notifications.title'),
    description: t('common.siteDescription'),
    path: '/notifications',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });

  const fetchNotifications = useCallback(async (nextPage = 1, append = false) => {
    notificationAbortRef.current?.abort();
    const requestSeq = notificationFetchSeqRef.current + 1;
    notificationFetchSeqRef.current = requestSeq;
    const abortController = createApiAbortController();
    notificationAbortRef.current = abortController;
    const isCurrentRequest = () => mountedRef.current
      && notificationFetchSeqRef.current === requestSeq
      && !abortController.signal.aborted;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setFetchError('');
    }
    try {
      const res = await notificationApi.getByUser(0, false, nextPage, NOTIFICATION_PAGE_SIZE, {
        signal: abortController.signal,
      });
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
      announceAccessibleMessage(t('pages.notifications.fetchFailed'), 'error');
    } finally {
      if (notificationAbortRef.current === abortController) {
        notificationAbortRef.current = null;
      }
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
      notificationAbortRef.current?.abort();
      notificationAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasStoredValue('token')) {
      setAuthRequired(true);
      setLoading(false);
      setNotifications([]);
      setFetchError('');
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((current) => current.map(n => n.id === id ? { ...n, isRead: true } : n));
      notifyNavbarChanged();
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAsRead', error);
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    }
  }, [t]);

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((current) => current.map(n => ({ ...n, isRead: true })));
      notifyNavbarChanged();
      announceAccessibleMessage(t('pages.notifications.allRead'), 'success');
    } catch (error) {
      reportNonBlockingError('Notifications.handleMarkAllAsRead', error);
      announceAccessibleMessage(t('messages.operationFailed'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationApi.delete(id);
      setNotifications((current) => current.filter(n => n.id !== id));
      notifyNavbarChanged();
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
    } catch (error) {
      reportNonBlockingError('Notifications.handleDelete', error);
      announceAccessibleMessage(t('messages.deleteFailed'), 'error');
    }
  };

  const notificationInsights = useMemo(
    () => deriveNotificationInsights(notifications),
    [notifications],
  );

  const openRelatedNotification = useCallback((item: AppNotification) => {
    const related = resolveNotificationRelatedPath(item);
    if (related.kind !== 'path') {
      return;
    }
    navigate(related.path);
    if (related.markRead) {
      void handleMarkAsRead(item.id);
    }
  }, [handleMarkAsRead, navigate]);

  const actionPlanDescriptor = useMemo(
    () => resolveNotificationActionPlanDescriptor({ t, insights: notificationInsights }),
    [notificationInsights, t],
  );

  const actionPlan: NotificationsActionPlan = useMemo(() => ({
    title: actionPlanDescriptor.title,
    text: actionPlanDescriptor.text,
    label: actionPlanDescriptor.label,
    onClick: () => {
      if (actionPlanDescriptor.intent === 'filter-unread') {
        setQuickFilter('UNREAD');
        return;
      }
      if (actionPlanDescriptor.intent === 'coupons') {
        navigate('/coupons');
        return;
      }
      if (actionPlanDescriptor.intent === 'track-order') {
        navigate('/track-order');
        return;
      }
      if (actionPlanDescriptor.intent === 'orders') {
        navigate('/profile?tab=orders');
        return;
      }
      navigate('/products');
    },
  }), [actionPlanDescriptor, navigate]);

  const filteredNotifications = useMemo(
    () => filterNotificationsByQuickFilter(notifications, quickFilter),
    [notifications, quickFilter],
  );
  const notificationQuickFilterLabels = buildNotificationQuickFilterLabels(t);
  const {
    markAllActionLabel,
    clearFilterActionLabel,
    notificationActionPlanLabel,
    loadMoreActionLabel,
    authGateLoginLabel,
    authGateRegisterLabel,
  } = buildNotificationsActionLabels({
    t,
    unreadCount: notificationInsights.unread,
    quickFilterLabel: notificationQuickFilterLabels[quickFilter],
    actionPlanLabel: actionPlan.label,
    actionPlanTitle: actionPlan.title,
    loadedCount: notifications.length,
  });
  const notificationActionsDisabled = Boolean(fetchError);

  if (authRequired) {
    return (
      <NotificationsAuthGateShell
        t={t}
        language={language}
        navigate={navigate}
        authGateLoginLabel={authGateLoginLabel}
        authGateRegisterLabel={authGateRegisterLabel}
      />
    );
  }

  if (loading) {
    return <NotificationsLoadingShell t={t} />;
  }

  const panelProps: NotificationsPanelsProps = buildNotificationsPanelProps({
    t,
    language,
    navigate,
    notifications,
    filteredNotifications,
    notificationInsights,
    quickFilter,
    setQuickFilter,
    actionPlan,
    fetchError,
    fetchNotifications,
    handleMarkAllAsRead,
    handleMarkAsRead,
    handleDelete,
    openRelatedNotification,
    markAllActionLabel,
    clearFilterActionLabel,
    notificationActionPlanLabel,
    loadMoreActionLabel,
    notificationActionsDisabled,
    hasMoreNotifications,
    notificationPage,
    loadingMore,
  });

  return <NotificationsMainPanels {...panelProps} />;
};

export default Notifications;

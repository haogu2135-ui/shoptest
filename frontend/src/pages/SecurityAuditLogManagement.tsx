import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Input, InputNumber, Popconfirm, Progress, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import { AlertOutlined, DeleteOutlined, DownloadOutlined, KeyOutlined, MailOutlined, SafetyCertificateOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { SecurityAuditLog, SecurityAuditSummary } from '../types';
import { useLanguage } from '../i18n';
import type { TranslateFn } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import { AUDIT_LOGS_EXPORT_PERMISSION, AUDIT_LOGS_PURGE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './SecurityAuditLogManagement.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };
const auditRangePickerClassNames = { popup: { root: 'shop-mobile-popup-layer audit-log-page__rangePopup' } };

const actionColors: Record<string, string> = {
  LOGIN: 'blue',
  LOGOUT: 'default',
  ADMIN_BOOTSTRAP: 'red',
  EMAIL_LOGIN: 'blue',
  TOKEN_REFRESH: 'cyan',
  USER_PROFILE_UPDATE: 'blue',
  USER_PROFILE_EMAIL_CODE: 'cyan',
  USER_PASSWORD_UPDATE: 'red',
  USER_UPDATE: 'blue',
  USER_STATUS_UPDATE: 'gold',
  USER_ROLE_UPDATE: 'red',
  USER_ROLE_ASSIGN: 'red',
  USER_EXPORT: 'volcano',
  USER_DELETE: 'red',
  ADMIN_ROLE_SAVE: 'purple',
  PAYMENT_CREATE: 'cyan',
  PAYMENT_CALLBACK: 'green',
  PAYMENT_SYNC: 'geekblue',
  PAYMENT_SIMULATE_PAID: 'orange',
  PAYMENT_SIMULATE_CALLBACK: 'orange',
  STRIPE_WEBHOOK: 'green',
  ORDER_CANCEL: 'red',
  ORDER_BATCH_SHIP: 'geekblue',
  RETURN_REQUEST: 'gold',
  RETURN_SHIPMENT_SUBMIT: 'gold',
  REFUND_COMPLETE: 'purple',
  CONFIG_PUBLISH: 'cyan',
  CONFIG_APPLY_RUNTIME: 'cyan',
  LOG_DEBUG_TOGGLE: 'orange',
  LOG_PREVIEW: 'orange',
  LOG_DOWNLOAD: 'volcano',
  AUDIT_LOG_PURGE: 'red',
  AUDIT_LOG_EXPORT: 'volcano',
  ALERT_SELF_CHECK: 'magenta',
  ALERT_ACKNOWLEDGE: 'gold',
  ALERT_RESOLVE: 'green',
  ALERT_BATCH_ACKNOWLEDGE: 'gold',
  ALERT_BATCH_RESOLVE: 'green',
  ALERT_PURGE_RESOLVED: 'red',
  IP_BLACKLIST_BLOCK: 'red',
  IP_BLACKLIST_RELEASE: 'green',
  IP_BLACKLIST_BATCH_RELEASE: 'green',
  TRAFFIC_RATE_LIMIT_CLEAR: 'blue',
  TRAFFIC_CIRCUIT_RESET: 'purple',
  PRODUCT_CREATE: 'green',
  PRODUCT_UPDATE: 'blue',
  PRODUCT_DELETE: 'red',
  PRODUCT_STATUS_UPDATE: 'gold',
  PRODUCT_BATCH_STATUS_UPDATE: 'gold',
  BRAND_CREATE: 'green',
  BRAND_UPDATE: 'blue',
  BRAND_DELETE: 'red',
  CATEGORY_CREATE: 'green',
  CATEGORY_UPDATE: 'blue',
  CATEGORY_DELETE: 'red',
  LOGISTICS_CARRIER_CREATE: 'green',
  LOGISTICS_CARRIER_UPDATE: 'blue',
  LOGISTICS_CARRIER_DELETE: 'red',
  PRODUCT_QUESTION_ANSWER: 'green',
  REVIEW_REPLY: 'green',
  REVIEW_STATUS_UPDATE: 'gold',
  REVIEW_DELETE: 'red',
  SUPPORT_MESSAGE_SEND: 'green',
  SUPPORT_SESSION_CLOSE: 'gold',
  SUPPORT_SESSION_ASSIGN: 'blue',
  SUPPORT_SESSION_REOPEN: 'cyan',
  SUPPORT_BIRTHDAY_COUPON_REISSUE: 'magenta',
  NOTIFICATION_BROADCAST: 'purple',
  ANNOUNCEMENT_CREATE: 'green',
  ANNOUNCEMENT_UPDATE: 'blue',
  ANNOUNCEMENT_DELETE: 'red',
  PRODUCT_IMPORT_PREVIEW: 'cyan',
  PRODUCT_IMPORT_APPLY: 'green',
  PRODUCT_URL_IMPORT: 'geekblue',
  COUPON_CREATE: 'green',
  COUPON_UPDATE: 'blue',
  COUPON_DELETE: 'red',
  COUPON_GRANT: 'purple',
  PET_BIRTHDAY_COUPON_RUN: 'magenta',
  PET_BIRTHDAY_COUPON_CONFIG_UPDATE: 'magenta',
  PET_BIRTHDAY_COUPON_REISSUE: 'magenta',
  PET_GALLERY_PHOTO_DELETE: 'red',
};

export const auditActionOptions = [
  'LOGIN',
  'LOGOUT',
  'ADMIN_BOOTSTRAP',
  'EMAIL_LOGIN',
  'TOKEN_REFRESH',
  'USER_PROFILE_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_PASSWORD_UPDATE',
  'USER_UPDATE',
  'USER_STATUS_UPDATE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
  'USER_DELETE',
  'ADMIN_ROLE_SAVE',
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'PAYMENT_SYNC',
  'PAYMENT_SIMULATE_PAID',
  'PAYMENT_SIMULATE_CALLBACK',
  'STRIPE_WEBHOOK',
  'ORDER_CANCEL',
  'RETURN_REQUEST',
  'RETURN_APPROVE',
  'RETURN_REJECT',
  'RETURN_SHIPMENT_SUBMIT',
  'REFUND_COMPLETE',
  'ORDER_STATUS_UPDATE',
  'ORDER_BATCH_SHIP',
  'ORDER_EXPORT',
  'CONFIG_PUBLISH',
  'CONFIG_APPLY_RUNTIME',
  'LOG_DEBUG_TOGGLE',
  'LOG_PREVIEW',
  'LOG_DOWNLOAD',
  'AUDIT_LOG_PURGE',
  'AUDIT_LOG_EXPORT',
  'ALERT_SELF_CHECK',
  'ALERT_ACKNOWLEDGE',
  'ALERT_RESOLVE',
  'ALERT_BATCH_ACKNOWLEDGE',
  'ALERT_BATCH_RESOLVE',
  'ALERT_PURGE_RESOLVED',
  'IP_BLACKLIST_BLOCK',
  'IP_BLACKLIST_RELEASE',
  'IP_BLACKLIST_BATCH_RELEASE',
  'TRAFFIC_RATE_LIMIT_CLEAR',
  'TRAFFIC_CIRCUIT_RESET',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'PRODUCT_STATUS_UPDATE',
  'PRODUCT_BATCH_STATUS_UPDATE',
  'BRAND_CREATE',
  'BRAND_UPDATE',
  'BRAND_DELETE',
  'CATEGORY_CREATE',
  'CATEGORY_UPDATE',
  'CATEGORY_DELETE',
  'LOGISTICS_CARRIER_CREATE',
  'LOGISTICS_CARRIER_UPDATE',
  'LOGISTICS_CARRIER_DELETE',
  'PRODUCT_QUESTION_ANSWER',
  'REVIEW_REPLY',
  'REVIEW_STATUS_UPDATE',
  'REVIEW_DELETE',
  'SUPPORT_MESSAGE_SEND',
  'SUPPORT_SESSION_CLOSE',
  'SUPPORT_SESSION_ASSIGN',
  'SUPPORT_SESSION_REOPEN',
  'SUPPORT_BIRTHDAY_COUPON_REISSUE',
  'NOTIFICATION_BROADCAST',
  'ANNOUNCEMENT_CREATE',
  'ANNOUNCEMENT_UPDATE',
  'ANNOUNCEMENT_DELETE',
  'PRODUCT_IMPORT_PREVIEW',
  'PRODUCT_IMPORT_APPLY',
  'PRODUCT_URL_IMPORT',
  'COUPON_CREATE',
  'COUPON_UPDATE',
  'COUPON_DELETE',
  'COUPON_GRANT',
  'PET_BIRTHDAY_COUPON_RUN',
  'PET_BIRTHDAY_COUPON_CONFIG_UPDATE',
  'PET_BIRTHDAY_COUPON_REISSUE',
  'PET_GALLERY_PHOTO_DELETE',
];

const highRiskActions = new Set([
  'AUDIT_LOG_EXPORT',
  'ADMIN_BOOTSTRAP',
  'USER_PASSWORD_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
  'USER_DELETE',
  'ADMIN_ROLE_SAVE',
  'ORDER_EXPORT',
  'CONFIG_PUBLISH',
  'CONFIG_APPLY_RUNTIME',
  'LOG_DEBUG_TOGGLE',
  'LOG_PREVIEW',
  'LOG_DOWNLOAD',
  'AUDIT_LOG_PURGE',
  'ORDER_BATCH_SHIP',
  'REFUND_COMPLETE',
  'STRIPE_WEBHOOK',
  'PAYMENT_SIMULATE_CALLBACK',
  'PAYMENT_SIMULATE_PAID',
  'ALERT_PURGE_RESOLVED',
  'IP_BLACKLIST_BLOCK',
  'TRAFFIC_RATE_LIMIT_CLEAR',
  'TRAFFIC_CIRCUIT_RESET',
  'PRODUCT_DELETE',
  'PRODUCT_STATUS_UPDATE',
  'PRODUCT_BATCH_STATUS_UPDATE',
  'BRAND_DELETE',
  'CATEGORY_DELETE',
  'LOGISTICS_CARRIER_DELETE',
  'REVIEW_DELETE',
  'SUPPORT_SESSION_CLOSE',
  'SUPPORT_BIRTHDAY_COUPON_REISSUE',
  'NOTIFICATION_BROADCAST',
  'ANNOUNCEMENT_DELETE',
  'COUPON_DELETE',
  'PET_BIRTHDAY_COUPON_CONFIG_UPDATE',
  'PET_GALLERY_PHOTO_DELETE',
]);

const paymentOpsActions = new Set([
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'STRIPE_WEBHOOK',
  'REFUND_COMPLETE',
]);

const accountSecurityActions = new Set([
  'LOGIN',
  'EMAIL_LOGIN',
  'TOKEN_REFRESH',
  'ADMIN_BOOTSTRAP',
  'USER_PROFILE_UPDATE',
  'USER_PROFILE_EMAIL_CODE',
  'USER_PASSWORD_UPDATE',
  'USER_ROLE_UPDATE',
  'USER_ROLE_ASSIGN',
  'USER_EXPORT',
]);

const auditResourceTypeOptions = [
  'USER',
  'ADMIN_ROLE',
  'ORDER',
  'PAYMENT',
  'PRODUCT',
  'BRAND',
  'CATEGORY',
  'LOGISTICS_CARRIER',
  'PRODUCT_QUESTION',
  'REVIEW',
  'SUPPORT_SESSION',
  'NOTIFICATION',
  'SITE_ANNOUNCEMENT',
  'SECURITY_AUDIT_LOG',
  'CONFIG_CENTER',
  'LOGGING',
  'SYSTEM_ALERT',
  'IP_BLACKLIST',
  'TRAFFIC_CONTROL',
  'PRODUCT_IMPORT',
  'COUPON',
  'COUPON_CONFIG',
  'PET_GALLERY',
];

type AuditLogLocaleSection = 'actionLabels' | 'resourceTypeLabels' | 'messageLabels';

const auditLocaleValue = (t: TranslateFn, section: AuditLogLocaleSection, value?: string) => {
  if (!value) return '-';
  return t(`pages.auditLogs.${section}.${value}`, { defaultValue: value });
};

const auditOpsText = (t: TranslateFn, key: string, params?: Record<string, string | number>) =>
  t(`pages.auditLogs.ops.${key}`, params);

const auditAdminText = (t: TranslateFn, key: string, params?: Record<string, string | number>) =>
  t(`pages.auditLogs.admin.${key}`, params);

const SecurityAuditLogManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [summary, setSummary] = useState<SecurityAuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [auditSnapshotLoaded, setAuditSnapshotLoaded] = useState(false);
  const [purging, setPurging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [action, setAction] = useState<string | undefined>(searchParams.get('action') || undefined);
  const [result, setResult] = useState<string | undefined>(searchParams.get('result') || undefined);
  const [resourceType, setResourceType] = useState<string | undefined>(searchParams.get('resourceType') || undefined);
  const [actorUsername, setActorUsername] = useState('');
  const [range, setRange] = useState<RangePickerProps['value']>(null);
  const [retentionDays, setRetentionDays] = useState(180);
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const canExportAuditLogs = hasAdminPermission(adminPermissions, currentRole, AUDIT_LOGS_EXPORT_PERMISSION);
  const canPurgeAuditLogs = hasAdminPermission(adminPermissions, currentRole, AUDIT_LOGS_PURGE_PERMISSION);
  const auditActionDisabled = loading || Boolean(loadError) || !auditSnapshotLoaded;

  const actionLabel = useCallback((value?: string) => auditLocaleValue(t, 'actionLabels', value), [t]);
  const resourceLabel = useCallback((value?: string) => auditLocaleValue(t, 'resourceTypeLabels', value), [t]);
  const messageLabel = useCallback((value?: string) => auditLocaleValue(t, 'messageLabels', value), [t]);
  const opsText = useCallback((key: string, params?: Record<string, string | number>) => auditOpsText(t, key, params), [t]);
  const adminText = useCallback((key: string, params?: Record<string, string | number>) => auditAdminText(t, key, params), [t]);
  const auditPurgeActionLabel = `${adminText('purge')}: ${retentionDays} ${adminText('days')}`;

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { limit: 300 };
    if (action) params.action = action;
    if (result) params.result = result;
    if (resourceType) params.resourceType = resourceType;
    if (actorUsername.trim()) params.actorUsername = actorUsername.trim();
    if (range?.[0]) params.startAt = range[0].format('YYYY-MM-DDTHH:mm:ss');
    if (range?.[1]) params.endAt = range[1].format('YYYY-MM-DDTHH:mm:ss');
    return params;
  }, [action, actorUsername, range, resourceType, result]);

  const auditInsights = useMemo(() => {
    const total = logs.length;
    const failures = logs.filter((log) => log.result === 'FAILURE').length;
    const failureRate = total ? Math.round((failures / total) * 100) : 0;
    const sensitiveActions = logs.filter((log) => highRiskActions.has(log.action)).length;
    const exports = logs.filter((log) => log.action.includes('EXPORT')).length;
    const paymentFailures = logs.filter((log) => (
      log.result === 'FAILURE' && (log.action.startsWith('PAYMENT') || log.action.includes('STRIPE'))
    )).length;
    const refundEvents = logs.filter((log) => log.action === 'REFUND_COMPLETE').length;
    const callbackEvents = logs.filter((log) => log.action === 'PAYMENT_CALLBACK' || log.action === 'STRIPE_WEBHOOK').length;
    const paymentOpsEvents = logs.filter((log) => paymentOpsActions.has(log.action)).length;
    const accountFailures = logs.filter((log) => log.result === 'FAILURE' && accountSecurityActions.has(log.action)).length;
    const passwordChanges = logs.filter((log) => log.action === 'USER_PASSWORD_UPDATE').length;
    const emailCodeEvents = logs.filter((log) => log.action === 'USER_PROFILE_EMAIL_CODE').length;
    const accountSecurityEvents = logs.filter((log) => accountSecurityActions.has(log.action)).length;

    const failedActorCounts = logs.reduce<Record<string, number>>((acc, log) => {
      if (log.result !== 'FAILURE') return acc;
      const key = log.actorUsername || log.ipAddress || (log.actorUserId ? String(log.actorUserId) : '');
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const repeatedFailures = Object.values(failedActorCounts).filter((count) => count >= 3).length;
    const healthScore = Math.max(0, 100 - failureRate - repeatedFailures * 12 - paymentFailures * 8 - Math.max(0, exports - 2) * 5);

    return {
      total,
      failures,
      failureRate,
      sensitiveActions,
      exports,
      paymentFailures,
      refundEvents,
      callbackEvents,
      paymentOpsEvents,
      accountFailures,
      passwordChanges,
      emailCodeEvents,
      accountSecurityEvents,
      repeatedFailures,
      healthScore,
    };
  }, [logs]);
  const summaryTotal = summary?.totalCount ?? auditInsights.total;
  const summarySuccess = summary?.successCount ?? Math.max(0, auditInsights.total - auditInsights.failures);
  const summaryFailures = summary?.failureCount ?? auditInsights.failures;
  const summaryFailureRate = summaryTotal ? Math.round((summaryFailures / summaryTotal) * 100) : auditInsights.failureRate;
  const summaryRangeHours = summary ? Math.max(1, Math.round((new Date(summary.endAt).getTime() - new Date(summary.startAt).getTime()) / 3600000)) : 0;
  const activeAuditView = searchParams.get('view') || '';
  const paymentFailureMetricLabel = `${opsText('paymentFailures')}: ${auditInsights.paymentFailures}`;
  const refundMetricLabel = `${opsText('refundEvents')}: ${auditInsights.refundEvents}`;
  const callbackMetricLabel = `${opsText('callbackEvents')}: ${auditInsights.callbackEvents}`;
  const paymentOpsMetricLabel = `${opsText('highRiskEvents')}: ${auditInsights.paymentOpsEvents}`;
  const accountFailureMetricLabel = `${opsText('accountFailures')}: ${auditInsights.accountFailures}`;
  const passwordChangeMetricLabel = `${opsText('passwordChanges')}: ${auditInsights.passwordChanges}`;
  const emailCodeMetricLabel = `${opsText('emailCodeEvents')}: ${auditInsights.emailCodeEvents}`;
  const accountSecurityMetricLabel = `${opsText('accountEvents')}: ${auditInsights.accountSecurityEvents}`;
  const showPaymentFailuresLabel = `${opsText('showPaymentFailures')}: ${auditInsights.paymentFailures}`;
  const showRefundsLabel = `${opsText('showRefunds')}: ${auditInsights.refundEvents}`;
  const showCallbacksLabel = `${opsText('showCallbacks')}: ${auditInsights.callbackEvents}`;
  const showAccountFailuresLabel = `${opsText('showAccountFailures')}: ${auditInsights.accountFailures}`;
  const showPasswordChangesLabel = `${opsText('showPasswordChanges')}: ${auditInsights.passwordChanges}`;
  const showEmailCodesLabel = `${opsText('showEmailCodes')}: ${auditInsights.emailCodeEvents}`;
  const showAccountEventsLabel = `${opsText('showAccountEvents')}: ${auditInsights.accountSecurityEvents}`;
  const selectedAuditActionLabel = action ? actionLabel(action) : t('common.all');
  const selectedAuditResultLabel = result === 'SUCCESS'
    ? t('pages.auditLogs.success')
    : result === 'FAILURE'
      ? t('pages.auditLogs.failure')
      : t('common.all');
  const selectedAuditResourceLabel = resourceType ? resourceLabel(resourceType) : t('common.all');
  const selectedAuditActorLabel = actorUsername.trim() || t('common.all');
  const selectedAuditRangeLabel = range?.[0] && range?.[1]
    ? `${range[0].format('YYYY-MM-DD HH:mm')} - ${range[1].format('YYYY-MM-DD HH:mm')}`
    : t('common.all');
  const auditActionFilterLabel = `${t('pages.auditLogs.action')}: ${t('pages.auditLogs.title')}, ${selectedAuditActionLabel}`;
  const auditResultFilterLabel = `${t('pages.auditLogs.result')}: ${t('pages.auditLogs.title')}, ${selectedAuditResultLabel}`;
  const auditResourceFilterLabel = `${t('pages.auditLogs.resource')}: ${t('pages.auditLogs.title')}, ${selectedAuditResourceLabel}`;
  const auditActorFilterLabel = `${t('pages.auditLogs.actor')}: ${t('pages.auditLogs.title')}, ${selectedAuditActorLabel}`;
  const auditRangeFilterLabel = `${t('common.time')}: ${t('pages.auditLogs.title')}, ${selectedAuditRangeLabel}`;
  const auditToolbarSearchLabel = `${t('common.search')}: ${selectedAuditActionLabel}, ${selectedAuditResultLabel}, ${selectedAuditResourceLabel}, ${selectedAuditActorLabel}`;
  const auditExportToolbarLabel = `${t('pages.auditLogs.export')}: ${selectedAuditActionLabel}, ${selectedAuditResultLabel}, ${selectedAuditResourceLabel}`;
  const auditPaginationItemRender = useMemo(
    () => buildPaginationItemRender(
      `${t('common.previousPage')}: ${t('pages.auditLogs.title')}`,
      `${t('common.nextPage')}: ${t('pages.auditLogs.title')}`,
      `${t('common.previousPages')}: ${t('pages.auditLogs.title')}`,
      `${t('common.nextPages')}: ${t('pages.auditLogs.title')}`
    ),
    [t]
  );

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'payment-failures') {
      setAction(undefined);
      setResult('FAILURE');
      setResourceType('PAYMENT');
      return;
    }
    if (view === 'refunds') {
      setAction('REFUND_COMPLETE');
      setResult(undefined);
      setResourceType(undefined);
      return;
    }
    if (view === 'callbacks') {
      setAction('PAYMENT_CALLBACK');
      setResult(undefined);
      setResourceType('PAYMENT');
      return;
    }
    if (view === 'payment-ops') {
      setAction(undefined);
      setResult(undefined);
      setResourceType(undefined);
      return;
    }
    if (view === 'account-failures') {
      setAction(undefined);
      setResult('FAILURE');
      setResourceType('USER');
      return;
    }
    if (view === 'password-changes') {
      setAction('USER_PASSWORD_UPDATE');
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    if (view === 'email-codes') {
      setAction('USER_PROFILE_EMAIL_CODE');
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    if (view === 'account-security') {
      setAction(undefined);
      setResult(undefined);
      setResourceType('USER');
      return;
    }
    setAction(searchParams.get('action') || undefined);
    setResult(searchParams.get('result') || undefined);
    setResourceType(searchParams.get('resourceType') || undefined);
  }, [searchParams]);

  const updateAuditFilters = useCallback((next: { action?: string; result?: string; resourceType?: string; view?: string }) => {
    const params = new URLSearchParams();
    if (next.view) params.set('view', next.view);
    if (next.action) params.set('action', next.action);
    if (next.result) params.set('result', next.result);
    if (next.resourceType) params.set('resourceType', next.resourceType);
    setSearchParams(params, { replace: true });
    setAction(next.action);
    setResult(next.result);
    setResourceType(next.resourceType);
  }, [setSearchParams]);

  const applyPaymentFailureFilter = () => {
    updateAuditFilters({ result: 'FAILURE', resourceType: 'PAYMENT', view: 'payment-failures' });
  };

  const applyRefundFilter = () => {
    updateAuditFilters({ action: 'REFUND_COMPLETE', view: 'refunds' });
  };

  const applyCallbackFilter = () => {
    updateAuditFilters({ action: 'PAYMENT_CALLBACK', resourceType: 'PAYMENT', view: 'callbacks' });
  };

  const applyPaymentOpsFilter = () => {
    updateAuditFilters({ view: 'payment-ops' });
  };

  const applyAccountFailureFilter = () => {
    updateAuditFilters({ result: 'FAILURE', resourceType: 'USER', view: 'account-failures' });
  };

  const applyPasswordChangeFilter = () => {
    updateAuditFilters({ action: 'USER_PASSWORD_UPDATE', resourceType: 'USER', view: 'password-changes' });
  };

  const applyEmailCodeFilter = () => {
    updateAuditFilters({ action: 'USER_PROFILE_EMAIL_CODE', resourceType: 'USER', view: 'email-codes' });
  };

  const applyAccountSecurityFilter = () => {
    updateAuditFilters({ resourceType: 'USER', view: 'account-security' });
  };

  const clearOpsFilters = () => {
    updateAuditFilters({});
    setActorUsername('');
    setRange(null);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [logResponse, summaryResponse] = await Promise.all([
        adminApi.getAuditLogs(queryParams),
        adminApi.getAuditLogSummary({ ...queryParams, topLimit: 6 }),
      ]);
      setLoadError(null);
      setLogs(logResponse.data || []);
      setSummary(summaryResponse.data || null);
      setAuditSnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.auditLogs.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, queryParams, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchLogs();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [fetchLogs]);

  useEffect(() => {
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

  const exportLogs = async () => {
    if (!canExportAuditLogs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (auditActionDisabled) {
      message.warning(loadError || (loading ? t('common.loading') : t('pages.auditLogs.loadFailed')));
      return;
    }
    setExporting(true);
    try {
      const res = await adminApi.exportAuditLogs(queryParams);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'security-audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
      if (String(res.headers?.['x-export-truncated']) === 'true') {
        message.warning(t('pages.auditLogs.exportTruncated', {
          returned: res.headers?.['x-export-returned'] || '',
          total: res.headers?.['x-export-total'] || '',
        }));
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.auditLogs.exportFailed'), language));
    } finally {
      setExporting(false);
    }
  };

  const purgeOldLogs = async () => {
    if (!canPurgeAuditLogs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (auditActionDisabled) {
      message.warning(loadError || (loading ? t('common.loading') : t('pages.auditLogs.loadFailed')));
      return;
    }
    setPurging(true);
    try {
      const response = await adminApi.purgeAuditLogs(retentionDays);
      message.success(adminText('purgeSuccess', { count: response.data.deletedCount || 0 }));
      await fetchLogs();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, adminText('purgeFailed'), language));
    } finally {
      setPurging(false);
    }
  };

  const showInitialAuditLoading = loading && !auditSnapshotLoaded;
  const auditSnapshotUnavailable = Boolean(loadError) && !auditSnapshotLoaded;

  return (
    <div className="audit-log-page">
      <Title level={4}>{t('pages.auditLogs.title')}</Title>

      {loadError ? (
        <Alert
          className="audit-log-page__alert"
          type="warning"
          showIcon
          message={loadError}
          description={auditSnapshotLoaded ? t('pages.auditLogs.staleDataWarning') : undefined}
          action={(
            <Button size="small" onClick={fetchLogs} loading={loading}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {showInitialAuditLoading ? (
        <Card
          className="audit-log-page__loadingState"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        >
          <Spin spinning>
            <Text type="secondary">{t('common.loading')}</Text>
          </Spin>
        </Card>
      ) : null}

      {!showInitialAuditLoading && !auditSnapshotUnavailable ? (
        <>
      <section className="audit-log-page__insights" aria-label={t('pages.auditLogs.insightTitle')}>
        <div className="audit-log-page__insightCopy">
          <Text className="audit-log-page__eyebrow">{t('pages.auditLogs.insightEyebrow')}</Text>
          <Title level={5}>{t('pages.auditLogs.insightTitle')}</Title>
          <Text type="secondary">{t('pages.auditLogs.insightSubtitle')}</Text>
          <Text type="secondary" className="audit-log-page__insightMeta">
            {t('pages.auditLogs.insightMeta', { total: summaryTotal, sensitive: auditInsights.sensitiveActions })}
          </Text>
        </div>
        <div className="audit-log-page__score">
          <Progress
            type="circle"
            percent={auditInsights.healthScore}
            width={92}
            strokeColor={auditInsights.healthScore >= 80 ? '#2f855a' : auditInsights.healthScore >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.auditLogs.securityScore')}</Text>
        </div>
        <div className="audit-log-page__signalGrid">
          <div className={`audit-log-page__signal ${summaryFailureRate > 12 ? 'is-risk' : 'is-ok'}`}>
            <AlertOutlined />
            <strong>{summaryFailureRate}%</strong>
            <span>{t('pages.auditLogs.failureRate')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.repeatedFailures > 0 ? 'is-risk' : 'is-ok'}`}>
            <SafetyCertificateOutlined />
            <strong>{auditInsights.repeatedFailures}</strong>
            <span>{t('pages.auditLogs.repeatFailures')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.paymentFailures > 0 ? 'is-risk' : 'is-ok'}`}>
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{t('pages.auditLogs.paymentFailures')}</span>
          </div>
          <div className={`audit-log-page__signal ${auditInsights.exports > 2 ? 'is-risk' : 'is-ok'}`}>
            <DownloadOutlined />
            <strong>{auditInsights.exports}</strong>
            <span>{t('pages.auditLogs.exportEvents')}</span>
          </div>
        </div>
      </section>
      <section className="audit-log-page__summaryPanel" aria-label={adminText('summaryTitle')}>
        <div className="audit-log-page__summaryCards">
          <div>
            <span>{adminText('total')}</span>
            <strong>{summaryTotal}</strong>
          </div>
          <div>
            <span>{adminText('success')}</span>
            <strong>{summarySuccess}</strong>
          </div>
          <div className={summaryFailures > 0 ? 'is-risk' : ''}>
            <span>{adminText('failure')}</span>
            <strong>{summaryFailures}</strong>
          </div>
          <div>
            <span>{adminText('range')}</span>
            <strong>{summaryRangeHours ? `${summaryRangeHours}h` : '-'}</strong>
          </div>
        </div>
        <div className="audit-log-page__topGroups">
          {[
            { title: adminText('topActions'), rows: summary?.topActions || [], formatter: actionLabel },
            { title: adminText('topActors'), rows: summary?.topActors || [] },
            { title: adminText('topIps'), rows: summary?.topIpAddresses || [] },
          ].map((group) => (
            <div key={group.title} className="audit-log-page__topGroup">
              <Text strong>{group.title}</Text>
              {(group.rows.length ? group.rows : [{ name: '-', count: 0 }]).slice(0, 4).map((row) => (
                <span key={`${group.title}-${row.name}`}>
                  <em>{group.formatter ? group.formatter(row.name) : row.name}</em>
                  <strong>{row.count}</strong>
                </span>
              ))}
            </div>
          ))}
        </div>
        {canPurgeAuditLogs ? (
          <div className="audit-log-page__retention">
            <div>
              <Text strong>{adminText('retentionTitle')}</Text>
              <Text type="secondary">{adminText('retentionHint')}</Text>
            </div>
            <Space wrap>
              <InputNumber
                min={7}
                max={3650}
                precision={0}
                value={retentionDays}
                onChange={(value) => setRetentionDays(Number(value || 180))}
                addonAfter={adminText('days')}
                aria-label={`${adminText('retentionTitle')}: ${retentionDays} ${adminText('days')}`}
                title={`${adminText('retentionTitle')}: ${retentionDays} ${adminText('days')}`}
              />
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={adminText('purgeConfirm')}
                onConfirm={purgeOldLogs}
                disabled={auditActionDisabled}
                okText={adminText('purge')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true, 'aria-label': auditPurgeActionLabel, title: auditPurgeActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${auditPurgeActionLabel}`, title: `${t('common.cancel')}: ${auditPurgeActionLabel}` }}
              >
                <Button danger icon={<DeleteOutlined />} aria-label={auditPurgeActionLabel} title={auditPurgeActionLabel} loading={purging} disabled={auditActionDisabled}>
                  {adminText('purge')}
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : null}
      </section>
      <section className="audit-log-page__opsPanel" aria-label={opsText('title')}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{opsText('title')}</Text>
          <Text type="secondary">{opsText('subtitle')}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button
            type="button"
            className={auditInsights.paymentFailures > 0 ? 'is-risk' : ''}
            aria-label={paymentFailureMetricLabel}
            aria-pressed={activeAuditView === 'payment-failures'}
            title={paymentFailureMetricLabel}
            onClick={applyPaymentFailureFilter}
          >
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{opsText('paymentFailures')}</span>
          </button>
          <button
            type="button"
            aria-label={refundMetricLabel}
            aria-pressed={activeAuditView === 'refunds'}
            title={refundMetricLabel}
            onClick={applyRefundFilter}
          >
            <SafetyCertificateOutlined />
            <strong>{auditInsights.refundEvents}</strong>
            <span>{opsText('refundEvents')}</span>
          </button>
          <button
            type="button"
            aria-label={callbackMetricLabel}
            aria-pressed={activeAuditView === 'callbacks'}
            title={callbackMetricLabel}
            onClick={applyCallbackFilter}
          >
            <SearchOutlined />
            <strong>{auditInsights.callbackEvents}</strong>
            <span>{opsText('callbackEvents')}</span>
          </button>
          <button
            type="button"
            className={auditInsights.sensitiveActions > 0 ? 'is-watch' : ''}
            aria-label={paymentOpsMetricLabel}
            aria-pressed={activeAuditView === 'payment-ops'}
            title={paymentOpsMetricLabel}
            onClick={applyPaymentOpsFilter}
          >
            <AlertOutlined />
            <strong>{auditInsights.paymentOpsEvents}</strong>
            <span>{opsText('highRiskEvents')}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{opsText('guideTitle')}</Text>
            <Text type="secondary">{opsText('guideText')}</Text>
          </div>
          <Space wrap>
            <Button size="small" aria-label={showPaymentFailuresLabel} title={showPaymentFailuresLabel} onClick={applyPaymentFailureFilter}>{opsText('showPaymentFailures')}</Button>
            <Button size="small" aria-label={showRefundsLabel} title={showRefundsLabel} onClick={applyRefundFilter}>{opsText('showRefunds')}</Button>
            <Button size="small" aria-label={showCallbacksLabel} title={showCallbacksLabel} onClick={applyCallbackFilter}>{opsText('showCallbacks')}</Button>
            <Button size="small" aria-label={opsText('clear')} title={opsText('clear')} onClick={clearOpsFilters}>{opsText('clear')}</Button>
          </Space>
        </div>
      </section>
      <section className="audit-log-page__opsPanel" aria-label={opsText('accountGuideTitle')}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{opsText('accountGuideTitle')}</Text>
          <Text type="secondary">{opsText('accountGuideText')}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button
            type="button"
            className={auditInsights.accountFailures > 0 ? 'is-risk' : ''}
            aria-label={accountFailureMetricLabel}
            aria-pressed={activeAuditView === 'account-failures'}
            title={accountFailureMetricLabel}
            onClick={applyAccountFailureFilter}
          >
            <AlertOutlined />
            <strong>{auditInsights.accountFailures}</strong>
            <span>{opsText('accountFailures')}</span>
          </button>
          <button
            type="button"
            className={auditInsights.passwordChanges > 0 ? 'is-watch' : ''}
            aria-label={passwordChangeMetricLabel}
            aria-pressed={activeAuditView === 'password-changes'}
            title={passwordChangeMetricLabel}
            onClick={applyPasswordChangeFilter}
          >
            <KeyOutlined />
            <strong>{auditInsights.passwordChanges}</strong>
            <span>{opsText('passwordChanges')}</span>
          </button>
          <button
            type="button"
            aria-label={emailCodeMetricLabel}
            aria-pressed={activeAuditView === 'email-codes'}
            title={emailCodeMetricLabel}
            onClick={applyEmailCodeFilter}
          >
            <MailOutlined />
            <strong>{auditInsights.emailCodeEvents}</strong>
            <span>{opsText('emailCodeEvents')}</span>
          </button>
          <button
            type="button"
            aria-label={accountSecurityMetricLabel}
            aria-pressed={activeAuditView === 'account-security'}
            title={accountSecurityMetricLabel}
            onClick={applyAccountSecurityFilter}
          >
            <UserOutlined />
            <strong>{auditInsights.accountSecurityEvents}</strong>
            <span>{opsText('accountEvents')}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{opsText('accountGuideTitle')}</Text>
            <Text type="secondary">{opsText('accountGuideText')}</Text>
          </div>
          <Space wrap>
            <Button size="small" aria-label={showAccountFailuresLabel} title={showAccountFailuresLabel} onClick={applyAccountFailureFilter}>{opsText('showAccountFailures')}</Button>
            <Button size="small" aria-label={showPasswordChangesLabel} title={showPasswordChangesLabel} onClick={applyPasswordChangeFilter}>{opsText('showPasswordChanges')}</Button>
            <Button size="small" aria-label={showEmailCodesLabel} title={showEmailCodesLabel} onClick={applyEmailCodeFilter}>{opsText('showEmailCodes')}</Button>
            <Button size="small" aria-label={showAccountEventsLabel} title={showAccountEventsLabel} onClick={applyAccountSecurityFilter}>{opsText('showAccountEvents')}</Button>
            <Button size="small" aria-label={opsText('clear')} title={opsText('clear')} onClick={clearOpsFilters}>{opsText('clear')}</Button>
          </Space>
        </div>
      </section>
      <Card className="audit-log-page__toolbar">
        <Space wrap>
          <Select
            allowClear
            value={action}
            onChange={(value) => updateAuditFilters({ action: value, result, resourceType })}
            placeholder={t('pages.auditLogs.action')}
            className="audit-log-page__actionFilter"
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
            aria-label={auditActionFilterLabel}
            title={auditActionFilterLabel}
            options={auditActionOptions.map((value) => ({ value, label: actionLabel(value) }))}
          />
          <Select
            allowClear
            value={result}
            onChange={(value) => updateAuditFilters({ action, result: value, resourceType })}
            placeholder={t('pages.auditLogs.result')}
            className="audit-log-page__resultFilter"
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
            aria-label={auditResultFilterLabel}
            title={auditResultFilterLabel}
            options={[
              { value: 'SUCCESS', label: t('pages.auditLogs.success') },
              { value: 'FAILURE', label: t('pages.auditLogs.failure') },
            ]}
          />
          <Select
            allowClear
            value={resourceType}
            onChange={(value) => updateAuditFilters({ action, result, resourceType: value })}
            placeholder={t('pages.auditLogs.resource')}
            className="audit-log-page__resourceFilter"
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
            aria-label={auditResourceFilterLabel}
            title={auditResourceFilterLabel}
            options={auditResourceTypeOptions.map((value) => ({ value, label: resourceLabel(value) }))}
          />
          <Input
            allowClear
            value={actorUsername}
            onChange={(event) => setActorUsername(event.target.value)}
            placeholder={t('pages.auditLogs.actor')}
            className="audit-log-page__actorInput"
            aria-label={auditActorFilterLabel}
            title={auditActorFilterLabel}
          />
          <div role="group" aria-label={auditRangeFilterLabel} title={auditRangeFilterLabel}>
            <RangePicker showTime value={range} onChange={setRange} classNames={auditRangePickerClassNames} getPopupContainer={() => document.body} />
          </div>
          <Button icon={<SearchOutlined />} type="primary" aria-label={auditToolbarSearchLabel} title={auditToolbarSearchLabel} onClick={fetchLogs}>
            {t('common.search')}
          </Button>
          {canExportAuditLogs ? (
            <Button icon={<DownloadOutlined />} loading={exporting} disabled={auditActionDisabled} aria-label={auditExportToolbarLabel} title={auditExportToolbarLabel} onClick={exportLogs}>
              {t('pages.auditLogs.export')}
            </Button>
          ) : null}
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={logs}
          size="middle"
          scroll={{ x: 1180 }}
          pagination={{
            pageSize: 12,
            showTotal: (total) => t('common.tableTotal', { count: total }),
            itemRender: auditPaginationItemRender,
          }}
          columns={[
            {
              title: t('common.time'),
              dataIndex: 'createdAt',
              width: 180,
              render: (value: string) => value ? new Date(value).toLocaleString(dateLocale) : '-',
            },
            {
              title: t('pages.auditLogs.action'),
              dataIndex: 'action',
              width: 190,
              render: (value: string) => <Tag color={actionColors[value] || 'default'}>{actionLabel(value)}</Tag>,
            },
            {
              title: t('pages.auditLogs.result'),
              dataIndex: 'result',
              width: 100,
              render: (value: string) => (
                <Tag color={value === 'SUCCESS' ? 'green' : 'red'}>
                  {value === 'SUCCESS' ? t('pages.auditLogs.success') : value === 'FAILURE' ? t('pages.auditLogs.failure') : value}
                </Tag>
              ),
            },
            {
              title: t('pages.auditLogs.actor'),
              width: 150,
              render: (_: unknown, log: SecurityAuditLog) => log.actorUsername || log.actorUserId || '-',
            },
            {
              title: t('pages.auditLogs.resource'),
              width: 160,
              render: (_: unknown, log: SecurityAuditLog) => (
                log.resourceType ? `${resourceLabel(log.resourceType)}${log.resourceId ? ` #${log.resourceId}` : ''}` : '-'
              ),
            },
            { title: 'IP', dataIndex: 'ipAddress', width: 130 },
            {
              title: t('pages.auditLogs.message'),
              dataIndex: 'message',
              ellipsis: true,
              render: (value: string, log: SecurityAuditLog) => (
                <Space direction="vertical" size={0}>
                  <span>{messageLabel(value)}</span>
                  {log.metadata ? <Text type="secondary">{log.metadata}</Text> : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
        </>
      ) : null}
    </div>
  );
};

export default SecurityAuditLogManagement;

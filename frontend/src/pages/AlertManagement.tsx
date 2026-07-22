import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopInputNumber from '../components/ShopInputNumber';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, CheckCircleOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { adminApi } from '../api/admin';
import type { SystemAlert, SystemAlertSummary } from '../types';
import { useLanguage } from '../i18n';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { labelTableSelectionCheckbox } from '../utils/tableSelectionAccessibility';
import {
  ALERTS_ACKNOWLEDGE_PERMISSION,
  ALERTS_PURGE_PERMISSION,
  ALERTS_RESOLVE_PERMISSION,
  ALERTS_SELF_CHECK_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './AlertManagement.css';

const { Text, Title } = Typography;

const severityColor = (severity: string) => {
  if (severity === 'CRITICAL') return 'magenta';
  if (severity === 'ERROR') return 'red';
  if (severity === 'WARNING') return 'gold';
  return 'blue';
};

const statusColor = (status: string) => {
  if (status === 'OPEN') return 'red';
  if (status === 'ACKNOWLEDGED') return 'gold';
  return 'green';
};

const statusOptions = ['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

const AlertManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [summary, setSummary] = useState<SystemAlertSummary | null>(null);
  const [status, setStatus] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [category, setCategory] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState<number[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const formatTime = useCallback((value?: string) => value ? new Date(value).toLocaleString(dateLocale) : '-', [dateLocale]);
  const canReadAlerts = hasAdminPermission(adminPermissions, currentRole, 'alerts');
  const canPurgeResolved = hasAdminPermission(adminPermissions, currentRole, ALERTS_PURGE_PERMISSION);
  const canRunSelfCheck = hasAdminPermission(adminPermissions, currentRole, ALERTS_SELF_CHECK_PERMISSION);
  const canAcknowledgeAlerts = hasAdminPermission(adminPermissions, currentRole, ALERTS_ACKNOWLEDGE_PERMISSION);
  const canResolveAlerts = hasAdminPermission(adminPermissions, currentRole, ALERTS_RESOLVE_PERMISSION);
  const alertActionDisabled = loading || Boolean(loadError) || !summary;
  const alertSeverityLabels = useMemo(() => ({
    ALL: t('pages.alertAdmin.severityValues.ALL'),
    CRITICAL: t('pages.alertAdmin.severityValues.CRITICAL'),
    ERROR: t('pages.alertAdmin.severityValues.ERROR'),
    WARNING: t('pages.alertAdmin.severityValues.WARNING'),
    INFO: t('pages.alertAdmin.severityValues.INFO'),
  }), [t]);
  const alertStatusLabels = useMemo(() => ({
    ALL: t('pages.alertAdmin.statusValues.ALL'),
    OPEN: t('pages.alertAdmin.statusValues.OPEN'),
    ACKNOWLEDGED: t('pages.alertAdmin.statusValues.ACKNOWLEDGED'),
    RESOLVED: t('pages.alertAdmin.statusValues.RESOLVED'),
  }), [t]);
  const alertCategoryLabels = useMemo(() => ({
    APPLICATION: t('pages.alertAdmin.categoryValues.APPLICATION'),
    DATABASE: t('pages.alertAdmin.categoryValues.DATABASE'),
    REDIS: t('pages.alertAdmin.categoryValues.REDIS'),
    NETWORK: t('pages.alertAdmin.categoryValues.NETWORK'),
    IO: t('pages.alertAdmin.categoryValues.IO'),
    NULL_POINTER: t('pages.alertAdmin.categoryValues.NULL_POINTER'),
    UPLOAD: t('pages.alertAdmin.categoryValues.UPLOAD'),
    JVM: t('pages.alertAdmin.categoryValues.JVM'),
    DISK: t('pages.alertAdmin.categoryValues.DISK'),
    LOGGING: t('pages.alertAdmin.categoryValues.LOGGING'),
    CONFIG_CENTER: t('pages.alertAdmin.categoryValues.CONFIG_CENTER'),
    CIRCUIT_BREAKER: t('pages.alertAdmin.categoryValues.CIRCUIT_BREAKER'),
    RATE_LIMIT: t('pages.alertAdmin.categoryValues.RATE_LIMIT'),
    SECURITY: t('pages.alertAdmin.categoryValues.SECURITY'),
  }), [t]);
  const alertSourceLabels = useMemo(() => ({
    EXCEPTION: t('pages.alertAdmin.sourceValues.EXCEPTION'),
    SELF_CHECK: t('pages.alertAdmin.sourceValues.SELF_CHECK'),
  }), [t]);
  const alertDisplayLabel = useCallback((alert: Pick<SystemAlert, 'id' | 'title' | 'fingerprint'>) => (
    [alert.title, alert.fingerprint].map((value) => String(value || '').trim()).find(Boolean) || `#${alert.id}`
  ), []);

  const applyStatusFilter = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
    setSelectedAlertIds([]);
  }, []);

  const loadData = useCallback(async () => {
    if (!permissionsLoaded) {
      return;
    }
    if (!canReadAlerts) {
      setAlerts([]);
      setSummary(null);
      setLoadError(null);
      setSelectedAlertIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLoadError(null);
      const [alertResponse, summaryResponse] = await Promise.all([
        adminApi.getAlerts({
          status: status === 'ALL' ? undefined : status,
          severity: severity === 'ALL' ? undefined : severity,
          category: category.trim() || undefined,
          limit: 300,
        }),
        adminApi.getAlertSummary(),
      ]);
      setAlerts(alertResponse.data);
      setSummary(summaryResponse.data);
      setSelectedAlertIds((ids) => ids.filter((id) => alertResponse.data.some((alert) => alert.id === id)));
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.alertAdmin.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [canReadAlerts, category, language, permissionsLoaded, severity, status, t]);

  useEffect(() => {
    if (!permissionsLoaded) {
      return;
    }
    loadData();
  }, [loadData, permissionsLoaded]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
        setPermissionsLoaded(true);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
        setPermissionsLoaded(true);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const runSelfCheck = async () => {
    if (!canRunSelfCheck) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    setActing('self-check');
    try {
      await adminApi.runAlertSelfCheck();
      message.success(t('pages.alertAdmin.selfCheckDone'));
      await loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.selfCheckFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const acknowledge = useCallback(async (alert: SystemAlert) => {
    if (!canAcknowledgeAlerts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    setActing(`ack-${alert.id}`);
    try {
      const response = await adminApi.acknowledgeAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success(t('pages.alertAdmin.acknowledged'));
      loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.ackFailed'), language));
    } finally {
      setActing(null);
    }
  }, [alertActionDisabled, canAcknowledgeAlerts, language, loadData, loadError, t]);

  const resolve = useCallback(async (alert: SystemAlert) => {
    if (!canResolveAlerts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    setActing(`resolve-${alert.id}`);
    try {
      const response = await adminApi.resolveAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success(t('pages.alertAdmin.resolved'));
      loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.resolveFailed'), language));
    } finally {
      setActing(null);
    }
  }, [alertActionDisabled, canResolveAlerts, language, loadData, loadError, t]);

  const selectedAlerts = useMemo(
    () => alerts.filter((alert) => selectedAlertIds.includes(alert.id)),
    [alerts, selectedAlertIds]
  );
  const selectedOpenIds = useMemo(
    () => selectedAlerts.filter((alert) => alert.status === 'OPEN').map((alert) => alert.id),
    [selectedAlerts]
  );
  const selectedUnresolvedIds = useMemo(
    () => selectedAlerts.filter((alert) => alert.status !== 'RESOLVED').map((alert) => alert.id),
    [selectedAlerts]
  );

  const batchAcknowledge = async () => {
    if (!canAcknowledgeAlerts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    if (!selectedOpenIds.length) {
      message.warning(t('pages.alertAdmin.selectOpenFirst'));
      return;
    }
    setActing('batch-ack');
    try {
      const response = await adminApi.acknowledgeAlerts(selectedOpenIds, t('pages.alertAdmin.batchAckReason'));
      message.success(t('pages.alertAdmin.batchAckDone', { count: response.data.updatedCount }));
      setSelectedAlertIds([]);
      await loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.batchAckFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const batchResolve = async () => {
    if (!canResolveAlerts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    if (!selectedUnresolvedIds.length) {
      message.warning(t('pages.alertAdmin.selectUnresolvedFirst'));
      return;
    }
    setActing('batch-resolve');
    try {
      const response = await adminApi.resolveAlerts(selectedUnresolvedIds, t('pages.alertAdmin.batchResolveReason'));
      message.success(t('pages.alertAdmin.batchResolveDone', { count: response.data.updatedCount }));
      setSelectedAlertIds([]);
      await loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.batchResolveFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const purgeResolved = async () => {
    if (!canPurgeResolved) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (alertActionDisabled) {
      message.warning(loadError || t('pages.alertAdmin.loadFailed'));
      return;
    }
    setActing('purge-resolved');
    try {
      const response = await adminApi.purgeResolvedAlerts(retentionDays);
      message.success(t('pages.alertAdmin.purgeDone', { count: response.data.deletedCount }));
      await loadData();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.purgeFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const columns: ColumnsType<SystemAlert> = useMemo(() => [
    {
      title: t('pages.alertAdmin.alert'),
      dataIndex: 'title',
      key: 'title',
      width: 320,
      className: 'alert-management__alertColumn',
      render: (_, record) => (
        <div className="alert-management__titleCell">
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.message || record.fingerprint}</Text>
        </div>
      ),
    },
    {
      title: t('pages.alertAdmin.severity'),
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (value: string) => <Tag color={severityColor(value)}>{alertSeverityLabels[value as keyof typeof alertSeverityLabels] || value}</Tag>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value: string) => <Tag color={statusColor(value)}>{alertStatusLabels[value as keyof typeof alertStatusLabels] || value}</Tag>,
    },
    {
      title: t('pages.alertAdmin.category'),
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (value: string) => <Tag>{alertCategoryLabels[value as keyof typeof alertCategoryLabels] || value}</Tag>,
    },
    {
      title: t('pages.alertAdmin.count'),
      dataIndex: 'occurrenceCount',
      key: 'occurrenceCount',
      width: 80,
    },
    {
      title: t('pages.alertAdmin.lastSeen'),
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      width: 190,
      render: formatTime,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 180,
      render: (_, record) => {
        const alertLabel = alertDisplayLabel(record);
        const ackActionLabel = `${t('pages.alertAdmin.ack')}: ${alertLabel}`;
        const resolveActionLabel = `${t('pages.alertAdmin.resolve')}: ${alertLabel}`;
        return (
          <Space wrap>
	            {record.status === 'OPEN' && canAcknowledgeAlerts ? (
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={`${t('pages.alertAdmin.ackConfirm')} ${alertLabel}`}
                description={record.fingerprint && record.fingerprint !== alertLabel ? record.fingerprint : undefined}
                onConfirm={() => acknowledge(record)}
                disabled={alertActionDisabled}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': ackActionLabel, title: ackActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${ackActionLabel}`, title: `${t('common.cancel')}: ${ackActionLabel}` }}
              >
                <Button size="small" aria-label={ackActionLabel} title={ackActionLabel} loading={acting === `ack-${record.id}`} disabled={alertActionDisabled}>
                  {t('pages.alertAdmin.ack')}
                </Button>
              </ShopPopconfirm>
            ) : null}
	            {record.status !== 'RESOLVED' && canResolveAlerts ? (
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={`${t('pages.alertAdmin.resolveConfirm')} ${alertLabel}`}
                description={record.fingerprint && record.fingerprint !== alertLabel ? record.fingerprint : undefined}
                onConfirm={() => resolve(record)}
                disabled={alertActionDisabled}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': resolveActionLabel, title: resolveActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${resolveActionLabel}`, title: `${t('common.cancel')}: ${resolveActionLabel}` }}
              >
                <Button size="small" type="primary" aria-label={resolveActionLabel} title={resolveActionLabel} loading={acting === `resolve-${record.id}`} disabled={alertActionDisabled}>
                  {t('pages.alertAdmin.resolve')}
                </Button>
              </ShopPopconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ], [acknowledge, acting, alertActionDisabled, alertCategoryLabels, alertDisplayLabel, alertSeverityLabels, alertStatusLabels, canAcknowledgeAlerts, canResolveAlerts, formatTime, resolve, t]);

  const openAlertCount = summary?.openCount || 0;
  const acknowledgedAlertCount = summary?.acknowledgedCount || 0;
  const resolvedAlertCount = summary?.resolvedCount || 0;
  const allAlertCount = openAlertCount + acknowledgedAlertCount + resolvedAlertCount;
  const allAlertsFilterLabel = `${t('pages.alertAdmin.showAll')}: ${allAlertCount}`;
  const openAlertsFilterLabel = `${t('pages.alertAdmin.showOpen')}: ${openAlertCount}`;
  const acknowledgedAlertsFilterLabel = `${t('pages.alertAdmin.showAcknowledged')}: ${acknowledgedAlertCount}`;
  const resolvedAlertsFilterLabel = `${t('pages.alertAdmin.showResolved')}: ${resolvedAlertCount}`;
  const currentStatusLabel = alertStatusLabels[status as keyof typeof alertStatusLabels] || status;
  const currentSeverityLabel = alertSeverityLabels[severity as keyof typeof alertSeverityLabels] || severity;
  const currentCategoryLabel = category.trim() || alertStatusLabels.ALL;
  const currentStatusFilterLabel = `${t('common.status')}: ${currentStatusLabel}`;
  const currentSeverityFilterLabel = `${t('pages.alertAdmin.severity')}: ${currentSeverityLabel}`;
  const currentCategoryFilterLabel = `${t('pages.alertAdmin.category')}: ${currentCategoryLabel}`;
  const activeAlertFilterLabel = `${currentStatusFilterLabel}, ${currentSeverityFilterLabel}, ${currentCategoryFilterLabel}`;
  const refreshAlertsActionLabel = `${t('common.refresh')}: ${t('pages.alertAdmin.title')}, ${activeAlertFilterLabel}`;
  const selfCheckActionLabel = `${t('pages.alertAdmin.selfCheck')}: ${t('pages.alertAdmin.title')}`;
  const statusFilterGroupLabel = `${t('common.status')}: ${t('pages.alertAdmin.title')}, ${currentStatusLabel}`;
  const severityFilterGroupLabel = `${t('pages.alertAdmin.severity')}: ${t('pages.alertAdmin.title')}, ${currentSeverityLabel}`;
  const categoryFilterInputLabel = `${t('pages.alertAdmin.category')}: ${t('pages.alertAdmin.title')}, ${currentCategoryLabel}`;
  const applyAlertFilterActionLabel = `${t('pages.alertAdmin.filter')}: ${activeAlertFilterLabel}`;
  const selectAllVisibleAlertsLabel = t('pages.alertAdmin.selectAllVisibleAlerts');
  const selectedAlertSummaryLabel = t('pages.alertAdmin.selectedSummary', { selected: selectedAlertIds.length, open: selectedOpenIds.length, unresolved: selectedUnresolvedIds.length });
  const batchAckActionLabel = `${t('pages.alertAdmin.batchAck')}: ${selectedOpenIds.length}`;
  const batchResolveActionLabel = `${t('pages.alertAdmin.batchResolve')}: ${selectedUnresolvedIds.length}`;
  const purgeRetentionInputLabel = `${t('pages.alertAdmin.purgeRetention')}: ${retentionDays} ${t('pages.alertAdmin.days')}`;
  const purgeResolvedActionLabel = `${t('pages.alertAdmin.purge')}: ${retentionDays} ${t('pages.alertAdmin.days')}`;

  return (
    <div className="alert-management">
      <div className="alert-management__hero">
        <div>
          <Text className="alert-management__eyebrow">{t('pages.alertAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.alertAdmin.title')}</Title>
          <Text type="secondary">{t('pages.alertAdmin.description')}</Text>
        </div>
        <Space className="alert-management__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} disabled={!permissionsLoaded || !canReadAlerts} aria-label={refreshAlertsActionLabel} title={refreshAlertsActionLabel} onClick={loadData}>
            {t('common.refresh')}
          </Button>
          {canRunSelfCheck ? (
            <Button type="primary" icon={<ToolOutlined />} loading={acting === 'self-check'} disabled={alertActionDisabled} aria-label={selfCheckActionLabel} title={selfCheckActionLabel} onClick={runSelfCheck}>
              {t('pages.alertAdmin.selfCheck')}
            </Button>
          ) : null}
        </Space>
      </div>

      {permissionsLoaded && !canReadAlerts ? (
        <Alert
          type="warning"
          showIcon
          message={t('adminLayout.noPermission')}
          description={t('pages.alertAdmin.noReadPermission')}
          className="alert-management__permissionNotice"
        />
      ) : (
      <div
        role="status"
        aria-live="polite"
        aria-busy={(!permissionsLoaded || loading) && alerts.length === 0}
        aria-label={t('common.loading')}
      >
        <Spin
          spinning={(!permissionsLoaded || loading) && alerts.length === 0}
        >
        {loadError && (summary || alerts.length > 0) ? (
          <Alert
            className="alert-management__alert"
            type="warning"
            showIcon
            message={loadError}
            description={t('pages.alertAdmin.staleDataWarning')}
            action={(
              <Space wrap data-admin-alerts-stale-recovery="true">
                <Button size="small" type="primary" onClick={loadData} loading={loading}>
                  {t('common.retry')}
                </Button>
                <Button size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</Button>
                <Button size="small" onClick={() => navigate('/admin/system')}>{t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}</Button>
                <Button size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</Button>
              </Space>
            )}
          />
        ) : null}

        {loadError && !(summary || alerts.length > 0) ? (
          <div className="alert-management__error" data-admin-alerts-load-recovery="true">
            <PageError
              title={t('pages.alertAdmin.loadFailed')}
              description={loadError}
              actions={[
                { key: 'retry', label: t('common.retry'), onClick: () => { void loadData(); }, type: 'primary' },
                { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
                { key: 'system', label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'), onClick: () => navigate('/admin/system'), type: 'default' },
                { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
              ]}
            />
          </div>
        ) : null}

        {loadError && !summary && alerts.length === 0 ? null : (
          <>
        <div className="alert-management__stats">
          <Card
            className={`alert-management__statCard${status === 'OPEN' ? ' is-active' : ''}`}
            hoverable
            role="button"
            tabIndex={0}
            aria-pressed={status === 'OPEN'}
            aria-label={`${t('pages.alertAdmin.open')}: ${summary?.openCount || 0}`}
            onClick={() => applyStatusFilter('OPEN')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                applyStatusFilter('OPEN');
              }
            }}
          >
            <Statistic title={t('pages.alertAdmin.open')} value={summary?.openCount || 0} prefix={<AlertOutlined />} valueStyle={{ color: (summary?.openCount || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card
            className={`alert-management__statCard${status === 'ACKNOWLEDGED' ? ' is-active' : ''}`}
            hoverable
            role="button"
            tabIndex={0}
            aria-pressed={status === 'ACKNOWLEDGED'}
            aria-label={`${t('pages.alertAdmin.acknowledgedStat')}: ${summary?.acknowledgedCount || 0}`}
            onClick={() => applyStatusFilter('ACKNOWLEDGED')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                applyStatusFilter('ACKNOWLEDGED');
              }
            }}
          >
            <Statistic title={t('pages.alertAdmin.acknowledgedStat')} value={summary?.acknowledgedCount || 0} />
          </Card>
          <Card
            className={`alert-management__statCard${status === 'RESOLVED' ? ' is-active' : ''}`}
            hoverable
            role="button"
            tabIndex={0}
            aria-pressed={status === 'RESOLVED'}
            aria-label={`${t('pages.alertAdmin.resolvedStat')}: ${summary?.resolvedCount || 0}`}
            onClick={() => applyStatusFilter('RESOLVED')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                applyStatusFilter('RESOLVED');
              }
            }}
          >
            <Statistic title={t('pages.alertAdmin.resolvedStat')} value={summary?.resolvedCount || 0} prefix={<CheckCircleOutlined />} />
          </Card>
          <Card>
            <Statistic title={t('pages.alertAdmin.criticalErrors')} value={(summary?.openBySeverity?.CRITICAL || 0) + (summary?.openBySeverity?.ERROR || 0)} />
          </Card>
        </div>

        <Alert
          className="alert-management__alert"
          type="info"
          showIcon
          message={t('pages.alertAdmin.info')}
        />

        <Card className="alert-management__card">
          <Space className="alert-management__filters" wrap>
            <div role="group" aria-label={statusFilterGroupLabel} title={statusFilterGroupLabel}>
              <ShopSelect
                value={status}
                onChange={(value) => { if (value) applyStatusFilter(value); }} popupClassName="shop-mobile-popup-layer"
                options={statusOptions.map((value) => ({ value, label: alertStatusLabels[value as keyof typeof alertStatusLabels] || value }))}
              />
            </div>
            <div role="group" aria-label={severityFilterGroupLabel} title={severityFilterGroupLabel}>
              <ShopSelect
                value={severity}
                onChange={(value) => setSeverity(value || 'ALL')} popupClassName="shop-mobile-popup-layer"
                options={['ALL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((value) => ({ value, label: alertSeverityLabels[value as keyof typeof alertSeverityLabels] || value }))}
              />
            </div>
            <ShopInput
              allowClear
              prefix={<SearchOutlined />}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void loadData(); } }}
              placeholder={t('pages.alertAdmin.category')}
              aria-label={categoryFilterInputLabel}
              title={categoryFilterInputLabel}
            />
            <Button onClick={loadData} aria-label={applyAlertFilterActionLabel} title={applyAlertFilterActionLabel}>{t('pages.alertAdmin.filter')}</Button>
          </Space>

          <div className="alert-management__bulkBar">
            <Space wrap>
              <Text type="secondary">
                {selectedAlertSummaryLabel}
              </Text>
              {canAcknowledgeAlerts ? (
                <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                  title={t('pages.alertAdmin.batchAckConfirm', { count: selectedOpenIds.length })}
                  onConfirm={batchAcknowledge}
                  disabled={!selectedOpenIds.length || alertActionDisabled}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ 'aria-label': batchAckActionLabel, title: batchAckActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchAckActionLabel}`, title: `${t('common.cancel')}: ${batchAckActionLabel}` }}
                >
                  <Button
                    disabled={!selectedOpenIds.length || alertActionDisabled}
                    loading={acting === 'batch-ack'}
                    aria-label={batchAckActionLabel}
                    title={batchAckActionLabel}
                  >
                    {t('pages.alertAdmin.batchAck')}
                  </Button>
                </ShopPopconfirm>
              ) : null}
              {canResolveAlerts ? (
                <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                  title={t('pages.alertAdmin.batchResolveConfirm', { count: selectedUnresolvedIds.length })}
                  onConfirm={batchResolve}
                  disabled={!selectedUnresolvedIds.length || alertActionDisabled}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ 'aria-label': batchResolveActionLabel, title: batchResolveActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${batchResolveActionLabel}`, title: `${t('common.cancel')}: ${batchResolveActionLabel}` }}
                >
                  <Button
                    type="primary"
                    disabled={!selectedUnresolvedIds.length || alertActionDisabled}
                    loading={acting === 'batch-resolve'}
                    aria-label={batchResolveActionLabel}
                    title={batchResolveActionLabel}
                  >
                    {t('pages.alertAdmin.batchResolve')}
                  </Button>
                </ShopPopconfirm>
              ) : null}
            </Space>
            {canPurgeResolved ? (
              <Space wrap className="alert-management__purge">
                <Text type="secondary">{t('pages.alertAdmin.purgeRetention')}</Text>
                <ShopInputNumber
                  min={1}
                  max={3650}
                  precision={0}
                  value={retentionDays}
                  onChange={(value) => setRetentionDays(Number(value || 30))}
                  addonAfter={t('pages.alertAdmin.days')}
                  aria-label={purgeRetentionInputLabel}
                  title={purgeRetentionInputLabel}
                />
                <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                  title={t('pages.alertAdmin.purgeConfirm')}
                  description={t('pages.alertAdmin.purgeDescription', { days: retentionDays })}
                  onConfirm={purgeResolved}
                  disabled={alertActionDisabled}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': purgeResolvedActionLabel, title: purgeResolvedActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${purgeResolvedActionLabel}`, title: `${t('common.cancel')}: ${purgeResolvedActionLabel}` }}
                >
                  <Button icon={<DeleteOutlined />} loading={acting === 'purge-resolved'} disabled={alertActionDisabled} aria-label={purgeResolvedActionLabel} title={purgeResolvedActionLabel}>
                    {t('pages.alertAdmin.purge')}
                  </Button>
                </ShopPopconfirm>
              </Space>
            ) : null}
          </div>

          {alerts.length ? (
            <Table<SystemAlert>
              className="shop-admin-selection-table alert-management__table"
              rowKey="id"
              columns={columns}
              dataSource={alerts}
              rowSelection={canAcknowledgeAlerts || canResolveAlerts ? {
                columnWidth: 56,
                columnTitle: (checkboxNode) => labelTableSelectionCheckbox(checkboxNode, selectAllVisibleAlertsLabel),
                selectedRowKeys: selectedAlertIds,
                onChange: (keys) => setSelectedAlertIds(keys.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
                getCheckboxProps: (record) => {
                  const selectionLabel = t('pages.alertAdmin.selectAlertRow', { alert: alertDisplayLabel(record) });
                  return {
                    disabled: record.status === 'RESOLVED' || (!canResolveAlerts && record.status !== 'OPEN'),
                    'aria-label': selectionLabel,
                    title: selectionLabel,
                  };
                },
              } : undefined}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1180 }}
              expandable={{
                expandedRowRender: (record) => (
                  <div className="alert-management__expanded">
                    <span>{t('pages.alertAdmin.source')}: {alertSourceLabels[record.source as keyof typeof alertSourceLabels] || record.source}</span>
                    <span>{t('pages.alertAdmin.firstSeen')}: {formatTime(record.firstSeenAt)}</span>
                    <span>{t('pages.alertAdmin.acknowledgedBy')}: {record.acknowledgedBy || '-'}</span>
                    <span>{t('pages.alertAdmin.resolvedBy')}: {record.resolvedBy || '-'}</span>
                    <span>{t('pages.alertAdmin.fingerprint')}: {record.fingerprint}</span>
                    <span>{t('pages.alertAdmin.metadata')}: {record.metadata || '-'}</span>
                  </div>
                ),
              }}
            />
          ) : (
            <Empty
              description={(
                <Space direction="vertical" size={8}>
                  <Text>{t('pages.alertAdmin.empty')}</Text>
                  <Text type="secondary">{t('pages.alertAdmin.emptyFiltered')}</Text>
                  <Space wrap>
                    <Button
                      size="small"
                      type={status === 'ALL' ? 'primary' : 'default'}
                      aria-pressed={status === 'ALL'}
                      aria-label={allAlertsFilterLabel}
                      title={allAlertsFilterLabel}
                      onClick={() => applyStatusFilter('ALL')}
                    >
                      {t('pages.alertAdmin.showAll')}
                    </Button>
                    <Button
                      size="small"
                      type={status === 'OPEN' ? 'primary' : 'default'}
                      aria-pressed={status === 'OPEN'}
                      aria-label={openAlertsFilterLabel}
                      title={openAlertsFilterLabel}
                      onClick={() => applyStatusFilter('OPEN')}
                    >
                      {t('pages.alertAdmin.showOpen')}
                    </Button>
                    <Button
                      size="small"
                      type={status === 'ACKNOWLEDGED' ? 'primary' : 'default'}
                      aria-pressed={status === 'ACKNOWLEDGED'}
                      aria-label={acknowledgedAlertsFilterLabel}
                      title={acknowledgedAlertsFilterLabel}
                      onClick={() => applyStatusFilter('ACKNOWLEDGED')}
                    >
                      {t('pages.alertAdmin.showAcknowledged')}
                    </Button>
                    <Button
                      size="small"
                      type={status === 'RESOLVED' ? 'primary' : 'default'}
                      aria-pressed={status === 'RESOLVED'}
                      aria-label={resolvedAlertsFilterLabel}
                      title={resolvedAlertsFilterLabel}
                      onClick={() => applyStatusFilter('RESOLVED')}
                    >
                      {t('pages.alertAdmin.showResolved')}
                    </Button>
                  </Space>
                </Space>
              )}
            />
          )}
        </Card>
          </>
        )}
        </Spin>
      </div>
      )}
    </div>
  );
};

export default AlertManagement;

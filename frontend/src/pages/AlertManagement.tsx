import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, InputNumber, Popconfirm, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { AlertOutlined, CheckCircleOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { SystemAlert, SystemAlertSummary } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
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
  const [acting, setActing] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const formatTime = useCallback((value?: string) => value ? new Date(value).toLocaleString(dateLocale) : '-', [dateLocale]);
  const canPurgeResolved = hasAdminPermission(adminPermissions, currentRole, ALERTS_PURGE_PERMISSION);
  const canRunSelfCheck = hasAdminPermission(adminPermissions, currentRole, ALERTS_SELF_CHECK_PERMISSION);
  const canAcknowledgeAlerts = hasAdminPermission(adminPermissions, currentRole, ALERTS_ACKNOWLEDGE_PERMISSION);
  const canResolveAlerts = hasAdminPermission(adminPermissions, currentRole, ALERTS_RESOLVE_PERMISSION);
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

  const applyStatusFilter = useCallback((nextStatus: string) => {
    setStatus(nextStatus);
    setSelectedAlertIds([]);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [category, language, severity, status, t]);

  useEffect(() => {
    loadData();
  }, [language, loadData, t]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
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

  const runSelfCheck = async () => {
    if (!canRunSelfCheck) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setActing('self-check');
    try {
      await adminApi.runAlertSelfCheck();
      message.success(t('pages.alertAdmin.selfCheckDone'));
      await loadData();
    } catch (error: any) {
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
    setActing(`ack-${alert.id}`);
    try {
      const response = await adminApi.acknowledgeAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success(t('pages.alertAdmin.acknowledged'));
      loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.ackFailed'), language));
    } finally {
      setActing(null);
    }
  }, [canAcknowledgeAlerts, language, loadData, t]);

  const resolve = useCallback(async (alert: SystemAlert) => {
    if (!canResolveAlerts) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setActing(`resolve-${alert.id}`);
    try {
      const response = await adminApi.resolveAlert(alert.id);
      setAlerts((items) => items.map((item) => item.id === alert.id ? response.data : item));
      message.success(t('pages.alertAdmin.resolved'));
      loadData();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.alertAdmin.resolveFailed'), language));
    } finally {
      setActing(null);
    }
  }, [canResolveAlerts, language, loadData, t]);

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
    } catch (error: any) {
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
    } catch (error: any) {
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
    setActing('purge-resolved');
    try {
      const response = await adminApi.purgeResolvedAlerts(retentionDays);
      message.success(t('pages.alertAdmin.purgeDone', { count: response.data.deletedCount }));
      await loadData();
    } catch (error: any) {
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
      render: (_, record) => (
        <Space wrap>
          {record.status === 'OPEN' && canAcknowledgeAlerts ? (
            <Popconfirm
              title={t('pages.alertAdmin.ackConfirm')}
              onConfirm={() => acknowledge(record)}
            >
              <Button size="small" loading={acting === `ack-${record.id}`}>
                {t('pages.alertAdmin.ack')}
              </Button>
            </Popconfirm>
          ) : null}
          {record.status !== 'RESOLVED' && canResolveAlerts ? (
            <Popconfirm
              title={t('pages.alertAdmin.resolveConfirm')}
              onConfirm={() => resolve(record)}
            >
              <Button size="small" type="primary" loading={acting === `resolve-${record.id}`}>
                {t('pages.alertAdmin.resolve')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ], [acknowledge, acting, alertCategoryLabels, alertSeverityLabels, alertStatusLabels, canAcknowledgeAlerts, canResolveAlerts, formatTime, resolve, t]);

  return (
    <div className="alert-management">
      <div className="alert-management__hero">
        <div>
          <Text className="alert-management__eyebrow">{t('pages.alertAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.alertAdmin.title')}</Title>
          <Text type="secondary">{t('pages.alertAdmin.description')}</Text>
        </div>
        <Space className="alert-management__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            {t('common.refresh')}
          </Button>
          {canRunSelfCheck ? (
            <Button type="primary" icon={<ToolOutlined />} loading={acting === 'self-check'} onClick={runSelfCheck}>
              {t('pages.alertAdmin.selfCheck')}
            </Button>
          ) : null}
        </Space>
      </div>

      <Spin spinning={loading && alerts.length === 0}>
        <div className="alert-management__stats">
          <Card
            className={`alert-management__statCard${status === 'OPEN' ? ' is-active' : ''}`}
            hoverable
            tabIndex={0}
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
            tabIndex={0}
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
            tabIndex={0}
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
            <Select
              value={status}
              onChange={applyStatusFilter}
              popupClassName="shop-mobile-popup-layer"
              getPopupContainer={() => document.body}
              options={statusOptions.map((value) => ({ value, label: alertStatusLabels[value as keyof typeof alertStatusLabels] || value }))}
            />
            <Select
              value={severity}
              onChange={setSeverity}
              popupClassName="shop-mobile-popup-layer"
              getPopupContainer={() => document.body}
              options={['ALL', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((value) => ({ value, label: alertSeverityLabels[value as keyof typeof alertSeverityLabels] || value }))}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              onPressEnter={loadData}
              placeholder={t('pages.alertAdmin.category')}
            />
            <Button onClick={loadData}>{t('pages.alertAdmin.filter')}</Button>
          </Space>

          <div className="alert-management__bulkBar">
            <Space wrap>
              <Text type="secondary">
                {t('pages.alertAdmin.selectedSummary', { selected: selectedAlertIds.length, open: selectedOpenIds.length, unresolved: selectedUnresolvedIds.length })}
              </Text>
              {canAcknowledgeAlerts ? (
                <Popconfirm
                  title={t('pages.alertAdmin.batchAckConfirm', { count: selectedOpenIds.length })}
                  onConfirm={batchAcknowledge}
                  disabled={!selectedOpenIds.length}
                >
                  <Button
                    disabled={!selectedOpenIds.length}
                    loading={acting === 'batch-ack'}
                  >
                    {t('pages.alertAdmin.batchAck')}
                  </Button>
                </Popconfirm>
              ) : null}
              {canResolveAlerts ? (
                <Popconfirm
                  title={t('pages.alertAdmin.batchResolveConfirm', { count: selectedUnresolvedIds.length })}
                  onConfirm={batchResolve}
                  disabled={!selectedUnresolvedIds.length}
                >
                  <Button
                    type="primary"
                    disabled={!selectedUnresolvedIds.length}
                    loading={acting === 'batch-resolve'}
                  >
                    {t('pages.alertAdmin.batchResolve')}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
            {canPurgeResolved ? (
              <Space wrap className="alert-management__purge">
                <Text type="secondary">{t('pages.alertAdmin.purgeRetention')}</Text>
                <InputNumber
                  min={1}
                  max={3650}
                  precision={0}
                  value={retentionDays}
                  onChange={(value) => setRetentionDays(Number(value || 30))}
                  addonAfter={t('pages.alertAdmin.days')}
                />
                <Popconfirm
                  title={t('pages.alertAdmin.purgeConfirm')}
                  description={t('pages.alertAdmin.purgeDescription', { days: retentionDays })}
                  onConfirm={purgeResolved}
                >
                  <Button icon={<DeleteOutlined />} loading={acting === 'purge-resolved'}>
                    {t('pages.alertAdmin.purge')}
                  </Button>
                </Popconfirm>
              </Space>
            ) : null}
          </div>

          {alerts.length ? (
            <Table<SystemAlert>
              rowKey="id"
              columns={columns}
              dataSource={alerts}
              rowSelection={canAcknowledgeAlerts || canResolveAlerts ? {
                selectedRowKeys: selectedAlertIds,
                onChange: (keys) => setSelectedAlertIds(keys.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
                getCheckboxProps: (record) => ({
                  disabled: record.status === 'RESOLVED' || (!canResolveAlerts && record.status !== 'OPEN'),
                }),
              } : undefined}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 980 }}
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
                    <Button size="small" onClick={() => applyStatusFilter('ALL')}>
                      {t('pages.alertAdmin.showAll')}
                    </Button>
                    <Button size="small" onClick={() => applyStatusFilter('OPEN')}>
                      {t('pages.alertAdmin.showOpen')}
                    </Button>
                    <Button size="small" onClick={() => applyStatusFilter('ACKNOWLEDGED')}>
                      {t('pages.alertAdmin.showAcknowledged')}
                    </Button>
                    <Button size="small" onClick={() => applyStatusFilter('RESOLVED')}>
                      {t('pages.alertAdmin.showResolved')}
                    </Button>
                  </Space>
                </Space>
              )}
            />
          )}
        </Card>
      </Spin>
    </div>
  );
};

export default AlertManagement;

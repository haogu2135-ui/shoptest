import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Popconfirm, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClearOutlined, DashboardOutlined, ReloadOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminTrafficControlStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import {
  TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION,
  TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import './TrafficControl.css';

const { Text, Title } = Typography;
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };

type CircuitRow = AdminTrafficControlStatus['circuits'][number];

const stateColor = (state: string) => {
  if (state === 'OPEN') return 'red';
  if (state === 'HALF_OPEN') return 'gold';
  return 'green';
};

const TrafficControl: React.FC = () => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [status, setStatus] = useState<AdminTrafficControlStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const canClearRateLimit = hasAdminPermission(adminPermissions, currentRole, TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION);
  const canResetCircuit = hasAdminPermission(adminPermissions, currentRole, TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION);
  const actionDisabled = !status || loading || Boolean(loadError);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const response = await adminApi.getTrafficControlStatus();
      setStatus(response.data);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.trafficControl.loadFailed'), language);
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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

  const resetCircuit = useCallback(async (name?: string) => {
    if (!canResetCircuit) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setActing(name || 'all');
    try {
      const response = await adminApi.resetCircuitBreaker(name);
      setLoadError(null);
      setStatus(response.data);
      message.success(name ? t('pages.trafficControl.circuitReset') : t('pages.trafficControl.allCircuitsReset'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.trafficControl.circuitResetFailed'), language));
    } finally {
      setActing(null);
    }
  }, [canResetCircuit, language, t]);

  const clearRateLimit = async () => {
    if (!canClearRateLimit) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setActing('rate-limit');
    try {
      const response = await adminApi.clearRateLimitCounters();
      setLoadError(null);
      setStatus(response.data);
      message.success(t('pages.trafficControl.rateLimitCleared'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.trafficControl.rateLimitClearFailed'), language));
    } finally {
      setActing(null);
    }
  };
  const circuitStateLabels = useMemo(() => ({
    OPEN: t('pages.trafficControl.circuitStates.OPEN'),
    HALF_OPEN: t('pages.trafficControl.circuitStates.HALF_OPEN'),
    CLOSED: t('pages.trafficControl.circuitStates.CLOSED'),
  }), [t]);

  const columns: ColumnsType<CircuitRow> = useMemo(() => {
    const baseColumns: ColumnsType<CircuitRow> = [
      {
        title: t('pages.trafficControl.name'),
        dataIndex: 'name',
        key: 'name',
        render: (value: string) => <Text strong>{value}</Text>,
      },
      {
        title: t('common.status'),
        dataIndex: 'state',
        key: 'state',
        width: 120,
        render: (value: string) => <Tag color={stateColor(value)}>{circuitStateLabels[value as keyof typeof circuitStateLabels] || value}</Tag>,
      },
      {
        title: t('pages.trafficControl.failures'),
        dataIndex: 'failureCount',
        key: 'failureCount',
        width: 90,
      },
      {
        title: t('pages.trafficControl.halfOpenSuccess'),
        dataIndex: 'halfOpenSuccessCount',
        key: 'halfOpenSuccessCount',
        width: 110,
      },
      {
        title: t('pages.trafficControl.openedUntil'),
        dataIndex: 'openedUntil',
        key: 'openedUntil',
        render: (value?: string) => value ? new Date(value).toLocaleString(dateLocale) : '-',
      },
      {
        title: t('pages.trafficControl.lastFailure'),
        dataIndex: 'lastFailureMessage',
        key: 'lastFailureMessage',
        render: (value?: string) => value || '-',
      },
    ];

    if (canResetCircuit) {
      baseColumns.push({
        title: t('common.actions'),
        key: 'action',
        width: 110,
        render: (_, row) => {
          const resetActionLabel = `${t('pages.trafficControl.reset')}: ${row.name}`;
          return (
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={`${t('pages.trafficControl.reset')} ${row.name}?`}
              description={t('pages.trafficControl.resetCircuitConfirmDescription')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ 'aria-label': resetActionLabel, title: resetActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${resetActionLabel}`, title: `${t('common.cancel')}: ${resetActionLabel}` }}
              onConfirm={() => resetCircuit(row.name)}
              disabled={actionDisabled}
            >
              <Button
                size="small"
                icon={<UndoOutlined />}
                aria-label={resetActionLabel}
                title={resetActionLabel}
                loading={acting === row.name}
                disabled={actionDisabled}
              >
                {t('pages.trafficControl.reset')}
              </Button>
            </Popconfirm>
          );
        },
      });
    }

    return baseColumns;
  }, [acting, actionDisabled, canResetCircuit, circuitStateLabels, dateLocale, resetCircuit, t]);

  const rateLimit = status?.rateLimit;
  const circuitConfig = status?.circuitBreakerConfig;
  const refreshTrafficActionLabel = `${t('common.refresh')}: ${t('pages.trafficControl.title')}`;
  const clearRateLimitActionLabel = `${t('pages.trafficControl.clearRateLimit')}: ${t('pages.trafficControl.activeBuckets')} ${rateLimit?.activeBuckets || 0}`;
  const resetAllCircuitsActionLabel = `${t('pages.trafficControl.resetAllCircuits')}: ${t('pages.trafficControl.circuitBreakers')} ${status?.circuits?.length || 0}`;

  return (
    <div className="traffic-control">
      <div className="traffic-control__hero">
        <div>
          <Text className="traffic-control__eyebrow">{t('pages.trafficControl.eyebrow')}</Text>
          <Title level={2}>{t('pages.trafficControl.title')}</Title>
          <Text type="secondary">{t('pages.trafficControl.description')}</Text>
        </div>
        <Space className="traffic-control__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} aria-label={refreshTrafficActionLabel} title={refreshTrafficActionLabel} onClick={loadStatus}>
            {t('common.refresh')}
          </Button>
          {canClearRateLimit ? (
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={`${t('pages.trafficControl.clearRateLimit')}?`}
              description={t('pages.trafficControl.clearRateLimitConfirmDescription')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, 'aria-label': clearRateLimitActionLabel, title: clearRateLimitActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${clearRateLimitActionLabel}`, title: `${t('common.cancel')}: ${clearRateLimitActionLabel}` }}
              onConfirm={clearRateLimit}
              disabled={actionDisabled}
            >
              <Button icon={<ClearOutlined />} loading={acting === 'rate-limit'} disabled={actionDisabled} aria-label={clearRateLimitActionLabel} title={clearRateLimitActionLabel}>
                {t('pages.trafficControl.clearRateLimit')}
              </Button>
            </Popconfirm>
          ) : null}
          {canResetCircuit ? (
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={`${t('pages.trafficControl.resetAllCircuits')}?`}
              description={t('pages.trafficControl.resetAllCircuitsConfirmDescription')}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ 'aria-label': resetAllCircuitsActionLabel, title: resetAllCircuitsActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${resetAllCircuitsActionLabel}`, title: `${t('common.cancel')}: ${resetAllCircuitsActionLabel}` }}
              onConfirm={() => resetCircuit()}
              disabled={actionDisabled}
            >
              <Button type="primary" icon={<UndoOutlined />} loading={acting === 'all'} disabled={actionDisabled} aria-label={resetAllCircuitsActionLabel} title={resetAllCircuitsActionLabel}>
                {t('pages.trafficControl.resetAllCircuits')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      </div>

      {loadError ? (
        <Alert
          className="traffic-control__alert"
          type="warning"
          showIcon
          message={loadError}
          description={status ? t('pages.trafficControl.staleDataWarning') : undefined}
          action={(
            <Button size="small" onClick={loadStatus} loading={loading}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-busy={loading && !status}
        aria-label={t('common.loading')}
      >
        <Spin
          spinning={loading && !status}
        >
        {loadError && !status ? null : <div className="traffic-control__stats">
          <Card>
            <Statistic title={t('pages.trafficControl.rateLimitStatus')} value={rateLimit?.enabled ? t('pages.trafficControl.enabled') : t('pages.trafficControl.disabled')} prefix={<DashboardOutlined />} />
          </Card>
          <Card>
            <Statistic title={t('pages.trafficControl.accepted')} value={rateLimit?.acceptedRequests || 0} />
          </Card>
          <Card>
            <Statistic title={t('pages.trafficControl.rejected')} value={rateLimit?.rejectedRequests || 0} valueStyle={{ color: (rateLimit?.rejectedRequests || 0) > 0 ? '#c2410c' : '#1f8a4c' }} />
          </Card>
          <Card>
            <Statistic title={t('pages.trafficControl.activeBuckets')} value={rateLimit?.activeBuckets || 0} />
          </Card>
        </div>}

        {loadError && !status ? null : <div className="traffic-control__grid">
          <Card title={t('pages.trafficControl.rateLimitConfig')} className="traffic-control__card">
            <div className="traffic-control__configList">
              <span>{t('pages.trafficControl.publicPerMinute')} <strong>{rateLimit?.publicPerMinute ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.authenticatedPerMinute')} <strong>{rateLimit?.authenticatedPerMinute ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.adminPerMinute')} <strong>{rateLimit?.adminPerMinute ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.windowSeconds')} <strong>{rateLimit?.windowSeconds ?? '-'}</strong></span>
            </div>
          </Card>

          <Card title={t('pages.trafficControl.circuitConfig')} className="traffic-control__card">
            <div className="traffic-control__configList">
              <span>{t('pages.trafficControl.circuitStatus')} <Tag color={circuitConfig?.enabled ? 'green' : 'default'}>{circuitConfig?.enabled ? t('pages.trafficControl.enabled') : t('pages.trafficControl.disabled')}</Tag></span>
              <span>{t('pages.trafficControl.failureThreshold')} <strong>{circuitConfig?.failureThreshold ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.openSeconds')} <strong>{circuitConfig?.openSeconds ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.halfOpenSuccessThreshold')} <strong>{circuitConfig?.halfOpenSuccessThreshold ?? '-'}</strong></span>
            </div>
          </Card>
        </div>}

        {loadError && !status ? null : <Alert
          className="traffic-control__alert"
          type="info"
          showIcon
          message={t('pages.trafficControl.configHint')}
        />}

        {loadError && !status ? null : <Card title={<span><ThunderboltOutlined /> {t('pages.trafficControl.circuitBreakers')}</span>} className="traffic-control__card">
          {status?.circuits?.length ? (
            <Table
              rowKey="name"
              columns={columns}
              dataSource={status.circuits}
              pagination={false}
              scroll={{ x: 860 }}
            />
          ) : (
            <Empty description={t('pages.trafficControl.emptyCircuits')} />
          )}
        </Card>}
        </Spin>
      </div>
    </div>
  );
};

export default TrafficControl;

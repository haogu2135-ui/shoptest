import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ClearOutlined, DashboardOutlined, ReloadOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminTrafficControlStatus } from '../types';
import { useLanguage } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import './TrafficControl.css';

const { Text, Title } = Typography;

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
  const [acting, setActing] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTrafficControlStatus();
      setStatus(response.data);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.trafficControl.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const resetCircuit = async (name?: string) => {
    setActing(name || 'all');
    try {
      const response = await adminApi.resetCircuitBreaker(name);
      setStatus(response.data);
      message.success(name ? t('pages.trafficControl.circuitReset') : t('pages.trafficControl.allCircuitsReset'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.trafficControl.circuitResetFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const clearRateLimit = async () => {
    setActing('rate-limit');
    try {
      const response = await adminApi.clearRateLimitCounters();
      setStatus(response.data);
      message.success(t('pages.trafficControl.rateLimitCleared'));
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.trafficControl.rateLimitClearFailed'), language));
    } finally {
      setActing(null);
    }
  };

  const columns: ColumnsType<CircuitRow> = useMemo(() => [
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
      render: (value: string) => <Tag color={stateColor(value)}>{value}</Tag>,
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
    {
      title: t('common.actions'),
      key: 'action',
      width: 110,
      render: (_, row) => (
        <Button
          size="small"
          icon={<UndoOutlined />}
          loading={acting === row.name}
          onClick={() => resetCircuit(row.name)}
        >
          {t('pages.trafficControl.reset')}
        </Button>
      ),
    },
  ], [acting, dateLocale, t]);

  const rateLimit = status?.rateLimit;
  const circuitConfig = status?.circuitBreakerConfig;

  return (
    <div className="traffic-control">
      <div className="traffic-control__hero">
        <div>
          <Text className="traffic-control__eyebrow">Traffic Control</Text>
          <Title level={2}>{t('pages.trafficControl.title')}</Title>
          <Text type="secondary">{t('pages.trafficControl.description')}</Text>
        </div>
        <Space className="traffic-control__actions" wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadStatus}>
            {t('common.refresh')}
          </Button>
          <Button icon={<ClearOutlined />} loading={acting === 'rate-limit'} onClick={clearRateLimit}>
            {t('pages.trafficControl.clearRateLimit')}
          </Button>
          <Button type="primary" icon={<UndoOutlined />} loading={acting === 'all'} onClick={() => resetCircuit()}>
            {t('pages.trafficControl.resetAllCircuits')}
          </Button>
        </Space>
      </div>

      <Spin spinning={loading && !status}>
        <div className="traffic-control__stats">
          <Card>
            <Statistic title={t('pages.trafficControl.rateLimitStatus')} value={rateLimit?.enabled ? 'ON' : 'OFF'} prefix={<DashboardOutlined />} />
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
        </div>

        <div className="traffic-control__grid">
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
              <span>{t('pages.trafficControl.circuitStatus')} <Tag color={circuitConfig?.enabled ? 'green' : 'default'}>{circuitConfig?.enabled ? 'ON' : 'OFF'}</Tag></span>
              <span>{t('pages.trafficControl.failureThreshold')} <strong>{circuitConfig?.failureThreshold ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.openSeconds')} <strong>{circuitConfig?.openSeconds ?? '-'}</strong></span>
              <span>{t('pages.trafficControl.halfOpenSuccessThreshold')} <strong>{circuitConfig?.halfOpenSuccessThreshold ?? '-'}</strong></span>
            </div>
          </Card>
        </div>

        <Alert
          className="traffic-control__alert"
          type="info"
          showIcon
          message={t('pages.trafficControl.configHint')}
        />

        <Card title={<span><ThunderboltOutlined /> {t('pages.trafficControl.circuitBreakers')}</span>} className="traffic-control__card">
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
        </Card>
      </Spin>
    </div>
  );
};

export default TrafficControl;

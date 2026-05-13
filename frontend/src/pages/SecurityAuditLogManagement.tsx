import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Progress, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AlertOutlined, DownloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { SecurityAuditLog } from '../types';
import { useLanguage } from '../i18n';
import './SecurityAuditLogManagement.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const actionColors: Record<string, string> = {
  LOGIN: 'blue',
  LOGOUT: 'default',
  PAYMENT_CREATE: 'cyan',
  PAYMENT_CALLBACK: 'green',
  PAYMENT_SIMULATE_PAID: 'orange',
  PAYMENT_SIMULATE_CALLBACK: 'orange',
  STRIPE_WEBHOOK: 'green',
  ORDER_BATCH_SHIP: 'geekblue',
  RETURN_REQUEST: 'gold',
  RETURN_SHIPMENT_SUBMIT: 'gold',
  REFUND_COMPLETE: 'purple',
  AUDIT_LOG_EXPORT: 'volcano',
};

const auditActionOptions = [
  'LOGIN',
  'LOGOUT',
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'PAYMENT_SIMULATE_PAID',
  'PAYMENT_SIMULATE_CALLBACK',
  'STRIPE_WEBHOOK',
  'RETURN_REQUEST',
  'RETURN_APPROVE',
  'RETURN_REJECT',
  'RETURN_SHIPMENT_SUBMIT',
  'REFUND_COMPLETE',
  'ORDER_STATUS_UPDATE',
  'ORDER_BATCH_SHIP',
  'ORDER_EXPORT',
  'AUDIT_LOG_EXPORT',
];

const highRiskActions = new Set([
  'AUDIT_LOG_EXPORT',
  'ORDER_EXPORT',
  'ORDER_BATCH_SHIP',
  'REFUND_COMPLETE',
  'STRIPE_WEBHOOK',
  'PAYMENT_SIMULATE_CALLBACK',
  'PAYMENT_SIMULATE_PAID',
]);

const SecurityAuditLogManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const [resourceType, setResourceType] = useState<string | undefined>();
  const [actorUsername, setActorUsername] = useState('');
  const [range, setRange] = useState<any>(null);
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

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
      repeatedFailures,
      healthScore,
    };
  }, [logs]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs(queryParams);
      setLogs(res.data || []);
    } catch {
      message.error(t('pages.auditLogs.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportLogs = async () => {
    try {
      const res = await adminApi.exportAuditLogs(queryParams);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'security-audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(t('pages.auditLogs.exportFailed'));
    }
  };

  return (
    <div className="audit-log-page">
      <Title level={4}>{t('pages.auditLogs.title')}</Title>
      <section className="audit-log-page__insights" aria-label={t('pages.auditLogs.insightTitle')}>
        <div className="audit-log-page__insightCopy">
          <Text className="audit-log-page__eyebrow">{t('pages.auditLogs.insightEyebrow')}</Text>
          <Title level={5}>{t('pages.auditLogs.insightTitle')}</Title>
          <Text type="secondary">{t('pages.auditLogs.insightSubtitle')}</Text>
          <Text type="secondary" className="audit-log-page__insightMeta">
            {t('pages.auditLogs.insightMeta', { total: auditInsights.total, sensitive: auditInsights.sensitiveActions })}
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
          <div className={`audit-log-page__signal ${auditInsights.failureRate > 12 ? 'is-risk' : 'is-ok'}`}>
            <AlertOutlined />
            <strong>{auditInsights.failureRate}%</strong>
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
      <Card className="audit-log-page__toolbar">
        <Space wrap>
          <Select
            allowClear
            value={action}
            onChange={setAction}
            placeholder={t('pages.auditLogs.action')}
            style={{ width: 210 }}
            options={auditActionOptions.map((value) => ({ value, label: value }))}
          />
          <Select
            allowClear
            value={result}
            onChange={setResult}
            placeholder={t('pages.auditLogs.result')}
            style={{ width: 140 }}
            options={[
              { value: 'SUCCESS', label: t('pages.auditLogs.success') },
              { value: 'FAILURE', label: t('pages.auditLogs.failure') },
            ]}
          />
          <Select
            allowClear
            value={resourceType}
            onChange={setResourceType}
            placeholder={t('pages.auditLogs.resource')}
            style={{ width: 150 }}
            options={['USER', 'ORDER', 'PAYMENT', 'SECURITY_AUDIT_LOG'].map((value) => ({ value, label: value }))}
          />
          <Input
            allowClear
            value={actorUsername}
            onChange={(event) => setActorUsername(event.target.value)}
            placeholder={t('pages.auditLogs.actor')}
            style={{ width: 180 }}
          />
          <RangePicker showTime value={range} onChange={setRange} />
          <Button icon={<SearchOutlined />} type="primary" onClick={fetchLogs}>
            {t('common.search')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportLogs}>
            {t('pages.auditLogs.export')}
          </Button>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={logs}
          size="middle"
          scroll={{ x: 1180 }}
          pagination={{ pageSize: 12, showTotal: (total) => t('common.tableTotal', { count: total }) }}
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
              render: (value: string) => <Tag color={actionColors[value] || 'default'}>{value}</Tag>,
            },
            {
              title: t('pages.auditLogs.result'),
              dataIndex: 'result',
              width: 100,
              render: (value: string) => <Tag color={value === 'SUCCESS' ? 'green' : 'red'}>{value}</Tag>,
            },
            {
              title: t('pages.auditLogs.actor'),
              width: 150,
              render: (_: unknown, log: SecurityAuditLog) => log.actorUsername || log.actorUserId || '-',
            },
            {
              title: t('pages.auditLogs.resource'),
              width: 160,
              render: (_: unknown, log: SecurityAuditLog) => [log.resourceType, log.resourceId].filter(Boolean).join(' #') || '-',
            },
            { title: 'IP', dataIndex: 'ipAddress', width: 130 },
            {
              title: t('pages.auditLogs.message'),
              dataIndex: 'message',
              ellipsis: true,
              render: (value: string, log: SecurityAuditLog) => (
                <Space direction="vertical" size={0}>
                  <span>{value || '-'}</span>
                  {log.metadata ? <Text type="secondary">{log.metadata}</Text> : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default SecurityAuditLogManagement;

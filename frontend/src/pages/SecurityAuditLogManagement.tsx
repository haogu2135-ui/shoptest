import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Progress, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AlertOutlined, DownloadOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
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

const paymentOpsActions = new Set([
  'PAYMENT_CREATE',
  'PAYMENT_CALLBACK',
  'STRIPE_WEBHOOK',
  'REFUND_COMPLETE',
]);

const SecurityAuditLogManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | undefined>(searchParams.get('action') || undefined);
  const [result, setResult] = useState<string | undefined>(searchParams.get('result') || undefined);
  const [resourceType, setResourceType] = useState<string | undefined>(searchParams.get('resourceType') || undefined);
  const [actorUsername, setActorUsername] = useState('');
  const [range, setRange] = useState<any>(null);
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const opsCopy = useMemo(() => {
    if (language === 'zh') {
      return {
        title: '支付与退款异常队列',
        subtitle: '把支付失败、回调、退款完成记录放在同一个运营视角里，方便上线后排查网关和人工操作问题。',
        paymentFailures: '支付失败',
        refundEvents: '退款动作',
        callbackEvents: '回调记录',
        highRiskEvents: '高风险动作',
        showPaymentFailures: '查看支付失败',
        showRefunds: '查看退款动作',
        showCallbacks: '查看支付回调',
        clear: '重置筛选',
        guideTitle: '排查顺序',
        guideText: '先看失败支付，再核对回调与退款动作，最后按订单号回到后台订单处理。',
      };
    }
    if (language === 'es') {
      return {
        title: 'Cola de pagos y reembolsos',
        subtitle: 'Agrupa fallos de pago, callbacks y reembolsos para revisar pasarelas y acciones manuales.',
        paymentFailures: 'Fallos de pago',
        refundEvents: 'Reembolsos',
        callbackEvents: 'Callbacks',
        highRiskEvents: 'Acciones sensibles',
        showPaymentFailures: 'Ver fallos',
        showRefunds: 'Ver reembolsos',
        showCallbacks: 'Ver callbacks',
        clear: 'Limpiar filtros',
        guideTitle: 'Orden de revision',
        guideText: 'Primero pagos fallidos, luego callbacks y reembolsos, y despues volver al pedido relacionado.',
      };
    }
    return {
      title: 'Payment and refund queue',
      subtitle: 'Review payment failures, callbacks, and refund events in one operations view.',
      paymentFailures: 'Payment failures',
      refundEvents: 'Refund events',
      callbackEvents: 'Callback events',
      highRiskEvents: 'Sensitive actions',
      showPaymentFailures: 'Show failures',
      showRefunds: 'Show refunds',
      showCallbacks: 'Show callbacks',
      clear: 'Clear filters',
      guideTitle: 'Review order',
      guideText: 'Start with failed payments, then callbacks and refunds, then return to the related order.',
    };
  }, [language]);

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
      repeatedFailures,
      healthScore,
    };
  }, [logs]);

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
      setResourceType('PAYMENT');
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
    updateAuditFilters({ resourceType: 'PAYMENT', view: 'payment-ops' });
  };

  const clearOpsFilters = () => {
    updateAuditFilters({});
    setActorUsername('');
    setRange(null);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs(queryParams);
      setLogs(res.data || []);
    } catch {
      message.error(t('pages.auditLogs.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, t]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchLogs();
    }, 180);
    return () => window.clearTimeout(handle);
  }, [fetchLogs]);

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
      <section className="audit-log-page__opsPanel" aria-label={opsCopy.title}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{opsCopy.title}</Text>
          <Text type="secondary">{opsCopy.subtitle}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button type="button" className={auditInsights.paymentFailures > 0 ? 'is-risk' : ''} onClick={applyPaymentFailureFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{opsCopy.paymentFailures}</span>
          </button>
          <button type="button" onClick={applyRefundFilter}>
            <SafetyCertificateOutlined />
            <strong>{auditInsights.refundEvents}</strong>
            <span>{opsCopy.refundEvents}</span>
          </button>
          <button type="button" onClick={applyCallbackFilter}>
            <SearchOutlined />
            <strong>{auditInsights.callbackEvents}</strong>
            <span>{opsCopy.callbackEvents}</span>
          </button>
          <button type="button" className={auditInsights.sensitiveActions > 0 ? 'is-watch' : ''} onClick={applyPaymentOpsFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentOpsEvents}</strong>
            <span>{opsCopy.highRiskEvents}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{opsCopy.guideTitle}</Text>
            <Text type="secondary">{opsCopy.guideText}</Text>
          </div>
          <Space wrap>
            <Button size="small" onClick={applyPaymentFailureFilter}>{opsCopy.showPaymentFailures}</Button>
            <Button size="small" onClick={applyRefundFilter}>{opsCopy.showRefunds}</Button>
            <Button size="small" onClick={applyCallbackFilter}>{opsCopy.showCallbacks}</Button>
            <Button size="small" onClick={clearOpsFilters}>{opsCopy.clear}</Button>
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
            style={{ width: 210 }}
            options={auditActionOptions.map((value) => ({ value, label: value }))}
          />
          <Select
            allowClear
            value={result}
            onChange={(value) => updateAuditFilters({ action, result: value, resourceType })}
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
            onChange={(value) => updateAuditFilters({ action, result, resourceType: value })}
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

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

export const auditActionOptions = [
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

export const auditActionLabels: Record<string, Record<string, string>> = {
  en: {
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    PAYMENT_CREATE: 'Create payment',
    PAYMENT_CALLBACK: 'Payment callback',
    PAYMENT_SIMULATE_PAID: 'Simulate paid',
    PAYMENT_SIMULATE_CALLBACK: 'Simulate callback',
    STRIPE_WEBHOOK: 'Stripe webhook',
    RETURN_REQUEST: 'Return request',
    RETURN_APPROVE: 'Approve return',
    RETURN_REJECT: 'Reject return',
    RETURN_SHIPMENT_SUBMIT: 'Return shipment submitted',
    REFUND_COMPLETE: 'Refund completed',
    ORDER_STATUS_UPDATE: 'Order status update',
    ORDER_BATCH_SHIP: 'Batch shipment',
    ORDER_EXPORT: 'Order export',
    AUDIT_LOG_EXPORT: 'Audit log export',
  },
  es: {
    LOGIN: 'Inicio de sesión',
    LOGOUT: 'Cerrar sesión',
    PAYMENT_CREATE: 'Crear pago',
    PAYMENT_CALLBACK: 'Callback de pago',
    PAYMENT_SIMULATE_PAID: 'Simular pago',
    PAYMENT_SIMULATE_CALLBACK: 'Simular callback',
    STRIPE_WEBHOOK: 'Webhook de Stripe',
    RETURN_REQUEST: 'Solicitud de devolución',
    RETURN_APPROVE: 'Aprobar devolución',
    RETURN_REJECT: 'Rechazar devolución',
    RETURN_SHIPMENT_SUBMIT: 'Envío de devolución',
    REFUND_COMPLETE: 'Reembolso completado',
    ORDER_STATUS_UPDATE: 'Actualizar estado',
    ORDER_BATCH_SHIP: 'Envío por lote',
    ORDER_EXPORT: 'Exportar pedidos',
    AUDIT_LOG_EXPORT: 'Exportar auditoría',
  },
  zh: {
    LOGIN: '登录',
    LOGOUT: '退出登录',
    PAYMENT_CREATE: '创建支付',
    PAYMENT_CALLBACK: '支付回调',
    PAYMENT_SIMULATE_PAID: '模拟已支付',
    PAYMENT_SIMULATE_CALLBACK: '模拟支付回调',
    STRIPE_WEBHOOK: 'Stripe 回调',
    RETURN_REQUEST: '申请退货',
    RETURN_APPROVE: '同意退货',
    RETURN_REJECT: '拒绝退货',
    RETURN_SHIPMENT_SUBMIT: '提交退货物流',
    REFUND_COMPLETE: '完成退款',
    ORDER_STATUS_UPDATE: '更新订单状态',
    ORDER_BATCH_SHIP: '批量发货',
    ORDER_EXPORT: '导出订单',
    AUDIT_LOG_EXPORT: '导出审计日志',
  },
};

export const resourceTypeLabels: Record<string, Record<string, string>> = {
  en: { USER: 'User', ORDER: 'Order', PAYMENT: 'Payment', SECURITY_AUDIT_LOG: 'Security audit log' },
  es: { USER: 'Usuario', ORDER: 'Pedido', PAYMENT: 'Pago', SECURITY_AUDIT_LOG: 'Log de seguridad' },
  zh: { USER: '用户', ORDER: '订单', PAYMENT: '支付', SECURITY_AUDIT_LOG: '安全审计日志' },
};

export const auditMessageLabels: Record<string, Record<string, string>> = {
  en: {
    'User logout': 'User logout',
    'Payment created': 'Payment created',
    'Payment simulated as paid': 'Payment simulated as paid',
    'Payment callback simulated': 'Payment callback simulated',
    'Payment callback accepted': 'Payment callback accepted',
    'Stripe webhook accepted': 'Stripe webhook accepted',
    'Return requested': 'Return requested',
    'Return shipment submitted': 'Return shipment submitted',
    'Order status updated': 'Order status updated',
    'Order refunded': 'Order refunded',
    'Batch ship completed': 'Batch shipment completed',
    'Orders exported': 'Orders exported',
    'Security audit logs exported': 'Security audit logs exported',
  },
  es: {
    'User logout': 'Cierre de sesión',
    'Payment created': 'Pago creado',
    'Payment simulated as paid': 'Pago simulado como pagado',
    'Payment callback simulated': 'Callback de pago simulado',
    'Payment callback accepted': 'Callback de pago aceptado',
    'Stripe webhook accepted': 'Webhook de Stripe aceptado',
    'Return requested': 'Devolución solicitada',
    'Return shipment submitted': 'Envío de devolución enviado',
    'Order status updated': 'Estado del pedido actualizado',
    'Order refunded': 'Pedido reembolsado',
    'Batch ship completed': 'Envío por lote completado',
    'Orders exported': 'Pedidos exportados',
    'Security audit logs exported': 'Logs de seguridad exportados',
  },
  zh: {
    'User logout': '用户退出登录',
    'Payment created': '支付单已创建',
    'Payment simulated as paid': '支付已模拟为成功',
    'Payment callback simulated': '支付回调已模拟',
    'Payment callback accepted': '支付回调已接收',
    'Stripe webhook accepted': 'Stripe 回调已接收',
    'Return requested': '用户已申请退货',
    'Return shipment submitted': '用户已提交退货物流',
    'Order status updated': '订单状态已更新',
    'Order refunded': '订单已退款',
    'Batch ship completed': '批量发货已完成',
    'Orders exported': '订单已导出',
    'Security audit logs exported': '安全审计日志已导出',
  },
};

export const auditOpsCopy: Record<string, {
  title: string;
  subtitle: string;
  paymentFailures: string;
  refundEvents: string;
  callbackEvents: string;
  highRiskEvents: string;
  showPaymentFailures: string;
  showRefunds: string;
  showCallbacks: string;
  clear: string;
  guideTitle: string;
  guideText: string;
}> = {
  en: {
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
  },
  es: {
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
    guideText: 'Primero pagos fallidos, luego callbacks y reembolsos, y despues vuelve al pedido relacionado.',
  },
  zh: {
    title: '支付与退款异常队列',
    subtitle: '把支付失败、网关回调和退款动作集中到同一个运营视角，方便排查支付网关和人工操作问题。',
    paymentFailures: '支付失败',
    refundEvents: '退款动作',
    callbackEvents: '回调记录',
    highRiskEvents: '敏感动作',
    showPaymentFailures: '查看支付失败',
    showRefunds: '查看退款动作',
    showCallbacks: '查看支付回调',
    clear: '重置筛选',
    guideTitle: '排查顺序',
    guideText: '先看失败支付，再核对回调与退款动作，最后按订单号回到后台订单处理。',
  },
};

export const localizedMapValue = (map: Record<string, Record<string, string>>, language: string, value?: string) => {
  if (!value) return '-';
  return map[language]?.[value] || map.en[value] || value;
};

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

  const localizedOpsCopy = auditOpsCopy[language] || auditOpsCopy.en;
  const actionLabel = useCallback((value?: string) => localizedMapValue(auditActionLabels, language, value), [language]);
  const resourceLabel = useCallback((value?: string) => localizedMapValue(resourceTypeLabels, language, value), [language]);
  const messageLabel = useCallback((value?: string) => localizedMapValue(auditMessageLabels, language, value), [language]);

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
      setResourceType(undefined);
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
      <section className="audit-log-page__opsPanel" aria-label={localizedOpsCopy.title}>
        <div className="audit-log-page__opsIntro">
          <Text strong>{localizedOpsCopy.title}</Text>
          <Text type="secondary">{localizedOpsCopy.subtitle}</Text>
        </div>
        <div className="audit-log-page__opsMetrics">
          <button type="button" className={auditInsights.paymentFailures > 0 ? 'is-risk' : ''} onClick={applyPaymentFailureFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentFailures}</strong>
            <span>{localizedOpsCopy.paymentFailures}</span>
          </button>
          <button type="button" onClick={applyRefundFilter}>
            <SafetyCertificateOutlined />
            <strong>{auditInsights.refundEvents}</strong>
            <span>{localizedOpsCopy.refundEvents}</span>
          </button>
          <button type="button" onClick={applyCallbackFilter}>
            <SearchOutlined />
            <strong>{auditInsights.callbackEvents}</strong>
            <span>{localizedOpsCopy.callbackEvents}</span>
          </button>
          <button type="button" className={auditInsights.sensitiveActions > 0 ? 'is-watch' : ''} onClick={applyPaymentOpsFilter}>
            <AlertOutlined />
            <strong>{auditInsights.paymentOpsEvents}</strong>
            <span>{localizedOpsCopy.highRiskEvents}</span>
          </button>
        </div>
        <div className="audit-log-page__opsActions">
          <div>
            <Text strong>{localizedOpsCopy.guideTitle}</Text>
            <Text type="secondary">{localizedOpsCopy.guideText}</Text>
          </div>
          <Space wrap>
            <Button size="small" onClick={applyPaymentFailureFilter}>{localizedOpsCopy.showPaymentFailures}</Button>
            <Button size="small" onClick={applyRefundFilter}>{localizedOpsCopy.showRefunds}</Button>
            <Button size="small" onClick={applyCallbackFilter}>{localizedOpsCopy.showCallbacks}</Button>
            <Button size="small" onClick={clearOpsFilters}>{localizedOpsCopy.clear}</Button>
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
            options={auditActionOptions.map((value) => ({ value, label: actionLabel(value) }))}
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
            options={['USER', 'ORDER', 'PAYMENT', 'SECURITY_AUDIT_LOG'].map((value) => ({ value, label: resourceLabel(value) }))}
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
    </div>
  );
};

export default SecurityAuditLogManagement;

import React, { useEffect, useState } from 'react';
import { Avatar, Button, Card, Col, List, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import {
  ShopOutlined, ShoppingOutlined, TeamOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, RiseOutlined, TruckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import type { DashboardStats } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { getApiErrorMessage } from '../utils/apiError';
import { resolveProductImage } from '../utils/productMedia';
import './AdminDashboard.css';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'orange',
  PENDING_SHIPMENT: 'blue',
  SHIPPED: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  RETURN_REQUESTED: 'gold',
  RETURN_APPROVED: 'geekblue',
  RETURN_SHIPPED: 'cyan',
  RETURN_REFUNDING: 'magenta',
  RETURNED: 'purple',
  REFUNDED: 'purple',
};

const ORDER_STATUS_LABEL_KEYS = new Set([...Object.keys(statusColors), 'PENDING_RECEIPT']);

const normalizeStatusCode = (status?: string) => String(status || '').trim().toUpperCase();

const TrendChart: React.FC<{
  data: Array<{ date: string; orders: number; revenue: number }>;
  formatMoney: (value: number) => string;
  labels: {
    noTrendData: string;
    salesTrendChart: string;
    orders: string;
    revenue: string;
    orderUnit: string;
  };
}> = ({ data, formatMoney, labels }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) {
    return <div className="admin-dashboard__chartEmpty">{labels.noTrendData}</div>;
  }

  const width = 720;
  const height = 260;
  const padding = { top: 20, right: 26, bottom: 42, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(...data.map((item) => Number(item.revenue || 0)), 1);
  const maxOrders = Math.max(...data.map((item) => Number(item.orders || 0)), 1);
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const barWidth = Math.max(12, Math.min(28, chartWidth / data.length * 0.42));
  const revenuePoints = data.map((item, index) => {
    const x = padding.left + (data.length > 1 ? index * step : chartWidth / 2);
    const y = padding.top + chartHeight - (Number(item.revenue || 0) / maxRevenue) * chartHeight;
    return { x, y, item };
  });
  const path = revenuePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const hoveredPoint = hoveredIndex === null ? null : revenuePoints[hoveredIndex];

  return (
    <div className="admin-dashboard__trendChartScroll">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={labels.salesTrendChart}
        className="admin-dashboard__trendChart"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#e8e8e8" />
        <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#e8e8e8" />
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="#f2f2f2" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8c8c8c">
                {formatMoney(maxRevenue * ratio)}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const x = padding.left + (data.length > 1 ? index * step : chartWidth / 2);
          const barHeight = (Number(item.orders || 0) / maxOrders) * chartHeight;
          return (
            <g key={item.date}>
              <rect
                x={x - barWidth / 2}
                y={padding.top + chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill="#91caff"
              />
              <text x={x} y={height - 16} textAnchor="middle" fontSize="11" fill="#666">
                {item.date.slice(5)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#ee4d2d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {revenuePoints.map((point) => (
          <g key={point.item.date}>
            <circle cx={point.x} cy={point.y} r={4} fill="#ee4d2d" />
            <title>{`${point.item.date}: ${formatMoney(Number(point.item.revenue || 0))} / ${point.item.orders} ${labels.orderUnit}`}</title>
          </g>
        ))}
        {hoveredPoint ? (
          <g pointerEvents="none">
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={padding.top + chartHeight}
              stroke="#8c8c8c"
              strokeDasharray="4 4"
            />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={6} fill="#fff" stroke="#ee4d2d" strokeWidth="3" />
            {(() => {
              const tooltipWidth = 184;
              const tooltipHeight = 76;
              const tooltipX = Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, padding.left), width - tooltipWidth - 8);
              const tooltipY = Math.max(8, hoveredPoint.y - tooltipHeight - 14);
              return (
                <g>
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={8}
                    fill="#ffffff"
                    stroke="#eee4d3"
                    filter="drop-shadow(0 4px 10px rgba(0,0,0,0.12))"
                  />
                  <text x={tooltipX + 12} y={tooltipY + 22} fontSize="12" fontWeight="700" fill="#173f2b">
                    {hoveredPoint.item.date}
                  </text>
                  <text x={tooltipX + 12} y={tooltipY + 44} fontSize="12" fill="#ee4d2d">
                    {labels.revenue}: {formatMoney(Number(hoveredPoint.item.revenue || 0))}
                  </text>
                  <text x={tooltipX + 12} y={tooltipY + 64} fontSize="12" fill="#1677ff">
                    {labels.orders}: {hoveredPoint.item.orders} {labels.orderUnit}
                  </text>
                </g>
              );
            })()}
          </g>
        ) : null}
        {revenuePoints.map((point, index) => (
          <rect
            key={`hit-${point.item.date}`}
            x={point.x - Math.max(step / 2, 26)}
            y={padding.top}
            width={Math.max(step, 52)}
            height={chartHeight}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${point.item.date}: ${formatMoney(Number(point.item.revenue || 0))}, ${point.item.orders} ${labels.orderUnit}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      <Space size="large" className="admin-dashboard__chartLegend">
        <Space><span className="admin-dashboard__legendSwatch admin-dashboard__legendSwatch--orders" />{labels.orders}</Space>
        <Space><span className="admin-dashboard__legendSwatch admin-dashboard__legendSwatch--revenue" />{labels.revenue}</Space>
      </Space>
    </div>
  );
};

const DonutChart: React.FC<{
  data: Array<{ label: string; value: number; color: string }>;
  labels: {
    noOrderData: string;
    orderStatusChart: string;
    orderUnit: string;
  };
}> = ({ data, labels }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    return <div className="admin-dashboard__chartEmpty admin-dashboard__chartEmpty--compact">{labels.noOrderData}</div>;
  }
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Space align="center" className="admin-dashboard__donutChart">
      <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={labels.orderStatusChart}>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#f0f0f0" strokeWidth="18" />
        {data.filter((item) => item.value > 0).map((item) => {
          const dash = (item.value / total) * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform="rotate(-90 64 64)"
            />
          );
          offset += dash;
          return circle;
        })}
        <text x="64" y="60" textAnchor="middle" fontSize="20" fontWeight="700" fill="#222">{total}</text>
        <text x="64" y="78" textAnchor="middle" fontSize="11" fill="#888">{labels.orderUnit}</text>
      </svg>
      <Space direction="vertical" size={6}>
        {data.map((item) => (
          <Space key={item.label}>
            <span className="admin-dashboard__donutSwatch" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Space>
        ))}
      </Space>
    </Space>
  );
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();
  const formatOrderStatusLabel = (status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = normalizeStatusCode(rawStatus);
    if (!normalizedStatus) return t('common.unknown');
    if (ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return t(`status.${normalizedStatus}`);
    return rawStatus;
  };
  const getOrderStatusColor = (status?: string) => {
    const normalizedStatus = normalizeStatusCode(status);
    if (!ORDER_STATUS_LABEL_KEYS.has(normalizedStatus)) return 'default';
    return statusColors[normalizedStatus] || 'default';
  };
  const paymentRefundCopy = {
    title: t('pages.adminDashboard.paymentReturnOps.title'),
    subtitle: t('pages.adminDashboard.paymentReturnOps.subtitle'),
    pendingPayment: t('pages.adminDashboard.paymentReturnOps.pendingPayment'),
    returnRequested: t('pages.adminDashboard.paymentReturnOps.returnRequested'),
    returnApproved: t('pages.adminDashboard.paymentReturnOps.returnApproved'),
    returnShipped: t('pages.adminDashboard.paymentReturnOps.returnShipped'),
    refunding: t('pages.adminDashboard.paymentReturnOps.refunding'),
    refunded: t('pages.adminDashboard.paymentReturnOps.refunded'),
    paymentAction: t('pages.adminDashboard.paymentReturnOps.paymentAction'),
    returnAction: t('pages.adminDashboard.paymentReturnOps.returnAction'),
    auditAction: t('pages.adminDashboard.paymentReturnOps.auditAction'),
    healthReady: t('pages.adminDashboard.paymentReturnOps.healthReady'),
    healthWatch: t('pages.adminDashboard.paymentReturnOps.healthWatch'),
    healthRisk: t('pages.adminDashboard.paymentReturnOps.healthRisk'),
    guideTitle: t('pages.adminDashboard.paymentReturnOps.guideTitle'),
    guideText: t('pages.adminDashboard.paymentReturnOps.guideText'),
  };
  const slaCopy = {
    title: t('pages.adminDashboard.operationsSla.title'),
    subtitle: t('pages.adminDashboard.operationsSla.subtitle'),
    healthy: t('pages.adminDashboard.operationsSla.healthy'),
    watch: t('pages.adminDashboard.operationsSla.watch'),
    risk: t('pages.adminDashboard.operationsSla.risk'),
    stalePendingPayment: t('pages.adminDashboard.operationsSla.stalePendingPayment'),
    delayedShipment: t('pages.adminDashboard.operationsSla.delayedShipment'),
    returnAwaitingShipment: t('pages.adminDashboard.operationsSla.returnAwaitingShipment'),
    refundDue: t('pages.adminDashboard.operationsSla.refundDue'),
    stalePendingPaymentText: t('pages.adminDashboard.operationsSla.stalePendingPaymentText'),
    delayedShipmentText: t('pages.adminDashboard.operationsSla.delayedShipmentText'),
    returnAwaitingShipmentText: t('pages.adminDashboard.operationsSla.returnAwaitingShipmentText'),
    refundDueText: t('pages.adminDashboard.operationsSla.refundDueText'),
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminApi.getDashboard();
        setStats(res.data);
        setLoadError('');
      } catch (error: any) {
        setLoadError(getApiErrorMessage(error, t('pages.adminDashboard.loadFailed'), language));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [language, t]);

  if (loading) {
    return <div className="admin-dashboard__loading"><Spin size="large" /></div>;
  }

  if (!stats) {
    return (
      <div className="admin-dashboard__error">
        <WarningOutlined />
        <Typography.Title level={4}>{t('pages.adminDashboard.loadFailed')}</Typography.Title>
        <Typography.Text type="secondary">{loadError || t('pages.adminDashboard.loadFailed')}</Typography.Text>
        <Button type="primary" onClick={() => window.location.reload()}>{t('common.refresh')}</Button>
      </div>
    );
  }

  const recentOrderColumns = [
    { title: t('pages.adminOrders.orderId'), dataIndex: 'id', key: 'id', width: 80 },
    { title: t('common.userId'), dataIndex: 'userId', key: 'userId', width: 80 },
    {
      title: t('common.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v: number) => <span className="commerce-money" style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={getOrderStatusColor(s)}>{formatOrderStatusLabel(s)}</Tag>,
    },
    {
      title: t('common.time'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v ? new Date(v).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-',
    },
  ];

  const maxPaymentCount = Math.max(...Object.values(stats.paymentMethodBreakdown || {}), 1);
  const shippedOrders = Number(stats.shippedOrders || 0);
  const ordersWithTracking = Number(stats.ordersWithTracking || 0);
  const trackingCoverage = shippedOrders ? Math.min(100, Math.round((ordersWithTracking / shippedOrders) * 100)) : 0;
  const pendingShipmentOrders = Number(stats.pendingShipmentOrders || 0);
  const pendingPaymentOrders = Number(stats.pendingPaymentOrders || 0);
  const lowStockProducts = Number(stats.lowStockProducts || 0);
  const missingTrackingOrders = Number(stats.ordersWithoutTracking || 0);
  const returnRequestedOrders = Number(stats.orderStatusBreakdown?.RETURN_REQUESTED || 0);
  const returnApprovedOrders = Number(stats.orderStatusBreakdown?.RETURN_APPROVED || 0);
  const returnShippedOrders = Number(stats.orderStatusBreakdown?.RETURN_SHIPPED || 0);
  const returnedOrders = Number(stats.orderStatusBreakdown?.RETURNED || 0);
  const refundedOrders = Number(stats.refundedOrders || returnedOrders || 0);
  const refundedAmount = Number(stats.refundedAmount || 0);
  const netRevenue = Number(stats.netRevenue ?? stats.totalRevenue ?? 0);
  const refundRate = Number(stats.refundRate || 0);
  const refundingPayments = Number(stats.refundingPayments || 0);
  const paymentReturnRiskScore = pendingPaymentOrders + returnRequestedOrders * 2 + returnApprovedOrders * 2 + returnShippedOrders * 3 + refundingPayments * 4;
  const paymentReturnHealth = paymentReturnRiskScore === 0
    ? paymentRefundCopy.healthReady
    : paymentReturnRiskScore >= 6
      ? paymentRefundCopy.healthRisk
      : paymentRefundCopy.healthWatch;
  const paymentReturnCards = [
    {
      key: 'pending-payment',
      value: pendingPaymentOrders,
      label: paymentRefundCopy.pendingPayment,
      tone: pendingPaymentOrders > 0 ? 'warning' : 'ready',
      target: '/admin/orders?status=PENDING_PAYMENT',
    },
    {
      key: 'return-requested',
      value: returnRequestedOrders,
      label: paymentRefundCopy.returnRequested,
      tone: returnRequestedOrders > 0 ? 'warning' : 'ready',
      target: '/admin/orders?status=RETURN_REQUESTED',
    },
    {
      key: 'return-approved',
      value: returnApprovedOrders,
      label: paymentRefundCopy.returnApproved,
      tone: returnApprovedOrders > 0 ? 'info' : 'ready',
      target: '/admin/orders?status=RETURN_APPROVED',
    },
    {
      key: 'return-shipped',
      value: returnShippedOrders,
      label: paymentRefundCopy.returnShipped,
      tone: returnShippedOrders > 0 ? 'danger' : 'ready',
      target: '/admin/orders?status=RETURN_SHIPPED',
    },
    {
      key: 'refunding',
      value: refundingPayments,
      label: paymentRefundCopy.refunding,
      tone: refundingPayments > 0 ? 'danger' : 'ready',
      target: '/admin/orders?quick=REFUNDING',
    },
    {
      key: 'returned',
      value: refundedOrders,
      label: paymentRefundCopy.refunded,
      tone: 'ready',
      target: '/admin/orders?quick=REFUNDED',
    },
  ];
  const operationsSlaRisks = stats.operationsSlaRisks || {};
  const operationsSlaRiskTotal = Number(stats.operationsSlaRiskTotal || 0);
  const operationsSlaHealth = operationsSlaRiskTotal === 0
    ? slaCopy.healthy
    : operationsSlaRiskTotal >= 4
      ? slaCopy.risk
      : slaCopy.watch;
  const operationsSlaCards = [
    {
      key: 'stale-pending-payment',
      value: Number(operationsSlaRisks.stalePendingPayment || 0),
      title: slaCopy.stalePendingPayment,
      text: slaCopy.stalePendingPaymentText,
      target: '/admin/orders?quick=SLA_OVERDUE_PAYMENT',
      tone: Number(operationsSlaRisks.stalePendingPayment || 0) > 0 ? 'warning' : 'ready',
    },
    {
      key: 'delayed-shipment',
      value: Number(operationsSlaRisks.delayedShipment || 0),
      title: slaCopy.delayedShipment,
      text: slaCopy.delayedShipmentText,
      target: '/admin/orders?quick=SLA_OVERDUE_SHIPMENT',
      tone: Number(operationsSlaRisks.delayedShipment || 0) > 0 ? 'danger' : 'ready',
    },
    {
      key: 'return-awaiting-shipment',
      value: Number(operationsSlaRisks.returnAwaitingShipment || 0),
      title: slaCopy.returnAwaitingShipment,
      text: slaCopy.returnAwaitingShipmentText,
      target: '/admin/orders?quick=SLA_OVERDUE_RETURN_APPROVED',
      tone: Number(operationsSlaRisks.returnAwaitingShipment || 0) > 0 ? 'info' : 'ready',
    },
    {
      key: 'refund-due',
      value: Number(operationsSlaRisks.refundDue || 0),
      title: slaCopy.refundDue,
      text: slaCopy.refundDueText,
      target: '/admin/orders?quick=SLA_OVERDUE_RETURN_SHIPPED',
      tone: Number(operationsSlaRisks.refundDue || 0) > 0 ? 'danger' : 'ready',
    },
  ];
  const operationalActions = [
    {
      key: 'payment',
      value: pendingPaymentOrders,
      title: t('pages.adminDashboard.actionPendingPayment'),
      text: t('pages.adminDashboard.actionPendingPaymentText'),
      tone: pendingPaymentOrders > 0 ? 'warning' : 'calm',
      target: '/admin/orders?status=PENDING_PAYMENT',
    },
    {
      key: 'shipment',
      value: pendingShipmentOrders,
      title: t('pages.adminDashboard.actionPendingShipment'),
      text: t('pages.adminDashboard.actionPendingShipmentText'),
      tone: pendingShipmentOrders > 0 ? 'info' : 'calm',
      target: '/admin/orders?status=PENDING_SHIPMENT',
    },
    {
      key: 'stock',
      value: lowStockProducts,
      title: t('pages.adminDashboard.actionLowStock'),
      text: t('pages.adminDashboard.actionLowStockText'),
      tone: lowStockProducts > 0 ? 'danger' : 'calm',
      target: '/admin/products?stock=low',
    },
    {
      key: 'tracking',
      value: missingTrackingOrders,
      title: t('pages.adminDashboard.actionMissingTracking'),
      text: t('pages.adminDashboard.actionMissingTrackingText'),
      tone: missingTrackingOrders > 0 ? 'warning' : 'calm',
      target: '/admin/orders?quick=MISSING_TRACKING',
    },
    {
      key: 'refunds',
      value: refundedOrders,
      title: t('pages.adminDashboard.actionRefunds'),
      text: t('pages.adminDashboard.actionRefundsText', { amount: formatMoney(refundedAmount) }),
      tone: refundedOrders > 0 ? 'warning' : 'calm',
      target: '/admin/audit-logs?view=refunds',
    },
  ];
  const openActionCount = operationalActions.filter((item) => item.value > 0).length;
  const commercialRiskTotal = openActionCount + paymentReturnRiskScore + operationsSlaRiskTotal;
  const commercialReadinessScore = Math.max(0, Math.min(100, 100 - Math.min(100, commercialRiskTotal * 8)));
  const commercialReadinessTone = commercialReadinessScore >= 85 ? 'ready' : commercialReadinessScore >= 65 ? 'watch' : 'risk';
  const commercialReadinessLabel = t(`pages.adminDashboard.commercialReadiness.${commercialReadinessTone}`);
  const commercialReadinessItems = [
    {
      key: 'payment',
      icon: <DollarOutlined />,
      label: t('pages.adminDashboard.commercialReadiness.payment'),
      value: pendingPaymentOrders,
      target: '/admin/orders?status=PENDING_PAYMENT',
      tone: pendingPaymentOrders > 0 ? 'watch' : 'ready',
    },
    {
      key: 'fulfillment',
      icon: <TruckOutlined />,
      label: t('pages.adminDashboard.commercialReadiness.fulfillment'),
      value: pendingShipmentOrders,
      target: '/admin/orders?status=PENDING_SHIPMENT',
      tone: pendingShipmentOrders > 0 ? 'risk' : 'ready',
    },
    {
      key: 'stock',
      icon: <ShopOutlined />,
      label: t('pages.adminDashboard.commercialReadiness.stock'),
      value: lowStockProducts,
      target: '/admin/products?stock=low',
      tone: lowStockProducts > 0 ? 'watch' : 'ready',
    },
    {
      key: 'afterSales',
      icon: <WarningOutlined />,
      label: t('pages.adminDashboard.commercialReadiness.afterSales'),
      value: returnRequestedOrders + returnApprovedOrders + returnShippedOrders + refundingPayments,
      target: '/admin/orders?quick=AFTER_SALES',
      tone: returnRequestedOrders + returnApprovedOrders + returnShippedOrders + refundingPayments > 0 ? 'risk' : 'ready',
    },
  ];
  const statusChartData = [
    { label: t('status.PENDING_PAYMENT'), value: Number(stats.pendingPaymentOrders || 0), color: '#faad14' },
    { label: t('status.PENDING_SHIPMENT'), value: Number(stats.pendingShipmentOrders || 0), color: '#1677ff' },
    { label: t('status.SHIPPED'), value: shippedOrders, color: '#13c2c2' },
    { label: t('status.COMPLETED'), value: Number(stats.completedOrders || 0), color: '#52c41a' },
    { label: t('status.CANCELLED'), value: Number(stats.cancelledOrders || 0), color: '#ff4d4f' },
  ];
  const topProductColumns = [
    {
      title: t('common.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 72,
      render: (value: string, row: any) => <Avatar shape="square" size={48} src={resolveProductImage(value)}>{String(row.productName || row.productId).slice(0, 1)}</Avatar>,
    },
    { title: t('pages.productAdmin.productName'), dataIndex: 'productName', key: 'productName' },
    { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity', width: 110 },
    {
      title: t('pages.adminDashboard.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      width: 140,
      render: (value: number) => <span className="commerce-money" style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(value)}</span>,
    },
  ];

  return (
    <div className={`admin-dashboard admin-dashboard--${language}`}>
      <div className="admin-dashboard__hero">
        <div>
          <Typography.Text className="admin-dashboard__eyebrow">{t('adminLayout.dashboard')}</Typography.Text>
          <Title level={3}>{t('pages.adminDashboard.title')}</Title>
        </div>
        <div className="admin-dashboard__heroMeta">
          <span>
            <strong>{openActionCount}</strong>
            <small>{t('pages.adminDashboard.actionCenterTitle')}</small>
          </span>
          <span>
            <strong>{trackingCoverage}%</strong>
            <small>{t('pages.adminDashboard.trackingCoverage')}</small>
          </span>
        </div>
      </div>

      <section className={`admin-dashboard__readiness admin-dashboard__readiness--${commercialReadinessTone}`} aria-label={t('pages.adminDashboard.commercialReadiness.title')}>
        <div className="admin-dashboard__readinessScore">
          <span>{t('pages.adminDashboard.commercialReadiness.eyebrow')}</span>
          <strong>{commercialReadinessScore}</strong>
          <Tag color={commercialReadinessTone === 'ready' ? 'green' : commercialReadinessTone === 'watch' ? 'orange' : 'red'}>
            {commercialReadinessLabel}
          </Tag>
        </div>
        <div className="admin-dashboard__readinessCopy">
          <Typography.Text strong>{t('pages.adminDashboard.commercialReadiness.title')}</Typography.Text>
          <Typography.Text type="secondary">
            {t('pages.adminDashboard.commercialReadiness.subtitle', {
              actions: openActionCount,
              sla: operationsSlaRiskTotal,
            })}
          </Typography.Text>
          <Progress
            percent={commercialReadinessScore}
            showInfo={false}
            strokeColor={commercialReadinessTone === 'ready' ? '#52c41a' : commercialReadinessTone === 'watch' ? '#faad14' : '#ee4d2d'}
            trailColor="rgba(18, 71, 52, 0.08)"
          />
        </div>
        <div className="admin-dashboard__readinessGrid">
          {commercialReadinessItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__readinessItem admin-dashboard__readinessItem--${item.tone}`}
              onClick={() => navigate(item.target)}
            >
              <span className="admin-dashboard__readinessIcon">{item.icon}</span>
              <span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className={`admin-dashboard__actionBar admin-dashboard__actionBar--${openActionCount > 0 ? 'active' : 'calm'}`} aria-label={t('pages.adminDashboard.actionCenterTitle')}>
        <div className="admin-dashboard__actionIntro">
          <WarningOutlined />
          <div>
            <Typography.Text strong>{t('pages.adminDashboard.actionCenterTitle')}</Typography.Text>
            <Typography.Text type="secondary">{t('pages.adminDashboard.actionCenterSubtitle')}</Typography.Text>
          </div>
        </div>
        <div className="admin-dashboard__actionGrid">
          {operationalActions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__actionCard admin-dashboard__actionCard--${item.tone}`}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <Typography.Text type="secondary">{item.text}</Typography.Text>
            </button>
          ))}
        </div>
      </div>

      <section className={`admin-dashboard__paymentOps admin-dashboard__paymentOps--${paymentReturnRiskScore === 0 ? 'ready' : paymentReturnRiskScore >= 6 ? 'risk' : 'watch'}`} aria-label={paymentRefundCopy.title}>
        <div className="admin-dashboard__paymentOpsIntro">
          <Typography.Text strong>{paymentRefundCopy.title}</Typography.Text>
          <Typography.Text type="secondary">{paymentRefundCopy.subtitle}</Typography.Text>
          <Tag color={paymentReturnRiskScore === 0 ? 'green' : paymentReturnRiskScore >= 6 ? 'red' : 'orange'}>
            {paymentReturnHealth}
          </Tag>
        </div>
        <div className="admin-dashboard__paymentOpsGrid">
          {paymentReturnCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__paymentOpsCard admin-dashboard__paymentOpsCard--${item.tone}`}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="admin-dashboard__paymentOpsActions">
          <div>
            <Typography.Text strong>{paymentRefundCopy.guideTitle}</Typography.Text>
            <Typography.Text type="secondary">{paymentRefundCopy.guideText}</Typography.Text>
          </div>
          <Space wrap>
            <Button size="small" onClick={() => navigate('/admin/orders?status=PENDING_PAYMENT')}>{paymentRefundCopy.paymentAction}</Button>
            <Button size="small" type="primary" onClick={() => navigate('/admin/orders?quick=RETURN_SHIPPED')}>{paymentRefundCopy.returnAction}</Button>
            <Button size="small" onClick={() => navigate('/admin/audit-logs?view=payment-failures')}>{paymentRefundCopy.auditAction}</Button>
          </Space>
        </div>
      </section>

      <section className={`admin-dashboard__sla admin-dashboard__sla--${operationsSlaRiskTotal === 0 ? 'ready' : operationsSlaRiskTotal >= 4 ? 'risk' : 'watch'}`} aria-label={slaCopy.title}>
        <div className="admin-dashboard__slaIntro">
          <ClockCircleOutlined />
          <div>
            <Typography.Text strong>{slaCopy.title}</Typography.Text>
            <Typography.Text type="secondary">{slaCopy.subtitle}</Typography.Text>
          </div>
          <Tag color={operationsSlaRiskTotal === 0 ? 'green' : operationsSlaRiskTotal >= 4 ? 'red' : 'orange'}>
            {operationsSlaHealth}
          </Tag>
        </div>
        <div className="admin-dashboard__slaGrid">
          {operationsSlaCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__slaCard admin-dashboard__slaCard--${item.tone}`}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <Typography.Text type="secondary">{item.text}</Typography.Text>
            </button>
          ))}
        </div>
      </section>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--catalog">
            <Statistic title={t('pages.adminDashboard.products')} value={stats.totalProducts} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--orders">
            <Statistic title={t('pages.adminDashboard.orders')} value={stats.totalOrders} prefix={<ShoppingOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--users">
            <Statistic title={t('pages.adminDashboard.users')} value={stats.totalUsers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <Statistic title={t('pages.adminDashboard.revenue')} value={Number(stats.totalRevenue || 0)} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--success">
            <Statistic title={t('pages.adminDashboard.paidOrders')} value={stats.paidOrders || 0} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={pendingPaymentOrders > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <Statistic title={t('pages.adminDashboard.pendingPayment')} value={stats.pendingPaymentOrders || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={lowStockProducts > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--danger' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <Statistic title={t('pages.adminDashboard.lowStock')} value={stats.lowStockProducts || 0} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--growth">
            <Statistic title={t('pages.adminDashboard.conversionRate')} value={stats.conversionRate || 0} suffix="%" prefix={<RiseOutlined />} precision={2} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <Statistic title={t('pages.adminDashboard.averageOrderValue')} value={stats.averageOrderValue || 0} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} precision={2} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <Statistic title={t('pages.adminDashboard.netRevenue')} value={netRevenue} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={refundedAmount > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <Statistic title={t('pages.adminDashboard.refundedAmount')} value={refundedAmount} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={refundedOrders > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <Statistic title={t('pages.adminDashboard.refundedOrders')} value={refundedOrders} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={refundRate > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <Statistic title={t('pages.adminDashboard.refundRate')} value={refundRate} suffix="%" prefix={<RiseOutlined />} precision={2} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={8}>
          <Card className="admin-dashboard__panel" title={t('pages.adminDashboard.orderStatus')}>
            <DonutChart
              data={statusChartData}
              labels={{
                noOrderData: t('pages.adminDashboard.noOrderData'),
                orderStatusChart: t('pages.adminDashboard.orderStatusChart'),
                orderUnit: t('pages.adminDashboard.orderUnit'),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className={trackingCoverage < 80 ? 'admin-dashboard__panel admin-dashboard__panel--watch' : 'admin-dashboard__panel admin-dashboard__panel--ready'} title={t('pages.adminDashboard.logisticsHealth')}>
            <Statistic title={t('pages.adminDashboard.trackingCoverage')} value={trackingCoverage} suffix="%" prefix={<TruckOutlined />} />
            <Progress percent={trackingCoverage} strokeColor={trackingCoverage < 80 ? '#faad14' : '#52c41a'} />
            <Space direction="vertical" className="admin-dashboard__metricList">
              <div>
                <span>{t('pages.adminDashboard.shippedOrders')}</span>
                <strong>{shippedOrders}</strong>
              </div>
              <div>
                <span>{t('pages.adminDashboard.withTracking')}</span>
                <strong>{ordersWithTracking}</strong>
              </div>
              <div className={missingTrackingOrders > 0 ? 'admin-dashboard__metricRow--warning' : undefined}>
                <span>{t('pages.adminDashboard.missingTracking')}</span>
                <strong>{stats.ordersWithoutTracking || 0}</strong>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="admin-dashboard__panel admin-dashboard__trackingPanel" title={t('pages.adminDashboard.trackShipment')}>
            <SeventeenTrackWidget height={420} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <Card className="admin-dashboard__panel admin-dashboard__trendPanel" title={t('pages.adminDashboard.salesTrend')}>
            <TrendChart
              data={stats.salesTrend || []}
              formatMoney={formatMoney}
              labels={{
                noTrendData: t('pages.adminDashboard.noTrendData'),
                salesTrendChart: t('pages.adminDashboard.salesTrendChart'),
                orders: t('pages.adminDashboard.orders'),
                revenue: t('pages.adminDashboard.revenue'),
                orderUnit: t('pages.adminDashboard.orderUnit'),
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="admin-dashboard__panel" title={t('pages.adminDashboard.paymentMethods')}>
            <Space direction="vertical" className="admin-dashboard__paymentMethods">
              {Object.entries(stats.paymentMethodBreakdown || {}).map(([method, count]) => (
                <div key={method} className="admin-dashboard__paymentMethod">
                  <div>
                    <span>{paymentMethodLabel(method, t)}</span>
                    <strong>{count}</strong>
                  </div>
                  <Progress percent={Math.round((count / maxPaymentCount) * 100)} showInfo={false} strokeColor="#52c41a" />
                </div>
              ))}
              {Object.keys(stats.paymentMethodBreakdown || {}).length === 0 && (
                <div className="admin-dashboard__emptyState">{t('pages.adminDashboard.noOrderData')}</div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <Card className="admin-dashboard__panel" title={t('pages.adminDashboard.recentOrders')}>
            <Table
              columns={recentOrderColumns}
              dataSource={stats.recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 720 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="admin-dashboard__panel" title={t('pages.adminDashboard.statusBreakdown')}>
            {Object.entries(stats.orderStatusBreakdown || {}).map(([status, count]) => (
              <div key={status} className="admin-dashboard__statusRow">
                <Tag color={getOrderStatusColor(status)}>{formatOrderStatusLabel(status)}</Tag>
                <span>{count}</span>
              </div>
            ))}
            {Object.keys(stats.orderStatusBreakdown || {}).length === 0 && (
              <div className="admin-dashboard__emptyState">{t('pages.adminDashboard.noOrderData')}</div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <Card className="admin-dashboard__panel" title={t('pages.adminDashboard.topProducts')}>
            <Table
              columns={topProductColumns}
              dataSource={stats.topProducts || []}
              rowKey="productId"
              pagination={false}
              size="small"
              scroll={{ x: 620 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className={lowStockProducts > 0 ? 'admin-dashboard__panel admin-dashboard__panel--watch' : 'admin-dashboard__panel admin-dashboard__panel--ready'} title={t('pages.adminDashboard.lowStockList')}>
            <List
              className="admin-dashboard__lowStockList"
              dataSource={stats.lowStockList || []}
              locale={{ emptyText: t('pages.adminDashboard.noLowStock') }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar shape="square" src={resolveProductImage(item.imageUrl)}>{item.name.slice(0, 1)}</Avatar>}
                    title={item.name}
                    description={`${t('common.id')}: ${item.id}`}
                  />
                  <Tag color={(item.stock || 0) <= 0 ? 'red' : 'orange'}>{item.stock}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;

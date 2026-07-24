import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Col, Row, Table } from 'antd';
import {
  ShopOutlined, ShoppingOutlined, TeamOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, RiseOutlined, TruckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { DashboardStats } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import { paymentMethodLabel } from '../utils/paymentMethods';
import { getApiErrorMessage } from '../utils/apiError';
import PageError from '../components/PageError';
import { resolveProductImage } from '../utils/productMedia';
import { isAdminRole } from '../utils/roles';
import { cancelIdleTask, scheduleIdleTask, type ScheduledIdleTask } from '../utils/idleScheduler';
import './AdminDashboard.css';
import ShopButton from '../components/ShopButton';
import ShopSpin from '../components/ShopSpin';
import ShopProgress from '../components/ShopProgress';
import ShopStatistic from '../components/ShopStatistic';
import ShopAvatar from '../components/ShopAvatar';
import ShopList from '../components/ShopList';

import ShopTag from '../components/ShopTag';
import ShopSpace from '../components/ShopSpace';
import ShopTypography from '../components/ShopTypography';
import ShopCard from '../components/ShopCard';
const Title = ShopTypography.Title;

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

type TopDashboardProduct = NonNullable<DashboardStats['topProducts']>[number];

type TrendChartProps = {
  data: Array<{ date: string; orders: number; revenue: number }>;
  formatMoney: (value: number) => string;
  labels: {
    noTrendData: string;
    salesTrendChart: string;
    orders: string;
    revenue: string;
    orderUnit: string;
  };
};

const EMPTY_SALES_TREND: TrendChartProps['data'] = [];

const TrendChartComponent: React.FC<TrendChartProps> = ({ data, formatMoney, labels }) => {
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
            onClick={() => setHoveredIndex(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setHoveredIndex(index);
              }
              if (event.key === 'Escape') {
                setHoveredIndex(null);
              }
            }}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      <ShopSpace size="large" className="admin-dashboard__chartLegend">
        <ShopSpace><span className="admin-dashboard__legendSwatch admin-dashboard__legendSwatch--orders" />{labels.orders}</ShopSpace>
        <ShopSpace><span className="admin-dashboard__legendSwatch admin-dashboard__legendSwatch--revenue" />{labels.revenue}</ShopSpace>
      </ShopSpace>
    </div>
  );
};

const TrendChart = React.memo(TrendChartComponent);
TrendChart.displayName = 'TrendChart';

type DonutChartProps = {
  data: Array<{ label: string; value: number; color: string }>;
  labels: {
    noOrderData: string;
    orderStatusChart: string;
    orderUnit: string;
  };
};

const DonutChartComponent: React.FC<DonutChartProps> = ({ data, labels }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    return <div className="admin-dashboard__chartEmpty admin-dashboard__chartEmpty--compact">{labels.noOrderData}</div>;
  }
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <ShopSpace align="center" className="admin-dashboard__donutChart">
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
      <ShopSpace direction="vertical" size={6}>
        {data.map((item) => (
          <ShopSpace key={item.label}>
            <span className="admin-dashboard__donutSwatch" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </ShopSpace>
        ))}
      </ShopSpace>
    </ShopSpace>
  );
};

const DonutChart = React.memo(DonutChartComponent);
DonutChart.displayName = 'DonutChart';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deferredPanelsReady, setDeferredPanelsReady] = useState(false);
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
    providerReadinessAction: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'),
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
  const dashboardPageLabel = t('pages.adminDashboard.title');
  const dashboardReloadActionLabel = `${t('common.refresh')}: ${dashboardPageLabel}`;
  const commercialReadinessTitle = t('pages.adminDashboard.commercialReadiness.title');
  const actionCenterLabel = t('pages.adminDashboard.actionCenterTitle');
  const dashboardDrilldownLabel = (section: string, label: string, value: number | string) => `${section}: ${label} (${value})`;
  const donutChartLabels = useMemo<DonutChartProps['labels']>(() => ({
    noOrderData: t('pages.adminDashboard.noOrderData'),
    orderStatusChart: t('pages.adminDashboard.orderStatusChart'),
    orderUnit: t('pages.adminDashboard.orderUnit'),
  }), [t]);
  const trendChartLabels = useMemo<TrendChartProps['labels']>(() => ({
    noTrendData: t('pages.adminDashboard.noTrendData'),
    salesTrendChart: t('pages.adminDashboard.salesTrendChart'),
    orders: t('pages.adminDashboard.orders'),
    revenue: t('pages.adminDashboard.revenue'),
    orderUnit: t('pages.adminDashboard.orderUnit'),
  }), [t]);
  const statusChartData = useMemo<DonutChartProps['data']>(() => {
    if (!stats) return [];
    return [
      { label: t('status.PENDING_PAYMENT'), value: Number(stats.pendingPaymentOrders || 0), color: '#faad14' },
      { label: t('status.PENDING_SHIPMENT'), value: Number(stats.pendingShipmentOrders || 0), color: '#1677ff' },
      { label: t('status.SHIPPED'), value: Number(stats.shippedOrders || 0), color: '#13c2c2' },
      { label: t('status.COMPLETED'), value: Number(stats.completedOrders || 0), color: '#52c41a' },
      { label: t('status.CANCELLED'), value: Number(stats.cancelledOrders || 0), color: '#ff4d4f' },
    ];
  }, [stats, t]);
  const salesTrendData = useMemo<TrendChartProps['data']>(
    () => stats?.salesTrend || EMPTY_SALES_TREND,
    [stats?.salesTrend],
  );

  const accessDeniedHandledRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    const fetchStats = async () => {
      if (authLoading) return;
      if (!token || !isAdminRole(user?.role)) {
        // Bail out after one denial update so unstable translator identities
        // (or repeated navigate calls) cannot max out the update depth.
        if (!accessDeniedHandledRef.current) {
          accessDeniedHandledRef.current = true;
          setStats(null);
          setLoadError(t('adminLayout.noPermission'));
          setLoading(false);
          navigate('/', { replace: true });
        }
        return;
      }
      accessDeniedHandledRef.current = false;
      try {
        const res = await adminApi.getDashboard();
        if (disposed) return;
        setStats(res.data);
        setLoadError('');
      } catch (error: unknown) {
        if (disposed) return;
        setLoadError(getApiErrorMessage(error, t('pages.adminDashboard.loadFailed'), language));
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };
    fetchStats();
    return () => {
      disposed = true;
    };
  }, [authLoading, language, navigate, t, token, user?.role]);

  useEffect(() => {
    if (!stats) {
      setDeferredPanelsReady(false);
      return;
    }

    let task: ScheduledIdleTask | null = scheduleIdleTask(() => {
      setDeferredPanelsReady(true);
    }, 900);

    return () => {
      if (task) {
        cancelIdleTask(task);
        task = null;
      }
    };
  }, [stats]);

  if (loading) {
    return (
      <div
        className="admin-dashboard__loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`${t('pages.adminDashboard.title')}: ${t('common.loading')}`}
      >
        <ShopSpin size="large" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="admin-dashboard__error" data-admin-dashboard-load-recovery="true">
        <PageError
          title={t('pages.adminDashboard.loadFailed')}
          description={loadError || t('pages.adminDashboard.loadFailed')}
          actions={[
            {
              key: 'retry',
              label: dashboardReloadActionLabel,
              onClick: () => window.location.reload(),
              type: 'primary',
            },
            {
              key: 'orders',
              label: t('pages.adminDashboard.orders'),
              onClick: () => navigate('/admin/orders'),
              type: 'default',
            },
            {
              key: 'system',
              label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'),
              onClick: () => navigate('/admin/system'),
              type: 'default',
            },
            {
              key: 'products',
              label: t('pages.adminDashboard.products'),
              onClick: () => navigate('/admin/products'),
              type: 'default',
            },
          ]}
        />
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
      render: (v: number) => <span className="commerce-money commerce-money--emphasis">{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <ShopTag color={getOrderStatusColor(s)}>{formatOrderStatusLabel(s)}</ShopTag>,
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
  const dashboardProductName = (item: { id?: number; productId?: number; name?: string; productName?: string }) => (
    (item.productName || item.name || '').trim() || t('pages.profile.productFallback', { id: item.productId || item.id || '-' })
  );
  const topProductColumns = [
    {
      title: t('common.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 72,
      render: (value: string, row: TopDashboardProduct) => {
        const productName = dashboardProductName(row);
        return <ShopAvatar shape="square" size={48} src={resolveProductImage(value)}>{productName.slice(0, 1)}</ShopAvatar>;
      },
    },
    {
      title: t('pages.productAdmin.productName'),
      dataIndex: 'productName',
      key: 'productName',
      render: (_value: string, row: TopDashboardProduct) => dashboardProductName(row),
    },
    { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity', width: 110 },
    {
      title: t('pages.adminDashboard.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      width: 140,
      render: (value: number) => <span className="commerce-money commerce-money--emphasis">{formatMoney(value)}</span>,
    },
  ];

  return (
    <div className={`admin-dashboard admin-dashboard--${language}`}>
      <div className="admin-dashboard__hero">
        <div>
          <ShopTypography.Text className="admin-dashboard__eyebrow">{t('adminLayout.dashboard')}</ShopTypography.Text>
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

      <section className={`admin-dashboard__readiness admin-dashboard__readiness--${commercialReadinessTone}`} aria-label={commercialReadinessTitle}>
        <div className="admin-dashboard__readinessScore">
          <span>{t('pages.adminDashboard.commercialReadiness.eyebrow')}</span>
          <strong>{commercialReadinessScore}</strong>
          <ShopTag color={commercialReadinessTone === 'ready' ? 'green' : commercialReadinessTone === 'watch' ? 'orange' : 'red'}>
            {commercialReadinessLabel}
          </ShopTag>
        </div>
        <div className="admin-dashboard__readinessCopy">
          <ShopTypography.Text strong>{t('pages.adminDashboard.commercialReadiness.title')}</ShopTypography.Text>
          <ShopTypography.Text type="secondary">
            {t('pages.adminDashboard.commercialReadiness.subtitle', {
              actions: openActionCount,
              sla: operationsSlaRiskTotal,
            })}
          </ShopTypography.Text>
          <ShopProgress
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
              aria-label={dashboardDrilldownLabel(commercialReadinessTitle, item.label, item.value)}
              title={dashboardDrilldownLabel(commercialReadinessTitle, item.label, item.value)}
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

      <div className={`admin-dashboard__actionBar admin-dashboard__actionBar--${openActionCount > 0 ? 'active' : 'calm'}`} aria-label={actionCenterLabel}>
        <div className="admin-dashboard__actionIntro">
          <WarningOutlined />
          <div>
            <ShopTypography.Text strong>{t('pages.adminDashboard.actionCenterTitle')}</ShopTypography.Text>
            <ShopTypography.Text type="secondary">{t('pages.adminDashboard.actionCenterSubtitle')}</ShopTypography.Text>
          </div>
        </div>
        <div className="admin-dashboard__actionGrid">
          {operationalActions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__actionCard admin-dashboard__actionCard--${item.tone}`}
              aria-label={dashboardDrilldownLabel(actionCenterLabel, item.title, item.value)}
              title={dashboardDrilldownLabel(actionCenterLabel, item.title, item.value)}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <ShopTypography.Text type="secondary">{item.text}</ShopTypography.Text>
            </button>
          ))}
        </div>
      </div>

      <section className={`admin-dashboard__paymentOps admin-dashboard__paymentOps--${paymentReturnRiskScore === 0 ? 'ready' : paymentReturnRiskScore >= 6 ? 'risk' : 'watch'}`} aria-label={paymentRefundCopy.title}>
        <div className="admin-dashboard__paymentOpsIntro">
          <ShopTypography.Text strong>{paymentRefundCopy.title}</ShopTypography.Text>
          <ShopTypography.Text type="secondary">{paymentRefundCopy.subtitle}</ShopTypography.Text>
          <ShopTag color={paymentReturnRiskScore === 0 ? 'green' : paymentReturnRiskScore >= 6 ? 'red' : 'orange'}>
            {paymentReturnHealth}
          </ShopTag>
        </div>
        <div className="admin-dashboard__paymentOpsGrid">
          {paymentReturnCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__paymentOpsCard admin-dashboard__paymentOpsCard--${item.tone}`}
              aria-label={dashboardDrilldownLabel(paymentRefundCopy.title, item.label, item.value)}
              title={dashboardDrilldownLabel(paymentRefundCopy.title, item.label, item.value)}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="admin-dashboard__paymentOpsActions">
          <div>
            <ShopTypography.Text strong>{paymentRefundCopy.guideTitle}</ShopTypography.Text>
            <ShopTypography.Text type="secondary">{paymentRefundCopy.guideText}</ShopTypography.Text>
          </div>
          <ShopSpace wrap>
            <ShopButton size="small" aria-label={`${paymentRefundCopy.title}: ${paymentRefundCopy.paymentAction}`} title={`${paymentRefundCopy.title}: ${paymentRefundCopy.paymentAction}`} onClick={() => navigate('/admin/orders?status=PENDING_PAYMENT')}>{paymentRefundCopy.paymentAction}</ShopButton>
            <ShopButton size="small" type="primary" aria-label={`${paymentRefundCopy.title}: ${paymentRefundCopy.returnAction}`} title={`${paymentRefundCopy.title}: ${paymentRefundCopy.returnAction}`} onClick={() => navigate('/admin/orders?quick=RETURN_SHIPPED')}>{paymentRefundCopy.returnAction}</ShopButton>
            <ShopButton size="small" aria-label={`${paymentRefundCopy.title}: ${paymentRefundCopy.auditAction}`} title={`${paymentRefundCopy.title}: ${paymentRefundCopy.auditAction}`} onClick={() => navigate('/admin/audit-logs?view=payment-failures')}>{paymentRefundCopy.auditAction}</ShopButton>
            <ShopButton size="small" data-admin-payment-provider-readiness="true" aria-label={`${paymentRefundCopy.title}: ${paymentRefundCopy.providerReadinessAction}`} title={`${paymentRefundCopy.title}: ${paymentRefundCopy.providerReadinessAction}`} onClick={() => navigate('/admin/system')}>{paymentRefundCopy.providerReadinessAction}</ShopButton>
          </ShopSpace>
        </div>
      </section>

      <section className={`admin-dashboard__sla admin-dashboard__sla--${operationsSlaRiskTotal === 0 ? 'ready' : operationsSlaRiskTotal >= 4 ? 'risk' : 'watch'}`} aria-label={slaCopy.title}>
        <div className="admin-dashboard__slaIntro">
          <ClockCircleOutlined />
          <div>
            <ShopTypography.Text strong>{slaCopy.title}</ShopTypography.Text>
            <ShopTypography.Text type="secondary">{slaCopy.subtitle}</ShopTypography.Text>
          </div>
          <ShopTag color={operationsSlaRiskTotal === 0 ? 'green' : operationsSlaRiskTotal >= 4 ? 'red' : 'orange'}>
            {operationsSlaHealth}
          </ShopTag>
        </div>
        <div className="admin-dashboard__slaGrid">
          {operationsSlaCards.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__slaCard admin-dashboard__slaCard--${item.tone}`}
              aria-label={dashboardDrilldownLabel(slaCopy.title, item.title, item.value)}
              title={dashboardDrilldownLabel(slaCopy.title, item.title, item.value)}
              onClick={() => navigate(item.target)}
            >
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <ShopTypography.Text type="secondary">{item.text}</ShopTypography.Text>
            </button>
          ))}
        </div>
      </section>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--catalog">
            <ShopStatistic title={t('pages.adminDashboard.products')} value={stats.totalProducts} prefix={<ShopOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--orders">
            <ShopStatistic title={t('pages.adminDashboard.orders')} value={stats.totalOrders} prefix={<ShoppingOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--users">
            <ShopStatistic title={t('pages.adminDashboard.users')} value={stats.totalUsers} prefix={<TeamOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <ShopStatistic title={t('pages.adminDashboard.revenue')} value={Number(stats.totalRevenue || 0)} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--success">
            <ShopStatistic title={t('pages.adminDashboard.paidOrders')} value={stats.paidOrders || 0} prefix={<CheckCircleOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className={pendingPaymentOrders > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <ShopStatistic title={t('pages.adminDashboard.pendingPayment')} value={stats.pendingPaymentOrders || 0} prefix={<ClockCircleOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className={lowStockProducts > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--danger' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <ShopStatistic title={t('pages.adminDashboard.lowStock')} value={stats.lowStockProducts || 0} prefix={<WarningOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--growth">
            <ShopStatistic title={t('pages.adminDashboard.conversionRate')} value={stats.conversionRate || 0} suffix="%" prefix={<RiseOutlined />} precision={2} />
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__statRow">
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <ShopStatistic title={t('pages.adminDashboard.averageOrderValue')} value={stats.averageOrderValue || 0} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} precision={2} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className="admin-dashboard__statCard admin-dashboard__statCard--money">
            <ShopStatistic title={t('pages.adminDashboard.netRevenue')} value={netRevenue} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className={refundedAmount > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <ShopStatistic title={t('pages.adminDashboard.refundedAmount')} value={refundedAmount} prefix={<DollarOutlined />} formatter={(value) => formatMoney(Number(value || 0))} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className={refundedOrders > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <ShopStatistic title={t('pages.adminDashboard.refundedOrders')} value={refundedOrders} prefix={<WarningOutlined />} />
          </ShopCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <ShopCard className={refundRate > 0 ? 'admin-dashboard__statCard admin-dashboard__statCard--warning' : 'admin-dashboard__statCard admin-dashboard__statCard--calm'}>
            <ShopStatistic title={t('pages.adminDashboard.refundRate')} value={refundRate} suffix="%" prefix={<RiseOutlined />} precision={2} />
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={8}>
          <ShopCard className="admin-dashboard__panel" title={t('pages.adminDashboard.orderStatus')}>
            <DonutChart
              data={statusChartData}
              labels={donutChartLabels}
            />
          </ShopCard>
        </Col>
        <Col xs={24} lg={8}>
          <ShopCard className={trackingCoverage < 80 ? 'admin-dashboard__panel admin-dashboard__panel--watch' : 'admin-dashboard__panel admin-dashboard__panel--ready'} title={t('pages.adminDashboard.logisticsHealth')}>
            <ShopStatistic title={t('pages.adminDashboard.trackingCoverage')} value={trackingCoverage} suffix="%" prefix={<TruckOutlined />} />
            <ShopProgress percent={trackingCoverage} strokeColor={trackingCoverage < 80 ? '#faad14' : '#52c41a'} />
            <ShopSpace direction="vertical" className="admin-dashboard__metricList">
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
            </ShopSpace>
          </ShopCard>
        </Col>
        <Col xs={24} lg={8}>
          <ShopCard className="admin-dashboard__panel admin-dashboard__trackingPanel" title={t('pages.adminDashboard.trackShipment')}>
            {deferredPanelsReady ? (
              <SeventeenTrackWidget height={420} />
            ) : (
              <div className="admin-dashboard__deferredPanelPlaceholder" aria-hidden="true" />
            )}
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <ShopCard className="admin-dashboard__panel admin-dashboard__trendPanel" title={t('pages.adminDashboard.salesTrend')}>
            {deferredPanelsReady ? (
              <TrendChart
                data={salesTrendData}
                formatMoney={formatMoney}
                labels={trendChartLabels}
              />
            ) : (
              <div className="admin-dashboard__deferredPanelPlaceholder admin-dashboard__deferredPanelPlaceholder--trend" aria-hidden="true" />
            )}
          </ShopCard>
        </Col>
        <Col xs={24} lg={8}>
          <ShopCard className="admin-dashboard__panel" title={t('pages.adminDashboard.paymentMethods')}>
            <ShopSpace direction="vertical" className="admin-dashboard__paymentMethods">
              {Object.entries(stats.paymentMethodBreakdown || {}).map(([method, count]) => (
                <div key={method} className="admin-dashboard__paymentMethod">
                  <div>
                    <span>{paymentMethodLabel(method, t)}</span>
                    <strong>{count}</strong>
                  </div>
                  <ShopProgress percent={Math.round((count / maxPaymentCount) * 100)} showInfo={false} strokeColor="#52c41a" />
                </div>
              ))}
              {Object.keys(stats.paymentMethodBreakdown || {}).length === 0 && (
                <div className="admin-dashboard__emptyState">{t('pages.adminDashboard.noOrderData')}</div>
              )}
            </ShopSpace>
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <ShopCard className="admin-dashboard__panel" title={t('pages.adminDashboard.recentOrders')}>
            <Table
              columns={recentOrderColumns}
              dataSource={stats.recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 720 }}
            />
          </ShopCard>
        </Col>
        <Col xs={24} lg={8}>
          <ShopCard className="admin-dashboard__panel" title={t('pages.adminDashboard.statusBreakdown')}>
            {Object.entries(stats.orderStatusBreakdown || {}).map(([status, count]) => (
              <div key={status} className="admin-dashboard__statusRow">
                <ShopTag color={getOrderStatusColor(status)}>{formatOrderStatusLabel(status)}</ShopTag>
                <span>{count}</span>
              </div>
            ))}
            {Object.keys(stats.orderStatusBreakdown || {}).length === 0 && (
              <div className="admin-dashboard__emptyState">{t('pages.adminDashboard.noOrderData')}</div>
            )}
          </ShopCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="admin-dashboard__contentRow">
        <Col xs={24} lg={16}>
          <ShopCard className="admin-dashboard__panel" title={t('pages.adminDashboard.topProducts')}>
            <Table
              columns={topProductColumns}
              dataSource={stats.topProducts || []}
              rowKey="productId"
              pagination={false}
              size="small"
              scroll={{ x: 620 }}
            />
          </ShopCard>
        </Col>
        <Col xs={24} lg={8}>
          <ShopCard className={lowStockProducts > 0 ? 'admin-dashboard__panel admin-dashboard__panel--watch' : 'admin-dashboard__panel admin-dashboard__panel--ready'} title={t('pages.adminDashboard.lowStockList')}>
            <ShopList
              className="admin-dashboard__lowStockList"
              dataSource={stats.lowStockList || []}
              locale={{ emptyText: t('pages.adminDashboard.noLowStock') }}
              renderItem={(item) => {
                const productName = dashboardProductName(item);
                return (
                  <ShopList.Item>
                    <ShopList.Item.Meta
                      avatar={<ShopAvatar shape="square" src={resolveProductImage(item.imageUrl)}>{productName.slice(0, 1)}</ShopAvatar>}
                      title={productName}
                      description={`${t('common.id')}: ${item.id}`}
                    />
                    <ShopTag color={(item.stock || 0) <= 0 ? 'red' : 'orange'}>{item.stock}</ShopTag>
                  </ShopList.Item>
                );
              }}
            />
          </ShopCard>
        </Col>
      </Row>
    </div>
  );
};

export default AdminDashboard;

import React, { useEffect, useState } from 'react';
import { Avatar, Card, Col, Divider, List, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import {
  ShopOutlined, ShoppingOutlined, TeamOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, RiseOutlined, TruckOutlined,
} from '@ant-design/icons';
import { adminApi } from '../api';
import type { DashboardStats } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import { paymentMethodLabel } from '../utils/paymentMethods';
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
  RETURNED: 'purple',
  REFUNDED: 'purple',
};

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
    return <div style={{ color: '#999', textAlign: 'center', padding: 48 }}>{labels.noTrendData}</div>;
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
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={labels.salesTrendChart}
        style={{ width: '100%', minWidth: 560 }}
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
      <Space size="large" style={{ marginTop: 8 }}>
        <Space><span style={{ width: 20, height: 10, display: 'inline-block', background: '#91caff', borderRadius: 3 }} />{labels.orders}</Space>
        <Space><span style={{ width: 20, height: 3, display: 'inline-block', background: '#ee4d2d', borderRadius: 3 }} />{labels.revenue}</Space>
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
    return <div style={{ color: '#999', textAlign: 'center', padding: 32 }}>{labels.noOrderData}</div>;
  }
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Space align="center" style={{ width: '100%', justifyContent: 'space-around' }}>
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
            <span style={{ width: 10, height: 10, borderRadius: 10, display: 'inline-block', background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </Space>
        ))}
      </Space>
    </Space>
  );
};

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { t, language } = useLanguage();
  const { formatMoney } = useMarket();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminApi.getDashboard();
        setStats(res.data);
        setLoadError('');
      } catch (error: any) {
        setLoadError(error?.response?.data?.error || error?.response?.data?.message || error?.message || t('pages.adminDashboard.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [t]);

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  }

  if (!stats) {
    return <div>{loadError || t('pages.adminDashboard.loadFailed')}</div>;
  }

  const recentOrderColumns = [
    { title: t('pages.adminOrders.orderId'), dataIndex: 'id', key: 'id', width: 80 },
    { title: t('common.userId'), dataIndex: 'userId', key: 'userId', width: 80 },
    {
      title: t('common.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v: number) => <span style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{t(`status.${s}`) === `status.${s}` ? s : t(`status.${s}`)}</Tag>,
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
  const trackingCoverage = shippedOrders ? Math.round((ordersWithTracking / shippedOrders) * 100) : 0;
  const pendingShipmentOrders = Number(stats.pendingShipmentOrders || 0);
  const pendingPaymentOrders = Number(stats.pendingPaymentOrders || 0);
  const lowStockProducts = Number(stats.lowStockProducts || 0);
  const missingTrackingOrders = Number(stats.ordersWithoutTracking || 0);
  const operationalActions = [
    {
      key: 'payment',
      value: pendingPaymentOrders,
      title: t('pages.adminDashboard.actionPendingPayment'),
      text: t('pages.adminDashboard.actionPendingPaymentText'),
      tone: pendingPaymentOrders > 0 ? 'warning' : 'calm',
    },
    {
      key: 'shipment',
      value: pendingShipmentOrders,
      title: t('pages.adminDashboard.actionPendingShipment'),
      text: t('pages.adminDashboard.actionPendingShipmentText'),
      tone: pendingShipmentOrders > 0 ? 'info' : 'calm',
    },
    {
      key: 'stock',
      value: lowStockProducts,
      title: t('pages.adminDashboard.actionLowStock'),
      text: t('pages.adminDashboard.actionLowStockText'),
      tone: lowStockProducts > 0 ? 'danger' : 'calm',
    },
    {
      key: 'tracking',
      value: missingTrackingOrders,
      title: t('pages.adminDashboard.actionMissingTracking'),
      text: t('pages.adminDashboard.actionMissingTrackingText'),
      tone: missingTrackingOrders > 0 ? 'warning' : 'calm',
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
      render: (value: string, row: any) => <Avatar shape="square" size={48} src={value}>{String(row.productName || row.productId).slice(0, 1)}</Avatar>,
    },
    { title: t('pages.productAdmin.productName'), dataIndex: 'productName', key: 'productName' },
    { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity', width: 110 },
    {
      title: t('pages.adminDashboard.revenue'),
      dataIndex: 'revenue',
      key: 'revenue',
      width: 140,
      render: (value: number) => <span style={{ color: '#ff5722', fontWeight: 600 }}>{formatMoney(value)}</span>,
    },
  ];

  return (
    <div className="admin-dashboard">
      <Title level={4}>{t('pages.adminDashboard.title')}</Title>
      <Divider />

      <div className="admin-dashboard__actionBar" aria-label={t('pages.adminDashboard.actionCenterTitle')}>
        <div className="admin-dashboard__actionIntro">
          <WarningOutlined />
          <div>
            <Typography.Text strong>{t('pages.adminDashboard.actionCenterTitle')}</Typography.Text>
            <Typography.Text type="secondary">{t('pages.adminDashboard.actionCenterSubtitle')}</Typography.Text>
          </div>
        </div>
        <div className="admin-dashboard__actionGrid">
          {operationalActions.map((item) => (
            <div key={item.key} className={`admin-dashboard__actionCard admin-dashboard__actionCard--${item.tone}`}>
              <strong>{item.value}</strong>
              <span>{item.title}</span>
              <Typography.Text type="secondary">{item.text}</Typography.Text>
            </div>
          ))}
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.products')} value={stats.totalProducts} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.orders')} value={stats.totalOrders} prefix={<ShoppingOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.users')} value={stats.totalUsers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.revenue')} value={Number(stats.totalRevenue || 0)} prefix={<DollarOutlined />} precision={2} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.paidOrders')} value={stats.paidOrders || 0} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.pendingPayment')} value={stats.pendingPaymentOrders || 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.lowStock')} value={stats.lowStockProducts || 0} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title={t('pages.adminDashboard.conversionRate')} value={stats.conversionRate || 0} suffix="%" prefix={<RiseOutlined />} precision={2} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card title={t('pages.adminDashboard.orderStatus')}>
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
          <Card title={t('pages.adminDashboard.logisticsHealth')}>
            <Statistic title={t('pages.adminDashboard.trackingCoverage')} value={trackingCoverage} suffix="%" prefix={<TruckOutlined />} />
            <Progress percent={trackingCoverage} strokeColor={trackingCoverage < 80 ? '#faad14' : '#52c41a'} />
            <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('pages.adminDashboard.shippedOrders')}</span>
                <strong>{shippedOrders}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('pages.adminDashboard.withTracking')}</span>
                <strong>{ordersWithTracking}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('pages.adminDashboard.missingTracking')}</span>
                <strong>{stats.ordersWithoutTracking || 0}</strong>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('pages.adminDashboard.trackShipment')}>
            <SeventeenTrackWidget height={420} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title={t('pages.adminDashboard.salesTrend')}>
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
          <Card title={t('pages.adminDashboard.paymentMethods')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(stats.paymentMethodBreakdown || {}).map(([method, count]) => (
                <div key={method}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{paymentMethodLabel(method, t)}</span>
                    <strong>{count}</strong>
                  </div>
                  <Progress percent={Math.round((count / maxPaymentCount) * 100)} showInfo={false} strokeColor="#52c41a" />
                </div>
              ))}
              {Object.keys(stats.paymentMethodBreakdown || {}).length === 0 && (
                <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>{t('pages.adminDashboard.noOrderData')}</div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title={t('pages.adminDashboard.recentOrders')}>
            <Table
              columns={recentOrderColumns}
              dataSource={stats.recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('pages.adminDashboard.statusBreakdown')}>
            {Object.entries(stats.orderStatusBreakdown || {}).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Tag color={statusColors[status] || 'default'}>{t(`status.${status}`) === `status.${status}` ? status : t(`status.${status}`)}</Tag>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
            {Object.keys(stats.orderStatusBreakdown || {}).length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>{t('pages.adminDashboard.noOrderData')}</div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card title={t('pages.adminDashboard.topProducts')}>
            <Table
              columns={topProductColumns}
              dataSource={stats.topProducts || []}
              rowKey="productId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={t('pages.adminDashboard.lowStockList')}>
            <List
              dataSource={stats.lowStockList || []}
              locale={{ emptyText: t('pages.adminDashboard.noLowStock') }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar shape="square" src={item.imageUrl}>{item.name.slice(0, 1)}</Avatar>}
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

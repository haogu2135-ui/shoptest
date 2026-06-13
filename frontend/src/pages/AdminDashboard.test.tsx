import fs from 'fs';
import path from 'path';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { adminApi } from '../api';
import AdminDashboard from './AdminDashboard';

const readAdminDashboardCss = () => fs.readFileSync(path.resolve(__dirname, 'AdminDashboard.css'), 'utf8');

const mockIdleCallbacks: Array<() => void> = [];

jest.mock('../api', () => ({
  adminApi: {
    getDashboard: jest.fn(),
  },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    formatMoney: (value: number) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../components/SeventeenTrackWidget', () => () => <div data-testid="tracking-widget" />);

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'adminLayout.dashboard': 'Dashboard',
        'common.actions': 'Actions',
        'common.amount': 'Amount',
        'common.image': 'Image',
        'common.quantity': 'Quantity',
        'common.refresh': 'Refresh',
        'common.status': 'Status',
        'common.time': 'Time',
        'common.unknown': 'Unknown',
        'common.userId': 'User ID',
        'pages.adminDashboard.actionCenterSubtitle': 'Start with risks.',
        'pages.adminDashboard.actionCenterTitle': 'Operations action center',
        'pages.adminDashboard.actionLowStock': 'Restock risk',
        'pages.adminDashboard.actionLowStockText': 'Protect best sellers.',
        'pages.adminDashboard.actionMissingTracking': 'Tracking gaps',
        'pages.adminDashboard.actionMissingTrackingText': 'Add tracking.',
        'pages.adminDashboard.actionPendingPayment': 'Payment follow-up',
        'pages.adminDashboard.actionPendingPaymentText': 'Recover pending orders.',
        'pages.adminDashboard.actionPendingShipment': 'Ship next',
        'pages.adminDashboard.actionPendingShipmentText': 'Paid orders waiting.',
        'pages.adminDashboard.actionRefunds': 'Refund watch',
        'pages.adminDashboard.actionRefundsText': `${params?.amount || '$0.00'} refunded.`,
        'pages.adminDashboard.averageOrderValue': 'Avg. order value',
        'pages.adminDashboard.commercialReadiness.afterSales': 'After-sales queue',
        'pages.adminDashboard.commercialReadiness.eyebrow': 'Go-live score',
        'pages.adminDashboard.commercialReadiness.fulfillment': 'Fulfillment gaps',
        'pages.adminDashboard.commercialReadiness.payment': 'Payment blockers',
        'pages.adminDashboard.commercialReadiness.ready': 'Ready',
        'pages.adminDashboard.commercialReadiness.risk': 'Commercial risk',
        'pages.adminDashboard.commercialReadiness.stock': 'Stock risk',
        'pages.adminDashboard.commercialReadiness.subtitle': `${params?.actions || 0} actions, ${params?.sla || 0} SLA risks.`,
        'pages.adminDashboard.commercialReadiness.title': 'Commercial readiness',
        'pages.adminDashboard.commercialReadiness.watch': 'Needs attention',
        'pages.adminDashboard.completedOrders': 'Completed orders',
        'pages.adminDashboard.conversionRate': 'Payment conversion',
        'pages.adminDashboard.loadFailed': 'Failed to load dashboard',
        'pages.adminDashboard.logisticsHealth': 'Logistics health',
        'pages.adminDashboard.lowStock': 'Low stock',
        'pages.adminDashboard.lowStockList': 'Low-stock products',
        'pages.adminDashboard.missingTracking': 'Missing tracking',
        'pages.adminDashboard.netRevenue': 'Net revenue',
        'pages.adminDashboard.noLowStock': 'No low-stock products',
        'pages.adminDashboard.noOrderData': 'No order data',
        'pages.adminDashboard.noTrendData': 'No trend data',
        'pages.adminDashboard.orderStatus': 'Order status',
        'pages.adminDashboard.orderStatusChart': 'Order status chart',
        'pages.adminDashboard.orderUnit': 'orders',
        'pages.adminDashboard.orders': 'Orders',
        'pages.adminDashboard.paidOrders': 'Paid orders',
        'pages.adminDashboard.paymentMethods': 'Payment methods',
        'pages.adminDashboard.paymentReturnOps.auditAction': 'Open audit logs',
        'pages.adminDashboard.paymentReturnOps.guideText': 'Recommended order text.',
        'pages.adminDashboard.paymentReturnOps.guideTitle': 'Recommended order',
        'pages.adminDashboard.paymentReturnOps.healthReady': 'Healthy',
        'pages.adminDashboard.paymentReturnOps.healthRisk': 'Prioritize',
        'pages.adminDashboard.paymentReturnOps.healthWatch': 'Watch',
        'pages.adminDashboard.paymentReturnOps.paymentAction': 'Review payments',
        'pages.adminDashboard.paymentReturnOps.pendingPayment': 'Pending payment',
        'pages.adminDashboard.paymentReturnOps.refunded': 'Refunded',
        'pages.adminDashboard.paymentReturnOps.refunding': 'Refunding',
        'pages.adminDashboard.paymentReturnOps.returnAction': 'Open refund workbench',
        'pages.adminDashboard.paymentReturnOps.returnApproved': 'Awaiting return',
        'pages.adminDashboard.paymentReturnOps.returnRequested': 'Return review',
        'pages.adminDashboard.paymentReturnOps.returnShipped': 'Ready to refund',
        'pages.adminDashboard.paymentReturnOps.subtitle': 'Payment and return queues.',
        'pages.adminDashboard.paymentReturnOps.title': 'Payment and return operations',
        'pages.adminDashboard.pendingPayment': 'Pending payment',
        'pages.adminDashboard.products': 'Products',
        'pages.adminDashboard.recentOrders': 'Recent orders',
        'pages.adminDashboard.refundRate': 'Refund rate',
        'pages.adminDashboard.refundedAmount': 'Refunded amount',
        'pages.adminDashboard.refundedOrders': 'Refunded orders',
        'pages.adminDashboard.revenue': 'Revenue',
        'pages.adminDashboard.salesTrend': 'Last 7 days',
        'pages.adminDashboard.salesTrendChart': 'Sales trend chart',
        'pages.adminDashboard.shippedOrders': 'Shipped orders',
        'pages.adminDashboard.statusBreakdown': 'Order status breakdown',
        'pages.adminDashboard.title': 'Dashboard',
        'pages.adminDashboard.topProducts': 'Top products',
        'pages.adminDashboard.trackShipment': 'Track shipment',
        'pages.adminDashboard.trackingCoverage': 'Tracking coverage',
        'pages.adminDashboard.users': 'Users',
        'pages.adminDashboard.withTracking': 'With tracking',
        'pages.adminDashboard.operationsSla.delayedShipment': 'Delayed shipments',
        'pages.adminDashboard.operationsSla.delayedShipmentText': 'Prioritize fulfillment.',
        'pages.adminDashboard.operationsSla.healthy': 'SLA healthy',
        'pages.adminDashboard.operationsSla.refundDue': 'Refunds overdue',
        'pages.adminDashboard.operationsSla.refundDueText': 'Refund confirmation due.',
        'pages.adminDashboard.operationsSla.returnAwaitingShipment': 'Returns not shipped',
        'pages.adminDashboard.operationsSla.returnAwaitingShipmentText': 'Approved returns need shipment.',
        'pages.adminDashboard.operationsSla.risk': 'High risk',
        'pages.adminDashboard.operationsSla.stalePendingPayment': 'Stale pending payments',
        'pages.adminDashboard.operationsSla.stalePendingPaymentText': 'Review link or follow up.',
        'pages.adminDashboard.operationsSla.subtitle': 'Flags overdue work.',
        'pages.adminDashboard.operationsSla.title': 'Operations SLA risk queue',
        'pages.adminDashboard.operationsSla.watch': 'Needs follow-up',
        'pages.adminOrders.orderId': 'Order ID',
        'pages.productAdmin.productName': 'Product name',
        'pages.profile.productFallback': `Product ${params?.id || '-'}`,
        'status.CANCELLED': 'Cancelled',
        'status.COMPLETED': 'Completed',
        'status.PENDING_PAYMENT': 'Pending payment',
        'status.PENDING_SHIPMENT': 'Pending shipment',
        'status.SHIPPED': 'Shipped',
      };
      return labels[key] || key;
    },
  }),
}));

describe('AdminDashboard chart accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIdleCallbacks.length = 0;
    (window as any).requestIdleCallback = jest.fn((callback: () => void) => {
      mockIdleCallbacks.push(callback);
      return mockIdleCallbacks.length;
    });
    (window as any).cancelIdleCallback = jest.fn();
  });

  afterEach(() => {
    delete (window as any).requestIdleCallback;
    delete (window as any).cancelIdleCallback;
  });

  it('exposes dashboard charts and trend data points with text alternatives', async () => {
    (adminApi.getDashboard as jest.Mock).mockResolvedValueOnce({
      data: {
        totalProducts: 8,
        totalOrders: 10,
        totalUsers: 5,
        totalRevenue: 1234.56,
        paidOrders: 8,
        pendingPaymentOrders: 2,
        pendingShipmentOrders: 1,
        shippedOrders: 3,
        ordersWithTracking: 2,
        ordersWithoutTracking: 1,
        completedOrders: 4,
        cancelledOrders: 0,
        lowStockProducts: 1,
        averageOrderValue: 154.32,
        conversionRate: 62.5,
        refundedOrders: 0,
        refundedAmount: 0,
        refundRate: 0,
        refundingPayments: 0,
        netRevenue: 1234.56,
        operationsSlaRiskTotal: 0,
        operationsSlaRisks: {},
        recentOrders: [],
        orderStatusBreakdown: {
          PENDING_PAYMENT: 2,
          PENDING_SHIPMENT: 1,
          SHIPPED: 3,
          COMPLETED: 4,
        },
        paymentMethodBreakdown: {
          STRIPE: 4,
        },
        salesTrend: [
          { date: '2026-06-01', orders: 3, revenue: 123.45 },
          { date: '2026-06-02', orders: 5, revenue: 456.78 },
        ],
        topProducts: [],
        lowStockList: [],
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('img', { name: 'Order status chart' })).toBeInTheDocument();
    expect(screen.queryByTestId('tracking-widget')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Sales trend chart' })).not.toBeInTheDocument();

    await waitFor(() => expect(mockIdleCallbacks.length).toBeGreaterThan(0));

    act(() => {
      mockIdleCallbacks.forEach((callback) => callback());
    });

    expect(await screen.findByTestId('tracking-widget')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sales trend chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2026-06-01: $123.45, 3 orders' })).toBeInTheDocument();
  });
});

describe('AdminDashboard mobile layout regression guards', () => {
  it('keeps the mobile hero from clipping the commercial-readiness score', () => {
    const css = readAdminDashboardCss();
    const f2810Css = css.slice(css.indexOf('/* F2810'));

    expect(f2810Css).toMatch(/@media \(max-width:\s*720px\)\s*\{/);
    expect(f2810Css).toMatch(/\.admin-dashboard__hero\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?top:\s*auto\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f2810Css).toMatch(/\.admin-dashboard__hero::after\s*\{[\s\S]*?display:\s*none;/);
    expect(f2810Css).toMatch(/\.admin-dashboard__readiness\s*\{[\s\S]*?margin-top:\s*4px;[\s\S]*?scroll-margin-top:\s*16px;/);
    expect(f2810Css).toMatch(/@media \(max-width:\s*430px\)\s*\{[\s\S]*?\.admin-dashboard__heroMeta\s*\{[\s\S]*?overflow-y:\s*visible;/);
  });
});

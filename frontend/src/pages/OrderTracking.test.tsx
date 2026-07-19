import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrderTracking, { ORDER_TRACKING_AUTO_REFRESH_MS, shouldAutoRefreshTrackedOrder } from './OrderTracking';
import { orderApi } from '../api';

const readOrderTrackingSource = () => fs.readFileSync(path.resolve(__dirname, 'OrderTracking.tsx'), 'utf8');
const readOrderTrackingCss = () => fs.readFileSync(path.resolve(__dirname, 'OrderTracking.css'), 'utf8');
const readProfileSource = () => fs.readFileSync(path.resolve(__dirname, 'Profile.tsx'), 'utf8');

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
  createApiAbortController: () => new globalThis.AbortController(),
  orderApi: {
    cancel: jest.fn(),
    confirm: jest.fn(),
    returnOrder: jest.fn(),
    submitReturnShipment: jest.fn(),
    track: jest.fn(),
  },
  paymentApi: {
    create: jest.fn(),
    getByOrder: jest.fn(),
    getChannels: jest.fn(),
  },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../i18n', () => {
  const labels: Record<string, string> = {
    'common.amount': 'Amount',
    'common.cancel': 'Cancel',
    'common.login': 'Log in',
    'common.status': 'Status',
    'common.unknown': 'Unknown',
    'pages.auth.emailInvalid': 'Invalid email',
    'pages.checkout.address': 'Address',
    'pages.checkout.paidTitle': 'Paid',
    'pages.checkout.paymentMethod': 'Payment method',
    'pages.checkout.paymentRecoveryNextPaid': 'Payment received.',
    'pages.checkout.paymentRecoveryNextRetry': 'Try payment again.',
    'pages.checkout.paymentRecoveryPending': 'Payment pending',
    'pages.checkout.paymentUnavailable': 'Payment unavailable',
    'pages.orderTracking.accountDetailsText': 'Log in for details.',
    'pages.orderTracking.accountDetailsTitle': 'Log in for full order details',
    'pages.orderTracking.accountOrderText': 'Log in to continue.',
    'pages.orderTracking.accountOrderTitle': 'Account order found',
    'pages.orderTracking.assuranceActiveTitle': 'Keep this order moving',
    'pages.orderTracking.assuranceDeliveredText': '{count} item(s) were delivered.',
    'pages.orderTracking.assuranceDeliveredTitle': 'Ready for reorder or support',
    'pages.orderTracking.assuranceEyebrow': 'Order assurance',
    'pages.orderTracking.assuranceItems': '{count} item(s)',
    'pages.orderTracking.assurancePreparingText': '{count} item(s) are recorded.',
    'pages.orderTracking.assuranceShippedText': '{count} item(s) are on the way.',
    'pages.orderTracking.assuranceSupportReady': 'Support ready',
    'pages.orderTracking.assuranceTitle': 'Next best order action',
    'pages.orderTracking.assuranceTrackingPending': 'Tracking pending',
    'pages.orderTracking.assuranceTrackingReady': 'Tracking ready',
    'pages.orderTracking.carrier': 'Carrier',
    'pages.orderTracking.confidenceDeliveryPreparing': 'Preparing parcel.',
    'pages.orderTracking.confidenceDeliveryTitle': 'Delivery visibility',
    'pages.orderTracking.confidenceDeliveryTracked': 'Tracking available.',
    'pages.orderTracking.confidenceSupportText': 'Support can review this order.',
    'pages.orderTracking.confidenceSupportTitle': 'Support is ready',
    'pages.orderTracking.createdAt': 'Created at',
    'pages.orderTracking.email': 'Checkout email',
    'pages.orderTracking.emailPlaceholder': 'name@example.com',
    'pages.orderTracking.emailRequired': 'Enter the checkout email',
    'pages.orderTracking.empty': 'Enter an order number and checkout email.',
    'pages.orderTracking.journeyEyebrow': 'Delivery confidence',
    'pages.orderTracking.journeyNoTracking': 'Tracking will appear after handoff.',
    'pages.orderTracking.journeyTitle': 'Where your order is now',
    'pages.orderTracking.journeyWithTracking': 'Tracking {number} is available.',
    'pages.orderTracking.logistics': 'Logistics',
    'pages.orderTracking.nextDeliveredText': 'Delivered.',
    'pages.orderTracking.nextDeliveredTitle': 'Delivered',
    'pages.orderTracking.nextPayText': 'Complete payment.',
    'pages.orderTracking.nextPayTitle': 'Payment still needed',
    'pages.orderTracking.nextPrepareText': 'Tracking will appear once the parcel leaves.',
    'pages.orderTracking.nextPrepareTitle': 'Warehouse preparing',
    'pages.orderTracking.nextSupportText': 'Contact support if unusual.',
    'pages.orderTracking.nextSupportTitle': 'Need a status check?',
    'pages.orderTracking.nextTrackText': 'Use tracking number {number}.',
    'pages.orderTracking.nextTrackTitle': 'Track the carrier',
    'pages.orderTracking.notFound': 'Order not found',
    'pages.orderTracking.notShipped': 'Not shipped yet',
    'pages.orderTracking.orderNo': 'Order number',
    'pages.orderTracking.orderNoPlaceholder': 'SO202605',
    'pages.orderTracking.orderNoRequired': 'Enter the order number',
    'pages.orderTracking.search': 'Track order',
    'pages.orderTracking.shopAgain': 'Shop again',
    'pages.orderTracking.stepDelivered': 'Delivered',
    'pages.orderTracking.stepInTransit': 'In transit',
    'pages.orderTracking.stepPaid': 'Order placed',
    'pages.orderTracking.stepPreparing': 'Preparing',
    'pages.orderTracking.submitReturnTracking': 'Submit return tracking',
    'pages.orderTracking.summary': 'Order summary',
    'pages.orderTracking.title': 'Track order',
    'pages.orderTracking.trackingFailed': 'Failed to query logistics',
    'pages.orderTracking.trackingNumber': 'Tracking number',
    'pages.payment.failed': 'Payment failed',
    'pages.profile.cancelOrder': 'Cancel order',
    'pages.profile.confirmReceipt': 'Confirm receipt',
    'pages.profile.contactSupport': 'Contact support',
    'pages.profile.continuePay': 'Continue payment',
    'pages.profile.noOrderItems': 'No order items',
    'pages.profile.orderItems': 'Order items',
    'pages.profile.productFallback': 'Product #{id}',
    'pages.profile.returnDeadline': 'Return deadline',
    'pages.profile.returnOrder': 'Return order',
    'pages.profile.returnReason': 'Return reason',
    'pages.profile.returnShipmentSubmitted': 'Return shipment submitted',
    'pages.profile.returnTracking': 'Return tracking',
    'status.PENDING_SHIPMENT': 'Pending shipment',
    'status.SHIPPED': 'Shipped',
  };
  const t = (key: string, params?: Record<string, string | number>) => {
    let label = labels[key] || key;
    Object.entries(params || {}).forEach(([name, value]) => {
      label = label.replace(`{${name}}`, String(value));
    });
    return label;
  };
  return {
    useLanguage: () => ({ language: 'en', t }),
  };
});

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  getLocalStorageItemParsed: jest.fn(() => null),
  hasStoredValue: jest.fn(() => false),
}));

jest.mock('../utils/guestSupportContext', () => ({
  loadGuestSupportContext: jest.fn(() => null),
  normalizeGuestSupportContext: jest.fn((value: unknown) => {
    if (!value || typeof value !== 'object') return null;
    const detail = value as { orderNo?: unknown; email?: unknown; guestOrderNo?: unknown; guestEmail?: unknown };
    const orderNo = String(detail.guestOrderNo || detail.orderNo || '').trim();
    const email = String(detail.guestEmail || detail.email || '').trim().toLowerCase();
    return orderNo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { orderNo, email } : null;
  }),
  saveGuestSupportContext: jest.fn(),
}));

jest.mock('../utils/productMedia', () => ({
  productImageFallback: '/fallback.png',
  resolveProductImage: (value: string) => value || '/fallback.png',
}));

jest.mock('../utils/paymentMethods', () => ({
  paymentMethodLabel: (method: string) => method,
}));

jest.mock('../utils/selectedSpecs', () => ({
  formatSelectedSpecs: () => '',
}));

jest.mock('../utils/safeUrl', () => ({
  navigateToSafeUrl: jest.fn(() => true),
}));

jest.mock('../utils/paymentRecovery', () => ({
  getPaymentRecoveryState: () => ({ isExpired: false }),
}));

jest.mock('../utils/guestCart', () => ({
  addGuestCartItem: jest.fn(() => true),
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

jest.mock('../utils/authRedirect', () => ({
  buildLoginUrlFromWindow: () => '/login',
}));

jest.mock('../utils/roles', () => ({
  isAdminRole: () => false,
}));

jest.mock('../components/SeventeenTrackWidget', () => () => <div data-testid="carrier-widget" />);

const makeTrackedOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  orderNo: 'SO202606080001',
  status: 'PENDING_SHIPMENT',
  totalAmount: 125,
  paymentMethod: 'STRIPE',
  shippingAddress: '100 Pet Commerce St',
  createdAt: '2026-06-08T00:00:00Z',
  guestOrder: true,
  ...overrides,
});

const makeTrackResponse = (order: Record<string, unknown>) => ({
  data: {
    detailsRestricted: false,
    items: [],
    order,
  },
});

describe('OrderTracking mobile next-action layout', () => {
  it('uses localized return-request modal copy instead of stale ReturnManagement literals', () => {
    const orderTrackingSource = readOrderTrackingSource();
    const profileSource = readProfileSource();

    expect(orderTrackingSource).not.toContain('ReturnManagement');
    expect(profileSource).not.toContain('ReturnManagement');
    expect(orderTrackingSource).not.toContain('Return request for order');
    expect(profileSource).not.toContain('Return request for order');
    expect(orderTrackingSource).toContain("title={t('pages.profile.returnOrder')}");
    expect(orderTrackingSource).toContain("placeholder={t('pages.profile.returnReasonPlaceholder')}");
    expect(profileSource).toContain("title={t('pages.profile.returnOrder')}");
    expect(profileSource).toContain("placeholder={t('pages.profile.returnReasonPlaceholder')}");
  });

  it('keeps shipped return and support actions visible without a hidden horizontal rail', () => {
    const source = readOrderTrackingSource();
    const css = readOrderTrackingCss();
    const fixCss = css.slice(css.indexOf('F3515:'));

    expect(source).toContain('order-tracking-page__nextActionButtons');
    expect(source).toContain("t('pages.profile.returnOrder')");
    expect(source).toContain("t('pages.profile.contactSupport')");
    expect(fixCss).toMatch(/\.order-tracking-page__nextActionButtons\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(fixCss).toContain('-webkit-mask-image: none !important;');
    expect(fixCss).toContain('mask-image: none !important;');
    expect(fixCss).toMatch(/\.order-tracking-page__nextActionButtons \.ant-space-item\s*\{[\s\S]*?width:\s*100%;[\s\S]*?flex:\s*1 1 100%\s*!important;/);
    expect(fixCss).toMatch(/\.order-tracking-page__nextActionButtons \.ant-btn\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(fixCss).not.toMatch(/F3515:[\s\S]*?overflow-x:\s*auto/);
  });

  it('uses a readable mobile App tracking grid and keeps return modals above fixed rails', () => {
    const css = readOrderTrackingCss();
    const fixCss = css.slice(css.indexOf('F3516:'));

    expect(fixCss).toMatch(/\.order-tracking-page__steps\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?overflow-x:\s*visible\s*!important;[\s\S]*?mask-image:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.order-tracking-page__step span\s*\{[\s\S]*?font-size:\s*12px\s*!important;/);
    expect(fixCss).toMatch(/\.order-tracking-page__returnModal \.ant-modal-content\s*\{[\s\S]*?max-height:\s*calc\(100svh - 92px - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(fixCss).toMatch(/\.order-tracking-page__returnModal \.ant-modal-footer\s*\{[\s\S]*?position:\s*static\s*!important;/);
  });
});

describe('OrderTracking auto refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('refreshes an active tracked order without using the cached lookup result', async () => {
    (orderApi.track as jest.Mock)
      .mockResolvedValueOnce(makeTrackResponse(makeTrackedOrder()))
      .mockResolvedValueOnce(makeTrackResponse(makeTrackedOrder({
        status: 'SHIPPED',
        trackingNumber: '1Z999',
      })));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/track-order']}>
        <OrderTracking />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Order number'), { target: { value: 'SO202606080001' } });
    fireEvent.change(screen.getByLabelText('Checkout email'), { target: { value: 'USER@Example.COM' } });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(orderApi.track).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(ORDER_TRACKING_AUTO_REFRESH_MS);
    });

    await waitFor(() => expect(orderApi.track).toHaveBeenCalledTimes(2));
    expect(orderApi.track).toHaveBeenLastCalledWith(
      'SO202606080001',
      'user@example.com',
      expect.objectContaining({ bypassCache: true, signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByText('1Z999')).toBeInTheDocument();

    unmount();
  });

  it('does not auto-refresh terminal order statuses', () => {
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'PENDING_PAYMENT' }) as any)).toBe(true);
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'SHIPPED' }) as any)).toBe(true);
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'COMPLETED' }) as any)).toBe(false);
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'CANCELLED' }) as any)).toBe(false);
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'RETURN_REFUNDING' }) as any)).toBe(false);
    expect(shouldAutoRefreshTrackedOrder(makeTrackedOrder({ status: 'REFUNDED' }) as any)).toBe(false);
  });

  it('does not poll or render lifecycle fields for account-restricted tracking responses', () => {
    const source = readOrderTrackingSource();
    const summaryStart = source.indexOf("<Card title={t('pages.orderTracking.summary')}>");
    const summaryEnd = source.indexOf("<Card title={t('pages.profile.orderItems')}>", summaryStart);
    const summarySource = source.slice(summaryStart, summaryEnd);

    expect(source).toContain('const autoRefreshEnabled = Boolean(order?.orderNo && trackedEmail && !detailsRestricted && shouldAutoRefreshTrackedOrder(order));');
    expect(summaryStart).toBeGreaterThan(-1);
    expect(summaryEnd).toBeGreaterThan(summaryStart);
    expect(summarySource).toContain("{canShowFullTrackingDetails ? (");
    expect(summarySource).toContain("<Descriptions.Item label={t('common.status')}>");
    expect(summarySource.indexOf("{canShowFullTrackingDetails ? (")).toBeLessThan(summarySource.indexOf("<Descriptions.Item label={t('common.status')}>"));
    expect(summarySource).toContain("<Descriptions.Item label={t('pages.orderTracking.createdAt')}>");
    // createdAt and later lifecycle rows stay behind canShowFullTrackingDetails gates.
    expect(summarySource.indexOf("{canShowFullTrackingDetails ? (")).toBeLessThan(summarySource.indexOf("<Descriptions.Item label={t('pages.orderTracking.createdAt')}>"));
    expect(summarySource).toContain('canShowFullTrackingDetails && order.trackingCarrierName');
    expect(summarySource).toContain('canShowFullTrackingDetails && order.returnDeadline');
    expect(source).toContain('navigate(`/payment/${encodeURIComponent(String(order.orderNo || order.id))}${emailQuery}`)');
  });

  it('prefills URL tracking parameters without auto-submitting an order lookup', () => {
    const source = readOrderTrackingSource();
    const prefillStart = source.indexOf("useEffect(() => {\n    const orderNo = cleanTrackingParam(searchParams.get('orderNo') || searchParams.get('order'), 80);");
    const prefillEnd = source.indexOf('const autoTrackKey = `${paymentReturnStatus}:${orderNo}:${email}`;', prefillStart);
    const prefillBoundary = prefillEnd > prefillStart ? prefillEnd : source.indexOf('const refreshTrackedOrder = useCallback', prefillStart);
    const prefillSource = source.slice(prefillStart, prefillBoundary);

    expect(prefillStart).toBeGreaterThan(-1);
    expect(prefillBoundary).toBeGreaterThan(prefillStart);
    expect(prefillSource).toContain('form.setFieldsValue(email ? { orderNo, email } : { orderNo });');
    expect(prefillSource).toContain('setPrefillNoticeVisible(Boolean(email));');
    expect(prefillSource).toContain('if (sanitized.toString() !== searchParams.toString()) {');
    expect(prefillSource).toContain('setSearchParams(sanitized, { replace: true });');
    expect(prefillSource).not.toContain('trackOrder(');
    expect(prefillSource).not.toContain('void trackOrder');
  });

  it('exposes the public order status journey as a semantic step list', () => {
    const source = readOrderTrackingSource();

    expect(source).toContain('className="order-tracking-page__steps" role="list"');
    expect(source).toContain('role="listitem"');
    expect(source).toContain("aria-current={trackingStep === item.step ? 'step' : undefined}");
    expect(source).toContain('aria-label={item.label}');
    expect(source).not.toContain('OrderTimeline');
  });

  it('resets stale lookup errors and action modals before a new order lookup starts', () => {
    const source = readOrderTrackingSource();
    const trackStart = source.indexOf("const trackOrder = useCallback(async (values: { orderNo: string; email: string }, quiet = false) => {");
    const trackEnd = source.indexOf('const onFinish = (values: { orderNo: string; email: string }) => {', trackStart);
    const trackSource = source.slice(trackStart, trackEnd);
    const apiCallIndex = trackSource.indexOf('await orderApi.track');

    expect(trackStart).toBeGreaterThan(-1);
    expect(trackEnd).toBeGreaterThan(trackStart);
    expect(apiCallIndex).toBeGreaterThan(-1);
    [
      "setLookupError('');",
      'setReturnRequestOpen(false);',
      'setReturnShipmentOpen(false);',
      "setReturnReason('');",
      "setReturnTrackingNumber('');",
    ].forEach((resetCall) => {
      const resetIndex = trackSource.indexOf(resetCall);
      expect(resetIndex).toBeGreaterThan(-1);
      expect(resetIndex).toBeLessThan(apiCallIndex);
    });
  });

  it('auto-tracks payment returns when guest order context is available', () => {
    const source = readOrderTrackingSource();
    expect(source).toContain('paymentReturnAutoTrackKeyRef');
    expect(source).toContain("paymentReturnStatus === 'success'");
    expect(source).toContain("paymentReturnStatus === 'failed'");
    expect(source).toContain('void trackOrder({ orderNo, email }, true);');
    expect(source).toContain("t('pages.orderTracking.paymentReturnLookupHint')");
    expect(source).toContain("onClick={continuePayment}");
    expect(source).toContain("order.status === 'PENDING_PAYMENT' && canOperateTrackedOrder");
    const autoStart = source.indexOf('const autoTrackKey = `${paymentReturnStatus}:${orderNo}:${email}`;');
    expect(autoStart).toBeGreaterThan(-1);
    const prefillStart = source.indexOf("useEffect(() => {\n    const orderNo = cleanTrackingParam(searchParams.get('orderNo') || searchParams.get('order'), 80);");
    const prefillEnd = source.indexOf('const refreshTrackedOrder = useCallback', prefillStart);
    // auto-track effect is between prefill and refreshTrackedOrder now
    const between = source.slice(prefillStart, prefillEnd);
    expect(between).toContain('void trackOrder({ orderNo, email }, true);');
  });

});

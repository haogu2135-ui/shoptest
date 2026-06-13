import { act, render, screen, waitFor } from '@testing-library/react';
import { Payment } from './Payment';
import { paymentApi } from '../api';

jest.mock('../api', () => ({
  paymentApi: { getChannels: jest.fn(), create: jest.fn() },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../i18n', () => {
  const labels: Record<string, string> = {
    'pages.adminOrders.orderLabel': 'Order',
    'pages.checkout.paymentConfidenceTitle': 'Payment confidence',
    'pages.checkout.paymentMethod': 'Payment method',
    'pages.checkout.paymentRequired': 'Select payment',
    'pages.checkout.paymentUnavailable': 'Payment methods are temporarily unavailable',
    'pages.checkout.paymentUnavailableDescription': 'Please try again later.',
    'pages.payment.amount': 'Amount {amount}',
    'pages.payment.channelFallback': 'Secure payment channel',
    'pages.payment.confirm': 'Confirm payment',
    'pages.payment.encrypted': 'Encrypted',
    'pages.paymentInstructions.orderNo': 'Order no',
    'pages.payment.localMethods': 'Local methods',
    'pages.payment.secureEyebrow': 'Secure checkout',
    'pages.payment.secureSubtitle': 'Payment protected',
    'pages.payment.title': 'Payment',
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

jest.mock('../utils/paymentMethods', () => ({
  createPaymentMethodOptions: (_t: unknown, channels: Array<{ code: string; displayName?: string }>) =>
    channels.map((channel) => ({
      label: channel.displayName || channel.code,
      value: channel.code,
    })),
  paymentMethodLabel: (method: string) => method,
}));

jest.mock('../utils/safeUrl', () => ({
  navigateToSafeUrl: jest.fn(() => true),
}));

const channel = {
  code: 'STRIPE',
  displayName: 'Stripe',
  recommended: true,
  enabled: true,
  market: 'US',
};

describe('Payment channel loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads configured channels and selects the recommended method', async () => {
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({ data: [channel] });

    render(
      <Payment amount={12.5} orderId={9} onSuccess={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(await screen.findByRole('radio', { name: /Stripe/ })).toBeChecked();
    expect(screen.getByRole('status', { name: /Stripe/ })).toHaveTextContent('Secure payment channel');
  });

  it('ignores channel responses after unmount', async () => {
    let resolveChannels: (value: unknown) => void = () => undefined;
    (paymentApi.getChannels as jest.Mock).mockReturnValue(new Promise((resolve) => {
      resolveChannels = resolve;
    }));

    const { unmount } = render(
      <Payment amount={12.5} orderId={9} onSuccess={jest.fn()} onCancel={jest.fn()} />,
    );

    unmount();

    await act(async () => {
      resolveChannels({ data: [channel] });
    });

    await waitFor(() => {
      expect(paymentApi.getChannels).toHaveBeenCalledTimes(1);
    });
  });
});

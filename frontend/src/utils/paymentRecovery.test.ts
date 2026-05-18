import { formatPaymentUrlLabel, getPaymentRecoveryState } from './paymentRecovery';

describe('paymentRecovery', () => {
  it('marks paid payments as final even when an expiry date exists', () => {
    const state = getPaymentRecoveryState({ status: ' paid ', expiresAt: '2000-01-01T00:00:00Z' });

    expect(state.isPaid).toBe(true);
    expect(state.isExpired).toBe(false);
  });

  it('detects expired pending payments', () => {
    const state = getPaymentRecoveryState({ status: 'PENDING', expiresAt: '2000-01-01T00:00:00Z' });

    expect(state.isExpired).toBe(true);
    expect(state.minutesLeft).toBe(0);
  });

  it('shortens payment links for safer display', () => {
    const label = formatPaymentUrlLabel('https://pay.example.com/checkout/session/123?token=secret');

    expect(label).toBe('pay.example.com/checkout/session/123');
    expect(label).not.toContain('secret');
  });

  it('rejects unsafe payment link labels', () => {
    expect(formatPaymentUrlLabel('/checkout/session')).toBe('-');
    expect(formatPaymentUrlLabel('javascript:alert(1)')).toBe('-');
    expect(formatPaymentUrlLabel('https://user:pass@pay.example.com/session')).toBe('-');
  });
});

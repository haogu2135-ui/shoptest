import {
  formatPaymentUrlLabel,
  getPaymentRecoveryState,
  navigateToCommercialPaymentUrl,
  resolveCommercialPaymentNavigationUrl,
} from './paymentRecovery';

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

  it('does not calculate recovery windows for malformed expiry dates', () => {
    const dateNowSpy = jest.spyOn(Date, 'now');

    try {
      const state = getPaymentRecoveryState({ status: 'PENDING', expiresAt: 'not-a-date' });

      expect(state).toEqual({
        isPaid: false,
        isExpired: false,
        isExpiringSoon: false,
        minutesLeft: null,
      });
      expect(dateNowSpy).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
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

  it('rewrites storefront payment instruction URLs onto the current shopping origin', () => {
    const rewritten = resolveCommercialPaymentNavigationUrl(
      'https://pet.686888666.xyz/payment/SO123?channel=MERCADO_PAGO&amount=10',
      'https://electrical-measure-duck-contributions.trycloudflare.com',
    );
    expect(rewritten).toBe(
      'https://electrical-measure-duck-contributions.trycloudflare.com/payment/SO123?channel=MERCADO_PAGO&amount=10',
    );
  });

  it('keeps external provider checkout URLs absolute', () => {
    const external = resolveCommercialPaymentNavigationUrl(
      'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=abc',
      'https://pet.686888666.xyz',
    );
    expect(external).toBe('https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=abc');
  });

  it('navigates via the rewritten commercial payment URL', () => {
    const hits: string[] = [];
    const ok = navigateToCommercialPaymentUrl(
      'https://pet.686888666.xyz/payment/SO999?channel=OXXO',
      (url) => { hits.push(url); },
      { currentOrigin: 'http://127.0.0.1:4187', allowInsecureHttp: true },
    );
    expect(ok).toBe(true);
    expect(hits).toEqual(['http://127.0.0.1:4187/payment/SO999?channel=OXXO']);
  });

  it('displays storefront payment links on the current shopping origin', () => {
    const label = formatPaymentUrlLabel(
      'https://pet.686888666.xyz/payment/SO123?channel=MERCADO_PAGO',
      'http://127.0.0.1:4187',
    );
    expect(label).toContain('127.0.0.1');
    expect(label).toContain('/payment/SO123');
    expect(label).not.toContain('pet.686888666.xyz');
  });

});

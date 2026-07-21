import {
  badgeKeyForPaymentMarket,
  createPaymentMethodDetails,
  createPaymentMethodOptions,
  filterPaymentChannelsForMarket,
  paymentMethodOrder,
} from './paymentMethods';
import type { PaymentChannel } from '../types';

const geoRankedChannels: PaymentChannel[] = [
  { code: 'MERCADO_PAGO', displayName: 'Mercado Pago', market: 'MX', sortOrder: 20, recommended: true },
  { code: 'OXXO', displayName: 'OXXO Pay', market: 'MX', sortOrder: 30 },
  { code: 'SPEI', displayName: 'SPEI', market: 'MX', sortOrder: 40 },
  { code: 'PAYPAL', displayName: 'PayPal', market: 'GLOBAL', sortOrder: 100 },
  { code: 'ALIPAY', displayName: 'Alipay', market: 'CN', sortOrder: 70 },
  { code: 'WECHAT_PAY', displayName: 'WeChat Pay', market: 'CN', sortOrder: 80 },
] as PaymentChannel[];

describe('paymentMethods geo ranking', () => {
  it('preserves backend Mexico-first channel order instead of raw sortOrder', () => {
    const details = createPaymentMethodDetails(geoRankedChannels, { hideForeignRails: false });
    expect(details.map((d) => d.value)).toEqual([
      'MERCADO_PAGO',
      'OXXO',
      'SPEI',
      'PAYPAL',
      'ALIPAY',
      'WECHAT_PAY',
    ]);
    const paypalIdx = details.findIndex((d) => d.value === 'PAYPAL');
    const alipayIdx = details.findIndex((d) => d.value === 'ALIPAY');
    expect(paypalIdx).toBeLessThan(alipayIdx);
  });

  it('hides CN rails for MXN shoppers (Mexico-first conversion)', () => {
    const details = createPaymentMethodDetails(geoRankedChannels, { currency: 'MXN' });
    const codes = details.map((d) => d.value);
    expect(codes).toEqual(['MERCADO_PAGO', 'OXXO', 'SPEI', 'PAYPAL']);
    expect(codes).not.toContain('ALIPAY');
    expect(codes).not.toContain('WECHAT_PAY');
    expect(filterPaymentChannelsForMarket(geoRankedChannels, { currency: 'MXN' }).map((c) => c.code))
      .toEqual(['MERCADO_PAGO', 'OXXO', 'SPEI', 'PAYPAL']);
  });

  it('keeps createPaymentMethodOptions on the same geo order', () => {
    const options = createPaymentMethodOptions((key) => key, geoRankedChannels, { hideForeignRails: false });
    expect(options.map((o) => o.value)).toEqual([
      'MERCADO_PAGO',
      'OXXO',
      'SPEI',
      'PAYPAL',
      'ALIPAY',
      'WECHAT_PAY',
    ]);
  });

  it('uses honest market badges (GLOBAL is not labeled Mexico)', () => {
    const details = createPaymentMethodDetails(geoRankedChannels, { hideForeignRails: false });
    expect(details.find((d) => d.value === 'MERCADO_PAGO')?.badgeKey).toBe('pages.checkout.paymentMexico');
    expect(details.find((d) => d.value === 'PAYPAL')?.badgeKey).toBe('pages.checkout.paymentGlobal');
    expect(details.find((d) => d.value === 'ALIPAY')?.badgeKey).toBe('pages.checkout.paymentChina');
    expect(badgeKeyForPaymentMarket('GLOBAL')).toBe('pages.checkout.paymentGlobal');
  });

  it('keeps fallback paymentMethodOrder Mercado-first for offline defaults', () => {
    expect(paymentMethodOrder[0]).toBe('MERCADO_PAGO');
    expect(paymentMethodOrder.indexOf('PAYPAL')).toBeLessThan(paymentMethodOrder.indexOf('ALIPAY'));
  });

  it('never recommends or resolves CN rails for MXN even when remembered or backend-flagged', () => {
    const cnRecommended = geoRankedChannels.map((channel) => (
      channel.code === 'ALIPAY'
        ? { ...channel, recommended: true }
        : { ...channel, recommended: false }
    ));
    const allowed = filterPaymentChannelsForMarket(cnRecommended, { currency: 'MXN' }).map((c) => c.code);
    expect(allowed).toEqual(['MERCADO_PAGO', 'OXXO', 'SPEI', 'PAYPAL']);
    expect(allowed).not.toContain('ALIPAY');
    // createPaymentMethodDetails is the source of selectable checkout rails
    expect(createPaymentMethodDetails(cnRecommended, { currency: 'MXN' }).map((d) => d.value)).toEqual(allowed);
    // remembered CN method must not survive MXN filter
    expect(allowed.includes('ALIPAY' as never)).toBe(false);
  });
});

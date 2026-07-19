const readCartSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'Cart.tsx'), 'utf8')
);

export {};

describe('Cart type-safety guard', () => {
  it('keeps cart recoverable failures typed without broad any escapes', () => {
    const source = readCartSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|any\[\]/);
    expect(source).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(source).not.toContain('const getErrorResponseStatus = (error: unknown)');
    expect(source).not.toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.cart.quantityFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
  });

  it('recovers cancelled or failed payment returns with actionable storefront guidance', () => {
    const source = readCartSource();

    expect(source).toContain("import { Link, useNavigate, useSearchParams } from 'react-router-dom';");
    expect(source).toContain("const paymentReturnStatus = String(searchParams.get('payment') || '').trim().toLowerCase();");
    expect(source).toContain("paymentReturnStatus === 'cancelled'");
    expect(source).toContain("paymentReturnStatus === 'failed'");
    expect(source).toContain("className=\"cart-page__paymentReturn\"");
    expect(source).toContain("t('pages.cart.paymentCancelledTitle')");
    expect(source).toContain("t('pages.cart.paymentFailedTitle')");
    expect(source).toContain("t('pages.cart.paymentCancelledResume')");
    expect(source).toContain("'/profile?tab=orders'");
    expect(source).toContain('`/profile?tab=orders&orderNo=${encodeURIComponent(paymentReturnOrderNo)}`');
    expect(source).toContain('clearPaymentReturnParams');
  });

});

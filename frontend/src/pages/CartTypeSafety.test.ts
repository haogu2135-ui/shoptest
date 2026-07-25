const readCartSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'Cart.tsx'), 'utf8')
);
const readCartSessionDataSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useCartSessionData.ts'), 'utf8')
);
const readCartHelpersSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'cartHelpers.ts'), 'utf8')
);
const readCartSurface = (): string => (
  [
    readCartSource(),
    readCartHelpersSource(),
    readCartSessionDataSource(),
    require('fs').readFileSync(require('path').resolve(__dirname, 'cartShellStates.tsx'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, 'cartConversionPanels.tsx'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, 'cartLineItems.tsx'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, 'cartSavedPanel.tsx'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, 'cartOverviewPanels.tsx'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useCartItemMutations.ts'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useCartQuantityActions.ts'), 'utf8'),
    require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useCartRecoveryAdds.ts'), 'utf8'),
  ].join('\n')
);

export {};

describe('Cart type-safety guard', () => {
  it('keeps cart recoverable failures typed without broad any escapes', () => {
    const page = readCartSource();
    const source = readCartSurface();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|any\[\]/);
    expect(readCartSessionDataSource()).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(page).not.toContain('const getErrorResponseStatus = (error: unknown)');
    expect(page).not.toContain('const isAuthExpiredError = (error: unknown)');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.cart.quantityFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
  });

  it('recovers cancelled or failed payment returns with actionable storefront guidance', () => {
    const page = readCartSource();
    const source = readCartSurface();

    expect(page).toContain("import { useNavigate, useSearchParams } from 'react-router-dom';");
    expect(page).toContain("const paymentReturnStatus = String(searchParams.get('payment') || '').trim().toLowerCase();");
    expect(page).toContain("paymentReturnStatus === 'cancelled'");
    expect(page).toContain("paymentReturnStatus === 'failed'");
    expect(page).toContain('<CartPaymentReturnBanner');
    expect(source).toContain("className=\"cart-page__paymentReturn\"");
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).toContain("t('pages.cart.paymentCancelledTitle')");
    expect(source).toContain("t('pages.cart.paymentFailedTitle')");
    expect(source).toContain("t('pages.cart.paymentCancelledResume')");
    expect(source).toContain("'/profile?tab=orders'");
    expect(source).toContain('`/profile?tab=orders&orderNo=${encodeURIComponent(paymentReturnOrderNo)}`');
    expect(page).toContain('clearPaymentReturnParams');
  });


  it('announces cart recovery and stale-data alerts accessibly', () => {
    const source = readCartSurface();
    expect(source).toContain('className="cart-page__paymentReturn"');
    expect(source).toContain('className="cart-page__loadErrorAlert"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
  });

});

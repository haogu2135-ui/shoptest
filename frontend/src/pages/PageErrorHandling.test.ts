const readPageSource = (filename: string): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, filename), 'utf8')
);

const readHookSource = (filename: string): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '..', 'hooks', filename), 'utf8')
);

const expectNoConsoleOnlyCatch = (source: string) => {
  expect(source).not.toContain('console.error');
  expect(source).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*console\.error/);
};

export {};

describe('customer page error handling source guards', () => {
  it('keeps cart, checkout, and profile failures out of console-only catch blocks', () => {
    const cartSource = readPageSource('Cart.tsx');
    const checkoutSource = readPageSource('Checkout.tsx');
    const cartActionSource = `${readHookSource('useCartItemMutations.ts')}\n${readHookSource('useCartCheckoutSubmit.ts')}`;
    const checkoutActionSource = `${readHookSource('useCheckoutCartBootstrap.ts')}\n${readHookSource('useCheckoutOrderActions.ts')}\n${readHookSource('useCheckoutPaymentLifecycle.ts')}`;
    const profileActionSource = `${readHookSource('useProfileAccountActions.ts')}\n${readHookSource('useProfileAddressActions.ts')}\n${readHookSource('useProfilePaymentActions.ts')}`;

    [cartSource, cartActionSource, checkoutSource, checkoutActionSource, profileActionSource].forEach(expectNoConsoleOnlyCatch);

    expect(cartActionSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');");
    expect(cartActionSource).toContain("announceAccessibleMessage(t('pages.cart.checkoutSyncFailed'), 'warning');");
    expect(checkoutActionSource).toContain("showCheckoutMessage('error', t('pages.checkout.loadFailed'))");
    expect(checkoutActionSource).toContain("showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));");
    expect(checkoutActionSource).toContain("setPaymentCreateError(getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language));");
    expect(profileActionSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.passwordFailed'), language), 'error');");
    expect(profileActionSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.addressSaveFailed'), language), 'error');");
    expect(profileActionSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, latestT('pages.profile.continuePayFailed'), latestLanguage, { includeClientMessage: true }), 'error');");
  });
});

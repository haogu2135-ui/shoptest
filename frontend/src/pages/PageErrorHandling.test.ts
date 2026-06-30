const readPageSource = (filename: string): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, filename), 'utf8')
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
    const profileSource = readPageSource('Profile.tsx');

    [cartSource, checkoutSource, profileSource].forEach(expectNoConsoleOnlyCatch);

    expect(cartSource).toContain("message.error(getApiErrorMessage(err, t('messages.deleteFailed'), language));");
    expect(cartSource).toContain("message.warning(t('pages.cart.checkoutSyncFailed'))");
    expect(checkoutSource).toContain("showCheckoutMessage('error', t('pages.checkout.loadFailed'))");
    expect(checkoutSource).toContain("showCheckoutMessage('error', getApiErrorMessage(error, t('pages.checkout.orderCreateFailed'), language));");
    expect(checkoutSource).toContain("setPaymentCreateError(getApiErrorMessage(paymentError, t('pages.payment.createFailed'), language));");
    expect(profileSource).toContain("message.error(getApiErrorMessage(err, t('pages.profile.passwordFailed'), language));");
    expect(profileSource).toContain("message.error(getApiErrorMessage(err, t('pages.profile.addressSaveFailed'), language));");
    expect(profileSource).toContain("message.error(getApiErrorMessage(err, t('pages.profile.continuePayFailed'), language, { includeClientMessage: true }));");
  });
});

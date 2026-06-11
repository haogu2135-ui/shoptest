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
});

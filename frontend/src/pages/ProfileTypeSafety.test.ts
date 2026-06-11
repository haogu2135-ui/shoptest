const readProfileSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8')
);

export {};

describe('Profile type-safety guard', () => {
  it('keeps profile recoverable failures typed without broad any escapes', () => {
    const source = readProfileSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|any\[\]/);
    expect(source).not.toContain('err?.errorFields');
    expect(source).not.toContain('err.response?.data');
    expect(source).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(source).toContain('const getProfileApiErrorData = (error: unknown): Record<string, unknown> =>');
    expect(source).toContain('const getProfileApiErrorCode = (error: unknown) =>');
    expect(source).toContain("const getProfileErrorMessage = (error: unknown, fallback: string, language: ReturnType<typeof useLanguage>['language']) =>");
    expect(source).toContain('if (isFormValidationError(err)) return;');
    expect(source).toContain("message.error(getProfileErrorMessage(err, t('pages.profile.continuePayFailed'), language));");
  });

  it('keeps payment-return synchronization off the mutable orders dependency', () => {
    const source = readProfileSource();

    expect(source).toContain('const [ordersInitialLoadComplete, setOrdersInitialLoadComplete] = useState(false);');
    expect(source).toContain('const ordersRef = useRef<OrderCustomer[]>([]);');
    expect(source).toContain('ordersRef.current = sortedOrders;');
    expect(source).toContain('setOrdersInitialLoadComplete(true);');
    expect(source).toContain("if (!ordersInitialLoadComplete) return;");
    expect(source).toContain('const targetOrder = ordersRef.current.find(');
    expect(source).toMatch(/\}, \[fetchOrders, ordersInitialLoadComplete, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
    expect(source).not.toMatch(/\}, \[fetchOrders, orders, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
  });
});

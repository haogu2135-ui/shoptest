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
    const syncStart = source.indexOf('const syncPaymentReturnState = useCallback(async (order: OrderCustomer) => {');
    const addressesStart = source.indexOf('const fetchAddresses = useCallback(async () => {', syncStart);
    const syncSource = source.slice(syncStart, addressesStart);
    const paymentReturnEffectStart = source.indexOf("if (paymentReturnStatus !== 'success') return;");
    const emailCodeEffectStart = source.indexOf('if (profileEmailCodeCountdown <= 0) return;', paymentReturnEffectStart);
    const paymentReturnEffectSource = source.slice(paymentReturnEffectStart, emailCodeEffectStart);

    expect(source).toContain('const [ordersInitialLoadComplete, setOrdersInitialLoadComplete] = useState(false);');
    expect(source).toContain('const ordersRef = useRef<OrderCustomer[]>([]);');
    expect(source).toContain('const paymentReturnSyncSeqRef = useRef(0);');
    expect(source).toContain('paymentReturnSyncSeqRef.current += 1;');
    expect(source).toContain('ordersRef.current = sortedOrders;');
    expect(source).toContain('setOrdersInitialLoadComplete(true);');
    expect(source).toContain("if (!ordersInitialLoadComplete) return;");
    expect(source).toContain('const targetOrder = ordersRef.current.find(');
    expect(syncStart).toBeGreaterThan(-1);
    expect(addressesStart).toBeGreaterThan(syncStart);
    expect(paymentReturnEffectStart).toBeGreaterThan(-1);
    expect(emailCodeEffectStart).toBeGreaterThan(paymentReturnEffectStart);
    expect(syncSource).toContain('const syncSeq = paymentReturnSyncSeqRef.current + 1;');
    expect(syncSource).toContain('paymentReturnSyncSeqRef.current = syncSeq;');
    expect(syncSource).toContain('const isCurrentPaymentReturnSync = () => mountedRef.current && paymentReturnSyncSeqRef.current === syncSeq;');
    expect(syncSource).toContain('const paymentListRes = await paymentApi.syncByOrder(order.id);');
    expect(syncSource).toContain('const mergedPayments = paymentListRes.data || [];');
    expect(syncSource).not.toContain('paymentApi.getByOrder(order.id)');
    expect(syncSource).not.toContain('paymentApi.sync(payment.id)');
    expect(syncSource).not.toContain('Promise.all(paymentList.map');
    expect(syncSource.match(/if \(!isCurrentPaymentReturnSync\(\)\) return;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(syncSource).toContain('await fetchOrders();');
    expect(paymentReturnEffectSource).toContain('syncPaymentReturnState(targetOrder).catch(() => {');
    expect(paymentReturnEffectSource).toContain('if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {');
    expect(paymentReturnEffectSource.indexOf('if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {')).toBeLessThan(paymentReturnEffectSource.indexOf("message.error(t('pages.profile.paymentReturnSyncFailed'));"));
    expect(source).toMatch(/\}, \[fetchOrders, ordersInitialLoadComplete, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
    expect(source).not.toMatch(/\}, \[fetchOrders, orders, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
  });
});

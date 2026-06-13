const readOrderManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'OrderManagement.tsx'), 'utf8')
);

export {};

describe('OrderManagement type-safety guard', () => {
  it('keeps admin order failures and render placeholders typed without broad any escapes', () => {
    const source = readOrderManagementSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|window as any\b|any\[\]/);
    expect(source).not.toContain('render: (_: any');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain('render: (_: unknown, record: Order) => renderCustomer(record)');
    expect(source).toContain('render: (_: unknown, payment: AdminPayment) =>');
    expect(source).toContain('render: (_: unknown, item: OrderItem) =>');
    expect(source).toContain("getApiErrorMessage(err, t('pages.adminOrders.paymentSyncFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.adminOrders.exportFailed'), language)");
  });

  it('keeps OrderManagement non-blocking diagnostics using a string context first', () => {
    const source = readOrderManagementSource();

    expect(source).toContain("reportNonBlockingError('OrderManagement carriers load failed', error);");
    expect(source).toContain("reportNonBlockingError('OrderManagement.formatLabelSpecs', error);");
    expect(source).toContain("reportNonBlockingError('OrderManagement.loadLabelItems', error);");
    expect(source).toContain("reportNonBlockingError('OrderManagement.printShippingLabel', error);");
    expect(source).toContain("reportNonBlockingError('OrderManagement.openRefundModal.payments', error);");
    expect(source).not.toContain("reportNonBlockingError(err, 'order-actions-reorder')");
    expect(source).not.toMatch(/reportNonBlockingError\s*\(\s*(err|error|[A-Za-z_$][\w$]*Error)\s*,/);
  });
});

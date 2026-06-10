const readCouponManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'CouponManagement.tsx'), 'utf8')
);

export {};

describe('CouponManagement type-safety guard', () => {
  it('keeps admin coupon failures and table renders typed without broad any escapes', () => {
    const source = readCouponManagementSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|any\[\]/);
    expect(source).not.toContain('error?.errorFields');
    expect(source).not.toContain('render: (_: any, record: Coupon)');
    expect(source).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(source).toContain('if (isFormValidationError(error)) return;');
    expect(source).toContain('if (!isFormValidationError(error)) {');
    expect(source).toContain('render: (_: unknown, record: Coupon) =>');
    expect(source).toContain("getApiErrorMessage(error, t('pages.adminCoupons.grantFailed'), language)");
  });
});

const readProductManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'ProductManagement.tsx'), 'utf8')
);

export {};

describe('ProductManagement catch/render type-safety guard', () => {
  it('keeps admin product failures and table render placeholders typed without broad any escapes', () => {
    const source = readProductManagementSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|productImportResultFromError = \(error: any\)|importErrorMessageFromError = \(error: any\)|render: \(_: any|filteredProducts\.map\(\(product: any\)/);
    expect(source).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(source).toContain('const getErrorResponseData = (error: unknown): unknown =>');
    expect(source).toContain('const isProductImportResultPayload = (value: unknown): value is Partial<ProductImportResult> =>');
    expect(source).toContain('const productImportResultFromError = (error: unknown): ProductImportResult | null =>');
    expect(source).toContain("const importErrorMessageFromError = (error: unknown, fallback: string, language: ReturnType<typeof useLanguage>['language']) =>");
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain('if (isFormValidationError(error)) return;');
    expect(source).toContain('const rows = filteredProducts.map((product: Product) =>');
    expect(source).toContain('render: (_: unknown, record: Product) => renderPrice(record)');
    expect(source).toContain('render: (_: unknown, record: Product) => {');
  });
});

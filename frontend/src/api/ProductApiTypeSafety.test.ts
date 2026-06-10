const readApiSource = (): string => require('fs').readFileSync(require('path').resolve(__dirname, 'index.ts'), 'utf8');

export {};

describe('product API type-safety guard', () => {
  it('normalizes product responses without broad any casts', () => {
    const source = readApiSource();
    const productNormalizationStart = source.indexOf('const normalizeProductImages =');
    const productNormalizationEnd = source.indexOf('const cacheProductDetailFromList =');
    const productNormalizationSource = source.slice(productNormalizationStart, productNormalizationEnd);

    expect(productNormalizationStart).toBeGreaterThan(-1);
    expect(productNormalizationEnd).toBeGreaterThan(productNormalizationStart);
    expect(source).toContain('const isRecord = (value: unknown): value is Record<string, unknown>');
    expect(productNormalizationSource).not.toMatch(/\(product as any\)|\(group as any\)|\(raw as any\)|\bas any\b/);
    expect(productNormalizationSource).toContain('parseMaybeJson(product.images)');
    expect(productNormalizationSource).toContain('normalizeStringListParam(group.options, 40, 120)');
    expect(productNormalizationSource).toContain('Number(rawRecord.total ?? rawRecord.totalElements ?? items.length)');
  });
});

const readProductDetailSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'ProductDetail.tsx'), 'utf8')
);

export {};

describe('ProductDetail type-safety guard', () => {
  it('keeps product detail state, recommendation rows, and recoverable failures typed without broad any escapes', () => {
    const source = readProductDetailSource();

    expect(source).not.toMatch(/normalizeProductImages = \(product: any\)|useState<any>|catch \([^)]*: any\)|Product \| any|rec: any|as any\b|window as any\b|any\[\]/);
    expect(source).toContain('const normalizeProductImages = (product: Partial<Product> | null | undefined) =>');
    expect(source).toContain('const [product, setProduct] = useState<Product | null>(null);');
    expect(source).toContain('const [recommendations, setRecommendations] = useState<Product[]>([]);');
    expect(source).toContain('const isRecommendationUnavailable = (item: Product) =>');
    expect(source).toContain('const handleAddRecommendationToCart = async (event: React.MouseEvent<HTMLElement>, item: Product) =>');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.ask.askFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
    expect(source).toContain('recommendations.map((rec) =>');
  });
});

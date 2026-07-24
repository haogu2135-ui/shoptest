const readProductDetailSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'ProductDetail.tsx'), 'utf8')
);

const readProductDetailHelpersSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'productDetailHelpers.tsx'), 'utf8')
);

const readProductDetailNonCriticalSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProductDetailNonCriticalContent.ts'), 'utf8')
);

const readProductDetailEngagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProductDetailEngagementActions.ts'), 'utf8')
);

const readProductDetailCommunitySource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProductDetailCommunityActions.ts'), 'utf8')
);

const readProductDetailRecommendationSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProductDetailRecommendationActions.ts'), 'utf8')
);

const readProductDetailRecommendationsPanelSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'productDetailRecommendations.tsx'), 'utf8')
);

export {};

describe('ProductDetail type-safety guard', () => {
  it('keeps product detail state, recommendation rows, and recoverable failures typed without broad any escapes', () => {
    const source = readProductDetailSource();
    const helpersSource = readProductDetailHelpersSource();
    const engagementSource = readProductDetailEngagementSource();
    const communitySource = readProductDetailCommunitySource();
    const recommendationSource = readProductDetailRecommendationSource();
    const recommendationsPanel = readProductDetailRecommendationsPanelSource();
    const surface = `${source}\n${helpersSource}\n${engagementSource}\n${communitySource}\n${recommendationSource}\n${recommendationsPanel}\n${readProductDetailNonCriticalSource()}`;

    expect(surface).not.toMatch(/normalizeProductImages = \(product: any\)|useState<any>|catch \([^)]*: any\)|Product \| any|rec: any|as any\b|window as any\b|any\[\]/);
    expect(source).toContain("from './productDetailHelpers'");
    expect(source).toContain("from '../hooks/useProductDetailNonCriticalContent'");
    expect(source).toContain("from '../hooks/useProductDetailEngagementActions'");
    expect(source).toContain("from '../hooks/useProductDetailCommunityActions'");
    expect(source).toContain("from '../hooks/useProductDetailRecommendationActions'");
    expect(source).toContain('useProductDetailEngagementActions({');
    expect(source).toContain('useProductDetailCommunityActions({');
    expect(source).toContain('useProductDetailRecommendationActions({');
    expect(source).toContain('normalizeProductImages');
    expect(helpersSource).toContain('export const normalizeProductImages = (product: ProductRecommendationCandidate | null | undefined) =>');
    expect(helpersSource).toContain('export const findSelectedProductVariant');
    expect(helpersSource).toContain('export const buildSelectedSpecsPayload');
    expect(readProductDetailNonCriticalSource()).toContain('export const useProductDetailNonCriticalContent');
    expect(readProductDetailNonCriticalSource()).toContain('} catch (error) {');
    expect(engagementSource).toContain('export const useProductDetailEngagementActions');
    expect(engagementSource).toContain('} catch (err: unknown) {');
    expect(communitySource).toContain('export const useProductDetailCommunityActions');
    expect(readProductDetailRecommendationSource()).toContain('export const useProductDetailRecommendationActions');
    expect(communitySource).toContain('} catch (err: unknown) {');
    expect(source).toContain('const [product, setProduct] = useState<Product | null>(null);');
    expect(source).toContain('const [recommendations, setRecommendations] = useState<Product[]>([]);');
    expect(helpersSource).toContain('export const isRecommendationUnavailable');
    expect(readProductDetailRecommendationSource()).toContain('const handleAddRecommendationToCart = async (');
    expect(readProductDetailRecommendationSource()).toContain('} catch (err: unknown) {');
    expect(source).not.toContain('const handleAddRecommendationToCart = async (event: React.MouseEvent<HTMLElement>, item: Product) =>');
    expect(communitySource).toContain("getApiErrorMessage(err, t('pages.ask.askFailed'), language)");
    expect(readProductDetailRecommendationSource()).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
    expect(source).toContain('buildRelatedRecommendations(product, recommendations)');
    expect(source).toContain('<ProductDetailRecommendations');
    expect(readProductDetailRecommendationsPanelSource()).toContain('relatedRecommendations.map((rec) =>');
    expect(helpersSource).toContain('export const buildRelatedRecommendations');
    expect(helpersSource).toContain('export const buildCompleteSetItems');
  });
});

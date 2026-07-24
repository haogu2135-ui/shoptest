import fs from 'fs';
import path from 'path';

const readHomeSource = () => fs.readFileSync(path.join(__dirname, 'Home.tsx'), 'utf8');
const readHomeSurface = () => [
  readHomeSource(),
  fs.readFileSync(path.join(__dirname, 'homeHelpers.tsx'), 'utf8'),
  fs.readFileSync(path.join(__dirname, 'homeShellStates.tsx'), 'utf8'),
  fs.readFileSync(path.join(__dirname, 'homeFirstFoldPanels.tsx'), 'utf8'),
  fs.readFileSync(path.join(__dirname, 'homeProductPanels.tsx'), 'utf8'),
].join('\n');
const homeSource = readHomeSurface();
const homePageSource = readHomeSource();

describe('Home render memoization contracts', () => {
  it('filters storage updates to product-view preference changes only', () => {
    const storageEffectStart = homePageSource.indexOf('const handlePreferencesUpdated = (event?: Event) => {');
    const storageEffect = homePageSource.slice(storageEffectStart, homePageSource.indexOf('};', storageEffectStart));

    expect(homePageSource).toContain("import { clearProductViewHistory, loadProductViewPreferences, PRODUCT_VIEW_PREFERENCES_KEY } from '../utils/productViewPreferences';");
    expect(storageEffectStart).toBeGreaterThan(-1);
    expect(storageEffect).toContain('event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY');
    expect(storageEffect).toContain('setViewPreferences(loadProductViewPreferences());');
    expect(homePageSource).toContain("window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);");
    expect(homePageSource).toContain("window.addEventListener('storage', handlePreferencesUpdated);");
  });

  it('keeps expensive and reusable Home derived collections memoized', () => {
    expect(homeSource).not.toContain('EMPTY_OBJECT');
    expect(homeSource).not.toContain('EMPTY_PRODUCT_IDS');
    expect(homeSource).not.toContain('EMPTY_PRODUCT_MAP');
    expect(homeSource).not.toContain('promotionMap');
    expect(homeSource).not.toContain('homeProductIds');

    expect(homeSource).toMatch(/const promoProducts = useMemo\(/);
    expect(homeSource).toMatch(/const bestSellers = useMemo\(/);
    expect(homeSource).toMatch(/const discoveryProducts = useMemo\(/);
    expect(homeSource).toMatch(/const localPersonalizedProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedDisplayProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedReadyProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedDealCount = useMemo\(/);
    expect(homeSource).toMatch(/const visibleDiscoveryProducts = useMemo\(/);
    expect(homeSource).toMatch(/const categoryTiles = useMemo\(/);
    expect(homeSource).toMatch(/const heroCategoryTiles = useMemo\(/);
  });

  it('keeps local pet gallery fallback media off third-party image hosts', () => {
    expect(homeSource).toContain('const petGalleryImageFallback = imageFallbacks.media;');
    expect(homeSource).toContain('return petGalleryImageFallback');
    expect(homeSource).toContain("publicAssetUrl('/assets/home/hero-dog.webp')");
    expect(homeSource).toContain('resolvePetGalleryImage');
    expect(homeSource).not.toContain('images.unsplash.com');
    expect(homeSource).not.toContain('unsplash.com');
  });

  it('keeps the Home loading state populated with accessible skeleton content', () => {
    expect(homePageSource).toContain('<HomeLoadingShell');
    expect(homePageSource).toContain("from './homeShellStates'");
    expect(homeSource).toContain("import { HeroSkeleton, ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';");
    expect(homeSource).toContain('export const HomeLoadingShell');
    expect(homeSource).toContain('aria-busy="true"');
    expect(homeSource).toContain('role="status"');
    expect(homeSource).toContain('aria-live="polite"');
    expect(homeSource).toContain("aria-label={t('common.loading')}");
    expect(homeSource).toContain('<HeroSkeleton />');
    expect(homeSource).toContain('<StatsStripSkeleton />');
    expect(homeSource).toContain('<ProductCardSkeleton count={8} />');
    expect(homeSource).toContain('className="shopee-hero__asideSkeleton shimmer"');
    expect(homeSource).toContain('className="shopee-loading-products"');
  });

  it('keeps discovery infinite scroll announced and keyboard reachable', () => {
    expect(homeSource).toContain('home.discoveryShowing');
    expect(homeSource).toContain('home.discoveryLoadMore');
    expect(homeSource).toContain('shopee-discovery__status');
    expect(homeSource).toContain('role="list"');
    expect(homeSource).toContain('role="listitem"');
    expect(homeSource).toContain('shopee-load-more__button');
  });
});

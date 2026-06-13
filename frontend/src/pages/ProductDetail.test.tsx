import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { productApi, questionApi, reviewApi } from '../api';
import ProductDetail from './ProductDetail';
import {
  PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES,
  cacheProductRecommendations,
  clearProductDetailSessionCaches,
  getCachedProductRecommendations,
} from './productDetailHelpers';

const readProductDetailSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'ProductDetail.tsx'), 'utf8') as string;
const readProductDetailHelpersSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'productDetailHelpers.tsx'), 'utf8') as string;
const readProductDetailCss = () => require('fs').readFileSync(require('path').resolve(__dirname, 'ProductDetail.css'), 'utf8') as string;
const readNativeScrollSource = () => require('fs').readFileSync(require('path').resolve(__dirname, '../utils/nativeScroll.ts'), 'utf8') as string;

let mockSuspendLazySubcomponents = false;
const mockLazySubcomponentSuspender = new Promise(() => undefined);

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn(), getItems: jest.fn() },
  productApi: {
    getById: jest.fn(),
    getRecommendations: jest.fn(),
  },
  questionApi: {
    ask: jest.fn(),
    getByProduct: jest.fn(),
  },
  reviewApi: {
    create: jest.fn(),
    getAll: jest.fn(),
    getReviewableOrders: jest.fn(),
  },
  wishlistApi: {
    check: jest.fn(),
    toggle: jest.fn(),
  },
}));

jest.mock('../components/ProductRichDetail', () => {
  const React = require('react');
  const actual = jest.requireActual('../components/ProductRichDetail');
  return {
    __esModule: true,
    ...actual,
    default: (props: unknown) => {
      if (mockSuspendLazySubcomponents) throw mockLazySubcomponentSuspender;
      return React.createElement(actual.default, props);
    },
  };
});

jest.mock('../components/ProductReview', () => {
  const React = require('react');
  const actual = jest.requireActual('../components/ProductReview');
  return {
    __esModule: true,
    ...actual,
    ProductReview: (props: unknown) => {
      if (mockSuspendLazySubcomponents) throw mockLazySubcomponentSuspender;
      return React.createElement(actual.ProductReview, props);
    },
  };
});

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'common.loading') return 'Loading...';
      if (key === 'pages.productDetail.freeShippingOver') return `Free shipping over ${params?.amount}`;
      return key;
    },
  }),
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
    market: { freeShippingThreshold: 49, locale: 'en-US' },
    setCurrency: jest.fn(),
  }),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  hasStoredValue: jest.fn(() => false),
  removeSessionStorageItem: jest.fn(),
}));

jest.mock('../utils/productCatalogSnapshot', () => ({
  loadFallbackProductCatalog: jest.fn(() => []),
  loadProductCatalogSnapshot: jest.fn(() => null),
}));

jest.mock('../utils/productViewPreferences', () => ({
  recordProductView: jest.fn(),
}));

jest.mock('../utils/stockAlerts', () => ({
  addStockAlert: jest.fn(),
  hasStockAlert: jest.fn(() => false),
  removeStockAlert: jest.fn(),
}));

jest.mock('../utils/productCompare', () => ({
  addCompareProduct: jest.fn(),
  isProductCompared: jest.fn(() => false),
  MAX_COMPARE_ITEMS: 4,
}));

jest.mock('../utils/nativeBack', () => ({
  useNativeBackHandler: jest.fn(),
}));

jest.mock('../utils/nativeScroll', () => ({
  addAppScrollListener: jest.fn(() => jest.fn()),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

const renderProductDetail = () => render(
  <MemoryRouter initialEntries={['/products/101']}>
    <Routes>
      <Route path="/products/:id" element={<ProductDetail />} />
    </Routes>
  </MemoryRouter>,
);

const loadedProduct = {
  id: 101,
  name: 'Smart feeder bowl',
  description: 'Automatic feeder',
  price: 24,
  effectivePrice: 24,
  stock: 8,
  categoryId: 3,
  imageUrl: 'https://cdn.example.com/main.jpg',
  images: [
    'https://cdn.example.com/main.jpg',
    'https://cdn.example.com/side.jpg',
    'https://cdn.example.com/detail.jpg',
  ],
  specifications: {},
  variants: [],
  optionGroups: [],
};

type TestTouchPoint = Pick<Touch, 'clientX' | 'clientY'>;

const createTouchList = (points: TestTouchPoint[]) => {
  const touchList = {
    length: points.length,
    item: (index: number) => points[index] || null,
    [Symbol.iterator]: function* iterator() {
      yield* points;
    },
  } as {
    length: number;
    item: (index: number) => TestTouchPoint | null;
    [Symbol.iterator]: () => Generator<TestTouchPoint, void, unknown>;
  } & Record<number, TestTouchPoint>;
  points.forEach((point, index) => {
    touchList[index] = point;
  });
  return touchList;
};

const createNativeTouchMove = (points: Array<Pick<Touch, 'clientX' | 'clientY'>>) => {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: createTouchList(points) as unknown as TouchList,
  });
  return event;
};

describe('ProductDetail mobile buybar layout contract', () => {
  it('keeps the mobile purchase bar fixed and reachable in the first viewport', () => {
    const source = readProductDetailSource();
    const css = readProductDetailCss();
    const fixStart = css.lastIndexOf('Mobile fixed purchase bar closure');
    const fixCss = css.slice(fixStart);

    expect(source.indexOf('className="product-price-panel"')).toBeGreaterThan(-1);
    expect(source.indexOf('className="product-mobile-buybar"')).toBeGreaterThan(source.indexOf('className="product-price-panel"'));
    expect(fixStart).toBeGreaterThan(css.indexOf('APP/WebView product detail closure'));
    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.product-detail-page,[\s\S]*?padding-bottom:\s*calc\(128px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-mobile-buybar,[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?bottom:\s*max\(8px,\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?z-index:\s*7600\s*!important;/);
    expect(fixCss).toMatch(/max-width:\s*calc\(100vw - 16px - env\(safe-area-inset-left,\s*0px\) - env\(safe-area-inset-right,\s*0px\)\)\s*!important;/);
  });

  it('allows mobile price badges to wrap without splitting money tokens', () => {
    const css = readProductDetailCss();
    const fixStart = css.lastIndexOf('Mobile price-line closure');
    const fixCss = css.slice(fixStart);

    expect(fixStart).toBeGreaterThan(css.indexOf('Final mobile atomic-text pass'));
    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-price-line[\s\S]*?flex-wrap:\s*wrap\s*!important;[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-price-line__current[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?white-space:\s*nowrap\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-price-line__discount\.ant-tag[\s\S]*?display:\s*inline-flex\s*!important;/);
  });

  it('announces active limited-time countdown changes without making static promo copy live', () => {
    const source = readProductDetailSource();

    expect(source).toContain('const limitedTimePromoActive = limitedTimeRemaining > 0;');
    expect(source).toMatch(/className="product-mobile-promo"[\s\S]*?role=\{limitedTimePromoActive \? 'status' : undefined\}[\s\S]*?aria-live=\{limitedTimePromoActive \? 'polite' : undefined\}[\s\S]*?aria-atomic=\{limitedTimePromoActive \? 'true' : undefined\}/);
    expect(source).toMatch(/<span>\{limitedTimePromoActive \? t\('pages\.productDetail\.limitedTimeCountdown'\) : productFreeShippingText\}<\/span>/);
    expect(source).toMatch(/<strong>\{limitedTimePromoActive \? formatCountdown\(limitedTimeRemaining\) : t\('pages\.productDetail\.authentic'\)\}<\/strong>/);
  });

  it('keeps the final mobile purchase rail focused on cart and buy actions', () => {
    const css = readProductDetailCss();
    const fixStart = css.lastIndexOf('Mobile purchase action closure');
    const fixEnd = css.indexOf('/* Mobile fixed purchase bar closure', fixStart);
    const fixCss = css.slice(fixStart, fixEnd);

    expect(fixStart).toBeGreaterThan(css.lastIndexOf('Mobile price-line closure'));
    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(fixCss).toMatch(/grid-template-areas:[\s\S]*?"meta meta"[\s\S]*?"cart buy"\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-mobile-buybar__tool--home,[\s\S]*?\.product-detail-page \.product-summary-card \.product-mobile-buybar__tool--favorite,[\s\S]*?\.product-detail-page \.product-summary-card \.product-mobile-buybar__tool--compare[\s\S]*?display:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-page \.product-summary-card \.product-mobile-buybar__cart,[\s\S]*?\.product-detail-page \.product-summary-card \.product-mobile-buybar__buy[\s\S]*?min-height:\s*48px\s*!important;/);
  });

  it('keeps mobile Web buybar final authority above older three-tool grid rules', () => {
    const css = readProductDetailCss();
    const finalStart = css.lastIndexOf('UI audit 2026-06-09: final mobile buybar authority');
    const finalCss = css.slice(finalStart);

    expect(finalStart).toBeGreaterThan(css.lastIndexOf('Mobile fixed purchase bar closure'));
    expect(finalCss).toMatch(/body:not\(\.shop-mobile-app\) \.product-detail-page \.product-summary-card \.product-mobile-buybar,[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)\s*!important;/);
    expect(finalCss).toMatch(/grid-template-areas:[\s\S]*?"meta meta"[\s\S]*?"cart buy"\s*!important;/);
    expect(finalCss).toMatch(/body:not\(\.shop-mobile-app\) \.product-detail-page \.product-summary-card \.product-mobile-buybar__tool--home,[\s\S]*?product-mobile-buybar__tool--favorite,[\s\S]*?product-mobile-buybar__tool--compare[\s\S]*?display:\s*none\s*!important;/);
    expect(finalCss).toMatch(/product-mobile-buybar__cart[\s\S]*?grid-area:\s*cart\s*!important;/);
    expect(finalCss).toMatch(/product-mobile-buybar__buy[\s\S]*?grid-area:\s*buy\s*!important;/);
    expect(finalCss).toMatch(/product-mobile-buybar__cart,[\s\S]*?product-mobile-buybar__buy[\s\S]*?min-height:\s*52px\s*!important;/);
  });

  it('disables purchase actions while required options are missing or unavailable', () => {
    const source = readProductDetailSource();

    expect(source).toContain('const addToCartBlocked = isOutOfStock || purchaseSelectionBlocked || purchaseSubmitting !== null;');
    expect(source).toContain('const mobileAddToCartBlocked = !isOutOfStock && (purchaseSelectionBlocked || purchaseSubmitting !== null);');
    expect(source).toContain('const buyNowBlocked = isOutOfStock || purchaseSelectionBlocked || purchaseSubmitting !== null;');
    expect(source).toMatch(/className="product-mobile-buybar__cart"[\s\S]*?onClick=\{isOutOfStock \? handleStockAlert : handleAddToCart\}[\s\S]*?disabled=\{mobileAddToCartBlocked\}/);
    expect(source).toMatch(/className="product-mobile-buybar__buy"[\s\S]*?onClick={handleBuyNow}[\s\S]*?disabled={buyNowBlocked}/);
    expect(source).toMatch(/onClick={handleAddToCart}[\s\S]*?disabled={addToCartBlocked}/);
    expect(source).toMatch(/aria-label={buyNowActionLabel}[\s\S]*?onClick={handleBuyNow}[\s\S]*?disabled={buyNowBlocked}[\s\S]*?ghost/);
  });

  it('uses centralized size option semantics instead of hardcoded product-detail keywords', () => {
    const source = readProductDetailSource();

    expect(source).toContain('isSizeOptionName(group.name)');
    expect(source).not.toContain("group.name.toLowerCase().includes('size')");
    expect(source).not.toContain("group.name.includes('尺码')");
    ['耗材', '配件', '滤芯', '清洁', '刷', '垫'].forEach((keyword) => {
      expect(source).not.toContain(keyword);
    });
  });

  it('keeps product detail tabs separated instead of rendering as one concatenated label string', () => {
    const source = readProductDetailSource();
    const css = readProductDetailCss();
    const fixStart = css.lastIndexOf('F2712: keep product detail tabs visually separated');
    const fixCss = css.slice(fixStart);

    expect(source).toContain('className="product-detail-tabs"');
    expect(source).toContain('tabBarGutter={10}');
    expect(source).not.toContain('tabBarGutter={0}');
    expect(fixStart).toBeGreaterThan(css.lastIndexOf('Android UI closure: product detail buybar, tabs and compact labels.'));
    expect(fixCss).toMatch(/\.product-detail-tabs \.ant-tabs-ink-bar[\s\S]*?display:\s*none;/);
    expect(fixCss).toMatch(/\.product-detail-tabs \.ant-tabs-nav-list[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?gap:\s*6px\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-tabs \.ant-tabs-tab-btn[\s\S]*?border:\s*1px solid #d8e5dc\s*!important;[\s\S]*?border-radius:\s*8px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail-tabs \.ant-tabs-tab-active \.ant-tabs-tab-btn[\s\S]*?border-color:\s*#124734\s*!important;[\s\S]*?box-shadow:\s*0 0 0 2px rgba\(18,\s*71,\s*52,\s*0\.14\)\s*!important;/);
  });

  it('keeps non-critical content scroll warmup fallback cleanup-bound', () => {
    const source = readProductDetailSource();
    const nativeScrollSource = readNativeScrollSource();
    const warmupStart = source.indexOf('const fallbackTimer = window.setTimeout(warmNonCriticalContent, 1800);');
    const warmupEffect = source.slice(warmupStart, source.indexOf('}, [authSessionVersion, id, language, warmNonCriticalContent]);', warmupStart));

    expect(nativeScrollSource).toContain("window.addEventListener('scroll', listener, options);");
    expect(nativeScrollSource).toContain("window.removeEventListener('scroll', listener, options);");
    expect(nativeScrollSource).toContain('nativeHosts.forEach((host) => host.removeEventListener');
    expect(warmupEffect).toContain('const scrollWarmupCleanup = addAppScrollListener(scrollWarmup, { passive: true });');
    expect(warmupEffect).toContain("removeScrollWarmup = typeof scrollWarmupCleanup === 'function'");
    expect(warmupEffect).toContain('detachScrollWarmup();');
    expect(warmupEffect).toMatch(/return \(\) => \{\s*disposed = true;\s*window\.clearTimeout\(fallbackTimer\);\s*detachScrollWarmup\(\);\s*observer\?\.disconnect\(\);/);
  });
});

describe('ProductDetail loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearProductDetailSessionCaches();
    mockSuspendLazySubcomponents = false;
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => window.setTimeout(callback, 0));
    window.cancelAnimationFrame = window.cancelAnimationFrame || ((handle: number) => window.clearTimeout(handle));
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    });
    (productApi.getById as jest.Mock).mockReturnValue(new Promise(() => undefined));
    (productApi.getRecommendations as jest.Mock).mockResolvedValue({ data: [] });
    (questionApi.getByProduct as jest.Mock).mockResolvedValue({ data: [] });
    (reviewApi.getAll as jest.Mock).mockResolvedValue({ data: { reviews: [], averageRating: 0 } });
    (reviewApi.getReviewableOrders as jest.Mock).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    clearProductDetailSessionCaches();
    jest.restoreAllMocks();
  });

  it('renders a structured, accessible product detail skeleton while the product request is pending', async () => {
    renderProductDetail();

    await waitFor(() => expect(productApi.getById).toHaveBeenCalledWith(101));

    const skeleton = screen.getByRole('status', { name: 'Loading...' });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('product-detail-skeleton-gallery')).toBeInTheDocument();
    expect(screen.getByTestId('product-detail-skeleton-summary')).toBeInTheDocument();
    expect(screen.getByTestId('product-detail-skeleton-afterfold')).toBeInTheDocument();
    expect(document.querySelector('.ant-spin')).not.toBeInTheDocument();
  });

  it('reserves structured space while lazy product subcomponents are suspended', async () => {
    mockSuspendLazySubcomponents = true;
    (productApi.getById as jest.Mock).mockResolvedValue({ data: loadedProduct });

    renderProductDetail();

    await screen.findAllByText('Smart feeder bowl');
    const richFallback = await screen.findByTestId('product-detail-lazy-rich-fallback');
    const reviewFallback = await screen.findByTestId('product-detail-lazy-review-fallback');

    expect(richFallback).toHaveAttribute('aria-busy', 'true');
    expect(richFallback).toHaveClass('product-detail-lazy-skeleton--rich');
    expect(reviewFallback).toHaveAttribute('aria-busy', 'true');
    expect(reviewFallback).toHaveClass('product-detail-lazy-skeleton--review');
    expect(document.querySelector('.ant-spin')).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation across the product image gallery', async () => {
    (productApi.getById as jest.Mock).mockResolvedValue({ data: loadedProduct });

    const { container } = renderProductDetail();

    await waitFor(() => expect(productApi.getById).toHaveBeenCalledWith(101));
    await screen.findAllByText('Smart feeder bowl');
    const gallery = container.querySelector('.product-detail-main-image') as HTMLElement;
    const heroImage = container.querySelector('.product-detail-main-image__img') as HTMLImageElement;

    expect(gallery).toHaveAttribute('tabindex', '0');
    expect(gallery).toHaveAttribute('role', 'region');
    expect(heroImage).toHaveAttribute('src', expect.stringContaining('main.jpg'));

    fireEvent.keyDown(gallery, { key: 'ArrowRight' });
    await waitFor(() => expect(heroImage).toHaveAttribute('src', expect.stringContaining('side.jpg')));

    fireEvent.keyDown(gallery, { key: 'ArrowLeft' });
    await waitFor(() => expect(heroImage).toHaveAttribute('src', expect.stringContaining('main.jpg')));

    const firstThumb = screen.getAllByRole('button', {
      name: 'pages.productDetail.imageThumb',
    })[0];
    expect(firstThumb.tagName).toBe('BUTTON');
    expect(firstThumb.querySelector('img')).not.toHaveAttribute('role');

    fireEvent.keyDown(firstThumb, { key: 'ArrowLeft' });

    await waitFor(() => expect(heroImage).toHaveAttribute('src', expect.stringContaining('detail.jpg')));
  });

  it('supports mobile pinch zoom with a non-passive touchmove listener', async () => {
    const addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');
    (productApi.getById as jest.Mock).mockResolvedValue({ data: loadedProduct });

    const { container } = renderProductDetail();

    await screen.findAllByText('Smart feeder bowl');
    const mobileGallery = container.querySelector('.product-mobile-gallery') as HTMLElement;
    Object.defineProperty(mobileGallery, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
        width: 200,
        height: 200,
        toJSON: () => undefined,
      }),
    });

    await waitFor(() => expect(addEventListenerSpy).toHaveBeenCalledWith(
      'touchmove',
      expect.any(Function),
      { passive: false },
    ));

    const startingTouches = createTouchList([
      { clientX: 40, clientY: 40 },
      { clientX: 140, clientY: 40 },
    ]);
    fireEvent.touchStart(mobileGallery, { touches: startingTouches });

    const touchMove = createNativeTouchMove([
      { clientX: 10, clientY: 40 },
      { clientX: 190, clientY: 40 },
    ]);
    fireEvent(mobileGallery, touchMove);

    expect(touchMove.defaultPrevented).toBe(true);
    const activeMobileImage = container.querySelector('.product-mobile-gallery__img') as HTMLImageElement;
    await waitFor(() => expect(activeMobileImage.style.transform).toBe('scale(1.8)'));
    expect(activeMobileImage.style.transformOrigin).toBe('50% 20%');

    fireEvent.touchEnd(mobileGallery);
    await waitFor(() => expect(activeMobileImage.style.transform).toBe(''));
  });

  it('renders structured rich detail blocks instead of falling back to plain description text', async () => {
    (productApi.getById as jest.Mock).mockResolvedValue({
      data: {
        ...loadedProduct,
        description: 'Plain fallback description',
        detailContent: [
          { type: 'text', content: 'Raised feeding angle supports calmer mealtime.' },
          { type: 'image', url: 'https://cdn.example.com/rich-detail.jpg', caption: 'Angled bowl detail' },
        ],
      },
    });

    const { container } = renderProductDetail();

    await screen.findByText('Raised feeding angle supports calmer mealtime.');
    expect(screen.queryByText('Plain fallback description')).not.toBeInTheDocument();
    expect(screen.getByText('Angled bowl detail')).toBeInTheDocument();
    expect(container.querySelector('.product-rich-detail__figure img')).toHaveAttribute(
      'src',
      expect.stringContaining('rich-detail.jpg'),
    );
  });

  it('uses the market threshold for default product detail shipping copy', async () => {
    (productApi.getById as jest.Mock).mockResolvedValue({ data: loadedProduct });

    renderProductDetail();

    await screen.findAllByText('Smart feeder bowl');
    const shippingPhrases = Array.from(document.querySelectorAll('.product-detail__amountPhrase'))
      .map((element) => element.textContent);
    expect(shippingPhrases).toContain('Free shipping over $49.00');
  });
});

describe('ProductDetail recommendation cache', () => {
  const makeRecommendedProduct = (id: number) => ({
    ...loadedProduct,
    id,
    name: `Recommended product ${id}`,
  });

  beforeEach(() => {
    clearProductDetailSessionCaches();
  });

  afterEach(() => {
    clearProductDetailSessionCaches();
  });

  it('evicts the least recently used recommendation entry when capped', () => {
    const now = 1_000_000;

    Array.from({ length: PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES }).forEach((_, index) => {
      cacheProductRecommendations(`en|${index}`, [makeRecommendedProduct(index)], now + index);
    });

    expect(getCachedProductRecommendations('en|0', now + 1_000)?.[0].id).toBe(0);

    cacheProductRecommendations(
      `en|${PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES}`,
      [makeRecommendedProduct(PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES)],
      now + 2_000,
    );

    expect(getCachedProductRecommendations('en|1', now + 2_001)).toBeNull();
    expect(getCachedProductRecommendations('en|0', now + 2_001)?.[0].id).toBe(0);
  });

  it('expires cached recommendations after the detail cache TTL', () => {
    const now = 2_000_000;
    cacheProductRecommendations('en|detail|42', [makeRecommendedProduct(42)], now);

    expect(getCachedProductRecommendations('en|detail|42', now + 119_000)?.[0].id).toBe(42);
    expect(getCachedProductRecommendations('en|detail|42', now + 120_001)).toBeNull();
  });

  it('keeps the ProductDetail recommendation cache bounded outside the page component', () => {
    const productDetailSource = readProductDetailSource();
    const helpersSource = readProductDetailHelpersSource();

    expect(productDetailSource).not.toContain('const productRecommendationsCache =');
    expect(productDetailSource).toContain('clearProductDetailSessionCaches();');
    expect(helpersSource).toContain('const PRODUCT_RECOMMENDATIONS_CACHE_TTL = 2 * 60 * 1000;');
    expect(helpersSource).toContain('PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES = 50');
    expect(helpersSource).toContain('productRecommendationsCache.clear();');
    expect(helpersSource).toContain('while (productRecommendationsCache.size > PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES)');
  });

  it('keeps recommendation helpers and state typed without broad any usage', () => {
    const productDetailSource = readProductDetailSource();
    const helpersSource = readProductDetailHelpersSource();

    expect(productDetailSource).toContain('useState<Product[]>([])');
    expect(productDetailSource).toContain('new Map<number, Product>()');
    expect(productDetailSource).not.toContain('useState<any[]>([])');
    expect(productDetailSource).not.toContain('Product | any');
    expect(productDetailSource).not.toContain('catch (err: any)');
    expect(productDetailSource).not.toContain('new Map<number, Product | any>()');
    expect(productDetailSource).not.toContain('relatedRecommendations.map((rec: any)');
    expect(helpersSource).toContain('export type ProductRecommendationCandidate');
    expect(helpersSource).not.toMatch(/\bany\b/);
  });
});

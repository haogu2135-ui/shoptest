import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LanguageProvider } from '../i18n';
import { categoryApi, productApi } from '../api';
import { addAppScrollListener, getAppScrollMetrics, scrollAppToTop } from '../utils/nativeScroll';
import ProductList from './ProductList';

const readProductListSource = () => fs.readFileSync(path.resolve(__dirname, 'ProductList.tsx'), 'utf8');
const readProductListCss = () => fs.readFileSync(path.resolve(__dirname, 'ProductList.css'), 'utf8');
const readMobileAppCss = () => fs.readFileSync(path.resolve(__dirname, '../mobile-app.css'), 'utf8');
const readMobilePageContrastCss = () => fs.readFileSync(path.resolve(__dirname, '../styles/mobile-page-contrast.css'), 'utf8');

const mockStorage = new Map<string, string>();
let mockScrollMetrics = { scrollTop: 0, scrollHeight: 900, viewportHeight: 800 };
let mockScrollListener: EventListenerOrEventListenerObject | undefined;

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
  categoryApi: { getTopLevel: jest.fn() },
  createApiAbortController: () => new AbortController(),
  productApi: {
    getAll: jest.fn(),
    getPage: jest.fn(),
    getPersonalizedRecommendations: jest.fn(),
    prefetchById: jest.fn(),
  },
  wishlistApi: { getByUser: jest.fn(), toggle: jest.fn() },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
    market: { freeShippingThreshold: 49 },
    setCurrency: jest.fn(),
  }),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn((key: string) => mockStorage.get(key) || null),
  getSessionStorageItem: jest.fn(() => null),
  hasStoredValue: jest.fn(() => false),
  removeLocalStorageItem: jest.fn((key: string) => mockStorage.delete(key)),
  removeSessionStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
}));

jest.mock('../utils/nativeScroll', () => ({
  addAppScrollListener: jest.fn(),
  getAppScrollMetrics: jest.fn(),
  scrollAppToTop: jest.fn(),
}));

jest.mock('../utils/productCatalogSnapshot', () => ({
  buildProductCatalogFallbackCategories: jest.fn(() => []),
  loadFallbackProductCatalog: jest.fn(() => []),
  loadProductCatalogSnapshot: jest.fn(() => null),
  saveProductCatalogSnapshot: jest.fn(),
}));

jest.mock('../utils/cartDrawer', () => ({
  openCartDrawerWithSnapshot: jest.fn(),
}));

const catalogProduct = {
  id: 101,
  name: 'Smart feeder bowl',
  price: 24,
  effectivePrice: 24,
  originalPrice: 30,
  stock: 8,
  categoryId: 3,
  description: 'Automatic feeder for small pets',
  specifications: {
    size: 'Small',
    material: 'Silicone',
    color: 'Green',
  },
  activeLimitedTimeDiscount: true,
  effectiveDiscountPercent: 20,
  reviewCount: 4,
  positiveRate: 95,
  tag: 'new',
  createdAt: '2026-06-01T12:34:56Z',
  imageUrl: 'https://cdn.example.com/smart-feeder.jpg',
};

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
};

const renderProductList = (initialPath: string) => render(
  <LanguageProvider>
    <MemoryRouter initialEntries={[initialPath]}>
      <ProductList />
      <LocationProbe />
    </MemoryRouter>
  </LanguageProvider>,
);

describe('ProductList quick-add mobile overlay contracts', () => {
  it('keeps product title links at a full App touch target height', () => {
    const css = readProductListCss();

    expect(css).toMatch(/body\.shop-mobile-app \.product-list__titleLink\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?padding-block:\s*5px\s*!important;/);
  });

  it('keeps App product card links from inheriting browser hyperlink decoration', () => {
    const css = readMobilePageContrastCss();

    expect(css).toMatch(/body\.shop-mobile-app\.shop-mobile-app \.shop-app-shell a\.product-list__imageButton\[href\][\s\S]*?text-decoration:\s*none\s*!important;[\s\S]*?text-underline-offset:\s*initial\s*!important;/);
    expect(css).toMatch(/body\.shop-mobile-app\.shop-mobile-app \.shop-app-shell a\.product-list__imageButton\[href\],[\s\S]*?a\.product-list__imageButton\[href\]:focus-visible\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?height:\s*100%\s*!important;[\s\S]*?display:\s*block\s*!important;[\s\S]*?text-decoration:\s*none\s*!important;/);
    expect(css).toMatch(/body\.shop-mobile-app\.shop-mobile-app \.shop-app-shell a\.product-list__titleLink\[href\]\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?-webkit-line-clamp:\s*2\s*!important;/);
  });

  it('keeps native product-list badges above the Android readable type floor', () => {
    const css = readMobileAppCss();
    const fixCss = css.slice(css.indexOf('A-01: native product-list badges'));
    const badgeRule = fixCss.match(/body\.shop-mobile-app\.shop-mobile-app\.shop-mobile-app \.product-list__badges \.ant-tag\s*\{([\s\S]*?)\}/)?.[1] || '';

    expect(badgeRule).toContain('font-size: 12px !important;');
    expect(badgeRule).toContain('min-height: 22px !important;');
    expect(badgeRule).not.toContain('font-size: 9px');
  });

  it('treats option selection as a blocking purchase modal above mobile rails', () => {
    const source = readProductListSource();
    const css = readProductListCss();
    const fixCss = css.slice(css.indexOf('F3415:'));

    expect(source).toContain('product-list--quickAddOpen');
    expect(source).toContain('rootClassName="product-list__quickAddModalRoot"');
    expect(source).toContain("classNames={{ popup: { root: 'shop-mobile-popup-layer product-list__quickAddPopup' } }}");
    expect(fixCss).toMatch(/product-list--quickAddOpen[\s\S]*?\.product-list__mobileConversionBar[\s\S]*?\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__quickAddModalRoot \.ant-modal-mask\s*\{[^}]*z-index:\s*9500\s*!important;[^}]*background:/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.product-list__quickAddModalRoot \.ant-modal-mask\s*\{[^}]*z-index:\s*9900\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__quickAddPopup\.shop-mobile-popup-layer[\s\S]*?\{[^}]*z-index:\s*9904\s*!important;/);
  });

  it('treats quick preview as a blocking modal above mobile rails', () => {
    const source = readProductListSource();
    const css = readProductListCss();
    const fixCss = css.slice(css.indexOf('F2754:'));

    expect(source).toContain("previewProduct ? ' product-list--previewOpen' : ''");
    expect(source).toContain('rootClassName="product-list__previewModalRoot"');
    expect(fixCss).toMatch(/product-list--previewOpen[\s\S]*?\.product-list__mobileConversionBar[\s\S]*?\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__previewModalRoot \.ant-modal-mask\s*\{[^}]*z-index:\s*9500\s*!important;[^}]*background:/);
    expect(fixCss).toMatch(/\.product-list__previewModalRoot \.ant-modal-wrap\s*\{[^}]*z-index:\s*9501\s*!important;/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.product-list__previewModalRoot \.ant-modal-mask\s*\{[^}]*z-index:\s*9900\s*!important;/);
  });

  it('treats the mobile filter drawer as the active overlay above rails', () => {
    const source = readProductListSource();
    const css = readProductListCss();
    const fixCss = css.slice(css.indexOf('F2755:'));

    expect(source).toContain("filterDrawerOpen ? ' product-list--filterDrawerOpen' : ''");
    expect(source).toContain('rootClassName="product-list__filterDrawerRoot"');
    expect(fixCss).toMatch(/product-list--filterDrawerOpen[\s\S]*?\.product-list__mobileConversionBar[\s\S]*?\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__filterDrawerRoot\.ant-drawer\s*\{[^}]*z-index:\s*9500\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__filterDrawerRoot \.ant-drawer-mask\s*\{[^}]*z-index:\s*9500\s*!important;[^}]*background:/);
    expect(fixCss).toMatch(/\.product-list__filterDrawerRoot \.ant-drawer-content-wrapper\s*\{[^}]*z-index:\s*9501\s*!important;/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.product-list__filterDrawerRoot\.ant-drawer\s*\{[^}]*z-index:\s*9900\s*!important;/);
  });

  it('keeps the mobile catalog first screen focused on products before the conversion rail appears', () => {
    const css = readProductListCss();
    const fixCss = css.slice(css.indexOf('Mobile catalog first-screen closure'));

    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.shop-app-shell--product-list:not\(\.shop-app-shell--scrolled\) \.product-list:not\(\.product-list--empty\) \.product-list__mobileConversionBar,[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.shop-app-shell--product-list \.product-list__heroBand,[\s\S]*?padding:\s*12px\s*!important;[\s\S]*?border-radius:\s*8px\s*!important;/);
    expect(fixCss).toMatch(/\.shop-app-shell--product-list \.product-list__heroContent h1,[\s\S]*?font-size:\s*24px\s*!important;/);
    expect(fixCss).toMatch(/\.shop-app-shell--product-list \.product-list__heroCard,[\s\S]*?display:\s*none\s*!important;/);
  });

  it('keeps the filter drawer footer from covering the last scrollable options', () => {
    const css = readProductListCss();
    const fixCss = css.slice(css.indexOf('Mobile filter drawer closure'));

    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.product-list__filterDrawerRoot \.product-list__drawerPanels,[\s\S]*?padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(fixCss).toMatch(/\.product-list__filterDrawerRoot \.product-list__drawerFooter,[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?bottom:\s*0\s*!important;[\s\S]*?z-index:\s*4\s*!important;/);
  });
});

describe('ProductList card render performance contracts', () => {
  it('keeps product grid cards behind a memoized list item component', () => {
    const source = readProductListSource();

    expect(source).toContain('const ProductListCard = React.memo');
    expect(source).toContain("ProductListCard.displayName = 'ProductListCard';");
    expect(source).toContain('<ProductListCard');
    expect(source).toContain('const productListProductName = useCallback');
    expect(source).toContain('const renderSavingsText = useCallback');
    expect(source).toContain('const handleWishlistToggle = useCallback');
    expect(source).toContain('const openProductPreview = useCallback');
    expect(source).toContain('const PRODUCT_LIST_PAGE_SIZE = 12;');
    expect(source).toContain('const PRODUCT_LIST_FETCH_SIZE = PRODUCT_LIST_PAGE_SIZE * 8;');
    expect(source).toContain('const pageSize = PRODUCT_LIST_PAGE_SIZE;');
    expect(source).toContain('size: pageSize,');
    expect(source).toContain('const paginatedProducts = usingServerPagination');
    expect(source).toContain(': sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);');
    expect(source).toContain('<Pagination');
    expect(source).toContain('pageSize={pageSize}');
    expect(source).not.toContain('paginatedProducts.map((product, index) => {');
    expect(source).not.toContain('const renderPrimaryAction = (product: Product)');
  });
});

describe('ProductList active result context', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockStorage.set('shop-language', 'en');
    mockScrollMetrics = { scrollTop: 0, scrollHeight: 900, viewportHeight: 800 };
    mockScrollListener = undefined;
    jest.clearAllMocks();
    (getAppScrollMetrics as jest.Mock).mockImplementation(() => mockScrollMetrics);
    (addAppScrollListener as jest.Mock).mockImplementation((listener: EventListenerOrEventListenerObject) => {
      mockScrollListener = listener;
      return jest.fn();
    });
    (categoryApi.getTopLevel as jest.Mock).mockResolvedValue({ data: [] });
    (productApi.getPage as jest.Mock).mockResolvedValue({
      data: {
        items: [catalogProduct],
        page: 0,
        size: 12,
        total: 1,
      },
    });
    (productApi.getAll as jest.Mock).mockResolvedValue({ data: [catalogProduct] });
  });

  it('shows every active result condition as a removable chip', async () => {
    renderProductList('/products?keyword=feeder&discount=true&sort=positive-rate-desc&petSize=Small');

    await screen.findAllByText('Smart feeder bowl');
    const contextBar = screen.getByLabelText('Selection');

    expect(within(contextBar).getByRole('button', { name: 'Reset: Search: feeder' })).toBeInTheDocument();
    expect(within(contextBar).getByRole('button', { name: 'Reset: Best deals' })).toBeInTheDocument();
    expect(within(contextBar).getByRole('button', { name: 'Reset: Size: Small' })).toBeInTheDocument();
    expect(within(contextBar).getByRole('button', { name: 'Reset: Sort: Highest rating' })).toBeInTheDocument();
  });

  it('renders product card detail entry points as crawlable links', async () => {
    renderProductList('/products?keyword=feeder');

    await screen.findAllByText('Smart feeder bowl');

    const productLinks = screen.getAllByRole('link', { name: 'View details: Smart feeder bowl' });
    expect(productLinks.length).toBeGreaterThanOrEqual(2);
    productLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/products/101');
    });
    expect(screen.queryByRole('button', { name: 'View details: Smart feeder bowl' })).not.toBeInTheDocument();
  });

  it('normalizes invalid page query params before requesting products', async () => {
    renderProductList('/products?page=-8&sort=price-desc');

    await screen.findAllByText('Smart feeder bowl');

    expect(productApi.getPage).toHaveBeenCalledWith(
      undefined,
      undefined,
      false,
      expect.objectContaining({ page: 0, size: 12, sort: 'price-desc' }),
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it('falls back to the last valid server page when a requested page is out of range', async () => {
    (productApi.getPage as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          items: [],
          page: 98,
          size: 12,
          total: 25,
          totalPages: 3,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [catalogProduct],
          page: 2,
          size: 12,
          total: 25,
          totalPages: 3,
        },
      });

    renderProductList('/products?page=99&sort=price-desc');

    await screen.findAllByText('Smart feeder bowl');
    await waitFor(() => expect(productApi.getPage).toHaveBeenCalledTimes(2));
    expect((productApi.getPage as jest.Mock).mock.calls[0][3]).toEqual(expect.objectContaining({ page: 98, sort: 'price-desc' }));
    expect((productApi.getPage as jest.Mock).mock.calls[1][3]).toEqual(expect.objectContaining({ page: 2, sort: 'price-desc' }));
  });

  it('preserves sort filters in the URL when moving between pages', async () => {
    (productApi.getPage as jest.Mock).mockImplementation((_keyword, _categoryId, _discount, filters = {}) => Promise.resolve({
      data: {
        items: [catalogProduct],
        page: filters.page ?? 0,
        size: 12,
        total: 25,
        totalPages: 3,
      },
    }));

    renderProductList('/products?sort=price-desc');

    await screen.findAllByText('Smart feeder bowl');
    fireEvent.click(screen.getByTitle('2'));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/products?sort=price-desc&page=2');
    });
    await waitFor(() => expect(productApi.getPage).toHaveBeenCalledTimes(2));
    expect((productApi.getPage as jest.Mock).mock.calls[1][3]).toEqual(expect.objectContaining({ page: 1, sort: 'price-desc' }));
  });

  it('aborts the previous product request when search parameters change quickly', async () => {
    let firstSignal: AbortSignal | undefined;
    let secondSignal: AbortSignal | undefined;
    let resolveFirstRequest: ((value: unknown) => void) | undefined;
    let resolveSecondRequest: ((value: unknown) => void) | undefined;

    (productApi.getPage as jest.Mock)
      .mockImplementationOnce((_keyword, _categoryId, _discount, _filters, options) => {
        firstSignal = options?.signal;
        return new Promise((resolve) => {
          resolveFirstRequest = resolve;
        });
      })
      .mockImplementationOnce((_keyword, _categoryId, _discount, filters = {}, options) => {
        secondSignal = options?.signal;
        return new Promise((resolve) => {
          resolveSecondRequest = () => resolve({
            data: {
              items: [catalogProduct],
              page: filters.page ?? 0,
              size: 12,
              total: 1,
              totalPages: 1,
            },
          });
        });
      });

    renderProductList('/products?keyword=first');

    await waitFor(() => expect(productApi.getPage).toHaveBeenCalledTimes(1));
    expect(firstSignal?.aborted).toBe(false);

    const searchInput = screen.getByRole('searchbox', { name: 'Search: Search products' });
    fireEvent.change(searchInput, { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search: Search products' }));

    await waitFor(() => expect(productApi.getPage).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(false);

    await act(async () => {
      resolveFirstRequest?.({
        data: {
          items: [],
          page: 0,
          size: 12,
          total: 0,
          totalPages: 0,
        },
      });
      resolveSecondRequest?.(undefined);
      await Promise.resolve();
      await Promise.resolve();
    });
    await screen.findAllByText('Smart feeder bowl');
  });

  it('shows a back-to-top action after deep scrolling and scrolls the app shell to top', async () => {
    renderProductList('/products');

    await screen.findAllByText('Smart feeder bowl');
    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();

    act(() => {
      mockScrollMetrics = { scrollTop: 820, scrollHeight: 2200, viewportHeight: 720 };
      if (typeof mockScrollListener === 'function') {
        mockScrollListener(new Event('scroll'));
      }
    });

    const backToTopButton = screen.getByRole('button', { name: 'Back to top' });
    fireEvent.click(backToTopButton);

    expect(scrollAppToTop).toHaveBeenCalledWith('smooth');
  });

  it('renders color filters with visible text labels and non-text swatches', async () => {
    renderProductList('/products');

    await screen.findAllByText('Smart feeder bowl');

    const colorGroup = screen.getByLabelText('Color: Filters');
    expect(within(colorGroup).getByLabelText('Black')).toHaveAttribute('type', 'checkbox');
    expect(within(colorGroup).getByLabelText('Blue')).toHaveAttribute('type', 'checkbox');
    expect(within(colorGroup).getByLabelText('Green')).toHaveAttribute('type', 'checkbox');
    expect(within(colorGroup).getByLabelText('Pink')).toHaveAttribute('type', 'checkbox');
    expect(colorGroup).toHaveTextContent('Green');
    expect(colorGroup.querySelector('[data-color-value="Green"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses product names for image alt text and does not render raw ISO new-arrival dates', async () => {
    renderProductList('/products');

    await screen.findAllByText('Smart feeder bowl');

    expect(screen.getByRole('img', { name: 'Smart feeder bowl' })).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText(/2026-06-01T12:34:56Z/)).not.toBeInTheDocument();
  });

  it('removes only the selected search condition from the URL and context chips', async () => {
    renderProductList('/products?keyword=feeder&discount=true&sort=positive-rate-desc&petSize=Small');

    await screen.findAllByText('Smart feeder bowl');
    fireEvent.click(screen.getByRole('button', { name: 'Reset: Search: feeder' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/products?discount=true&sort=positive-rate-desc&petSize=Small');
    });
    expect(screen.queryByRole('button', { name: 'Reset: Search: feeder' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset: Best deals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset: Size: Small' })).toBeInTheDocument();
  });
});

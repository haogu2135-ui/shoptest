import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { cartApi, wishlistApi } from '../api';
import { hasStoredValue } from '../utils/safeStorage';
import Wishlist from './Wishlist';

const readWishlistSource = () => fs.readFileSync(path.resolve(__dirname, 'Wishlist.tsx'), 'utf8');
const readWishlistCss = () => fs.readFileSync(path.resolve(__dirname, 'Wishlist.css'), 'utf8');

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
  wishlistApi: {
    getByUser: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, unknown>) => (
      params && Object.keys(params).length > 0 ? `${key}:${JSON.stringify(params)}` : key
    ),
  }),
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../utils/authRedirect', () => ({
  buildLoginUrlFromWindow: jest.fn(() => '/login'),
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

jest.mock('../utils/productMedia', () => ({
  productImageFallback: '/fallback.png',
  resolveProductImage: (imageUrl?: string | null) => imageUrl || '/fallback.png',
}));

jest.mock('../utils/safeStorage', () => ({
  hasStoredValue: jest.fn(() => true),
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: jest.fn(),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const renderWishlist = () => render(
  <MemoryRouter>
    <Wishlist />
  </MemoryRouter>,
);

describe('Wishlist mobile action layout', () => {
  it('keeps single add-to-cart API error handling typed without broad any usage', () => {
    const source = readWishlistSource();

    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('catch (error: any)');
  });

  it('keeps a commercial multi-path guest auth gate instead of hard-redirect-only login', () => {
    const source = readWishlistSource();
    const css = readWishlistCss();

    expect(source).toContain("const WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY = 'wishlist-login-required';");
    expect(source).toContain('data-auth-gate={WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY}');
    expect(source).toContain('wishlist-page__authGate');
    expect(source).toContain('pages.wishlist.authGateTitle');
    expect(source).toContain('pages.wishlist.authGateLogin');
    expect(source).toContain("buildLoginUrl('/wishlist')");
    expect(source).toContain("navigate('/register?redirect=%2Fwishlist')");
    expect(source).toContain("navigate('/products')");
    expect(source).toContain("navigate('/coupons')");
    expect(source).not.toContain('buildLoginUrlFromWindow');
    expect(source).not.toContain('message.open({');
    expect(css).toContain('Commercial guest wishlist auth gate multi-path conversion');
    expect(css).toMatch(/\.wishlist-page__authGate \.page-feedback__actions \.ant-btn[\s\S]*?min-height:\s*44px/);
  });

  it('keeps the loaded-state conversion action clear of the shared bottom navigation', () => {
    const source = readWishlistSource();
    const css = readWishlistCss();
    const fixCss = css.slice(css.indexOf('F3443:'));

    expect(source).toContain('wishlist-page--withMobileAction');
    expect(source).toContain('wishlist-page__mobileAction');
    expect(fixCss).toContain('--wishlist-mobile-action-bottom: calc(var(--shop-mobile-bottom-nav-height, 72px)');
    expect(fixCss).toMatch(/\.wishlist-page\.wishlist-page--withMobileAction\s*\{[\s\S]*?padding-bottom:\s*calc\([\s\S]*?var\(--wishlist-mobile-action-bottom\)[\s\S]*?var\(--wishlist-mobile-action-height\)[\s\S]*?\)\s*!important;/);
    expect(fixCss).toMatch(/\.wishlist-page\.wishlist-page--withMobileAction \.wishlist-page__mobileAction\s*\{[\s\S]*?bottom:\s*var\(--wishlist-mobile-action-bottom\)\s*!important;[\s\S]*?z-index:\s*1240\s*!important;/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.wishlist-page\.wishlist-page--withMobileAction \.wishlist-page__mobileAction\s*\{[^}]*z-index:\s*8998\s*!important;/);
    expect(fixCss).toMatch(/@media \(max-width:\s*860px\) and \(max-height:\s*430px\)[\s\S]*?\.wishlist-page\.wishlist-page--withMobileAction \.wishlist-page__mobileAction\s*\{[\s\S]*?position:\s*static\s*!important;/);
    expect(fixCss).not.toMatch(/F3443:[\s\S]*?\.wishlist-page__mobileAction\s*\{[^}]*bottom:\s*0\s*!important/);
  });
});

describe('Wishlist async lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hasStoredValue as jest.Mock).mockReturnValue(true);
  });

  it('guards wishlist fetches against stale responses and unmount updates', () => {
    const source = readWishlistSource();
    const fetchStart = source.indexOf('const fetchWishlist = useCallback');
    const fetchSource = source.slice(fetchStart, source.indexOf('useEffect(() => {', fetchStart));

    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('const wishlistFetchSeqRef = useRef(0);');
    expect(source).toContain('wishlistFetchSeqRef.current += 1;');
    expect(fetchSource).toContain('const requestSeq = wishlistFetchSeqRef.current + 1;');
    expect(fetchSource).toContain('wishlistFetchSeqRef.current = requestSeq;');
    expect(fetchSource).toContain('const isCurrentRequest = () => mountedRef.current && wishlistFetchSeqRef.current === requestSeq;');
    expect(fetchSource).toContain('if (!isCurrentRequest()) return;');
    expect(fetchSource).toContain('setItems(res.data);');
    expect(fetchSource).toContain("const errorMessage = getApiErrorMessage(error, t('pages.wishlist.fetchFailed'), language);");
    expect(fetchSource).toContain('setLoadError(errorMessage);');
    expect(fetchSource).toContain("announceAccessibleMessage(errorMessage, 'error');");
    expect(fetchSource).toContain('setLoading(false);');
  });

  it('guards wishlist removal against duplicate in-flight requests', () => {
    const source = readWishlistSource();
    const removeStart = source.indexOf('const handleRemove = async (productId: number) => {');
    const removeSource = source.slice(removeStart, source.indexOf('const handleAddToCart = async', removeStart));

    expect(source).toContain('const [removingProductIds, setRemovingProductIds] = useState<number[]>([]);');
    expect(source).toContain('const removingProductIdsRef = useRef(new Set<number>());');
    expect(removeSource).toContain('if (removingProductIdsRef.current.has(productId)) return;');
    expect(removeSource).toContain('removingProductIdsRef.current.add(productId);');
    expect(removeSource).toContain('setRemovingProductIds((current) => current.includes(productId) ? current : [...current, productId]);');
    expect(removeSource).toContain('removingProductIdsRef.current.delete(productId);');
    expect(removeSource).toContain('setRemovingProductIds((current) => current.filter((id) => id !== productId));');
    expect(source).toContain('const removing = removingProductIds.includes(item.productId);');
    expect(source).toContain('loading={removing}');
    expect(source).toContain('disabled={removing || actionsDisabledByStaleData}');
  });

  it('marks stale wishlist snapshots and blocks wishlist/cart mutations until refresh succeeds', () => {
    const source = readWishlistSource();
    const addStart = source.indexOf('const handleAddToCart = async (productId: number) => {');
    const addSource = source.slice(addStart, source.indexOf('const handleAddAllToCart = async', addStart));
    const addAllStart = source.indexOf('const handleAddAllToCart = async () => {');
    const addAllSource = source.slice(addAllStart, source.indexOf('const clearUnavailableItems = async', addAllStart));
    const clearStart = source.indexOf('const clearUnavailableItems = async () => {');
    const clearSource = source.slice(clearStart, source.indexOf('const wishlistNextActionLabel', clearStart));

    expect(source).toContain('const actionsDisabledByStaleData = Boolean(loadError);');
    expect(source).toContain("message={t('pages.wishlist.loadErrorTitle')}");
    expect(source).toContain("description={t('pages.wishlist.staleDataWarning')}");
    expect(source).toContain('<Button size="small" onClick={fetchWishlist} loading={loading}>');
    expect(source).toContain("announceAccessibleMessage(t('pages.wishlist.staleActionBlocked'), 'warning')");
    expect(addSource).toContain('if (actionsDisabledByStaleData) {');
    expect(addAllSource).toContain('if (actionsDisabledByStaleData) {');
    expect(clearSource).toContain('if (actionsDisabledByStaleData) {');
    expect(source).toContain('disabled={addingAllToCart || directAddItems.length === 0 || actionsDisabledByStaleData}');
    expect(source).toContain('disabled={removing || actionsDisabledByStaleData}');
  });

  it('does not report an initial load failure after the page unmounts', async () => {
    const wishlistRequest = createDeferred<{ data: [] }>();
    (announceAccessibleMessage as jest.Mock).mockClear();
    (wishlistApi.getByUser as jest.Mock).mockReturnValue(wishlistRequest.promise);

    const { unmount } = renderWishlist();

    await waitFor(() => expect(wishlistApi.getByUser).toHaveBeenCalledWith(0));

    unmount();

    await act(async () => {
      wishlistRequest.reject(new Error('wishlist unavailable'));
      await Promise.resolve();
    });

    expect(announceAccessibleMessage).not.toHaveBeenCalled();
  });
});

describe('Wishlist add-all guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hasStoredValue as jest.Mock).mockReturnValue(true);
  });

  it('guards Add all to cart with a synchronous pending ref and shared loading state', () => {
    const source = readWishlistSource();

    expect(source).toContain('const [addingAllToCart, setAddingAllToCart] = useState(false);');
    expect(source).toContain('const addingAllToCartRef = useRef(false);');
    expect(source).toContain('if (addingAllToCartRef.current) return;');
    expect(source).toContain('addingAllToCartRef.current = true;');
    expect(source).toContain('addingAllToCartRef.current = false;');
    expect(source).toContain('loading={addingAllToCart}');
    expect(source).toContain('disabled={addingAllToCart || directAddItems.length === 0 || actionsDisabledByStaleData}');
    expect(source).toContain('loading={wishlistNextAction.tone === \'ready\' && addingAllToCart}');
    expect(source).toContain('disabled={wishlistNextAction.disabled}');
  });

  it('does not add all wishlist items twice during the same pending request', async () => {
    const addRequest = createDeferred<{ data: unknown }>();
    (wishlistApi.getByUser as jest.Mock).mockResolvedValue({
      data: [{
        id: 1,
        userId: 7,
        productId: 101,
        productName: 'Ready food',
        productPrice: 12,
        imageUrl: '/food.jpg',
        stock: 5,
        productStatus: 'ACTIVE',
        requiresSelection: false,
      }],
    });
    (cartApi.addItem as jest.Mock).mockReturnValue(addRequest.promise);

    renderWishlist();

    const addAllButton = await screen.findByRole('button', { name: 'pages.wishlist.addAllToCart: 1' });
    fireEvent.click(addAllButton);
    fireEvent.click(addAllButton);

    await waitFor(() => expect(cartApi.addItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addAllButton).toBeDisabled());
  });
});

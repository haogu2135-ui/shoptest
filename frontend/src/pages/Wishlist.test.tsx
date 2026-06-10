import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { MemoryRouter } from 'react-router-dom';
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

  it('deduplicates the unauthenticated redirect warning with a stable message key', () => {
    const source = readWishlistSource();

    expect(source).toContain("const WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY = 'wishlist-login-required';");
    expect(source).toContain('message.open({');
    expect(source).toContain('key: WISHLIST_LOGIN_REQUIRED_MESSAGE_KEY');
    expect(source).toContain("content: t('messages.loginRequired')");
    expect(source).not.toContain("message.warning(t('messages.loginRequired'))");
  });

  it('keeps the loaded-state conversion action clear of the shared bottom navigation', () => {
    const source = readWishlistSource();
    const css = readWishlistCss();
    const fixCss = css.slice(css.indexOf('F3443:'));

    expect(source).toContain('wishlist-page--withMobileAction');
    expect(source).toContain('wishlist-page__mobileAction');
    expect(fixCss).toContain('--wishlist-mobile-action-bottom: calc(var(--shop-mobile-bottom-nav-height, 74px)');
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

  it('does not report an initial load failure after the page unmounts', async () => {
    const wishlistRequest = createDeferred<{ data: [] }>();
    const messageErrorSpy = jest.spyOn(message, 'error').mockImplementation(() => null as any);
    (wishlistApi.getByUser as jest.Mock).mockReturnValue(wishlistRequest.promise);

    const { unmount } = renderWishlist();

    await waitFor(() => expect(wishlistApi.getByUser).toHaveBeenCalledWith(0));

    unmount();

    await act(async () => {
      wishlistRequest.reject(new Error('wishlist unavailable'));
      await Promise.resolve();
    });

    expect(messageErrorSpy).not.toHaveBeenCalled();
    messageErrorSpy.mockRestore();
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
    expect(source).toContain('disabled={addingAllToCart || directAddItems.length === 0}');
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

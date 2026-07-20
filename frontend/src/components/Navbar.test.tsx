import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { Link, MemoryRouter } from 'react-router-dom';

const mockLogoutAuthSession = jest.fn();
const mockLoginAuthSession = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../api', () => ({
  announcementApi: { getActive: jest.fn(() => Promise.resolve({ data: [] })) },
  cartApi: { getItems: jest.fn() },
  clearStoredAuthSession: jest.fn(),
  couponApi: { getAvailableByUser: jest.fn() },
  notificationApi: { getUnreadCount: jest.fn() },
  productApi: { getByIds: jest.fn() },
  userApi: { getProfile: jest.fn(), logout: jest.fn() },
  wishlistApi: { getCount: jest.fn() },
}));

jest.mock('../api/admin', () => ({
  adminApi: { getMyPermissions: jest.fn() },
  adminSupportApi: {},
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    setCurrency: jest.fn(),
    market: { freeShippingThreshold: 49 },
    formatMoney: (amount: number) => `$${amount.toFixed(2)}`,
  }),
}));

jest.mock('../i18n', () => {
  const labels: Record<string, string> = {
        'common.admin': 'Admin',
        'common.brand': 'ShopMX',
        'common.search': 'Search',
        'home.categories': 'Categories',
        'home.couponsExtra': 'Extra coupons',
        'home.heroEyebrow': 'Pet essentials',
        'home.heroTitle': 'Pet gear',
        'home.trust.easyReturns': 'Easy returns',
        'home.trust.freeShipping': 'Free shipping over {amount}',
        'home.trust.petSafe': 'Pet safe',
        'nav.account': 'My account',
        'nav.ariaCart': 'Cart',
        'nav.ariaCompare': 'Compare',
        'nav.ariaFavorites': 'Favorites',
        'nav.ariaHistory': 'History',
        'nav.ariaHome': 'Home',
        'nav.ariaNotifications': 'Notifications',
        'nav.ariaStockAlerts': 'Stock alerts',
        'nav.badgeLoadFailed': 'Some account counters could not refresh. Pull down or try again later.',
        'nav.coupons': 'Coupons',
        'nav.currency': 'Currency',
        'nav.download': 'Coupons',
        'nav.downloadAndroid': 'Download Android app',
        'nav.easyReturns': 'Easy returns',
        'nav.followDeals': 'Deals',
        'nav.freeShippingOver': 'Free shipping over {amount}',
        'nav.help': 'Help',
        'nav.highlightDeal': 'Deals',
        'nav.language': 'Language',
        'nav.login': 'Log in',
        'nav.logout': 'Log out',
        'nav.mobileApp': 'Android app',
        'nav.mobileAppShort': 'App',
        'nav.mobileAppUnavailable': 'The Android package is not published yet. Please try again later.',
        'nav.more': 'More',
        'nav.petFinder': 'Pet finder',
        'nav.petGallery': 'Pet gallery',
        'nav.products': 'Products',
        'nav.register': 'Register',
        'nav.searchPlaceholder': 'Search products',
        'nav.sell': 'Seller center',
        'nav.springSale': 'Spring sale',
        'nav.trackOrder': 'Track order',
        'nav.petNav.cat': 'Cat',
        'nav.petNav.catBeds': 'Cat beds',
        'nav.petNav.catSmart': 'Cat smart',
        'nav.petNav.catToys': 'Cat toys',
        'nav.petNav.dog': 'Dog',
        'nav.petNav.dogBeds': 'Dog beds',
        'nav.petNav.dogToys': 'Dog toys',
        'nav.petNav.dogWalking': 'Dog walking',
        'nav.petNav.smallPets': 'Small pets',
        'nav.petNav.smartDevices': 'Smart devices',
        'nav.petNav.sleeping': 'Sleeping',
        'nav.petNav.walking': 'Walking',
        'nav.suggestions.catLitter': 'cat litter',
        'nav.suggestions.dogToys': 'dog toys',
        'nav.suggestions.leashes': 'leashes',
        'nav.suggestions.petBeds': 'pet beds',
        'messages.logoutPartialFailure': 'Logout could not revoke the current session completely.',
        'pages.cart.title': 'Cart',
        'pages.coupons.title': 'Coupons',
        'pages.profile.allOrders': 'All orders',
  };

  const translate = (key: string, params?: Record<string, string | number>) => {
    const template = labels[key] || key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (result, [paramKey, value]) => result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value)),
      template,
    );
  };

  return {
    LANGUAGE_LABELS: { en: 'English' },
    SUPPORTED_LANGUAGES: ['en'],
    useLanguage: () => ({
      language: 'en',
      setLanguage: jest.fn(),
      t: translate,
    }),
  };
});

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

jest.mock('../utils/guestCart', () => ({
  getGuestCartItems: jest.fn(() => []),
}));

jest.mock('../utils/guestSupportContext', () => ({
  loadGuestSupportContext: jest.fn(() => null),
}));

jest.mock('../utils/idleScheduler', () => ({
  cancelIdleTask: jest.fn(),
  scheduleIdleTask: jest.fn((callback: () => void) => {
    callback();
    return 1;
  }),
}));

jest.mock('../utils/mobileUpdate', () => ({
  currentMobileVersionCode: jest.fn(() => 10023),
  fetchLatestMobileRelease: jest.fn(),
  isNativeAndroidApp: jest.fn(() => false),
  isNativeMobileApp: jest.fn(() => false),
  openMobileReleaseDownload: jest.fn(),
  resolveMobileReleaseDownloadUrl: jest.fn(),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

jest.mock('../utils/productCompare', () => ({
  readCompareProductIds: jest.fn(() => []),
}));

jest.mock('../utils/roles', () => ({
  getEffectiveRole: jest.fn(() => ''),
  isAdminRole: jest.fn(() => false),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  removeLocalStorageItem: jest.fn(),
  setLocalStorageItem: jest.fn(),
}));

jest.mock('../utils/stockAlerts', () => ({
  readStockAlerts: jest.fn(() => []),
}));

jest.mock('../utils/announcementLinks', () => ({
  normalizeAnnouncementLink: jest.fn(() => ''),
}));

const Navbar = require('./Navbar').default as typeof import('./Navbar').default;
const { announcementApi, cartApi, clearStoredAuthSession, couponApi, notificationApi, userApi, wishlistApi } = require('../api');
const { adminApi } = require('../api/admin');
const {
  fetchLatestMobileRelease,
  resolveMobileReleaseDownloadUrl,
} = require('../utils/mobileUpdate');
const { getGuestCartItems } = require('../utils/guestCart');
const { scheduleIdleTask } = require('../utils/idleScheduler');
const { readCompareProductIds } = require('../utils/productCompare');
const { readStockAlerts } = require('../utils/stockAlerts');
const { getLocalStorageItem } = require('../utils/safeStorage');
const { reportNonBlockingError } = require('../utils/nonBlockingError');

const readNavbarSource = () => fs.readFileSync(path.resolve(__dirname, 'Navbar.tsx'), 'utf8');
const readNavbarCss = () => fs.readFileSync(path.resolve(__dirname, 'Navbar.css'), 'utf8');
const readMobileAppCss = () => fs.readFileSync(path.resolve(__dirname, '../mobile-app.css'), 'utf8');

const renderNavbar = (children?: React.ReactNode) => render(
  <MemoryRouter>
    <Navbar />
    {children}
  </MemoryRouter>,
);

const flushScheduledIdleTasks = async () => {
  await act(async () => {
    (scheduleIdleTask as jest.Mock).mock.calls.forEach(([callback]) => {
      callback();
    });
    // Drain badge refresh promise chains (cart -> notification -> wishlist -> coupons -> alerts).
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('Navbar Android app download entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.classList.remove('shop-mobile-app');
    (announcementApi.getActive as jest.Mock).mockResolvedValue({ data: [] });
    (adminApi.getMyPermissions as jest.Mock).mockResolvedValue({ data: { permissions: [], role: 'USER' } });
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [] });
    (couponApi.getAvailableByUser as jest.Mock).mockResolvedValue({ data: [] });
    (notificationApi.getUnreadCount as jest.Mock).mockResolvedValue({ data: { count: 0 } });
    (userApi.getProfile as jest.Mock).mockResolvedValue({ data: { role: 'USER' } });
    (userApi.logout as jest.Mock).mockResolvedValue({ data: {} });
    (wishlistApi.getCount as jest.Mock).mockResolvedValue({ data: { count: 0 } });
    (clearStoredAuthSession as jest.Mock).mockImplementation(jest.fn());
    mockLoginAuthSession.mockReset();
    mockLogoutAuthSession.mockReset();
    mockUseAuth.mockReturnValue({
      user: null,
      token: '',
      login: mockLoginAuthSession,
      logout: mockLogoutAuthSession,
      loading: false,
    });
    (getLocalStorageItem as jest.Mock).mockReturnValue(null);
    (getGuestCartItems as jest.Mock).mockReturnValue([]);
    (readCompareProductIds as jest.Mock).mockReturnValue([]);
    (readStockAlerts as jest.Mock).mockReturnValue([]);
    (fetchLatestMobileRelease as jest.Mock).mockResolvedValue(null);
    (resolveMobileReleaseDownloadUrl as jest.Mock).mockReturnValue('');
  });

  it('keeps the browser entry visible without exposing an APK URL when no signed release is published', async () => {
    const warningSpy = jest.spyOn(message, 'warning').mockImplementation(jest.fn());

    renderNavbar();

    const unavailableButtons = await screen.findAllByRole('button', {
      name: 'The Android package is not published yet. Please try again later.',
    });
    expect(unavailableButtons.length).toBeGreaterThan(0);

    const apkLinks = screen.queryAllByRole('link')
      .filter((link) => (link.getAttribute('href') || '').includes('.apk'));
    expect(apkLinks).toHaveLength(0);

    fireEvent.click(unavailableButtons[0]);
    expect(warningSpy).toHaveBeenCalledWith('The Android package is not published yet. Please try again later.');

    warningSpy.mockRestore();
  });

  it('keeps the Spanish Products bottom-nav label readable before the icon-only fallback', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();
    const f3393Css = css.slice(css.indexOf('/* F3393'));

    expect(source).toContain("const bottomBarClassName = `shop-nav__bottomBar shop-nav__bottomBar--${language}");
    expect(f3393Css).toMatch(/@media \(min-width:\s*341px\) and \(max-width:\s*380px\)\s*\{/);
    expect(f3393Css).toMatch(/\.shop-nav__bottomBar--es:not\(\.shop-nav__bottomBar--native\)\s*\{[\s\S]*?grid-template-columns:\s*0\.94fr 1\.1fr 1fr 0\.98fr 0\.88fr 1fr;[\s\S]*?column-gap:\s*3px;/);
    expect(f3393Css).toMatch(/\.shop-nav__bottomBar--es \.shop-nav__bottomItem--products span:not\(\.anticon\):not\(\.ant-badge\):not\(\.ant-scroll-number\)\s*\{[\s\S]*?font-size:\s*9\.5px\s*!important;[\s\S]*?letter-spacing:\s*0;[\s\S]*?text-overflow:\s*clip;/);
    expect(css).toMatch(/@media \(max-width:\s*340px\)\s*\{[\s\S]*?\.shop-nav__bottomItem span:not\(\.anticon\):not\(\.ant-badge\):not\(\.ant-scroll-number\)\s*\{[\s\S]*?width:\s*1px;/);
  });

  it('keeps mobile bottom navigation keyboard focus visible', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();

    expect(source).not.toContain('MobileNavigation.tsx');
    expect(source).toContain('shop-nav__bottomItem');
    expect(css).toMatch(/\.shop-nav a:focus-visible,[\s\S]*?\.shop-nav button:focus-visible\s*\{[\s\S]*?outline:\s*2px solid rgba\(238,\s*77,\s*45,\s*0\.9\);[\s\S]*?outline-offset:\s*3px;/);
    expect(css).toMatch(/\.shop-nav__bottomItem/);
    expect(css).not.toMatch(/\.shop-nav__bottomItem[^{]*\{[^}]*outline:\s*none/);
  });

  it('keeps language selector options tied to the supported locale registry', () => {
    const source = readNavbarSource();

    expect(source).toContain("const languageOptions = SUPPORTED_LANGUAGES.map((value) => ({ value, label: LANGUAGE_LABELS[value] }));");
    expect(source).not.toMatch(/const\s+languageOptions\s*=\s*useMemo\s*\(\s*\(\)\s*=>[\s\S]*?,\s*\[\s*\]\s*\)/);
    expect(source).toContain('...languageOptions.map((item) => ({');
  });

  it('warns before normalizing over-limit Navbar search submissions', () => {
    const source = readNavbarSource();
    const enLocale = fs.readFileSync(path.resolve(__dirname, '../locales/en.json'), 'utf8');
    const esLocale = fs.readFileSync(path.resolve(__dirname, '../locales/es.json'), 'utf8');
    const zhLocale = fs.readFileSync(path.resolve(__dirname, '../locales/zh.json'), 'utf8');
    const searchStart = source.indexOf('const handleSearch = (value: string) => {');
    const searchEnd = source.indexOf('const searchBySuggestion = (key: string) => {', searchStart);
    const searchSource = source.slice(searchStart, searchEnd);

    expect(source).toContain('const NAV_SEARCH_MAX_LENGTH = 80;');
    expect(source).toContain('const normalizeNavKeyword = (value: string) => value.trim().slice(0, NAV_SEARCH_MAX_LENGTH);');
    expect(searchStart).toBeGreaterThan(-1);
    expect(searchEnd).toBeGreaterThan(searchStart);
    expect(searchSource).toContain('const trimmedKeyword = value.trim();');
    expect(searchSource).toContain('if (trimmedKeyword.length > NAV_SEARCH_MAX_LENGTH) {');
    expect(searchSource).toContain("message.warning(t('nav.searchLimitWarning', { count: NAV_SEARCH_MAX_LENGTH }));");
    expect(searchSource).toContain('const keyword = trimmedKeyword.slice(0, NAV_SEARCH_MAX_LENGTH);');
    expect(searchSource).toContain("navigate(`/products?keyword=${encodeURIComponent(keyword)}`);");
    expect(source).not.toContain('maxLength={NAV_SEARCH_MAX_LENGTH}');
    expect(enLocale).toContain('"searchLimitWarning"');
    expect(esLocale).toContain('"searchLimitWarning"');
    expect(zhLocale).toContain('"searchLimitWarning"');
  });

  it('announces storefront announcement ticker updates accessibly', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();
    const announcementStart = source.indexOf('className={announcementClassName}');
    const announcementSource = source.slice(announcementStart, source.indexOf('<div className="shop-nav__ticker">', announcementStart));

    expect(announcementStart).toBeGreaterThanOrEqual(0);
    expect(source).toContain('const [announcementPaused, setAnnouncementPaused] = useState(false);');
    expect(source).toContain("const announcementClassName = `shop-nav__announcement${announcementPaused ? ' shop-nav__announcement--paused' : ''}`;");
    expect(source).toContain("const announcementToggleLabel = announcementPaused ? t('nav.resumeAnnouncements') : t('nav.pauseAnnouncements');");
    expect(announcementSource).toContain('role="status"');
    expect(announcementSource).toContain("aria-label={t('nav.announcements')}");
    expect(announcementSource).toContain('aria-live="polite"');
    expect(announcementSource).toContain('aria-atomic="false"');
    expect(announcementSource).toContain('aria-relevant="additions text"');
    expect(announcementSource).toContain("aria-roledescription={t('nav.announcementTicker')}");
    expect(announcementSource).toContain('className="shop-nav__announcementToggle"');
    expect(announcementSource).toContain('aria-label={announcementToggleLabel}');
    expect(announcementSource).toContain('aria-pressed={announcementPaused}');
    expect(announcementSource).toContain('onClick={() => setAnnouncementPaused((current) => !current)}');
    expect(announcementSource).toContain('announcementPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />');
    expect(css).toMatch(/\.shop-nav__announcement:hover \.shop-nav__ticker,[\s\S]*?\.shop-nav__announcement:focus-within \.shop-nav__ticker,[\s\S]*?\.shop-nav__announcement--paused \.shop-nav__ticker\s*\{[\s\S]*?animation-play-state:\s*paused;/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.shop-nav__ticker\s*\{[\s\S]*?animation:\s*none;/);
  });

  it('keeps the mobile bottom bar storefront-only for non-admin roles', () => {
    const source = readNavbarSource();
    const bottomBarStart = source.indexOf('<nav className={bottomBarClassName}');
    const bottomBarSource = source.slice(bottomBarStart, source.indexOf('</nav>', bottomBarStart));

    expect(bottomBarStart).toBeGreaterThanOrEqual(0);
    expect(bottomBarSource).toContain('to="/"');
    expect(bottomBarSource).toContain('to="/products"');
    expect(bottomBarSource).toContain('to="/coupons"');
    expect(bottomBarSource).toContain('to="/cart"');
    expect(bottomBarSource).toContain("to={token ? '/profile' : '/login'}");
    expect(bottomBarSource).not.toContain('/admin');
    expect(bottomBarSource).not.toContain('User Management');
    expect(bottomBarSource).not.toContain('Audit Log');
    expect(bottomBarSource).not.toContain('Config Center');
  });

  it('keeps scroll state from withdrawing the native bottom rail', () => {
    const css = readNavbarCss();
    const mobileCss = readMobileAppCss();

    expect(mobileCss).toContain('shop-app-shell--bottom-rail-conflict');
    expect(mobileCss).toMatch(/shop-app-shell--bottom-rail-conflict \.shop-nav__bottomBar\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?pointer-events:\s*none\s*!important;/);
    expect(mobileCss).not.toMatch(/shop-app-shell--scrolled \.shop-nav__bottomBar[\s\S]*?display:\s*none\s*!important;/);
    expect(css).not.toMatch(/shop-app-shell--scrolled \.shop-nav__bottomBar[\s\S]*?visibility:\s*hidden\s*!important;/);
    expect(mobileCss).toMatch(/\.shop-nav__bottomBar :where\([\s\S]*?\.shop-nav__bottomItem,[\s\S]*?\.ant-scroll-number-only-unit[\s\S]*?\)\s*\{[\s\S]*?font-size:\s*12px\s*!important;/);
  });

  it('keeps localized App bottom-nav labels readable before icon-only fallback', () => {
    const mobileCss = readMobileAppCss();
    const localizedLabelCss = mobileCss.slice(mobileCss.indexOf('/* F3593 APP closure: localized bottom-rail labels stay readable'));

    expect(localizedLabelCss).toMatch(/@media \(min-width:\s*341px\) and \(max-width:\s*380px\)\s*\{/);
    expect(localizedLabelCss).toMatch(/\.shop-nav__bottomItem\s*\{[\s\S]*?min-width:\s*0\s*!important;/);
    expect(localizedLabelCss).toMatch(/\.shop-nav__bottomItem > span:not\(\.anticon\):not\(\.ant-badge\):not\(\.ant-scroll-number\),[\s\S]*?\.shop-nav__bottomItem \.ant-badge \+ span\s*\{[\s\S]*?display:\s*-webkit-box\s*!important;[\s\S]*?max-height:\s*calc\(2 \* 12px \* 1\.08\)\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?-webkit-line-clamp:\s*2\s*!important;/);
  });

  it('uses compact non-wrapping utility navigation in tablet landscape widths', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();
    const f3358Css = css.slice(css.indexOf('/* F3358'));

    expect(source).toContain("{ key: 'track-order', icon: <ShoppingOutlined />, label: t('nav.trackOrder'), onClick: () => navigate('/track-order') }");
    expect(source).toContain("{ key: 'pet-finder', icon: <SearchOutlined />, label: t('nav.petFinder'), onClick: () => navigate('/pet-finder') }");
    expect(source).toContain("{ key: 'deals', icon: <GiftOutlined />, label: t('nav.followDeals'), onClick: () => navigate('/products?discount=true') }");
    expect(f3358Css).toMatch(/@media \(min-width:\s*781px\) and \(max-width:\s*1024px\)\s*\{/);
    expect(f3358Css).toMatch(/\.shop-nav__top\s*\{[\s\S]*?display:\s*none;/);
    expect(f3358Css).toMatch(/\.shop-nav__inner--main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(150px,\s*auto\) minmax\(280px,\s*1fr\) auto;/);
    expect(f3358Css).toMatch(/\.shop-nav__actions\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?flex-wrap:\s*nowrap;/);
    expect(f3358Css).toMatch(/\.shop-nav__mobile-locale,[\s\S]*?\.shop-nav__secondary-action\.shop-nav__more-trigger\s*\{[\s\S]*?display:\s*inline-flex\s*!important;/);
    expect(f3358Css).toMatch(/\.shop-nav__actions button\[aria-label\],[\s\S]*?\.shop-nav__more-trigger\s*\{[\s\S]*?width:\s*44px;[\s\S]*?min-height:\s*44px;/);
    expect(f3358Css).toMatch(/\.shop-nav__mega button,[\s\S]*?\.shop-nav__megaButton\s*\{[\s\S]*?white-space:\s*nowrap\s*!important;/);
  });

  it('wraps Spanish mobile-web category rail labels instead of clipping them', () => {
    const css = readNavbarCss();
    const fixCss = css.slice(css.indexOf('/* UI-20260608-04'));

    expect(fixCss).toContain('@media (min-width: 341px) and (max-width: 430px)');
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega::after\s*\{[\s\S]*?content:\s*none\s*!important;[\s\S]*?display:\s*none\s*!important;/);
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega button,[\s\S]*?body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__megaButton\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*break-word\s*!important;/);
    expect(fixCss).toMatch(/@media \(max-width:\s*340px\)\s*\{[\s\S]*?body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
  });

  it('shows a mobile category rail overflow affordance while preserving scroll focus padding', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();
    const f2710Start = css.lastIndexOf('F2710: mobile category navigation needs an explicit horizontal-scroll affordance.');
    const f2710Css = css.slice(f2710Start);

    expect(source).toContain("{ key: 'smart-devices', label: t('nav.petNav.smartDevices')");
    expect(source).toContain("{ key: 'pet-finder', label: t('nav.petFinder')");
    expect(source).toContain("{ key: 'pet-gallery', label: t('nav.petGallery')");
    expect(f2710Start).toBeGreaterThan(css.lastIndexOf('UI-20260608-04: mobile-web Spanish category labels should be readable'));
    expect(f2710Css).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav:not\(\.shop-nav--es\) \.shop-nav__mega\s*\{[\s\S]*?overflow-x:\s*auto\s*!important;[\s\S]*?scroll-padding-inline:\s*0 44px\s*!important;[\s\S]*?scroll-snap-type:\s*x proximity\s*!important;/);
    expect(f2710Css).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav:not\(\.shop-nav--es\) \.shop-nav__mega::after\s*\{[\s\S]*?content:\s*'>'\s*!important;[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?right:\s*0\s*!important;/);
    expect(f2710Css).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav:not\(\.shop-nav--es\) \.shop-nav__megaButton\s*\{[\s\S]*?min-width:\s*max-content\s*!important;[\s\S]*?scroll-margin-inline:\s*0 44px\s*!important;/);
    expect(f2710Css).not.toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega::after/);
  });

  it('keeps More dropdown menus scrollable inside short landscape viewports', () => {
    const source = readNavbarSource();
    const css = readNavbarCss();
    const f3357Css = css.slice(css.indexOf('/* F3357'));

    expect(source.match(/overlayClassName="shop-nav__dropdown-popup"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain('getPopupContainer={() => document.body}');
    expect(f3357Css).toMatch(/@media \(max-height:\s*430px\)\s*\{/);
    expect(f3357Css).toMatch(/body \.shop-nav__dropdown-popup\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?top:\s*max\(8px,\s*env\(safe-area-inset-top,\s*0px\)\)\s*!important;[\s\S]*?bottom:\s*auto\s*!important;/);
    expect(f3357Css).toMatch(/body \.shop-nav__dropdown-popup \.ant-dropdown-menu\s*\{[\s\S]*?max-height:\s*calc\(100vh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
    expect(f3357Css).toMatch(/@media \(max-width:\s*780px\) and \(max-height:\s*430px\)\s*\{[\s\S]*?max-height:\s*calc\(100vh - var\(--shop-mobile-bottom-nav-height,\s*72px\) - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f3357Css).toMatch(/@supports \(height:\s*100dvh\)\s*\{[\s\S]*?max-height:\s*calc\(100dvh - var\(--shop-mobile-bottom-nav-height,\s*72px\) - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
  });

  it('uses a compact first-screen navbar in short mobile landscape', () => {
    const css = readNavbarCss();
    const f2855Css = css.slice(css.indexOf('/* F2855'));

    expect(f2855Css).toMatch(/@media \(max-width:\s*780px\) and \(max-height:\s*430px\)\s*\{/);
    expect(f2855Css).toMatch(/\.shop-nav__announcement,[\s\S]*?\.shop-nav__bottomBar\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(f2855Css).toMatch(/\.shop-nav__inner--main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(104px,\s*auto\) minmax\(0,\s*1fr\) auto\s*!important;[\s\S]*?grid-template-areas:\s*"brand search actions";/);
    expect(f2855Css).toMatch(/\.shop-nav__brand\s*\{[\s\S]*?grid-area:\s*brand;[\s\S]*?min-height:\s*44px;/);
    expect(f2855Css).toMatch(/\.shop-nav__search\s*\{[\s\S]*?grid-area:\s*search;[\s\S]*?grid-row:\s*auto\s*!important;/);
    expect(f2855Css).toMatch(/\.shop-nav \.shop-nav__search \.ant-input-group\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?height:\s*44px\s*!important;/);
    expect(f2855Css).toMatch(/\.shop-nav__actions\s*\{[\s\S]*?grid-area:\s*actions;[\s\S]*?flex-wrap:\s*nowrap\s*!important;[\s\S]*?overflow-x:\s*auto;/);
  });

  it('turns the browser entry into an APK link only when release metadata allows it', async () => {
    (fetchLatestMobileRelease as jest.Mock).mockResolvedValue({
      platform: 'android',
      appId: 'com.shoptest.mobile',
      versionCode: 10024,
      apkUrl: '/downloads/shoptest-1.0.24.apk',
      releaseSigned: true,
      certificateSha256: 'B'.repeat(64),
      fileName: 'shoptest-1.0.24.apk',
      sizeBytes: 123456,
      sha256: 'a'.repeat(64),
      manifestUrl: 'https://pet.686888666.xyz/downloads/mobile-version.json',
    });
    (resolveMobileReleaseDownloadUrl as jest.Mock).mockReturnValue('https://pet.686888666.xyz/downloads/shoptest-1.0.24.apk');

    renderNavbar();

    await waitFor(() => {
      expect(fetchLatestMobileRelease).toHaveBeenCalled();
      expect(resolveMobileReleaseDownloadUrl).toHaveBeenCalled();
    });

    await waitFor(() => {
      const downloadLinks = screen.getAllByRole('link', { name: 'Download Android app' })
        .filter((link) => link.getAttribute('href') === 'https://pet.686888666.xyz/downloads/shoptest-1.0.24.apk');
      expect(downloadLinks.length).toBeGreaterThan(0);
    });
  });

  it('closes mobile dropdown menus after route navigation', async () => {
    renderNavbar(<Link to="/products" aria-label="Go products">Go products</Link>);

    const moreButtons = await screen.findAllByRole('button', { name: /^More:/ });
    const moreButton = moreButtons[0];

    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('link', { name: 'Go products' }));

    await waitFor(() => {
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('keeps dropdown reset tied to route path, search, and hash changes', () => {
    const source = readNavbarSource();

    expect(source).toContain('const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});');
    expect(source).toContain('const setDropdownOpen = useCallback((key: string, open: boolean) => {');
    expect(source).toContain('setOpenDropdowns((current) => (open ? { [key]: true } : { ...current, [key]: false }));');
    expect(source).toContain('useEffect(() => {\n    setOpenDropdowns({});\n  }, [location.hash, location.pathname, location.search]);');
  });

  it('keeps logout cleanup scoped to auth badge and menu state', () => {
    const source = readNavbarSource();
    const logoutStart = source.indexOf('const handleLogout = () => {');
    const logoutEnd = source.indexOf('const handleSearch = (value: string) => {', logoutStart);
    const logoutSource = source.slice(logoutStart, logoutEnd);

    expect(logoutStart).toBeGreaterThan(-1);
    expect(logoutEnd).toBeGreaterThan(logoutStart);
    expect(source).toContain("import { useAuth } from '../hooks/useAuth';");
    expect(source).toContain('const { user: authUser, token, logout: logoutAuthSession } = useAuth();');
    expect(logoutSource).toContain('const loginUrl = buildLoginUrlFromWindow();');
    expect(logoutSource).toContain('logoutAuthSession();');
    expect(logoutSource).not.toContain('userApi.logout');
    expect(logoutSource).not.toContain('clearStoredAuthSession');
    expect(logoutSource).toContain('setCartCount(0);');
    expect(logoutSource).toContain('setUnreadCount(0);');
    expect(logoutSource).toContain('setWishlistCount(0);');
    expect(logoutSource).toContain('setCouponCount(0);');
    expect(logoutSource).toContain('setOpenDropdowns({});');
    expect(logoutSource).toContain('badgeLoadWarningShown.current = false;');
    expect(logoutSource).toContain('navigate(loginUrl, { replace: true });');
    expect(source).not.toContain('adminUnseenCount');
    expect(source).not.toContain('privacyRequested');
    expect(source).not.toContain('announcementIndex');
  });

  it('coalesces authenticated badge refreshes into one initial idle task', () => {
    const source = readNavbarSource();
    const refreshStart = source.indexOf('const refreshAccountBadgeCounts = async () => {');
    const refreshEnd = source.indexOf('const refreshLocalCountsFromStorage = (event: StorageEvent) => {', refreshStart);
    const initialStart = source.indexOf('refreshCompareCount();', refreshEnd);
    const initialEnd = source.indexOf("window.addEventListener('shop:cart-updated'", initialStart);
    const refreshSource = source.slice(refreshStart, refreshEnd);
    const initialSource = source.slice(initialStart, initialEnd);

    expect(refreshStart).toBeGreaterThan(-1);
    expect(refreshEnd).toBeGreaterThan(refreshStart);
    expect(refreshSource).toContain('await refreshCartCount();');
    expect(refreshSource).toContain('await refreshUnreadCount();');
    expect(refreshSource).toContain('await refreshWishlistCount();');
    expect(refreshSource).toContain('await refreshCouponCount();');
    expect(refreshSource).toContain('await refreshAlertCount();');
    expect(initialStart).toBeGreaterThan(-1);
    expect(initialEnd).toBeGreaterThan(initialStart);
    expect(initialSource).toContain('queueIdleRefresh(refreshAccountBadgeCounts, 650);');
    expect(initialSource).not.toContain('queueIdleRefresh(refreshCartCount');
    expect(initialSource).not.toContain('queueIdleRefresh(refreshUnreadCount');
    expect(initialSource).not.toContain('queueIdleRefresh(refreshWishlistCount');
    expect(initialSource).not.toContain('queueIdleRefresh(refreshCouponCount');
    expect(initialSource).not.toContain('queueIdleRefresh(refreshAlertCount, token ? 1900 : 900)');
  });

  it('keeps cart badge rendering shared across Navbar cart entry points', () => {
    const source = readNavbarSource();
    const badgeStart = source.indexOf('const renderCartBadge = () => (');
    const badgeEnd = source.indexOf('const androidApkUrl = useMemo', badgeStart);
    const badgeSource = source.slice(badgeStart, badgeEnd);

    expect(badgeStart).toBeGreaterThan(-1);
    expect(badgeEnd).toBeGreaterThan(badgeStart);
    expect(source).toContain('const safeCartCount = normalizeBadgeCount(cartCount);');
    expect(source).toContain("const cartBadgeLabel = `${t('nav.ariaCart')}: ${safeCartCount}`;");
    expect(badgeSource).toContain('<Badge count={safeCartCount} size="small" overflowCount={99}>');
    expect(badgeSource).toContain('<ShoppingCartOutlined />');
    expect(source.match(/\{renderCartBadge\(\)\}/g) ?? []).toHaveLength(3);
    expect(source).not.toContain('<Badge count={cartCount}');
  });

  it('uses compact mobile navigation on task-focused storefront routes', () => {
    const css = readNavbarCss();
    const taskNavCss = css.slice(css.indexOf('/* Mobile task pages'));

    expect(taskNavCss).toMatch(/@media \(max-width:\s*780px\)\s*\{/);
    expect(taskNavCss).toContain('.shop-app-shell--product-detail .shop-nav__search');
    expect(taskNavCss).toContain('.shop-app-shell--cart .shop-nav__mega');
    expect(taskNavCss).toContain('.shop-app-shell--checkout-flow .shop-nav__search');
    expect(taskNavCss).toContain('.shop-app-shell--order-tracking-flow .shop-nav__mega');
    expect(taskNavCss).toContain('.shop-app-shell--auth-flow .shop-nav__search');
    expect(taskNavCss).toMatch(/\.shop-app-shell--auth-flow \.shop-nav__inner--main[\s\S]*?grid-template-areas:\s*"brand actions"\s*!important;/);
    expect(taskNavCss).toMatch(/\.shop-app-shell--product-detail \.shop-nav__brandCopy small[\s\S]*?display:\s*none;/);
    expect(taskNavCss).not.toContain('.shop-app-shell--home .shop-nav__search');
    expect(taskNavCss).not.toContain('.shop-app-shell--product-list .shop-nav__mega');
  });

  it('hides the floating bottom navigation on cart task pages', () => {
    const css = readNavbarCss();
    const bottomNavCss = css.slice(css.indexOf('/* Mobile bottom commerce navigation */'));

    expect(bottomNavCss).toMatch(/\.shop-app-shell--product-detail \.shop-nav__bottomBar,[\s\S]*?\.shop-app-shell--cart \.shop-nav__bottomBar,[\s\S]*?\.shop-app-shell--checkout-flow \.shop-nav__bottomBar[\s\S]*?display:\s*none;/);
  });

  it('keeps localized bottom navigation labels readable before the icon-only fallback', () => {
    const navbarCss = readNavbarCss();
    const mobileAppCss = readMobileAppCss();
    const navbarFallback = navbarCss.slice(navbarCss.indexOf('/* F3393: 360px phones need two-line bottom labels before the icon-only fallback. */'));
    const appFallback = mobileAppCss.slice(mobileAppCss.indexOf('/* F3593 APP closure: localized bottom-rail labels stay readable'));

    expect(navbarFallback).toMatch(/@media \(min-width:\s*341px\) and \(max-width:\s*380px\)/);
    expect(navbarFallback).toMatch(/\.shop-nav__bottomBar--native[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(navbarFallback).toContain('white-space: normal !important;');
    expect(navbarFallback).toContain('overflow-wrap: anywhere;');
    expect(navbarFallback).toContain('-webkit-line-clamp: 2;');
    expect(appFallback).toMatch(/@media \(min-width:\s*341px\) and \(max-width:\s*380px\)/);
    expect(appFallback).toContain('white-space: normal !important;');
    expect(appFallback).toContain('overflow-wrap: anywhere !important;');
    expect(appFallback).toContain('-webkit-line-clamp: 2 !important;');
  });

  it('shows one visible warning when account badge refreshes fail', async () => {
    const warningSpy = jest.spyOn(message, 'warning').mockImplementation(jest.fn());
    mockUseAuth.mockReturnValue({
      user: { id: 12, username: 'Mia', role: 'USER' },
      token: 'member-token',
      login: mockLoginAuthSession,
      logout: mockLogoutAuthSession,
      loading: false,
    });
    (getLocalStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'username') return 'Mia';
      return null;
    });
    const cartError = new Error('cart badge unavailable');
    const notificationError = new Error('notification badge unavailable');
    (cartApi.getItems as jest.Mock).mockRejectedValue(cartError);
    (notificationApi.getUnreadCount as jest.Mock).mockRejectedValue(notificationError);

    renderNavbar();

    await flushScheduledIdleTasks();

    await waitFor(() => {
      expect(cartApi.getItems).toHaveBeenCalledWith(0);
    });

    await waitFor(() => {
      expect(warningSpy).toHaveBeenCalledWith('Some account counters could not refresh. Pull down or try again later.');
    });

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(reportNonBlockingError).toHaveBeenCalledWith('Navbar.refreshCartBadge', cartError);
    expect(reportNonBlockingError).toHaveBeenCalledWith('Navbar.refreshNotificationBadge', notificationError);

    warningSpy.mockRestore();
  });

  it('reports announcement load failures without breaking navigation render', async () => {
    const announcementError = new Error('announcements unavailable');
    (announcementApi.getActive as jest.Mock).mockRejectedValueOnce(announcementError);

    renderNavbar();

    expect(await screen.findByRole('link', { name: 'Track order' })).toBeInTheDocument();
    await waitFor(() => {
      expect(reportNonBlockingError).toHaveBeenCalledWith('Navbar.fetchAnnouncements', announcementError);
    });
  });

  it('delegates logout revocation and session cleanup to the auth context', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 12, username: 'Mia', role: 'USER' },
      token: 'member-token',
      login: mockLoginAuthSession,
      logout: mockLogoutAuthSession,
      loading: false,
    });
    (getLocalStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'username') return 'Mia';
      return null;
    });

    renderNavbar();

    const logoutButtons = await screen.findAllByRole('button', { name: 'Log out' });
    fireEvent.click(logoutButtons[0]);

    expect(mockLogoutAuthSession).toHaveBeenCalledTimes(1);
    expect(userApi.logout).not.toHaveBeenCalled();
    expect(clearStoredAuthSession).not.toHaveBeenCalled();
  });
});

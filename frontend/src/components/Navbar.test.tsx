import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { announcementApi } from '../api';
import {
  fetchLatestMobileRelease,
  resolveMobileReleaseDownloadUrl,
} from '../utils/mobileUpdate';
import { getGuestCartItems } from '../utils/guestCart';
import { readCompareProductIds } from '../utils/productCompare';
import { readStockAlerts } from '../utils/stockAlerts';

jest.mock('../api', () => ({
  adminApi: { getMyPermissions: jest.fn() },
  announcementApi: { getActive: jest.fn(() => Promise.resolve({ data: [] })) },
  cartApi: { getItems: jest.fn() },
  clearStoredAuthSession: jest.fn(),
  couponApi: { getAvailableByUser: jest.fn() },
  notificationApi: { getUnreadCount: jest.fn() },
  productApi: { getByIds: jest.fn() },
  userApi: { getProfile: jest.fn(), logout: jest.fn() },
  wishlistApi: { getCount: jest.fn() },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    setCurrency: jest.fn(),
    market: { freeShippingThreshold: 49 },
    formatMoney: (amount: number) => `$${amount.toFixed(2)}`,
  }),
}));

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'common.admin': 'Admin',
        'common.brand': 'ShopMX',
        'common.search': 'Search',
        'home.categories': 'Categories',
        'home.couponsExtra': 'Extra coupons',
        'home.heroEyebrow': 'Pet essentials',
        'home.heroTitle': 'Pet gear',
        'home.trust.easyReturns': 'Easy returns',
        'home.trust.freeShipping': `Free shipping over ${params?.amount}`,
        'home.trust.petSafe': 'Pet safe',
        'nav.account': 'My account',
        'nav.ariaCart': 'Cart',
        'nav.ariaCompare': 'Compare',
        'nav.ariaFavorites': 'Favorites',
        'nav.ariaHistory': 'History',
        'nav.ariaHome': 'Home',
        'nav.ariaNotifications': 'Notifications',
        'nav.ariaStockAlerts': 'Stock alerts',
        'nav.coupons': 'Coupons',
        'nav.currency': 'Currency',
        'nav.download': 'Coupons',
        'nav.downloadAndroid': 'Download Android app',
        'nav.easyReturns': 'Easy returns',
        'nav.followDeals': 'Deals',
        'nav.freeShippingOver': `Free shipping over ${params?.amount}`,
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
        'pages.cart.title': 'Cart',
        'pages.coupons.title': 'Coupons',
        'pages.profile.allOrders': 'All orders',
      };
      return labels[key] || key;
    },
  }),
}));

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

const renderNavbar = () => render(
  <MemoryRouter>
    <Navbar />
  </MemoryRouter>,
);

const readNavbarCss = () => fs.readFileSync(path.resolve(__dirname, 'Navbar.css'), 'utf8');

describe('Navbar Android app download entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (announcementApi.getActive as jest.Mock).mockResolvedValue({ data: [] });
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

  it('wraps Spanish mobile-web category rail labels instead of clipping them', () => {
    const css = readNavbarCss();
    const fixCss = css.slice(css.indexOf('/* UI-20260608-04'));

    expect(fixCss).toContain('@media (min-width: 341px) and (max-width: 430px)');
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega::after\s*\{[\s\S]*?content:\s*none\s*!important;[\s\S]*?display:\s*none\s*!important;/);
    expect(fixCss).toMatch(/body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega button,[\s\S]*?body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__megaButton\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*break-word\s*!important;/);
    expect(fixCss).toMatch(/@media \(max-width:\s*340px\)\s*\{[\s\S]*?body:not\(\.shop-mobile-app\) \.shop-nav\.shop-nav--es \.shop-nav__mega\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
  });

  it('turns the browser entry into an APK link only when release metadata allows it', async () => {
    (fetchLatestMobileRelease as jest.Mock).mockResolvedValue({ versionCode: 10024 });
    (resolveMobileReleaseDownloadUrl as jest.Mock).mockReturnValue('https://pet.686888666.xyz/downloads/shoptest-1.0.24.apk');

    renderNavbar();

    await waitFor(() => {
      const downloadLinks = screen.getAllByRole('link', { name: 'Download Android app' })
        .filter((link) => link.getAttribute('href') === 'https://pet.686888666.xyz/downloads/shoptest-1.0.24.apk');
      expect(downloadLinks.length).toBeGreaterThan(0);
    });
  });
});

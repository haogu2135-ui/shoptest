import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown, Input, message, Select } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOutlined,
  BellOutlined,
  BarChartOutlined,
  CheckOutlined,
  CustomerServiceOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  GiftOutlined,
  GlobalOutlined,
  HeartOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { adminApi, announcementApi, cartApi, clearStoredAuthSession, couponApi, notificationApi, productApi, userApi, wishlistApi } from '../api';
import { Language, useLanguage } from '../i18n';
import type { SiteAnnouncementPublic } from '../types';
import { CurrencyCode, markets } from '../utils/market';
import { dispatchDomEvent } from '../utils/domEvents';
import { useMarket } from '../hooks/useMarket';
import { getGuestCartItems } from '../utils/guestCart';
import { readCompareProductIds } from '../utils/productCompare';
import { getEffectiveRole, isAdminRole } from '../utils/roles';
import { readStockAlerts } from '../utils/stockAlerts';
import { loadGuestSupportContext } from '../utils/guestSupportContext';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../utils/safeStorage';
import { cancelIdleTask, scheduleIdleTask, type ScheduledIdleTask } from '../utils/idleScheduler';
import { normalizeAnnouncementLink } from '../utils/announcementLinks';
import {
  currentMobileVersionCode,
  fetchLatestMobileRelease,
  isNativeAndroidApp,
  isNativeMobileApp,
  openMobileReleaseDownload,
  resolveMobileReleaseDownloadUrl,
  type MobileReleaseManifest,
} from '../utils/mobileUpdate';
import './Navbar.css';

const { Search } = Input;
const NAV_SEARCH_MAX_LENGTH = 80;
const NAV_BADGE_REFRESH_DEBOUNCE_MS = 350;
const NAV_POPUP_Z_INDEX = 2400;
const ANNOUNCEMENT_PLACEHOLDER_PATTERN = /(^|\b)(test|testing|dummy|placeholder|lorem|asdf|qwer|sadsad|foobar)(\b|$)/i;
const ANNOUNCEMENT_REPEATED_CHARACTER_PATTERN = /([a-z])\1{4,}/i;
const ANNOUNCEMENT_LONG_TOKEN_PATTERN = /\b[a-z0-9]{18,}\b/gi;

const normalizeNavKeyword = (value: string) => value.trim().slice(0, NAV_SEARCH_MAX_LENGTH);
const replaceAnnouncementControlCharacters = (value: string) => {
  let normalized = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    normalized += code <= 31 || code === 127 ? ' ' : char;
  }
  return normalized;
};
const normalizeAnnouncementCopy = (value?: string | null) => replaceAnnouncementControlCharacters(String(value || ''))
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();
const looksLikeAnnouncementGibberish = (token: string) => {
  const letters = token.replace(/[^a-z]/gi, '');
  const digits = token.replace(/\D/g, '');
  if (digits.length >= 12) return true;
  if (letters.length < 8) return false;
  const vowels = letters.match(/[aeiou]/gi)?.length || 0;
  return vowels / letters.length < 0.2;
};
const isCommercialAnnouncement = (announcement: SiteAnnouncementPublic) => {
  const text = `${normalizeAnnouncementCopy(announcement.title)} ${normalizeAnnouncementCopy(announcement.content)}`.trim();
  if (!text) return false;
  if (ANNOUNCEMENT_PLACEHOLDER_PATTERN.test(text) || ANNOUNCEMENT_REPEATED_CHARACTER_PATTERN.test(text)) {
    return false;
  }
  const tokens = text.match(ANNOUNCEMENT_LONG_TOKEN_PATTERN) || [];
  return !tokens.some(looksLikeAnnouncementGibberish);
};
const normalizeBadgeCount = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
};

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPathActive = useCallback(
    (paths: string[]) => paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)),
    [location.pathname],
  );
  const isProductsActive = location.pathname === '/products' || location.pathname.startsWith('/products/');
  const isCartActive = isPathActive(['/cart']);
  const isCouponsActive = isPathActive(['/coupons']);
  const isAccountActive = isPathActive(['/profile', '/login', '/register']);
  const navSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeProductKeyword = (navSearchParams.get('keyword') || '').toLowerCase();
  const isDealsActive = isProductsActive && navSearchParams.get('discount') === 'true';
  const isSmartDevicesActive = isProductsActive && navSearchParams.get('collection') === 'smart-devices';
  const isProductKeywordActive = useCallback(
    (...terms: string[]) => isProductsActive && terms.some((term) => activeProductKeyword.includes(term)),
    [activeProductKeyword, isProductsActive],
  );
  const token = getLocalStorageItem('token');
  const username = getLocalStorageItem('username');
  const [navRole, setNavRole] = useState(getLocalStorageItem('role') || '');
  const [adminPath, setAdminPath] = useState(getLocalStorageItem('adminDefaultPath') || '/admin');
  const canAccessAdmin = isAdminRole(navRole);
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [announcements, setAnnouncements] = useState<SiteAnnouncementPublic[]>([]);
  const [mobileRelease, setMobileRelease] = useState<MobileReleaseManifest | null>(null);
  const [androidApkUrl, setAndroidApkUrl] = useState<string>('');
  const [openingAndroidApk, setOpeningAndroidApk] = useState(false);
  const [nativeBottomNav, setNativeBottomNav] = useState(() => isNativeMobileApp());
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, market, formatMoney } = useMarket();
  const navSearchActionLabel = `${t('common.search')}: ${t('nav.searchPlaceholder')}`;
  const languageOptions = [
    { value: 'es', label: 'Español' },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
  ];

  useEffect(() => {
    let disposed = false;
    announcementApi.getActive(4)
      .then((response) => {
        if (!disposed) setAnnouncements((response.data || []).filter(isCommercialAnnouncement));
      })
      .catch(() => {
        if (!disposed) setAnnouncements([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (isNativeMobileApp() && !isNativeAndroidApp()) {
      setMobileRelease(null);
      setAndroidApkUrl('');
      return undefined;
    }

    let disposed = false;
    fetchLatestMobileRelease().then((release) => {
      if (!disposed) {
        setMobileRelease(release);
        setAndroidApkUrl(release ? resolveMobileReleaseDownloadUrl(release) : '');
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const refreshNativeBottomNav = () => {
      setNativeBottomNav(isNativeMobileApp() || Boolean(document.body?.classList.contains('shop-mobile-app')));
    };
    refreshNativeBottomNav();
    const refreshTimer = window.setTimeout(refreshNativeBottomNav, 0);
    return () => window.clearTimeout(refreshTimer);
  }, []);

  const bottomBarClassName = `shop-nav__bottomBar shop-nav__bottomBar--${language}${nativeBottomNav ? ' shop-nav__bottomBar--native' : ''}`;
  const currencyOptions = Object.values(markets).map((item) => ({ value: item.currency, label: item.label }));
  const safeCartCount = normalizeBadgeCount(cartCount);
  const safeUnreadCount = normalizeBadgeCount(unreadCount);
  const safeWishlistCount = normalizeBadgeCount(wishlistCount);
  const safeCouponCount = normalizeBadgeCount(couponCount);
  const safeCompareCount = normalizeBadgeCount(compareCount);
  const safeAlertCount = normalizeBadgeCount(alertCount);
  const communitySignalCount = safeWishlistCount + safeUnreadCount + safeCouponCount + safeCompareCount + safeAlertCount;
  const utilityMenuCount = token ? communitySignalCount : safeCompareCount + safeAlertCount;
  const nativeAndroidReleaseAvailable = Boolean(
    nativeBottomNav
    && isNativeAndroidApp()
    && mobileRelease
    && androidApkUrl
    && (mobileRelease.versionCode || 0) > currentMobileVersionCode(),
  );
  const browserAndroidReleaseAvailable = !nativeBottomNav;
  const showAndroidDownloadLink = nativeAndroidReleaseAvailable || browserAndroidReleaseAvailable;
  const androidDownloadActionLabel = androidApkUrl ? t('nav.downloadAndroid') : t('nav.mobileAppUnavailable');
  const bottomAccountLabel = t('nav.accountShort', { defaultValue: t('nav.account') });
  const renderNavAmountText = (label: string, amount: string) => {
    const parts = label.split(amount);
    if (parts.length <= 1) return label;
    return (
      <span className="shop-nav__amountPhrase commerce-atomic">
        {parts.map((part, index) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amount}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  };
  const freeShippingThresholdText = renderNavAmountText(
    t('nav.freeShippingOver', { amount: formatMoney(market.freeShippingThreshold) }),
    formatMoney(market.freeShippingThreshold),
  );
  const trustFreeShippingText = renderNavAmountText(
    t('home.trust.freeShipping', { amount: formatMoney(market.freeShippingThreshold) }),
    formatMoney(market.freeShippingThreshold),
  );
  const navHighlights = [
    freeShippingThresholdText,
    t('nav.followDeals'),
    t('nav.help'),
  ];
  const renderCurrentMenuLabel = (active: boolean, label: React.ReactNode) => (
    <span className={active ? 'shop-nav__menu-current' : 'shop-nav__menu-item'}>
      {active ? <CheckOutlined /> : <span className="shop-nav__menu-check-spacer" />}
      {label}
    </span>
  );
  const setDropdownOpen = useCallback((key: string, open: boolean) => {
    setOpenDropdowns((current) => ({ ...current, [key]: open }));
  }, []);
  const isDropdownOpen = useCallback((key: string) => Boolean(openDropdowns[key]), [openDropdowns]);

  const openSupport = () => {
    if (!token) {
      const guestContext = loadGuestSupportContext();
      if (guestContext) {
        dispatchDomEvent('shop:open-support', guestContext);
        return;
      }
      dispatchDomEvent('shop:open-support');
      return;
    }
    dispatchDomEvent('shop:open-support');
  };

  const openNativeAndroidDownload = async () => {
    if (!mobileRelease || openingAndroidApk || (nativeBottomNav && !isNativeAndroidApp())) return;
    setOpeningAndroidApk(true);
    try {
      const opened = await openMobileReleaseDownload(mobileRelease);
      if (!opened) {
        message.error(t('appUpdate.downloadFailed'));
      }
    } catch {
      message.error(t('appUpdate.downloadFailed'));
    } finally {
      setOpeningAndroidApk(false);
    }
  };

  const handleAndroidDownloadUnavailable = () => {
    message.warning(t('nav.mobileAppUnavailable'));
  };

  const androidDownloadMenuItem = showAndroidDownloadLink
    ? nativeBottomNav
      ? {
        key: 'android-app',
        icon: <DownloadOutlined />,
        label: t('nav.downloadAndroid'),
        disabled: openingAndroidApk,
        onClick: () => {
          void openNativeAndroidDownload();
        },
      }
      : {
        key: 'android-app',
        icon: <DownloadOutlined />,
        label: androidApkUrl
          ? <a href={androidApkUrl} download>{t('nav.downloadAndroid')}</a>
          : t('nav.downloadAndroid'),
        onClick: androidApkUrl ? undefined : handleAndroidDownloadUnavailable,
      }
    : null;

  useEffect(() => {
    if (!token) {
      setNavRole('');
      setAdminPath('/admin');
      return;
    }
    let disposed = false;
    const refreshAdminAccess = () => {
      userApi.getProfile()
        .then((profileRes) => {
          if (disposed) return;
          const effectiveRole = getEffectiveRole(profileRes.data.role, profileRes.data.roleCode);
          setLocalStorageItem('role', effectiveRole);
          setNavRole(effectiveRole);
          if (!isAdminRole(effectiveRole)) {
            removeLocalStorageItem('adminDefaultPath');
            setAdminPath('/admin');
            return null;
          }
          return adminApi.getMyPermissions();
        })
        .then((permissionsRes) => {
          if (disposed || !permissionsRes) return;
          const permissions = permissionsRes.data.permissions || [];
          const effectiveRole = getEffectiveRole(permissionsRes.data.role, permissionsRes.data.roleCode);
          setLocalStorageItem('role', effectiveRole);
          setNavRole(effectiveRole);
          const nextDefault = permissions[0] ? `/admin/${permissions[0]}` : '/admin';
          setLocalStorageItem('adminDefaultPath', nextDefault);
          setAdminPath(nextDefault);
        })
        .catch(() => {
          if (disposed) return;
          const localRole = getLocalStorageItem('role') || '';
          setNavRole(localRole);
          setAdminPath(getLocalStorageItem('adminDefaultPath') || '/admin');
        });
    };
    refreshAdminAccess();
    window.addEventListener('shop:admin-permissions-updated', refreshAdminAccess);
    return () => {
      disposed = true;
      window.removeEventListener('shop:admin-permissions-updated', refreshAdminAccess);
    };
  }, [token]);

  useEffect(() => {
    const refreshCompareCount = () => setCompareCount(readCompareProductIds().length);
    let disposed = false;
    const idleTasks: ScheduledIdleTask[] = [];
    const refreshTimers: Record<string, number | undefined> = {};
    const queueIdleRefresh = (callback: () => void, timeout?: number) => {
      idleTasks.push(scheduleIdleTask(() => {
        if (!disposed) callback();
      }, timeout));
    };
    const queueMergedRefresh = (key: string, callback: () => void) => {
      const existingTimer = refreshTimers[key];
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      refreshTimers[key] = window.setTimeout(() => {
        delete refreshTimers[key];
        if (!disposed) callback();
      }, NAV_BADGE_REFRESH_DEBOUNCE_MS);
    };
    const refreshAlertCount = () => {
      const alerts = readStockAlerts();
      if (alerts.length === 0) {
        setAlertCount(0);
        return;
      }
      const productIds = Array.from(new Set(alerts.map((alert) => alert.productId)));
      productApi.getByIds(productIds)
        .then((response) => {
          if (disposed) return;
          const readyCount = response.data.filter((product) => {
            const stock = product.stock;
            return stock === undefined || stock > 0;
          }).length;
          setAlertCount(readyCount);
        })
        .catch(() => {
          if (!disposed) setAlertCount(0);
        });
    };
    const refreshGuestCartCount = () => {
      const count = getGuestCartItems().reduce((sum, item) => sum + normalizeBadgeCount(item.quantity), 0);
      setCartCount(count);
    };
    const refreshCartCount = () => {
      if (token) {
        cartApi.getItems(0)
          .then((res) => {
            if (disposed) return;
            const count = res.data.reduce((sum: number, item: any) => sum + normalizeBadgeCount(item.quantity), 0);
            setCartCount(count);
          })
          .catch(() => {
            if (!disposed) setCartCount(0);
          });
      } else {
        refreshGuestCartCount();
      }
    };
    const refreshUnreadCount = () => {
      if (!token) {
        setUnreadCount(0);
        return;
      }
      notificationApi.getUnreadCount()
        .then((res) => {
          if (!disposed) setUnreadCount(normalizeBadgeCount(res.data.count));
        })
        .catch(() => {
          if (!disposed) setUnreadCount(0);
        });
    };
    const refreshWishlistCount = () => {
      if (!token) {
        setWishlistCount(0);
        return;
      }
      wishlistApi.getCount(0)
        .then((res) => {
          if (!disposed) setWishlistCount(normalizeBadgeCount(res.data.count));
        })
        .catch(() => {
          if (!disposed) setWishlistCount(0);
        });
    };
    const refreshCouponCount = () => {
      if (!token) {
        setCouponCount(0);
        return;
      }
      couponApi.getAvailableByUser(0)
        .then((res) => {
          if (!disposed) setCouponCount(normalizeBadgeCount(res.data.length));
        })
        .catch(() => {
          if (!disposed) setCouponCount(0);
        });
    };
    const refreshLocalCountsFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-product-compare') refreshCompareCount();
      if (event.key === 'shop-stock-alerts') queueMergedRefresh('alerts', refreshAlertCount);
      if (event.key === 'shop-guest-cart') queueMergedRefresh('cart', refreshCartCount);
    };
    const refreshCartCountFromEvent = () => queueMergedRefresh('cart', refreshCartCount);
    const refreshAlertCountFromEvent = () => queueMergedRefresh('alerts', refreshAlertCount);
    const refreshUnreadCountFromEvent = () => queueMergedRefresh('unread', refreshUnreadCount);
    const refreshWishlistCountFromEvent = () => queueMergedRefresh('wishlist', refreshWishlistCount);
    const refreshCouponCountFromEvent = () => queueMergedRefresh('coupons', refreshCouponCount);

    refreshCompareCount();
    if (!token) {
      refreshGuestCartCount();
      setUnreadCount(0);
      setWishlistCount(0);
      setCouponCount(0);
    } else {
      queueIdleRefresh(refreshCartCount, 650);
      queueIdleRefresh(refreshUnreadCount, 1100);
      queueIdleRefresh(refreshWishlistCount, 1400);
      queueIdleRefresh(refreshCouponCount, 1700);
    }
    queueIdleRefresh(refreshAlertCount, token ? 1900 : 900);

    window.addEventListener('shop:cart-updated', refreshCartCountFromEvent);
    window.addEventListener('shop:compare-updated', refreshCompareCount);
    window.addEventListener('shop:stock-alerts-updated', refreshAlertCountFromEvent);
    window.addEventListener('shop:notifications-updated', refreshUnreadCountFromEvent);
    window.addEventListener('shop:wishlist-updated', refreshWishlistCountFromEvent);
    window.addEventListener('shop:coupons-updated', refreshCouponCountFromEvent);
    window.addEventListener('storage', refreshLocalCountsFromStorage);
    return () => {
      disposed = true;
      idleTasks.forEach(cancelIdleTask);
      Object.values(refreshTimers).forEach((timerId) => {
        if (timerId !== undefined) window.clearTimeout(timerId);
      });
      window.removeEventListener('shop:cart-updated', refreshCartCountFromEvent);
      window.removeEventListener('shop:compare-updated', refreshCompareCount);
      window.removeEventListener('shop:stock-alerts-updated', refreshAlertCountFromEvent);
      window.removeEventListener('shop:notifications-updated', refreshUnreadCountFromEvent);
      window.removeEventListener('shop:wishlist-updated', refreshWishlistCountFromEvent);
      window.removeEventListener('shop:coupons-updated', refreshCouponCountFromEvent);
      window.removeEventListener('storage', refreshLocalCountsFromStorage);
    };
  }, [token]);

  const handleLogout = () => {
    const refreshToken = getLocalStorageItem('refreshToken');
    userApi.logout(refreshToken).catch(() => undefined);
    clearStoredAuthSession();
    setCartCount(0);
    navigate('/login');
  };

  const handleSearch = (value: string) => {
    const keyword = normalizeNavKeyword(value);
    if (keyword) {
      navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  const searchBySuggestion = (key: string) => {
    const keyword = normalizeNavKeyword(t(key));
    if (keyword) navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  };

  const searchByKeyword = (keyword: string) => {
    const normalizedKeyword = normalizeNavKeyword(keyword);
    if (normalizedKeyword) navigate(`/products?keyword=${encodeURIComponent(normalizedKeyword)}`);
  };

  const guestActionItems = [
    { key: 'register', label: t('nav.register'), to: '/register', primary: true },
    { key: 'login', label: t('nav.login'), to: '/login', primary: false },
  ];
  const petNavItems = [
    {
      key: 'dog',
      label: t('nav.petNav.dog'),
      active: isProductKeywordActive('dog', 'puppy'),
      children: [
        { key: 'dog-toys', label: t('nav.petNav.dogToys'), keyword: 'dog toys' },
        { key: 'dog-walking', label: t('nav.petNav.dogWalking'), keyword: 'dog leash' },
        { key: 'dog-beds', label: t('nav.petNav.dogBeds'), keyword: 'dog bed' },
      ],
    },
    {
      key: 'cat',
      label: t('nav.petNav.cat'),
      active: isProductKeywordActive('cat', 'kitten'),
      children: [
        { key: 'cat-toys', label: t('nav.petNav.catToys'), keyword: 'cat toys' },
        { key: 'cat-sleeping', label: t('nav.petNav.catBeds'), keyword: 'cat bed' },
        { key: 'cat-smart', label: t('nav.petNav.catSmart'), to: '/products?collection=smart-devices&keyword=cat' },
      ],
    },
    { key: 'small-pets', label: t('nav.petNav.smallPets'), active: isProductKeywordActive('small pets'), keyword: 'small pets' },
    { key: 'walking', label: t('nav.petNav.walking'), active: isProductKeywordActive('walking'), keyword: 'walking' },
    { key: 'sleeping', label: t('nav.petNav.sleeping'), active: isProductKeywordActive('sleeping'), keyword: 'sleeping' },
    { key: 'smart-devices', label: t('nav.petNav.smartDevices'), active: isSmartDevicesActive, to: '/products?collection=smart-devices' },
    { key: 'pet-finder', label: t('nav.petFinder'), active: isPathActive(['/pet-finder']), to: '/pet-finder' },
    { key: 'pet-gallery', label: t('nav.petGallery'), active: isPathActive(['/pet-gallery']), to: '/pet-gallery' },
  ];

  const renderPetNavButton = (item: typeof petNavItems[number], expanded?: boolean) => {
    const hasMenu = 'children' in item && Boolean(item.children);
    return (
    <button
      key={item.key}
      type="button"
      aria-current={item.active ? 'page' : undefined}
      aria-haspopup={hasMenu ? 'menu' : undefined}
      aria-expanded={hasMenu ? expanded === true : undefined}
      className={item.active ? 'shop-nav__megaButton shop-nav__megaButton--active' : 'shop-nav__megaButton'}
      onClick={() => {
        if ('to' in item && item.to) {
          navigate(item.to);
          return;
        }
        if ('keyword' in item && item.keyword) {
          searchByKeyword(item.keyword);
        }
      }}
    >
      {item.label}
    </button>
    );
  };

  const renderAnnouncement = (announcement: SiteAnnouncementPublic) => {
    const text = announcement.content || announcement.title;
    const linkUrl = normalizeAnnouncementLink(announcement.linkUrl);
    if (!linkUrl) {
      return <span key={announcement.id || text}>{text}</span>;
    }
    if (/^https?:\/\//i.test(linkUrl)) {
      return (
        <a key={announcement.id || text} href={linkUrl} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return (
      <Link key={announcement.id || text} to={linkUrl}>
        {text}
      </Link>
    );
  };
  const tickerAnnouncements = announcements.length > 0 && announcements.length < 3
    ? Array.from({ length: Math.ceil(4 / announcements.length) }).flatMap(() => announcements)
    : announcements;

  return (
    <>
      <header className={`shop-nav shop-nav--${language}`}>
      <div className="shop-nav__announcement">
        <div className="shop-nav__ticker">
          {tickerAnnouncements.length > 0 ? tickerAnnouncements.map((announcement, index) => (
            <React.Fragment key={`${announcement.id || announcement.title}-${index}`}>
              {renderAnnouncement(announcement)}
            </React.Fragment>
          )) : (
            <>
              <span>{freeShippingThresholdText}</span>
              <span className="shop-nav__tickerAd">{t('nav.highlightDeal')}</span>
              <span>{t('nav.springSale')}</span>
              <span>{t('nav.easyReturns')}</span>
            </>
          )}
        </div>
      </div>
      <div className="shop-nav__top">
        <div className="shop-nav__inner">
          <div className="shop-nav__links">
            <Link className={!canAccessAdmin && isProductsActive ? 'shop-nav__linkActive' : undefined} to={canAccessAdmin ? adminPath : '/products'} aria-current={!canAccessAdmin && isProductsActive ? 'page' : undefined}>{t('nav.sell')}</Link>
            <Link className={isPathActive(['/pet-finder']) ? 'shop-nav__linkActive' : undefined} to="/pet-finder" aria-current={isPathActive(['/pet-finder']) ? 'page' : undefined}>{t('nav.petFinder')}</Link>
            <Link className={isPathActive(['/pet-gallery']) ? 'shop-nav__linkActive' : undefined} to="/pet-gallery" aria-current={isPathActive(['/pet-gallery']) ? 'page' : undefined}>{t('nav.petGallery')}</Link>
            <Link className={isPathActive(['/coupons']) ? 'shop-nav__linkActive' : undefined} to="/coupons" aria-current={isPathActive(['/coupons']) ? 'page' : undefined}>{t('nav.download')}</Link>
            {showAndroidDownloadLink ? (
              nativeBottomNav ? (
                <button
                  type="button"
                  className="shop-nav__downloadLink"
                  onClick={openNativeAndroidDownload}
                  disabled={openingAndroidApk}
                  aria-label={t('nav.downloadAndroid')}
                  title={t('nav.downloadAndroid')}
                >
                  <DownloadOutlined /> {t('nav.downloadAndroid')}
                </button>
              ) : (
                androidApkUrl ? (
                  <a href={androidApkUrl} download className="shop-nav__downloadLink" aria-label={t('nav.downloadAndroid')} title={t('nav.downloadAndroid')}>
                    <DownloadOutlined /> {t('nav.downloadAndroid')}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="shop-nav__downloadLink"
                    onClick={handleAndroidDownloadUnavailable}
                    aria-label={androidDownloadActionLabel}
                    title={androidDownloadActionLabel}
                  >
                    <DownloadOutlined /> {t('nav.downloadAndroid')}
                  </button>
                )
              )
            ) : null}
            <Link className={isDealsActive ? 'shop-nav__linkActive' : undefined} to="/products?discount=true" aria-current={isDealsActive ? 'page' : undefined}>{t('nav.followDeals')}</Link>
          </div>
          <div className="shop-nav__links shop-nav__links--right">
            <Link className={isPathActive(['/track-order']) ? 'shop-nav__linkActive' : undefined} to="/track-order" aria-current={isPathActive(['/track-order']) ? 'page' : undefined}>{t('nav.trackOrder')}</Link>
            <button type="button" onClick={openSupport}>{t('nav.help')}</button>
            <Select
              aria-label={t('nav.language')}
              aria-expanded={isDropdownOpen('top-language')}
              aria-haspopup="listbox"
              className="shop-nav__language"
              size="small"
              value={language}
              open={isDropdownOpen('top-language')}
              onOpenChange={(open) => setDropdownOpen('top-language', open)}
              onChange={(value) => setLanguage(value as Language)}
              classNames={{ popup: { root: 'shop-nav__select-popup' } }}
              styles={{ popup: { root: { zIndex: NAV_POPUP_Z_INDEX } } }}
              getPopupContainer={() => document.body}
              options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
            />
            <Select
              aria-label={t('nav.currency')}
              aria-expanded={isDropdownOpen('top-currency')}
              aria-haspopup="listbox"
              className="shop-nav__currency"
              size="small"
              value={currency}
              open={isDropdownOpen('top-currency')}
              onOpenChange={(open) => setDropdownOpen('top-currency', open)}
              onChange={(value) => {
                const nextCurrency = value as CurrencyCode;
                setCurrency(nextCurrency);
              }}
              classNames={{ popup: { root: 'shop-nav__select-popup' } }}
              styles={{ popup: { root: { zIndex: NAV_POPUP_Z_INDEX } } }}
              getPopupContainer={() => document.body}
              options={currencyOptions.map((item) => ({ ...item, className: currency === item.value ? 'shop-nav__select-option-current' : undefined }))}
            />
            {token ? (
              <>
                <Link to="/profile">
                  <UserOutlined /> {username || t('nav.account')}
                </Link>
                <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/register">{t('nav.register')}</Link>
                <Link to="/login">{t('nav.login')}</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shop-nav__main">
        <div className="shop-nav__inner shop-nav__inner--main">
          <Link to="/" className={location.pathname === '/' ? 'shop-nav__brand shop-nav__brand--active' : 'shop-nav__brand'} aria-label={t('nav.ariaHome')} aria-current={location.pathname === '/' ? 'page' : undefined}>
            <span className="shop-nav__brandIcon"><ShopOutlined /></span>
            <span className="shop-nav__brandCopy">
              <strong>{t('common.brand')}</strong>
              <small>{t('home.heroEyebrow')}</small>
            </span>
          </Link>

          <div className="shop-nav__search">
            <div className="shop-nav__searchShell">
              <div className="shop-nav__searchIntro">
                <strong>{t('home.heroTitle')}</strong>
                <span>
                  {navHighlights.map((highlight, index) => (
                    <React.Fragment key={index}>
                      {index > 0 ? ' / ' : ''}
                      {highlight}
                    </React.Fragment>
                  ))}
                </span>
              </div>
              <div className="shop-nav__searchBar">
                <Search
                  placeholder={t('nav.searchPlaceholder')}
                  aria-label={navSearchActionLabel}
                  title={navSearchActionLabel}
                  onSearch={handleSearch}
                  enterButton={(
                    <Button
                      type="primary"
                      aria-label={navSearchActionLabel}
                      title={navSearchActionLabel}
                      icon={<SearchOutlined />}
                    />
                  )}
                  size="large"
                  allowClear
                />
              </div>
            </div>
            <div className="shop-nav__suggestions">
              <button type="button" onClick={() => searchBySuggestion('nav.suggestions.dogToys')}>{t('nav.suggestions.dogToys')}</button>
              <button type="button" onClick={() => searchBySuggestion('nav.suggestions.catLitter')}>{t('nav.suggestions.catLitter')}</button>
              <button type="button" onClick={() => searchBySuggestion('nav.suggestions.petBeds')}>{t('nav.suggestions.petBeds')}</button>
              <button type="button" onClick={() => searchBySuggestion('nav.suggestions.leashes')}>{t('nav.suggestions.leashes')}</button>
            </div>
            <div className="shop-nav__searchSignals" aria-label={t('nav.help')}>
              <span>{trustFreeShippingText}</span>
              <span>{t('home.trust.easyReturns')}</span>
              <span>{t('home.trust.petSafe')}</span>
            </div>
            <div className="shop-nav__mobile-tools">
              <Select
                aria-label={t('nav.language')}
                aria-expanded={isDropdownOpen('mobile-language')}
                aria-haspopup="listbox"
                className="shop-nav__language"
                size="small"
                value={language}
                open={isDropdownOpen('mobile-language')}
                onOpenChange={(open) => setDropdownOpen('mobile-language', open)}
                onChange={(value) => setLanguage(value as Language)}
                classNames={{ popup: { root: 'shop-nav__select-popup' } }}
                styles={{ popup: { root: { zIndex: NAV_POPUP_Z_INDEX } } }}
                getPopupContainer={() => document.body}
                options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
              />
              <Select
                aria-label={t('nav.currency')}
                aria-expanded={isDropdownOpen('mobile-currency')}
                aria-haspopup="listbox"
                className="shop-nav__currency"
                size="small"
                value={currency}
                open={isDropdownOpen('mobile-currency')}
                onOpenChange={(open) => setDropdownOpen('mobile-currency', open)}
                onChange={(value) => setCurrency(value as CurrencyCode)}
                classNames={{ popup: { root: 'shop-nav__select-popup' } }}
                styles={{ popup: { root: { zIndex: NAV_POPUP_Z_INDEX } } }}
                getPopupContainer={() => document.body}
                options={currencyOptions.map((item) => ({ ...item, className: currency === item.value ? 'shop-nav__select-option-current' : undefined }))}
              />
              {token ? (
                <Link to="/profile" className="shop-nav__mobile-profile">
                  <UserOutlined /> {t('nav.account')}
                </Link>
              ) : null}
            </div>
          </div>

          <nav className="shop-nav__mega" aria-label={t('home.categories')}>
            {petNavItems.map((item) => {
              if ('children' in item && item.children) {
                const dropdownKey = `pet-${item.key}`;
                return (
                <Dropdown
                  key={item.key}
                  getPopupContainer={() => document.body}
                  overlayClassName="shop-nav__dropdown-popup"
                  overlayStyle={{ zIndex: NAV_POPUP_Z_INDEX }}
                  open={isDropdownOpen(dropdownKey)}
                  onOpenChange={(open) => setDropdownOpen(dropdownKey, open)}
                  menu={{
                    items: item.children.map((child) => ({
                      key: child.key,
                      label: (
                        <button
                          type="button"
                          className="shop-nav__menu-action"
                          onClick={() => {
                            if ('to' in child && child.to) {
                              navigate(child.to);
                              return;
                            }
                            if ('keyword' in child && child.keyword) {
                              searchByKeyword(child.keyword);
                            }
                          }}
                        >
                          {child.label}
                        </button>
                      ),
                    })),
                  }}
                >
                  {renderPetNavButton(item, isDropdownOpen(dropdownKey))}
                </Dropdown>
                );
              }
              return renderPetNavButton(item);
            })}
          </nav>

          <div className="shop-nav__actions">
            {token ? (
              !nativeBottomNav ? (
                <button type="button" className="shop-nav__actionSummary" onClick={() => navigate('/profile')} aria-label={t('nav.account')}>
                  <span>{username || t('nav.account')}</span>
                  <strong>{communitySignalCount}</strong>
                </button>
              ) : null
            ) : (
              !nativeBottomNav ? (
                <button type="button" className="shop-nav__actionSummary shop-nav__actionSummary--guest" onClick={() => navigate('/register')} aria-label={t('nav.register')}>
                  <span>{t('nav.register')}</span>
                  <strong>{t('home.couponsExtra')}</strong>
                </button>
              ) : null
            )}
            {!token ? (
              <div className="shop-nav__guestCtas" aria-label={t('nav.account')}>
                {guestActionItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={item.primary ? 'shop-nav__guestCta shop-nav__guestCta--primary' : 'shop-nav__guestCta'}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
            <Dropdown
              className="shop-nav__mobile-locale"
              getPopupContainer={() => document.body}
              overlayClassName="shop-nav__dropdown-popup"
              overlayStyle={{ zIndex: NAV_POPUP_Z_INDEX }}
              trigger={['click']}
              open={isDropdownOpen('mobile-locale')}
              onOpenChange={(open) => setDropdownOpen('mobile-locale', open)}
              menu={{
                items: [
                  { key: 'language-title', label: t('nav.language'), disabled: true },
                  ...languageOptions.map((item) => ({
                    key: `lang-${item.value}`,
                    label: renderCurrentMenuLabel(language === item.value, item.label),
                    onClick: () => setLanguage(item.value as Language),
                  })),
                  { key: 'locale-divider', type: 'divider' },
                  { key: 'currency-title', label: t('nav.currency'), disabled: true },
                  ...currencyOptions.map((item) => ({
                    key: `currency-${item.value}`,
                    label: renderCurrentMenuLabel(currency === item.value, item.label),
                    onClick: () => setCurrency(item.value as CurrencyCode),
                  })),
                ],
              }}
            >
              <button type="button" aria-label={`${t('nav.language')} / ${t('nav.currency')}`} aria-haspopup="menu" aria-expanded={isDropdownOpen('mobile-locale')}>
                <GlobalOutlined />
              </button>
            </Dropdown>
            {token ? (
              <>
                <button type="button" className="shop-nav__mobile-orders" onClick={() => navigate('/profile?tab=orders')} aria-label={t('pages.profile.allOrders')}>
                  <ShoppingOutlined />
                </button>
                {!nativeBottomNav ? (
                  <Link to="/profile" className="shop-nav__mobile-auth" aria-label={t('nav.account')} title={t('nav.account')}><UserOutlined /><span className="shop-nav__mobile-authText">{t('nav.account')}</span></Link>
                ) : null}
                <button type="button" className="shop-nav__secondary-action" onClick={() => navigate('/wishlist')} aria-label={t('nav.ariaFavorites')}>
                    <Badge count={safeWishlistCount} size="small">
                    <HeartOutlined />
                  </Badge>
                </button>
                <button type="button" className="shop-nav__secondary-action" onClick={() => navigate('/notifications')} aria-label={t('nav.ariaNotifications')}>
                    <Badge count={safeUnreadCount} size="small">
                    <BellOutlined />
                  </Badge>
                </button>
                <Dropdown
                  getPopupContainer={() => document.body}
                  overlayClassName="shop-nav__dropdown-popup"
                  overlayStyle={{ zIndex: NAV_POPUP_Z_INDEX }}
                  trigger={['click']}
                  open={isDropdownOpen('account-more')}
                  onOpenChange={(open) => setDropdownOpen('account-more', open)}
                  menu={{
                    items: [
                      ...(androidDownloadMenuItem ? [androidDownloadMenuItem] : []),
                      { key: 'coupons', icon: <GiftOutlined />, label: t('pages.coupons.title'), onClick: () => navigate('/coupons') },
                      { key: 'support', icon: <CustomerServiceOutlined />, label: t('nav.help'), onClick: openSupport },
                      { key: 'compare', icon: <BarChartOutlined />, label: t('nav.ariaCompare'), onClick: () => navigate('/compare') },
                      { key: 'history', icon: <HistoryOutlined />, label: t('nav.ariaHistory'), onClick: () => navigate('/history') },
                      { key: 'alerts', icon: <AlertOutlined />, label: t('nav.ariaStockAlerts'), onClick: () => navigate('/stock-alerts') },
                    ],
                  }}
                >
                  <button type="button" className="shop-nav__secondary-action shop-nav__more-trigger" aria-label={t('nav.more')} aria-haspopup="menu" aria-expanded={isDropdownOpen('account-more')}>
                    <Badge count={utilityMenuCount} size="small" overflowCount={99}>
                      <EllipsisOutlined />
                    </Badge>
                  </button>
                </Dropdown>
                <button type="button" onClick={() => dispatchDomEvent('shop:open-cart')} aria-label={t('nav.ariaCart')}>
                  <Badge count={safeCartCount} size="small">
                    <ShoppingCartOutlined />
                  </Badge>
                </button>
                <button type="button" className="shop-nav__mobile-logout" onClick={handleLogout} aria-label={t('nav.logout')}>
                  <LogoutOutlined />
                </button>
                {canAccessAdmin ? (
                  <Link to={adminPath} className="shop-nav__admin">
                    <SettingOutlined /> {t('common.admin')}
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                {!nativeBottomNav ? (
                  <>
                    <Link to="/register" className="shop-nav__mobile-auth shop-nav__mobile-auth--primary" aria-label={t('nav.register')} title={t('nav.register')}><UserAddOutlined /><span className="shop-nav__mobile-authText">{t('nav.register')}</span></Link>
                    <Link to="/login" className="shop-nav__mobile-auth" aria-label={t('nav.login')} title={t('nav.login')}><UserOutlined /><span className="shop-nav__mobile-authText">{t('nav.login')}</span></Link>
                  </>
                ) : null}
                <Dropdown
                  getPopupContainer={() => document.body}
                  overlayClassName="shop-nav__dropdown-popup"
                  overlayStyle={{ zIndex: NAV_POPUP_Z_INDEX }}
                  trigger={['click']}
                  open={isDropdownOpen('guest-more')}
                  onOpenChange={(open) => setDropdownOpen('guest-more', open)}
                  menu={{
                    items: [
                      { key: 'login', icon: <UserOutlined />, label: t('nav.login'), onClick: () => navigate('/login') },
                      { key: 'register', icon: <UserOutlined />, label: t('nav.register'), onClick: () => navigate('/register') },
                      { key: 'guest-divider', type: 'divider' },
                      ...(androidDownloadMenuItem ? [androidDownloadMenuItem] : []),
                      { key: 'support', icon: <CustomerServiceOutlined />, label: t('nav.help'), onClick: openSupport },
                      { key: 'compare', icon: <BarChartOutlined />, label: t('nav.ariaCompare'), onClick: () => navigate('/compare') },
                      { key: 'history', icon: <HistoryOutlined />, label: t('nav.ariaHistory'), onClick: () => navigate('/history') },
                      { key: 'alerts', icon: <AlertOutlined />, label: t('nav.ariaStockAlerts'), onClick: () => navigate('/stock-alerts') },
                    ],
                  }}
                >
                  <button type="button" className="shop-nav__secondary-action shop-nav__more-trigger" aria-label={t('nav.more')} aria-haspopup="menu" aria-expanded={isDropdownOpen('guest-more')}>
                    <Badge count={utilityMenuCount} size="small" overflowCount={99}>
                      <EllipsisOutlined />
                    </Badge>
                  </button>
                </Dropdown>
                <button type="button" onClick={() => dispatchDomEvent('shop:open-cart')} aria-label={t('nav.ariaCart')}>
                  <Badge count={safeCartCount} size="small">
                    <ShoppingCartOutlined />
                  </Badge>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </header>
      <nav className={bottomBarClassName} aria-label={t('home.categories')}>
        <Link to="/" className={location.pathname === '/' ? 'shop-nav__bottomItem shop-nav__bottomItem--home shop-nav__bottomItem--active' : 'shop-nav__bottomItem shop-nav__bottomItem--home'} aria-current={location.pathname === '/' ? 'page' : undefined}>
          <HomeOutlined />
          <span>{t('nav.ariaHome')}</span>
        </Link>
        <Link to="/products" className={isProductsActive ? 'shop-nav__bottomItem shop-nav__bottomItem--products shop-nav__bottomItem--active' : 'shop-nav__bottomItem shop-nav__bottomItem--products'} aria-current={isProductsActive ? 'page' : undefined}>
          <ShoppingOutlined />
          <span>{t('nav.products')}</span>
        </Link>
        <Link to="/coupons" className={isCouponsActive ? 'shop-nav__bottomItem shop-nav__bottomItem--coupons shop-nav__bottomItem--active' : 'shop-nav__bottomItem shop-nav__bottomItem--coupons'} aria-current={isCouponsActive ? 'page' : undefined}>
          <GiftOutlined />
          <span>{t('nav.coupons')}</span>
        </Link>
        <Link to="/cart" className={isCartActive ? 'shop-nav__bottomItem shop-nav__bottomItem--cart shop-nav__bottomItem--active' : 'shop-nav__bottomItem shop-nav__bottomItem--cart'} aria-label={t('nav.ariaCart')} aria-current={isCartActive ? 'page' : undefined}>
          <Badge count={safeCartCount} size="small" overflowCount={99}>
            <ShoppingCartOutlined />
          </Badge>
          <span>{t('pages.cart.title')}</span>
        </Link>
        {!nativeBottomNav && showAndroidDownloadLink ? (
          androidApkUrl ? (
            <a href={androidApkUrl} download className="shop-nav__bottomItem shop-nav__bottomItem--app" aria-label={t('nav.downloadAndroid')} title={t('nav.downloadAndroid')}>
              <DownloadOutlined />
              <span>{t('nav.mobileAppShort')}</span>
            </a>
          ) : (
            <button
              type="button"
              className="shop-nav__bottomItem shop-nav__bottomItem--app"
              onClick={handleAndroidDownloadUnavailable}
              aria-label={androidDownloadActionLabel}
              title={androidDownloadActionLabel}
            >
              <DownloadOutlined />
              <span>{t('nav.mobileAppShort')}</span>
            </button>
          )
        ) : null}
        <Link
          to={token ? '/profile' : '/login'}
          className={isAccountActive ? 'shop-nav__bottomItem shop-nav__bottomItem--account shop-nav__bottomItem--active' : 'shop-nav__bottomItem shop-nav__bottomItem--account'}
          aria-current={isAccountActive ? 'page' : undefined}
        >
          <UserOutlined />
          <span>{bottomAccountLabel}</span>
        </Link>
      </nav>
    </>
  );
};

export default Navbar;

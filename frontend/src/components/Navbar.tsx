import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Dropdown, Input, Select } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOutlined,
  BellOutlined,
  BarChartOutlined,
  CheckOutlined,
  EllipsisOutlined,
  GiftOutlined,
  GlobalOutlined,
  HeartOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { adminApi, cartApi, couponApi, notificationApi, productApi, userApi, wishlistApi } from '../api';
import { Language, useLanguage } from '../i18n';
import { CurrencyCode, markets } from '../utils/market';
import { dispatchDomEvent } from '../utils/domEvents';
import { useMarket } from '../hooks/useMarket';
import { getGuestCartItems } from '../utils/guestCart';
import { readCompareProductIds } from '../utils/productCompare';
import { getEffectiveRole, isAdminRole } from '../utils/roles';
import { readStockAlerts } from '../utils/stockAlerts';
import './Navbar.css';

const { Search } = Input;
const NAV_SEARCH_MAX_LENGTH = 80;

const normalizeNavKeyword = (value: string) => value.trim().slice(0, NAV_SEARCH_MAX_LENGTH);

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPathActive = useCallback(
    (paths: string[]) => paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)),
    [location.pathname],
  );
  const isProductsActive = location.pathname === '/products' || location.pathname.startsWith('/products/');
  const navSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeProductKeyword = (navSearchParams.get('keyword') || '').toLowerCase();
  const isDealsActive = isProductsActive && navSearchParams.get('discount') === 'true';
  const isSmartDevicesActive = isProductsActive && navSearchParams.get('collection') === 'smart-devices';
  const isProductKeywordActive = useCallback(
    (...terms: string[]) => isProductsActive && terms.some((term) => activeProductKeyword.includes(term)),
    [activeProductKeyword, isProductsActive],
  );
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const [navRole, setNavRole] = useState(localStorage.getItem('role') || '');
  const [adminPath, setAdminPath] = useState(localStorage.getItem('adminDefaultPath') || '/admin');
  const canAccessAdmin = isAdminRole(navRole);
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, market, formatMoney } = useMarket();
  const languageOptions = [
    { value: 'es', label: 'Español' },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
  ];
  const currencyOptions = Object.values(markets).map((item) => ({ value: item.currency, label: item.label }));
  const communitySignalCount = wishlistCount + unreadCount + couponCount + compareCount + alertCount;
  const utilityMenuCount = token ? couponCount + compareCount + alertCount : compareCount + alertCount;
  const navHighlights = [
    t('nav.freeShippingOver', { amount: formatMoney(market.freeShippingThreshold) }),
    t('nav.followDeals'),
    t('nav.help'),
  ];
  const renderCurrentMenuLabel = (active: boolean, label: React.ReactNode) => (
    <span className={active ? 'shop-nav__menu-current' : 'shop-nav__menu-item'}>
      {active ? <CheckOutlined /> : <span className="shop-nav__menu-check-spacer" />}
      {label}
    </span>
  );

  const openSupport = () => {
    dispatchDomEvent('shop:open-support');
  };

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
          localStorage.setItem('role', effectiveRole);
          setNavRole(effectiveRole);
          if (!isAdminRole(effectiveRole)) {
            localStorage.removeItem('adminDefaultPath');
            setAdminPath('/admin');
            return null;
          }
          return adminApi.getMyPermissions();
        })
        .then((permissionsRes) => {
          if (disposed || !permissionsRes) return;
          const permissions = permissionsRes.data.permissions || [];
          const effectiveRole = getEffectiveRole(permissionsRes.data.role, permissionsRes.data.roleCode);
          localStorage.setItem('role', effectiveRole);
          setNavRole(effectiveRole);
          const nextDefault = permissions[0] ? `/admin/${permissions[0]}` : '/admin';
          localStorage.setItem('adminDefaultPath', nextDefault);
          setAdminPath(nextDefault);
        })
        .catch(() => {
          if (disposed) return;
          const localRole = localStorage.getItem('role') || '';
          setNavRole(localRole);
          setAdminPath(localStorage.getItem('adminDefaultPath') || '/admin');
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
      const count = getGuestCartItems().reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(count);
    };
    const refreshCartCount = () => {
      if (token) {
        cartApi.getItems(0)
          .then((res) => {
            if (disposed) return;
            const count = res.data.reduce((sum: number, item: any) => sum + item.quantity, 0);
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
          if (!disposed) setUnreadCount(res.data.count);
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
          if (!disposed) setWishlistCount(res.data.count);
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
          if (!disposed) setCouponCount(res.data.length);
        })
        .catch(() => {
          if (!disposed) setCouponCount(0);
        });
    };
    const refreshLocalCountsFromStorage = (event: StorageEvent) => {
      if (event.key === 'shop-product-compare') refreshCompareCount();
      if (event.key === 'shop-stock-alerts') refreshAlertCount();
      if (event.key === 'shop-guest-cart') refreshCartCount();
    };
    refreshCompareCount();
    refreshAlertCount();
    refreshCartCount();
    refreshUnreadCount();
    refreshWishlistCount();
    refreshCouponCount();
    window.addEventListener('shop:cart-updated', refreshCartCount);
    window.addEventListener('shop:compare-updated', refreshCompareCount);
    window.addEventListener('shop:stock-alerts-updated', refreshAlertCount);
    window.addEventListener('shop:notifications-updated', refreshUnreadCount);
    window.addEventListener('shop:wishlist-updated', refreshWishlistCount);
    window.addEventListener('shop:coupons-updated', refreshCouponCount);
    window.addEventListener('storage', refreshLocalCountsFromStorage);
    return () => {
      disposed = true;
      window.removeEventListener('shop:cart-updated', refreshCartCount);
      window.removeEventListener('shop:compare-updated', refreshCompareCount);
      window.removeEventListener('shop:stock-alerts-updated', refreshAlertCount);
      window.removeEventListener('shop:notifications-updated', refreshUnreadCount);
      window.removeEventListener('shop:wishlist-updated', refreshWishlistCount);
      window.removeEventListener('shop:coupons-updated', refreshCouponCount);
      window.removeEventListener('storage', refreshLocalCountsFromStorage);
    };
  }, [token]);

  const handleLogout = () => {
    userApi.logout().catch(() => undefined);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('adminDefaultPath');
    localStorage.removeItem('userId');
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

  const renderPetNavButton = (item: typeof petNavItems[number]) => (
    <button
      type="button"
      aria-current={item.active ? 'page' : undefined}
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

  return (
    <header className={`shop-nav shop-nav--${language}`}>
      <div className="shop-nav__announcement">
        <div className="shop-nav__ticker">
          <span>{t('nav.freeShippingOver', { amount: formatMoney(market.freeShippingThreshold) })}</span>
          <span className="shop-nav__tickerAd">{t('nav.highlightDeal')}</span>
          <span>{t('nav.springSale')}</span>
          <span>{t('nav.easyReturns')}</span>
        </div>
      </div>
      <div className="shop-nav__top">
        <div className="shop-nav__inner">
          <div className="shop-nav__links">
            <Link className={!canAccessAdmin && isProductsActive ? 'shop-nav__linkActive' : undefined} to={canAccessAdmin ? adminPath : '/products'}>{t('nav.sell')}</Link>
            <Link className={isPathActive(['/pet-finder']) ? 'shop-nav__linkActive' : undefined} to="/pet-finder">{t('nav.petFinder')}</Link>
            <Link className={isPathActive(['/pet-gallery']) ? 'shop-nav__linkActive' : undefined} to="/pet-gallery">{t('nav.petGallery')}</Link>
            <Link className={isPathActive(['/coupons']) ? 'shop-nav__linkActive' : undefined} to="/coupons">{t('nav.download')}</Link>
            <Link className={isDealsActive ? 'shop-nav__linkActive' : undefined} to="/products?discount=true">{t('nav.followDeals')}</Link>
          </div>
          <div className="shop-nav__links shop-nav__links--right">
            <Link className={isPathActive(['/track-order']) ? 'shop-nav__linkActive' : undefined} to="/track-order">{t('nav.trackOrder')}</Link>
            <button type="button" onClick={openSupport}>{t('nav.help')}</button>
            <Select
              aria-label={t('nav.language')}
              className="shop-nav__language"
              size="small"
              value={language}
              onChange={(value) => setLanguage(value as Language)}
              classNames={{ popup: { root: 'shop-nav__select-popup' } }}
              options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
            />
            <Select
              aria-label={t('nav.currency')}
              className="shop-nav__currency"
              size="small"
              value={currency}
              onChange={(value) => {
                const nextCurrency = value as CurrencyCode;
                setCurrency(nextCurrency);
              }}
              classNames={{ popup: { root: 'shop-nav__select-popup' } }}
              options={currencyOptions.map((item) => ({ ...item, className: currency === item.value ? 'shop-nav__select-option-current' : undefined }))}
            />
            {token ? (
              <>
                <Link to="/profile">
                  <UserOutlined /> {username || t('nav.account')}
                </Link>
                <button onClick={handleLogout}>{t('nav.logout')}</button>
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
          <Link to="/" className={location.pathname === '/' ? 'shop-nav__brand shop-nav__brand--active' : 'shop-nav__brand'} aria-label={t('nav.ariaHome')}>
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
                <span>{navHighlights.join(' / ')}</span>
              </div>
              <div className="shop-nav__searchBar">
                <Search
                  placeholder={t('nav.searchPlaceholder')}
                  onSearch={handleSearch}
                  enterButton={<SearchOutlined />}
                  size="large"
                  allowClear
                />
              </div>
            </div>
            <div className="shop-nav__suggestions">
              <button onClick={() => searchBySuggestion('nav.suggestions.dogToys')}>{t('nav.suggestions.dogToys')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.catLitter')}>{t('nav.suggestions.catLitter')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.petBeds')}>{t('nav.suggestions.petBeds')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.leashes')}>{t('nav.suggestions.leashes')}</button>
            </div>
            <div className="shop-nav__searchSignals" aria-label={t('nav.help')}>
              <span>{t('home.trust.freeShipping', { amount: formatMoney(market.freeShippingThreshold) })}</span>
              <span>{t('home.trust.easyReturns')}</span>
              <span>{t('home.trust.petSafe')}</span>
            </div>
            <div className="shop-nav__mobile-tools">
              <Select
                aria-label={t('nav.language')}
                className="shop-nav__language"
                size="small"
                value={language}
                onChange={(value) => setLanguage(value as Language)}
                classNames={{ popup: { root: 'shop-nav__select-popup' } }}
                options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
              />
              <Select
                aria-label={t('nav.currency')}
                className="shop-nav__currency"
                size="small"
                value={currency}
                onChange={(value) => setCurrency(value as CurrencyCode)}
                classNames={{ popup: { root: 'shop-nav__select-popup' } }}
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
            {petNavItems.map((item) => (
              'children' in item && item.children ? (
                <Dropdown
                  key={item.key}
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
                  {renderPetNavButton(item)}
                </Dropdown>
              ) : renderPetNavButton(item)
            ))}
          </nav>

          <div className="shop-nav__actions">
            {token ? (
              <button type="button" className="shop-nav__actionSummary" onClick={() => navigate('/profile')} aria-label={t('nav.account')}>
                <span>{username || t('nav.account')}</span>
                <strong>{communitySignalCount}</strong>
              </button>
            ) : (
              <button type="button" className="shop-nav__actionSummary shop-nav__actionSummary--guest" onClick={() => navigate('/register')} aria-label={t('nav.register')}>
                <span>{t('nav.register')}</span>
                <strong>{t('home.couponsExtra')}</strong>
              </button>
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
              trigger={['click']}
              menu={{
                items: [
                  { key: 'language-title', label: t('nav.language'), disabled: true },
                  ...languageOptions.map((item) => ({
                    key: `lang-${item.value}`,
                    label: renderCurrentMenuLabel(language === item.value, item.label),
                    onClick: () => setLanguage(item.value as Language),
                  })),
                  { type: 'divider' },
                  { key: 'currency-title', label: t('nav.currency'), disabled: true },
                  ...currencyOptions.map((item) => ({
                    key: `currency-${item.value}`,
                    label: renderCurrentMenuLabel(currency === item.value, item.label),
                    onClick: () => setCurrency(item.value as CurrencyCode),
                  })),
                ],
              }}
            >
              <button type="button" aria-label={`${t('nav.language')} / ${t('nav.currency')}`}>
                <GlobalOutlined />
              </button>
            </Dropdown>
            {token ? (
              <>
                <button className="shop-nav__mobile-orders" onClick={() => navigate('/profile?tab=orders')} aria-label={t('pages.profile.allOrders')}>
                  <ShoppingOutlined />
                </button>
                <Link to="/profile" className="shop-nav__mobile-auth">{t('nav.account')}</Link>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/wishlist')} aria-label={t('nav.ariaFavorites')}>
                  <Badge count={wishlistCount} size="small">
                    <HeartOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/notifications')} aria-label={t('nav.ariaNotifications')}>
                  <Badge count={unreadCount} size="small">
                    <BellOutlined />
                  </Badge>
                </button>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'coupons', icon: <GiftOutlined />, label: t('pages.coupons.title'), onClick: () => navigate('/coupons') },
                      { key: 'compare', icon: <BarChartOutlined />, label: t('nav.ariaCompare'), onClick: () => navigate('/compare') },
                      { key: 'history', icon: <HistoryOutlined />, label: t('nav.ariaHistory'), onClick: () => navigate('/history') },
                      { key: 'alerts', icon: <AlertOutlined />, label: t('nav.ariaStockAlerts'), onClick: () => navigate('/stock-alerts') },
                    ],
                  }}
                >
                  <button className="shop-nav__secondary-action shop-nav__more-trigger" aria-label={t('nav.more')}>
                    <Badge count={utilityMenuCount} size="small" overflowCount={99}>
                      <EllipsisOutlined />
                    </Badge>
                  </button>
                </Dropdown>
                <button onClick={() => dispatchDomEvent('shop:open-cart')} aria-label={t('nav.ariaCart')}>
                  <Badge count={cartCount} size="small">
                    <ShoppingCartOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__mobile-logout" onClick={handleLogout} aria-label={t('nav.logout')}>
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
                <Link to="/register" className="shop-nav__mobile-auth shop-nav__mobile-auth--primary">{t('nav.register')}</Link>
                <Link to="/login" className="shop-nav__mobile-auth">{t('nav.login')}</Link>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'compare', icon: <BarChartOutlined />, label: t('nav.ariaCompare'), onClick: () => navigate('/compare') },
                      { key: 'history', icon: <HistoryOutlined />, label: t('nav.ariaHistory'), onClick: () => navigate('/history') },
                      { key: 'alerts', icon: <AlertOutlined />, label: t('nav.ariaStockAlerts'), onClick: () => navigate('/stock-alerts') },
                    ],
                  }}
                >
                  <button className="shop-nav__secondary-action shop-nav__more-trigger" aria-label={t('nav.more')}>
                    <Badge count={utilityMenuCount} size="small" overflowCount={99}>
                      <EllipsisOutlined />
                    </Badge>
                  </button>
                </Dropdown>
                <button onClick={() => dispatchDomEvent('shop:open-cart')} aria-label={t('nav.ariaCart')}>
                  <Badge count={cartCount} size="small">
                    <ShoppingCartOutlined />
                  </Badge>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

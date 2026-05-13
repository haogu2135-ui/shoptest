import React, { useEffect, useState } from 'react';
import { Badge, Dropdown, Input, Select, Tooltip } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertOutlined,
  BellOutlined,
  BarChartOutlined,
  CheckOutlined,
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
import { cartApi, couponApi, notificationApi, productApi, userApi, wishlistApi } from '../api';
import { Language, useLanguage } from '../i18n';
import { CurrencyCode, markets } from '../utils/market';
import { useMarket } from '../hooks/useMarket';
import { getGuestCartItems } from '../utils/guestCart';
import { readCompareProductIds } from '../utils/productCompare';
import { readStockAlerts } from '../utils/stockAlerts';
import './Navbar.css';

const { Search } = Input;

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [savedAlertCount, setSavedAlertCount] = useState(0);
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, market, formatMoney } = useMarket();
  const languageOptions = [
    { value: 'es', label: 'Español' },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
  ];
  const currencyOptions = Object.values(markets).map((item) => ({ value: item.currency, label: item.label }));
  const renderCurrentMenuLabel = (active: boolean, label: React.ReactNode) => (
    <span className={active ? 'shop-nav__menu-current' : 'shop-nav__menu-item'}>
      {active ? <CheckOutlined /> : <span className="shop-nav__menu-check-spacer" />}
      {label}
    </span>
  );

  const openSupport = () => {
    window.dispatchEvent(new Event('shop:open-support'));
  };

  useEffect(() => {
    const refreshCompareCount = () => setCompareCount(readCompareProductIds().length);
    let disposed = false;
    const refreshAlertCount = () => {
      const alerts = readStockAlerts();
      setSavedAlertCount(alerts.length);
      if (alerts.length === 0) {
        setAlertCount(0);
        return;
      }
      Promise.allSettled(alerts.map((alert) => productApi.getById(alert.productId)))
        .then((responses) => {
          if (disposed) return;
          const readyCount = responses.filter((result) => {
            if (result.status !== 'fulfilled') return false;
            const stock = result.value.data.stock;
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
      if (token && userId) {
        cartApi.getItems(Number(userId))
          .then((res) => {
            const count = res.data.reduce((sum: number, item: any) => sum + item.quantity, 0);
            setCartCount(count);
          })
          .catch(() => setCartCount(0));
      } else {
        refreshGuestCartCount();
      }
    };
    const refreshUnreadCount = () => {
      if (!token || !userId) {
        setUnreadCount(0);
        return;
      }
      notificationApi.getUnreadCount(Number(userId))
        .then((res) => {
          if (!disposed) setUnreadCount(res.data.count);
        })
        .catch(() => {
          if (!disposed) setUnreadCount(0);
        });
    };
    const refreshWishlistCount = () => {
      if (!token || !userId) {
        setWishlistCount(0);
        return;
      }
      wishlistApi.getCount(Number(userId))
        .then((res) => {
          if (!disposed) setWishlistCount(res.data.count);
        })
        .catch(() => {
          if (!disposed) setWishlistCount(0);
        });
    };
    const refreshCouponCount = () => {
      if (!token || !userId) {
        setCouponCount(0);
        return;
      }
      couponApi.getAvailableByUser(Number(userId))
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
  }, [token, userId, location.pathname]);

  const handleLogout = () => {
    userApi.logout().catch(() => undefined);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    setCartCount(0);
    navigate('/login');
  };

  const handleSearch = (value: string) => {
    if (value.trim()) {
      navigate(`/products?keyword=${encodeURIComponent(value.trim())}`);
    }
  };

  const searchBySuggestion = (key: string) => {
    const keyword = t(key);
    navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  };

  const searchByKeyword = (keyword: string) => {
    navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  };

  return (
    <header className="shop-nav">
      <div className="shop-nav__announcement">
        <div className="shop-nav__ticker">
          <span>{t('nav.freeShippingOver', { amount: formatMoney(market.freeShippingThreshold) })}</span>
          <span>{t('nav.springSale')}</span>
          <span>{t('nav.easyReturns')}</span>
        </div>
      </div>
      <div className="shop-nav__top">
        <div className="shop-nav__inner">
          <div className="shop-nav__links">
            <Link to={role && role.toUpperCase() === 'ADMIN' ? '/admin/dashboard' : '/products'}>{t('nav.sell')}</Link>
            <Link to="/pet-finder">{t('nav.petFinder')}</Link>
            <Link to="/pet-gallery">{t('nav.petGallery')}</Link>
            <Link to="/coupons">{t('nav.download')}</Link>
            <Link to="/products?keyword=deal">{t('nav.followDeals')}</Link>
          </div>
          <div className="shop-nav__links shop-nav__links--right">
            <Link to="/track-order">{t('nav.trackOrder')}</Link>
            <button type="button" onClick={openSupport}>{t('nav.help')}</button>
            <Select
              aria-label={t('nav.language')}
              className="shop-nav__language"
              size="small"
              value={language}
              onChange={(value) => setLanguage(value as Language)}
              popupClassName="shop-nav__select-popup"
              options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
            />
            <Select
              aria-label="Currency"
              className="shop-nav__currency"
              size="small"
              value={currency}
              onChange={(value) => {
                const nextCurrency = value as CurrencyCode;
                setCurrency(nextCurrency);
              }}
              popupClassName="shop-nav__select-popup"
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
          <Link to="/" className="shop-nav__brand" aria-label={t('nav.ariaHome')}>
            <ShopOutlined />
            <span>{t('common.brand')}</span>
          </Link>

          <div className="shop-nav__search">
            <Search
              placeholder={t('nav.searchPlaceholder')}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
              size="large"
              allowClear
            />
            <div className="shop-nav__suggestions">
              <button onClick={() => searchBySuggestion('nav.suggestions.dogToys')}>{t('nav.suggestions.dogToys')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.catLitter')}>{t('nav.suggestions.catLitter')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.petBeds')}>{t('nav.suggestions.petBeds')}</button>
              <button onClick={() => searchBySuggestion('nav.suggestions.leashes')}>{t('nav.suggestions.leashes')}</button>
            </div>
            <div className="shop-nav__mobile-tools">
              <Select
                aria-label={t('nav.language')}
                className="shop-nav__language"
                size="small"
                value={language}
                onChange={(value) => setLanguage(value as Language)}
                popupClassName="shop-nav__select-popup"
                options={languageOptions.map((item) => ({ ...item, className: language === item.value ? 'shop-nav__select-option-current' : undefined }))}
              />
              <Select
                aria-label="Currency"
                className="shop-nav__currency"
                size="small"
                value={currency}
                onChange={(value) => setCurrency(value as CurrencyCode)}
                popupClassName="shop-nav__select-popup"
                options={currencyOptions.map((item) => ({ ...item, className: currency === item.value ? 'shop-nav__select-option-current' : undefined }))}
              />
              {token ? (
                <Link to="/profile" className="shop-nav__mobile-profile">
                  <UserOutlined /> {t('nav.account')}
                </Link>
              ) : null}
            </div>
          </div>

          <nav className="shop-nav__mega" aria-label="Pet shopping navigation">
            <Dropdown
              menu={{
                items: [
                  { key: 'dog-toys', label: <button type="button" onClick={() => searchByKeyword('dog toys')}>{t('nav.petNav.dogToys')}</button> },
                  { key: 'dog-walking', label: <button type="button" onClick={() => searchByKeyword('dog leash')}>{t('nav.petNav.dogWalking')}</button> },
                  { key: 'dog-beds', label: <button type="button" onClick={() => searchByKeyword('dog bed')}>{t('nav.petNav.dogBeds')}</button> },
                ],
              }}
            >
              <button type="button">{t('nav.petNav.dog')}</button>
            </Dropdown>
            <Dropdown
              menu={{
                items: [
                  { key: 'cat-toys', label: <button type="button" onClick={() => searchByKeyword('cat toys')}>{t('nav.petNav.catToys')}</button> },
                  { key: 'cat-sleeping', label: <button type="button" onClick={() => searchByKeyword('cat bed')}>{t('nav.petNav.catBeds')}</button> },
                  { key: 'cat-smart', label: <button type="button" onClick={() => navigate('/products?collection=smart-devices&keyword=cat')}>{t('nav.petNav.catSmart')}</button> },
                ],
              }}
            >
              <button type="button">{t('nav.petNav.cat')}</button>
            </Dropdown>
            <button type="button" onClick={() => searchByKeyword('small pets')}>{t('nav.petNav.smallPets')}</button>
            <button type="button" onClick={() => searchByKeyword('walking')}>{t('nav.petNav.walking')}</button>
            <button type="button" onClick={() => searchByKeyword('sleeping')}>{t('nav.petNav.sleeping')}</button>
            <button type="button" onClick={() => navigate('/products?collection=smart-devices')}>{t('nav.petNav.smartDevices')}</button>
            <button type="button" onClick={() => navigate('/pet-finder')}>{t('nav.petFinder')}</button>
            <button type="button" onClick={() => navigate('/pet-gallery')}>{t('nav.petGallery')}</button>
          </nav>

          <div className="shop-nav__actions">
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
                  { key: 'currency-title', label: 'Currency', disabled: true },
                  ...currencyOptions.map((item) => ({
                    key: `currency-${item.value}`,
                    label: renderCurrentMenuLabel(currency === item.value, item.label),
                    onClick: () => setCurrency(item.value as CurrencyCode),
                  })),
                ],
              }}
            >
              <button type="button" aria-label={`${t('nav.language')} / Currency`}>
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
                <button className="shop-nav__secondary-action" onClick={() => navigate('/coupons')} aria-label={t('pages.coupons.title')}>
                  <Badge count={couponCount} size="small">
                    <GiftOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/compare')} aria-label={t('nav.ariaCompare')}>
                  <Badge count={compareCount} size="small">
                    <BarChartOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/history')} aria-label={t('nav.ariaHistory')}>
                  <HistoryOutlined />
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/stock-alerts')} aria-label={t('nav.ariaStockAlerts')}>
                  <Tooltip title={t('nav.ariaStockAlerts')}>
                    <Badge count={alertCount} size="small" showZero={savedAlertCount > 0}>
                      <AlertOutlined />
                    </Badge>
                  </Tooltip>
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/notifications')} aria-label={t('nav.ariaNotifications')}>
                  <Tooltip title={t('nav.ariaNotifications')}>
                    <Badge count={unreadCount} size="small">
                      <BellOutlined />
                    </Badge>
                  </Tooltip>
                </button>
                <button onClick={() => window.dispatchEvent(new Event('shop:open-cart'))} aria-label={t('nav.ariaCart')}>
                  <Badge count={cartCount} size="small">
                    <ShoppingCartOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__mobile-logout" onClick={handleLogout} aria-label={t('nav.logout')}>
                  <LogoutOutlined />
                </button>
                {role && role.toUpperCase() === 'ADMIN' ? (
                  <Link to="/admin/dashboard" className="shop-nav__admin">
                    <SettingOutlined /> {t('common.admin')}
                  </Link>
                ) : null}
              </>
            ) : (
              <>
                <Link to="/register" className="shop-nav__mobile-auth">{t('nav.register')}</Link>
                <Link to="/login" className="shop-nav__mobile-auth">{t('nav.login')}</Link>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/compare')} aria-label={t('nav.ariaCompare')}>
                  <Badge count={compareCount} size="small">
                    <BarChartOutlined />
                  </Badge>
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/history')} aria-label={t('nav.ariaHistory')}>
                  <HistoryOutlined />
                </button>
                <button className="shop-nav__secondary-action" onClick={() => navigate('/stock-alerts')} aria-label={t('nav.ariaStockAlerts')}>
                  <Tooltip title={t('nav.ariaStockAlerts')}>
                    <Badge count={alertCount} size="small" showZero={savedAlertCount > 0}>
                      <AlertOutlined />
                    </Badge>
                  </Tooltip>
                </button>
                <button onClick={() => window.dispatchEvent(new Event('shop:open-cart'))} aria-label={t('nav.ariaCart')}>
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

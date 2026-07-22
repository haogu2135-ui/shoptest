import fs from 'fs';
import path from 'path';

const readFrontend = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

describe('commercial performance contracts', () => {
  it('keeps multi-MB China town catalogs out of the client region loader', () => {
    const source = readFrontend('regionData.ts');
    expect(source).not.toContain("province-city-china/dist/town");
    expect(source).not.toContain('region-china-town');
    expect(source).not.toMatch(/webpackChunkName:\s*["']region-china-town["']/);
    expect(source).toContain('region-china-level');
    expect(source).toContain('region-mexico-municipalities');
    // Mexico-first ordering for ShopMX commercial market.
    expect(source).toContain('buildMexicoRegionData(mexicoMunicipalitiesModule.default)');
    expect(source).toContain('buildChinaRegionData(chinaLevelModule.default)');
    expect(source.indexOf('buildMexicoRegionData(mexicoMunicipalitiesModule.default)')).toBeLessThan(
      source.indexOf('buildChinaRegionData(chinaLevelModule.default)'),
    );
    // Spanish/English conversion path awaits MX only; China warms in background.
    expect(source).toContain('warmChinaRegionInBackground');
    expect(source).toContain("normalizedLanguage === 'zh'");
    expect(source).toMatch(/regions = cachedChinaRegion \? \[mexico, cachedChinaRegion\] : \[mexico\]/);
  });

  it('keeps native mobile shell CSS out of the default App import graph', () => {
    const appSource = readFrontend('App.tsx');
    expect(appSource).not.toMatch(/^import '\.\/mobile-app\.css';/m);
    expect(appSource).toContain("import(/* webpackChunkName: \"mobile-app-css\" */ './mobile-app.css')");
    expect(appSource).toContain('loadMobileAppCss()');
    expect(appSource).toContain("reportNonBlockingError('App.loadMobileAppCss'");
  });

  it('keeps Chinese and English locale packs lazy while bundling Spanish as Mexico-first home pack', () => {
    const source = readFrontend('i18n.tsx');
    const adminLayoutSource = readFrontend('components', 'AdminLayout.tsx');
    const esStorefront = readFrontend('locales', 'es.json');
    const esAdmin = readFrontend('locales', 'es-admin-pages.json');
    // ShopMX commercial home is Spanish: ship storefront es with the shell to avoid EN→ES first-paint flash.
    expect(source).toMatch(/import esLocale from '\.\/locales\/es\.json'/);
    expect(source).toContain('Spanish storefront pack ships with the shell');
    // Admin Spanish namespaces stay out of anonymous LCP and load with the admin shell.
    expect(source).toContain('webpackChunkName: "i18n-es-admin"');
    expect(source).toContain('ensureAdminSpanishPack');
    expect(adminLayoutSource).toContain('ensureAdminSpanishPack');
    expect(adminLayoutSource).toContain('await ensureAdminSpanishPack()');
    // Admin chrome copy stays out of the anonymous Spanish storefront pack.
    expect(esStorefront).not.toContain('"adminLayout"');
    expect(esAdmin).toContain('"adminLayout"');
    // English is commercial fallback but code-split so the shell stays under commercial JS budgets.
    expect(source).not.toMatch(/^import enLocale from '\.\/locales\/en\.json';/m);
    expect(source).not.toMatch(/^import en from '\.\/locales\/en\.json';/m);
    expect(source).toContain('webpackChunkName: "i18n-en"');
    expect(source).not.toMatch(/^import zhLocale from '\.\/locales\/zh\.json';/m);
    expect(source).not.toMatch(/webpackChunkName:\s*["']i18n-es["']/);
    expect(source).toContain('webpackChunkName: "i18n-zh"');
    expect(source).toContain('ensureLanguagePack');
    expect(source).toContain('idleWarmEn');
  });

  it('keeps customer support widget and admin table CSS out of the default App import graph', () => {
    const appSource = readFrontend('App.tsx');
    const adminLayoutSource = readFrontend('components', 'AdminLayout.tsx');
    const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.tsx'), 'utf8');

    expect(appSource).not.toMatch(/^import CustomerSupportWidget from '\.\/components\/CustomerSupportWidget';/m);
    expect(appSource).toContain("import(/* webpackChunkName: \"customer-support-widget\" */ './components/CustomerSupportWidget')");
    expect(appSource).toContain('loadCustomerSupportWidget()');
    expect(appSource).not.toContain("import './styles/admin-table-selection.css'");
    expect(adminLayoutSource).toContain("import '../styles/admin-table-selection.css'");

    expect(indexSource).not.toMatch(/^import esES from 'antd\/locale\/es_ES';/m);
    expect(indexSource).not.toMatch(/^import zhCN from 'antd\/locale\/zh_CN';/m);
    expect(indexSource).toContain('antd-locale-zh');
    expect(indexSource).toContain('antd-locale-es');
    // ConfigProvider is deferred out of the static main entry graph for anonymous LCP.
    expect(indexSource).not.toMatch(/^import \{[^}]*\bConfigProvider\b[^}]*\} from 'antd';/m);
    expect(indexSource).toContain('webpackChunkName: "antd-config-provider"');
    expect(indexSource).toContain('loadConfigProvider');
    // AntD commercial theme overrides ship with ConfigProvider, not the App shell CSS.
    expect(indexSource).toContain('webpackChunkName: "antd-theme-overrides"');
    expect(indexSource).toContain('loadAntdThemeOverrides');
    expect(indexSource).toContain("import(/* webpackChunkName: \"antd-theme-overrides\" */ './styles/antd-theme-overrides.css')");
  });

  it('keeps admin API surface out of the storefront Navbar static import graph', () => {
    const navbarSource = readFrontend('components', 'Navbar.tsx');
    const apiIndexSource = readFrontend('api', 'index.ts');
    expect(apiIndexSource).toContain("export * from './core'");
    expect(apiIndexSource).not.toContain("from './admin'");
    expect(apiIndexSource).not.toContain('adminApi');
    expect(navbarSource).not.toMatch(/import \{[^}]*\badminApi\b[^}]*\} from '\.\.\/api'/);
    expect(navbarSource).toContain('webpackChunkName: "api-admin"');
    expect(navbarSource).toContain("'../api/admin'");
  });


  it('keeps Navbar and storefront API modules out of the App static import graph', () => {
    const appSource = readFrontend('App.tsx');
    const authSource = readFrontend('hooks', 'useAuth.ts');
    const apiIndexSource = readFrontend('api', 'index.ts');
    expect(appSource).not.toMatch(/^import Navbar from '\.\/components\/Navbar';/m);
    expect(appSource).toContain('webpackChunkName: "navbar"');
    expect(appSource).toContain('LazyNavbar');
    // Auth shell loads api/core asynchronously so anonymous LCP does not pay for axios + API surface.
    expect(authSource).not.toMatch(/^import \{[^}]*\buserApi\b[^}]*\} from '\.\.\/api\/core';/m);
    expect(appSource).not.toMatch(/^import \{[^}]*\buserApi\b[^}]*\} from '\.\/api\/core';/m);
    expect(authSource).toContain('webpackChunkName: "api-core"');
    expect(appSource).toContain('webpackChunkName: "api-core"');
    expect(appSource).toContain('webpackChunkName: "mobile-update-gate"');
    expect(appSource).toContain('LazyNativeMobileUpdateGate');
    expect(apiIndexSource).toContain("export * from './storefront'");
    expect(apiIndexSource).toContain("export * from './core'");
  });


  it('keeps first-fold home product tiles on eager LCP-friendly loading', () => {
    const card = readFrontend('components', 'HomeProductCard.tsx');
    const home = readFrontend('pages', 'Home.tsx');
    expect(card).toContain('priority?: boolean');
    expect(card).toContain("loading={priority ? 'eager' : 'lazy'}");
    expect(card).toContain("fetchPriority={priority ? 'high' : 'auto'}");
    expect(home).toContain('priority={index < 2}');
  });


  it('keeps home LCP hero art on WebP-first image-set with JPEG fallback', () => {
    const home = readFrontend('pages', 'Home.tsx');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
    const heroVars = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'home-hero-vars.css'), 'utf8');
    // Public static CSS vars (not webpack-bundled) so hero paint does not wait on React inline styles.
    expect(indexHtml).toContain('home-hero-vars.css');
    expect(heroVars).toContain('Commercial LCP: static hero image-set vars');
    expect(heroVars).toContain('type("image/webp")');
    expect(heroVars).toContain('type("image/jpeg")');
    expect(heroVars).toContain('/assets/home/hero-mobile-pet.webp');
    expect(heroVars).toContain('/assets/home/hero-mobile-pet.jpg');
    expect(home).not.toContain('homeImageVariables');
    // Below-fold pet UGC gallery + social proof toast stay out of the initial Home JS graph.
    expect(home).toContain('webpackChunkName: "home-pet-gallery"');
    expect(home).toContain('LazyHomePetGallery');
    expect(home).toContain('webpackChunkName: "social-proof-toast"');
    expect(home).toContain('LazySocialProofToast');
    expect(home).not.toContain("import SocialProofToast from '../components/SocialProofToast'");
    // Home route keeps ant-design icons package out of the conversion path.
    expect(home).not.toContain('@ant-design/icons');
    expect(home).toContain('HomeIcon');
    expect(home).toContain('const HI');
    expect(indexHtml).toContain('hero-mobile-pet.webp');
    expect(indexHtml).toContain('type="image/webp"');
  });


  it('keeps App shell free of static antd component imports', () => {
    const appSource = readFrontend('App.tsx');
    const appCss = readFrontend('App.css');
    const errorBoundarySource = readFrontend('components', 'ErrorBoundary.tsx');
    const accessibleMessageSource = readFrontend('utils', 'accessibleMessage.ts');
    // Shell CSS stays free of AntD class overrides (those load with ConfigProvider).
    expect(appCss).not.toContain('.ant-');
    expect(appSource).toContain("import './App.css'");
    expect(appSource).not.toMatch(/^import \{[^}]*\} from 'antd';/m);
    expect(appSource).not.toContain("from 'antd'");
    expect(appSource).not.toContain('@ant-design/icons');
    expect(appSource).toContain('ShellIcon');
    expect(errorBoundarySource).not.toContain("from 'antd'");
    expect(errorBoundarySource).not.toContain('@ant-design/icons');
    expect(appSource).toContain('shop-shell-btn');
    expect(appSource).toContain('app-route-loading__spinner');
    // accessibleMessage patches antd message via dynamic import only.
    expect(accessibleMessageSource).not.toMatch(/^import \{[^}]*\bmessage\b[^}]*\} from 'antd';/m);
    expect(accessibleMessageSource).toContain('webpackChunkName: "antd-message"');
    expect(accessibleMessageSource).toContain('installAccessibleMessageAnnouncer');
  });


  it('keeps useAuth free of static antd message imports', () => {
    const authSource = readFrontend('hooks', 'useAuth.ts');
    expect(authSource).not.toMatch(/^import \{[^}]*\bmessage\b[^}]*\} from 'antd';/m);
    expect(authSource).not.toContain("from 'antd'");
    expect(authSource).not.toContain('webpackChunkName: "antd-message"');
    expect(authSource).toContain('announceAccessibleMessage');
  });



  it('keeps ProductList and Cart free of static ant-design icons', () => {
    const productList = readFrontend('pages', 'ProductList.tsx');
    const cart = readFrontend('pages', 'Cart.tsx');
    const shopIcon = readFrontend('components', 'ShopIcon.tsx');
    expect(productList).not.toContain('@ant-design/icons');
    expect(cart).not.toContain('@ant-design/icons');
    expect(productList).toContain("from '../components/ShopIcon'");
    expect(cart).toContain("from '../components/ShopIcon'");
    expect(shopIcon).toContain('export const ShopIcon');
    expect(shopIcon).toContain('export const SI');
  });

  it('keeps Navbar and Checkout free of static ant-design icons', () => {
    const navbar = readFrontend('components', 'Navbar.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const shopIcon = readFrontend('components', 'ShopIcon.tsx');
    expect(navbar).not.toContain('@ant-design/icons');
    expect(checkout).not.toContain('@ant-design/icons');
    expect(navbar).toContain("from './ShopIcon'");
    expect(checkout).toContain("from '../components/ShopIcon'");
    expect(shopIcon).toContain('export const SI');
    expect(shopIcon).toMatch(/\bhome:\s*'/);
    expect(shopIcon).toMatch(/\bdownload:\s*'/);
    expect(shopIcon).toMatch(/\btruck:\s*'/);
  });

  it('keeps conversion funnel components free of static ant-design icons', () => {
    const files: Array<[string, string]> = [
      ['components', 'SearchBar.tsx'],
      ['components', 'HomeProductCard.tsx'],
      ['components', 'CartDrawer.tsx'],
      ['components', 'SocialProofToast.tsx'],
      ['components', 'CookieConsentBanner.tsx'],
      ['components', 'PageEmpty.tsx'],
      ['components', 'PageError.tsx'],
      ['components', 'AddOnAssistant.tsx'],
      ['components', 'Payment.tsx'],
      ['pages', 'ProductDetail.tsx'],
      ['pages', 'productDetailHelpers.tsx'],
      ['pages', 'Login.tsx'],
      ['pages', 'Register.tsx'],
    ];
    for (const [dir, name] of files) {
      const source = readFrontend(dir, name);
      expect(source).not.toContain('@ant-design/icons');
      expect(source).toMatch(/from ['\"].*ShopIcon['\"]/);
    }
    const shopIcon = readFrontend('components', 'ShopIcon.tsx');
    expect(shopIcon).toMatch(/\bstar:\s*'/);
    expect(shopIcon).toMatch(/\bthunder:\s*'/);
    expect(shopIcon).toMatch(/\bwallet:\s*'/);
  });

  it('keeps storefront customer routes free of static ant-design icons', () => {
    const storefrontFiles: Array<[string, string]> = [
      ['components', 'CustomerSupportWidget.tsx'],
      ['components', 'HomePetGallery.tsx'],
      ['components', 'SeventeenTrackWidget.tsx'],
      ['components', 'ProductReview.tsx'],
      ['components', 'PetPersonalizedAssistant.tsx'],
      ['pages', 'Wishlist.tsx'],
      ['pages', 'OrderTracking.tsx'],
      ['pages', 'CouponCenter.tsx'],
      ['pages', 'Profile.tsx'],
      ['pages', 'PetFinder.tsx'],
      ['pages', 'PetGallery.tsx'],
      ['pages', 'PaymentInstructions.tsx'],
    ];
    for (const [dir, name] of storefrontFiles) {
      const source = readFrontend(dir, name);
      expect(source).not.toContain('@ant-design/icons');
      expect(source).toMatch(/from ['"].*ShopIcon['"]/);
    }
    const paymentMethods = readFrontend('utils', 'paymentMethods.tsx');
    expect(paymentMethods).not.toContain('@ant-design/icons');
    expect(paymentMethods).toContain("from '../components/ShopIcon'");
  });


  it('keeps conversion routes free of static antd message imports', () => {
    const files: Array<[string, string]> = [
      ['pages', 'Home.tsx'],
      ['pages', 'ProductList.tsx'],
      ['pages', 'ProductDetail.tsx'],
      ['pages', 'Cart.tsx'],
      ['components', 'CartDrawer.tsx'],
    ];
    for (const [dir, name] of files) {
      const source = readFrontend(dir, name);
      expect(source).not.toMatch(/^import \{[^}]*\bmessage\b[^}]*\} from 'antd';/m);
      expect(source).toContain('announceAccessibleMessage');
      expect(source).not.toMatch(/\bmessage\.(success|error|warning|info)\s*\(/);
    }
    // Checkout uses shell-safe announceAccessibleMessage (no static antd message import).
    const checkout = readFrontend('pages', 'Checkout.tsx');
    expect(checkout).toContain('announceAccessibleMessage');
    expect(checkout).toContain('showCheckoutMessage');
    expect(checkout).not.toMatch(/import \{[^}]*\bmessage\b[^}]*\} from 'antd'/);
    expect(checkout).not.toMatch(/\bmessage\.(success|error|warning|info)\s*\(/);
    expect(checkout).not.toMatch(/message\[type\]/);
  });


  it('keeps storefront auth and secondary routes free of static antd message imports', () => {
    const files: Array<[string, string]> = [
      ['pages', 'Login.tsx'],
      ['pages', 'Register.tsx'],
      ['pages', 'ForgotPassword.tsx'],
      ['pages', 'Wishlist.tsx'],
      ['pages', 'Profile.tsx'],
      ['pages', 'CouponCenter.tsx'],
      ['pages', 'OrderTracking.tsx'],
      ['components', 'Navbar.tsx'],
      ['components', 'CustomerSupportWidget.tsx'],
      ['components', 'Payment.tsx'],
    ];
    for (const [dir, name] of files) {
      const source = readFrontend(dir, name);
      expect(source).not.toMatch(/^import \{[^}]*\bmessage\b[^}]*\} from 'antd';/m);
      expect(source).toContain('announceAccessibleMessage');
      expect(source).not.toMatch(/\bmessage\.(success|error|warning|info)\s*\(/);
    }
  });


  it('keeps Home free of static antd imports', () => {
    const home = readFrontend('pages', 'Home.tsx');
    expect(home).not.toMatch(/^import \{[^}]*\} from 'antd';/m);
    expect(home).not.toContain("@ant-design/icons");
    expect(home).toContain('home-btn');
    expect(home).toContain('home-product-grid');
    expect(home).toContain('announceAccessibleMessage');
  });


  it('keeps ProductList result grid free of ant Row/Col tiles', () => {
    const productList = readFrontend('pages', 'ProductList.tsx');
    expect(productList).toContain('product-list__grid');
    expect(productList).toContain('product-list__gridItem');
    expect(productList).toContain('product-list__layout');
    expect(productList).toContain('product-list__sidebar');
    expect(productList).toContain('product-list__main');
    expect(productList).toContain('product-list__toolbarRow');
    expect(productList).not.toMatch(/gutter=\{\[16, 16\]\} className="product-list__grid"/);
    expect(productList).not.toMatch(/<Col xs=\{12\} sm=\{12\} md=\{8\} lg=\{6\}>/);
    expect(productList).not.toMatch(/\b(Row|Col)\b/);
    expect(productList).not.toMatch(/import \{[^}]*\b(Row|Col)\b[^}]*\} from 'antd'/);
  });

  it('keeps ProductDetail purchase shell free of ant Row/Col', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('product-detail__layout');
    expect(productDetail).toContain('product-detail__gallery');
    expect(productDetail).toContain('product-detail__summary');
    expect(productDetail).not.toMatch(/\b(Row|Col)\b/);
    expect(productDetail).not.toMatch(/import \{[^}]*\b(Row|Col)\b[^}]*\} from 'antd'/);
  });

  it('keeps Wishlist and CouponCenter free of ant Row/Col grids', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    expect(wishlist).toContain('wishlist-page__grid');
    expect(wishlist).toContain('wishlist-page__gridItem');
    expect(wishlist).not.toMatch(/\b(Row|Col)\b/);
    expect(coupons).toContain('coupon-center-page__claimGrid');
    expect(coupons).toContain('coupon-center-page__claimItem');
    expect(coupons).not.toMatch(/\b(Row|Col)\b/);
  });

  it('keeps PetFinder free of ant Row/Col layout', () => {
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    expect(petFinder).toContain('pet-finder-page__finderShell');
    expect(petFinder).toContain('pet-finder-page__finderControls');
    expect(petFinder).toContain('pet-finder-page__recommendationGrid');
    expect(petFinder).toContain('pet-finder-page__recommendationItem');
    expect(petFinder).not.toMatch(/\b(Row|Col)\b/);
    expect(petFinder).not.toMatch(/import \{[^}]*\b(Row|Col)\b[^}]*\} from 'antd'/);
    expect(petFinder).not.toMatch(/import \{[^}]*\bImage\b[^}]*\} from 'antd'/);
    expect(petFinder).toContain('loading="lazy"');
  });

  it('keeps storefront customer pages free of ant Row/Col imports', () => {
    const customerPages = [
      'Home.tsx',
      'ProductList.tsx',
      'ProductDetail.tsx',
      'Cart.tsx',
      'Checkout.tsx',
      'Login.tsx',
      'Register.tsx',
      'Wishlist.tsx',
      'CouponCenter.tsx',
      'PetFinder.tsx',
      'ProductCompare.tsx',
      'BrowsingHistory.tsx',
      'OrderTracking.tsx',
      'Profile.tsx',
      'Notifications.tsx',
      'StockAlerts.tsx',
      'PetGallery.tsx',
      'ForgotPassword.tsx',
      'LegalPage.tsx',
      'NotFound.tsx',
      'PaymentInstructions.tsx',
    ];
    customerPages.forEach((page) => {
      const source = readFrontend('pages', page);
      expect(source).not.toMatch(/import \{[^}]*\b(Row|Col)\b[^}]*\} from 'antd'/);
      expect(source).not.toMatch(/<\s*Row\b|<\s*Col\b/);
    });
  });

  it('keeps secondary storefront media free of ant Image', () => {
    for (const page of ['PetFinder.tsx', 'ProductCompare.tsx', 'StockAlerts.tsx']) {
      const source = readFrontend('pages', page);
      expect(source).not.toMatch(/import \{[^}]*\bImage\b[^}]*\} from 'antd'/);
      expect(source).toContain('loading="lazy"');
    }
  });

  it('keeps Cart free of ant Space layout wrappers', () => {
    const cart = readFrontend('pages', 'Cart.tsx');
    expect(cart).toContain('cart-page__productCell');
    expect(cart).toContain('cart-page__tableActions');
    expect(cart).toContain('cart-page__bulkActionsRow');
    expect(cart).toContain('cart-page__savedActions');
    expect(cart).not.toMatch(/\bSpace\b/);
    expect(cart).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
  });

  it('keeps Checkout free of ant Space layout wrappers', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    expect(checkout).toContain('checkout-page__paymentUnavailableActions');
    expect(checkout).toContain('checkout-page__paymentRecoveryActions');
    expect(checkout).toContain('checkout-page__stack');
    expect(checkout).toContain('checkout-page__giftModal');
    expect(checkout).toContain('checkout-page__addressHeader');
    expect(checkout).not.toMatch(/\bSpace\b/);
    expect(checkout).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
  });

  it('keeps ProductList and Wishlist free of ant Space layout wrappers', () => {
    const productList = readFrontend('pages', 'ProductList.tsx');
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    expect(productList).toContain('product-list__filterStack');
    expect(productList).toContain('product-list__smartActions');
    expect(productList).not.toMatch(/\bSpace\b/);
    expect(wishlist).toContain('wishlist-page__metaTags');
    expect(wishlist).not.toMatch(/\bSpace\b/);
  });

  it('keeps ProductDetail and CouponCenter free of ant Space layout wrappers', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    expect(productDetail).not.toMatch(/\bSpace\b/);
    expect(productDetail).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(coupons).not.toMatch(/\bSpace\b/);
    expect(coupons).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
  });

  it('keeps secondary storefront pages free of ant Space layout wrappers', () => {
    const pages = [
      'Register.tsx',
      'Notifications.tsx',
      'PetFinder.tsx',
      'StockAlerts.tsx',
      'ProductCompare.tsx',
      'PaymentInstructions.tsx',
      'OrderTracking.tsx',
      'Profile.tsx',
    ];
    pages.forEach((page) => {
      const source = readFrontend('pages', page);
      expect(source).not.toMatch(/\bSpace\b/);
      expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    });
  });

  it('keeps auth pages free of static Typography imports', () => {
    const login = readFrontend('pages', 'Login.tsx');
    const register = readFrontend('pages', 'Register.tsx');
    const forgot = readFrontend('pages', 'ForgotPassword.tsx');
    expect(login).not.toMatch(/\bTypography\b/);
    expect(login).toContain('shopee-login-panel__title');
    expect(login).toContain('shopee-login-panel__subtitle');
    expect(register).not.toMatch(/\bTypography\b/);
    expect(register).toContain('register-page__heroTitle');
    expect(forgot).not.toMatch(/\bTypography\b/);
    expect(forgot).toContain('shopee-login-subtitle--h1');
  });

  it('keeps Checkout free of ant Spin and PetGallery free of ant Space', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    const gallery = readFrontend('pages', 'PetGallery.tsx');
    expect(checkout).not.toMatch(/\bSpin\b/);
    expect(checkout).toContain('checkout-page__spinner');
    expect(gallery).not.toMatch(/\bSpace\b/);
  });

  it('keeps Cart free of static Typography imports', () => {
    const cart = readFrontend('pages', 'Cart.tsx');
    expect(cart).not.toMatch(/\bTypography\b/);
    expect(cart).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(cart).toContain('cart-page__title');
    expect(cart).toContain('cart-page__text');
    expect(cart).not.toMatch(/<Title\b/);
    expect(cart).not.toMatch(/<Text\b/);
  });

  it('keeps ProductList free of static Typography imports', () => {
    const productList = readFrontend('pages', 'ProductList.tsx');
    expect(productList).not.toMatch(/\bTypography\b/);
    expect(productList).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(productList).toContain('product-list__text');
    expect(productList).not.toMatch(/<Text\b/);
    expect(productList).not.toMatch(/<Title\b/);
  });

  it('keeps Checkout free of static Typography imports', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    expect(checkout).not.toMatch(/\bTypography\b/);
    expect(checkout).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(checkout).toContain('checkout-page__title');
    expect(checkout).toContain('checkout-page__text');
    expect(checkout).not.toMatch(/<Text\b/);
    expect(checkout).not.toMatch(/<Title\b/);
  });

  it('keeps Wishlist free of ant Spin', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    expect(wishlist).not.toMatch(/\bSpin\b/);
    expect(wishlist).not.toMatch(/import \{[^}]*\bSpin\b[^}]*\} from 'antd'/);
    expect(wishlist).toContain('wishlist-page__spinner');
  });

  it('keeps Wishlist free of static Typography imports', () => {
    const wishlist = readFrontend('pages', 'Wishlist.tsx');
    expect(wishlist).not.toMatch(/\bTypography\b/);
    expect(wishlist).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(wishlist).toContain('wishlist-page__title');
    expect(wishlist).toContain('wishlist-page__text');
    expect(wishlist).not.toMatch(/<Text\b/);
    expect(wishlist).not.toMatch(/<Title\b/);
  });

  it('keeps CouponCenter free of static Typography imports', () => {
    const coupons = readFrontend('pages', 'CouponCenter.tsx');
    expect(coupons).not.toMatch(/\bTypography\b/);
    expect(coupons).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(coupons).toContain('coupon-center-page__title');
    expect(coupons).toContain('coupon-center-page__text');
    expect(coupons).not.toMatch(/<Text\b/);
    expect(coupons).not.toMatch(/<Title\b/);
  });

  it('keeps ProductDetail free of static Typography imports', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).not.toMatch(/\bTypography\b/);
    expect(productDetail).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(productDetail).toContain('product-detail-page__title');
    expect(productDetail).toContain('product-detail-page__text');
    expect(productDetail).not.toMatch(/<Text\b/);
    expect(productDetail).not.toMatch(/<Title\b/);
  });

  it('keeps OrderTracking free of static Typography imports', () => {
    const orderTracking = readFrontend('pages', 'OrderTracking.tsx');
    expect(orderTracking).not.toMatch(/\bTypography\b/);
    expect(orderTracking).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(orderTracking).toContain('order-tracking-page__title');
    expect(orderTracking).toContain('order-tracking-page__text');
    expect(orderTracking).not.toMatch(/<Text\b/);
    expect(orderTracking).not.toMatch(/<Title\b/);
  });

  it('keeps Notifications free of static Typography imports', () => {
    const notifications = readFrontend('pages', 'Notifications.tsx');
    expect(notifications).not.toMatch(/\bTypography\b/);
    expect(notifications).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(notifications).toContain('notifications-page__title');
    expect(notifications).toContain('notifications-page__text');
    expect(notifications).not.toMatch(/<Text\b/);
    expect(notifications).not.toMatch(/<Title\b/);
  });

  it('keeps PetFinder free of static Typography imports', () => {
    const petFinder = readFrontend('pages', 'PetFinder.tsx');
    expect(petFinder).not.toMatch(/\bTypography\b/);
    expect(petFinder).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(petFinder).toContain('pet-finder-page__title');
    expect(petFinder).toContain('pet-finder-page__text');
    expect(petFinder).not.toMatch(/<Text\b/);
    expect(petFinder).not.toMatch(/<Title\b/);
    expect(petFinder).not.toMatch(/<Paragraph\b/);
  });

  it('keeps Profile free of static Typography imports', () => {
    const profile = readFrontend('pages', 'Profile.tsx');
    expect(profile).not.toMatch(/\bTypography\b/);
    expect(profile).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(profile).toContain('profile-page__title');
    expect(profile).toContain('profile-page__text');
    expect(profile).not.toMatch(/<Text\b/);
    expect(profile).not.toMatch(/<Title\b/);
  });

  it('keeps BrowsingHistory free of static Typography imports', () => {
    const page = readFrontend('pages', 'BrowsingHistory.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('browsing-history__title');
    expect(page).toContain('browsing-history__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps LegalPage free of static Typography imports', () => {
    const page = readFrontend('pages', 'LegalPage.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('legal-page__title');
    expect(page).toContain('legal-page__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps StockAlerts free of static Typography imports', () => {
    const page = readFrontend('pages', 'StockAlerts.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('stock-alerts-page__title');
    expect(page).toContain('stock-alerts-page__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps PaymentInstructions free of static Typography imports', () => {
    const page = readFrontend('pages', 'PaymentInstructions.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('payment-instructions-page__title');
    expect(page).toContain('payment-instructions-page__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps ProductCompare free of static Typography imports', () => {
    const page = readFrontend('pages', 'ProductCompare.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('product-compare-page__title');
    expect(page).toContain('product-compare-page__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps PetGallery free of static Typography imports', () => {
    const page = readFrontend('pages', 'PetGallery.tsx');
    expect(page).not.toMatch(/\bTypography\b/);
    expect(page).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(page).toContain('pet-gallery-page__title');
    expect(page).toContain('pet-gallery-page__text');
    expect(page).not.toMatch(/<Text\b/);
    expect(page).not.toMatch(/<Title\b/);
    expect(page).not.toMatch(/Typography\.(Text|Title|Paragraph)/);
  });

  it('keeps Checkout free of ant Result/List/Divider', () => {
    const checkout = readFrontend('pages', 'Checkout.tsx');
    expect(checkout).not.toMatch(/import \{[^}]*\bResult\b[^}]*\} from 'antd'/);
    expect(checkout).not.toMatch(/import \{[^}]*\bList\b[^}]*\} from 'antd'/);
    expect(checkout).not.toMatch(/import \{[^}]*\bDivider\b[^}]*\} from 'antd'/);
    expect(checkout).not.toMatch(/<Result\b/);
    expect(checkout).not.toMatch(/<List\b/);
    expect(checkout).not.toMatch(/List\.Item/);
    expect(checkout).not.toMatch(/<Divider\b/);
    expect(checkout).toContain('checkout-page__result');
    expect(checkout).toContain('checkout-page__resultTitle');
    expect(checkout).toContain('checkout-page__itemList');
    expect(checkout).toContain('checkout-page__divider');
  });

  it('keeps secondary storefront recovery pages free of ant Spin', () => {
    for (const [file, spinner] of [
      ['Notifications.tsx', 'notifications-page__spinner'],
      ['PetFinder.tsx', 'pet-finder-page__spinner'],
      ['PaymentInstructions.tsx', 'payment-instructions-page__spinner'],
      ['BrowsingHistory.tsx', 'browsing-history__spinner'],
      ['Profile.tsx', 'profile-page__spinner'],
    ] as const) {
      const source = readFrontend('pages', file);
      expect(source).not.toMatch(/\bSpin\b/);
      expect(source).not.toMatch(/import \{[^}]*\bSpin\b[^}]*\} from 'antd'/);
      expect(source).toContain(spinner);
    }
  });

  it('keeps customer conversion lists free of ant List', () => {
    for (const [file, marker] of [
      ['ProductDetail.tsx', 'product-detail-page__itemList'],
      ['CouponCenter.tsx', 'coupon-wallet__itemList'],
      ['OrderTracking.tsx', 'order-tracking-page__itemList'],
      ['Profile.tsx', 'profile-page__itemList'],
      ['Notifications.tsx', 'notifications-page__itemList'],
      ['StockAlerts.tsx', 'stock-alerts__itemList'],
    ] as const) {
      const source = readFrontend('pages', file);
      expect(source).not.toMatch(/import \{[^}]*\bList\b[^}]*\} from 'antd'/);
      expect(source).not.toMatch(/<List\b/);
      expect(source).not.toMatch(/List\.Item/);
      expect(source).toContain(marker);
    }
  });

  it('keeps NotFound free of ant Result', () => {
    const notFound = readFrontend('pages', 'NotFound.tsx');
    expect(notFound).not.toMatch(/\bResult\b/);
    expect(notFound).not.toMatch(/import \{[^}]*\bResult\b[^}]*\} from 'antd'/);
    expect(notFound).toContain('not-found-page__result');
    expect(notFound).toContain('not-found-page__resultExtra');
  });

  it('keeps conversion assistants free of ant Skeleton/Typography', () => {
    for (const [file, marker] of [
      ['AddOnAssistant.tsx', 'add-on-assistant__skeleton'],
      ['PetPersonalizedAssistant.tsx', 'pet-personalized-assistant__skeleton'],
    ] as const) {
      const source = readFrontend('components', file);
      expect(source).not.toMatch(/\bSkeleton\b/);
      expect(source).not.toMatch(/\bTypography\b/);
      expect(source).toContain(marker);
    }
  });

  it('keeps ProductReview free of ant List/Empty/Space/Typography', () => {
    const source = readFrontend('components', 'ProductReview.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bList\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<List\b/);
    expect(source).not.toMatch(/List\.Item/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/\bSpace\b/);
    expect(source).toContain('product-review__itemList');
  });

  it('keeps Payment, SearchBar, CookieConsent free of Space/Typography densify leftovers', () => {
    const payment = readFrontend('components', 'Payment.tsx');
    const search = readFrontend('components', 'SearchBar.tsx');
    const cookie = readFrontend('components', 'CookieConsentBanner.tsx');
    expect(payment).not.toMatch(/\bSpace\b/);
    expect(payment).not.toMatch(/\bTypography\b/);
    expect(payment).toContain('payment-modal__stack');
    expect(search).not.toMatch(/\bSpace\b/);
    expect(search).toContain('shop-search-bar');
    expect(cookie).not.toMatch(/\bTypography\b/);
    expect(cookie).toContain('cookie-consent-banner__text');
  });


  it('keeps PageEmpty and PageError free of ant Empty/Result', () => {
    const pageEmpty = readFrontend('components', 'PageEmpty.tsx');
    const pageError = readFrontend('components', 'PageError.tsx');
    expect(pageEmpty).not.toMatch(/\bEmpty\b/);
    expect(pageEmpty).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(pageEmpty).toContain('page-feedback__empty');
    expect(pageError).not.toMatch(/\bResult\b/);
    expect(pageError).not.toMatch(/import \{[^}]*\bResult\b[^}]*\} from 'antd'/);
    expect(pageError).toContain('page-feedback__result');
  });

  it('keeps CartDrawer free of ant List/Empty/Space/Typography', () => {
    const source = readFrontend('components', 'CartDrawer.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bList\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<List\b/);
    expect(source).not.toMatch(/List\.Item/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/\bSpace\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('cart-drawer__itemList');
    expect(source).toContain('cart-drawer__emptyPanel');
  });

  it('keeps Cart free of ant Table/Empty', () => {
    const source = readFrontend('pages', 'Cart.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bTable\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Table\b/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/Empty\.PRESENTED/);
    expect(source).toContain('cart-page__tableHead');
    expect(source).toContain('cart-page__tableRow');
    expect(source).toContain('cart-page__productCell');
    expect(source).toContain('cart-page__tableActions');
    expect(source).toContain('cart-page__emptyPanelInner');
    expect(source).toContain('cart-page__savedEmptyInner');
  });


  it('keeps CustomerSupportWidget free of ant List/Empty/Space/Spin/Typography', () => {
    const source = readFrontend('components', 'CustomerSupportWidget.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bList\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpin\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<List\b/);
    expect(source).not.toMatch(/List\.Item/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/<Space\b/);
    expect(source).not.toMatch(/<Spin\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('customer-support-widget__messageList');
    expect(source).toContain('customer-support-widget__emptyDescription');
    expect(source).toContain('customer-support-widget__spinner');
    expect(source).toContain('customer-support-widget__stack');
    expect(source).toContain('customer-support-widget__text');
  });


  it('keeps OrderTracking free of ant Descriptions/Empty', () => {
    const source = readFrontend('pages', 'OrderTracking.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDescriptions\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Descriptions\b/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).toContain('order-tracking-page__descList');
    expect(source).toContain('order-tracking-page__emptyPanel');
  });

  it('keeps PaymentInstructions free of ant Descriptions', () => {
    const source = readFrontend('pages', 'PaymentInstructions.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDescriptions\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Descriptions\b/);
    expect(source).toContain('payment-instructions-page__descList');
  });

  it('keeps Profile free of ant Descriptions', () => {
    const source = readFrontend('pages', 'Profile.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDescriptions\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Descriptions\b/);
    expect(source).toContain('profile-page__descList');
    expect(source).toContain('profile-order-detail__descriptions');
    expect(source).toContain('profile-payment-detail__descriptions');
  });


  it('keeps PetGallery free of ant Statistic', () => {
    const source = readFrontend('pages', 'PetGallery.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bStatistic\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Statistic\b/);
    expect(source).toContain('pet-gallery-hero__stat');
    expect(source).toContain('pet-gallery-hero__statValue');
  });

  it('keeps BrowsingHistory free of ant Empty', () => {
    const source = readFrontend('pages', 'BrowsingHistory.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).toContain('browsing-history__emptyPanel');
    expect(source).toContain('browsing-history__emptyDescription');
  });

  it('keeps ProductRichDetail free of ant Empty/Typography', () => {
    const source = readFrontend('components', 'ProductRichDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('product-rich-detail__empty');
    expect(source).toContain('product-rich-detail__text');
  });

  it('keeps NativeMobileUpdateGate free of ant Space/Typography', () => {
    const source = readFrontend('components', 'NativeMobileUpdateGate.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Space\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('shop-mobile-update-modal__stack');
    expect(source).toContain('shop-mobile-update-modal__actions');
  });



  it('keeps SeventeenTrackWidget free of ant Empty/Space/Typography', () => {
    const source = readFrontend('components', 'SeventeenTrackWidget.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/<Space\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('seventeen-track-widget__emptyPanel');
    expect(source).toContain('seventeen-track-widget__recoveryActions');
    expect(source).toContain('seventeen-track-widget__muted');
  });

  it('keeps ProductRichDetailEditor free of ant Empty/Space/Typography', () => {
    const source = readFrontend('components', 'ProductRichDetailEditor.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bEmpty\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bSpace\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/import \{[^}]*\bTypography\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Empty\b/);
    expect(source).not.toMatch(/<Space\b/);
    expect(source).not.toMatch(/\bTypography\b/);
    expect(source).toContain('product-rich-detail-editor__emptyPanel');
    expect(source).toContain('product-rich-detail-editor__toolbar');
    expect(source).toContain('product-rich-detail-editor__mediaFields');
  });

  it('keeps ProductList product cards free of ant Card shell', () => {
    const source = readFrontend('pages', 'ProductList.tsx');
    expect(source).not.toContain('Card.Meta');
    expect(source).not.toMatch(/className="product-list__card"[\s\S]*?cover=/);
    expect(source).toContain('className="product-list__card"');
    expect(source).toContain('product-list__cover');
    expect(source).toContain('product-list__body');
    expect(source).toContain('product-list__actions');
    expect(source).toContain('product-list__metaTitle');
    expect(source).toContain('product-list__actionItem--primary');
    expect(source).toContain('<article');
  });

  it('keeps Wishlist free of ant Card shell', () => {
    const source = readFrontend('pages', 'Wishlist.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bCard\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Card\b/);
    expect(source).toContain('wishlist-page__cover');
    expect(source).toContain('wishlist-page__body');
    expect(source).toContain('<article');
  });

  it('keeps ProductList free of ant Card shell', () => {
    const source = readFrontend('pages', 'ProductList.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bCard\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Card\b/);
    expect(source).toContain('product-list__panel');
    expect(source).toContain('product-list__panelHead');
    expect(source).toContain('product-list__toolbar');
  });

  it('keeps StockAlerts free of ant Card shell', () => {
    const source = readFrontend('pages', 'StockAlerts.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bCard\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Card\b/);
    expect(source).toContain('stock-alerts__shell');
  });

  it('keeps ProductDetail free of ant Card shell', () => {
    const source = readFrontend('pages', 'ProductDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bCard\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Card\b/);
    expect(source).toContain('product-gallery-card');
    expect(source).toContain('product-summary-card');
    expect(source).toContain('product-recommendations__cover');
    expect(source).toContain('product-recommendations__body');
  });

  it('keeps conversion path pages free of ant Card shell', () => {
    for (const [dir, name, marker] of [
      ['pages', 'Cart.tsx', 'cart-page__savedCard'],
      ['pages', 'Checkout.tsx', 'checkout-page__sectionCard'],
      ['pages', 'CouponCenter.tsx', 'coupon-claim-section'],
      ['pages', 'OrderTracking.tsx', 'order-tracking-page__lookupCard'],
      ['pages', 'PaymentInstructions.tsx', 'payment-instructions-page__card'],
      ['pages', 'ProductCompare.tsx', 'product-compare-page__shell'],
      ['pages', 'PetFinder.tsx', 'pet-finder-page__finderCard'],
    ] as const) {
      const source = readFrontend(dir, name);
      expect(source).not.toMatch(/import \{[^}]*\bCard\b[^}]*\} from 'antd'/);
      expect(source).not.toMatch(/<Card\b/);
      expect(source).toContain(marker);
    }
  });

  it('keeps ShopBreadcrumb free of ant Breadcrumb', () => {
    const source = readFrontend('components', 'ShopBreadcrumb.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bBreadcrumb\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Breadcrumb\b/);
    expect(source).toContain('shop-breadcrumb__list');
    expect(source).toContain('shop-breadcrumb__item');
    expect(source).toContain('<ol');
  });

  it('keeps ProductDetail free of static ant Breadcrumb', () => {
    const source = readFrontend('pages', 'ProductDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bBreadcrumb\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Breadcrumb\b/);
    expect(source).toContain('ShopBreadcrumb');
    expect(source).toContain('product-detail-breadcrumb');
  });

  it('keeps ShopSegmented free of ant Segmented', () => {
    const source = readFrontend('components', 'ShopSegmented.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bSegmented\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Segmented\b/);
    expect(source).toContain('shop-segmented__group');
    expect(source).toContain('shop-segmented__item');
    expect(source).toContain('role="radiogroup"');
  });

  it('keeps ProductDetail free of static ant Segmented', () => {
    const source = readFrontend('pages', 'ProductDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bSegmented\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Segmented\b/);
    expect(source).toContain('ShopSegmented');
    expect(source).toContain('product-purchase-mode');
  });

  it('keeps ShopRate free of ant Rate', () => {
    const source = readFrontend('components', 'ShopRate.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bRate\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Rate\b/);
    expect(source).toContain('shop-rate');
    expect(source).toContain('shop-rate__fill');
  });

  it('keeps ProductDetail free of static ant Rate', () => {
    const source = readFrontend('pages', 'ProductDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bRate\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Rate\b/);
    expect(source).toContain('ShopRate');
    expect(source).toContain('product-rating-row');
  });

  it('keeps ProductCompare free of static ant Rate', () => {
    const source = readFrontend('pages', 'ProductCompare.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bRate\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Rate\b/);
    expect(source).toContain('ShopRate');
  });

  it('keeps ProductReview free of ant Rate', () => {
    const source = readFrontend('components', 'ProductReview.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bRate\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Rate\b/);
    expect(source).toContain('ShopRate');
  });

  it('keeps ProductList free of static ant Rate', () => {
    const source = readFrontend('pages', 'ProductList.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bRate\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Rate\b/);
    expect(source).toContain('ShopRate');
  });






  it('keeps ProductCompare free of ant Table', () => {
    const source = readFrontend('pages', 'ProductCompare.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bTable\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Table\b/);
    expect(source).toContain('product-compare__tableMatrix');
    expect(source).toContain('product-compare__tableCell');
    expect(source).toContain('product-compare__tableSticky');
    expect(source).toContain('data-label={compareAttributeHeader}');
  });




  it('keeps ProductCompare free of ant Spin', () => {
    const source = readFrontend('pages', 'ProductCompare.tsx');
    expect(source).not.toMatch(/\bSpin\b/);
    expect(source).not.toMatch(/import \{[^}]*\bSpin\b[^}]*\} from 'antd'/);
    expect(source).toContain('product-compare__spinner');
  });

  it('keeps Checkout free of static antd message import', () => {
    const source = readFrontend('pages', 'Checkout.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bmessage\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/message\[type\]/);
    expect(source).toContain('announceAccessibleMessage');
    expect(source).toContain('showCheckoutMessage');
  });

  it('keeps CouponCenter and PetGallery free of ant Skeleton', () => {
    for (const [file, marker] of [
      ['CouponCenter.tsx', 'coupon-center-page__skeleton'],
      ['PetGallery.tsx', 'pet-gallery-skeleton'],
    ] as const) {
      const source = readFrontend('pages', file);
      expect(source).not.toMatch(/\bSkeleton\b/);
      expect(source).not.toMatch(/import \{[^}]*\bSkeleton\b[^}]*\} from 'antd'/);
      expect(source).toContain(marker);
    }
  });


});
  it('keeps Login free of static ant Tabs', () => {
    const source = readFrontend('pages', 'Login.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bTabs\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Tabs\b/);
    expect(source).toContain('shopee-login-tabs__nav');
    expect(source).toContain('role="tablist"');
  });

  it('keeps ProductDetail free of static ant Tabs', () => {
    const source = readFrontend('pages', 'ProductDetail.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bTabs\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Tabs\b/);
    expect(source).toContain('product-detail-tabs__nav');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('product-detail-tabs__tab');
  });

  it('keeps ShopDrawer free of ant Drawer', () => {
    const source = readFrontend('components', 'ShopDrawer.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDrawer\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Drawer\b/);
    expect(source).toContain('shop-drawer__panel');
    expect(source).toContain('role="dialog"');
  });

  it('keeps ProductList free of static ant Drawer', () => {
    const source = readFrontend('pages', 'ProductList.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDrawer\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Drawer\b/);
    expect(source).toContain('ShopDrawer');
    expect(source).toContain('product-list__filterDrawerRoot');
  });

  it('keeps CartDrawer free of static ant Drawer', () => {
    const source = readFrontend('components', 'CartDrawer.tsx');
    expect(source).not.toMatch(/import \{[^}]*\bDrawer\b[^}]*\} from 'antd'/);
    expect(source).not.toMatch(/<Drawer\b/);
    expect(source).toContain('ShopDrawer');
    expect(source).toContain('cart-drawer__root');
  });





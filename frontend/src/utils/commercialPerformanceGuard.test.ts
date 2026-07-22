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

});
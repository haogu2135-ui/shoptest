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
  });

  it('keeps native mobile shell CSS out of the default App import graph', () => {
    const appSource = readFrontend('App.tsx');
    expect(appSource).not.toMatch(/^import '\.\/mobile-app\.css';/m);
    expect(appSource).toContain("import(/* webpackChunkName: \"mobile-app-css\" */ './mobile-app.css')");
    expect(appSource).toContain('loadMobileAppCss()');
    expect(appSource).toContain("reportNonBlockingError('App.loadMobileAppCss'");
  });

  it('keeps non-English locale packs out of the initial i18n import graph', () => {
    const source = readFrontend('i18n.tsx');
    expect(source).toContain("import enLocale from './locales/en.json'");
    expect(source).not.toMatch(/^import esLocale from '\.\/locales\/es\.json';/m);
    expect(source).not.toMatch(/^import zhLocale from '\.\/locales\/zh\.json';/m);
    expect(source).toContain('webpackChunkName: "i18n-es"');
    expect(source).toContain('webpackChunkName: "i18n-zh"');
    expect(source).toContain('ensureLanguagePack');
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
    expect(authSource).toContain("from '../api/core'");
    expect(appSource).toContain("from './api/core'");
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

});

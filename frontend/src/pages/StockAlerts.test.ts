import fs from 'fs';
import path from 'path';

const readStockAlertsSource = () => fs.readFileSync(path.resolve(__dirname, 'StockAlerts.tsx'), 'utf8');
const readStockAlertsCss = () => fs.readFileSync(path.resolve(__dirname, 'StockAlerts.css'), 'utf8');

describe('StockAlerts mobile action layout', () => {
  it('keeps the restock action clear of the shared bottom navigation', () => {
    const source = readStockAlertsSource();
    const css = readStockAlertsCss();
    const fixCss = css.slice(css.indexOf('F3442:'));

    expect(source).toContain('stock-alerts stock-alerts-page');
    expect(source).toContain('stock-alerts__mobileAction');
    expect(fixCss).toContain('--stock-alerts-mobile-action-bottom: calc(var(--shop-mobile-bottom-nav-height, 72px)');
    expect(fixCss).toMatch(/\.stock-alerts\.stock-alerts-page\s*\{[\s\S]*?padding-bottom:\s*calc\([\s\S]*?var\(--stock-alerts-mobile-action-bottom\)[\s\S]*?var\(--stock-alerts-mobile-action-height\)[\s\S]*?\)\s*!important;/);
    expect(fixCss).toMatch(/\.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction\s*\{[\s\S]*?bottom:\s*var\(--stock-alerts-mobile-action-bottom\)\s*!important;[\s\S]*?z-index:\s*1240\s*!important;/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction\s*\{[^}]*z-index:\s*8998\s*!important;/);
    expect(fixCss).toMatch(/@media \(max-width:\s*860px\) and \(max-height:\s*430px\)[\s\S]*?\.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction\s*\{[\s\S]*?position:\s*static\s*!important;/);
    expect(fixCss).not.toMatch(/F3442:[\s\S]*?\.stock-alerts__mobileAction\s*\{[^}]*bottom:\s*0\s*!important/);
  });

  it('keeps Android App insight labels at 12px or larger', () => {
    const css = readStockAlertsCss();
    const fixCss = css.slice(css.indexOf('F3517:'));

    expect(fixCss).toMatch(/\.stock-alerts\.stock-alerts-page \.stock-alerts__signal span/);
    expect(fixCss).toMatch(/\.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)/);
    expect(fixCss).toMatch(/font-size:\s*12px\s*!important;/);
  });

  it('keeps stale product data from masquerading as a live stock snapshot', () => {
    const source = readStockAlertsSource();

    expect(source).toContain('const hasStaleProductData = Boolean(loadError && alerts.length > 0);');
    expect(source).toContain("description={hasStaleProductData ? t('pages.stockAlerts.staleDataWarning') : t('common.loadFailedRetry')}");
    expect(source).toContain("title: t('pages.stockAlerts.nextActionStaleTitle')");
    expect(source).toContain("text: t('pages.stockAlerts.nextActionStaleText')");
    expect(source).toContain("const restockNextActionIcon = restockNextAction.tone === 'stale' ? <ReloadOutlined /> : <ShoppingCartOutlined />;");
    expect(source).toContain('disabled={hasStaleProductData || !ready}');
    expect(source).toMatch(/setLoading\(true\);[\s\S]*?const productIds = Array\.from/);
    expect(source).not.toMatch(/setLoading\(true\);\s*setLoadError\(''\);/);
  });
});

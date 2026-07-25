import fs from 'fs';
import path from 'path';

const readStockAlertsPage = () => fs.readFileSync(path.resolve(__dirname, 'StockAlerts.tsx'), 'utf8');
const readStockAlertsSource = () => [
  readStockAlertsPage(),
  fs.readFileSync(path.resolve(__dirname, 'stockAlertsHelpers.ts'), 'utf8'),
  fs.readFileSync(path.resolve(__dirname, 'stockAlertsPanels.tsx'), 'utf8'),
].join('\n');
const readStockAlertsCss = () => fs.readFileSync(path.resolve(__dirname, 'StockAlerts.css'), 'utf8');

describe('StockAlerts mobile action layout', () => {
  it('keeps the restock action clear of the shared bottom navigation', () => {
    const source = readStockAlertsSource();
    const css = readStockAlertsCss();
    const fixCss = css.slice(css.indexOf('F3442:'));

    expect(source).toContain('stock-alerts stock-alerts-page');
    expect(source).toContain('stock-alerts__mobileAction');
    expect(fixCss).toContain('--stock-alerts-mobile-action-bottom: calc(var(--shop-mobile-bottom-nav-height, 72px)');
    expect(fixCss).toMatch(/\.stock-alerts\.stock-alerts-page\s*\{[\s\S]*?padding-bottom:\s*calc\([\s\S]*?var\(--stock-alerts-mobile-action-bottom\)[\s\S]*?var\(--stock-alerts-mobile-action-height\)/);
    expect(fixCss).toMatch(/\.stock-alerts__mobileAction\s*\{[\s\S]*?bottom:\s*var\(--stock-alerts-mobile-action-bottom\);[\s\S]*?z-index:\s*1240;/);
    expect(fixCss).toMatch(/body\.shop-mobile-app \.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction\s*\{[^}]*z-index:\s*8998;/);
    expect(fixCss).toMatch(/@media \(max-width:\s*860px\) and \(max-height:\s*430px\)[\s\S]*?\.stock-alerts\.stock-alerts-page \.stock-alerts__mobileAction\s*\{[\s\S]*?position:\s*static;/);
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
    expect(source).toContain("const restockNextActionIcon = restockNextAction.tone === 'stale' ? <ShopIcon path={SI.reload} /> : <ShopIcon path={SI.cart} />;");
    expect(source).toContain('disabled={hasStaleProductData || !ready || addingProduct}');
    expect(source).toMatch(/setLoading\(true\);[\s\S]*?const productIds = Array\.from/);
    expect(source).not.toMatch(/setLoading\(true\);\s*setLoadError\(''\);/);
  });

  it('prevents rapid add-to-cart actions from submitting duplicate stock-alert items', () => {
    const source = readStockAlertsSource();

    expect(source).toContain('const inFlightCartProductIds = useRef(new Set<number>());');
    expect(source).toContain('if (inFlightCartProductIds.current.has(product.id)) return false;');
    expect(source).toContain('inFlightCartProductIds.current.add(product.id);');
    expect(source).toContain('inFlightCartProductIds.current.delete(product.id);');
    expect(source).toContain('const addingReadyRef = useRef(false);');
    expect(source).toContain('if (addingReadyRef.current) return;');
    expect(source).toContain('loading={addingProduct}');
    expect(source).toContain('loading={isAddingReady}');
    expect(source).toContain('aria-label={t(\'pages.stockAlerts.nextActionEyebrow\')}');
  });
});
describe('StockAlerts modularization', () => {
  it('keeps stock alerts helpers and panels modularized outside the page shell', () => {
    const page = readStockAlertsPage();
    const helpers = fs.readFileSync(path.resolve(__dirname, 'stockAlertsHelpers.ts'), 'utf8');
    const panels = fs.readFileSync(path.resolve(__dirname, 'stockAlertsPanels.tsx'), 'utf8');
    expect(page).toContain("from './stockAlertsHelpers'");
    expect(page).toContain("from './stockAlertsPanels'");
    expect(page).toContain('<StockAlertsMainPanels');
    expect(page).toContain('buildStockAlertsActionLabels({');
    expect(page).toContain('buildStockAlertsPanelProps({');
    expect(page).toContain('resolveStockAlertNextActionDescriptor({');
    expect(page).not.toContain('stock-alerts__mobileAction');
    expect(page).not.toContain('data-stock-alerts-load-recovery');
    expect(helpers).toContain('export const resolveStockAlertNextActionDescriptor');
    expect(helpers).toContain('export const deriveStockAlertInsights');
    expect(helpers).toContain('export const maskStaleStockAlertInsights');
    expect(helpers).toContain('export const buildStockAlertsActionLabels');
    expect(helpers).toContain('export const buildStockAlertsPanelProps');
    expect(helpers).toContain("title: t('pages.stockAlerts.nextActionStaleTitle')");
    expect(panels).toContain('export const StockAlertsMainPanels');
    expect(panels).toContain('stock-alerts__mobileAction');
    expect(panels).toContain('data-stock-alerts-load-recovery');
    expect(panels).toContain('data-stock-alerts-empty-actions');
    expect(panels).toContain("const restockNextActionIcon = restockNextAction.tone === 'stale' ? <ShopIcon path={SI.reload} /> : <ShopIcon path={SI.cart} />;");
  });
});

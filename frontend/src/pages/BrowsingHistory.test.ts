import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'BrowsingHistory.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'BrowsingHistory.css'), 'utf8');
const preferencesSource = fs.readFileSync(path.join(__dirname, '../utils/productViewPreferences.ts'), 'utf8');

describe('BrowsingHistory mobile action readability guards', () => {
  it('keeps add-to-cart API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(err, t('messages.addFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('catch (error: any)');
  });

  it('uses Ant Design Typography components for page headings and body copy', () => {
    expect(pageSource).toContain("import { Alert, Button, Empty, Input, message, Popconfirm, Spin, Tag, Typography } from 'antd';");
    expect(pageSource).toContain('const { Paragraph, Title } = Typography;');
    expect(pageSource).toContain('<Title level={1} className="browsing-history__title">');
    expect(pageSource).toContain('<Title level={2} className="browsing-history__sectionTitle">');
    expect(pageSource).toContain('<Paragraph className="browsing-history__subtitle">');
    expect(pageSource).toContain('<Paragraph className="browsing-history__sectionText">');
    expect(pageSource).not.toMatch(/<h[12][\s>]/);
    expect(pageSource).not.toMatch(/<p[\s>]/);
    expect(cssSource).toContain('.browsing-history__title.ant-typography');
    expect(cssSource).toContain('.browsing-history__sectionTitle.ant-typography');
    expect(cssSource).not.toContain('.browsing-history h1');
    expect(cssSource).not.toContain('.browsing-history p');
  });

  it('keeps history product load failures visible with a retry action', () => {
    expect(pageSource).toContain('const [loadError, setLoadError] = useState(false);');
    expect(pageSource).toContain('const [reloadToken, setReloadToken] = useState(0);');
    expect(pageSource).toContain('const hasStaleHistoryData = Boolean(loadError && hasHistory);');
    expect(pageSource).toContain('const historyDisplayCount = loadError ? preferences.recent.length : historyProducts.length;');
    expect(pageSource).toContain('setLoadError(true);');
    expect(pageSource).toContain('{loadError ? (');
    expect(pageSource).toContain('<section className="browsing-history__loadError" aria-live="polite">');
    expect(pageSource).toContain('message={t(\'messages.loadFailed\')}');
    expect(pageSource).toContain("description={hasStaleHistoryData ? t('pages.browsingHistory.staleDataWarning') : t('messages.loadFailedRetry')}");
    expect(pageSource).toContain("title: t('pages.browsingHistory.nextActionStaleTitle'),");
    expect(pageSource).toContain('disabled={hasStaleHistoryData}');
    expect(pageSource).toContain('icon={hasStaleHistoryData ? <ReloadOutlined /> : historyNextAction.tone === \'ready\' ? <ShoppingCartOutlined /> : <ShoppingOutlined />}');
    expect(pageSource).toContain('<Button size="small" onClick={() => setReloadToken((current) => current + 1)}>');
    expect(pageSource).toContain('reloadToken]');
  });

  it('keeps cross-tab preference sync scoped to product-view preference storage events', () => {
    expect(pageSource).toContain('PRODUCT_VIEW_PREFERENCES_KEY');
    expect(pageSource).toContain(
      'if (event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY) return;',
    );
    expect(pageSource).toContain("window.addEventListener('shop:product-view-preferences-updated', syncPreferences);");
    expect(pageSource).toContain("window.addEventListener('storage', syncPreferences);");
    expect(pageSource).not.toContain("window.addEventListener('storage', () => setPreferences(loadProductViewPreferences()))");
  });

  it('keeps the browsing history cap named in the preferences utility', () => {
    expect(pageSource).toContain('loadProductViewPreferences');
    expect(pageSource).not.toContain('slice(0, 50)');
    expect(preferencesSource).toContain('export const MAX_PRODUCT_VIEW_HISTORY_ITEMS = 30;');
    expect(preferencesSource).toContain('slice(0, MAX_PRODUCT_VIEW_HISTORY_ITEMS)');
  });

  it('renders the fixed mobile recommendation with title and CTA copy', () => {
    expect(pageSource).toContain('className={`browsing-history__mobileAction browsing-history__mobileAction--${historyNextAction.tone}`}');
    expect(pageSource).toContain('<strong>{historyNextAction.title}</strong>');
    expect(pageSource).toContain('{historyNextAction.label}');
    expect(pageSource).toContain('aria-label={historyNextActionLabel}');
  });

  it('overrides the atomic nowrap pass with a two-row mobile action layout', () => {
    const atomicStart = cssSource.indexOf('/* Final browsing history atomic-text pass */');
    const f2715Start = cssSource.indexOf('/* F2715:');
    const f2715Css = cssSource.slice(f2715Start);

    expect(atomicStart).toBeGreaterThanOrEqual(0);
    expect(f2715Start).toBeGreaterThan(atomicStart);
    expect(f2715Css).toMatch(/\.browsing-history__mobileAction\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*?align-items:\s*stretch\s*!important;/);
    expect(f2715Css).toMatch(/\.browsing-history__mobileAction strong\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*break-word\s*!important;[\s\S]*?-webkit-line-clamp:\s*2;/);
    expect(f2715Css).toMatch(/\.browsing-history__mobileAction \.ant-btn\s*\{[\s\S]*?width:\s*100%;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2715Css).toMatch(/\.browsing-history__mobileAction \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)\s*\{[\s\S]*?text-overflow:\s*clip\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
  });

  it('keeps Android App insight labels at 12px or larger', () => {
    const f3518Css = cssSource.slice(cssSource.indexOf('F3518:'));

    expect(f3518Css).toMatch(/\.browsing-history__eyebrow/);
    expect(f3518Css).toMatch(/\.browsing-history__assistant-actions span/);
    expect(f3518Css).toMatch(/\.browsing-history__mobileAction small/);
    expect(f3518Css).toMatch(/font-size:\s*12px\s*!important;/);
  });
});

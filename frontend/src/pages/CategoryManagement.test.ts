import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'CategoryManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'CategoryManagement.css'), 'utf8');
const appCssSource = fs.readFileSync(path.join(__dirname, '../App.css'), 'utf8');

describe('CategoryManagement readiness panel guards', () => {
  it('keeps category admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.categoryAdmin.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.categoryAdmin.deleteChildFirst'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.categoryAdmin.saveFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });

  it('renders all category readiness metrics before the table', () => {
    expect(pageSource).toContain('className="category-management-page__health"');
    expect(pageSource).toContain('className="category-management-page__healthGrid"');
    expect(pageSource).toContain("t('pages.categoryAdmin.rootCount')");
    expect(pageSource).toContain("t('pages.categoryAdmin.leafCount')");
    expect(pageSource).toContain("t('pages.categoryAdmin.missingImages')");
    expect(pageSource).toContain("t('pages.categoryAdmin.localizationGaps')");
    expect(pageSource).toContain('categoryHealth.missingImages');
    expect(pageSource).toContain('categoryHealth.localizationGaps');
  });

  it('keeps category readiness metrics visible at tablet and landscape widths', () => {
    const f3526Start = cssSource.indexOf('/* F3526');
    const f3526Css = cssSource.slice(f3526Start);

    expect(f3526Start).toBeGreaterThanOrEqual(0);
    expect(f3526Css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.category-management-page__health\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f3526Css).toMatch(/\.category-management-page__health\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow:\s*visible;/);
    expect(f3526Css).toMatch(/\.category-management-page__score\s*\{[\s\S]*?align-items:\s*flex-start;/);
    expect(f3526Css).toMatch(/\.category-management-page__healthGrid,[\s\S]*?\.category-management-page--es \.category-management-page__healthGrid\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(f3526Css).toMatch(/\.category-management-page__healthGrid,[\s\S]*?\.category-management-page--es \.category-management-page__healthGrid\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3526Css).toMatch(/\.category-management-page__healthGrid,[\s\S]*?\.category-management-page--es \.category-management-page__healthGrid\s*\{[\s\S]*?margin-inline:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f3526Css).toMatch(/\.category-management-page__healthGrid,[\s\S]*?\.category-management-page--es \.category-management-page__healthGrid\s*\{[\s\S]*?scroll-snap-type:\s*none\s*!important;[\s\S]*?-webkit-mask-image:\s*none\s*!important;[\s\S]*?mask-image:\s*none\s*!important;[\s\S]*?scrollbar-width:\s*auto;/);
    expect(f3526Css).toMatch(/\.category-management-page__healthItem,[\s\S]*?\.category-management-page--es \.category-management-page__healthItem\s*\{[\s\S]*?flex:\s*initial\s*!important;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?scroll-snap-align:\s*none;/);
    expect(f3526Css).not.toMatch(/minmax\(320px/);
    expect(f3526Css).not.toMatch(/overflow-x:\s*auto/);
    expect(f3526Css).not.toMatch(/scrollbar-width:\s*none/);
  });

  it('keeps the parent TreeSelect popup above mobile editor modals', () => {
    const popupGuardStart = appCssSource.indexOf('Body-mounted Ant Design popups');
    const popupGuardCss = appCssSource.slice(popupGuardStart);

    expect(pageSource).toContain('<TreeSelect');
    expect(pageSource).toContain("classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}");
    expect(pageSource).toContain('getPopupContainer={() => document.body}');
    expect(popupGuardStart).toBeGreaterThanOrEqual(0);
    expect(popupGuardCss).toMatch(/@media \(max-width:\s*780px\)\s*\{[\s\S]*?\.shop-mobile-popup-layer,[\s\S]*?\.shop-mobile-popup-layer\.ant-select-dropdown[\s\S]*?\{[\s\S]*?z-index:\s*var\(--shop-z-floating-panel\)\s*!important;/);
    expect(popupGuardCss).toMatch(/\.shop-mobile-popup-layer\.ant-select-dropdown,[\s\S]*?\.shop-mobile-popup-layer\.ant-cascader-dropdown,[\s\S]*?\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?width:\s*auto\s*!important;/);
  });
});

import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'BrandManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'BrandManagement.css'), 'utf8');

describe('BrandManagement health panel guards', () => {
  it('keeps brand admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.brandAdmin.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.brandAdmin.saveFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.brandAdmin.deleteFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });

  it('renders all brand trust health metrics before the table', () => {
    expect(pageSource).toContain('className="brand-management-page__health"');
    expect(pageSource).toContain('className="brand-management-page__healthGrid"');
    expect(pageSource).toContain("t('pages.brandAdmin.activeBrands')");
    expect(pageSource).toContain("t('pages.brandAdmin.missingLogo')");
    expect(pageSource).toContain("t('pages.brandAdmin.missingWebsite')");
    expect(pageSource).toContain("t('pages.brandAdmin.weakDescription')");
    expect(pageSource).toContain('brandHealth.missingWebsite');
    expect(pageSource).toContain('brandHealth.weakDescription');
  });

  it('keeps brand trust metrics visible at tablet and landscape widths', () => {
    const f3525Start = cssSource.indexOf('/* F3525');
    const f3525Css = cssSource.slice(f3525Start);

    expect(f3525Start).toBeGreaterThanOrEqual(0);
    expect(f3525Css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.brand-management-page__health\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f3525Css).toMatch(/\.brand-management-page__health\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow:\s*visible;/);
    expect(f3525Css).toMatch(/\.brand-management-page__score\s*\{[\s\S]*?align-items:\s*flex-start;/);
    expect(f3525Css).toMatch(/\.brand-management-page__healthGrid,[\s\S]*?\.brand-management-page--es \.brand-management-page__healthGrid\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(f3525Css).toMatch(/\.brand-management-page__healthGrid,[\s\S]*?\.brand-management-page--es \.brand-management-page__healthGrid\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3525Css).toMatch(/\.brand-management-page__healthGrid,[\s\S]*?\.brand-management-page--es \.brand-management-page__healthGrid\s*\{[\s\S]*?margin-inline:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f3525Css).toMatch(/\.brand-management-page__healthGrid,[\s\S]*?\.brand-management-page--es \.brand-management-page__healthGrid\s*\{[\s\S]*?scroll-snap-type:\s*none\s*!important;[\s\S]*?-webkit-mask-image:\s*none\s*!important;[\s\S]*?mask-image:\s*none\s*!important;[\s\S]*?scrollbar-width:\s*auto;/);
    expect(f3525Css).toMatch(/\.brand-management-page__healthItem,[\s\S]*?\.brand-management-page--es \.brand-management-page__healthItem\s*\{[\s\S]*?flex:\s*initial\s*!important;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?scroll-snap-align:\s*none;/);
    expect(f3525Css).not.toMatch(/minmax\(320px/);
    expect(f3525Css).not.toMatch(/overflow-x:\s*auto/);
    expect(f3525Css).not.toMatch(/scrollbar-width:\s*none/);
  });
});

import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'LogisticsCarrierManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'LogisticsCarrierManagement.css'), 'utf8');

describe('LogisticsCarrierManagement readiness panel guards', () => {
  it('renders all carrier readiness risk metrics before the table', () => {
    expect(pageSource).toContain('className="logistics-carrier-page__health"');
    expect(pageSource).toContain('className="logistics-carrier-page__healthGrid"');
    expect(pageSource).toContain("t('pages.logisticsCarriers.activeCarriers')");
    expect(pageSource).toContain("t('pages.logisticsCarriers.missingCodes')");
    expect(pageSource).toContain("t('pages.logisticsCarriers.duplicateCodes')");
    expect(pageSource).toContain("t('pages.logisticsCarriers.sortConflicts')");
    expect(pageSource).toContain('carrierHealth.duplicateSortOrders');
  });

  it('keeps the readiness metrics visible at tablet and landscape widths', () => {
    const f3522Start = cssSource.indexOf('/* F3522');
    const f3522Css = cssSource.slice(f3522Start);

    expect(f3522Start).toBeGreaterThanOrEqual(0);
    expect(f3522Css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.logistics-carrier-page__health\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__health\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow:\s*visible;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__score\s*\{[\s\S]*?align-items:\s*flex-start;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__healthGrid\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__healthGrid\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__healthGrid\s*\{[\s\S]*?margin-inline:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__healthGrid\s*\{[\s\S]*?scroll-snap-type:\s*none\s*!important;[\s\S]*?-webkit-mask-image:\s*none\s*!important;[\s\S]*?mask-image:\s*none\s*!important;[\s\S]*?scrollbar-width:\s*auto;/);
    expect(f3522Css).toMatch(/\.logistics-carrier-page__healthItem\s*\{[\s\S]*?flex:\s*initial\s*!important;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?scroll-snap-align:\s*none;/);
    expect(f3522Css).not.toMatch(/minmax\(320px/);
    expect(f3522Css).not.toMatch(/overflow-x:\s*auto/);
    expect(f3522Css).not.toMatch(/scrollbar-width:\s*none/);
  });
});

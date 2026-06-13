import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'PetFinder.tsx'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'PetFinder.css'), 'utf8');

describe('PetFinder responsive controls', () => {
  it('reserves fixed bottom-nav clearance for the first-step budget controls', () => {
    expect(source).toContain('<Card className="pet-finder-page__finderCard">');
    expect(source).toContain('<Col xs={24} sm={12} className="pet-finder-page__budgetControl">');
    expect(source).toContain('<Slider');
    expect(source).toContain('ariaLabelForHandle={[');

    const f2758Start = css.indexOf('/* F2758');
    const f2758Css = css.slice(f2758Start);

    expect(f2758Start).toBeGreaterThanOrEqual(0);
    expect(f2758Css).toMatch(/@media \(max-width:\s*780px\),\s*\(max-height:\s*480px\)\s*\{/);
    expect(f2758Css).toMatch(/\.pet-finder-page\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\) \+ 136px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:/);
    expect(f2758Css).toMatch(/\.pet-finder-page__finderCard\s*\{[\s\S]*?margin-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\) \+ 18px \+ env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?scroll-margin-bottom:/);
    expect(f2758Css).toMatch(/\.pet-finder-page__budgetControl\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\) \+ 14px \+ env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?scroll-margin-bottom:/);
    expect(f2758Css).toMatch(/\.pet-finder-page__budgetControl \.ant-slider\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?margin-bottom:\s*18px;/);
    expect(f2758Css).toMatch(/body:has\(\.pet-finder-page\) \.shop-nav__bottomBar\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?z-index:\s*1250;/);
  });
});

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

  it('keeps mobile recommendation card actions readable instead of ellipsized columns', () => {
    const f2711Start = css.lastIndexOf('F2711: mobile Pet Finder recommendation actions need a full readable row.');
    const f2711Css = css.slice(f2711Start);

    expect(source).toContain('className="pet-finder-page__recommendationGrid"');
    expect(source).toContain('className="pet-finder-page__productCard"');
    expect(source).toContain("{t('pages.petFinder.view')}");
    expect(f2711Start).toBeGreaterThan(css.lastIndexOf('F2758: reserve bottom-nav clearance for the first finder budget controls.'));
    expect(f2711Css).toMatch(/@media \(max-width:\s*640px\)\s*\{/);
    expect(f2711Css).toMatch(/body:not\(\.shop-mobile-app\) \.pet-finder-page__productCard \.ant-card-actions\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(f2711Css).toMatch(/body:not\(\.shop-mobile-app\) \.pet-finder-page__productCard \.ant-card-actions > li,[\s\S]*?body:not\(\.shop-mobile-app\) \.pet-finder-page__productCard \.ant-card-actions > li > span\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?justify-content:\s*center\s*!important;/);
    expect(f2711Css).toMatch(/body:not\(\.shop-mobile-app\) \.pet-finder-page__productCard \.ant-card-actions \.ant-btn\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?text-overflow:\s*clip\s*!important;/);
    expect(f2711Css).toMatch(/body:not\(\.shop-mobile-app\) \.pet-finder-page__productCard \.ant-card-actions \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)\s*\{[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?text-overflow:\s*clip\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2711Css).not.toMatch(/text-overflow:\s*ellipsis/);
  });

  it('keeps current pet filter controls labelled and the stale PetPage absent', () => {
    const pagesDir = __dirname;
    const petPageFiles = ['PetFinder.tsx', 'PetGallery.tsx', 'PetGalleryManagement.tsx'];
    const unlabeledNativeSelects = petPageFiles.flatMap((file) => {
      const pageSource = fs.readFileSync(path.join(pagesDir, file), 'utf8');
      return Array.from(pageSource.matchAll(/<select\b[^>]*>/g))
        .filter(([tag]) => !/\baria-label=|\baria-labelledby=/.test(tag))
        .map(() => file);
    });
    const unlabeledAntdSelects = petPageFiles.flatMap((file) => {
      const pageSource = fs.readFileSync(path.join(pagesDir, file), 'utf8');
      return Array.from(pageSource.matchAll(/<Select\b[\s\S]*?\/>/g))
        .filter(([tag]) => !/\baria-label=|\baria-labelledby=/.test(tag))
        .map(() => file);
    });

    expect(fs.existsSync(path.join(pagesDir, 'PetPage.tsx'))).toBe(false);
    expect(source).toContain("aria-label={t('pages.petFinder.petType')}");
    expect(source).toContain("aria-label={t('pages.petFinder.need')}");
    expect(source).toContain("aria-label={t('pages.petFinder.priority')}");
    expect(unlabeledNativeSelects).toEqual([]);
    expect(unlabeledAntdSelects).toEqual([]);
  });
});

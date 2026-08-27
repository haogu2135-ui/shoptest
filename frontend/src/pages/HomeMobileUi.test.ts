import fs from 'fs';
import path from 'path';

const homeCss = fs.readFileSync(path.join(__dirname, 'Home.css'), 'utf8');
const mobileAppCss = fs.readFileSync(path.resolve(__dirname, '../mobile-app.css'), 'utf8');

describe('Home mobile quick-entry UI contracts', () => {
  it('keeps localized quick-entry labels readable after final mobile overrides', () => {
    const finalRuleStart = homeCss.indexOf('Commercial mobile quick-entry labels: localized names must remain readable');
    const finalRule = homeCss.slice(finalRuleStart);

    expect(finalRuleStart).toBeGreaterThan(-1);
    expect(finalRule).toMatch(/@media \(max-width:\s*600px\)/);
    expect(finalRule).toMatch(/\.shopee-mobile-quick-panel button > \.shopee-mobile-quick-panel__label\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?min-height:\s*28px\s*!important;[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(finalRule).toMatch(/overflow-wrap:\s*normal\s*!important;/);
    expect(finalRule).not.toMatch(/font-size:\s*(?:9|10|11)(?:\.\d+)?px/);
  });

  it('keeps the flash-sale quick-entry grid wide enough for localized labels', () => {
    expect(homeCss).toMatch(/Keep the high-intent flash-sale entry visible in the mobile home rail[\s\S]*?\.shopee-mobile-quick-panel\s*,[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  });

  it('keeps the first App quick-entry row above the fixed rail on short phones', () => {
    const shortScreenRuleStart = mobileAppCss.indexOf('Short Android screens: keep the first quick-entry row above the fixed');
    const shortScreenRule = mobileAppCss.slice(shortScreenRuleStart);

    expect(shortScreenRuleStart).toBeGreaterThan(-1);
    expect(shortScreenRule).toMatch(/@media \(max-width:\s*390px\) and \(max-height:\s*620px\)/);
    expect(shortScreenRule).toMatch(/\.shopee-mobile-priority\s*\{[\s\S]*?margin-top:\s*-8px\s*!important;/);
  });

  it('uses the shipped mobile pet image for the native home hero', () => {
    const initialHeroRuleStart = mobileAppCss.indexOf('body.shop-mobile-app .shopee-hero__main {');
    const initialHeroRuleEnd = mobileAppCss.indexOf('}', initialHeroRuleStart);
    const initialHeroRule = mobileAppCss.slice(initialHeroRuleStart, initialHeroRuleEnd + 1);
    const heroRuleStart = mobileAppCss.indexOf('Keep the native home hero grounded in the real storefront');
    const heroRule = mobileAppCss.slice(heroRuleStart);

    expect(initialHeroRuleStart).toBeGreaterThan(-1);
    expect(initialHeroRule).not.toContain('data:image/svg+xml');
    expect(initialHeroRule).toMatch(/background-image:[\s\S]*var\(--shop-home-hero-mobile-pet,\s*none\);/);
    expect(heroRuleStart).toBeGreaterThan(-1);
    expect(heroRule).toMatch(/\.shopee-hero__main\s*\{[\s\S]*?background-image:\s*var\(--shop-home-hero-mobile-pet,\s*none\)\s*!important;[\s\S]*?background-size:\s*cover\s*!important;/);
    expect(heroRule).toMatch(/\.shopee-hero__main::before\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?background:\s*rgba\(18,\s*71,\s*52,\s*0\.54\)\s*!important;/);
  });
});

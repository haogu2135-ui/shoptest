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

  it('keeps Spanish quick-entry words intact without splitting labels', () => {
    const spanishRuleStart = homeCss.lastIndexOf('Spanish quick entries contain longer words');
    const spanishRule = homeCss.slice(spanishRuleStart);

    expect(spanishRuleStart).toBeGreaterThan(-1);
    expect(spanishRule).toMatch(/@media \(max-width:\s*600px\)/);
    expect(spanishRule).toMatch(/\.shopee-home\.shopee-home--es \.shopee-mobile-quick-panel button\s*\{[\s\S]*?padding-inline:\s*1px\s*!important;/);
    expect(spanishRule).toMatch(/\.shopee-home\.shopee-home--es \.shopee-mobile-quick-panel__label\s*\{[\s\S]*?overflow-wrap:\s*normal\s*!important;[\s\S]*?word-break:\s*keep-all\s*!important;[\s\S]*?hyphens:\s*none\s*!important;/);
  });

  it('keeps the Web mobile quick-entry row clear of the fixed bottom rail', () => {
    const webRailRuleStart = homeCss.lastIndexOf('Web mobile home: the hero stats duplicate');
    const webRailRule = homeCss.slice(webRailRuleStart);

    expect(webRailRuleStart).toBeGreaterThan(-1);
    expect(webRailRule).toMatch(/@media \(max-width:\s*600px\)/);
    expect(webRailRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-hero__signalRow\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(webRailRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-mobile-priority\s*\{[\s\S]*?margin-top:\s*-48px\s*!important;/);
  });

  it('keeps every quick-entry destination above first-visit consent', () => {
    const consentRuleStart = homeCss.lastIndexOf('First-visit consent should not leave the ninth quick entry');
    const consentRule = homeCss.slice(consentRuleStart);

    expect(consentRuleStart).toBeGreaterThan(-1);
    expect(consentRule).toMatch(/@media \(max-width:\s*600px\)/);
    expect(consentRule).toMatch(/body\.shop-cookie-consent-visible:has\(\.shopee-home\) \.shopee-mobile-quick-panel[\s\S]*?grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\) !important;/);
  });

  it('compacts the Web hero on short phones before the quick-entry rail', () => {
    const shortWebRuleStart = homeCss.lastIndexOf('@media (max-width: 390px) and (max-height: 620px)');
    const shortWebRule = homeCss.slice(shortWebRuleStart);

    expect(shortWebRuleStart).toBeGreaterThan(-1);
    expect(shortWebRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-hero__categoryRail\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(shortWebRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-mobile-priority\s*\{[\s\S]*?margin-top:\s*-20px\s*!important;/);
    expect(shortWebRule).toMatch(/body\.shop-cookie-consent-visible:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-home \.shopee-hero \.shopee-hero__main > div\s*\{[\s\S]*?transform:\s*translateY\(-52px\)\s*!important;/);
  });

  it('keeps both mobile web hero actions above first-visit consent', () => {
    const webHeroRuleStart = homeCss.lastIndexOf('Mobile web keeps both first-viewport hero actions');
    const webHeroRule = homeCss.slice(webHeroRuleStart);

    expect(webHeroRuleStart).toBeGreaterThan(-1);
    expect(webHeroRule).toMatch(/@media \(max-width:\s*600px\)/);
    expect(webHeroRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-hero__actions\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(webHeroRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-hero__actions \.home-btn\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?height:\s*44px\s*!important;/);
    expect(webHeroRule).toMatch(/body:not\(\.shop-mobile-app\) \.shop-app-shell--home \.shopee-hero__actions \.home-btn > span[^\{]*\{[\s\S]*?white-space:\s*normal\s*!important;/);
  });

  it('reserves short-phone scroll room below the quick-entry rail', () => {
    const clearanceRuleStart = homeCss.lastIndexOf('Short mobile pages need their own scroll buffer');
    const clearanceRule = homeCss.slice(clearanceRuleStart);

    expect(clearanceRuleStart).toBeGreaterThan(-1);
    expect(clearanceRule).toMatch(/@media \(max-width:\s*600px\) and \(max-height:\s*760px\)/);
    expect(clearanceRule).toMatch(/\.shopee-home \.shopee-mobile-priority,[\s\S]*?body\.shop-mobile-app \.shop-app-shell--home \.shopee-mobile-priority\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 24px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
  });

  it('keeps hero actions visible above consent in short mobile landscape', () => {
    const shortLandscapeStart = homeCss.lastIndexOf('Short mobile landscape: keep the first conversion actions');
    const shortLandscape = homeCss.slice(shortLandscapeStart);

    expect(shortLandscapeStart).toBeGreaterThan(-1);
    expect(shortLandscape).toContain('@media (max-width: 900px) and (max-height: 430px)');
    expect(shortLandscape).toMatch(/\.shopee-home \.shopee-hero__grid\s*\{[\s\S]*?display:\s*block\s*!important;/);
    expect(shortLandscape).toMatch(/\.shopee-home \.shopee-hero p\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(shortLandscape).toMatch(/\.shopee-home \.shopee-hero__actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(shortLandscape).toMatch(/\.shopee-home \.shopee-hero__actions \.ant-btn\s*\{[\s\S]*?height:\s*44px\s*!important;/);
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

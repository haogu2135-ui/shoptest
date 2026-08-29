import fs from 'fs';
import path from 'path';

const readLocal = (fileName: string) => fs.readFileSync(path.resolve(__dirname, fileName), 'utf8');

describe('CookieConsentBanner short-screen layout contract', () => {
  it('keeps both legal links and both consent actions at accessible touch sizes', () => {
    const source = readLocal('CookieConsentBanner.tsx');
    const css = readLocal('CookieConsentBanner.css');

    expect(source).toContain('className="cookie-consent-banner__link"');
    expect(source).toContain('className="cookie-consent-banner__button"');
    expect(css).toMatch(/\.cookie-consent-banner__button\.ant-btn\s*\{[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.cookie-consent-banner__link\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('uses a one-row legal rail on short narrow phones without covering the bottom nav', () => {
    const css = readLocal('CookieConsentBanner.css');

    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toMatch(/\.cookie-consent-banner__legal\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?white-space:\s*nowrap;/);
    expect(css).toMatch(/\.cookie-consent-banner__separator\s*\{[\s\S]*?display:\s*none;/);
    expect(css).toContain('var(--shop-mobile-bottom-nav-height, 72px)');
    expect(css).toContain('body.shop-cookie-consent-visible');
  });

  it('keeps long localized consent action labels inside narrow buttons', () => {
    const css = readLocal('CookieConsentBanner.css');

    expect(css).toMatch(/@media \(max-width: 390px\)[\s\S]*?\.cookie-consent-banner__button\.ant-btn\s*\{[\s\S]*?padding-inline:\s*8px/);
    expect(css).toMatch(/body \.cookie-consent-banner__button\.ant-btn:not\(\.ant-btn-icon-only\)\s*>\s*span\.shop-button__label[\s\S]*?white-space:\s*normal\s*!important/);
    expect(css).toMatch(/body \.cookie-consent-banner__button\.ant-btn:not\(\.ant-btn-icon-only\)\s*>\s*span\.shop-button__label[\s\S]*?overflow:\s*visible\s*!important/);
  });

  it('uses the real safe-area edge on mobile conversion shells', () => {
    const css = readLocal('CookieConsentBanner.css');

    expect(css).toMatch(/body:has\(\.shop-app-shell--auth-flow\) \.cookie-consent-banner,[\s\S]*?body:has\(\.shop-app-shell--checkout-flow\) \.cookie-consent-banner[\s\S]*?bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\) !important/);
    expect(css).toMatch(/body\.shop-cookie-consent-visible:has\(\.shop-app-shell--auth-flow\) \.shopee-login-quickLinks[\s\S]*?display:\s*none !important/);
  });

  it('uses a compact horizontal consent panel in short mobile landscape', () => {
    const css = readLocal('CookieConsentBanner.css');
    const shortLandscapeStart = css.indexOf('Short mobile landscape has little vertical room');
    const shortLandscape = css.slice(shortLandscapeStart);

    expect(shortLandscapeStart).toBeGreaterThan(-1);
    expect(shortLandscape).toContain('@media (max-width: 900px) and (max-height: 430px)');
    expect(shortLandscape).toMatch(/\.cookie-consent-banner\s*\{[\s\S]*?bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\)/);
    expect(shortLandscape).toMatch(/\.cookie-consent-banner__inner\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(220px, 0\.72fr\)/);
    expect(shortLandscape).toMatch(/\.cookie-consent-banner__text\s*\{[\s\S]*?-webkit-line-clamp:\s*1/);
    expect(shortLandscape).toMatch(/\.cookie-consent-banner__actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(shortLandscape).toMatch(/\.cookie-consent-banner__button\.ant-btn\s*\{[\s\S]*?min-height:\s*44px !important/);
  });

  it('keeps regular phone portraits from losing the lower quarter to consent', () => {
    const css = readLocal('CookieConsentBanner.css');
    const compactPortraitStart = css.indexOf('Keep the first-visit consent surface compact on regular phone portraits');
    const compactPortrait = css.slice(compactPortraitStart);

    expect(compactPortraitStart).toBeGreaterThan(-1);
    expect(compactPortrait).toContain('@media (min-width: 351px) and (max-width: 780px) and (min-height: 431px)');
    expect(compactPortrait).toMatch(/\.cookie-consent-banner__inner\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(124px, 0\.68fr\)/);
    expect(compactPortrait).toMatch(/\.cookie-consent-banner__text\s*\{[\s\S]*?max-height:\s*calc\(1 \* 12px \* 1\.25\)[\s\S]*?-webkit-line-clamp:\s*1/);
    expect(compactPortrait).toMatch(/\.cookie-consent-banner__actions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(compactPortrait).toMatch(/\.cookie-consent-banner__link\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('keeps short-landscape cart and checkout recovery actions above consent', () => {
    const cartCss = fs.readFileSync(path.resolve(__dirname, '../pages/Cart.css'), 'utf8');
    const checkoutCss = fs.readFileSync(path.resolve(__dirname, '../pages/Checkout.css'), 'utf8');

    expect(cartCss).toMatch(/@media \(max-width: 900px\) and \(max-height: 430px\)[\s\S]*?\.cart-page--empty \.cart-page__emptyHero[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\)[\s\S]*?\.cart-page--empty \.cart-page__emptyActions[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*?shop-button__label[\s\S]*?white-space:\s*normal !important[\s\S]*?\.cart-page--empty \.cart-page__emptySignals[\s\S]*?display:\s*none !important/);
    expect(checkoutCss).toMatch(/@media \(max-width: 900px\) and \(max-height: 430px\)[\s\S]*?\.checkout-page--empty \.checkout-page__emptyHero[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\)[\s\S]*?\.checkout-page--empty \.checkout-page__emptyActions[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)[\s\S]*?shop-button__label[\s\S]*?white-space:\s*normal !important[\s\S]*?\.checkout-page--empty \.checkout-page__emptySignals[\s\S]*?display:\s*none !important/);
  });

  it('lifts native browsing history action above first-visit consent', () => {
    const css = readLocal('CookieConsentBanner.css');

    expect(css).toMatch(/body\.shop-cookie-consent-visible\.shop-mobile-app\.shop-mobile-app\.shop-mobile-app \.shop-app-shell--history \.browsing-history__mobileAction\s*\{[\s\S]*?position:\s*fixed !important;[\s\S]*?bottom:\s*calc\(var\(--shop-cookie-consent-clearance, 200px\) \+ 8px\) !important[\s\S]*?width:\s*auto !important/);
  });

  it('lifts native stock-alert action above first-visit consent', () => {
    const css = readLocal('CookieConsentBanner.css');

    expect(css).toMatch(/body\.shop-cookie-consent-visible\.shop-mobile-app\.shop-mobile-app\.shop-mobile-app \.stock-alerts__mobileAction\s*\{[\s\S]*?bottom:\s*calc\(var\(--shop-cookie-consent-clearance, 200px\) \+ 8px\) !important[\s\S]*?z-index:\s*9200 !important;/);
  });

  it('reserves a short-screen home layout for the visible consent panel', () => {
    const homeCss = fs.readFileSync(path.resolve(__dirname, '../pages/Home.css'), 'utf8');

    expect(homeCss).toMatch(/@media \(min-width: 781px\)[\s\S]*?body\.shop-cookie-consent-visible \.shop-app-shell--home \.shopee-home \.shopee-hero__main\s*\{[\s\S]*?align-items:\s*flex-start/);
    expect(homeCss).toContain('@media (max-width: 390px) and (max-height: 620px)');
    expect(homeCss).toMatch(/shop-cookie-consent-visible[\s\S]*?shopee-hero__authActions[\s\S]*?display:\s*none\s*!important/);
    expect(homeCss).toContain('transform: translateY(-12px);');
  });
});

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

  it('reserves a short-screen home layout for the visible consent panel', () => {
    const homeCss = fs.readFileSync(path.resolve(__dirname, '../pages/Home.css'), 'utf8');

    expect(homeCss).toContain('@media (max-width: 390px) and (max-height: 620px)');
    expect(homeCss).toMatch(/shop-cookie-consent-visible[\s\S]*?shopee-hero__authActions[\s\S]*?display:\s*none\s*!important/);
    expect(homeCss).toContain('transform: translateY(-12px);');
  });
});

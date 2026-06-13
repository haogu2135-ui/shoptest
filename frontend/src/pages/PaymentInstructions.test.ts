import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'PaymentInstructions.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'PaymentInstructions.css'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
const mobileAppCssSource = fs.readFileSync(path.join(__dirname, '../mobile-app.css'), 'utf8');

describe('PaymentInstructions step readability guards', () => {
  it('scopes the circular badge style to the numeric marker only', () => {
    expect(pageSource).toContain('className="payment-instructions-page__stepNumber"');
    expect(pageSource).not.toContain('<span aria-hidden="true">{index + 1}</span>');

    expect(cssSource).toContain('.payment-instructions-page__stepNumber');
    expect(cssSource).not.toContain('.payment-instructions-page__step > span');
    expect(cssSource).toMatch(/\.payment-instructions-page__stepNumber\s*\{[\s\S]*?width:\s*28px;[\s\S]*?height:\s*28px;[\s\S]*?border-radius:\s*50%;/);
  });

  it('keeps step instruction text in the text column instead of the badge', () => {
    const textRuleMatch = cssSource.match(/\.payment-instructions-page__step \.ant-typography\s*\{([\s\S]*?)\}/);

    expect(textRuleMatch).not.toBeNull();
    expect(textRuleMatch?.[1]).toMatch(/display:\s*block;/);
    expect(textRuleMatch?.[1]).toMatch(/width:\s*100%;/);
    expect(textRuleMatch?.[1]).toMatch(/white-space:\s*normal;/);
    expect(textRuleMatch?.[1]).not.toMatch(/width:\s*28px/);
    expect(textRuleMatch?.[1]).not.toMatch(/height:\s*28px/);
    expect(textRuleMatch?.[1]).not.toMatch(/border-radius:\s*50%/);
  });

  it('keeps APP payment instructions next steps content-sized above the native bottom rail', () => {
    const closureStart = mobileAppCssSource.indexOf('UI-20260607-56: PaymentInstructions APP next steps must size to content');
    const closureCss = mobileAppCssSource.slice(closureStart);

    expect(appSource).toContain("location.pathname.startsWith('/payment/') ? 'shop-app-shell--payment-instructions' : ''");
    expect(closureStart).toBeGreaterThanOrEqual(0);
    expect(closureCss).toContain('@media (max-width: 860px)');
    expect(closureCss).toMatch(/\.shop-app-shell--payment-instructions \.payment-instructions-page,[\s\S]*?:has\(\.payment-instructions-page\) \.payment-instructions-page\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 172px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 132px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__steps\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__step\s*\{[\s\S]*?grid-template-columns:\s*34px minmax\(0,\s*1fr\)\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 18px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__actions \.ant-btn-primary\s*\{[\s\S]*?background:\s*#124734\s*!important;[\s\S]*?color:\s*#ffffff\s*!important;[\s\S]*?-webkit-text-fill-color:\s*#ffffff\s*!important;/);
    expect(closureCss).toMatch(/@media \(max-width:\s*380px\)[\s\S]*?\.payment-instructions-page__actions[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
  });
});

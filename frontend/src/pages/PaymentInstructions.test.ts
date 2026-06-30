import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'PaymentInstructions.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'PaymentInstructions.css'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
const mobileAppCssSource = fs.readFileSync(path.join(__dirname, '../mobile-app.css'), 'utf8');

describe('PaymentInstructions step readability guards', () => {
  it('keeps current payment detail loading guarded against stale route responses', () => {
    const effectStart = pageSource.indexOf('let disposed = false;');
    const effectSource = pageSource.slice(effectStart, pageSource.indexOf('const channel =', effectStart));

    expect(effectStart).toBeGreaterThanOrEqual(0);
    expect(appSource).toContain("const PaymentInstructions = lazy(() => import('./pages/PaymentInstructions'));");
    expect(appSource).toContain('<Route path="payment/:orderNo" element={<PaymentInstructions />} />');
    expect(effectSource).toContain('let disposed = false;');
    expect(effectSource).toContain('if (disposed) return;');
    expect(effectSource).toContain('setOrder(nextOrder);');
    expect(effectSource).toContain('if (!disposed) setPayment(paymentResponse.data);');
    expect(effectSource).toContain('if (!disposed) setPayment(null);');
    expect(effectSource).toContain('if (!disposed) setVerifying(false);');
    expect(effectSource).toContain('disposed = true;');
    expect(pageSource).not.toContain('const Payment: React.FC');
  });

  it('announces payment verification loading as a busy status region', () => {
    const spinStart = pageSource.indexOf('<Spin');
    const spinOpeningTag = pageSource.slice(spinStart, pageSource.indexOf('>', spinStart) + 1);

    expect(spinStart).toBeGreaterThan(-1);
    expect(spinOpeningTag).toContain('spinning={verifying}');
    expect(spinOpeningTag).toContain('role="status"');
    expect(spinOpeningTag).toContain('aria-live="polite"');
    expect(spinOpeningTag).toContain('aria-busy={verifying}');
    expect(spinOpeningTag).toContain("aria-label={verifying ? t('common.loading') : undefined}");
  });

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
    const stepRule = closureCss.match(/\.payment-instructions-page__step,[\s\S]*?\{([\s\S]*?)\}/)?.[1] || '';

    expect(appSource).toContain("location.pathname.startsWith('/payment/') ? 'shop-app-shell--payment-instructions' : ''");
    expect(closureStart).toBeGreaterThanOrEqual(0);
    expect(closureCss).toContain('@media (max-width: 860px)');
    expect(closureCss).toMatch(/\.shop-app-shell--payment-instructions \.payment-instructions-page,[\s\S]*?:has\(\.payment-instructions-page\) \.payment-instructions-page\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 172px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 132px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__steps\s*\{[\s\S]*?min-height:\s*0\s*!important;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?overflow:\s*visible\s*!important;/);
    expect(stepRule).toContain('grid-template-columns: 34px minmax(0, 1fr) !important;');
    expect(stepRule).toContain('height: auto !important;');
    expect(stepRule).toContain('overflow: visible !important;');
    expect(closureCss).toMatch(/\.payment-instructions-page__actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*72px\) \+ 18px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(closureCss).toMatch(/\.payment-instructions-page__actions \.ant-btn-primary\s*\{[\s\S]*?background:\s*#124734\s*!important;[\s\S]*?color:\s*#ffffff\s*!important;[\s\S]*?-webkit-text-fill-color:\s*#ffffff\s*!important;/);
    expect(closureCss).toMatch(/@media \(max-width:\s*380px\)[\s\S]*?\.payment-instructions-page__actions[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
  });
});

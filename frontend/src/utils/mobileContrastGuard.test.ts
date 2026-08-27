import fs from 'fs';
import path from 'path';

const readSource = () => fs.readFileSync(path.resolve(__dirname, 'mobileContrastGuard.ts'), 'utf8');

describe('mobileContrastGuard source contract', () => {
  it('keeps scan scheduler state scoped to the installed guard element', () => {
    const source = readSource();

    expect(source).not.toMatch(/\nlet\s+(contrastScanTimer|contrastScanFrame|contrastMarkedElements|lastMobileInteractionAt)\b/);
    expect(source).toContain('type MobileContrastGuardState');
    expect(source).toContain('CONTRAST_GUARD_STATE_PROP');
    expect(source).toContain('getMobileContrastGuardState(style);');
    expect(source).toContain('readMobileContrastGuardState()');
    expect(source).toContain('state.scanTimer');
    expect(source).toContain('state.scanFrame');
    expect(source).toContain('state.markedElements');
    expect(source).toContain('state.lastInteractionAt');
  });

  it('keeps native home and catalog primary CTAs readable in the Android WebView', () => {
    const source = readSource();

    expect(source).toContain('.shopee-hero__actions .home-btn');
    expect(source).toContain('.shopee-hero__authActions .home-btn');
    expect(source).toContain('.product-list__actionButton.ant-btn-primary');
    expect(source).toContain('-webkit-text-fill-color: #ffffff !important;');
    expect(source).toContain('.product-list__actionButton.ant-btn-primary.ant-btn-disabled');
    expect(source).toContain('fill: currentColor !important;');
  });

  it('keeps checkout hero stat cards readable on the dark App hero', () => {
    const source = readSource();

    expect(source).toMatch(/checkout-page__hero \.checkout-page__heroStat[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.12\) !important;[\s\S]*?color:\s*#ffffff !important;/);
    expect(source).toMatch(/checkout-page__hero \.checkout-page__heroStat :where\([\s\S]*?-webkit-text-fill-color:\s*#ffffff !important;/);
  });

  it('keeps the selected checkout address card on a light readable surface', () => {
    const source = readSource();

    expect(source).toMatch(/checkout-page__addressChoice\.checkout-page__addressChoice--selected[\s\S]*?background:\s*#f8fcf9 !important;[\s\S]*?color:\s*#173f2b !important;/);
    expect(source).toMatch(/checkout-page__addressChoice\.checkout-page__addressChoice--selected :where\([\s\S]*?-webkit-text-fill-color:\s*#173f2b !important;/);
  });

  it('keeps checkout coupon discounts as readable summary text', () => {
    const source = readSource();

    expect(source).toMatch(/checkout-page__couponSummary \.checkout-page__text--success[\s\S]*?background:\s*transparent !important;[\s\S]*?color:\s*#2f4f3a !important;/);
    expect(source).toMatch(/checkout-page__couponSummary \.checkout-page__text--success \.commerce-money[\s\S]*?-webkit-text-fill-color:\s*#2f4f3a !important;/);
  });

  it('keeps the contrast guard before the final Android cascade guard', () => {
    const source = readSource();
    const orderStart = source.indexOf('const finalGuard = document.getElementById(ANDROID_FINAL_STYLE_ID);');
    const orderEnd = source.indexOf('  scheduleMobileContrastScan();', orderStart);
    const orderSource = source.slice(orderStart, orderEnd);

    expect(source).toContain("const ANDROID_FINAL_STYLE_ID = 'shop-android-ui-final-guard';");
    expect(orderStart).toBeGreaterThan(-1);
    expect(orderEnd).toBeGreaterThan(orderStart);
    expect(orderSource).toContain('document.head.insertBefore(style, finalGuard);');
    expect(orderSource).toContain('style.nextElementSibling !== finalGuard');
  });
});

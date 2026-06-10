import fs from 'fs';
import path from 'path';

const readCouponCenterSource = () => fs.readFileSync(path.resolve(__dirname, 'CouponCenter.tsx'), 'utf8');
const readCouponCenterCss = () => fs.readFileSync(path.resolve(__dirname, 'CouponCenter.css'), 'utf8');

describe('CouponCenter mobile coupon rail contract', () => {
  it('keeps coupon claim API error handling typed without broad any usage', () => {
    const source = readCouponCenterSource();

    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.coupons.claimFailed'), language)");
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });

  it('renders the quick navigation and mobile action bar controls', () => {
    const source = readCouponCenterSource();

    expect(source).toContain('className="coupon-center-page__quickNav"');
    expect(source).toContain('coupon-center-page__mobileActionBar');
    expect(source).toContain('coupon-center-page__mobileActionBar--single');
    expect(source).toContain("t('pages.coupons.nextActionEyebrow')");
    expect(source).toContain("t('pages.coupons.claimTitle')");
    expect(source).toContain("t('pages.coupons.myCoupons')");
  });

  it('keeps mobile coupon rails in document flow instead of sticky overlap layers', () => {
    const css = readCouponCenterCss();
    const f2721Start = css.indexOf('F2721:');
    const priorBottomAwareRule = css.indexOf('UI issues pass: loosen mobile coupon density');
    const f2721Css = css.slice(f2721Start, css.indexOf('Android UI closure', f2721Start));

    expect(f2721Start).toBeGreaterThan(priorBottomAwareRule);
    expect(f2721Css).toContain('@media (max-width: 560px)');
    expect(f2721Css).toMatch(/\.coupon-center-page\s*\{[^}]*padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*24px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f2721Css).toMatch(/\.coupon-center-page__quickNav,\s*\.coupon-center-page__mobileActionBar\s*\{[^}]*position:\s*static\s*!important;[^}]*inset:\s*auto\s*!important;[^}]*z-index:\s*auto\s*!important;[^}]*width:\s*100%\s*!important;[^}]*transform:\s*none\s*!important;/);
    expect(f2721Css).toMatch(/\.coupon-center-page__quickNav\s*\{[^}]*display:\s*grid\s*!important;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[^}]*padding:\s*0\s*!important;/);
    expect(f2721Css).toMatch(/\.coupon-center-page__mobileActionBar\s*\{[^}]*display:\s*grid\s*!important;[^}]*border-radius:\s*8px\s*!important;/);
  });

  it('does not reintroduce sticky or fixed coupon rails after the F2721 guard', () => {
    const css = readCouponCenterCss();
    const afterF2721Guard = css.slice(css.indexOf('Android UI closure'));

    expect(afterF2721Guard).not.toMatch(/\.coupon-center-page__(quickNav|mobileActionBar)[^{]*\{[^}]*position:\s*(sticky|fixed)/);
    expect(afterF2721Guard).not.toMatch(/\.coupon-center-page__mobileActionBar\s*\{[^}]*bottom:\s*calc/);
  });

  it('keeps guest coupon claim actions routed through login feedback', () => {
    const source = readCouponCenterSource();
    const singleClaimStart = source.indexOf('const claimCoupon = async');
    const claimAllStart = source.indexOf('const claimAllCoupons = async');
    const claimAllEnd = source.indexOf('const targetThreshold =');
    const singleClaimSource = source.slice(singleClaimStart, claimAllStart);
    const claimAllSource = source.slice(claimAllStart, claimAllEnd);

    expect(singleClaimStart).toBeGreaterThan(-1);
    expect(claimAllStart).toBeGreaterThan(singleClaimStart);
    expect(singleClaimSource).toContain('if (!isAuthenticated)');
    expect(singleClaimSource).toContain("message.warning(t('messages.loginRequired'))");
    expect(singleClaimSource).toContain('navigate(buildLoginUrlFromWindow())');
    expect(claimAllSource).toContain('if (!isAuthenticated)');
    expect(claimAllSource).toContain("message.warning(t('messages.loginRequired'))");
    expect(claimAllSource).toContain('navigate(buildLoginUrlFromWindow())');
  });
});

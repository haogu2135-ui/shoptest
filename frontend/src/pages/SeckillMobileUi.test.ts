import fs from 'fs';
import path from 'path';

const pageSource = () => fs.readFileSync(path.resolve(__dirname, 'Seckill.tsx'), 'utf8');
const styleSource = () => fs.readFileSync(path.resolve(__dirname, 'Seckill.css'), 'utf8');

describe('Seckill mobile purchase surface', () => {
  it('keeps focus and background scroll inside the purchase dialog', () => {
    const source = pageSource();

    expect(source).toContain('document.body.style.overflow = \'hidden\';');
    expect(source).toContain('document.body.style.overflow = previousBodyOverflow;');
    expect(source).toContain('document.addEventListener(\'keydown\', trapFocus);');
    expect(source).toContain('last.focus({ preventScroll: true });');
    expect(source).toContain('first.focus({ preventScroll: true });');
    expect(source).toContain('previouslyFocused?.focus({ preventScroll: true });');
    expect(source).toContain('submitLoadingRef.current');
    expect(source).toContain('role="dialog" aria-modal="true"');
    expect(source).toContain('shop-seckill-purchase-open');
    expect(source).toContain('document.body.classList.add(SECKILL_PURCHASE_BODY_CLASS);');
    expect(source).toContain('document.body.classList.remove(SECKILL_PURCHASE_BODY_CLASS);');
  });

  it('keeps the mobile modal scrollable and safe-area aware', () => {
    const css = styleSource();

    expect(css).toContain('overscroll-behavior: contain;');
    expect(css).toContain('touch-action: pan-y;');
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
    expect(css).toContain('min-height: 100dvh;');
    expect(css).toContain('z-index: 10010;');
    expect(css).toContain('padding-bottom: calc(var(--shop-mobile-bottom-nav-height, 72px) + 24px + env(safe-area-inset-bottom, 0px));');
    expect(css).toContain('scroll-padding-bottom: calc(var(--shop-mobile-bottom-nav-height, 72px) + 32px + env(safe-area-inset-bottom, 0px));');
    expect(css).toContain('body.shop-seckill-purchase-open .cookie-consent-banner');
    expect(css).toContain('display: none !important;');
  });

  it('keeps purchase fields aligned with the backend validation contract', () => {
    const source = pageSource();

    expect(source).toContain('aria-required="true" required maxLength={120}');
    expect(source).toContain('aria-required="true" required maxLength={40}');
    expect(source).toContain('aria-required="true" required maxLength={2000}');
    expect(source).toContain('maxLength={160}');
    expect(source).toContain('pattern="^(?=(?:.*\\d){6,20})');
  });

  it('renders safe campaign banners and resilient product media', () => {
    const source = pageSource();
    const css = styleSource();

    expect(source).toContain('resolveApiAssetUrl(campaign.bannerUrl)');
    expect(source).toContain('className="seckill-campaign__banner"');
    expect(source).toContain('resolveProductImage(item.imageUrl)');
    expect(source).toContain('productImageFallback');
    expect(css).toContain('.seckill-campaign__banner img');
    expect(css).toContain('object-fit: cover;');
  });
});

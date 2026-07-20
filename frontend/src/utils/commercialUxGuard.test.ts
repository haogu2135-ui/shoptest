import fs from 'fs';
import path from 'path';

const readFrontend = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

describe('commercial UX contracts', () => {
  it('keeps auth and checkout forms on realtime validation with required marks', () => {
    const register = readFrontend('pages', 'Register.tsx');
    const login = readFrontend('pages', 'Login.tsx');
    const checkout = readFrontend('pages', 'Checkout.tsx');

    expect(register).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(register).toContain('requiredMark');
    expect(login).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(login).toContain("validateTrigger={['onChange', 'onBlur']}");
    expect(checkout).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(checkout).toContain('requiredMark');

    const forgotPassword = readFrontend('pages', 'ForgotPassword.tsx');
    expect(forgotPassword).toContain('validateTrigger={["onChange", "onBlur"]}');
    expect(forgotPassword).toContain('requiredMark');
  });

  it('keeps product detail deep links for reviews/Q&A anchors', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain("id=\"product-reviews-card\"");
    expect(productDetail).toContain("id=\"product-qa-card\"");
    expect(productDetail).toContain("id=\"product-service-tabs\"");
    expect(productDetail).toContain("hash === 'reviews'");
    expect(productDetail).toContain("hash === 'qa'");
  });

  it('keeps storefront discovery infinite scroll screen-reader friendly', () => {
    const home = readFrontend('pages', 'Home.tsx');
    expect(home).toContain('home.discoveryShowing');
    expect(home).toContain('home.discoveryLoadMore');
    expect(home).toContain('aria-live="polite"');
    expect(home).toContain('role="list"');
    expect(home).toContain('role="listitem"');
  });

  it('keeps cart free-shipping progress and trust signals commercial-ready', () => {
    const cart = readFrontend('pages', 'Cart.tsx');
    expect(cart).toContain('pages.cart.freeShippingProgressLabel');
    expect(cart).toContain('cart-page__trustBar');
    expect(cart).toContain('pages.cart.trustSecureTitle');
    expect(cart).toContain('aria-live="polite"');
  });

  it('keeps product gallery autoplay pausable for keyboard users', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    expect(productDetail).toContain('product-gallery-controls__pause');
    expect(productDetail).toContain('pages.productDetail.galleryPause');
    expect(productDetail).toContain('pages.productDetail.galleryPlay');
    expect(productDetail).toContain('aria-pressed={imagePaused}');
  });
});

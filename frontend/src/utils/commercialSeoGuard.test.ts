import fs from 'fs';
import path from 'path';

const readFrontend = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');

describe('commercial SEO contracts', () => {
  it('keeps storefront pages on document meta + structured data utilities', () => {
    const home = readFrontend('pages', 'Home.tsx');
    const productList = readFrontend('pages', 'ProductList.tsx');
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const couponCenter = readFrontend('pages', 'CouponCenter.tsx');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');

    expect(home).toContain("from '../hooks/useDocumentMeta'");
    expect(home).toContain('buildWebsiteStructuredData');
    expect(home).toContain("jsonLdId: 'website-home'");

    expect(productList).toContain("from '../hooks/useDocumentMeta'");
    expect(productList).toContain('pages.productList.seoDescription');
    expect(productList).toContain('buildItemListStructuredData');
    expect(productList).toContain('product-list__checkoutPathThumb');
    expect(productList).toContain('loading="lazy"');

    expect(productDetail).toContain('buildProductStructuredData');
    expect(productDetail).toContain('buildBreadcrumbStructuredData');
    expect(productDetail).toContain("type: product ? 'product' : 'website'");

    expect(couponCenter).toContain('pages.coupons.seoDescription');
    expect(couponCenter).toContain('useDocumentMeta');

    expect(indexHtml).toContain('property="og:image"');
    expect(indexHtml).toContain('name="twitter:image"');
    expect(indexHtml).toContain('images.unsplash.com');
    expect(indexHtml).toContain('rel="preconnect"');
    expect(indexHtml).toContain('assets/home/hero-mobile-pet.jpg');
    expect(indexHtml).toContain('assets/home/hero-dog.jpg');
  });

  it('keeps JSON-LD serialization XSS-safe', () => {
    const source = readFrontend('utils', 'documentMeta.ts');
    expect(source).toContain(".replace(/</g, '\\\\u003c')");
  });

  it('keeps public legal pages indexable with document meta', () => {
    const legal = readFrontend('pages', 'LegalPage.tsx');
    expect(legal).toContain('useDocumentMeta');
    expect(legal).toContain("const path = isTerms ? '/terms' : '/privacy'");
    expect(legal).toContain('path,');
    expect(legal).not.toContain('noIndex: true');
  });

  it('keeps private commerce routes noindexed', () => {
    [
      'Cart.tsx',
      'Checkout.tsx',
      'Profile.tsx',
      'PaymentInstructions.tsx',
      'Login.tsx',
      'Register.tsx',
      'ForgotPassword.tsx',
      'Wishlist.tsx',
      'OrderTracking.tsx',
      'NotFound.tsx',
      'Notifications.tsx',
      'BrowsingHistory.tsx',
      'StockAlerts.tsx',
      'ProductCompare.tsx',
    ].forEach((page) => {
      const source = readFrontend('pages', page);
      expect(source).toContain('useDocumentMeta');
      expect(source).toContain('noIndex: true');
    });
  });

  it('keeps private commerce routes out of robots.txt and public sitemap', () => {
    const robots = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'robots.txt'), 'utf8');
    const sitemap = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'sitemap.xml'), 'utf8');

    [
      '/cart',
      '/checkout',
      '/profile',
      '/login',
      '/register',
      '/wishlist',
      '/admin',
      '/payment',
      '/history',
      '/stock-alerts',
      '/compare',
    ].forEach((route) => {
      expect(robots).toContain(`Disallow: ${route}`);
      expect(sitemap).not.toContain(route);
    });

    expect(robots).toContain('Sitemap:');
    expect(sitemap).toContain('/products');
    expect(sitemap).toContain('/coupons');
    expect(sitemap).toContain('/privacy');
    expect(sitemap).toContain('/terms');
    expect(robots).toContain('Allow: /privacy');
    expect(robots).toContain('Allow: /terms');
  });

  it('keeps product detail and profile tabs URL-synced for shareable commercial deep links', () => {
    const productDetail = readFrontend('pages', 'ProductDetail.tsx');
    const profile = readFrontend('pages', 'Profile.tsx');

    expect(productDetail).toContain('useSearchParams');
    expect(productDetail).toContain('normalizeProductDetailTab');
    expect(productDetail).toContain('openProductDetailTab');
    expect(productDetail).toContain("activeKey={detailActiveTab}");
    expect(productDetail).toContain("key: 'details'");
    expect(productDetail).toContain("key: 'specs'");
    expect(productDetail).toContain("key: 'service'");
    expect(productDetail).not.toContain('defaultActiveKey="1"');

    expect(profile).toContain('syncProfileTabToUrl');
    expect(profile).toContain('onChange={openProfileTab}');
    expect(profile).not.toContain('onChange={setProfileActiveTab}');
  });
});

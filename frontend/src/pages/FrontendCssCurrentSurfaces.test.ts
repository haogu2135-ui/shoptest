import fs from 'fs';
import path from 'path';

const pageDir = __dirname;
const srcDir = path.resolve(__dirname, '..');

const readPageCss = (filename: string) => fs.readFileSync(path.resolve(pageDir, filename), 'utf8');
const readSource = (relativePath: string) => fs.readFileSync(path.resolve(srcDir, relativePath), 'utf8');

describe('frontend current page CSS surface contracts', () => {
  it('keeps stale legacy CSS/page paths out of the active frontend source', () => {
    const stalePageFiles = [
      'AppDownload.tsx',
      'AppDownload.css',
      'Coupons.tsx',
      'Coupons.css',
      'Orders.tsx',
      'Orders.css',
      'PetMissing.tsx',
      'PetMissing.css',
      'Support.tsx',
      'Support.css',
    ];
    const appSource = readSource('App.tsx');

    stalePageFiles.forEach((filename) => {
      expect(fs.existsSync(path.resolve(pageDir, filename))).toBe(false);
    });
    expect(appSource).not.toMatch(/import\('\.\/pages\/(?:AppDownload|Coupons|Orders|PetMissing|Support)'\)/);
    expect(appSource).not.toMatch(/from ['"]\.\/pages\/(?:AppDownload|Coupons|Orders|PetMissing|Support)['"]/);
  });

  it('keeps the current replacement CSS surfaces responsive', () => {
    const responsiveCssFiles = [
      'Home.css',
      'CouponCenter.css',
      'CouponManagement.css',
      'OrderTracking.css',
      'OrderManagement.css',
      'PetGallery.css',
      'SupportManagement.css',
    ];

    responsiveCssFiles.forEach((filename) => {
      const css = readPageCss(filename);

      expect(css).toMatch(/@media\s*\((?:max|min)-width:/);
    });
  });

  it('does not reintroduce the stale Coupons.css antd override file', () => {
    const staleCouponsCssPath = path.resolve(pageDir, 'Coupons.css');
    const couponCenterSource = readSource('pages/CouponCenter.tsx');
    const couponManagementSource = readSource('pages/CouponManagement.tsx');

    expect(fs.existsSync(staleCouponsCssPath)).toBe(false);
    expect(couponCenterSource).toContain("import './CouponCenter.css';");
    expect(couponManagementSource).toContain("import './CouponManagement.css';");
    expect(couponCenterSource).not.toContain("import './Coupons.css';");
    expect(couponManagementSource).not.toContain("import './Coupons.css';");
  });

  it('keeps current order CSS free of stale local theme variable overrides', () => {
    const staleOrdersCssPath = path.resolve(pageDir, 'Orders.css');
    const orderManagementSource = readSource('pages/OrderManagement.tsx');
    const orderTrackingSource = readSource('pages/OrderTracking.tsx');
    const currentOrderCss = [
      readPageCss('OrderManagement.css'),
      readPageCss('OrderTracking.css'),
    ].join('\n');

    expect(fs.existsSync(staleOrdersCssPath)).toBe(false);
    expect(orderManagementSource).toContain("import './OrderManagement.css';");
    expect(orderTrackingSource).toContain("import './OrderTracking.css';");
    expect(orderManagementSource).not.toContain("import './Orders.css';");
    expect(orderTrackingSource).not.toContain("import './Orders.css';");
    expect(currentOrderCss).not.toMatch(/--(?:card-shadow|background|text-primary|text-secondary|border|text-tertiary)\s*:/);
  });

  it('keeps current order CSS free of stale webkit-only left gradient syntax', () => {
    const currentOrderCss = [
      readPageCss('OrderManagement.css'),
      readPageCss('OrderTracking.css'),
    ].join('\n');

    expect(currentOrderCss).not.toMatch(/-webkit-linear-gradient\(\s*left\s*,/);
  });

  it('keeps current coupon pagination free of stale global font-size important overrides', () => {
    const currentCouponCss = [
      readPageCss('CouponCenter.css'),
      readPageCss('CouponManagement.css'),
    ].join('\n');

    expect(currentCouponCss).not.toMatch(/\.ant-pagination[^{]*\{[^}]*font-size:\s*[^;]+!important/);
  });

  it('keeps Home.css free of stale body background debug overrides', () => {
    const homeCss = readPageCss('Home.css');

    expect(homeCss).not.toMatch(/(^|})\s*body\s*\{[^}]*background:\s*var\(--background\)\s*!important/);
  });

  it('keeps page and mobile CSS fallback backgrounds off third-party image hosts', () => {
    const cssFiles = [
      ...fs.readdirSync(pageDir)
        .filter((filename) => filename.endsWith('.css'))
        .map((filename) => path.resolve(pageDir, filename)),
      path.resolve(srcDir, 'mobile-app.css'),
    ];
    const combinedCss = cssFiles.map((filename) => fs.readFileSync(filename, 'utf8')).join('\n');

    expect(combinedCss).not.toMatch(/url\(['"]?https:\/\/images\.unsplash\.com/i);
    expect(combinedCss).not.toMatch(/url\(['"]?\/assets\/placeholders\//i);
    expect(combinedCss).not.toContain('unsplash.com');
  });
});

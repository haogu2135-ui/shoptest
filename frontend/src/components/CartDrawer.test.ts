import fs from 'fs';
import path from 'path';

const readCartDrawerSource = () => fs.readFileSync(path.resolve(__dirname, 'CartDrawer.tsx'), 'utf8');
const readCartDrawerCss = () => fs.readFileSync(path.resolve(__dirname, 'CartDrawer.css'), 'utf8');

describe('CartDrawer mobile overlay and trust-row contracts', () => {
  it('scopes the drawer root for mobile overlay stacking', () => {
    const source = readCartDrawerSource();
    const css = readCartDrawerCss();
    const f2756Css = css.slice(css.indexOf('F2756:'));

    expect(source).toContain('rootClassName="cart-drawer__root"');
    expect(f2756Css).toMatch(/\.cart-drawer__root\.ant-drawer\s*\{[^}]*z-index:\s*9500\s*!important;/);
    expect(f2756Css).toMatch(/\.cart-drawer__root \.ant-drawer-mask\s*\{[^}]*z-index:\s*9500\s*!important;[^}]*background:/);
    expect(f2756Css).toMatch(/\.cart-drawer__root \.ant-drawer-content-wrapper\s*\{[^}]*z-index:\s*9501\s*!important;/);
    expect(f2756Css).toMatch(/body\.shop-mobile-app \.cart-drawer__root\.ant-drawer\s*\{[^}]*z-index:\s*9900\s*!important;/);
  });

  it('keeps compact trust labels as readable full-width rows', () => {
    const css = readCartDrawerCss();
    const f2756Css = css.slice(css.indexOf('F2756:'));

    expect(f2756Css).toContain('@media (max-width: 380px)');
    expect(f2756Css).toMatch(/\.cart-drawer__root \.cart-drawer__trustRow\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*overflow:\s*visible;[^}]*mask-image:\s*none;/);
    expect(f2756Css).toMatch(/\.cart-drawer__root \.cart-drawer__trustRow span\s*\{[^}]*justify-content:\s*flex-start;[^}]*white-space:\s*normal;[^}]*word-break:\s*normal;/);
  });
});

import fs from 'fs';
import path from 'path';

const readCartDrawerSource = () => fs.readFileSync(path.resolve(__dirname, 'CartDrawer.tsx'), 'utf8');
const readCartDrawerCss = () => fs.readFileSync(path.resolve(__dirname, 'CartDrawer.css'), 'utf8');

describe('CartDrawer mobile overlay and trust-row contracts', () => {
  it('scopes the drawer root for mobile overlay stacking', () => {
    const source = readCartDrawerSource();
    const css = readCartDrawerCss();
    const f2756Css = css.slice(css.indexOf('F2756:'));

    expect(source).toMatch(/rootClassName=\{`cart-drawer__root\$\{open \? ' cart-drawer__root--open' : ''\}`\}|rootClassName="cart-drawer__root"/);
    expect(source).toContain('width="min(420px, 100%)"');
    expect(source).not.toContain('width="min(420px, 100vw)"');
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

  it('keeps the mobile drawer wrapper from using scrollbar-inclusive viewport width', () => {
    const css = readCartDrawerCss();
    const drawerWrapperRules = Array.from(
      css.matchAll(/\.cart-drawer \.ant-drawer-content-wrapper\s*\{(?<rules>[^}]*)\}/g),
      (match) => match.groups?.rules ?? '',
    );

    expect(drawerWrapperRules.length).toBeGreaterThan(0);
    drawerWrapperRules.forEach((rules) => {
      expect(rules).toContain('width: 100% !important;');
      expect(rules).toContain('max-width: 100%;');
      expect(rules).not.toContain('100vw');
    });
  });

  it('keeps stale authenticated cart snapshots non-mutating until refresh succeeds', () => {
    const source = readCartDrawerSource();

    expect(source).toContain('const hasStaleCartData = Boolean(loadError && items.length > 0);');
    expect(source).toContain("message.warning(t('pages.cart.staleDataWarning'))");
    expect(source).toContain("title: t('pages.cart.nextActionRefreshTitle')");
    expect(source).toContain("label: t('common.retry')");
    expect(source).toContain('!hasStaleCartData ? (');
    expect(source).toContain('disabled={savingForLaterIds[item.id] || hasStaleCartData}');
    expect(source).toContain('disabled={hasStaleCartData}');
    expect(source).toContain('disabled={!isAvailable(item) || hasStaleCartData}');
    expect(source).toContain('disabled={checkoutItems.length === 0 || checkoutSubmitting || hasStaleCartData}');
    expect(source).toContain('disabled={!drawerReady || checkoutSubmitting}');
    expect(source).toContain('if (hasStaleCartData) {');
    expect(source).toContain('open && items.length > 0 && !hasStaleCartData');
  });
});

import fs from 'fs';
import path from 'path';

const readNotFoundSource = () => fs.readFileSync(path.resolve(__dirname, 'NotFound.tsx'), 'utf8');
const readNotFoundCss = () => fs.readFileSync(path.resolve(__dirname, 'NotFound.css'), 'utf8');

describe('NotFound mobile recovery layout contract', () => {
  it('renders primary home and product-search recovery actions', () => {
    const source = readNotFoundSource();

    expect(source).toContain('<main');
    expect(source).toContain('className="not-found-page"');
    expect(source).toContain('status="404"');
    expect(source).toContain("t('notFound.backHome')");
    expect(source).toContain("t('notFound.searchProducts')");
    expect(source).toContain("t('notFound.browseCoupons')");
    expect(source).toContain("t('notFound.trackOrder')");
    expect(source).toContain("t('notFound.hint')");
    expect(source).toContain("navigate('/')");
    expect(source).toContain("navigate('/products')");
    expect(source).toContain("navigate('/coupons')");
    expect(source).toContain("navigate('/track-order')");
  });

  it('exposes the 404 result as a named and described status region', () => {
    const source = readNotFoundSource();

    expect(source).toContain("const titleId = 'not-found-title';");
    expect(source).toContain("const subtitleId = 'not-found-subtitle';");
    expect(source).toContain('aria-label={title}');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('aria-describedby={subtitleId}');
    expect(source).toContain('title={<span id={titleId}>{title}</span>}');
    expect(source).toContain('id={subtitleId}');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('not-found-page__status');
    expect(source).toContain('not-found-page__hint');
  });

  it('reserves fixed bottom-nav clearance for mobile recovery buttons', () => {
    const css = readNotFoundCss();
    const mobileCss = css.slice(
      css.indexOf('@media (max-width: 640px) {'),
      css.indexOf('@media (max-width: 640px) and (max-height: 760px)'),
    );

    expect(mobileCss).toMatch(/\.not-found-page\s*\{[^}]*min-height:\s*calc\(100svh - var\(--shop-mobile-bottom-nav-height,\s*76px\)\);[^}]*padding:\s*18px 12px calc\(104px \+ env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(mobileCss).toMatch(/\.not-found-page \.ant-result-extra\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*gap:\s*10px;/);
    expect(mobileCss).toMatch(/\.not-found-page \.ant-result-extra \.ant-btn\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*44px;[^}]*touch-action:\s*manipulation;/);
  });

  it('compresses vertical spacing on short mobile viewports before the buttons hit the nav', () => {
    const css = readNotFoundCss();
    const shortViewportCss = css.slice(css.indexOf('@media (max-width: 640px) and (max-height: 760px)'));

    expect(shortViewportCss).toMatch(/\.not-found-page\s*\{[^}]*padding-top:\s*10px;/);
    expect(shortViewportCss).toMatch(/\.not-found-page \.ant-result\s*\{[^}]*padding-top:\s*8px;/);
    expect(shortViewportCss).toMatch(/\.not-found-page \.ant-result-icon\s*\{[^}]*width:\s*min\(210px,\s*62vw\);/);
    expect(shortViewportCss).toMatch(/\.not-found-page \.ant-result-title\s*\{[^}]*font-size:\s*26px;/);
    expect(shortViewportCss).toMatch(/\.not-found-page \.ant-result-extra\s*\{[^}]*margin-top:\s*14px;/);
  });
});

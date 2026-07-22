import fs from 'fs';
import path from 'path';

const readProductCompareCss = () => fs.readFileSync(path.resolve(__dirname, 'ProductCompare.css'), 'utf8');
const readProductCompareSource = () => fs.readFileSync(path.resolve(__dirname, 'ProductCompare.tsx'), 'utf8');

const extractCssRulesFor = (css: string, selectorPart: string) => (
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, selector]) => selector.includes(selectorPart))
    .map(([, selector, body]) => `${selector.trim()} {${body}}`)
);

describe('ProductCompare responsive CSS', () => {
  it('keeps mobile decision metrics in a visible two-by-two grid', () => {
    const css = readProductCompareCss();
    const decisionGridRules = extractCssRulesFor(css, '.product-compare__decisionGrid').join('\n');
    const decisionItemRules = extractCssRulesFor(css, '.product-compare__decisionItem').join('\n');

    expect(decisionGridRules).toMatch(
      /\.product-compare__decisionGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*overflow:\s*visible;[^}]*scroll-snap-type:\s*none;/,
    );
    expect(decisionGridRules).not.toMatch(/display:\s*flex/);
    expect(decisionGridRules).not.toMatch(/overflow-x:\s*auto/);
    expect(decisionGridRules).not.toMatch(/scrollbar-width:\s*none/);
    expect(decisionGridRules).not.toMatch(/mask-image:/);
    expect(decisionGridRules).not.toMatch(/touch-action:\s*pan-x/);
    expect(decisionItemRules).not.toMatch(/flex-basis|flex:\s*0\s+0|scroll-snap-align/);
  });

  it('keeps mobile header actions readable instead of truncating three primary labels', () => {
    const css = readProductCompareCss();
    const f2714Start = css.lastIndexOf('F2714: mobile comparison primary actions must keep full readable labels.');
    const f2714Css = css.slice(f2714Start);

    expect(f2714Start).toBeGreaterThan(css.indexOf('Final mobile compare action stability pass'));
    expect(f2714Css).toMatch(/@media \(max-width:\s*600px\)\s*\{/);
    expect(f2714Css).toMatch(/\.product-compare__headerActions\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?gap:\s*8px\s*!important;/);
    expect(f2714Css).toMatch(/\.product-compare__headerActions \.ant-space-item:last-child\s*\{[\s\S]*?grid-column:\s*1 \/ -1\s*!important;/);
    expect(f2714Css).toMatch(/\.product-compare__headerActions \.ant-btn\s*\{[\s\S]*?min-height:\s*46px\s*!important;[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2714Css).toMatch(/\.product-compare__headerActions \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)\s*\{[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?text-overflow:\s*clip\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2714Css).toMatch(/@media \(max-width:\s*360px\)\s*\{[\s\S]*?\.product-compare__headerActions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f2714Css).not.toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(f2714Css).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe('ProductCompare stale data guards', () => {
  it('blocks stock-dependent cart and selection actions after compare hydration fails', () => {
    const source = readProductCompareSource();

    expect(source).toContain('const compareActionsDisabled = compareLoadError;');
    expect(source).toContain("announceAccessibleMessage(t('pages.compare.staleDataWarning'), 'warning')");
    expect(source).toContain('disabled={isSoldOut || compareActionsDisabled}');
    expect(source).toContain('disabled={directReadyProducts.length === 0 || compareActionsDisabled}');
    expect(source.match(/disabled=\{compareActionsDisabled\}/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

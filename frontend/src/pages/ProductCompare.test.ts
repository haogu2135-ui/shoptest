import fs from 'fs';
import path from 'path';

const readProductCompareCss = () => fs.readFileSync(path.resolve(__dirname, 'ProductCompare.css'), 'utf8');

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
});

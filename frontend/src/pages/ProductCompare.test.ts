import fs from 'fs';
import path from 'path';

const readProductCompareCss = () => fs.readFileSync(path.resolve(__dirname, 'ProductCompare.css'), 'utf8');
const readProductComparePage = () => fs.readFileSync(path.resolve(__dirname, 'ProductCompare.tsx'), 'utf8');
const readProductCompareSource = () => [
  readProductComparePage(),
  fs.readFileSync(path.resolve(__dirname, 'productCompareHelpers.ts'), 'utf8'),
  fs.readFileSync(path.resolve(__dirname, 'productComparePanels.tsx'), 'utf8'),
].join('\n');

const extractCssRulesFor = (css: string, selectorPart: string) => (
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, selector]) => selector.includes(selectorPart))
    .map(([, selector, body]) => `${selector.trim()} {${body}}`)
);

describe('ProductCompare responsive CSS', () => {
  it('keeps empty comparison recovery actions above first-visit consent', () => {
    const css = readProductCompareCss();
    const consentRuleStart = css.indexOf('Keep empty comparison recovery actions above first-visit consent.');
    const consentRule = css.slice(consentRuleStart);

    expect(consentRuleStart).toBeGreaterThanOrEqual(0);
    expect(consentRule).toMatch(/@media \(max-width:\s*780px\)/);
    expect(consentRule).toMatch(/body\.shop-cookie-consent-visible:has\(\.product-compare-page\) \.product-compare__emptyPanel \.page-feedback__emptyImage\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(consentRule).toMatch(/body\.shop-cookie-consent-visible:has\(\.product-compare-page\) \.product-compare__emptyPanel \.page-feedback__actions\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  });

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

describe('ProductCompare modularization', () => {
  it('keeps product compare helpers and panels modularized outside the page shell', () => {
    const page = readProductComparePage();
    const helpers = fs.readFileSync(path.resolve(__dirname, 'productCompareHelpers.ts'), 'utf8');
    const panels = fs.readFileSync(path.resolve(__dirname, 'productComparePanels.tsx'), 'utf8');
    expect(page).toContain("from './productCompareHelpers'");
    expect(page).toContain("from './productComparePanels'");
    expect(page).toContain('<ProductCompareMainPanels');
    expect(page).not.toContain('product-compare__decisionGrid');
    expect(page).not.toContain('data-compare-empty-actions');
    expect(helpers).toContain('export const buildCompareDecision');
    expect(helpers).toContain('export const getPrice');
    expect(helpers).toContain('export const collectCompareSpecKeys');
    expect(panels).toContain('export const ProductCompareMainPanels');
    expect(panels).toContain('product-compare__decisionGrid');
    expect(panels).toContain('data-compare-empty-actions');
    expect(panels).toContain('data-compare-load-recovery');
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

describe('ProductCompare unmount and stale response guards', () => {
  it('guards compare fetch setState calls against unmount and superseded responses', () => {
    const page = readProductComparePage();

    expect(page).toContain('const mountedRef = useRef(true);');
    expect(page).toContain('const compareFetchSeqRef = useRef(0);');
    expect(page).toContain('const requestSeq = compareFetchSeqRef.current + 1;');
    expect(page).toContain('compareFetchSeqRef.current = requestSeq;');
    expect(page).toMatch(/const isCurrentRequest = \(\) => mountedRef\.current\s*&& compareFetchSeqRef\.current === requestSeq\s*&& !abortController\.signal\.aborted;/);
    expect(page).toContain('mountedRef.current = false;');
    expect(page).toContain('compareFetchSeqRef.current += 1;');
    expect(page).toMatch(/const response = await productApi\.getByIds\(ids, \{ signal: abortController\.signal \}\);\s*\n\s*if \(!isCurrentRequest\(\)\) return;/);
    expect(page).toMatch(/if \(isCurrentRequest\(\)\) \{\s*\n\s*setLoading\(false\);/);

    // In-flight compare fetches are aborted instead of left running after
    // unmount or after a newer fetch supersedes them.
    expect(page).toContain('const compareAbortRef = useRef<AbortController | null>(null);');
    expect(page).toContain('const abortController = createApiAbortController();');
    expect(page).toMatch(/compareFetchSeqRef\.current \+= 1;\s*compareAbortRef\.current\?\.abort\(\);/);
    // Aborted/superseded fetches must not be reported as page errors.
    expect(page).toMatch(/if \(!isCurrentRequest\(\)\) return;\s*reportNonBlockingError\('ProductCompare\.fetchComparedProducts', error\);/);
  });
});

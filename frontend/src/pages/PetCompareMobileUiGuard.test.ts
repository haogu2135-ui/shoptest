const fs = require('fs');
const path = require('path');

const readPageCss = (filename: string): string => (
  fs.readFileSync(path.resolve(__dirname, filename), 'utf8')
);

const cssBlock = (source: string, selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`, 'm'));
  return match ? match[0] : '';
};

export {};

describe('pet tool and compare mobile UI guards', () => {
  it('keeps the Android pet/compare eyebrow labels readable', () => {
    const petFinderCss = readPageCss('PetFinder.css');
    const petGalleryCss = readPageCss('PetGallery.css');
    const productCompareCss = readPageCss('ProductCompare.css');

    expect(petFinderCss).not.toMatch(/\.pet-finder-page__eyebrow\s*\{[^}]*font-size:\s*11px/);
    expect(petGalleryCss).not.toMatch(/\.pet-gallery-insights__eyebrow\s*\{[^}]*font-size:\s*11px/);
    expect(productCompareCss).not.toMatch(/\.product-compare__eyebrow\s*\{[^}]*font-size:\s*11px/);

    expect(petFinderCss).toMatch(/\.pet-finder-page__eyebrow\s*\{[^}]*font-size:\s*12px/);
    expect(petGalleryCss).toMatch(/\.pet-gallery-insights__eyebrow\s*\{[^}]*font-size:\s*12px/);
    expect(productCompareCss).toMatch(/\.product-compare__eyebrow\s*\{[^}]*font-size:\s*12px/);
  });

  it('keeps 430px compare header actions full-width without clipped text', () => {
    const productCompareCss = readPageCss('ProductCompare.css');
    const mobileOverrideStart = productCompareCss.lastIndexOf('@media (max-width: 430px)');
    const mobileOverride = productCompareCss.slice(mobileOverrideStart);

    expect(mobileOverrideStart).toBeGreaterThan(-1);
    expect(cssBlock(mobileOverride, '.product-compare__headerActions')).toContain('grid-template-columns: 1fr !important');
    expect(cssBlock(mobileOverride, '.product-compare__headerActions .ant-btn')).toContain('min-height: 44px');
    expect(cssBlock(mobileOverride, '.product-compare__headerActions .ant-btn')).toContain('white-space: normal');
    expect(cssBlock(mobileOverride, '.product-compare__headerActions .ant-btn > span:not(.anticon):not(.ant-btn-icon)')).toContain('text-overflow: clip');
    expect(cssBlock(mobileOverride, '.product-compare__headerActions .ant-btn > span:not(.anticon):not(.ant-btn-icon)')).not.toContain('text-overflow: ellipsis');
  });
});

import fs from 'fs';
import path from 'path';

const readProductDetailSource = () => fs.readFileSync(path.resolve(__dirname, 'ProductDetail.tsx'), 'utf8');
const readProductDetailCss = () => fs.readFileSync(path.resolve(__dirname, 'ProductDetail.css'), 'utf8');

describe('ProductDetail size guide modal layout', () => {
  it('keeps short landscape size-guide instructions visible above the footer', () => {
    const source = readProductDetailSource();
    const css = readProductDetailCss();
    const fixCss = css.slice(css.indexOf('F3414:'));

    expect(source).toContain('product-detail__sizeGuideModal');
    expect(source).toContain('ShopModal');
    expect(source).toContain('product-detail__sizeGuideModalRoot');
    expect(source).toContain('pet-size-guide');
    expect(fixCss).toContain('@media (max-width: 860px) and (max-height: 430px)');
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModalRoot \.product-detail__sizeGuideModal \.shop-modal__footer\s*\{[^}]*position:\s*static\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal \.pet-size-guide\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal \.pet-size-guide div:nth-child\(3\)\s*\{[^}]*grid-column:\s*1 \/ -1;/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModalRoot \.product-detail__sizeGuideModal \.shop-modal__body\s*\{[^}]*overflow-y:\s*auto\s*!important;[^}]*scroll-padding-bottom:\s*16px\s*!important;/);
  });

  it('bounds size calculator weight input and estimate value', () => {
    const source = readProductDetailSource();

    expect(source).toContain('const PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG = 200;');
    expect(source).toContain('Math.min(PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG, Math.max(0, numeric))');
    expect(source).toContain('const sizeCalculatorWeightKg = Math.min(\n    PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG,');
    expect(source).toContain('max={PRODUCT_SIZE_CALCULATOR_MAX_WEIGHT_KG}');
    expect(source).not.toContain('type="number"\n                        min={0}\n                        onChange=');
  });
});

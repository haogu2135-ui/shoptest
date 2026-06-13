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
    expect(source).toContain('pet-size-guide');
    expect(fixCss).toContain('@media (max-width: 860px) and (max-height: 430px)');
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal\.ant-modal:not\(\.ant-modal-confirm\) \.ant-modal-footer\s*\{[^}]*position:\s*static\s*!important;/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal \.pet-size-guide\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal \.pet-size-guide div:nth-child\(3\)\s*\{[^}]*grid-column:\s*1 \/ -1;/);
    expect(fixCss).toMatch(/\.product-detail__sizeGuideModal\.ant-modal:not\(\.ant-modal-confirm\) \.ant-modal-body\s*\{[^}]*overflow-y:\s*auto\s*!important;[^}]*scroll-padding-bottom:\s*16px\s*!important;/);
  });
});

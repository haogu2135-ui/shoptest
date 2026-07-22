import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'PetGalleryManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'PetGalleryManagement.css'), 'utf8');

describe('PetGalleryManagement delete confirmation guards', () => {
  it('uses a page-scoped body-mounted Popconfirm for destructive deletes', () => {
    expect(pageSource).toContain('<ShopPopconfirm');
    expect(pageSource).toContain("t('pages.petGalleryAdmin.deleteConfirmTarget', { photo: photoLabel })");
    expect(pageSource).toContain("t('pages.petGalleryAdmin.deleteDescriptionTarget'");
    expect(pageSource).toContain('rootClassName="shop-mobile-popup-layer pet-gallery-management-page__deletePopconfirm"');
    expect(pageSource).toContain("okText={t('common.delete')}");
    expect(pageSource).toContain("cancelText={t('common.cancel')}");
  });

  it('constrains long delete confirmation copy inside narrow admin viewports', () => {
    const f3523Start = cssSource.indexOf('/* F3523');
    const f3523Css = cssSource.slice(f3523Start);

    expect(f3523Start).toBeGreaterThanOrEqual(0);
    expect(f3523Css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?body\s+\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s*\{[\s\S]*?left:\s*max\(12px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;/);
    expect(f3523Css).toMatch(/body\s+\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s*\{[\s\S]*?right:\s*max\(12px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?width:\s*auto\s*!important;[\s\S]*?max-width:\s*calc\(100vw - 24px\)\s*!important;/);
    expect(f3523Css).toMatch(/\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popover-content,[\s\S]*?\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popconfirm-message-text\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3523Css).toMatch(/\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popconfirm-title,[\s\S]*?\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popconfirm-description\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/);
    expect(f3523Css).toMatch(/\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popconfirm-buttons\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*flex-end;[\s\S]*?gap:\s*8px;/);
    expect(f3523Css).toMatch(/\.pet-gallery-management-page__deletePopconfirm\.shop-mobile-popup-layer\s+\.ant-popconfirm-buttons\s+\.ant-btn\s*\{[\s\S]*?min-height:\s*38px;[\s\S]*?max-width:\s*100%;[\s\S]*?margin-inline-start:\s*0;[\s\S]*?white-space:\s*normal;/);
    expect(f3523Css).not.toMatch(/width:\s*7\d{2}px/);
    expect(f3523Css).not.toMatch(/white-space:\s*nowrap/);
  });
});

import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'AnnouncementManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'AnnouncementManagement.css'), 'utf8');

describe('AnnouncementManagement scheduling popup guards', () => {
  it('formats summary status timestamps with the active app locale', () => {
    expect(pageSource).toContain('checkedAt.toLocaleString(dateLocale)');
    expect(pageSource).not.toContain('checkedAt.toLocaleString()');
  });

  it('uses ShopDatePicker with showTime for both editor schedule fields', () => {
    expect(pageSource).toContain('ShopDatePicker');
    expect(pageSource).toContain('className="profile-mobile-safe-modal announcement-management-page__editorModal"');
    expect(pageSource).toContain('name="startsAt"');
    expect(pageSource).toContain('name="endsAt"');
    expect(pageSource.match(/<ShopDatePicker/g)).toHaveLength(2);
    expect(pageSource.match(/showTime/g)?.length).toBeGreaterThanOrEqual(2);
    expect(pageSource).not.toMatch(/import \{[^}]*\bDatePicker\b[^}]*\} from 'antd'/);
    expect(pageSource).not.toMatch(/<DatePicker\b/);
    expect(pageSource).not.toContain('getPopupContainer={() => document.body}');
  });

  it('pins the mobile date picker popup inside the visible viewport', () => {
    const f3521Start = cssSource.indexOf('/* F3521');
    const f3521Css = cssSource.slice(f3521Start);

    expect(f3521Start).toBeGreaterThanOrEqual(0);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?position:\s*fixed\s*!important;/);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?top:\s*max\(12px,\s*env\(safe-area-inset-top,\s*0px\)\)\s*!important;/);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;/);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?z-index:\s*2200\s*!important;/);
    expect(f3521Css).toMatch(/body\s+\.announcement-management-page__datePopup\.shop-mobile-popup-layer\s+\.ant-picker-panel-container\s*\{[\s\S]*?overflow:\s*auto\s*!important;/);
  });
});

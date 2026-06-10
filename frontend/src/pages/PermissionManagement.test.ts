import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'PermissionManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'PermissionManagement.css'), 'utf8');

describe('PermissionManagement role editor layout guards', () => {
  it('keeps role management API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (err: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(err, t('pages.permissions.fetchFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(err, t('messages.saveFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('err?.errorFields');
  });

  it('renders the long permission checklist inside the role editor modal', () => {
    expect(pageSource).toContain('className="profile-mobile-safe-modal permission-management-page__modal"');
    expect(pageSource).toContain('width={720}');
    expect(pageSource).toContain('ADMIN_PAGE_PERMISSIONS.map');
    expect(pageSource).toContain('className="permission-management-page__permissionGrid"');
    expect(pageSource).toContain('okButtonProps');
    expect(pageSource).toContain('cancelButtonProps');
  });

  it('keeps the role editor viewport bounded outside mobile breakpoints', () => {
    const f3518Start = cssSource.indexOf('/* F3518');
    const nextMobileMedia = cssSource.indexOf('@media (max-width: 720px)', f3518Start);
    const f3518Css = cssSource.slice(f3518Start, nextMobileMedia);

    expect(f3518Start).toBeGreaterThanOrEqual(0);
    expect(nextMobileMedia).toBeGreaterThan(f3518Start);
    expect(f3518Css).toMatch(/\.permission-management-page__modal\s*\{[\s\S]*?top:\s*max\(24px,\s*env\(safe-area-inset-top,\s*0px\)\);/);
    expect(f3518Css).toMatch(/\.permission-management-page__modal\s+\.ant-modal-content\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 48px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(f3518Css).toMatch(/\.permission-management-page__modal\s+\.ant-modal-content\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    expect(f3518Css).toMatch(/\.permission-management-page__modal\s+\.ant-modal-body\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-y:\s*auto;/);
    expect(f3518Css).toMatch(/\.permission-management-page__modal\s+\.ant-modal-footer\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0;/);
    expect(f3518Css).not.toContain('@media');
  });
});

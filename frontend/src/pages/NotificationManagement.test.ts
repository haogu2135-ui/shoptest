import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'NotificationManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'NotificationManagement.css'), 'utf8');

describe('NotificationManagement readiness checklist guards', () => {
  it('keeps broadcast API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.notificationAdmin.sendFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });

  it('renders all four broadcast readiness signals', () => {
    expect(pageSource).toContain('className="notification-readiness__checks"');
    expect(pageSource).toContain("t('pages.notificationAdmin.checkTitle')");
    expect(pageSource).toContain("t('pages.notificationAdmin.checkContent')");
    expect(pageSource).toContain("t('pages.notificationAdmin.checkLink')");
    expect(pageSource).toContain("t('pages.notificationAdmin.checkHook')");
    expect(pageSource).toContain('readinessSignals.readyCount}/4');
  });

  it('keeps readiness checks visible instead of a hidden mobile rail', () => {
    const f3519Start = cssSource.indexOf('/* F3519');
    const f3519Css = cssSource.slice(f3519Start);

    expect(f3519Start).toBeGreaterThanOrEqual(0);
    expect(f3519Css).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*?\.notification-readiness__checks\s*\{[\s\S]*?display:\s*grid\s*!important;/);
    expect(f3519Css).toMatch(/\.notification-readiness__checks\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(f3519Css).toMatch(/\.notification-readiness__checks\s*\{[\s\S]*?overflow-x:\s*visible;/);
    expect(f3519Css).toMatch(/\.notification-readiness__checks\s*\{[\s\S]*?scroll-snap-type:\s*none;/);
    expect(f3519Css).toMatch(/\.notification-readiness__checks\s*\{[\s\S]*?scrollbar-width:\s*auto;/);
    expect(f3519Css).toMatch(/\.notification-readiness__checks\s+\.ant-tag\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-height:\s*44px;/);
    expect(f3519Css).not.toMatch(/flex-wrap:\s*nowrap/);
    expect(f3519Css).not.toMatch(/overflow-x:\s*auto/);
    expect(f3519Css).not.toMatch(/scrollbar-width:\s*none/);
  });
});

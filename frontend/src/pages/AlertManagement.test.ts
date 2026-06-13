import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'AlertManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'AlertManagement.css'), 'utf8');

describe('AlertManagement responsive table guard', () => {
  it('keeps alert admin API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.alertAdmin.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.alertAdmin.selfCheckFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.alertAdmin.batchResolveFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
  });

  it('gives the primary alert column a readable width before horizontal table details', () => {
    expect(pageSource).toMatch(/title:\s*t\('pages\.alertAdmin\.alert'\),[\s\S]*?dataIndex:\s*'title',[\s\S]*?key:\s*'title',[\s\S]*?width:\s*320,[\s\S]*?className:\s*'alert-management__alertColumn'/);
    expect(pageSource).toContain('className="shop-admin-selection-table alert-management__table"');
    expect(pageSource).toContain('scroll={{ x: 1180 }}');
  });

  it('prevents alert titles from collapsing into vertical text on narrow admin shells', () => {
    const f2762Start = cssSource.indexOf('/* F2762: keep primary alert titles readable inside the mobile/tablet table. */');
    const f2762Css = cssSource.slice(f2762Start);

    expect(f2762Start).toBeGreaterThanOrEqual(0);
    expect(f2762Css).toMatch(/\.alert-management__alertColumn\s*\{[\s\S]*?min-width:\s*320px;/);
    expect(f2762Css).toMatch(/\.alert-management__titleCell\s*\{[\s\S]*?min-width:\s*280px;[\s\S]*?overflow-wrap:\s*break-word;[\s\S]*?word-break:\s*normal;/);
    expect(f2762Css).toMatch(/\.alert-management__titleCell \.ant-typography\s*\{[\s\S]*?overflow-wrap:\s*break-word\s*!important;[\s\S]*?word-break:\s*normal\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2762Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{[\s\S]*?\.alert-management__table \.ant-table\s*\{[\s\S]*?min-width:\s*1180px\s*!important;[\s\S]*?table-layout:\s*fixed;/);
    expect(f2762Css).toMatch(/\.alert-management__table \.alert-management__alertColumn\s*\{[\s\S]*?width:\s*320px;[\s\S]*?min-width:\s*320px;[\s\S]*?max-width:\s*320px;/);
  });
});

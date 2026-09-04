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

  it('cancels stale alert and permission reads', () => {
    expect(pageSource).toContain('const dataAbortRef = useRef<AbortController | null>(null);');
    expect(pageSource).toContain('dataAbortRef.current?.abort();');
    expect(pageSource).toContain('}, { signal: abortController.signal }),');
    expect(pageSource).toContain('adminApi.getAlertSummary({ signal: abortController.signal })');
    expect(pageSource).toContain('adminApi.getMyPermissions({ signal: abortController.signal })');
    expect(pageSource).toContain('permissionsAbortRef.current?.abort();');
  });
});

describe('AlertManagement action lifecycle guards', () => {
  it('latches all admin mutations synchronously', () => {
    expect(pageSource).toContain('const actingRef = useRef<string | null>(null);');
    expect(pageSource).toContain('if (!mountedRef.current || actingRef.current) return;');
    expect(pageSource).toContain("actingRef.current = 'self-check';");
    expect(pageSource).toContain("actingRef.current = 'batch-ack';");
    expect(pageSource).toContain("actingRef.current = 'batch-resolve';");
    expect(pageSource).toContain("actingRef.current = 'purge-resolved';");
    expect(pageSource).toContain('const actionKey = `ack-${alert.id}`;');
    expect(pageSource).toContain('const actionKey = `resolve-${alert.id}`;');
  });

  it('suppresses mutation feedback, refreshes, and cleanup after unmount', () => {
    expect(pageSource).toContain('if (!mountedRef.current) return;');
    expect(pageSource).toMatch(/await adminApi\.runAlertSelfCheck\(\);\s*if \(!mountedRef\.current\) return;\s*message\.success/);
    expect(pageSource).toMatch(/const response = await adminApi\.acknowledgeAlert\(alert\.id\);\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/const response = await adminApi\.resolveAlert\(alert\.id\);\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/const response = await adminApi\.acknowledgeAlerts\([\s\S]*?\);\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/const response = await adminApi\.resolveAlerts\([\s\S]*?\);\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/const response = await adminApi\.purgeResolvedAlerts\(retentionDays\);\s*if \(!mountedRef\.current\) return;/);
    expect(pageSource).toMatch(/catch \(error: unknown\) \{\s*if \(mountedRef\.current\) \{[\s\S]*?message\.error/);
    expect(pageSource).toContain('if (mountedRef.current) setActing(null);');
  });
});

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'SecurityAuditLogManagement.tsx'), 'utf8');

describe('SecurityAuditLogManagement type-safety guards', () => {
  it('keeps audit log API error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('pages.auditLogs.loadFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, t('pages.auditLogs.exportFailed'), language)");
    expect(source).toContain("getApiErrorMessage(error, adminText('purgeFailed'), language)");
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('as any');
  });
});

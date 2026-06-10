import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'IpBlacklistManagement.tsx'), 'utf8');

describe('IpBlacklistManagement type-safety contracts', () => {
  it('keeps async error handling typed without broad any usage', () => {
    expect(pageSource).toContain('let listError: unknown = null;');
    expect(pageSource).toContain('let statusError: unknown = null;');
    expect(pageSource).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('error?.errorFields');
    expect(pageSource).not.toContain('let listError: any');
    expect(pageSource).not.toContain('let statusError: any');
    expect(pageSource).not.toContain('catch (error: any)');
  });
});

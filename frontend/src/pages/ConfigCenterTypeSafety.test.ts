import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ConfigCenter.tsx'), 'utf8');

describe('ConfigCenter type-safety guards', () => {
  it('keeps config center API error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.loadFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.publishFailed'), language)");
    expect(pageSource).toContain("getApiErrorMessage(error, t('pages.configCenter.runtimeApplyFailed'), language)");
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('catch (err: any)');
    expect(pageSource).not.toContain('error?.errorFields');
  });
});

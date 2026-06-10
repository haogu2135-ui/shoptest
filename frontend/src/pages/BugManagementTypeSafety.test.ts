import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'BugManagement.tsx'), 'utf8');

describe('BugManagement type-safety guards', () => {
  it('keeps bug admin API and form error handling typed without broad any usage', () => {
    expect(source).toContain('const isFormValidationError = (error: unknown)');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, tx('loadFailed', 'Failed to load bugs'), language)");
    expect(source).toContain("getApiErrorMessage(error, tx('summaryFailed', 'Failed to load bug summary'), language)");
    expect(source).toContain("getApiErrorMessage(error, tx('saveFailed', 'Failed to save bug'), language)");
    expect(source).toContain("getApiErrorMessage(error, tx('statusSaveFailed', 'Failed to update bug status'), language)");
    expect(source).toContain('if (isFormValidationError(error)) return;');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
    expect(source).not.toContain('error?.errorFields');
    expect(source).not.toContain('as any');
  });
});

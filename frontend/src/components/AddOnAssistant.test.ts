import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'AddOnAssistant.tsx'), 'utf8');

describe('AddOnAssistant type-safety guards', () => {
  it('keeps add-on quick-add error handling typed without broad any usage', () => {
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('messages.addFailed'), language)");
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });
});

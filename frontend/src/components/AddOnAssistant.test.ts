import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'AddOnAssistant.tsx'), 'utf8');

describe('AddOnAssistant type-safety guards', () => {
  it('keeps add-on quick-add error handling typed without broad any usage', () => {
    const handleStart = source.indexOf('const handleAdd = async (product: Product) => {');
    const handleEnd = source.indexOf('if (!conversionConfig.addOnAssistant.enabled || remainingAmount <= 0) return null;', handleStart);
    const handleSource = source.slice(handleStart, handleEnd);

    expect(handleStart).toBeGreaterThan(-1);
    expect(handleEnd).toBeGreaterThan(handleStart);
    expect(handleSource).toContain('try {');
    expect(handleSource).toContain('await onAdd(product);');
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain("getApiErrorMessage(error, t('messages.addFailed'), language)");
    expect(handleSource).toContain("message.error(getApiErrorMessage(error, t('messages.addFailed'), language));");
    expect(handleSource).not.toMatch(/handleApiError\s*\([^)]*rethrow:\s*true/);
    expect(handleSource).not.toMatch(/throw\s+(err|error)\s*;/);
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });
});

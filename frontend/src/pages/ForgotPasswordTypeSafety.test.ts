import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ForgotPassword.tsx'), 'utf8');

describe('ForgotPassword type-safety guards', () => {
  it('keeps reset-code and reset-submit error handling typed without broad any usage', () => {
    expect(pageSource).not.toContain("import type { InputRef } from 'antd/es/input';");
    expect(pageSource).toContain('const codeInputRef = useRef<HTMLInputElement | null>(null);');
    expect(pageSource).toContain('const getRetryAfterSeconds = (error: unknown');
    expect(pageSource).toContain('const authApiErrorCode = (error: unknown)');
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('if (!isFormValidationError(error)) {');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).not.toContain('useRef<any>');
    expect(pageSource).not.toContain('error: any');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('error?.errorFields');
    expect(pageSource).not.toContain('error.response?.data?.code');
  });
});

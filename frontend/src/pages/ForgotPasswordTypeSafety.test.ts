import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'ForgotPassword.tsx'), 'utf8');
const helpersSource = fs.readFileSync(path.join(__dirname, 'forgotPasswordHelpers.ts'), 'utf8');
const surface = `${pageSource}\n${helpersSource}`;

describe('ForgotPassword type-safety guards', () => {
  it('keeps reset-code and reset-submit error handling typed without broad any usage', () => {
    expect(surface).not.toContain("import type { InputRef } from 'antd/es/input';");
    expect(pageSource).toContain('const codeInputRef = useRef<HTMLInputElement | null>(null);');
    expect(helpersSource).toContain('export const getForgotPasswordRetryAfterSeconds = (error: unknown');
    expect(helpersSource).toContain('export const authApiErrorCode = (error: unknown)');
    expect(helpersSource).toContain('export const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('if (!isFormValidationError(error)) {');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(surface).not.toContain('useRef<any>');
    expect(surface).not.toContain('error: any');
    expect(surface).not.toContain('catch (error: any)');
    expect(surface).not.toContain('error?.errorFields');
    expect(surface).not.toContain('error.response?.data?.code');
  });
});

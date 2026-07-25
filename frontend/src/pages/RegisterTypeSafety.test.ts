import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'Register.tsx'), 'utf8');
const helpersSource = fs.readFileSync(path.join(__dirname, 'registerHelpers.ts'), 'utf8');
const surface = `${pageSource}\n${helpersSource}`;

describe('Register type-safety guards', () => {
  it('keeps register-code and submit error handling typed without broad any usage', () => {
    expect(surface).not.toContain("import type { InputRef } from 'antd/es/input';");
    expect(helpersSource).toContain('export type RegisterApiErrorData =');
    expect(pageSource).toContain('const codeInputRef = useRef<HTMLInputElement | null>(null);');
    expect(helpersSource).toContain('export const getRegisterRetryAfterSeconds = (error: unknown');
    expect(helpersSource).toContain('export const registerApiErrorCode = (error: unknown)');
    expect(helpersSource).toContain('export const isRegisterEmailCodeRequired = (value: unknown)');
    expect(helpersSource).toContain('export const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('if (!isFormValidationError(error)) {');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(surface).not.toContain('useRef<any>');
    expect(surface).not.toContain('error: any');
    expect(surface).not.toContain('catch (error: any)');
    expect(surface).not.toContain('error?.errorFields');
    expect(surface).not.toContain('error.response?.data');
    expect(surface).not.toContain('error?.response?.data');
  });
});

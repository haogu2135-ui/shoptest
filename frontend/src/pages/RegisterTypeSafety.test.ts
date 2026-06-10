import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'Register.tsx'), 'utf8');

describe('Register type-safety guards', () => {
  it('keeps register-code and submit error handling typed without broad any usage', () => {
    expect(pageSource).toContain("import type { InputRef } from 'antd/es/input';");
    expect(pageSource).toContain('type RegisterApiErrorData =');
    expect(pageSource).toContain('const codeInputRef = useRef<InputRef | null>(null);');
    expect(pageSource).toContain('const getRetryAfterSeconds = (error: unknown');
    expect(pageSource).toContain('const registerApiErrorCode = (error: unknown)');
    expect(pageSource).toContain('const isRegisterEmailCodeRequired = (value: unknown)');
    expect(pageSource).toContain('const isFormValidationError = (error: unknown)');
    expect(pageSource).toContain('if (!isFormValidationError(error)) {');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).not.toContain('useRef<any>');
    expect(pageSource).not.toContain('error: any');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('error?.errorFields');
    expect(pageSource).not.toContain('error.response?.data');
    expect(pageSource).not.toContain('error?.response?.data');
  });
});

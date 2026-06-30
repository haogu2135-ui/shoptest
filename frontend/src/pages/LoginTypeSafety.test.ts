const readLoginSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'Login.tsx'), 'utf8')
);

export {};

describe('Login type-safety guard', () => {
  it('keeps auth form values, API errors, and session responses typed without broad any escapes', () => {
    const source = readLoginSource();

    expect(source).not.toMatch(/\bany\b|as any\b|catch \([^)]*: any\)|useRef<any>|responseData: any|values: any|error: any/);
    expect(source).toContain("import type { InputRef } from 'antd/es/input';");
    expect(source).toContain("import type { Language } from '../i18n';");
    expect(source).toContain('type PasswordLoginValues = {');
    expect(source).toContain('type EmailLoginValues = {');
    expect(source).toContain('type LoginSessionResponse = Parameters<typeof persistAuthSession>[0]');
    expect(source).toContain('const asApiError = (error: unknown): ApiErrorLike =>');
    expect(source).toContain('const apiErrorCode = (error: unknown)');
    expect(source).toContain('const resolvePasswordLoginError = (error: unknown');
    expect(source).toContain('const shouldTryNextLoginCandidate = (error: unknown)');
    expect(source).toContain('const codeInputRef = useRef<InputRef | null>(null);');
    expect(source).toContain('const completeLogin = async (responseData: LoginSessionResponse) =>');
    expect(source).toContain('const onFinish = async (values: PasswordLoginValues) =>');
    expect(source).toContain('const onEmailLogin = async (values: EmailLoginValues) =>');
    expect(source).toContain('} catch (error: unknown) {');
  });
});

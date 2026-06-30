import fs from 'fs';
import path from 'path';

const readPageSource = () => fs.readFileSync(path.resolve(__dirname, 'ForgotPassword.tsx'), 'utf8');
const readLoginPageSource = () => fs.readFileSync(path.resolve(__dirname, 'Login.tsx'), 'utf8');
const readLoginCss = () => fs.readFileSync(path.resolve(__dirname, 'Login.css'), 'utf8');

describe('ForgotPassword responsive reset guide', () => {
  it('uses the shared strong password policy for reset passwords', () => {
    const source = readPageSource();

    expect(source).toContain("from '../utils/passwordPolicy'");
    expect(source).toContain('STRONG_PASSWORD_MIN_LENGTH');
    expect(source).toContain('STRONG_PASSWORD_MAX_LENGTH');
    expect(source).toContain('isCommonPassword(value)');
    expect(source).toContain('hasRequiredPasswordClasses(value)');
    expect(source).toContain("t('pages.auth.passwordCommon')");
  });

  it('renders the reset guide labels as dedicated guide items', () => {
    const source = readPageSource();

    expect(source).toContain('className="shopee-login-reset-guide"');
    expect(source).toContain('className="shopee-login-reset-guide__item"');
    expect(source).toContain("t('pages.auth.resetGuideEmail')");
    expect(source).toContain("t('pages.auth.resetGuideVerify')");
    expect(source).toContain("t('pages.auth.resetGuideLogin')");
  });

  it('keeps 320px reset-guide labels unclamped and stacked', () => {
    const css = readLoginCss();
    const f2759Css = css.match(/\/\* F2759:[\s\S]*$/)?.[0] ?? '';

    expect(f2759Css).toContain('@media (max-width: 430px)');
    expect(f2759Css).toContain('.shopee-login-card--reset .shopee-login-reset-guide__item span');
    expect(f2759Css).toContain('display: block;');
    expect(f2759Css).toContain('overflow: visible;');
    expect(f2759Css).toContain('white-space: normal;');
    expect(f2759Css).toContain('-webkit-line-clamp: unset;');
    expect(f2759Css).toContain('@media (max-width: 380px)');
    expect(f2759Css).toContain('grid-template-columns: 1fr;');
    expect(f2759Css).toContain('grid-template-columns: auto minmax(0, 1fr);');
  });

  it('keeps email-code length and reset login normalization aligned with auth validation', () => {
    const loginSource = readLoginPageSource();
    const forgotPasswordSource = readPageSource();

    expect(loginSource).toContain("const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\\D+/g, '').slice(0, 6);");
    expect(forgotPasswordSource).toContain("const normalizeEmailCode = (value: unknown) => String(value || '').replace(/\\D+/g, '').slice(0, 6);");
    expect(loginSource).toMatch(/t\('pages\.auth\.verificationCode'\)[\s\S]*?maxLength=\{6\}/);
    expect(forgotPasswordSource).toMatch(/name="code"[\s\S]*?placeholder=\{t\('pages\.auth\.verificationCode'\)\}[\s\S]*?maxLength=\{6\}/);
    expect(forgotPasswordSource).toContain('const normalizedLogin = normalizePasswordLogin(values.login);');
    expect(forgotPasswordSource).toContain('login: normalizedLogin,');
    expect(forgotPasswordSource).not.toContain('login: values.login');
    expect(loginSource).not.toContain('maxLength={12}');
    expect(forgotPasswordSource).not.toContain('maxLength={12}');
  });

  it('guards reset-code send and submit with synchronous refs', () => {
    const source = readPageSource();

    expect(source).toContain('const resetCodeSendingRef = useRef(false);');
    expect(source).toContain('const resetSubmittingRef = useRef(false);');
    expect(source).toContain('if (resetCodeSendingRef.current) return;');
    expect(source).toContain('resetCodeSendingRef.current = true;');
    expect(source).toContain('resetCodeSendingRef.current = false;');
    expect(source).toContain('if (resetSubmittingRef.current) return;');
    expect(source).toContain('resetSubmittingRef.current = true;');
    expect(source).toContain('resetSubmittingRef.current = false;');
    expect(source).toMatch(/<Button type="primary" htmlType="submit"[\s\S]{0,160}loading={loading} disabled={loading \|\| codeSending \|\| !emailCodeEnabled}/);
  });

  it('keeps reset-code action labels aligned with the visible countdown state', () => {
    const source = readPageSource();
    const css = readLoginCss();

    expect(source).toContain('const resetCodeActionText = codeSending');
    expect(source).toContain("t('pages.auth.emailCodeSending')");
    expect(source).toContain("t('pages.auth.resendIn', { seconds: sendCodeCountdown })");
    expect(source).toContain("t('pages.auth.sendCode')");
    expect(source).toContain('const resetSendCodeActionLabel = `${resetPageLabel}: ${resetCodeActionText}`;');
    expect(source).toContain('aria-label={resetSendCodeActionLabel}');
    expect(source).toContain('title={resetSendCodeActionLabel}');

    expect(css).toContain('/* Mobile auth closure: code resend controls stack before they squeeze input copy. */');
    expect(css).toContain('.shopee-login-form__field--code .shopee-login-codeButton');
    expect(css).toContain('white-space: normal !important;');
  });
});

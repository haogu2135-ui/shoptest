import fs from 'fs';
import path from 'path';

const readPageSource = () => fs.readFileSync(path.resolve(__dirname, 'ForgotPassword.tsx'), 'utf8');
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
});

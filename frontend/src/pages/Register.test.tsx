import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { userApi } from '../api';
import Register from './Register';

const readRegisterSource = () => fs.readFileSync(path.resolve(__dirname, 'Register.tsx'), 'utf8');
const readRegisterCss = () => fs.readFileSync(path.resolve(__dirname, 'Register.css'), 'utf8');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

jest.mock('../api', () => ({
  userApi: {
    register: jest.fn(),
    sendEmailLoginCode: jest.fn(),
  },
}));

jest.mock('../hooks/useAppConfig', () => ({
  useAppConfig: () => ({
    config: { emailCodeEnabled: true },
    loading: false,
  }),
}));

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, string | ((params?: Record<string, string | number>) => string)> = {
        'nav.trackOrder': 'Track order',
        'pages.auth.confirmPassword': 'Confirm password',
        'pages.auth.confirmRequired': 'Confirm your password',
        'pages.auth.email': 'Email',
        'pages.auth.emailAlreadyRegistered': 'Email already registered',
        'pages.auth.emailCodeExpiresIn': (value) => `Expires in ${value?.minutes} minutes`,
        'pages.auth.emailCodeInvalid': 'Invalid code',
        'pages.auth.emailCodeLength': 'Enter 6 digits',
        'pages.auth.emailCodeRateLimited': 'Too many code requests',
        'pages.auth.emailCodeRequired': 'Enter the email code',
        'pages.auth.emailCodeSendFailed': 'Could not send code',
        'pages.auth.emailCodeSending': 'Sending code',
        'pages.auth.emailCodeSentTo': (value) => `Code sent to ${value?.email}`,
        'pages.auth.emailCodeTooManyAttempts': 'Too many attempts',
        'pages.auth.emailCodeUnavailable': 'Email code unavailable',
        'pages.auth.emailInvalid': 'Enter a valid email',
        'pages.auth.emailRequired': 'Email is required',
        'pages.auth.loginNow': 'Log in',
        'pages.auth.password': 'Password',
        'pages.auth.passwordMin': 'Use at least 12 characters',
        'pages.auth.passwordCommon': 'Choose a less common password',
        'pages.auth.passwordMismatch': 'Passwords do not match',
        'pages.auth.passwordPattern': 'Use at least three character classes',
        'pages.auth.passwordRequired': 'Password is required',
        'pages.auth.phone': 'Phone',
        'pages.auth.phoneAlreadyRegistered': 'Phone already registered',
        'pages.auth.phoneInvalid': 'Enter a valid phone',
        'pages.auth.phonePlaceholder': 'Phone',
        'pages.auth.phoneRequired': 'Phone is required',
        'pages.auth.register': 'Register',
        'pages.auth.registerEyebrow': 'New account',
        'pages.auth.registerFailed': 'Registration failed',
        'pages.auth.registerHeroSubtitle': 'Create your pet supplies account.',
        'pages.auth.registerHeroTitle': 'Create account',
        'pages.auth.registerPrivacyHint': 'Secure checkout and order tracking.',
        'pages.auth.registerSuccess': 'Registration successful',
        'pages.auth.registerTitle': 'Create account',
        'pages.auth.registerTrustPerks': 'Member perks',
        'pages.auth.registerTrustSecure': 'Secure account',
        'pages.auth.registerTrustTracking': 'Order tracking',
        'pages.auth.resendIn': (value) => `Resend in ${value?.seconds}s`,
        'pages.auth.sendCode': 'Send code',
        'pages.auth.usernameAlreadyRegistered': 'Username already registered',
        'pages.auth.usernameMin': 'Use at least 3 characters',
        'pages.auth.usernameRequired': 'Username is required',
        'pages.auth.usernameShort': 'Username',
        'pages.auth.verificationCode': 'Verification code',
      };
      const label = labels[key];
      return typeof label === 'function' ? label(params) : label || key;
    },
  }),
}));

jest.mock('../utils/safeStorage', () => ({
  setSessionStorageItem: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Register mobile validation scroll', () => {
  it('keeps failed submit anchored below mobile storefront chrome', () => {
    const source = readRegisterSource();
    const css = readRegisterCss();
    const fixCss = css.slice(css.indexOf('F3413:'));

    expect(source).toContain("from '../utils/formValidationFocus'");
    expect(source).toContain('focusFirstFormError');
    expect(source).toContain("rootSelector: '.register-page__card'");
    expect(source).toContain('scrollOffset: 176');
    expect(source).toContain("scrollContainerSelector: '.register-page__card'");
    expect(source).toContain('window.requestAnimationFrame(scrollFirstRegisterErrorIntoView)');
    expect(source).toContain('onFinishFailed={onFinishFailed}');
    expect(fixCss).toContain('@media (max-width: 640px)');
    expect(fixCss).toMatch(/\.register-page\s*\{[^}]*scroll-padding-top:\s*calc\(176px \+ env\(safe-area-inset-top,\s*0px\)\);/);
    expect(fixCss).toMatch(/\.register-page__card \.ant-form-item,\s*\.register-page__card \.ant-form-item-has-error\s*\{[^}]*scroll-margin-top:\s*calc\(176px \+ env\(safe-area-inset-top,\s*0px\)\);[^}]*scroll-margin-bottom:\s*24px;/);
  });

  it('keeps the mobile verification-code resend control from squeezing input copy', () => {
    const css = readRegisterCss();
    const fixStart = css.indexOf('Mobile auth closure: keep verification-code input readable beside resend controls.');
    const fixCss = css.slice(fixStart);

    expect(fixStart).toBeGreaterThanOrEqual(0);
    expect(fixCss).toContain('@media (max-width: 430px)');
    expect(fixCss).toMatch(/\.register-page__codeField \.ant-input-group,[\s\S]*?\.register-page__codeField \.ant-input-wrapper\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[\s\S]*?gap:\s*8px\s*!important;/);
    expect(fixCss).toMatch(/\.register-page__codeField \.ant-input-group-addon\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?display:\s*block\s*!important;[\s\S]*?background:\s*transparent\s*!important;/);
    expect(fixCss).toMatch(/\.register-page__codeField \.ant-input-group-addon \.ant-btn\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
  });
});

describe('Register accessibility labels', () => {
  it('keeps named auth Form.Item fields associated with visible labels', () => {
    const source = readRegisterSource();
    const labelledFields = [
      ['username', "label={t('pages.auth.usernameShort')}"],
      ['password', "label={t('pages.auth.password')}"],
      ['confirmPassword', "label={t('pages.auth.confirmPassword')}"],
      ['email', "label={t('pages.auth.email')}"],
      ['emailCode', "label={t('pages.auth.verificationCode')}"],
      ['phone', "label={t('pages.auth.phone')}"],
    ];

    labelledFields.forEach(([name, label]) => {
      expect(source).toMatch(new RegExp(`<Form\\.Item[\\s\\S]{0,180}name="${name}"[\\s\\S]{0,180}${escapeRegExp(label)}`));
    });
  });
});

describe('Register submit guard', () => {
  it('uses the shared strong password policy for registration passwords', () => {
    const source = readRegisterSource();

    expect(source).toContain("from '../utils/passwordPolicy'");
    expect(source).toContain('STRONG_PASSWORD_MIN_LENGTH');
    expect(source).toContain('STRONG_PASSWORD_MAX_LENGTH');
    expect(source).toContain('isCommonPassword(value)');
    expect(source).toContain('hasRequiredPasswordClasses(value)');
    expect(source).toContain("t('pages.auth.passwordCommon')");
  });

  it('guards registration submits with a synchronous ref', () => {
    const source = readRegisterSource();

    expect(source).toContain('const registeringRef = useRef(false);');
    expect(source).toContain('const registerCodeSendingRef = useRef(false);');
    expect(source).toContain('if (registeringRef.current) return;');
    expect(source).toContain('registeringRef.current = true;');
    expect(source).toContain('registeringRef.current = false;');
    expect(source).toContain('if (registerCodeSendingRef.current) return;');
    expect(source).toContain('registerCodeSendingRef.current = true;');
    expect(source).toContain('registerCodeSendingRef.current = false;');
  });

  it('does not submit the register form twice during the same pending request', async () => {
    (userApi.register as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Create account: Username'), {
      target: { value: 'newbuyer' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Confirm password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Email'), {
      target: { value: 'newbuyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Phone'), {
      target: { value: '5551234567' },
    });
    const submitButton = screen.getByRole('button', { name: 'Create account: Register' });

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(userApi.register).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton).toBeDisabled());
  });

  it('does not send the registration email code twice during the same pending request', async () => {
    (userApi.register as jest.Mock).mockRejectedValue({
      response: { data: { emailCodeRequired: true } },
    });
    (userApi.sendEmailLoginCode as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Create account: Email'), {
      target: { value: 'newbuyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Username'), {
      target: { value: 'newbuyer' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Confirm password'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Phone'), {
      target: { value: '5551234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account: Register' }));

    const sendButton = await screen.findByRole('button', { name: 'Create account: Send code' }, { timeout: 10000 });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    await waitFor(() => expect(userApi.sendEmailLoginCode).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sendButton).toBeDisabled());
  }, 15000);

  it('submits password text exactly as entered, including surrounding spaces', async () => {
    (userApi.register as jest.Mock).mockResolvedValue({ data: { username: 'newbuyer' } });
    const passwordWithSpaces = ' StrongPass123 ';

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Create account: Username'), {
      target: { value: 'newbuyer' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Password'), {
      target: { value: passwordWithSpaces },
    });
    fireEvent.change(screen.getByLabelText('Create account: Confirm password'), {
      target: { value: passwordWithSpaces },
    });
    fireEvent.change(screen.getByLabelText('Create account: Email'), {
      target: { value: 'newbuyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Create account: Phone'), {
      target: { value: '5551234567' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create account: Register' }));

    await waitFor(() => expect(userApi.register).toHaveBeenCalledWith(expect.objectContaining({
      password: passwordWithSpaces,
    })));
  });

  it('preserves commercial post-register redirect into login', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Register.tsx'), 'utf8');
    expect(source).toContain('getPostLoginRedirectTarget');
    expect(source).toContain('buildLoginUrl(postRegisterRedirect)');
  });

});

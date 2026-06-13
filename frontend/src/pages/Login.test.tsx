import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { clearStoredAuthCredentials, clearStoredAuthSession, userApi } from '../api';
import { hasStoredValue } from '../utils/safeStorage';
import Login from './Login';

let mockLanguage = 'en';
const readLoginPageSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Login.tsx'), 'utf8') as string;
const readMobilePageContrastCss = () => require('fs').readFileSync(require('path').resolve(__dirname, '../styles/mobile-page-contrast.css'), 'utf8') as string;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
  clearStoredAuthCredentials: jest.fn(),
  clearStoredAuthSession: jest.fn(),
  persistAuthSession: jest.fn(),
  userApi: {
    emailLogin: jest.fn(),
    login: jest.fn(),
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
    language: mockLanguage,
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, Record<string, string | ((params?: Record<string, string | number>) => string)>> = {
        en: {
          'common.loading': 'Loading',
          'nav.help': 'Help',
          'nav.register': 'Register',
          'nav.trackOrder': 'Track order',
          'pages.auth.email': 'Email',
          'pages.auth.emailCodeSending': 'Sending code',
          'pages.auth.emailLogin': 'Email code login',
          'pages.auth.emailLoginFailed': 'Email code login failed',
          'pages.auth.emailLoginHint': 'Use a one-time email code.',
          'pages.auth.emailLoginTrust': 'Email login trust signals',
          'pages.auth.loginFailed': 'Incorrect username or password',
          'pages.auth.loginHeroSubtitle': 'Keep checkout ready.',
          'pages.auth.loginTitle': 'Log in',
          'pages.auth.loginTrustCart': 'Recover guest cart',
          'pages.auth.loginTrustSecure': 'Secure account',
          'pages.auth.loginTrustTitle': 'Login benefits',
          'pages.auth.loginTrustTracking': 'Track every order',
          'pages.auth.mobileLoginTitle': 'Secure mobile login',
          'pages.auth.mobileQuickActions': 'Quick actions',
          'pages.auth.password': 'Password',
          'pages.auth.showPassword': 'Show password',
          'pages.auth.hidePassword': 'Hide password',
          'pages.auth.passwordLogin': 'Password login',
          'pages.auth.register': 'Register',
          'pages.auth.resendIn': (value) => `Resend in ${value?.seconds}s`,
          'pages.auth.sendCode': 'Send code',
          'pages.auth.username': 'Username',
          'pages.auth.verificationCode': 'Verification code',
        },
        es: {
          'common.loading': 'Cargando',
          'nav.help': 'Ayuda',
          'nav.register': 'Registrarse',
          'nav.trackOrder': 'Rastrear pedido',
          'pages.auth.email': 'Correo',
          'pages.auth.emailCodeSending': 'Enviando código',
          'pages.auth.emailLogin': 'Acceso con código',
          'pages.auth.emailLoginFailed': 'No se pudo iniciar sesión con el código',
          'pages.auth.emailLoginHint': 'Usa un código de correo de un solo uso.',
          'pages.auth.emailLoginTrust': 'Señales de confianza',
          'pages.auth.loginFailed': 'Usuario o contraseña incorrectos',
          'pages.auth.loginHeroSubtitle': 'Mantén el pago listo.',
          'pages.auth.loginTitle': 'Iniciar sesión',
          'pages.auth.loginTrustCart': 'Recuperar carrito invitado',
          'pages.auth.loginTrustSecure': 'Cuenta segura',
          'pages.auth.loginTrustTitle': 'Beneficios de acceso',
          'pages.auth.loginTrustTracking': 'Rastrea cada pedido',
          'pages.auth.mobileLoginTitle': 'Inicio seguro móvil',
          'pages.auth.mobileQuickActions': 'Acciones rápidas',
          'pages.auth.password': 'Contraseña',
          'pages.auth.showPassword': 'Mostrar contraseña',
          'pages.auth.hidePassword': 'Ocultar contraseña',
          'pages.auth.passwordLogin': 'Acceso con contraseña',
          'pages.auth.register': 'Registrarse',
          'pages.auth.resendIn': (value) => `Reenviar en ${value?.seconds}s`,
          'pages.auth.sendCode': 'Enviar código',
          'pages.auth.username': 'Usuario',
          'pages.auth.verificationCode': 'Código de verificación',
        },
        zh: {
          'common.loading': '加载中',
          'nav.help': '帮助',
          'nav.register': '注册',
          'nav.trackOrder': '订单追踪',
          'pages.auth.email': '邮箱',
          'pages.auth.emailCodeSending': '发送验证码中',
          'pages.auth.emailLogin': '邮箱验证码登录',
          'pages.auth.emailLoginFailed': '邮箱验证码登录失败',
          'pages.auth.emailLoginHint': '使用一次性邮箱验证码。',
          'pages.auth.emailLoginTrust': '邮箱登录信任提示',
          'pages.auth.loginFailed': '用户名或密码错误',
          'pages.auth.loginHeroSubtitle': '让结账保持就绪。',
          'pages.auth.loginTitle': '登录',
          'pages.auth.loginTrustCart': '找回游客购物车',
          'pages.auth.loginTrustSecure': '账号安全',
          'pages.auth.loginTrustTitle': '登录权益',
          'pages.auth.loginTrustTracking': '追踪每个订单',
          'pages.auth.mobileLoginTitle': '移动端安全登录',
          'pages.auth.mobileQuickActions': '快捷操作',
          'pages.auth.password': '密码',
          'pages.auth.showPassword': '显示密码',
          'pages.auth.hidePassword': '隐藏密码',
          'pages.auth.passwordLogin': '密码登录',
          'pages.auth.register': '注册',
          'pages.auth.resendIn': (value) => `${value?.seconds}秒后重发`,
          'pages.auth.sendCode': '发送验证码',
          'pages.auth.username': '用户名',
          'pages.auth.verificationCode': '验证码',
        },
      };
      const label = labels[mockLanguage]?.[key] || labels.en[key];
      return typeof label === 'function' ? label(params) : label || key;
    },
  }),
}));

jest.mock('../utils/authRedirect', () => ({
  getPostLoginRedirectTarget: () => '/',
}));

jest.mock('../utils/guestCart', () => ({
  getGuestCartItems: () => [],
  replaceGuestCartItems: jest.fn(),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  getSessionStorageItem: jest.fn(() => null),
  hasStoredValue: jest.fn(() => false),
  removeSessionStorageItem: jest.fn(),
}));

jest.mock('../utils/apiError', () => jest.requireActual('../utils/apiError'));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
};

describe('Login accessibility labels', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    jest.clearAllMocks();
    (hasStoredValue as jest.Mock).mockReturnValue(false);
  });

  it('gives password and email login fields durable contextual names', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Password login: Log in: Username')).toHaveAttribute(
      'title',
      'Password login: Log in: Username',
    );
    expect(screen.getByLabelText('Password login: Log in: Password')).toHaveAttribute(
      'title',
      'Password login: Log in: Password',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Email code login' }));

    expect(screen.getByLabelText('Email code login: Log in: Email')).toHaveAttribute(
      'title',
      'Email code login: Log in: Email',
    );
    expect(screen.getByLabelText('Email code login: Log in: Verification code')).toHaveAttribute(
      'title',
      'Email code login: Log in: Verification code',
    );
    expect(screen.getByRole('button', { name: 'Email code login: Log in: Send code' })).toHaveAttribute(
      'title',
      'Email code login: Log in: Send code',
    );
  });

  it('keeps named auth Form.Item fields associated with visible labels', () => {
    const source = readLoginPageSource();
    const labelledFields = [
      ['username', "label={t('pages.auth.username')}"],
      ['password', "label={t('pages.auth.password')}"],
      ['email', "label={t('pages.auth.email')}"],
      ['code', "label={t('pages.auth.verificationCode')}"],
    ];

    labelledFields.forEach(([name, label]) => {
      expect(source).toMatch(new RegExp(`<Form\\.Item[\\s\\S]{0,160}name="${name}"[\\s\\S]{0,160}${escapeRegExp(label)}`));
    });
  });

  it('keeps APP auth primary actions contrast-safe without forced link underlines', () => {
    const css = readMobilePageContrastCss();
    const contrastStart = css.indexOf('.shop-app-shell--auth-flow :where(\n  .shopee-login-card .ant-btn-primary:not(:disabled):not(.ant-btn-disabled)');
    const contrastCss = css.slice(contrastStart, css.indexOf('body.shop-mobile-app :where(.ant-form-item-explain-error', contrastStart));
    const linkStart = css.indexOf('.shop-app-shell--auth-flow :where(\n  .register-page__footer a[href]');
    const linkCss = css.slice(linkStart);

    expect(contrastStart).toBeGreaterThanOrEqual(0);
    expect(contrastCss).toContain('.shopee-login-card .ant-btn-primary:not(:disabled):not(.ant-btn-disabled)');
    expect(contrastCss).toContain('.register-page__card .ant-btn-primary:not(:disabled):not(.ant-btn-disabled)');
    expect(contrastCss).toMatch(/background:\s*#a8321f\s*!important;/);
    expect(contrastCss).toMatch(/border-color:\s*#a8321f\s*!important;/);
    expect(contrastCss).toMatch(/color:\s*#ffffff\s*!important;/);
    expect(contrastCss).toMatch(/-webkit-text-fill-color:\s*#ffffff\s*!important;/);
    expect(contrastCss).toMatch(/:focus-visible[\s\S]*?background:\s*#8f2d17\s*!important;[\s\S]*?border-color:\s*#8f2d17\s*!important;/);
    expect(linkStart).toBeGreaterThanOrEqual(0);
    expect(linkCss).toContain('.shopee-login-links a[href]');
    expect(linkCss).toMatch(/text-decoration:\s*none\s*!important;/);
  });

  it('does not expose the stale unlabeled guest login button and names guest-friendly actions', () => {
    const source = readLoginPageSource();

    expect(source).not.toContain('data-testid="guest-login-btn"');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Register: Log in' })).toHaveAttribute('title', 'Register: Log in');
    expect(screen.getAllByRole('button', { name: 'Track order: Log in' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Help: Quick actions' })).toHaveAttribute('title', 'Help: Quick actions');
  });

  it('does not clear stored auth data when the login page mounts', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(clearStoredAuthSession).not.toHaveBeenCalled();
    expect(clearStoredAuthCredentials).not.toHaveBeenCalled();
  });

  it('redirects already authenticated users away from the login page without clearing their session', async () => {
    (hasStoredValue as jest.Mock).mockImplementation((key: string) => key === 'token');

    render(
      <MemoryRouter initialEntries={['/login?redirect=%2Fprofile']}>
        <Login />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    expect(clearStoredAuthSession).not.toHaveBeenCalled();
    expect(clearStoredAuthCredentials).not.toHaveBeenCalled();
  });

  it('lets password-login users show and hide the typed password', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText('Password login: Log in: Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Password login: Log in: Password: Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Password login: Log in: Password: Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('guards both login submit handlers against same-render double submits', () => {
    const source = readLoginPageSource();

    expect(source).toContain('const passwordSubmittingRef = useRef(false);');
    expect(source).toContain('const emailSubmittingRef = useRef(false);');
    expect(source).toContain('if (passwordSubmittingRef.current) return;');
    expect(source).toContain('passwordSubmittingRef.current = true;');
    expect(source).toContain('passwordSubmittingRef.current = false;');
    expect(source).toContain('if (emailSubmittingRef.current) return;');
    expect(source).toContain('emailSubmittingRef.current = true;');
    expect(source).toContain('emailSubmittingRef.current = false;');
    expect(source).toMatch(/<Button type="primary" htmlType="submit"[\s\S]{0,180}loading={loading} disabled={loading}/);
  });

  it('does not submit the password login form twice during the same pending request', async () => {
    (userApi.login as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Password login: Log in: Username'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password login: Log in: Password'), {
      target: { value: 'correct-password' },
    });
    const submitButton = screen.getByRole('button', { name: 'Password login: Log in' });

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(userApi.login).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton).toBeDisabled());
  });

  it('does not submit the email login form twice during the same pending request', async () => {
    (userApi.emailLogin as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Email code login' }));
    fireEvent.change(screen.getByLabelText('Email code login: Log in: Email'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Email code login: Log in: Verification code'), {
      target: { value: '123456' },
    });
    const submitButton = screen.getByRole('button', { name: 'Email code login: Log in' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(userApi.emailLogin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submitButton).toBeDisabled());
  });

  it('keeps completeLogin constrained to the typed login session response', () => {
    const source = readLoginPageSource();

    expect(source).not.toMatch(/\bany\b/);
    expect(source).toContain('type LoginSessionResponse = Parameters<typeof persistAuthSession>[0] & {');
    expect(source).toContain('type LoginApiResponse = {');
    expect(source).toContain('data: LoginSessionResponse;');
    expect(source).toContain('const completeLogin = async (responseData: LoginSessionResponse) => {');
    expect(source).toContain('response = await userApi.login(candidate, String(values.password || \'\')) as LoginApiResponse;');
    expect(source).toContain('const response = await userApi.emailLogin(normalizedEmail, normalizedCode) as LoginApiResponse;');
    expect(source).not.toContain('completeLogin = async (responseData: any)');
    expect(source).not.toContain('const completeLogin = async (responseData: any)');
  });

  it('clears stale auth credentials before a failed password login attempt without clearing browsing state', async () => {
    (userApi.login as jest.Mock).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'invalid credentials' } },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    (clearStoredAuthSession as jest.Mock).mockClear();
    (clearStoredAuthCredentials as jest.Mock).mockClear();

    fireEvent.change(screen.getByLabelText('Password login: Log in: Username'), {
      target: { value: 'previous@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password login: Log in: Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Password login: Log in' }));

    await waitFor(() => expect(userApi.login).toHaveBeenCalledWith('previous@example.com', 'wrong-password'));
    expect(clearStoredAuthCredentials).toHaveBeenCalledTimes(1);
    expect(clearStoredAuthSession).not.toHaveBeenCalled();
  });

  it('keeps login cleanup scoped to credentials instead of full client browsing state', () => {
    const source = readLoginPageSource();

    expect(source).toContain('clearStoredAuthCredentials();');
    expect(source).not.toContain('clearStoredAuthSession();');
  });

  it('keeps password-login server errors localized on Spanish pages', async () => {
    mockLanguage = 'es';
    (userApi.login as jest.Mock).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid username or password' } },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Acceso con contraseña: Iniciar sesión: Usuario'), {
      target: { value: 'cliente@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Acceso con contraseña: Iniciar sesión: Contraseña'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Acceso con contraseña: Iniciar sesión' }));

    await waitFor(() => expect(screen.getAllByText('Usuario o contraseña incorrectos').length).toBeGreaterThan(0));
    expect(screen.queryByText('Invalid username or password')).not.toBeInTheDocument();
  });

  it('keeps email-login server errors localized on Chinese pages', async () => {
    mockLanguage = 'zh';
    (userApi.emailLogin as jest.Mock).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid verification code' } },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: '邮箱验证码登录' }));
    fireEvent.change(screen.getByLabelText('邮箱验证码登录: 登录: 邮箱'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('邮箱验证码登录: 登录: 验证码'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '邮箱验证码登录: 登录' }));

    await waitFor(() => expect(userApi.emailLogin).toHaveBeenCalledWith('customer@example.com', '123456'));
    await waitFor(() => expect(screen.queryByText('Invalid verification code')).not.toBeInTheDocument());
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { cartApi, clearStoredAuthCredentials, persistAuthSession, userApi } from '../api';
import type { CartItem } from '../types';
import { getGuestCartItems, replaceGuestCartItems } from '../utils/guestCart';
import Login from './Login';

let mockLanguage = 'en';
const readLoginPageSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Login.tsx'), 'utf8') as string;
const readLoginCss = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Login.css'), 'utf8') as string;
const readMobileAppCss = () => require('fs').readFileSync(require('path').resolve(__dirname, '../mobile-app.css'), 'utf8') as string;
const readMobilePageContrastCss = () => require('fs').readFileSync(require('path').resolve(__dirname, '../styles/mobile-page-contrast.css'), 'utf8') as string;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
  clearStoredAuthCredentials: jest.fn(),
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
          'pages.auth.cartMerged': (value) => `Merged ${value?.count} guest cart items`,
          'pages.auth.cartMergePartial': (value) => `Merged ${value?.count} guest cart items; some remain`,
                    'pages.auth.loginFailed': 'Incorrect username or password',
          'pages.auth.loginRateLimited': 'Too many login attempts. Please try again later.',
          'pages.auth.loginLocked': 'This account is temporarily locked. Try again later or reset your password.',
          'pages.auth.loginServiceUnavailable': 'Login is temporarily unavailable. Please try again later or contact support.',
          'pages.auth.loginRecoveryNextRateLimited': 'Wait a moment, reset your password, track a guest order, or contact support for help.',
          'pages.auth.loginRecoveryNextLocked': 'Reset your password, track a recent order, or contact support for account recovery help.',
          'pages.auth.loginRecoveryNextUnavailable': 'Track a recent order or contact support while login recovers.',
          'pages.auth.forgotPassword': 'Forgot password',
          'nav.support': 'Support',

          'pages.auth.loginHeroSubtitle': 'Keep checkout ready.',
          'pages.auth.loginSuccess': 'Logged in',
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
          'pages.auth.loginRateLimited': 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
          'pages.auth.loginLocked': 'Esta cuenta está bloqueada temporalmente.',
          'pages.auth.loginServiceUnavailable': 'El inicio de sesión no está disponible temporalmente.',
          'pages.auth.loginRecoveryNextRateLimited': 'Espera un momento o contacta soporte.',
          'pages.auth.loginRecoveryNextLocked': 'Restablece tu contraseña o contacta soporte.',
          'pages.auth.loginRecoveryNextUnavailable': 'Rastrea un pedido o contacta soporte.',
          'pages.auth.forgotPassword': 'Olvidé mi contraseña',
          'nav.support': 'Soporte',

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
          'pages.auth.loginRateLimited': '登录尝试过于频繁，请稍后再试',
          'pages.auth.loginLocked': '账号已临时锁定',
          'pages.auth.loginServiceUnavailable': '登录服务暂不可用',
          'pages.auth.loginRecoveryNextRateLimited': '请稍后再试或联系客服',
          'pages.auth.loginRecoveryNextLocked': '可重置密码或联系客服',
          'pages.auth.loginRecoveryNextUnavailable': '可先追踪订单或联系客服',
          'pages.auth.forgotPassword': '忘记密码',
          'nav.support': '客服',

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
  getGuestCartItems: jest.fn(() => []),
  replaceGuestCartItems: jest.fn(),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(() => null),
  getSessionStorageItem: jest.fn(() => null),
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

const makeGuestCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 1001,
  productId: 501,
  quantity: 1,
  productName: 'Harness kibble',
  imageUrl: '/products/harness-kibble.png',
  price: 12.5,
  ...overrides,
});

describe('Login CSS contracts', () => {
  it('keeps the login page responsive across desktop, tablet, and narrow mobile rails', () => {
    const css = readLoginCss();

    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('@media (max-width: 360px)');
    expect(css).toContain('grid-template-columns: 1fr;');
    expect(css).toContain('overflow-x: clip;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 70px;');
  });

  it('keeps login page colors behind local CSS custom properties', () => {
    const css = readLoginCss();
    const cssWithoutTokenDefinitions = css
      .split('\n')
      .filter((line) => !/^\s*--login-/.test(line))
      .join('\n');

    expect(css).toContain('--login-brand: #124734;');
    expect(css).toContain('--login-accent: #ee4d2d;');
    expect(cssWithoutTokenDefinitions).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(cssWithoutTokenDefinitions).not.toMatch(/rgba?\(\s*\d/);
    expect(css).not.toMatch(/#(?:1890ff|52c41a|722ed1|f0f2f5|fff)\b/i);
  });

  it('keeps CSS pseudo-element content free of hardcoded localized text', () => {
    const css = readLoginCss();
    const contentDeclarations = css.match(/content:\s*(['"])[\s\S]*?\1\s*;/g) || [];

    expect(css).not.toContain('或使用以下方式登录');
    contentDeclarations.forEach((declaration) => {
      expect(declaration).not.toMatch(/[\u4e00-\u9fff]/);
    });
  });
});

describe('Login accessibility labels', () => {
  beforeEach(() => {
    mockLanguage = 'en';
    jest.clearAllMocks();
    (userApi.login as jest.Mock).mockReset();
    (userApi.emailLogin as jest.Mock).mockReset();
    (userApi.sendEmailLoginCode as jest.Mock).mockReset();
    (cartApi.addItem as jest.Mock).mockReset();
    (persistAuthSession as jest.Mock).mockReset();
    (getGuestCartItems as jest.Mock).mockReset();
    (replaceGuestCartItems as jest.Mock).mockReset();
    (getGuestCartItems as jest.Mock).mockReturnValue([]);
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
    expect(contrastCss).toMatch(/background:\s*var\(--login-accent-hover,\s*#a8321f\)\s*!important;/);
    expect(contrastCss).toMatch(/border-color:\s*var\(--login-accent-hover,\s*#a8321f\)\s*!important;/);
    expect(contrastCss).toMatch(/color:\s*var\(--login-surface,\s*#ffffff\)\s*!important;/);
    expect(contrastCss).toMatch(/-webkit-text-fill-color:\s*var\(--login-surface,\s*#ffffff\)\s*!important;/);
    expect(contrastCss).toMatch(/box-shadow:\s*0 8px 20px rgba\(var\(--login-accent-hover-rgb,\s*168,\s*50,\s*31\),\s*0\.22\)\s*!important;/);
    expect(contrastCss).toMatch(/:focus-visible[\s\S]*?background:\s*var\(--login-link-active,\s*#8f2d17\)\s*!important;[\s\S]*?border-color:\s*var\(--login-link-active,\s*#8f2d17\)\s*!important;/);
    expect(linkStart).toBeGreaterThanOrEqual(0);
    expect(linkCss).toContain('.shopee-login-links a[href]');
    expect(linkCss).toMatch(/color:\s*var\(--login-accent-hover,\s*#a8321f\)\s*!important;/);
    expect(linkCss).toMatch(/text-decoration:\s*none\s*!important;/);
  });

  it('keeps the native APP login header readable on the dark auth surface', () => {
    const css = readMobileAppCss();
    const guardStart = css.indexOf('UI-20260607-11');
    const guardCss = css.slice(guardStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-appHeader\s*\{[\s\S]*?background:\s*#124734\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-appHeader__icon\s*\{[\s\S]*?background:\s*#ffffff\s*!important;[\s\S]*?color:\s*#124734\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-appHeader__copy strong,[\s\S]*?\.shop-app-shell--auth-flow \.shopee-login-appHeader__copy span\s*\{[\s\S]*?color:\s*#ffffff\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-appHeader__copy span\s*\{[\s\S]*?color:\s*#d8f1e3\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-appHeader__status\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.12\)\s*!important;[\s\S]*?color:\s*#ffffff\s*!important;/);
  });

  it('keeps localized APP login tabs and auth links tappable on narrow WebViews', () => {
    const css = readMobileAppCss();
    const guardStart = css.indexOf('F3592 APP closure');
    const guardCss = css.slice(guardStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guardCss).toContain('@media (max-width: 640px)');
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-tabs \.ant-tabs-nav-list\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-tabs \.ant-tabs-tab\s*\{[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?padding:\s*8px\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-tabs \.ant-tabs-tab-btn\s*\{[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-links\s*\{[\s\S]*?flex-wrap:\s*wrap\s*!important;[\s\S]*?gap:\s*8px 12px\s*!important;/);
    expect(guardCss).toMatch(/\.shop-app-shell--auth-flow \.shopee-login-links a,[\s\S]*?\.shop-app-shell--auth-flow \.shopee-login-links button\s*\{[\s\S]*?min-width:\s*44px\s*!important;[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;/);
  });

  it('keeps Login primary CTAs and validation errors contrast-safe outside APP', () => {
    const css = readLoginCss();
    const contrastStart = css.indexOf('/* Login commercial contrast closure');
    const contrastCss = css.slice(contrastStart);

    expect(contrastStart).toBeGreaterThanOrEqual(0);
    expect(contrastCss).toMatch(/\.shopee-login-card \.ant-btn-primary:not\(:disabled\):not\(\.ant-btn-disabled\),[\s\S]*?\.shopee-login-panel__actions \.ant-btn-primary:not\(:disabled\):not\(\.ant-btn-disabled\)\s*\{[\s\S]*?background:\s*var\(--login-accent-hover\)\s*!important;[\s\S]*?border-color:\s*var\(--login-accent-hover\)\s*!important;[\s\S]*?color:\s*var\(--login-surface\)\s*!important;[\s\S]*?-webkit-text-fill-color:\s*var\(--login-surface\)\s*!important;/);
    expect(contrastCss).toMatch(/\.shopee-login-card \.ant-btn-primary:not\(:disabled\):not\(\.ant-btn-disabled\):hover,[\s\S]*?\.shopee-login-panel__actions \.ant-btn-primary:not\(:disabled\):not\(\.ant-btn-disabled\):focus-visible\s*\{[\s\S]*?background:\s*var\(--login-link-active\)\s*!important;[\s\S]*?border-color:\s*var\(--login-link-active\)\s*!important;/);
    expect(contrastCss).toMatch(/\.shopee-login-card \.ant-form-item-explain-error,[\s\S]*?\.shopee-login-card \.ant-typography-danger\s*\{[\s\S]*?color:\s*var\(--login-link-active\)\s*!important;[\s\S]*?-webkit-text-fill-color:\s*var\(--login-link-active\)\s*!important;[\s\S]*?opacity:\s*1\s*!important;/);
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

  it('keeps any future OAuth or social login buttons explicitly named', () => {
    const source = readLoginPageSource();
    const buttonBlocks = source.match(/<(?:Button|button)\b[\s\S]*?<\/(?:Button|button)>/g) || [];
    const oauthButtonBlocks = buttonBlocks.filter((block) => /\b(?:OAuth|oauth|Google|google|GitHub|github|thirdParty|social)\b/.test(block));

    oauthButtonBlocks.forEach((block) => {
      expect(block).toMatch(/aria-label=|aria-labelledby=/);
    });
  });

  it('clears stale auth credentials when the login page mounts without clearing browsing state', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(clearStoredAuthCredentials).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit login visits on the login page so users can switch accounts', async () => {
    render(
      <MemoryRouter initialEntries={['/login?redirect=%2Fprofile']}>
        <Login />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?redirect=%2Fprofile'));
    expect(clearStoredAuthCredentials).toHaveBeenCalledTimes(1);
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
    expect(source).toContain('const emailCodeSendingRef = useRef(false);');
    expect(source).toContain('if (passwordSubmittingRef.current) return;');
    expect(source).toContain('passwordSubmittingRef.current = true;');
    expect(source).toContain('passwordSubmittingRef.current = false;');
    expect(source).toContain('if (emailSubmittingRef.current) return;');
    expect(source).toContain('emailSubmittingRef.current = true;');
    expect(source).toContain('emailSubmittingRef.current = false;');
    expect(source).toContain('if (emailCodeSendingRef.current) return;');
    expect(source).toContain('emailCodeSendingRef.current = true;');
    expect(source).toContain('emailCodeSendingRef.current = false;');
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

  it('does not send the email login code twice during the same pending request', async () => {
    (userApi.sendEmailLoginCode as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Email code login' }));
    fireEvent.change(screen.getByLabelText('Email code login: Log in: Email'), {
      target: { value: 'customer@example.com' },
    });
    const sendButton = screen.getByRole('button', { name: 'Email code login: Log in: Send code' });

    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    await waitFor(() => expect(userApi.sendEmailLoginCode).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sendButton).toBeDisabled());
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

  it('reads the guest cart once instead of rereading local storage on every login render', () => {
    (getGuestCartItems as jest.Mock).mockReturnValue([makeGuestCartItem({ quantity: 2 })]);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    expect(getGuestCartItems).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Email code login' }));
    fireEvent.change(screen.getByLabelText('Email code login: Log in: Verification code'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Password login' }));

    expect(getGuestCartItems).toHaveBeenCalledTimes(1);
  });

  it('sends guest cart merge requests in parallel and preserves failed items after login', async () => {
    const firstItem = makeGuestCartItem({ id: 1001, productId: 501, quantity: 2, selectedSpecs: 'size=m' });
    const failedItem = makeGuestCartItem({ id: 1002, productId: 502, quantity: 1, selectedSpecs: 'color=red' });
    const thirdItem = makeGuestCartItem({ id: 1003, productId: 503, quantity: 3 });
    let resolveFirst: (value?: unknown) => void = () => {};
    let rejectSecond: (error?: unknown) => void = () => {};
    let resolveThird: (value?: unknown) => void = () => {};

    (getGuestCartItems as jest.Mock).mockReturnValue([firstItem, failedItem, thirdItem]);
    (persistAuthSession as jest.Mock).mockReturnValue('session-token');
    (userApi.login as jest.Mock).mockResolvedValue({
      data: { id: 42, token: 'session-token', username: 'customer@example.com' },
    });
    (cartApi.addItem as jest.Mock)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSecond = reject; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveThird = resolve; }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Password login: Log in' }));

    await waitFor(() => expect(cartApi.addItem).toHaveBeenCalledTimes(3));
    expect(cartApi.addItem).toHaveBeenNthCalledWith(1, 42, 501, 2, 'size=m');
    expect(cartApi.addItem).toHaveBeenNthCalledWith(2, 42, 502, 1, 'color=red');
    expect(cartApi.addItem).toHaveBeenNthCalledWith(3, 42, 503, 3, undefined);
    expect(replaceGuestCartItems).not.toHaveBeenCalled();

    resolveFirst({});
    rejectSecond(new Error('stock unavailable'));
    resolveThird({});

    await waitFor(() => expect(replaceGuestCartItems).toHaveBeenCalledWith([failedItem]));
    expect(getGuestCartItems).toHaveBeenCalledTimes(1);
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

  it('shows multipath recovery exits when password login is rate limited', async () => {
    mockLanguage = 'en';
    (userApi.login as jest.Mock).mockRejectedValueOnce({
      response: { status: 429, data: { message: 'Too many login attempts' } },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Password login: Log in: Username'), {
      target: { value: 'customer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password login: Log in: Password'), {
      target: { value: 'wrong-password-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Password login: Log in' }));

    await waitFor(() => expect(screen.getAllByText('Too many login attempts. Please try again later.').length).toBeGreaterThan(0));
    const recovery = document.querySelector('[data-login-recovery-actions="true"]');
    expect(recovery).toBeTruthy();
    expect(recovery?.textContent).toMatch(/Forgot password/i);
    expect(recovery?.textContent).toMatch(/Track order/i);
    expect(recovery?.textContent).toMatch(/Support/i);
    expect(document.querySelector('[data-login-error-kind="rate_limited"]')).toBeTruthy();
  });

  it('keeps login rate-limit multipath recovery wired in source and styles', () => {
    const source = readLoginPageSource();
    const css = readLoginCss();
    expect(source).toContain('data-login-recovery-actions');
    expect(source).toContain("recoveryKind: 'rate_limited'");
    expect(css).toContain('shopee-login-errorRecovery__actions');
  });

});

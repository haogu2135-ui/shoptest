import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

jest.mock('../api', () => ({
  cartApi: { addItem: jest.fn() },
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
    language: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'common.loading': 'Loading',
        'nav.help': 'Help',
        'nav.register': 'Register',
        'nav.trackOrder': 'Track order',
        'pages.auth.email': 'Email',
        'pages.auth.emailCodeSending': 'Sending code',
        'pages.auth.emailLogin': 'Email code login',
        'pages.auth.emailLoginHint': 'Use a one-time email code.',
        'pages.auth.emailLoginTrust': 'Email login trust signals',
        'pages.auth.loginHeroSubtitle': 'Keep checkout ready.',
        'pages.auth.loginTitle': 'Log in',
        'pages.auth.loginTrustCart': 'Recover guest cart',
        'pages.auth.loginTrustSecure': 'Secure account',
        'pages.auth.loginTrustTitle': 'Login benefits',
        'pages.auth.loginTrustTracking': 'Track every order',
        'pages.auth.mobileLoginTitle': 'Secure mobile login',
        'pages.auth.mobileQuickActions': 'Quick actions',
        'pages.auth.password': 'Password',
        'pages.auth.passwordLogin': 'Password login',
        'pages.auth.register': 'Register',
        'pages.auth.resendIn': `Resend in ${params?.seconds}s`,
        'pages.auth.sendCode': 'Send code',
        'pages.auth.username': 'Username',
        'pages.auth.verificationCode': 'Verification code',
      };
      return labels[key] || key;
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
  removeSessionStorageItem: jest.fn(),
}));

jest.mock('../utils/apiError', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

describe('Login accessibility labels', () => {
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
});

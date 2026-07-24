import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import type { FormInstance } from 'antd';
import ShopInput, { ShopPasswordInput } from '../components/ShopInput';
import { Link } from 'react-router-dom';
import ShopButton from '../components/ShopButton';
import ShopAlert from '../components/ShopAlert';
import { dispatchDomEvent } from '../utils/domEvents';
import {
  authRecoveryNextKey,
  normalizeEmailCode,
  normalizePasswordLogin,
  scrollFirstLoginErrorIntoView,
  type AuthRecoveryKind,
  type EmailLoginValues,
  type PasswordLoginValues,
  type TranslationFunction,
} from './loginHelpers';

export type LoginPanelsProps = {
  t: TranslationFunction;
  navigate: NavigateFunction;
  guestCartCount: number;
  authBannerError: string | null;
  authRecoveryKind: AuthRecoveryKind;
  setAuthBannerError: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthRecoveryKind: React.Dispatch<React.SetStateAction<AuthRecoveryKind>>;
  activeLoginTab: string;
  setActiveLoginTab: React.Dispatch<React.SetStateAction<string>>;
  passwordForm: FormInstance;
  emailForm: FormInstance;
  loading: boolean;
  codeSending: boolean;
  sendCodeCountdown: number;
  verifyRetryCountdown: number;
  codeTtlMinutes: number;
  sentEmailHint: string;
  setSentEmailHint: React.Dispatch<React.SetStateAction<string>>;
  setSendCodeCountdown: React.Dispatch<React.SetStateAction<number>>;
  setVerifyRetryCountdown: React.Dispatch<React.SetStateAction<number>>;
  setCodeTtlMinutes: React.Dispatch<React.SetStateAction<number>>;
  emailCodeLength: number;
  emailCodeEnabled: boolean;
  canSubmitEmailCode: boolean;
  appConfigLoading: boolean;
  codeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  loginRegisterActionLabel: string;
  loginTrackOrderActionLabel: string;
  loginSupportActionLabel: string;
  passwordLoginActionLabel: string;
  emailLoginActionLabel: string;
  passwordLoginUsernameInputLabel: string;
  passwordLoginPasswordInputLabel: string;
  passwordVisibilityActionLabel: (visible: boolean) => string;
  emailLoginEmailInputLabel: string;
  emailLoginCodeInputLabel: string;
  sendEmailCodeActionLabel: string;
  onFinish: (values: PasswordLoginValues) => void;
  onEmailLogin: (values: EmailLoginValues) => void;
  sendEmailCode: () => void;
};

export const LoginMainPanels: React.FC<LoginPanelsProps> = ({
  t,
  navigate,
  guestCartCount,
  authBannerError,
  authRecoveryKind,
  setAuthBannerError,
  setAuthRecoveryKind,
  activeLoginTab,
  setActiveLoginTab,
  passwordForm,
  emailForm,
  loading,
  codeSending,
  sendCodeCountdown,
  verifyRetryCountdown,
  codeTtlMinutes,
  sentEmailHint,
  setSentEmailHint,
  setSendCodeCountdown,
  setVerifyRetryCountdown,
  setCodeTtlMinutes,
  emailCodeLength,
  emailCodeEnabled,
  canSubmitEmailCode,
  appConfigLoading,
  codeInputRef,
  loginRegisterActionLabel,
  loginTrackOrderActionLabel,
  loginSupportActionLabel,
  passwordLoginActionLabel,
  emailLoginActionLabel,
  passwordLoginUsernameInputLabel,
  passwordLoginPasswordInputLabel,
  passwordVisibilityActionLabel,
  emailLoginEmailInputLabel,
  emailLoginCodeInputLabel,
  sendEmailCodeActionLabel,
  onFinish,
  onEmailLogin,
  sendEmailCode,
}) => (
    <main className="shopee-login-root">
      <section className="shopee-login-shell">
        <aside className="shopee-login-panel">
          <p className="shopee-login-panel__eyebrow">{t('pages.auth.loginTrustTitle')}</p>
          <h1 className="shopee-login-panel__title">{t('pages.auth.loginTitle')}</h1>
          <p className="shopee-login-panel__subtitle">
            {guestCartCount > 0
              ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
              : t('pages.auth.loginHeroSubtitle')}
          </p>
          <div className="shopee-login-panel__featureList" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.cart} />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.truck} />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-panel__feature">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__spotlight">
            <div className="shopee-login-panel__spotlightCard">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>{t('pages.auth.loginStatTrackingValue')}</strong>
              <span>{t('nav.trackOrder')}</span>
            </div>
            <div className="shopee-login-panel__spotlightCard">
              <strong>{t('pages.auth.loginStatSecureValue')}</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-panel__actions">
            <ShopButton type="primary" size="large" aria-label={loginRegisterActionLabel} title={loginRegisterActionLabel} onClick={() => navigate('/register')}>
              {t('pages.auth.register')}
            </ShopButton>
            <ShopButton ghost size="large" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </ShopButton>
          </div>
        </aside>

        <section className="shopee-login-card">
          <div className="shopee-login-appHeader" aria-label={t('pages.auth.mobileLoginTitle')}>
            <span className="shopee-login-appHeader__icon">
              <ShopIcon path={SI.phone} />
            </span>
            <span className="shopee-login-appHeader__copy">
              <strong>{t('pages.auth.mobileAppLabel')}</strong>
              <span>{t('pages.auth.mobileLoginTitle')}</span>
            </span>
            <span className="shopee-login-appHeader__status">
              <ShopIcon path={SI.safety} />
              {t('pages.auth.mobileSecure')}
            </span>
          </div>
          <div className="shopee-login-appActions" aria-label={t('pages.auth.mobileQuickActions')}>
            <button type="button" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              <ShopIcon path={SI.truck} />
              <span>{t('nav.trackOrder')}</span>
            </button>
            <button type="button" aria-label={loginSupportActionLabel} title={loginSupportActionLabel} onClick={() => dispatchDomEvent('shop:open-support')}>
              <ShopIcon path={SI.support} />
              <span>{t('nav.help')}</span>
            </button>
          </div>
          <div className="shopee-login-card__header">
            <div className="shopee-login-brand">
              <div className="shopee-login-mark">{t('common.brand')}</div>
              <div className="shopee-login-subtitle">{t('pages.auth.loginTitle')}</div>
            </div>
            <p className="shopee-login-card__intro">
              {guestCartCount > 0
                ? t('pages.auth.loginGuestCartHint', { count: guestCartCount })
                : t('pages.auth.loginHeroSubtitle')}
            </p>
          </div>
          <div className="shopee-login-card__stats" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-card__stat">
              <strong>{guestCartCount}</strong>
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>{t('pages.auth.loginStatTrackingValue')}</strong>
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-card__stat">
              <strong>{t('pages.auth.loginStatSecureValue')}</strong>
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>
          <div className="shopee-login-trust" aria-label={t('pages.auth.loginTrustTitle')}>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.cart} />
              <span>{t('pages.auth.loginTrustCart')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.truck} />
              <span>{t('pages.auth.loginTrustTracking')}</span>
            </div>
            <div className="shopee-login-trust__item">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.loginTrustSecure')}</span>
            </div>
          </div>

          {authBannerError ? (
            <div
              className="shopee-login-errorRecovery"
              data-login-error-recovery="true"
              data-login-error-kind={authRecoveryKind || 'generic'}
            >
              <ShopAlert
                className="shopee-login-errorBanner"
                type="error"
                showIcon
                closable
                role="alert"
                message={authBannerError}
                description={authRecoveryKind ? t(authRecoveryNextKey(authRecoveryKind)) : undefined}
                onClose={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                }}
              />
              {authRecoveryKind ? (
                <div className="shopee-login-errorRecovery__actions" data-login-recovery-actions="true">
                  <ShopButton
                    type="primary"
                    block
                    size="large"
                    onClick={() => navigate('/forgot-password')}
                    aria-label={t('pages.auth.forgotPassword')}
                    title={t('pages.auth.forgotPassword')}
                  >
                    {t('pages.auth.forgotPassword')}
                  </ShopButton>
                  <ShopButton
                    block
                    size="large"
                    onClick={() => navigate('/track-order')}
                    aria-label={t('nav.trackOrder')}
                    title={t('nav.trackOrder')}
                  >
                    {t('nav.trackOrder')}
                  </ShopButton>
                  <ShopButton
                    block
                    size="large"
                    onClick={() => dispatchDomEvent('shop:open-support')}
                    aria-label={t('nav.support')}
                    title={t('nav.support')}
                  >
                    {t('nav.support')}
                  </ShopButton>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={`shopee-login-tabs shopee-login-tabs--${activeLoginTab}`}>
            <div
              className="shopee-login-tabs__nav"
              role="tablist"
              aria-label={t('pages.auth.login')}
            >
              <button
                type="button"
                role="tab"
                id="login-tab-password"
                className={`shopee-login-tabs__tab${activeLoginTab === 'password' ? ' shopee-login-tabs__tab--active' : ''}`}
                aria-selected={activeLoginTab === 'password'}
                aria-controls="login-panel-password"
                tabIndex={activeLoginTab === 'password' ? 0 : -1}
                onClick={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                  setActiveLoginTab('password');
                }}
              >
                <span className="shopee-login-tabs__tabLabel">{t('pages.auth.passwordLogin')}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="login-tab-email"
                className={`shopee-login-tabs__tab${activeLoginTab === 'email' ? ' shopee-login-tabs__tab--active' : ''}`}
                aria-selected={activeLoginTab === 'email'}
                aria-controls="login-panel-email"
                tabIndex={activeLoginTab === 'email' ? 0 : -1}
                onClick={() => {
                  setAuthBannerError(null);
                  setAuthRecoveryKind(null);
                  setActiveLoginTab('email');
                }}
              >
                <span className="shopee-login-tabs__tabLabel">{t('pages.auth.emailLogin')}</span>
              </button>
            </div>
            <div
              className="shopee-login-tabs__panel"
              role="tabpanel"
              id="login-panel-password"
              aria-labelledby="login-tab-password"
              hidden={activeLoginTab !== 'password'}
            >
<Form form={passwordForm} name="login" onFinish={onFinish} onFinishFailed={() => { window.requestAnimationFrame(() => window.requestAnimationFrame(scrollFirstLoginErrorIntoView)); }} layout="vertical" className="shopee-login-form" validateTrigger={["onChange", "onBlur"]} requiredMark>
                    <Form.Item name="username" label={t('pages.auth.username')} rules={[
                      { required: true, message: t('pages.auth.usernameRequired') },
                      { min: 3, message: t('pages.auth.usernameMinLength') },
                    ]}>
                      <ShopInput
                        prefix={<ShopIcon path={SI.user} />}
                        placeholder={t('pages.auth.username')}
                        size="large"
                        autoComplete="username"
                        aria-label={passwordLoginUsernameInputLabel}
                        title={passwordLoginUsernameInputLabel}
                        onBlur={(event) => passwordForm.setFieldValue('username', normalizePasswordLogin(event.target.value))}
                      />
                    </Form.Item>
                    <Form.Item name="password" label={t('pages.auth.password')} rules={[
                      { required: true, message: t('pages.auth.passwordRequired') },
                      { min: 8, message: t('pages.auth.passwordMinLength') },
                    ]}>
                      <ShopPasswordInput
                        prefix={<ShopIcon path={SI.lock} />}
                        placeholder={t('pages.auth.password')}
                        size="large"
                        autoComplete="current-password"
                        aria-label={passwordLoginPasswordInputLabel}
                        title={passwordLoginPasswordInputLabel}
                        iconRender={(visible) => (
                          <button
                            type="button"
                            aria-label={passwordVisibilityActionLabel(visible)}
                            aria-pressed={visible}
                            title={passwordVisibilityActionLabel(visible)}
                           
                          >
                            {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
                          </button>
                        )}
                      />
                    </Form.Item>
                    <Form.Item>
                      <ShopButton type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading} aria-label={passwordLoginActionLabel} title={passwordLoginActionLabel}>
                        {t('pages.auth.login')}
                      </ShopButton>
                    </Form.Item>
                    <p className="shopee-login-legalNotice" role="note">
                      {t('pages.auth.loginAgreementPrefix')}{' '}
                      <Link to="/terms">{t('footer.terms')}</Link>
                      {' '}{t('pages.auth.loginAgreementAnd')}{' '}
                      <Link to="/privacy">{t('footer.privacy')}</Link>
                      {t('pages.auth.loginAgreementSuffix')}
                    </p>
                  </Form>
            </div>
            <div
              className="shopee-login-tabs__panel"
              role="tabpanel"
              id="login-panel-email"
              aria-labelledby="login-tab-email"
              hidden={activeLoginTab !== 'email'}
            >
<Form
                    form={emailForm}
                    name="email-login"
                    onFinish={onEmailLogin}
                    onFinishFailed={() => { window.requestAnimationFrame(() => window.requestAnimationFrame(scrollFirstLoginErrorIntoView)); }}
                    validateTrigger={['onChange', 'onBlur']}
                    requiredMark
                    onValuesChange={(changedValues) => {
                      if (Object.prototype.hasOwnProperty.call(changedValues, 'email')) {
                        setSentEmailHint('');
                        setSendCodeCountdown(0);
                        setVerifyRetryCountdown(0);
                        setCodeTtlMinutes(0);
                        emailForm.setFieldValue('code', '');
                      }
                    }}
                    layout="vertical"
                    className="shopee-login-form shopee-login-form--email"
                  >
                    <div className="shopee-login-emailHint">
                      <ShopIcon path={SI.mail} />
                      <span>{appConfigLoading ? t('common.loading') : t('pages.auth.emailLoginHint')}</span>
                    </div>
                    {!emailCodeEnabled && !appConfigLoading && (
                      <div className="shopee-login-emailHint shopee-login-emailHint--warning" role="status">
                        <ShopIcon path={SI.safety} />
                        <span>{t('pages.auth.emailCodeUnavailable')}</span>
                      </div>
                    )}
                    {sentEmailHint && (
                      <div className="shopee-login-emailSent" role="status">
                        <ShopIcon path={SI.safety} />
                        <span>
                          <strong>{t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}</strong>
                          {codeTtlMinutes > 0 && (
                            <small>{t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}</small>
                          )}
                        </span>
                      </div>
                    )}
                    <Form.Item
                      name="email"
                      label={t('pages.auth.email')}
                      className="shopee-login-form__field"
                      rules={[
                        { required: true, message: t('pages.auth.emailRequired') },
                        { type: 'email', message: t('pages.auth.emailInvalid') },
                      ]}
                    >
                      <ShopInput
                        prefix={<ShopIcon path={SI.mail} />}
                        placeholder={t('pages.auth.email')}
                        size="large"
                        autoComplete="email"
                        allowClear
                        disabled={loading || !emailCodeEnabled}
                        aria-label={emailLoginEmailInputLabel}
                        title={emailLoginEmailInputLabel}
                      />
                    </Form.Item>
                    <Form.Item
                      name="code"
                      label={t('pages.auth.verificationCode')}
                      className="shopee-login-form__field shopee-login-form__field--code"
                      rules={[
                        { required: true, message: t('pages.auth.emailCodeRequired') },
                        { len: 6, message: t('pages.auth.emailCodeLength') },
                      ]}
                    >
                      <ShopInput
                        ref={codeInputRef}
                        className="shopee-login-codeInput"
                        prefix={<ShopIcon path={SI.safety} />}
                        placeholder={t('pages.auth.verificationCode')}
                        size="large"
                        maxLength={6}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        disabled={loading || !emailCodeEnabled}
                        aria-label={emailLoginCodeInputLabel}
                        title={emailLoginCodeInputLabel}
                        onChange={(event) => {
                          const normalized = normalizeEmailCode(event.target.value);
                          if (normalized !== event.target.value) {
                            emailForm.setFieldValue('code', normalized);
                          }
                        }}
                        addonAfter={
                          <ShopButton
                            type="link"
                            size="small"
                            className="shopee-login-codeButton"
                            loading={codeSending}
                            disabled={loading || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                            onClick={sendEmailCode}
                            aria-label={sendEmailCodeActionLabel}
                            title={sendEmailCodeActionLabel}
                          >
                            {codeSending
                              ? t('pages.auth.emailCodeSending')
                              : sendCodeCountdown > 0
                              ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
                              : t('pages.auth.sendCode')}
                          </ShopButton>
                        }
                      />
                    </Form.Item>
                    <div className="shopee-login-codeProgress" aria-live="polite">
                      {verifyRetryCountdown > 0
                        ? t('pages.auth.emailCodeRetryIn', { seconds: verifyRetryCountdown })
                        : t('pages.auth.emailCodeProgress', { count: emailCodeLength })}
                    </div>
                    <div className="shopee-login-emailMeta" aria-label={t('pages.auth.emailLoginTrust')}>
                      <span>
                        <ShopIcon path={SI.safety} />
                        {t('pages.auth.emailCodePrivacy')}
                      </span>
                      <span>
                        <ShopIcon path={SI.mail} />
                        {t('pages.auth.emailCodeFast')}
                      </span>
                    </div>
                    <Form.Item>
                      <ShopButton className="shopee-login-emailSubmit" type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading || codeSending || !canSubmitEmailCode} aria-label={emailLoginActionLabel} title={emailLoginActionLabel}>
                        {verifyRetryCountdown > 0
                          ? t('pages.auth.emailCodeRetryIn', { seconds: verifyRetryCountdown })
                          : t('pages.auth.emailLogin')}
                      </ShopButton>
                    </Form.Item>
                    <p className="shopee-login-legalNotice" role="note">
                      {t('pages.auth.loginAgreementPrefix')}{' '}
                      <Link to="/terms">{t('footer.terms')}</Link>
                      {' '}{t('pages.auth.loginAgreementAnd')}{' '}
                      <Link to="/privacy">{t('footer.privacy')}</Link>
                      {t('pages.auth.loginAgreementSuffix')}
                    </p>
                  </Form>
            </div>
          </div>

          <div className="shopee-login-quickLinks">
            <button type="button" aria-label={loginTrackOrderActionLabel} title={loginTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              <ShopIcon path={SI.truck} />
              <span>{t('nav.trackOrder')}</span>
            </button>
            <Link to="/register">
              <ShopIcon path={SI.compass} />
              <span>{t('pages.auth.register')}</span>
            </Link>
          </div>

          <div className="shopee-login-links">
            <Link to="/forgot-password">{t('pages.auth.forgotPassword')}</Link>
            <Link to="/register">{t('pages.auth.register')}</Link>
          </div>
        </section>
      </section>
    </main>

);

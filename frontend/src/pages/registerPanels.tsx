import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Form } from 'antd';
import type { FormInstance } from 'antd';
import ShopInput, { ShopPasswordInput } from '../components/ShopInput';
import { Link } from 'react-router-dom';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import { dispatchDomEvent } from '../utils/domEvents';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  normalizeEmail,
  normalizeEmailCode,
  normalizeLikelyPhone,
  normalizeUsername,
  phonePattern,
  type RegisterForm,
  type RegisterRecoveryKind,
  type RegisterTranslate,
} from './registerHelpers';

export type RegisterPanelsProps = {
  t: RegisterTranslate;
  navigate: NavigateFunction;
  form: FormInstance<RegisterForm>;
  authBannerError: string | null;
  authRecoveryKind: RegisterRecoveryKind;
  setAuthBannerError: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthRecoveryKind: React.Dispatch<React.SetStateAction<RegisterRecoveryKind>>;
  registering: boolean;
  codeSending: boolean;
  sendCodeCountdown: number;
  codeTtlMinutes: number;
  sentEmailHint: string;
  emailCodeRequired: boolean;
  emailCodeEnabled: boolean;
  appConfigLoading: boolean;
  codeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  registerLoginActionLabel: string;
  registerTrackOrderActionLabel: string;
  usernameInputLabel: string;
  passwordInputLabel: string;
  confirmPasswordInputLabel: string;
  passwordVisibilityActionLabel: (visible: boolean) => string;
  confirmPasswordVisibilityActionLabel: (visible: boolean) => string;
  emailInputLabel: string;
  emailCodeInputLabel: string;
  phoneInputLabel: string;
  registerSendCodeActionLabel: string;
  registerSubmitActionLabel: string;
  validateStrongPassword: (_rule: unknown, value?: string) => Promise<void>;
  onFinish: (values: RegisterForm) => void;
  onFinishFailed: () => void;
  sendRegisterCode: () => void;
};

export const RegisterMainPanels: React.FC<RegisterPanelsProps> = ({
  t,
  navigate,
  form,
  authBannerError,
  authRecoveryKind,
  setAuthBannerError,
  setAuthRecoveryKind,
  registering,
  codeSending,
  sendCodeCountdown,
  codeTtlMinutes,
  sentEmailHint,
  emailCodeRequired,
  emailCodeEnabled,
  appConfigLoading,
  codeInputRef,
  registerLoginActionLabel,
  registerTrackOrderActionLabel,
  usernameInputLabel,
  passwordInputLabel,
  confirmPasswordInputLabel,
  passwordVisibilityActionLabel,
  confirmPasswordVisibilityActionLabel,
  emailInputLabel,
  emailCodeInputLabel,
  phoneInputLabel,
  registerSendCodeActionLabel,
  registerSubmitActionLabel,
  validateStrongPassword,
  onFinish,
  onFinishFailed,
  sendRegisterCode,
}) => (
    <div className="register-page">
      <section className="register-page__panel">
        <div className="register-page__copy">
          <p className="register-page__eyebrow">{t('pages.auth.registerEyebrow')}</p>
          <h1 className="register-page__heroTitle">{t('pages.auth.registerHeroTitle')}</h1>
          <p className="register-page__heroSubtitle">{t('pages.auth.registerHeroSubtitle')}</p>
          <div className="register-page__trustGrid">
            <ShopTag icon={<ShopIcon path={SI.safety} />} color="green">{t('pages.auth.registerTrustSecure')}</ShopTag>
            <ShopTag icon={<ShopIcon path={SI.gift} />} color="orange">{t('pages.auth.registerTrustPerks')}</ShopTag>
            <ShopTag icon={<ShopIcon path={SI.truck} />} color="blue">{t('pages.auth.registerTrustTracking')}</ShopTag>
          </div>
          <div className="register-page__featureCards">
            <div className="register-page__featureCard">
              <ShopIcon path={SI.safety} />
              <div>
                <strong>{t('pages.auth.registerTrustSecure')}</strong>
                <span>{t('pages.auth.registerPrivacyHint')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <ShopIcon path={SI.gift} />
              <div>
                <strong>{t('pages.auth.registerTrustPerks')}</strong>
                <span>{t('pages.auth.registerHeroSubtitle')}</span>
              </div>
            </div>
            <div className="register-page__featureCard">
              <ShopIcon path={SI.truck} />
              <div>
                <strong>{t('pages.auth.registerTrustTracking')}</strong>
                <span>{t('nav.trackOrder')}</span>
              </div>
            </div>
          </div>
          <div className="register-page__actions">
            <ShopButton type="primary" size="large" aria-label={registerLoginActionLabel} title={registerLoginActionLabel} onClick={() => navigate('/login')}>
              {t('pages.auth.loginNow')}
            </ShopButton>
            <ShopButton ghost size="large" aria-label={registerTrackOrderActionLabel} title={registerTrackOrderActionLabel} onClick={() => navigate('/track-order')}>
              {t('nav.trackOrder')}
            </ShopButton>
          </div>
        </div>
      </section>
      <section className="register-page__card">
        <div className="register-page__cardHeader">
          <div className="register-page__brand">{t('common.brand')}</div>
          <p className="register-page__cardHint">{t('pages.auth.registerPrivacyHint')}</p>
        </div>
        <h2 className="register-page__title">
          {t('pages.auth.registerTitle')}
        </h2>
        {authBannerError ? (
          <div
            className="register-page__errorRecovery"
            data-register-error-recovery="true"
            data-register-error-kind={authRecoveryKind || 'generic'}
          >
            <ShopAlert
              className="register-page__errorBanner"
              type="error"
              showIcon
              closable
              role="alert"
              message={authBannerError}
              description={authRecoveryKind === 'rate_limited' ? t('pages.auth.registerRecoveryNextRateLimited') : undefined}
              onClose={() => {
                setAuthBannerError(null);
                setAuthRecoveryKind(null);
              }}
            />
            {authRecoveryKind === 'rate_limited' ? (
              <div className="register-page__errorRecovery__actions" data-register-recovery-actions="true">
                <ShopButton
                  type="primary"
                  block
                  size="large"
                  onClick={() => navigate('/login')}
                  aria-label={t('pages.auth.loginNow')}
                  title={t('pages.auth.loginNow')}
                >
                  {t('pages.auth.loginNow')}
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
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          validateTrigger={['onChange', 'onBlur']}
          requiredMark
        >
          <Form.Item
            name="username"
            label={t('pages.auth.usernameShort')}
            rules={[
              { required: true, message: t('pages.auth.usernameRequired') },
              { min: 3, message: t('pages.auth.usernameMin') }
            ]}
          >
            <ShopInput
              prefix={<ShopIcon path={SI.user} />}
              placeholder={t('pages.auth.usernameShort')}
              autoComplete="username"
              inputMode="text"
              maxLength={50}
              aria-label={usernameInputLabel}
              title={usernameInputLabel}
              onBlur={(event) => form.setFieldValue('username', normalizeUsername(event.target.value))}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('pages.auth.password')}
            rules={[
              { required: true, message: t('pages.auth.passwordRequired') },
              { min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.auth.passwordMin') },
              { validator: validateStrongPassword }
            ]}
          >
            <ShopPasswordInput
              prefix={<ShopIcon path={SI.lock} />}
              placeholder={t('pages.auth.password')}
              autoComplete="new-password"
              maxLength={STRONG_PASSWORD_MAX_LENGTH}
              aria-label={passwordInputLabel}
              title={passwordInputLabel}
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

          <Form.Item
            name="confirmPassword"
            label={t('pages.auth.confirmPassword')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('pages.auth.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('pages.auth.passwordMismatch')));
                },
              }),
            ]}
          >
            <ShopPasswordInput
              prefix={<ShopIcon path={SI.lock} />}
              placeholder={t('pages.auth.confirmPassword')}
              autoComplete="new-password"
              maxLength={128}
              aria-label={confirmPasswordInputLabel}
              title={confirmPasswordInputLabel}
              iconRender={(visible) => (
                <button
                  type="button"
                  aria-label={confirmPasswordVisibilityActionLabel(visible)}
                  aria-pressed={visible}
                  title={confirmPasswordVisibilityActionLabel(visible)}
                 
                >
                  {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
                </button>
              )}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('pages.auth.email')}
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') }
            ]}
          >
            <ShopInput
              prefix={<ShopIcon path={SI.mail} />}
              placeholder={t('pages.auth.email')}
              autoComplete="email"
              inputMode="email"
              maxLength={100}
              aria-label={emailInputLabel}
              title={emailInputLabel}
              onBlur={(event) => form.setFieldValue('email', normalizeEmail(event.target.value))}
            />
          </Form.Item>

          {emailCodeRequired && (
            <>
              {emailCodeRequired && sentEmailHint && (
                <p className="register-page__codeHint register-page__codeHint--secondary">
                  {t('pages.auth.emailCodeSentTo', { email: sentEmailHint })}
                  {codeTtlMinutes > 0 ? ` · ${t('pages.auth.emailCodeExpiresIn', { minutes: codeTtlMinutes })}` : ''}
                </p>
              )}
              {emailCodeRequired && !emailCodeEnabled && !appConfigLoading && (
                <p className="register-page__codeHint register-page__codeHint--warning">
                  {t('pages.auth.emailCodeUnavailable')}
                </p>
              )}
              <Form.Item
                name="emailCode"
                className="register-page__codeField"
                label={t('pages.auth.verificationCode')}
                rules={emailCodeRequired ? [
                  { required: true, message: t('pages.auth.emailCodeRequired') },
                  { len: 6, message: t('pages.auth.emailCodeLength') },
                ] : []}
              >
                <ShopInput
                  ref={codeInputRef}
                  prefix={<ShopIcon path={SI.safety} />}
                  placeholder={t('pages.auth.emailCodeRequired')}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={!emailCodeRequired}
                  aria-label={emailCodeInputLabel}
                  title={emailCodeInputLabel}
                  addonAfter={
                    <ShopButton
                      type="link"
                      size="small"
                      loading={codeSending}
                      disabled={registering || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                      aria-label={registerSendCodeActionLabel}
                      title={registerSendCodeActionLabel}
                      onClick={sendRegisterCode}
                    >
                      {codeSending
                        ? t('pages.auth.emailCodeSending')
                        : sendCodeCountdown > 0
                        ? t('pages.auth.resendIn', { seconds: sendCodeCountdown })
                        : t('pages.auth.sendCode')}
                    </ShopButton>
                  }
                  onChange={(event) => form.setFieldValue('emailCode', normalizeEmailCode(event.target.value))}
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="phone"
            label={t('pages.auth.phone')}
            rules={[
              { required: true, message: t('pages.auth.phoneRequired') },
              { pattern: phonePattern, message: t('pages.auth.phoneInvalid') }
            ]}
          >
            <ShopInput
              prefix={<ShopIcon path={SI.phone} />}
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              aria-label={phoneInputLabel}
              title={phoneInputLabel}
              onBlur={(event) => form.setFieldValue('phone', normalizeLikelyPhone(event.target.value))}
            />
          </Form.Item>

          <Form.Item>
            <ShopButton type="primary" htmlType="submit" block loading={registering} disabled={registering} aria-label={registerSubmitActionLabel} title={registerSubmitActionLabel}>
              {t('pages.auth.register')}
            </ShopButton>
          </Form.Item>
          <p className="register-page__legalNotice" role="note">
            {t('pages.auth.registerAgreementPrefix')}{' '}
            <Link to="/terms">{t('footer.terms')}</Link>
            {' '}{t('pages.auth.registerAgreementAnd')}{' '}
            <Link to="/privacy">{t('footer.privacy')}</Link>
            {t('pages.auth.registerAgreementSuffix')}
          </p>

          <div className="register-page__footer">
            <p className="register-page__footerHint">{t('pages.auth.registerPrivacyHint')}</p>
            <div>
              {t('pages.auth.alreadyAccount')}<Link to="/login">{t('pages.auth.loginNow')}</Link>
            </div>
          </div>
        </Form>
      </section>
    </div>
);

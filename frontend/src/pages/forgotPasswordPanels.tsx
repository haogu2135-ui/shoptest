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
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  normalizeEmailCode,
  normalizePasswordLogin,
  scrollFirstForgotPasswordErrorIntoView,
  type ForgotPasswordForm,
  type ForgotPasswordTranslate,
} from './forgotPasswordHelpers';

export type ForgotPasswordPanelsProps = {
  t: ForgotPasswordTranslate;
  navigate: NavigateFunction;
  form: FormInstance<ForgotPasswordForm>;
  loading: boolean;
  authBannerError: string | null;
  setAuthBannerError: React.Dispatch<React.SetStateAction<string | null>>;
  codeSending: boolean;
  sendCodeCountdown: number;
  codeTtlMinutes: number;
  sentEmailHint: string;
  emailCodeEnabled: boolean;
  resetUnavailable: boolean;
  codeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  resetLoginInputLabel: string;
  resetEmailInputLabel: string;
  resetCodeInputLabel: string;
  resetCodeActionText: string;
  resetSendCodeActionLabel: string;
  resetNewPasswordInputLabel: string;
  resetConfirmPasswordInputLabel: string;
  passwordVisibilityActionLabel: (visible: boolean) => string;
  confirmPasswordVisibilityActionLabel: (visible: boolean) => string;
  resetSubmitActionLabel: string;
  validateStrongPassword: (_rule: unknown, value?: string) => Promise<void>;
  onFinish: (values: ForgotPasswordForm) => void;
  sendResetCode: () => void;
};

export const ForgotPasswordMainPanels: React.FC<ForgotPasswordPanelsProps> = ({
  t,
  navigate,
  form,
  loading,
  authBannerError,
  setAuthBannerError,
  codeSending,
  sendCodeCountdown,
  codeTtlMinutes,
  sentEmailHint,
  emailCodeEnabled,
  resetUnavailable,
  codeInputRef,
  resetLoginInputLabel,
  resetEmailInputLabel,
  resetCodeInputLabel,
  resetCodeActionText,
  resetSendCodeActionLabel,
  resetNewPasswordInputLabel,
  resetConfirmPasswordInputLabel,
  passwordVisibilityActionLabel,
  confirmPasswordVisibilityActionLabel,
  resetSubmitActionLabel,
  validateStrongPassword,
  onFinish,
  sendResetCode,
}) => (
    <main className="shopee-login-root shopee-login-root--reset">
      <section className="shopee-login-card shopee-login-card--reset">
        <div className="shopee-login-brand">
          <div className="shopee-login-mark">{t('common.brand')}</div>
          <h1 className="shopee-login-subtitle shopee-login-subtitle--h1">{t('pages.auth.resetPasswordTitle')}</h1>
        </div>
        {!resetUnavailable ? (
          <div className="shopee-login-reset-guide" aria-label={t('pages.auth.resetGuideTitle')}>
            <div className="shopee-login-reset-guide__item">
              <ShopIcon path={SI.mail} />
              <span>{t('pages.auth.resetGuideEmail')}</span>
            </div>
            <div className="shopee-login-reset-guide__item">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.resetGuideVerify')}</span>
            </div>
            <div className="shopee-login-reset-guide__item">
              <ShopIcon path={SI.checkCircle} />
              <span>{t('pages.auth.resetGuideLogin')}</span>
            </div>
          </div>
        ) : null}

        {authBannerError ? (
          <ShopAlert
            className="shopee-login-errorBanner"
            type="error"
            showIcon
            closable
            role="alert"
            message={authBannerError}
            onClose={() => setAuthBannerError(null)}
          />
        ) : null}
        {resetUnavailable ? (
          <div className="shopee-login-resetUnavailable" data-forgot-password-unavailable="true" role="status">
            <ShopAlert
              type="warning"
              showIcon
              message={t('pages.auth.resetUnavailableTitle')}
              description={t('pages.auth.resetUnavailableText')}
            />
            <div className="shopee-login-resetUnavailable__actions" data-forgot-password-unavailable-actions="true">
              <ShopButton
                type="primary"
                block
                size="large"
                onClick={() => navigate('/login')}
                aria-label={t('pages.auth.backToPasswordLogin')}
                title={t('pages.auth.backToPasswordLogin')}
              >
                {t('pages.auth.backToPasswordLogin')}
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
                onClick={() => navigate('/products')}
                aria-label={t('pages.cart.browse')}
                title={t('pages.cart.browse')}
              >
                {t('pages.cart.browse')}
              </ShopButton>
              <ShopButton
                block
                size="large"
                onClick={() => navigate('/coupons')}
                aria-label={t('nav.coupons')}
                title={t('nav.coupons')}
              >
                {t('nav.coupons')}
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
          </div>
        ) : (
          <Form form={form} name="forgotPassword" onFinish={onFinish} onFinishFailed={() => { window.requestAnimationFrame(() => window.requestAnimationFrame(scrollFirstForgotPasswordErrorIntoView)); }} layout="vertical" className="shopee-login-form" validateTrigger={["onChange", "onBlur"]} requiredMark>
          <Form.Item name="login" rules={[{ required: true, message: t('pages.auth.usernameRequired') }]}>
            <ShopInput
              prefix={<ShopIcon path={SI.user} />}
              placeholder={t('pages.auth.username')}
              size="large"
              autoComplete="username"
              aria-label={resetLoginInputLabel}
              title={resetLoginInputLabel}
              onBlur={(event) => form.setFieldValue('login', normalizePasswordLogin(event.target.value))}
            />
          </Form.Item>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.auth.emailInvalid') },
            ]}
          >
            <ShopInput prefix={<ShopIcon path={SI.mail} />} placeholder={t('pages.auth.email')} size="large" autoComplete="email" disabled={loading || !emailCodeEnabled} aria-label={resetEmailInputLabel} title={resetEmailInputLabel} />
          </Form.Item>
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
            name="code"
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
              disabled={loading || !emailCodeEnabled}
              aria-label={resetCodeInputLabel}
              title={resetCodeInputLabel}
              onChange={(event) => {
                const normalized = normalizeEmailCode(event.target.value);
                if (normalized !== event.target.value) {
                  form.setFieldValue('code', normalized);
                }
              }}
              addonAfter={
                <ShopButton
                  type="link"
                  size="small"
                  className="shopee-login-codeButton"
                  loading={codeSending}
                  disabled={loading || codeSending || sendCodeCountdown > 0 || !emailCodeEnabled}
                  aria-label={resetSendCodeActionLabel}
                  title={resetSendCodeActionLabel}
                  onClick={sendResetCode}
                >
                  {resetCodeActionText}
                </ShopButton>
              }
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            rules={[
              { required: true, message: t('pages.auth.newPasswordRequired') },
              { min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.auth.passwordMin') },
              { validator: validateStrongPassword },
            ]}
          >
            <ShopPasswordInput
              prefix={<ShopIcon path={SI.lock} />}
              placeholder={t('pages.auth.newPassword')}
              size="large"
              autoComplete="new-password"
              maxLength={STRONG_PASSWORD_MAX_LENGTH}
              aria-label={resetNewPasswordInputLabel}
              title={resetNewPasswordInputLabel}
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
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('pages.auth.confirmRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
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
              size="large"
              autoComplete="new-password"
              aria-label={resetConfirmPasswordInputLabel}
              title={resetConfirmPasswordInputLabel}
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
          <Form.Item>
            <ShopButton type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading || codeSending || !emailCodeEnabled} aria-label={resetSubmitActionLabel} title={resetSubmitActionLabel}>
              {t('pages.auth.resetPassword')}
            </ShopButton>
          </Form.Item>
        </Form>
        )}

        <div className="shopee-login-links shopee-login-links--single">
          <Link to="/login">{t('pages.auth.backToLogin')}</Link>
        </div>
      </section>
    </main>
);

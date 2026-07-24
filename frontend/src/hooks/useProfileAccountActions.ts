import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import { userApi } from '../api';
import type { Language } from '../i18n';
import type { UserProfile } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import {
  focusProfileModalFormError,
  getProfileApiErrorCode,
  getProfileApiErrorData,
  isFormValidationError,
  normalizeEmailCode,
  normalizeProfileEmail,
  normalizeProfilePhone,
} from '../utils/profileHelpers';

type UseProfileAccountActionsParams = {
  editForm: FormInstance;
  emailCodeEnabled: boolean;
  fetchUserInfo: () => void | Promise<void>;
  language: Language;
  passwordForm: FormInstance;
  passwordSubmitting: boolean;
  setEditModalVisible: Dispatch<SetStateAction<boolean>>;
  setPasswordModalVisible: Dispatch<SetStateAction<boolean>>;
  setPasswordSubmitting: Dispatch<SetStateAction<boolean>>;
  setProfileEmailCodeCountdown: Dispatch<SetStateAction<number>>;
  setProfileEmailCodeSending: Dispatch<SetStateAction<boolean>>;
  setProfileEmailCodeSentTo: Dispatch<SetStateAction<string>>;
  setProfileEmailCodeTtlMinutes: Dispatch<SetStateAction<number>>;
  setProfileSubmitting: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
  user: UserProfile | null;
};

/**
 * Commercial profile account lifecycle:
 * edit profile, email verification code, and password change.
 */
export const useProfileAccountActions = ({
  editForm,
  emailCodeEnabled,
  fetchUserInfo,
  language,
  passwordForm,
  passwordSubmitting,
  setEditModalVisible,
  setPasswordModalVisible,
  setPasswordSubmitting,
  setProfileEmailCodeCountdown,
  setProfileEmailCodeSending,
  setProfileEmailCodeSentTo,
  setProfileEmailCodeTtlMinutes,
  setProfileSubmitting,
  t,
  user,
}: UseProfileAccountActionsParams) => {
  const handleEditProfile = async () => {
    try {
      const values = await editForm.validateFields();
      const normalizedEmail = normalizeProfileEmail(values.email);
      const emailChanged = normalizedEmail !== normalizeProfileEmail(user?.email);
      if (emailChanged && !emailCodeEnabled) {
        const msg = t('pages.auth.emailCodeUnavailable');
        editForm.setFields([{ name: 'emailCode', errors: [msg] }]);
        announceAccessibleMessage(msg, 'warning');
        return;
      }
      if (emailChanged && normalizeEmailCode(values.emailCode).length !== 6) {
        editForm.setFields([{ name: 'emailCode', errors: [t('pages.auth.emailCodeLength')] }]);
        return;
      }
      setProfileSubmitting(true);
      await userApi.updateProfile({
        email: normalizedEmail,
        phone: normalizeProfilePhone(values.phone),
        emailCode: emailChanged ? values.emailCode : '',
      });
      announceAccessibleMessage(t('pages.profile.updated'), 'success');
      setEditModalVisible(false);
      editForm.resetFields(['emailCode']);
      setProfileEmailCodeSentTo('');
      setProfileEmailCodeCountdown(0);
      fetchUserInfo();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      const errorCode = getProfileApiErrorCode(err);
      if (errorCode === 'INVALID_CODE' || errorCode === 'TOO_MANY_ATTEMPTS') {
        const msg = errorCode === 'TOO_MANY_ATTEMPTS'
          ? t('pages.auth.emailCodeTooManyAttempts')
          : t('pages.auth.emailCodeInvalid');
        editForm.setFields([{ name: 'emailCode', errors: [msg] }]);
        announceAccessibleMessage(msg, 'error');
      } else {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.updateFailed'), language), 'error');
      }
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleSendProfileEmailCode = async () => {
    if (!emailCodeEnabled) {
      announceAccessibleMessage(t('pages.auth.emailCodeUnavailable'), 'warning');
      return;
    }
    try {
      const { email } = await editForm.validateFields(['email']);
      const normalizedEmail = normalizeProfileEmail(email);
      editForm.setFieldValue('email', normalizedEmail);
      if (normalizedEmail === normalizeProfileEmail(user?.email)) {
        announceAccessibleMessage(t('pages.profile.emailCodeUnchanged'), 'info');
        return;
      }
      setProfileEmailCodeSending(true);
      const response = await userApi.sendProfileEmailCode(normalizedEmail);
      const resendIntervalSeconds = Number(response.data?.resendIntervalSeconds);
      const ttlMinutes = Number(response.data?.codeTtlMinutes);
      setProfileEmailCodeCountdown(Number.isFinite(resendIntervalSeconds) && resendIntervalSeconds > 0 ? resendIntervalSeconds : 60);
      setProfileEmailCodeTtlMinutes(Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 0);
      setProfileEmailCodeSentTo(normalizedEmail);
      editForm.setFieldValue('emailCode', '');
      editForm.setFields([{ name: 'emailCode', errors: [] }]);
      announceAccessibleMessage(t('pages.auth.emailCodeSentTo', { email: normalizedEmail }), 'success');
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      const retryAfterSeconds = Number(getProfileApiErrorData(err).retryAfterSeconds);
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        setProfileEmailCodeCountdown(Math.ceil(retryAfterSeconds));
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.auth.emailCodeSendFailed'), language), 'error');
    } finally {
      setProfileEmailCodeSending(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordSubmitting) return;
    try {
      const values = await passwordForm.validateFields();
      setPasswordSubmitting(true);
      await userApi.updatePassword(values.oldPassword, values.newPassword);
      announceAccessibleMessage(t('pages.profile.passwordChanged'), 'success');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.passwordFailed'), language), 'error');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const closePasswordModal = () => {
    if (passwordSubmitting) return;
    setPasswordModalVisible(false);
    passwordForm.resetFields();
  };

  const openEditModal = () => {
    editForm.setFieldsValue({ email: user?.email, phone: user?.phone, emailCode: '' });
    setProfileEmailCodeSentTo('');
    setProfileEmailCodeCountdown(0);
    setProfileEmailCodeTtlMinutes(0);
    setEditModalVisible(true);
  };

  return {
    closePasswordModal,
    handleChangePassword,
    handleEditProfile,
    handleSendProfileEmailCode,
    openEditModal,
  };
};

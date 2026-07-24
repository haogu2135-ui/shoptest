import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import { Form } from 'antd';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { PetProfile, UserAddress, UserProfile } from '../types';
import type { RegionOption } from '../regionData';
import ShopButton from '../components/ShopButton';
import ShopCascader from '../components/ShopCascader';
import ShopCheckbox from '../components/ShopCheckbox';
import ShopDatePicker from '../components/ShopDatePicker';
import ShopInput, { ShopPasswordInput, ShopTextArea } from '../components/ShopInput';
import ShopInputNumber from '../components/ShopInputNumber';
import ShopModal from '../components/ShopModal';
import ShopSelect from '../components/ShopSelect';
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  hasRequiredPasswordClasses,
  isCommonPassword,
} from '../utils/passwordPolicy';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';
import {
  isLikelyProfilePhone,
  normalizeEmailCode,
  normalizeLikelyProfilePhone,
  normalizeProfileEmail,
  scrollProfileAddressFieldIntoMobileView,
} from '../utils/profileHelpers';

type ProfileAccountModalsProps = {
  addressForm: FormInstance;
  addressModalVisible: boolean;
  addressPhoneInputLabel: string;
  addressRegionInputLabel: string;
  changePasswordActionLabel: string;
  editForm: FormInstance;
  editModalVisible: boolean;
  editProfileActionLabel: string;
  editingAddress: UserAddress | null;
  editingPet: PetProfile | null;
  emailCodeEnabled: boolean;
  closeAddressModal: () => void;
  closePasswordModal: () => void;
  closePetModal: () => void;
  handleChangePassword: () => void | Promise<void>;
  handleEditProfile: () => void | Promise<void>;
  handleSaveAddress: () => void | Promise<void>;
  handleSavePet: () => void | Promise<void>;
  handleSendProfileEmailCode: () => void | Promise<void>;
  loadProfileRegionOptions: () => void | Promise<void | RegionOption[]>;
  passwordForm: FormInstance;
  passwordModalVisible: boolean;
  petForm: FormInstance;
  petModalVisible: boolean;
  passwordSubmitting: boolean;
  petSubmitting: boolean;
  profilePhoneInputLabel: string;
  regionOptionsLoading: boolean;
  profileEmailChanged: boolean;
  profileEmailCodeCountdown: number;
  profileEmailCodeSending: boolean;
  profileEmailCodeSentTo: string;
  profileEmailCodeTtlMinutes: number;
  profileSubmitting: boolean;
  regionOptions: RegionOption[];
  saveAddressActionLabel: string;
  savePetActionLabel: string;
  setAddressModalVisible: Dispatch<SetStateAction<boolean>>;
  setEditModalVisible: Dispatch<SetStateAction<boolean>>;
  setEditingAddress: Dispatch<SetStateAction<UserAddress | null>>;
  setEditingPet: Dispatch<SetStateAction<PetProfile | null>>;
  setPasswordModalVisible: Dispatch<SetStateAction<boolean>>;
  setPetModalVisible: Dispatch<SetStateAction<boolean>>;
  setProfileEmailCodeCountdown: Dispatch<SetStateAction<number>>;
  setProfileEmailCodeSentTo: Dispatch<SetStateAction<string>>;
  t: (key: string, params?: Record<string, string | number>) => string;
  user: UserProfile | null;
  addressSubmitting: boolean;
};

/**
 * Commercial profile editor modals:
 * account, password, address, and pet profile forms.
 */
export const ProfileAccountModals: React.FC<ProfileAccountModalsProps> = (props) => {
  const {
    addressForm,
    addressModalVisible,
    addressPhoneInputLabel,
    addressRegionInputLabel,
    addressSubmitting,
    changePasswordActionLabel,
    editForm,
    editModalVisible,
    editProfileActionLabel,
    editingAddress,
    editingPet,
    emailCodeEnabled,
    closeAddressModal,
    closePasswordModal,
    closePetModal,
    handleChangePassword,
    handleEditProfile,
    handleSaveAddress,
    handleSavePet,
    handleSendProfileEmailCode,
    loadProfileRegionOptions,
    passwordForm,
    passwordModalVisible,
    petForm,
    petModalVisible,
    passwordSubmitting,
    petSubmitting,
    profilePhoneInputLabel,
    regionOptionsLoading,
    profileEmailChanged,
    profileEmailCodeCountdown,
    profileEmailCodeSending,
    profileEmailCodeSentTo,
    profileEmailCodeTtlMinutes,
    profileSubmitting,
    regionOptions,
    saveAddressActionLabel,
    savePetActionLabel,
    setAddressModalVisible,
    setEditModalVisible,
    setEditingAddress,
    setEditingPet,
    setPasswordModalVisible,
    setPetModalVisible,
    setProfileEmailCodeCountdown,
    setProfileEmailCodeSentTo,
    t,
    user,
  } = props;

  const validateStrongPassword = (_rule: unknown, value?: string) => {
    if (!value) return Promise.resolve();
    if (isCommonPassword(value)) {
      return Promise.reject(new Error(t('pages.profile.newPasswordCommon')));
    }
    if (!hasRequiredPasswordClasses(value)) {
      return Promise.reject(new Error(t('pages.profile.newPasswordPattern')));
    }
    return Promise.resolve();
  };

  return (

    <>
      <ShopModal
        title={t('pages.profile.editProfileTitle')}
        open={editModalVisible}
        onOk={handleEditProfile}
        onClose={() => {
          setEditModalVisible(false);
          editForm.resetFields(['emailCode']);
          setProfileEmailCodeSentTo('');
          setProfileEmailCodeCountdown(0);
        }}
        confirmLoading={profileSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': editProfileActionLabel, title: editProfileActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${editProfileActionLabel}`, title: `${t('common.cancel')}: ${editProfileActionLabel}` }}
        className="profile-mobile-safe-modal"
      >
        <Form form={editForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item
            name="email"
            label={t('pages.profile.email')}
            rules={[
              { required: true, message: t('pages.auth.emailRequired') },
              { type: 'email', message: t('pages.profile.emailInvalid') },
            ]}
          >
            <ShopInput prefix={<ShopIcon path={SI.mail} />} />
          </Form.Item>
          {profileEmailChanged && !emailCodeEnabled && (
            <div className="profile-email-code-warning" role="status">
              <ShopIcon path={SI.safety} />
              <span>{t('pages.auth.emailCodeUnavailable')}</span>
            </div>
          )}
          {profileEmailCodeSentTo && (
            <span className="profile-page__text profile-page__text--secondary">
              {t('pages.profile.emailCodeSentHint', {
                email: profileEmailCodeSentTo,
                minutes: profileEmailCodeTtlMinutes || 0,
              })}
            </span>
          )}
          <Form.Item
            name="emailCode"
            label={t('pages.profile.emailVerificationCode')}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const normalizedEmail = normalizeProfileEmail(getFieldValue('email'));
                  if (normalizedEmail === normalizeProfileEmail(user?.email)) return Promise.resolve();
                  if (normalizeEmailCode(value).length === 6) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.auth.emailCodeLength')));
                },
              }),
            ]}
          >
            <ShopInput
              prefix={<ShopIcon path={SI.safety} />}
              maxLength={12}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={profileSubmitting || (profileEmailChanged && !emailCodeEnabled)}
              onChange={(event) => {
                const normalized = normalizeEmailCode(event.target.value);
                if (normalized !== event.target.value) {
                  editForm.setFieldValue('emailCode', normalized);
                }
              }}
              addonAfter={
                <ShopButton
                  type="link"
                  size="small"
                  loading={profileEmailCodeSending}
                  disabled={profileSubmitting || profileEmailCodeSending || profileEmailCodeCountdown > 0 || !emailCodeEnabled}
                  onClick={handleSendProfileEmailCode}
                >
                  {profileEmailCodeSending
                    ? t('pages.auth.emailCodeSending')
                    : profileEmailCodeCountdown > 0
                    ? t('pages.auth.resendIn', { seconds: profileEmailCodeCountdown })
                    : t('pages.auth.sendCode')}
                </ShopButton>
              }
            />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('pages.profile.phone')}
            rules={[
              { validator: (_, value) => (!value || isLikelyProfilePhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.auth.phoneInvalid')))) },
            ]}
          >
            <ShopInput
              maxLength={40}
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              aria-label={profilePhoneInputLabel}
              title={profilePhoneInputLabel}
              onBlur={(event) => editForm.setFieldValue('phone', normalizeLikelyProfilePhone(event.target.value))}
            />
          </Form.Item>
        </Form>
      </ShopModal>

      <ShopModal
        title={t('pages.profile.changePassword')}
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onClose={closePasswordModal}
        confirmLoading={passwordSubmitting}
        okText={t('pages.profile.changePassword')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': changePasswordActionLabel, title: changePasswordActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${changePasswordActionLabel}`, title: `${t('common.cancel')}: ${changePasswordActionLabel}` }}
        className="profile-mobile-safe-modal"
      >
        <Form form={passwordForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item name="oldPassword" label={t('pages.profile.oldPassword')} rules={[{ required: true, message: t('pages.profile.oldPasswordRequired') }]}>
            <ShopPasswordInput 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
               
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
          <Form.Item name="newPassword" label={t('pages.profile.newPassword')} rules={[
            { required: true, min: STRONG_PASSWORD_MIN_LENGTH, max: STRONG_PASSWORD_MAX_LENGTH, message: t('pages.profile.newPasswordMin') },
            { validator: validateStrongPassword }
          ]}>
            <ShopPasswordInput maxLength={STRONG_PASSWORD_MAX_LENGTH} 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
               
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('pages.profile.confirmNewPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('pages.profile.confirmNewRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.profile.passwordMismatch')));
                },
              }),
            ]}
          >
            <ShopPasswordInput 
              iconRender={(visible) => (
              <button
                type="button"
                aria-label={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
                aria-pressed={visible}
                title={visible ? t('pages.auth.hidePassword') : t('pages.auth.showPassword')}
               
              >
                {visible ? <ShopIcon path={SI.eye} /> : <ShopIcon path={SI.eyeOff} />}
              </button>
            )}
            />
          </Form.Item>
        </Form>
      </ShopModal>

      <ShopModal
        title={editingAddress ? t('pages.profile.editAddressTitle') : t('pages.profile.addAddressTitle')}
        open={addressModalVisible}
        onOk={handleSaveAddress}
        onClose={closeAddressModal}
        confirmLoading={addressSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': saveAddressActionLabel, title: saveAddressActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${saveAddressActionLabel}`, title: `${t('common.cancel')}: ${saveAddressActionLabel}` }}
        width={560}
        className="profile-mobile-safe-modal profile-address-modal"
      >
        <Form form={addressForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']} onFocusCapture={(event) => scrollProfileAddressFieldIntoMobileView(event.target)}>
          <Form.Item name="recipientName" label={t('pages.profile.recipient')} rules={[{ required: true, message: t('pages.profile.recipientRequired') }]}>
            <ShopInput placeholder={t('pages.profile.recipientRequired')} autoComplete="name" maxLength={80} />
          </Form.Item>
          <Form.Item
            name="phone"
            label={t('pages.profile.phone')}
            rules={[
              { required: true, message: t('pages.profile.phoneRequired') },
              { validator: (_, value) => (!value || isLikelyProfilePhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.auth.phoneInvalid')))) },
            ]}
          >
            <ShopInput
              placeholder={t('pages.auth.phonePlaceholder')}
              autoComplete="tel"
              inputMode="tel"
              maxLength={40}
              aria-label={addressPhoneInputLabel}
              title={addressPhoneInputLabel}
              onBlur={(event) => addressForm.setFieldValue('phone', normalizeLikelyProfilePhone(event.target.value))}
            />
          </Form.Item>
          <Form.Item name="region" label={t('pages.profile.region')} rules={[{ required: true, message: t('pages.profile.regionRequired') }]}>
            <ShopCascader
              options={regionOptions}
              placeholder={regionOptionsLoading ? t('common.loading') : t('pages.profile.regionPlaceholder')}
              ariaLabel={addressRegionInputLabel}
              title={addressRegionInputLabel}
              popupClassName="shop-mobile-popup-layer profile-modal-popup"
              popupZIndex={12050}
              onOpenChange={(open) => {
                if (open) void loadProfileRegionOptions();
              }}
            />
          </Form.Item>
          <Form.Item
            name="postalCode"
            label={t('pages.profile.postalCode')}
            dependencies={['region']}
            rules={[
              { required: true, message: t('pages.profile.postalCodeRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value) => (
                  !value || isValidRegionalPostalCode(value, getFieldValue('region'))
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('pages.profile.postalCodeInvalid')))
                ),
              }),
            ]}
          >
            <ShopInput
              placeholder={t('pages.profile.postalCodePlaceholder')}
              autoComplete="postal-code"
              inputMode="text"
              maxLength={20}
              onBlur={(event) => addressForm.setFieldValue('postalCode', normalizeRegionalPostalCode(event.target.value))}
            />
          </Form.Item>
          <Form.Item name="detail" label={t('pages.profile.detailAddress')} rules={[{ required: true, message: t('pages.profile.detailRequired') }]}>
            <ShopTextArea rows={3} placeholder={t('pages.profile.detailRequired')} autoComplete="street-address" maxLength={260} showCount />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <ShopCheckbox>{t('pages.profile.makeDefaultAddress')}</ShopCheckbox>
          </Form.Item>
        </Form>
      </ShopModal>

      <ShopModal
        title={editingPet ? t('pages.profile.editPet') : t('pages.profile.addPet')}
        open={petModalVisible}
        onOk={handleSavePet}
        onClose={closePetModal}
        confirmLoading={petSubmitting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': savePetActionLabel, title: savePetActionLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${savePetActionLabel}`, title: `${t('common.cancel')}: ${savePetActionLabel}` }}
        className="profile-mobile-safe-modal"
      >
        <Form form={petForm} layout="vertical" requiredMark validateTrigger={['onChange', 'onBlur']}>
          <Form.Item name="name" label={t('pages.profile.petName')} rules={[{ required: true, message: t('pages.profile.petNameRequired') }]}>
            <ShopInput placeholder={t('pages.profile.petNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="petType" label={t('pages.profile.petType')} rules={[{ required: true }]}>
            <ShopSelect
              options={[
                { value: 'DOG', label: t('pages.profile.petDog') },
                { value: 'CAT', label: t('pages.profile.petCat') },
                { value: 'SMALL_PET', label: t('pages.profile.petSmall') },
              ]}
              popupClassName="shop-mobile-popup-layer profile-modal-popup"
              popupZIndex={12050}
              ariaLabel={t('pages.profile.petType')}
            />
          </Form.Item>
          <Form.Item name="breed" label={t('pages.profile.petBreed')}>
            <ShopInput placeholder={t('pages.profile.petBreedPlaceholder')} />
          </Form.Item>
          <Form.Item name="birthday" label={t('pages.profile.petBirthday')}>
            <ShopDatePicker className="profile-pet-modal__field" ariaLabel={t('pages.profile.petBirthday')} />
          </Form.Item>
          <Form.Item name="weight" label={t('pages.profile.petWeightKg')}>
            <ShopInputNumber min={0} precision={2} className="profile-pet-modal__field" />
          </Form.Item>
          <Form.Item name="size" label={t('pages.profile.petSize')}>
            <ShopSelect
              allowClear
              options={[
                { value: 'SMALL', label: t('pages.profile.petSizeSmall') },
                { value: 'MEDIUM', label: t('pages.profile.petSizeMedium') },
                { value: 'LARGE', label: t('pages.profile.petSizeLarge') },
              ]}
              popupClassName="shop-mobile-popup-layer profile-modal-popup"
              popupZIndex={12050}
              ariaLabel={t('pages.profile.petSize')}
            />
          </Form.Item>
        </Form>
      </ShopModal>

    </>
  );
};

export default ProfileAccountModals;

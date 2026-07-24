import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import { addressApi } from '../api';
import type { Language } from '../i18n';
import { findRegionPath, loadRegionData, type RegionOption } from '../regionData';
import type { UserAddress } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';
import {
  focusProfileModalFormError,
  getProfileSavedAddressDetail,
  getProfileSavedAddressPostalCode,
  getProfileSavedAddressRegionPath,
  isFormValidationError,
  normalizeProfileAddressText,
  normalizeProfilePhone,
} from '../utils/profileHelpers';

type UseProfileAddressActionsParams = {
  addressForm: FormInstance;
  addressSubmitting: boolean;
  addressesStale: boolean;
  editingAddress: UserAddress | null;
  fetchAddresses: () => void | Promise<void>;
  language: Language;
  mountedRef: MutableRefObject<boolean>;
  regionOptions: RegionOption[];
  regionOptionsLanguage: string;
  setAddressModalVisible: Dispatch<SetStateAction<boolean>>;
  setAddressSubmitting: Dispatch<SetStateAction<boolean>>;
  setEditingAddress: Dispatch<SetStateAction<UserAddress | null>>;
  setRegionOptions: Dispatch<SetStateAction<RegionOption[]>>;
  setRegionOptionsLanguage: Dispatch<SetStateAction<string>>;
  setRegionOptionsLoading: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const useProfileAddressActions = ({
  addressForm,
  addressSubmitting,
  addressesStale,
  editingAddress,
  fetchAddresses,
  language,
  mountedRef,
  regionOptions,
  regionOptionsLanguage,
  setAddressModalVisible,
  setAddressSubmitting,
  setEditingAddress,
  setRegionOptions,
  setRegionOptionsLanguage,
  setRegionOptionsLoading,
  t,
}: UseProfileAddressActionsParams) => {
  const handleSaveAddress = async () => {
    if (addressSubmitting) return;
    try {
      const values = await addressForm.validateFields();
      setAddressSubmitting(true);
      const regionPath = Array.isArray(values.region)
        ? values.region.map((item: unknown) => normalizeProfileAddressText(item, 120)).filter(Boolean)
        : [];
      const postalCode = normalizeRegionalPostalCode(values.postalCode);
      const detailAddress = normalizeProfileAddressText(values.detail, 260);
      if (!isValidRegionalPostalCode(postalCode, regionPath)) {
        addressForm.setFields([{ name: 'postalCode', errors: [t('pages.profile.postalCodeInvalid')] }]);
        focusProfileModalFormError('.profile-address-modal');
        return;
      }
      const regionStr = regionPath.join(' ');
      const fullAddress = [regionStr, postalCode, detailAddress].filter(Boolean).join(' ');
      const payload = {
        recipientName: values.recipientName,
        phone: normalizeProfilePhone(values.phone),
        region: regionPath,
        postalCode,
        detailAddress,
        address: fullAddress,
        isDefault: Boolean(values.isDefault),
      };
      if (editingAddress) {
        await addressApi.update(editingAddress.id, payload);
        announceAccessibleMessage(t('pages.profile.addressUpdated'), 'success');
      } else {
        await addressApi.create(payload);
        announceAccessibleMessage(t('pages.profile.addressAdded'), 'success');
      }
      setAddressModalVisible(false);
      setEditingAddress(null);
      addressForm.resetFields();
      fetchAddresses();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-address-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.addressSaveFailed'), language), 'error');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    try {
      await addressApi.delete(id);
      announceAccessibleMessage(t('pages.profile.addressDeleted'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    }
  };

  const handleSetDefault = async (id: number) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    try {
      await addressApi.setDefault(id);
      announceAccessibleMessage(t('pages.profile.defaultSet'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.setFailed'), language), 'error');
    }
  };

  const loadProfileRegionOptions = useCallback(async () => {
    if (regionOptions.length > 0 && regionOptionsLanguage === language) {
      return regionOptions;
    }
    setRegionOptionsLoading(true);
    try {
      const options = await loadRegionData(language);
      if (mountedRef.current) {
        setRegionOptions(options);
        setRegionOptionsLanguage(language);
      }
      return options;
    } catch (error) {
      reportNonBlockingError('Profile.loadRegionData', error);
      if (mountedRef.current) {
        announceAccessibleMessage(t('pages.profile.regionLoadFailed'), 'error');
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setRegionOptionsLoading(false);
      }
    }
  }, [language, mountedRef, regionOptions, regionOptionsLanguage, setRegionOptions, setRegionOptionsLanguage, setRegionOptionsLoading, t]);

  const openAddressModal = (address?: UserAddress) => {
    if (addressesStale) {
      announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      return;
    }
    addressForm.resetFields();
    if (address) {
      setEditingAddress(address);
      const savedRegionPath = getProfileSavedAddressRegionPath(address);
      const savedDetail = getProfileSavedAddressDetail(address);
      const savedPostalCode = getProfileSavedAddressPostalCode(address);
      addressForm.setFieldsValue({
        recipientName: address.recipientName,
        phone: address.phone,
        region: savedRegionPath,
        postalCode: savedPostalCode,
        detail: savedDetail || address.address,
        isDefault: Boolean(address.isDefault),
      });
      if (savedRegionPath.length === 0) {
        void loadProfileRegionOptions().then((options) => {
          if (!mountedRef.current) return;
          const { region, detail } = findRegionPath(address.address, options);
          addressForm.setFieldsValue({ region, detail });
        });
      } else {
        void loadProfileRegionOptions();
      }
    } else {
      setEditingAddress(null);
      addressForm.resetFields();
      void loadProfileRegionOptions();
    }
    setAddressModalVisible(true);
  };

  const closeAddressModal = () => {
    if (addressSubmitting) return;
    setAddressModalVisible(false);
    addressForm.resetFields();
    setEditingAddress(null);
  };

  return {
    closeAddressModal,
    handleDeleteAddress,
    handleSaveAddress,
    handleSetDefault,
    loadProfileRegionOptions,
    openAddressModal,
  };
};

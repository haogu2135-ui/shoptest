import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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
  const regionRequestSeqRef = useRef(0);
  const savingAddressRef = useRef(false);
  const deletingAddressIdsRef = useRef(new Set<number>());
  const settingDefaultAddressIdsRef = useRef(new Set<number>());

  const handleSaveAddress = async () => {
    if (!mountedRef.current || addressSubmitting || savingAddressRef.current) return;
    savingAddressRef.current = true;
    try {
      const values = await addressForm.validateFields();
      if (!mountedRef.current) return;
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
      } else {
        await addressApi.create(payload);
      }
      if (!mountedRef.current) return;
      announceAccessibleMessage(
        editingAddress ? t('pages.profile.addressUpdated') : t('pages.profile.addressAdded'),
        'success',
      );
      if (mountedRef.current) {
        setAddressModalVisible(false);
        setEditingAddress(null);
        addressForm.resetFields();
        fetchAddresses();
      }
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        if (mountedRef.current) focusProfileModalFormError('.profile-address-modal');
        return;
      }
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.addressSaveFailed'), language), 'error');
      }
    } finally {
      savingAddressRef.current = false;
      if (mountedRef.current) setAddressSubmitting(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!mountedRef.current || addressesStale || deletingAddressIdsRef.current.has(id)) {
      if (mountedRef.current && addressesStale) {
        announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      }
      return;
    }
    deletingAddressIdsRef.current.add(id);
    try {
      await addressApi.delete(id);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('pages.profile.addressDeleted'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
      }
    } finally {
      deletingAddressIdsRef.current.delete(id);
    }
  };

  const handleSetDefault = async (id: number) => {
    if (!mountedRef.current || addressesStale || settingDefaultAddressIdsRef.current.has(id)) {
      if (mountedRef.current && addressesStale) {
        announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning');
      }
      return;
    }
    settingDefaultAddressIdsRef.current.add(id);
    try {
      await addressApi.setDefault(id);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('pages.profile.defaultSet'), 'success');
      fetchAddresses();
    } catch (err: unknown) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('pages.profile.setFailed'), language), 'error');
      }
    } finally {
      settingDefaultAddressIdsRef.current.delete(id);
    }
  };

  const loadProfileRegionOptions = useCallback(async () => {
    if (regionOptions.length > 0 && regionOptionsLanguage === language) {
      return regionOptions;
    }
    const requestSeq = regionRequestSeqRef.current + 1;
    regionRequestSeqRef.current = requestSeq;
    const isCurrentRequest = () => mountedRef.current && regionRequestSeqRef.current === requestSeq;
    setRegionOptionsLoading(true);
    try {
      const options = await loadRegionData(language);
      if (isCurrentRequest()) {
        setRegionOptions(options);
        setRegionOptionsLanguage(language);
      }
      return options;
    } catch (error) {
      reportNonBlockingError('Profile.loadRegionData', error);
      if (isCurrentRequest()) {
        announceAccessibleMessage(t('pages.profile.regionLoadFailed'), 'error');
      }
      return [];
    } finally {
      if (isCurrentRequest()) {
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

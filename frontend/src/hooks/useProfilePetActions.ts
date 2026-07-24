import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import dayjs from 'dayjs';
import { petProfileApi } from '../api';
import type { Language } from '../i18n';
import type { PetProfile } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import {
  focusProfileModalFormError,
  isFormValidationError,
} from '../utils/profileHelpers';

type UseProfilePetActionsParams = {
  editingPet: PetProfile | null;
  fetchPetProfiles: () => void | Promise<void>;
  language: Language;
  petForm: FormInstance;
  petSubmitting: boolean;
  setEditingPet: Dispatch<SetStateAction<PetProfile | null>>;
  setPetModalVisible: Dispatch<SetStateAction<boolean>>;
  setPetSubmitting: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export const useProfilePetActions = ({
  editingPet,
  fetchPetProfiles,
  language,
  petForm,
  petSubmitting,
  setEditingPet,
  setPetModalVisible,
  setPetSubmitting,
  t,
}: UseProfilePetActionsParams) => {
  const openPetModal = (pet?: PetProfile) => {
    petForm.resetFields();
    setEditingPet(pet || null);
    if (pet) {
      petForm.setFieldsValue({
        ...pet,
        birthday: pet.birthday ? dayjs(pet.birthday) : undefined,
      });
    } else {
      petForm.resetFields();
      petForm.setFieldsValue({ petType: 'DOG', size: 'MEDIUM' });
    }
    setPetModalVisible(true);
  };

  const handleSavePet = async () => {
    if (petSubmitting) return;
    try {
      const values = await petForm.validateFields();
      setPetSubmitting(true);
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
      };
      if (editingPet) {
        await petProfileApi.update(editingPet.id, payload);
        announceAccessibleMessage(t('messages.updateSuccess'), 'success');
      } else {
        await petProfileApi.create(payload);
        announceAccessibleMessage(t('pages.profile.petAdded'), 'success');
      }
      setPetModalVisible(false);
      setEditingPet(null);
      petForm.resetFields();
      fetchPetProfiles();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    } finally {
      setPetSubmitting(false);
    }
  };

  const closePetModal = () => {
    if (petSubmitting) return;
    setPetModalVisible(false);
    setEditingPet(null);
    petForm.resetFields();
  };

  const handleDeletePet = async (id: number) => {
    try {
      await petProfileApi.delete(id);
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
      fetchPetProfiles();
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
    }
  };

  return {
    closePetModal,
    handleDeletePet,
    handleSavePet,
    openPetModal,
  };
};

import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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
  mountedRef: MutableRefObject<boolean>;
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
  mountedRef,
  petForm,
  petSubmitting,
  setEditingPet,
  setPetModalVisible,
  setPetSubmitting,
  t,
}: UseProfilePetActionsParams) => {
  const savingPetRef = useRef(false);
  const deletingPetIdsRef = useRef(new Set<number>());

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
    if (!mountedRef.current || petSubmitting || savingPetRef.current) return;
    savingPetRef.current = true;
    try {
      const values = await petForm.validateFields();
      if (!mountedRef.current) return;
      setPetSubmitting(true);
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
      };
      if (editingPet) {
        await petProfileApi.update(editingPet.id, payload);
      } else {
        await petProfileApi.create(payload);
      }
      if (!mountedRef.current) return;
      announceAccessibleMessage(
        editingPet ? t('messages.updateSuccess') : t('pages.profile.petAdded'),
        'success',
      );
      setPetModalVisible(false);
      setEditingPet(null);
      petForm.resetFields();
      fetchPetProfiles();
    } catch (err: unknown) {
      if (isFormValidationError(err)) {
        if (mountedRef.current) focusProfileModalFormError('.profile-mobile-safe-modal');
        return;
      }
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
      }
    } finally {
      savingPetRef.current = false;
      if (mountedRef.current) setPetSubmitting(false);
    }
  };

  const closePetModal = () => {
    if (petSubmitting) return;
    setPetModalVisible(false);
    setEditingPet(null);
    petForm.resetFields();
  };

  const handleDeletePet = async (id: number) => {
    if (!mountedRef.current || deletingPetIdsRef.current.has(id)) return;
    deletingPetIdsRef.current.add(id);
    try {
      await petProfileApi.delete(id);
      if (!mountedRef.current) return;
      announceAccessibleMessage(t('messages.deleteSuccess'), 'success');
      fetchPetProfiles();
    } catch (err: unknown) {
      if (mountedRef.current) {
        announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');
      }
    } finally {
      deletingPetIdsRef.current.delete(id);
    }
  };

  return {
    closePetModal,
    handleDeletePet,
    handleSavePet,
    openPetModal,
  };
};

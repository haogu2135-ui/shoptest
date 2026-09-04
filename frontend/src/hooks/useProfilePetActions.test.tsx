import React, { useImperativeHandle, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { PetProfile } from '../types';
import { useProfilePetActions } from './useProfilePetActions';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockUpdate = jest.fn();
const mockAnnounce = jest.fn();

jest.mock('../api', () => ({
  petProfileApi: {
    create: (...args: unknown[]) => mockCreate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: (...args: unknown[]) => mockAnnounce(...args),
}));

type PetActions = ReturnType<typeof useProfilePetActions>;
type PetActionParams = Parameters<typeof useProfilePetActions>[0];

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const petForm = {
  resetFields: jest.fn(),
  setFieldsValue: jest.fn(),
  validateFields: jest.fn(),
} as unknown as PetActionParams['petForm'];

const petValues = {
  name: 'Milo',
  petType: 'DOG' as const,
  size: 'MEDIUM' as const,
  birthday: undefined,
};

const deferred = <T,>() => {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const createParams = (
  mountedRef: MutableRefObject<boolean>,
  overrides: Partial<PetActionParams> = {},
): PetActionParams => ({
  editingPet: null,
  fetchPetProfiles: jest.fn(),
  language: 'en' as Language,
  mountedRef,
  petForm,
  petSubmitting: false,
  setEditingPet: setState<PetProfile | null>(),
  setPetModalVisible: setState<boolean>(),
  setPetSubmitting: setState<boolean>(),
  t: (key: string) => key,
  ...overrides,
});

const ActionProbe = React.forwardRef<PetActions, { params: PetActionParams }>(({ params }, ref) => {
  const actions = useProfilePetActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

describe('useProfilePetActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    petForm.validateFields = jest.fn().mockResolvedValue(petValues);
    mockCreate.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    mockUpdate.mockResolvedValue({ data: {} });
  });

  it('latches duplicate saves and suppresses post-unmount effects', async () => {
    const pending = deferred<unknown>();
    mockCreate.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const fetchPetProfiles = jest.fn();
    const setPetSubmitting = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const ref = React.createRef<PetActions>();
    const { unmount } = render(
      <ActionProbe
        ref={ref}
        params={createParams(mountedRef, { fetchPetProfiles, setPetSubmitting })}
      />,
    );

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleSavePet();
      void ref.current?.handleSavePet();
    });
    await act(async () => {
      await Promise.resolve();
    });
    mountedRef.current = false;
    pending.resolve({});
    await act(async () => {
      await firstAction;
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(setPetSubmitting).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(fetchPetProfiles).not.toHaveBeenCalled();
    unmount();
  });

  it('latches duplicate deletes and refreshes only after the active delete settles', async () => {
    const mountedRef = { current: true };
    const fetchPetProfiles = jest.fn();
    const ref = React.createRef<PetActions>();
    render(<ActionProbe ref={ref} params={createParams(mountedRef, { fetchPetProfiles })} />);
    const pending = deferred<unknown>();
    mockDelete.mockReturnValueOnce(pending.promise);

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleDeletePet(9);
      void ref.current?.handleDeletePet(9);
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    pending.resolve({});
    await act(async () => {
      await firstAction;
    });

    expect(fetchPetProfiles).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).toHaveBeenCalledWith('messages.deleteSuccess', 'success');
  });
});

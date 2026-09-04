import React, { useImperativeHandle, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { RegionOption } from '../regionData';
import type { UserAddress } from '../types';
import { useProfileAddressActions } from './useProfileAddressActions';

const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockSetDefault = jest.fn();
const mockAnnounce = jest.fn();

jest.mock('../api', () => ({
  addressApi: {
    create: (...args: unknown[]) => mockCreate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    setDefault: (...args: unknown[]) => mockSetDefault(...args),
    update: jest.fn(),
  },
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: (...args: unknown[]) => mockAnnounce(...args),
}));

type AddressActions = ReturnType<typeof useProfileAddressActions>;
type AddressActionParams = Parameters<typeof useProfileAddressActions>[0];

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const addressForm = {
  resetFields: jest.fn(),
  setFields: jest.fn(),
  validateFields: jest.fn(),
} as unknown as AddressActionParams['addressForm'];

const addressValues = {
  recipientName: 'Member',
  phone: '13800138000',
  region: ['Beijing', 'Beijing'],
  postalCode: '100000',
  detail: '1 Main Street',
  isDefault: false,
};

const address: UserAddress = {
  id: 7,
  recipientName: 'Member',
  phone: '13800138000',
  region: ['Beijing', 'Beijing'],
  postalCode: '100000',
  detailAddress: '1 Main Street',
  address: 'Beijing Beijing 100000 1 Main Street',
  isDefault: false,
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
  overrides: Partial<AddressActionParams> = {},
): AddressActionParams => ({
  addressForm,
  addressSubmitting: false,
  addressesStale: false,
  editingAddress: null,
  fetchAddresses: jest.fn(),
  language: 'en' as Language,
  mountedRef,
  regionOptions: [],
  regionOptionsLanguage: '',
  setAddressModalVisible: setState<boolean>(),
  setAddressSubmitting: setState<boolean>(),
  setEditingAddress: setState<UserAddress | null>(),
  setRegionOptions: setState<RegionOption[]>(),
  setRegionOptionsLanguage: setState<string>(),
  setRegionOptionsLoading: setState<boolean>(),
  t: (key: string) => key,
  ...overrides,
});

const ActionProbe = React.forwardRef<AddressActions, { params: AddressActionParams }>(({ params }, ref) => {
  const actions = useProfileAddressActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

describe('useProfileAddressActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    addressForm.validateFields = jest.fn().mockResolvedValue(addressValues);
    mockCreate.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    mockSetDefault.mockResolvedValue({ data: {} });
  });

  it('latches duplicate saves and suppresses stale UI effects after unmount', async () => {
    const pending = deferred<unknown>();
    mockCreate.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const fetchAddresses = jest.fn();
    const setAddressSubmitting = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const ref = React.createRef<AddressActions>();
    const { unmount } = render(
      <ActionProbe
        ref={ref}
        params={createParams(mountedRef, { fetchAddresses, setAddressSubmitting })}
      />,
    );

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleSaveAddress();
      void ref.current?.handleSaveAddress();
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
    expect(setAddressSubmitting).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(fetchAddresses).not.toHaveBeenCalled();
    unmount();
  });

  it('latches duplicate deletes and defaults independently', async () => {
    const mountedRef = { current: true };
    const fetchAddresses = jest.fn();
    const ref = React.createRef<AddressActions>();
    render(<ActionProbe ref={ref} params={createParams(mountedRef, { fetchAddresses })} />);

    const deletePending = deferred<unknown>();
    mockDelete.mockReturnValueOnce(deletePending.promise);
    let firstDelete: Promise<void> | undefined;
    act(() => {
      firstDelete = ref.current?.handleDeleteAddress(address.id);
      void ref.current?.handleDeleteAddress(address.id);
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    deletePending.resolve({});
    await act(async () => {
      await firstDelete;
    });

    const defaultPending = deferred<unknown>();
    mockSetDefault.mockReturnValueOnce(defaultPending.promise);
    let firstDefault: Promise<void> | undefined;
    act(() => {
      firstDefault = ref.current?.handleSetDefault(address.id);
      void ref.current?.handleSetDefault(address.id);
    });
    expect(mockSetDefault).toHaveBeenCalledTimes(1);
    defaultPending.resolve({});
    await act(async () => {
      await firstDefault;
    });

    expect(fetchAddresses).toHaveBeenCalledTimes(2);
    expect(mockAnnounce).toHaveBeenCalledTimes(2);
  });
});

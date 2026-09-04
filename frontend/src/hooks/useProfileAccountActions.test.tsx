import React, { useImperativeHandle, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { act, render } from '@testing-library/react';
import type { Language } from '../i18n';
import type { UserProfile } from '../types';
import { useProfileAccountActions } from './useProfileAccountActions';

const mockSendProfileEmailCode = jest.fn();
const mockUpdatePassword = jest.fn();
const mockUpdateProfile = jest.fn();
const mockAnnounce = jest.fn();

jest.mock('../api', () => ({
  userApi: {
    sendProfileEmailCode: (...args: unknown[]) => mockSendProfileEmailCode(...args),
    updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: (...args: unknown[]) => mockAnnounce(...args),
}));

type AccountActions = ReturnType<typeof useProfileAccountActions>;
type AccountActionParams = Parameters<typeof useProfileAccountActions>[0];

const setState = <T,>() => jest.fn() as unknown as Dispatch<SetStateAction<T>>;

const editForm = {
  resetFields: jest.fn(),
  setFieldValue: jest.fn(),
  setFields: jest.fn(),
  setFieldsValue: jest.fn(),
  validateFields: jest.fn(),
} as unknown as AccountActionParams['editForm'];

const passwordForm = {
  resetFields: jest.fn(),
  validateFields: jest.fn(),
} as unknown as AccountActionParams['passwordForm'];

const user: UserProfile = {
  id: 1,
  username: 'member',
  email: 'old@example.com',
  phone: '13800138000',
  role: 'CUSTOMER',
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
  overrides: Partial<AccountActionParams> = {},
): AccountActionParams => ({
  editForm,
  emailCodeEnabled: true,
  fetchUserInfo: jest.fn(),
  language: 'en' as Language,
  mountedRef,
  passwordForm,
  passwordSubmitting: false,
  profileEmailCodeSending: false,
  profileSubmitting: false,
  setEditModalVisible: setState<boolean>(),
  setPasswordModalVisible: setState<boolean>(),
  setPasswordSubmitting: setState<boolean>(),
  setProfileEmailCodeCountdown: setState<number>(),
  setProfileEmailCodeSending: setState<boolean>(),
  setProfileEmailCodeSentTo: setState<string>(),
  setProfileEmailCodeTtlMinutes: setState<number>(),
  setProfileSubmitting: setState<boolean>(),
  t: (key: string) => key,
  user,
  ...overrides,
});

const ActionProbe = React.forwardRef<AccountActions, { params: AccountActionParams }>(({ params }, ref) => {
  const actions = useProfileAccountActions(params);
  useImperativeHandle(ref, () => actions, [actions]);
  return null;
});

describe('useProfileAccountActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    editForm.validateFields = jest.fn().mockResolvedValue({
      email: 'new@example.com',
      phone: '13800138000',
      emailCode: '123456',
    });
    passwordForm.validateFields = jest.fn().mockResolvedValue({
      oldPassword: 'old-password',
      newPassword: 'new-password',
    });
    mockSendProfileEmailCode.mockResolvedValue({ data: { resendIntervalSeconds: 30, codeTtlMinutes: 10 } });
    mockUpdatePassword.mockResolvedValue({ data: {} });
    mockUpdateProfile.mockResolvedValue({ data: {} });
  });

  it('latches profile updates and suppresses post-unmount effects', async () => {
    const pending = deferred<unknown>();
    mockUpdateProfile.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const fetchUserInfo = jest.fn();
    const setProfileSubmitting = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const setEditModalVisible = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const ref = React.createRef<AccountActions>();
    const { unmount } = render(
      <ActionProbe
        ref={ref}
        params={createParams(mountedRef, { fetchUserInfo, setEditModalVisible, setProfileSubmitting })}
      />,
    );

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleEditProfile();
      void ref.current?.handleEditProfile();
    });
    await act(async () => {
      await Promise.resolve();
    });
    mountedRef.current = false;
    pending.resolve({});
    await act(async () => {
      await firstAction;
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(setProfileSubmitting).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(setEditModalVisible).not.toHaveBeenCalled();
    expect(fetchUserInfo).not.toHaveBeenCalled();
    unmount();
  });

  it('latches email-code sends and suppresses stale response handling', async () => {
    const pending = deferred<unknown>();
    mockSendProfileEmailCode.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const setProfileEmailCodeSending = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const ref = React.createRef<AccountActions>();
    const { unmount } = render(
      <ActionProbe
        ref={ref}
        params={createParams(mountedRef, { setProfileEmailCodeSending })}
      />,
    );

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleSendProfileEmailCode();
      void ref.current?.handleSendProfileEmailCode();
    });
    await act(async () => {
      await Promise.resolve();
    });
    mountedRef.current = false;
    pending.resolve({ data: { resendIntervalSeconds: 30, codeTtlMinutes: 10 } });
    await act(async () => {
      await firstAction;
    });

    expect(mockSendProfileEmailCode).toHaveBeenCalledTimes(1);
    expect(setProfileEmailCodeSending).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    unmount();
  });

  it('latches password changes and avoids stale cleanup after unmount', async () => {
    const pending = deferred<unknown>();
    mockUpdatePassword.mockReturnValueOnce(pending.promise);
    const mountedRef = { current: true };
    const setPasswordSubmitting = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const setPasswordModalVisible = jest.fn() as unknown as Dispatch<SetStateAction<boolean>>;
    const ref = React.createRef<AccountActions>();
    const { unmount } = render(
      <ActionProbe
        ref={ref}
        params={createParams(mountedRef, { setPasswordModalVisible, setPasswordSubmitting })}
      />,
    );

    let firstAction: Promise<void> | undefined;
    act(() => {
      firstAction = ref.current?.handleChangePassword();
      void ref.current?.handleChangePassword();
    });
    await act(async () => {
      await Promise.resolve();
    });
    mountedRef.current = false;
    pending.resolve({});
    await act(async () => {
      await firstAction;
    });

    expect(mockUpdatePassword).toHaveBeenCalledTimes(1);
    expect(setPasswordSubmitting).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(setPasswordModalVisible).not.toHaveBeenCalled();
    unmount();
  });
});

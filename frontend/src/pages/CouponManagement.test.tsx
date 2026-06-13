import { act, render, waitFor } from '@testing-library/react';
import { message } from 'antd';
import fs from 'fs';
import path from 'path';

jest.mock('../api', () => ({
  adminApi: {
    getCoupons: jest.fn(),
    getCouponSummary: jest.fn(),
    getUsersPage: jest.fn(),
    getPetBirthdayCouponConfig: jest.fn(),
    getMyPermissions: jest.fn(),
  },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../i18n', () => {
  const t = (key: string, params?: Record<string, string | number>) => {
    let label = key;
    Object.entries(params || {}).forEach(([name, value]) => {
      label = label.replace(`{${name}}`, String(value));
    });
    return label;
  };
  return {
    useLanguage: () => ({ language: 'en', t }),
  };
});

const CouponManagement = require('./CouponManagement').default as typeof import('./CouponManagement').default;
const { adminApi: mockAdminApi } = require('../api');
const pageSource = fs.readFileSync(path.join(__dirname, 'CouponManagement.tsx'), 'utf8');
const appCssSource = fs.readFileSync(path.join(__dirname, '../App.css'), 'utf8');

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let reject: Deferred<T>['reject'] = () => undefined;
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

describe('CouponManagement loader cleanup', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
    Object.defineProperty(global, 'ResizeObserver', { writable: true, value: ResizeObserverMock });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminApi.getMyPermissions.mockResolvedValue({
      data: { role: 'ADMIN', roleCode: 'ADMIN', permissions: [] },
    });
  });

  it('ignores initial loader failures after unmount', async () => {
    const couponsRequest = createDeferred<unknown>();
    const summaryRequest = createDeferred<unknown>();
    const usersRequest = createDeferred<unknown>();
    const birthdayConfigRequest = createDeferred<unknown>();
    const errorSpy = jest.spyOn(message, 'error').mockImplementation(jest.fn());

    mockAdminApi.getCoupons.mockReturnValue(couponsRequest.promise);
    mockAdminApi.getCouponSummary.mockReturnValue(summaryRequest.promise);
    mockAdminApi.getUsersPage.mockReturnValue(usersRequest.promise);
    mockAdminApi.getPetBirthdayCouponConfig.mockReturnValue(birthdayConfigRequest.promise);

    const { unmount } = render(<CouponManagement />);

    await waitFor(() => expect(mockAdminApi.getCoupons).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockAdminApi.getPetBirthdayCouponConfig).toHaveBeenCalledTimes(1));

    unmount();

    await act(async () => {
      couponsRequest.reject(new Error('coupons failed'));
      summaryRequest.reject(new Error('summary failed'));
      usersRequest.reject(new Error('users failed'));
      birthdayConfigRequest.reject(new Error('birthday config failed'));
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('CouponManagement mobile popup stacking guards', () => {
  it('keeps coupon admin error handling typed without broad any usage', () => {
    expect(pageSource).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(pageSource).toContain('if (isFormValidationError(error)) return;');
    expect(pageSource).toContain('} catch (error: unknown) {');
    expect(pageSource).toContain('render: (_: unknown, record: Coupon) =>');
    expect(pageSource).not.toMatch(/\bany\b/);
    expect(pageSource).not.toContain('error?.errorFields');
    expect(pageSource).not.toContain('catch (error: any)');
    expect(pageSource).not.toContain('render: (_: any, record: Coupon)');
  });

  it('uses the shared body-mounted popup layer for editor and grant modal controls', () => {
    expect(pageSource).toContain("const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };");
    expect(pageSource).toContain('className="profile-mobile-safe-modal coupon-management-page__editorModal"');
    expect(pageSource).toContain('className="profile-mobile-safe-modal coupon-management-page__grantModal"');
    expect(pageSource).toContain('<DatePicker.RangePicker');
    expect(pageSource.match(/classNames=\{mobilePopupClassNames\}/g)?.length).toBeGreaterThanOrEqual(6);
    expect(pageSource.match(/getPopupContainer=\{\(\) => document\.body\}/g)?.length).toBeGreaterThanOrEqual(6);
    expect(pageSource).toContain('mode="multiple"');
  });

  it('raises shared mobile popups above raised modal wrappers', () => {
    const popupGuardStart = appCssSource.indexOf('Body-mounted Ant Design popups');
    const popupGuardCss = appCssSource.slice(popupGuardStart);

    expect(popupGuardStart).toBeGreaterThanOrEqual(0);
    expect(popupGuardCss).toMatch(/@media \(max-width:\s*780px\)\s*\{[\s\S]*?\.shop-mobile-popup-layer,[\s\S]*?\.shop-mobile-popup-layer\.ant-select-dropdown,[\s\S]*?\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?z-index:\s*var\(--shop-z-floating-panel\)\s*!important;/);
    expect(popupGuardCss).toMatch(/\.shop-mobile-popup-layer\.ant-select-dropdown,[\s\S]*?\.shop-mobile-popup-layer\.ant-cascader-dropdown,[\s\S]*?\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?width:\s*auto\s*!important;/);
  });
});

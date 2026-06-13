import { reportNonBlockingError } from './nonBlockingError';

export const getLocalStorageItem = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch (error) {
    reportNonBlockingError('safeStorage.getLocalStorageItem', error);
    return null;
  }
};

export const setLocalStorageItem = (key: string, value: string) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportNonBlockingError('safeStorage.setLocalStorageItem', error);
    return false;
  }
};

export const removeLocalStorageItem = (key: string) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    reportNonBlockingError('safeStorage.removeLocalStorageItem', error);
    return false;
  }
};

export const hasStoredValue = (key: string) => Boolean(getLocalStorageItem(key));

export const getSessionStorageItem = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  } catch (error) {
    reportNonBlockingError('safeStorage.getSessionStorageItem', error);
    return null;
  }
};

export const setSessionStorageItem = (key: string, value: string) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportNonBlockingError('safeStorage.setSessionStorageItem', error);
    return false;
  }
};

export const removeSessionStorageItem = (key: string) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    window.sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    reportNonBlockingError('safeStorage.removeSessionStorageItem', error);
    return false;
  }
};

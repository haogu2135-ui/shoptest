export const getLocalStorageItem = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setLocalStorageItem = (key: string, value: string) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeLocalStorageItem = (key: string) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const hasStoredValue = (key: string) => Boolean(getLocalStorageItem(key));

export const getSessionStorageItem = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setSessionStorageItem = (key: string, value: string) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const removeSessionStorageItem = (key: string) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from './safeStorage';
import { reportNonBlockingError } from './nonBlockingError';

export const CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS = 30 * 1000;
const CHECKOUT_PAYMENT_POLL_LOCK_SETTLE_MS = 75;

type CheckoutWebLockManager = {
  request: <T>(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => T | Promise<T>,
  ) => Promise<T>;
};

export type CheckoutPaymentPollLock = {
  ownerId: string;
  orderId: number;
  orderNo?: string;
  expiresAt: number;
  updatedAt: number;
};

export type CheckoutPaymentPollWebLockSession = {
  acquired: boolean;
  release: () => void;
  done: Promise<void>;
};

const normalizeCheckoutPollText = (value: unknown, maxLength: number) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);

export const checkoutPaymentPollLockKey = (orderId: number) => `checkoutPaymentPollLock:${orderId}`;

export const checkoutPaymentPollWebLockName = (orderId: number) => `shop-checkout-payment-poll:${orderId}`;

export const createCheckoutPaymentPollOwnerId = () => {
  const cryptoApi = typeof window !== 'undefined'
    ? window.crypto as (Crypto & { randomUUID?: () => string }) | undefined
    : undefined;
  if (cryptoApi?.randomUUID) {
    return `checkout-poll-${cryptoApi.randomUUID()}`;
  }
  return `checkout-poll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const parseCheckoutPaymentPollLock = (raw: string | null): CheckoutPaymentPollLock | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutPaymentPollLock> | null;
    const ownerId = normalizeCheckoutPollText(parsed?.ownerId, 120);
    const orderId = Number(parsed?.orderId);
    const expiresAt = Number(parsed?.expiresAt);
    const updatedAt = Number(parsed?.updatedAt);
    if (!ownerId || !Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isFinite(expiresAt)) {
      return null;
    }
    return {
      ownerId,
      orderId,
      orderNo: normalizeCheckoutPollText(parsed?.orderNo, 80) || undefined,
      expiresAt,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  } catch (error) {
    reportNonBlockingError('checkoutPaymentPollLock.parseCheckoutPaymentPollLock', error);
    return null;
  }
};

const waitCheckoutPaymentPollLockSettle = () => new Promise<void>((resolve) => {
  if (typeof window === 'undefined') {
    resolve();
    return;
  }
  window.setTimeout(resolve, CHECKOUT_PAYMENT_POLL_LOCK_SETTLE_MS);
});

export const claimCheckoutPaymentPollLock = async (orderId: number, orderNo: string | undefined, ownerId: string) => {
  const now = Date.now();
  const key = checkoutPaymentPollLockKey(orderId);
  const existing = parseCheckoutPaymentPollLock(getLocalStorageItem(key));
  if (existing && existing.ownerId !== ownerId && existing.expiresAt > now) {
    return false;
  }
  const nextLock: CheckoutPaymentPollLock = {
    ownerId,
    orderId,
    orderNo,
    updatedAt: now,
    expiresAt: now + CHECKOUT_PAYMENT_POLL_LOCK_TTL_MS,
  };
  if (!setLocalStorageItem(key, JSON.stringify(nextLock))) {
    return true;
  }
  await waitCheckoutPaymentPollLockSettle();
  const confirmed = parseCheckoutPaymentPollLock(getLocalStorageItem(key));
  return Boolean(confirmed && confirmed.ownerId === ownerId && confirmed.orderId === orderId);
};

export const releaseCheckoutPaymentPollLock = (orderId: number, ownerId: string) => {
  const key = checkoutPaymentPollLockKey(orderId);
  const existing = parseCheckoutPaymentPollLock(getLocalStorageItem(key));
  if (!existing || existing.ownerId === ownerId) {
    removeLocalStorageItem(key);
  }
};

const getCheckoutPaymentPollWebLockManager = (): CheckoutWebLockManager | null => {
  if (typeof navigator === 'undefined') return null;
  const lockManager = (navigator as Navigator & { locks?: Partial<CheckoutWebLockManager> }).locks;
  return typeof lockManager?.request === 'function' ? lockManager as CheckoutWebLockManager : null;
};

export const startCheckoutPaymentPollWebLockSession = async (
  orderId: number,
): Promise<CheckoutPaymentPollWebLockSession | null> => {
  const lockManager = getCheckoutPaymentPollWebLockManager();
  if (!lockManager) return null;

  let releaseLock: (() => void) | null = null;
  let resolveDone: () => void = () => undefined;
  let rejectDone: (error: unknown) => void = () => undefined;
  let resolveReady: (session: CheckoutPaymentPollWebLockSession) => void = () => undefined;
  let rejectReady: (error: unknown) => void = () => undefined;
  let readySettled = false;
  let acquiredLock = false;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const ready = new Promise<CheckoutPaymentPollWebLockSession>((resolve, reject) => {
    resolveReady = (session) => {
      if (readySettled) return;
      readySettled = true;
      resolve(session);
    };
    rejectReady = (error) => {
      if (readySettled) return;
      readySettled = true;
      reject(error);
    };
  });

  const releaseSignal = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const release = () => {
    releaseLock?.();
  };

  const requestDone = lockManager.request<void>(
    checkoutPaymentPollWebLockName(orderId),
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        resolveDone();
        resolveReady({ acquired: false, release: () => undefined, done: Promise.resolve() });
        return;
      }
      acquiredLock = true;
      resolveReady({ acquired: true, release, done });
      await releaseSignal;
    },
  );

  requestDone.then(resolveDone, (error) => {
    if (!readySettled) {
      resolveDone();
      rejectReady(error);
      return;
    }
    if (acquiredLock) {
      rejectDone(error);
    }
  });

  return ready;
};

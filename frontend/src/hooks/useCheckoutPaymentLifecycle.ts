import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { createApiAbortController, orderApi, paymentApi } from '../api';
import type { OrderCustomer, PaymentCustomer } from '../types';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import {
  CHECKOUT_GUEST_DRAFT_KEY,
  CHECKOUT_PAYMENT_POLL_MAX_MS,
  checkoutPaymentPollResultKey,
  clearCheckoutIdempotencyKey,
  clearCheckoutPendingOrder,
  isCheckoutPaymentPollTerminal,
  normalizeStatusCode,
  parseCheckoutPaymentPollResult,
  readCheckoutPaymentPollResult,
  writeCheckoutPaymentPollResult,
  type CheckoutMessageType,
  type CheckoutPaymentPollResult,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import {
  claimCheckoutPaymentPollLock,
  createCheckoutPaymentPollOwnerId,
  releaseCheckoutPaymentPollLock,
  startCheckoutPaymentPollWebLockSession,
  type CheckoutPaymentPollWebLockSession,
} from '../utils/checkoutPaymentPollLock';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { removeSessionStorageItem } from '../utils/safeStorage';

type UseCheckoutPaymentLifecycleParams = {
  createdOrderId?: number;
  createdOrderNo?: string;
  guestPaymentEmail?: string;
  payment: PaymentCustomer | null;
  paymentStatus?: string;
  pendingPaymentMethod: string;
  setPayment: Dispatch<SetStateAction<PaymentCustomer | null>>;
  setCreatedOrder: Dispatch<SetStateAction<OrderCustomer | null>>;
  setPaymentCreateError: Dispatch<SetStateAction<string | null>>;
  showCheckoutMessage: (type: CheckoutMessageType, messageText: string) => void;
  t: CheckoutTranslationFn;
};

/**
 * Commercial checkout payment lifecycle:
 * - clear pending/idempotency once payment exists
 * - clear guest draft after successful guest payment
 * - recover latest payment when order exists without payment payload
 * - multi-tab-safe pending payment poll with Web Locks + storage lock fallback
 */
export const useCheckoutPaymentLifecycle = ({
  createdOrderId,
  createdOrderNo,
  guestPaymentEmail,
  payment,
  paymentStatus,
  pendingPaymentMethod,
  setPayment,
  setCreatedOrder,
  setPaymentCreateError,
  showCheckoutMessage,
  t,
}: UseCheckoutPaymentLifecycleParams) => {
  const paymentPollStartedAtRef = useRef<number | null>(null);
  const paymentPollOwnerIdRef = useRef<string | null>(null);
  if (!paymentPollOwnerIdRef.current) {
    paymentPollOwnerIdRef.current = createCheckoutPaymentPollOwnerId();
  }

  useEffect(() => {
    if (!payment?.id) return;
    clearCheckoutIdempotencyKey();
    clearCheckoutPendingOrder();
  }, [payment?.id]);

  useEffect(() => {
    if (guestPaymentEmail && normalizeStatusCode(paymentStatus) === 'PAID') {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [guestPaymentEmail, paymentStatus]);

  useEffect(() => {
    if (!createdOrderId || paymentStatus !== 'PENDING') {
      paymentPollStartedAtRef.current = null;
    }
  }, [createdOrderId, paymentStatus]);

  useEffect(() => {
    if (!createdOrderId || payment || !pendingPaymentMethod) return;
    let disposed = false;
    const abortController = createApiAbortController();
    const timer = window.setTimeout(async () => {
      if (disposed || abortController.signal.aborted) return;
      try {
        const hasToken = hasAuthenticatedCartSession();
        const guestOrderNo = !hasToken && guestPaymentEmail ? createdOrderNo : undefined;
        const paymentRes = await paymentApi.getLatestByOrder(
          createdOrderId,
          hasToken ? undefined : guestPaymentEmail,
          guestOrderNo,
          { signal: abortController.signal },
        );
        if (!disposed && !abortController.signal.aborted) {
          setPayment(paymentRes.data);
          setPaymentCreateError(null);
        }
      } catch (error) {
        if (disposed || abortController.signal.aborted) return;
        reportNonBlockingError('Checkout.refreshSubmittedPayment', error);
      }
    }, 1500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      abortController.abort();
    };
  }, [createdOrderId, createdOrderNo, guestPaymentEmail, payment, pendingPaymentMethod, setPayment, setPaymentCreateError]);

  useEffect(() => {
    if (!createdOrderId || paymentStatus !== 'PENDING') return;
    if (process.env.NODE_ENV === 'test') return;
    const ownerId = paymentPollOwnerIdRef.current || createCheckoutPaymentPollOwnerId();
    paymentPollOwnerIdRef.current = ownerId;
    const shouldRefreshOrder = hasAuthenticatedCartSession();
    const guestOrderNo = !shouldRefreshOrder && guestPaymentEmail ? createdOrderNo : undefined;
    const pollStartedAt = paymentPollStartedAtRef.current || Date.now();
    paymentPollStartedAtRef.current = pollStartedAt;
    let disposed = false;
    let polling = false;
    let pollAbortController: AbortController | null = null;
    let ownsLock = false;
    let webLockUnavailable = false;
    let webLockSession: CheckoutPaymentPollWebLockSession | null = null;
    let webLockAttempt: Promise<CheckoutPaymentPollWebLockSession | null> | null = null;

    const releaseWebLockSession = () => {
      webLockSession?.release();
      webLockSession = null;
    };
    const abortActivePollRequest = () => {
      pollAbortController?.abort();
      pollAbortController = null;
    };
    const getWebLockSession = async () => {
      if (webLockUnavailable) return null;
      if (webLockSession?.acquired) return webLockSession;
      if (!webLockAttempt) {
        webLockAttempt = startCheckoutPaymentPollWebLockSession(createdOrderId)
          .then((session) => {
            if (session?.acquired) {
              webLockSession = session;
              session.done.catch((error) => {
                reportNonBlockingError('Checkout.pollPendingPaymentWebLock', error);
              });
            }
            return session;
          })
          .catch((error) => {
            webLockUnavailable = true;
            reportNonBlockingError('Checkout.pollPendingPaymentWebLock', error);
            return null;
          })
          .finally(() => {
            webLockAttempt = null;
          });
      }
      return webLockAttempt;
    };
    const applySharedPollResult = (result: CheckoutPaymentPollResult | null) => {
      if (disposed || !result || result.ownerId === ownerId || result.orderId !== createdOrderId) return false;
      setPayment(result.payment);
      if (result.order) {
        setCreatedOrder(result.order);
      }
      return true;
    };

    applySharedPollResult(readCheckoutPaymentPollResult(createdOrderId));
    const handlePaymentPollStorage = (event: StorageEvent) => {
      if (event.key !== checkoutPaymentPollResultKey(createdOrderId) || !event.newValue || disposed) return;
      applySharedPollResult(parseCheckoutPaymentPollResult(event.newValue));
    };
    window.addEventListener('storage', handlePaymentPollStorage);

    const timer = window.setInterval(async () => {
      if (disposed) return;
      if (Date.now() - pollStartedAt >= CHECKOUT_PAYMENT_POLL_MAX_MS) {
        disposed = true;
        polling = false;
        window.clearInterval(timer);
        if (ownsLock) {
          releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
          ownsLock = false;
        }
        releaseWebLockSession();
        showCheckoutMessage('warning', t('pages.checkout.paymentPollingTimeout'));
        return;
      }
      if (disposed || polling) return;
      const sharedResult = readCheckoutPaymentPollResult(createdOrderId);
      if (applySharedPollResult(sharedResult) && isCheckoutPaymentPollTerminal(sharedResult?.payment)) {
        return;
      }
      polling = true;
      let ownsThisPoll = false;
      let ownsStorageLockForPoll = false;
      try {
        const activeWebLockSession = await getWebLockSession();
        if (disposed) {
          activeWebLockSession?.release();
          return;
        }
        if (activeWebLockSession) {
          if (!activeWebLockSession.acquired) return;
          ownsThisPoll = true;
        } else {
          ownsStorageLockForPoll = true;
          ownsThisPoll = await claimCheckoutPaymentPollLock(createdOrderId, createdOrderNo, ownerId);
          ownsLock = ownsLock || ownsThisPoll;
        }
        if (disposed || !ownsThisPoll) return;
        const abortController = createApiAbortController();
        pollAbortController = abortController;
        const paymentRes = await paymentApi.getLatestByOrder(
          createdOrderId,
          shouldRefreshOrder ? undefined : guestPaymentEmail,
          guestOrderNo,
          { signal: abortController.signal },
        );
        if (pollAbortController === abortController) {
          pollAbortController = null;
        }
        if (disposed || abortController.signal.aborted) return;
        const latestPayment = paymentRes.data;
        setPayment(latestPayment);
        writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment);
        if (shouldRefreshOrder) {
          const orderRes = await orderApi.getById(createdOrderId);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
          writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment, orderRes.data);
        } else if (guestPaymentEmail && guestOrderNo) {
          const orderRes = await orderApi.getById(createdOrderId, guestPaymentEmail, guestOrderNo);
          if (disposed) return;
          setCreatedOrder(orderRes.data);
          writeCheckoutPaymentPollResult(createdOrderId, ownerId, latestPayment, orderRes.data);
        }
      } catch (error) {
        if (disposed || pollAbortController?.signal.aborted) return;
        reportNonBlockingError('Checkout.pollPendingPayment', error);
      } finally {
        pollAbortController = null;
        polling = false;
        if (disposed && ownsStorageLockForPoll && ownsThisPoll) {
          releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
          ownsLock = false;
        }
        if (disposed) {
          releaseWebLockSession();
        }
      }
    }, 5000);

    return () => {
      const shouldReleaseLock = ownsLock && !polling;
      const shouldReleaseWebLock = !polling;
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('storage', handlePaymentPollStorage);
      abortActivePollRequest();
      if (shouldReleaseLock) {
        releaseCheckoutPaymentPollLock(createdOrderId, ownerId);
      }
      if (shouldReleaseWebLock) {
        releaseWebLockSession();
      }
      webLockAttempt?.then((session) => {
        if (!polling) {
          session?.release();
        }
      }).catch(() => undefined);
    };
  }, [
    createdOrderId,
    createdOrderNo,
    guestPaymentEmail,
    paymentStatus,
    setCreatedOrder,
    setPayment,
    showCheckoutMessage,
    t,
  ]);
};

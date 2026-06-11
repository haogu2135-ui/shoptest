import { useCallback, useEffect, useRef } from 'react';
import { cartApi } from '../api';
import type { CartItem } from '../types';
import { allSettledWithConcurrency } from '../utils/asyncBatch';
import { hasAuthenticatedCartSession } from '../utils/cartSession';
import { normalizeCartQuantity } from '../utils/cartUi';
import { dispatchDomEvent } from '../utils/domEvents';

export const DEFAULT_CART_QUANTITY_SYNC_DELAY_MS = 350;

type UseCartQuantitySyncOptions = {
  isMounted: () => boolean;
  onQuantitySyncError: (error: unknown) => void | Promise<void>;
  setQuantityPending: (itemId: number, pending: boolean) => void;
  clearQuantityPending: (itemIds: number[]) => void;
  syncDelayMs?: number;
};

export const useCartQuantitySync = ({
  isMounted,
  onQuantitySyncError,
  setQuantityPending,
  clearQuantityPending,
  syncDelayMs = DEFAULT_CART_QUANTITY_SYNC_DELAY_MS,
}: UseCartQuantitySyncOptions) => {
  const quantityTimersRef = useRef<Record<number, number>>({});
  const quantityRequestPromisesRef = useRef<Record<number, Promise<void> | undefined>>({});
  const quantityRequestVersionRef = useRef<Record<number, number>>({});
  const disposedRef = useRef(false);

  const isActive = useCallback(
    (itemId: number, requestVersion: number) => (
      !disposedRef.current
      && isMounted()
      && quantityRequestVersionRef.current[itemId] === requestVersion
    ),
    [isMounted],
  );

  const clearQuantityTimer = useCallback((itemId: number) => {
    const timerId = quantityTimersRef.current[itemId];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      delete quantityTimersRef.current[itemId];
    }
  }, []);

  const hasPendingQuantityTimer = useCallback(
    (itemId: number) => quantityTimersRef.current[itemId] !== undefined,
    [],
  );

  const cancelQuantitySync = useCallback((itemIds: number[]) => {
    itemIds.forEach((itemId) => {
      clearQuantityTimer(itemId);
      quantityRequestVersionRef.current[itemId] = (quantityRequestVersionRef.current[itemId] || 0) + 1;
      delete quantityRequestPromisesRef.current[itemId];
    });
    clearQuantityPending(itemIds);
  }, [clearQuantityPending, clearQuantityTimer]);

  const scheduleQuantitySync = useCallback((itemId: number, quantity: number) => {
    clearQuantityTimer(itemId);
    const requestVersion = (quantityRequestVersionRef.current[itemId] || 0) + 1;
    quantityRequestVersionRef.current[itemId] = requestVersion;
    setQuantityPending(itemId, true);
    quantityTimersRef.current[itemId] = window.setTimeout(() => {
      delete quantityTimersRef.current[itemId];
      const syncPromise = cartApi.updateQuantity(itemId, quantity)
        .then(() => {
          if (!isActive(itemId, requestVersion)) return;
          dispatchDomEvent('shop:cart-updated');
        })
        .catch((error: unknown) => {
          if (!isActive(itemId, requestVersion)) return;
          void Promise.resolve(onQuantitySyncError(error)).catch(() => undefined);
        })
        .finally(() => {
          if (quantityRequestVersionRef.current[itemId] === requestVersion) {
            delete quantityRequestPromisesRef.current[itemId];
          }
          if (isActive(itemId, requestVersion)) {
            setQuantityPending(itemId, false);
          }
        });
      quantityRequestPromisesRef.current[itemId] = syncPromise;
      void syncPromise.catch(() => undefined);
    }, syncDelayMs);
  }, [clearQuantityTimer, isActive, onQuantitySyncError, setQuantityPending, syncDelayMs]);

  const flushPendingQuantityUpdates = useCallback(async (checkoutSnapshot: CartItem[]) => {
    if (!hasAuthenticatedCartSession()) return;
    const affectedIds = new Set<number>();
    const inFlightPromises = checkoutSnapshot
      .map((item) => {
        const promise = quantityRequestPromisesRef.current[item.id];
        if (promise) affectedIds.add(item.id);
        return promise;
      })
      .filter((promise): promise is Promise<void> => Boolean(promise));

    checkoutSnapshot.forEach((item) => {
      if (quantityTimersRef.current[item.id] !== undefined) {
        affectedIds.add(item.id);
        clearQuantityTimer(item.id);
      }
    });
    if (affectedIds.size === 0) return;

    if (inFlightPromises.length > 0) {
      await Promise.allSettled(inFlightPromises);
    }

    const itemsToSync = checkoutSnapshot.filter((item) => affectedIds.has(item.id));
    itemsToSync.forEach((item) => {
      quantityRequestVersionRef.current[item.id] = (quantityRequestVersionRef.current[item.id] || 0) + 1;
      delete quantityRequestPromisesRef.current[item.id];
    });

    try {
      const results = await allSettledWithConcurrency(
        itemsToSync,
        (item) => cartApi.updateQuantity(item.id, normalizeCartQuantity(item, item.quantity)),
      );
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        throw failed.reason;
      }
      dispatchDomEvent('shop:cart-updated');
    } catch (error: unknown) {
      await onQuantitySyncError(error);
      throw error;
    } finally {
      clearQuantityPending(itemsToSync.map((item) => item.id));
    }
  }, [clearQuantityPending, clearQuantityTimer, onQuantitySyncError]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      Object.values(quantityTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      quantityTimersRef.current = {};
      quantityRequestPromisesRef.current = {};
      quantityRequestVersionRef.current = {};
    };
  }, []);

  return {
    cancelQuantitySync,
    flushPendingQuantityUpdates,
    hasPendingQuantityTimer,
    scheduleQuantitySync,
  };
};

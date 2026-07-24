import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import {
  CHECKOUT_GUEST_DRAFT_KEY,
  CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS,
  hasHydratableCheckoutValue,
  mergeHydratableCheckoutFields,
  normalizeCheckoutGuestDraftFields,
  normalizeCheckoutPostalCode,
  normalizeCheckoutText,
  normalizeLikelyCheckoutPhone,
  readCheckoutGuestDraftFields,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
} from '../utils/checkoutHelpers';
import { getSessionStorageItem, removeSessionStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import { reportNonBlockingError } from '../utils/nonBlockingError';

type CheckoutFormInstance = FormInstance<CheckoutFormValues>;

type UseCheckoutGuestDraftParams = {
  checkoutFormSnapshotRef: MutableRefObject<CheckoutFormSnapshot>;
  form: CheckoutFormInstance;
  hasCheckoutItems: boolean;
  initialCheckoutDraftRef: MutableRefObject<CheckoutFormSnapshot | null | undefined>;
  isGuestCheckout: boolean;
  mergeCheckoutFormSnapshot: (updates: CheckoutFormSnapshot, preserveHydratedValues?: boolean) => void;
  setFormHydrationRevision: Dispatch<SetStateAction<number>>;
  watchedGuestEmail?: unknown;
  watchedPhone?: unknown;
  watchedPostalCode?: unknown;
  watchedRecipientName?: unknown;
  watchedRegion?: unknown;
  watchedShippingAddress?: unknown;
};

/**
 * Commercial guest checkout draft lifecycle:
 * - hydrate form from sessionStorage draft on guest entry
 * - clear stale draft when authenticated
 * - debounce autosave while typing contact/address fields
 */
export const useCheckoutGuestDraft = ({
  checkoutFormSnapshotRef,
  form,
  hasCheckoutItems,
  initialCheckoutDraftRef,
  isGuestCheckout,
  mergeCheckoutFormSnapshot,
  setFormHydrationRevision,
  watchedGuestEmail,
  watchedPhone,
  watchedPostalCode,
  watchedRecipientName,
  watchedRegion,
  watchedShippingAddress,
}: UseCheckoutGuestDraftParams) => {
  useEffect(() => {
    if (!hasCheckoutItems) return;
    if (!isGuestCheckout) {
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      return;
    }
    const rawDraft = getSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    if (!rawDraft) return;
    try {
      const nextDraftFields = normalizeCheckoutGuestDraftFields(JSON.parse(rawDraft));
      if (nextDraftFields) {
        form.setFieldsValue(nextDraftFields);
        mergeCheckoutFormSnapshot(nextDraftFields);
        setFormHydrationRevision((revision) => revision + 1);
      }
    } catch (error) {
      reportNonBlockingError('Checkout.hydrateGuestDraft', error);
      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
    }
  }, [form, hasCheckoutItems, isGuestCheckout, mergeCheckoutFormSnapshot, setFormHydrationRevision]);

  useEffect(() => {
    if (!hasCheckoutItems || !isGuestCheckout) return;
    const timer = window.setTimeout(() => {
      const watchedDraft = {
        guestEmail: normalizeCheckoutText(watchedGuestEmail, 120),
        recipientName: normalizeCheckoutText(watchedRecipientName, 80),
        phone: normalizeLikelyCheckoutPhone(watchedPhone),
        region: Array.isArray(watchedRegion) ? watchedRegion : undefined,
        shippingAddress: normalizeCheckoutText(watchedShippingAddress, 260),
        postalCode: normalizeCheckoutPostalCode(watchedPostalCode),
      };
      const existingDraft = readCheckoutGuestDraftFields();
      const draft = mergeHydratableCheckoutFields(
        existingDraft || checkoutFormSnapshotRef.current || initialCheckoutDraftRef.current || {},
        watchedDraft,
      );
      const hasDraft = Object.values(draft).some(hasHydratableCheckoutValue);
      if (hasDraft) {
        setSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY, JSON.stringify(draft));
        mergeCheckoutFormSnapshot(draft, true);
      } else {
        removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);
      }
    }, CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    checkoutFormSnapshotRef,
    hasCheckoutItems,
    initialCheckoutDraftRef,
    isGuestCheckout,
    mergeCheckoutFormSnapshot,
    watchedGuestEmail,
    watchedPhone,
    watchedPostalCode,
    watchedRecipientName,
    watchedRegion,
    watchedShippingAddress,
  ]);
};

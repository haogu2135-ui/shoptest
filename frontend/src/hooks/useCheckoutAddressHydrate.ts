import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import type { UserAddress } from '../types';
import {
  getSavedAddressDetail,
  getSavedAddressPostalCode,
  getSavedAddressRegionPath,
  normalizeLikelyCheckoutPhone,
  type CheckoutFormSnapshot,
  type CheckoutFormValues,
} from '../utils/checkoutHelpers';

type CheckoutFormInstance = FormInstance<CheckoutFormValues>;

type UseCheckoutAddressHydrateParams = {
  addresses: UserAddress[];
  form: CheckoutFormInstance;
  hasCheckoutItems: boolean;
  isGuestCheckout: boolean;
  mergeCheckoutFormSnapshot: (updates: CheckoutFormSnapshot, preserveHydratedValues?: boolean) => void;
  selectedAddressId: number | 'new';
  setFormHydrationRevision: Dispatch<SetStateAction<number>>;
};

/**
 * Commercial checkout address field hydration:
 * - fill form from selected saved address
 * - clear address fields when authenticated shopper chooses "new"
 * - bumps form hydration revision for dependent readiness recomputes
 */
export const useCheckoutAddressHydrate = ({
  addresses,
  form,
  hasCheckoutItems,
  isGuestCheckout,
  mergeCheckoutFormSnapshot,
  selectedAddressId,
  setFormHydrationRevision,
}: UseCheckoutAddressHydrateParams) => {
  const lastHydratedKeyRef = useRef<string>('');

  useEffect(() => {
    if (!hasCheckoutItems) {
      lastHydratedKeyRef.current = '';
      return;
    }
    if (selectedAddressId !== 'new') {
      const address = addresses.find((item) => String(item.id) === String(selectedAddressId));
      if (!address) return;
      const hydrateKey = `saved:${address.id}:${address.recipientName}:${address.phone}:${address.region}:${address.postalCode}:${address.detailAddress || address.address}`;
      if (lastHydratedKeyRef.current === hydrateKey) return;
      lastHydratedKeyRef.current = hydrateKey;
      const savedRegionPath = getSavedAddressRegionPath(address);
      const savedPostalCode = getSavedAddressPostalCode(address);
      const savedDetail = getSavedAddressDetail(address);
      const savedAddressFields = {
        recipientName: address.recipientName,
        phone: normalizeLikelyCheckoutPhone(address.phone),
        region: savedRegionPath.length > 0 ? savedRegionPath : undefined,
        shippingAddress: savedDetail || undefined,
        postalCode: savedPostalCode || undefined,
      };
      form.setFieldsValue(savedAddressFields);
      mergeCheckoutFormSnapshot(savedAddressFields);
      setFormHydrationRevision((revision) => revision + 1);
      return;
    }

    if (!isGuestCheckout && addresses.length > 0) {
      const hydrateKey = 'new';
      if (lastHydratedKeyRef.current === hydrateKey) return;
      lastHydratedKeyRef.current = hydrateKey;
      const clearedAddressFields = {
        recipientName: undefined,
        phone: undefined,
        region: undefined,
        shippingAddress: undefined,
        postalCode: undefined,
      };
      form.setFieldsValue(clearedAddressFields);
      mergeCheckoutFormSnapshot(clearedAddressFields);
      setFormHydrationRevision((revision) => revision + 1);
    }
  }, [addresses, form, hasCheckoutItems, isGuestCheckout, mergeCheckoutFormSnapshot, selectedAddressId, setFormHydrationRevision]);
};

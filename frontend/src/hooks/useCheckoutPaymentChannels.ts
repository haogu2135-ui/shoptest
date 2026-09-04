import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { FormInstance } from 'antd/es/form';
import { createApiAbortController, paymentApi } from '../api';
import type { PaymentChannel } from '../types';
import { createPaymentMethodDetails } from '../utils/paymentMethods';
import {
  resolveCheckoutPaymentMethod,
  type CheckoutFormValues,
  type CheckoutTranslationFn,
} from '../utils/checkoutHelpers';
import { getApiErrorMessage } from '../utils/apiError';
import { getSessionStorageItem, removeSessionStorageItem, setSessionStorageItem } from '../utils/safeStorage';
import type { Language } from '../i18n';

type CheckoutFormInstance = FormInstance<CheckoutFormValues>;

type UseCheckoutPaymentChannelsParams = {
  checkoutLocalizationRef: MutableRefObject<{ t: CheckoutTranslationFn; language: Language }>;
  currency: string;
  form: CheckoutFormInstance;
  hasCheckoutItems: boolean;
  mountedRef: MutableRefObject<boolean>;
  paymentChannelsReloadKey: number;
  paymentChannelsRequestSeqRef: MutableRefObject<number>;
  setPaymentChannels: Dispatch<SetStateAction<PaymentChannel[]>>;
  setPaymentChannelsAvailable: Dispatch<SetStateAction<boolean>>;
  setPaymentChannelsError: Dispatch<SetStateAction<string | null>>;
  setPaymentChannelsLoading: Dispatch<SetStateAction<boolean>>;
};

/**
 * Commercial checkout payment channel bootstrap:
 * - load enabled channels only when cart has items
 * - request-seq + disposed guards against stale responses
 * - bootstrap remembered/default payment method into the form
 */
export const useCheckoutPaymentChannels = ({
  checkoutLocalizationRef,
  currency,
  form,
  hasCheckoutItems,
  mountedRef,
  paymentChannelsReloadKey,
  paymentChannelsRequestSeqRef,
  setPaymentChannels,
  setPaymentChannelsAvailable,
  setPaymentChannelsError,
  setPaymentChannelsLoading,
}: UseCheckoutPaymentChannelsParams) => {
  useEffect(() => {
    if (!hasCheckoutItems) {
      paymentChannelsRequestSeqRef.current += 1;
      setPaymentChannels((current) => (current.length === 0 ? current : []));
      setPaymentChannelsLoading(false);
      setPaymentChannelsError(null);
      setPaymentChannelsAvailable(false);
      return;
    }
    let disposed = false;
    const abortController = createApiAbortController();
    const requestSeq = paymentChannelsRequestSeqRef.current + 1;
    paymentChannelsRequestSeqRef.current = requestSeq;
    const isCurrentPaymentChannelsRequest = () => (
      !disposed
      && mountedRef.current
      && paymentChannelsRequestSeqRef.current === requestSeq
    );
    const finishPaymentChannelsLoading = () => {
      if (!isCurrentPaymentChannelsRequest()) return;
      setPaymentChannelsLoading(false);
    };
    setPaymentChannelsLoading(true);
    setPaymentChannelsError(null);
    paymentApi.getChannels({ signal: abortController.signal })
      .then((res) => {
        if (!isCurrentPaymentChannelsRequest()) return;
        const channels = res.data;
        setPaymentChannels(channels);
        setPaymentChannelsError(null);
        setPaymentChannelsAvailable(createPaymentMethodDetails(channels, { currency }).length > 0);
        const current = form.getFieldValue('paymentMethod');
        const rememberedMethod = getSessionStorageItem('checkoutPaymentMethod');
        const bootstrapCandidate = rememberedMethod || (current && current !== 'STRIPE' ? current : null);
        const nextMethod = resolveCheckoutPaymentMethod(bootstrapCandidate, channels, currency);
        const allowed = createPaymentMethodDetails(channels, { currency }).some((method) => method.value === current);
        if (nextMethod && (nextMethod !== current || !allowed)) {
          form.setFieldsValue({ paymentMethod: nextMethod });
          setSessionStorageItem('checkoutPaymentMethod', nextMethod);
        } else if (!nextMethod && current) {
          form.setFieldsValue({ paymentMethod: undefined });
          removeSessionStorageItem('checkoutPaymentMethod');
        }
        finishPaymentChannelsLoading();
      })
      .catch((error: unknown) => {
        if (!isCurrentPaymentChannelsRequest()) return;
        const { t: latestT, language: latestLanguage } = checkoutLocalizationRef.current;
        setPaymentChannels([]);
        setPaymentChannelsError(getApiErrorMessage(
          error,
          latestT('pages.checkout.paymentUnavailableDescription'),
          latestLanguage,
        ));
        setPaymentChannelsAvailable(false);
        form.setFieldsValue({ paymentMethod: undefined });
        finishPaymentChannelsLoading();
      });
    return () => {
      disposed = true;
      abortController.abort();
    };
  }, [currency, form, hasCheckoutItems, paymentChannelsReloadKey]);
};

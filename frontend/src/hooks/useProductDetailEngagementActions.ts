import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { wishlistApi } from '../api';
import type { Language } from '../i18n';
import type { ProductPublic as Product } from '../types';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { getApiErrorMessage } from '../utils/apiError';
import { buildLoginUrlFromWindow } from '../utils/authRedirect';
import { dispatchDomEvent } from '../utils/domEvents';
import { addCompareProduct, MAX_COMPARE_ITEMS } from '../utils/productCompare';
import { getLocalStorageItem } from '../utils/safeStorage';
import { addStockAlert, removeStockAlert } from '../utils/stockAlerts';

type UseProductDetailEngagementActionsParams = {
  id: string | undefined;
  isAlerted: boolean;
  language: Language;
  navigate: NavigateFunction;
  product: Product | null;
  setIsAlerted: Dispatch<SetStateAction<boolean>>;
  setIsCompared: Dispatch<SetStateAction<boolean>>;
  setIsWishlisted: Dispatch<SetStateAction<boolean>>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial product-detail engagement actions:
 * wishlist toggle, stock alerts, and compare.
 */
export const useProductDetailEngagementActions = ({
  id,
  isAlerted,
  language,
  navigate,
  product,
  setIsAlerted,
  setIsCompared,
  setIsWishlisted,
  t,
}: UseProductDetailEngagementActionsParams) => {
  const handleFavorite = async () => {
    const token = getLocalStorageItem('token');
    if (!token) {
      announceAccessibleMessage(t('messages.loginRequired'), 'warning');
      navigate(buildLoginUrlFromWindow());
      return;
    }
    try {
      const res = await wishlistApi.toggle(0, Number(id));
      setIsWishlisted(res.data.wishlisted);
      dispatchDomEvent('shop:wishlist-updated');
      announceAccessibleMessage(res.data.wishlisted ? t('pages.productDetail.favoritedMsg') : t('pages.productDetail.unfavoritedMsg'), 'success');
    } catch (err: unknown) {
      announceAccessibleMessage(getApiErrorMessage(err, t('messages.operationFailed'), language), 'error');
    }
  };

  const handleStockAlert = () => {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }
    if (isAlerted) {
      removeStockAlert(Number(id));
      setIsAlerted(false);
      announceAccessibleMessage(t('pages.stockAlerts.removed'), 'success');
      return;
    }
    const result = addStockAlert(currentProduct);
    setIsAlerted(true);
    announceAccessibleMessage(result.status === 'exists' ? t('pages.stockAlerts.exists') : t('pages.stockAlerts.added'), 'success');
  };

  const handleCompare = () => {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }
    const result = addCompareProduct(currentProduct);
    if (result.status === 'full') {
      announceAccessibleMessage(t('pages.productList.compareFull', { count: MAX_COMPARE_ITEMS }), 'warning');
      return;
    }
    setIsCompared(true);
    announceAccessibleMessage(result.status === 'exists' ? t('pages.productList.compareExists') : t('pages.productList.compareAdded'), 'success');
    navigate('/compare');
  };

  return {
    handleCompare,
    handleFavorite,
    handleStockAlert,
  };
};

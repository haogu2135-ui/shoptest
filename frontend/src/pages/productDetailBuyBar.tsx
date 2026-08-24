import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopButton from '../components/ShopButton';

export type ProductDetailMobileBuyBarProps = {
  buyNowBlocked: boolean;
  buyNowBlockedReason: string;
  compareActionLabel: string;
  favoriteActionLabel: string;
  handleAddToCart: () => void | Promise<void>;
  handleBuyNow: () => void | Promise<void>;
  handleCompare: () => void;
  handleFavorite: () => void | Promise<void>;
  handleStockAlert: () => void;
  homeActionLabel: string;
  isAlerted: boolean;
  isCompared: boolean;
  isOutOfStock: boolean;
  isWishlisted: boolean;
  mobileAddToCartBlocked: boolean;
  mobileBuybarPrice: string;
  mobileBuybarStatus: string;
  mobileCartBlockedReason: string;
  navigate: NavigateFunction;
  purchaseSelectionBlocked: boolean;
  purchaseSubmitting: 'cart' | 'buy' | null;
  stockAlertActionLabel: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial sticky mobile conversion rail:
 * price/status meta plus favorite/compare and cart/buy CTAs.
 */
export const ProductDetailMobileBuyBar: React.FC<ProductDetailMobileBuyBarProps> = ({
  buyNowBlocked,
  buyNowBlockedReason,
  compareActionLabel,
  favoriteActionLabel,
  handleAddToCart,
  handleBuyNow,
  handleCompare,
  handleFavorite,
  handleStockAlert,
  homeActionLabel,
  isAlerted,
  isCompared,
  isOutOfStock,
  isWishlisted,
  mobileAddToCartBlocked,
  mobileBuybarPrice,
  mobileBuybarStatus,
  mobileCartBlockedReason,
  navigate,
  purchaseSelectionBlocked,
  purchaseSubmitting,
  stockAlertActionLabel,
  t,
}) => (
  <div className="product-mobile-buybar">
    <div className="product-mobile-buybar__meta" title={`${mobileBuybarPrice} - ${mobileBuybarStatus}`}>
      <strong>{mobileBuybarPrice}</strong>
      <span className={`product-mobile-buybar__status${purchaseSelectionBlocked || isOutOfStock ? ' product-mobile-buybar__status--attention' : ''}`}>
        {purchaseSelectionBlocked || isOutOfStock ? <ShopIcon path={SI.bell} /> : <ShopIcon path={SI.checkCircle} />}
        <span className="product-mobile-buybar__statusText">{mobileBuybarStatus}</span>
      </span>
    </div>
    <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--home" aria-label={homeActionLabel} title={homeActionLabel} onClick={() => navigate('/')}>
      <ShopIcon path={SI.home} />
      <span>{t('nav.ariaHome')}</span>
    </button>
    <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--favorite" aria-label={favoriteActionLabel} title={favoriteActionLabel} onClick={handleFavorite}>
      {isWishlisted ? <ShopIcon path={SI.heartFill} /> : <ShopIcon path={SI.heart} />}
      <span>{isWishlisted ? t('pages.productDetail.favorited') : t('pages.productDetail.favorite')}</span>
    </button>
    <button type="button" className="product-mobile-buybar__tool product-mobile-buybar__tool--compare" aria-label={compareActionLabel} title={compareActionLabel} onClick={handleCompare}>
      <ShopIcon path={SI.barChart} />
      <span>{isCompared ? t('pages.productList.viewCompare') : t('pages.productList.compare')}</span>
    </button>
    <ShopButton
      className="product-mobile-buybar__cart"
      icon={isOutOfStock ? <ShopIcon path={SI.bell} /> : <ShopIcon path={SI.cart} />}
      aria-label={isOutOfStock ? stockAlertActionLabel : mobileCartBlockedReason}
      title={isOutOfStock ? stockAlertActionLabel : mobileCartBlockedReason}
      onClick={isOutOfStock ? handleStockAlert : handleAddToCart}
      loading={purchaseSubmitting === 'cart'}
      disabled={mobileAddToCartBlocked}
    >
      {isOutOfStock ? (isAlerted ? t('pages.stockAlerts.remove') : t('pages.stockAlerts.notifyMe')) : t('pages.productDetail.addCart')}
    </ShopButton>
    <ShopButton className="product-mobile-buybar__buy" type="primary" icon={<ShopIcon path={SI.thunder} />} aria-label={buyNowBlockedReason} title={buyNowBlockedReason} onClick={handleBuyNow} loading={purchaseSubmitting === 'buy'} disabled={buyNowBlocked}>
      {t('pages.productDetail.buyNow')}
    </ShopButton>
  </div>
);

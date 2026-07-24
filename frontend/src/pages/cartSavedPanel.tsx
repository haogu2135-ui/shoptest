import React from 'react';
import { Link } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import type { ReactNode } from 'react';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopTag from '../components/ShopTag';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { SavedForLaterItem } from '../utils/saveForLater';
import { conversionConfig } from '../utils/conversionConfig';
import { cartImageFallback, resolveCartImage } from '../utils/cartUi';
import { formatSelectedSpecs } from '../utils/selectedSpecs';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export type CartSavedPanelProps = {
  formatMoney: (amount?: number | null) => string;
  getCartItemName: (item: Pick<SavedForLaterItem, 'productId' | 'productName'>) => string;
  getSavedAgeDays: (savedAt?: number) => number;
  hasStaleCartData: boolean;
  language: string;
  moveAllSavedActionLabel: string;
  moveSavedItemToCart: (item: SavedForLaterItem) => void;
  moveSavedItemsToCart: (items: SavedForLaterItem[]) => void;
  navigate: NavigateFunction;
  removeSavedItem: (itemId: number) => void;
  restoreSavedReminderActionLabel: string;
  restoringSaved: boolean;
  restoringSavedItemIds: number[];
  savedItems: SavedForLaterItem[];
  savedReminderItems: SavedForLaterItem[];
  savedValueText: ReactNode;
  t: Translate;
};

/** Commercial save-for-later recovery panel with bulk restore and empty multipath. */
export const CartSavedPanel: React.FC<CartSavedPanelProps> = ({
  formatMoney,
  getCartItemName,
  getSavedAgeDays,
  hasStaleCartData,
  language,
  moveAllSavedActionLabel,
  moveSavedItemToCart,
  moveSavedItemsToCart,
  navigate,
  removeSavedItem,
  restoreSavedReminderActionLabel,
  restoringSaved,
  restoringSavedItemIds,
  savedItems,
  savedReminderItems,
  savedValueText,
  t,
}) => (
  <section
    className="cart-page__savedCard"
    aria-label={`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}
  >
    <div className="cart-page__panelHead">
      <h2 className="cart-page__panelTitle">{`${t('pages.cart.saveForLaterTitle')} (${savedItems.length})`}</h2>
      {savedItems.length > 0 ? (
        <ShopButton
          size="small"
          icon={<ShopIcon path={SI.cart} />}
          loading={restoringSaved}
          disabled={hasStaleCartData || restoringSavedItemIds.length > 0}
          aria-label={moveAllSavedActionLabel}
          title={moveAllSavedActionLabel}
          onClick={() => moveSavedItemsToCart(savedItems)}
        >
          {t('pages.cart.moveAllToCart')}
        </ShopButton>
      ) : null}
    </div>
    {savedItems.length > 0 ? (
      <div className="cart-page__savedValue">
        <ShopIcon path={SI.clock} />
        <span>
          <span className="cart-page__text cart-page__text--strong">{t('pages.cart.savedValueTitle')}</span>
          <span className="cart-page__text cart-page__text--secondary cart-page__amountPhrase">{savedValueText}</span>
        </span>
      </div>
    ) : null}
    {conversionConfig.saveForLater.enabled && savedReminderItems.length > 0 ? (
      <ShopAlert
        type="info"
        showIcon
        className="cart-page__savedReminder"
        message={t('pages.cart.savedReminderTitle', { count: savedReminderItems.length })}
        description={t('pages.cart.savedReminderText')}
        action={(
          <ShopButton
            size="small"
            type="primary"
            loading={restoringSaved}
            disabled={hasStaleCartData || restoringSavedItemIds.length > 0}
            aria-label={restoreSavedReminderActionLabel}
            title={restoreSavedReminderActionLabel}
            onClick={() => moveSavedItemsToCart(savedReminderItems)}
          >
            {t('pages.cart.restoreReminder')}
          </ShopButton>
        )}
      />
    ) : null}
    {savedItems.length === 0 ? (
      <div className="cart-page__savedEmpty" role="status" aria-live="polite">
        <div className="cart-page__savedEmptyInner">
          <div className="cart-page__savedEmptyCopy">
            <div>{t('pages.cart.saveForLaterEmpty')}</div>
            <div className="cart-page__savedEmptyHint">{t('pages.cart.saveForLaterEmptyHint')}</div>
          </div>
          <div className="cart-page__savedEmptyActions">
            <ShopButton
              type="primary"
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.cart.saveForLaterBrowse')}
              title={t('pages.cart.saveForLaterBrowse')}
              onClick={() => navigate('/products')}
            >
              {t('pages.cart.saveForLaterBrowse')}
            </ShopButton>
            <ShopButton
              icon={<ShopIcon path={SI.shopping} />}
              aria-label={t('pages.cart.saveForLaterWishlist')}
              title={t('pages.cart.saveForLaterWishlist')}
              onClick={() => navigate('/wishlist')}
            >
              {t('pages.cart.saveForLaterWishlist')}
            </ShopButton>
          </div>
        </div>
      </div>
    ) : (
      <div className="cart-page__savedGrid" role="list" aria-label={t('pages.cart.saveForLaterTitle')}>
        {savedItems.map((item) => {
          const itemName = getCartItemName(item);
          const moveActionLabel = `${t('pages.cart.moveToCart')}: ${itemName}`;
          const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
          const restoringSavedItem = restoringSaved || restoringSavedItemIds.includes(item.id);
          return (
            <div className="cart-page__savedItem" key={item.id} role="listitem">
              <Link to={`/products/${item.productId}`}>
                <img
                  src={resolveCartImage(item.imageUrl)}
                  alt={itemName}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    if (event.currentTarget.src !== cartImageFallback) {
                      event.currentTarget.src = cartImageFallback;
                    }
                  }}
                />
              </Link>
              <div className="cart-page__savedInfo">
                <Link to={`/products/${item.productId}`}><span className="cart-page__text cart-page__text--strong">{itemName}</span></Link>
                {item.selectedSpecs ? <span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                <span className="cart-page__text cart-page__text--secondary cart-page__savedQuantity commerce-quantity">{t('common.quantity')}: {item.quantity}</span>
                <ShopTag className="cart-page__savedAge">
                  {t('pages.cart.savedDaysAgo', { count: getSavedAgeDays(item.savedAt) })}
                </ShopTag>
                <span className="cart-page__text cart-page__text--strong cart-page__savedPrice commerce-money">{formatMoney(item.price)}</span>
              </div>
              <div className="cart-page__savedActions">
                <ShopButton icon={<ShopIcon path={SI.cart} />} loading={restoringSavedItem} disabled={hasStaleCartData || restoringSavedItem} aria-label={moveActionLabel} title={moveActionLabel} onClick={() => moveSavedItemToCart(item)}>
                  {t('pages.cart.moveToCart')}
                </ShopButton>
                <ShopPopconfirm
                  rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                  title={t('pages.cart.deleteSavedConfirm')}
                  onConfirm={() => removeSavedItem(item.id)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                >
                  <ShopButton danger type="text" icon={<ShopIcon path={SI.delete} />} disabled={restoringSavedItem} aria-label={deleteActionLabel} title={deleteActionLabel} />
                </ShopPopconfirm>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

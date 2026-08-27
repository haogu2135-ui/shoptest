import React from 'react';
import { Link } from 'react-router-dom';
import type { CartItem } from '../types';
import ShopButton from '../components/ShopButton';
import ShopCheckbox from '../components/ShopCheckbox';
import ShopPopconfirm from '../components/ShopPopconfirm';
import { ShopIcon, SI } from '../components/ShopIcon';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import {
  canCartItemCheckout as canCheckout,
  cartImageFallback,
  getCartItemLowStockCount,
  getCartLineAmount,
  getCartLineQuantity,
  getCartQuantityLimit,
  isCartItemAvailable as isAvailable,
  resolveCartImage,
} from '../utils/cartUi';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const isCartItemStockOut = (stock?: number | null) => {
  if (stock === undefined || stock === null) return false;
  const numeric = Number(stock);
  return Number.isFinite(numeric) && numeric <= 0;
};

export type CartQuantityControlProps = {
  checkoutSubmitting: boolean;
  hasStaleCartData: boolean;
  item: CartItem;
  itemName: string;
  quantityDraft?: string;
  removingItemIds: number[];
  setQuantityDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  t: Translate;
  updateQuantity: (item: CartItem, quantity: number) => void;
  updatingItemIds: number[];
};

export const CartQuantityControl: React.FC<CartQuantityControlProps> = ({
  checkoutSubmitting,
  hasStaleCartData,
  item,
  itemName,
  quantityDraft,
  removingItemIds,
  setQuantityDrafts,
  t,
  updateQuantity,
  updatingItemIds,
}) => {
  const quantityLabel = `${t('common.quantity')}: ${itemName}`;
  const decreaseLabel = `${t('pages.cart.decreaseQuantity')}: ${itemName}`;
  const increaseLabel = `${t('pages.cart.increaseQuantity')}: ${itemName}`;
  const limit = getCartQuantityLimit(item.stock);
  const syncing = updatingItemIds.includes(item.id);
  const disabled = hasStaleCartData || !isAvailable(item) || removingItemIds.includes(item.id) || checkoutSubmitting;
  const quantity = getCartLineQuantity(item.quantity);
  const quantityValue = quantityDraft ?? quantity;
  if (!isAvailable(item)) {
    const unavailableLabel = isCartItemStockOut(item.stock) ? t('pages.cart.outOfStock') : t('pages.cart.quantityUnavailable');
    return (
      <div
        className="cart-page__quantityStepper cart-page__quantityStepper--unavailable"
        role="status"
        aria-label={`${quantityLabel}: ${unavailableLabel}`}
        title={unavailableLabel}
      >
        <span className="cart-page__quantityUnavailable">{unavailableLabel}</span>
      </div>
    );
  }

  return (
    <div className="cart-page__quantityStepper" role="group" aria-label={quantityLabel} title={quantityLabel} aria-busy={syncing}>
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.minus} />}
        aria-label={decreaseLabel}
        title={decreaseLabel}
        disabled={disabled || quantity <= 1}
        onClick={() => updateQuantity(item, quantity - 1)}
      />
      <input
        className="cart-page__quantityInput"
        type="number"
        min={1}
        max={limit}
        step={1}
        inputMode="numeric"
        disabled={disabled}
        aria-label={quantityLabel}
        title={quantityLabel}
        value={quantityValue}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          if (nextValue === '') {
            setQuantityDrafts((drafts) => ({ ...drafts, [item.id]: '' }));
            return;
          }
          updateQuantity(item, Math.floor(Number(nextValue) || 1));
        }}
        onBlur={() => {
          if (quantityDraft === '') {
            updateQuantity(item, 1);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && quantityDraft === '') {
            event.currentTarget.blur();
          }
        }}
      />
      <ShopButton
        size="small"
        icon={<ShopIcon path={SI.plus} />}
        aria-label={increaseLabel}
        title={increaseLabel}
        disabled={disabled || quantity >= limit}
        onClick={() => updateQuantity(item, quantity + 1)}
      />
    </div>
  );
};

export type CartLineTotalProps = {
  formatMoney: (amount?: number | null) => string;
  item: CartItem;
  t: Translate;
};

export const CartLineTotal: React.FC<CartLineTotalProps> = ({ formatMoney, item, t }) => (
  canCheckout(item)
    ? <span className="cart-page__text cart-page__text--strong cart-page__priceText commerce-money">{formatMoney(getCartLineAmount(item))}</span>
    : <span className="cart-page__text cart-page__text--danger cart-page__unavailableSubtotal">{t('pages.cart.quantityUnavailable')}</span>
);

export type CartLineItemsProps = {
  allSelected: boolean;
  cartItems: CartItem[];
  checkoutSubmitting: boolean;
  formatMoney: (amount?: number | null) => string;
  getCartItemName: (item: Pick<CartItem, 'productId' | 'productName'>) => string;
  hasStaleCartData: boolean;
  language: string;
  loading: boolean;
  quantityDrafts: Record<number, string>;
  removingItemIds: number[];
  saveForLater: (item: CartItem) => void;
  selectedIds: number[];
  selectedPurchasableCount: number;
  setQuantityDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  t: Translate;
  toggleAll: (checked: boolean) => void;
  toggleOne: (itemId: number, checked: boolean) => void;
  updateQuantity: (item: CartItem, quantity: number) => void;
  updatingItemIds: number[];
  removeItem: (itemId: number) => void;
};

/** Commercial cart line items: desktop table + mobile list with quantity and line actions. */
export const CartLineItems: React.FC<CartLineItemsProps> = ({
  allSelected,
  cartItems,
  checkoutSubmitting,
  formatMoney,
  getCartItemName,
  hasStaleCartData,
  language,
  loading,
  quantityDrafts,
  removingItemIds,
  saveForLater,
  selectedIds,
  selectedPurchasableCount,
  setQuantityDrafts,
  t,
  toggleAll,
  toggleOne,
  updateQuantity,
  updatingItemIds,
  removeItem,
}) => (
  <>
    <div
      className="cart-page__table"
      role="table"
      aria-label={t('pages.cart.title')}
      aria-busy={loading}
    >
      <div className="cart-page__tableHead" role="row">
        <div className="cart-page__tableHeadCell cart-page__tableCol--select" role="columnheader">
          <ShopCheckbox
            checked={allSelected}
            indeterminate={selectedPurchasableCount > 0 && !allSelected}
            disabled={hasStaleCartData}
            aria-label={t('pages.cart.selectAll')}
            title={t('pages.cart.selectAll')}
            onChange={(e) => toggleAll(e.target.checked)}
          >
            {t('pages.cart.selectAll')}
          </ShopCheckbox>
        </div>
        <div className="cart-page__tableHeadCell cart-page__tableCol--product" role="columnheader">
          {t('pages.cart.product')}
        </div>
        <div className="cart-page__tableHeadCell cart-page__tableCol--price" role="columnheader">
          {t('pages.cart.unitPrice')}
        </div>
        <div className="cart-page__tableHeadCell cart-page__tableCol--qty" role="columnheader">
          {t('common.quantity')}
        </div>
        <div className="cart-page__tableHeadCell cart-page__tableCol--subtotal" role="columnheader">
          {t('common.subtotal')}
        </div>
        <div className="cart-page__tableHeadCell cart-page__tableCol--action" role="columnheader">
          {t('common.actions')}
        </div>
      </div>
      <div className="cart-page__tableBody" role="rowgroup">
        {cartItems.map((record) => {
          const itemName = getCartItemName(record);
          const selectItemLabel = `${t('pages.cart.selectAll')}: ${itemName}`;
          const saveActionLabel = `${t('pages.cart.saveForLater')}: ${itemName}`;
          const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
          return (
            <div key={record.id} className="cart-page__tableRow" role="row">
              <div className="cart-page__tableCell cart-page__tableCol--select" role="cell">
                <ShopCheckbox
                  disabled={hasStaleCartData || !canCheckout(record)}
                  checked={selectedIds.includes(record.id)}
                  aria-label={selectItemLabel}
                  title={selectItemLabel}
                  onChange={(e) => toggleOne(record.id, e.target.checked)}
                />
              </div>
              <div className="cart-page__tableCell cart-page__tableCol--product" role="cell">
                <div className="cart-page__productCell">
                  <img
                    src={resolveCartImage(record.imageUrl)}
                    alt={itemName}
                    className="cart-page__tableImage"
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (event.currentTarget.src !== cartImageFallback) {
                        event.currentTarget.src = cartImageFallback;
                      }
                    }}
                  />
                  <div>
                    <Link to={`/products/${record.productId}`}><span className="cart-page__text">{itemName}</span></Link>
                    {record.selectedSpecs ? <div><span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(record.selectedSpecs, t, language)}</span></div> : null}
                    {!canCheckout(record) && <div><span className="cart-page__text cart-page__text--danger">{t('pages.cart.unavailable')}</span></div>}
                    {canCheckout(record) && getCartItemLowStockCount(record) !== null ? (
                      <div>
                        <span className="cart-page__text cart-page__text--warning cart-page__urgency">
                          {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(record) ?? 0 })}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="cart-page__tableCell cart-page__tableCol--price" role="cell">
                <span className="cart-page__text cart-page__priceText commerce-money">{formatMoney(record.price)}</span>
              </div>
              <div className="cart-page__tableCell cart-page__tableCol--qty" role="cell">
                <CartQuantityControl
                  checkoutSubmitting={checkoutSubmitting}
                  hasStaleCartData={hasStaleCartData}
                  item={record}
                  itemName={itemName}
                  quantityDraft={quantityDrafts[record.id]}
                  removingItemIds={removingItemIds}
                  setQuantityDrafts={setQuantityDrafts}
                  t={t}
                  updateQuantity={updateQuantity}
                  updatingItemIds={updatingItemIds}
                />
              </div>
              <div className="cart-page__tableCell cart-page__tableCol--subtotal" role="cell">
                <CartLineTotal formatMoney={formatMoney} item={record} t={t} />
              </div>
              <div className="cart-page__tableCell cart-page__tableCol--action" role="cell">
                <div className="cart-page__tableActions">
                  <ShopButton type="text" icon={<ShopIcon path={SI.clock} />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(record)} disabled={hasStaleCartData || removingItemIds.includes(record.id)}>
                    {t('pages.cart.saveForLater')}
                  </ShopButton>
                  <ShopPopconfirm
                    rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                    title={t('pages.cart.deleteConfirm')}
                    onConfirm={() => removeItem(record.id)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                  >
                    <ShopButton type="text" danger icon={<ShopIcon path={SI.delete} />} size="small" loading={removingItemIds.includes(record.id)} disabled={hasStaleCartData} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</ShopButton>
                  </ShopPopconfirm>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <div className="cart-page__mobileList" role="list" aria-label={t('pages.cart.title')}>
      {cartItems.map((item) => {
        const itemName = getCartItemName(item);
        const saveActionLabel = `${t('pages.cart.saveForLaterShort')}: ${itemName}`;
        const deleteActionLabel = `${t('common.delete')}: ${itemName}`;
        const selectItemLabel = `${t('pages.cart.selectAll')}: ${itemName}`;
        return (
          <article key={item.id} className="cart-page__mobileItem" role="listitem">
            <div className="cart-page__mobileItemTop">
              <ShopCheckbox
                disabled={hasStaleCartData || !canCheckout(item)}
                checked={selectedIds.includes(item.id)}
                aria-label={selectItemLabel}
                title={selectItemLabel}
                onChange={(e) => toggleOne(item.id, e.target.checked)}
              />
              <img
                src={resolveCartImage(item.imageUrl)}
                alt={itemName}
                className="cart-page__mobileItemImage"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.src !== cartImageFallback) {
                    event.currentTarget.src = cartImageFallback;
                  }
                }}
              />
              <div className="cart-page__mobileItemInfo">
                <Link className="cart-page__mobileItemTitle" to={`/products/${item.productId}`}><span className="cart-page__text cart-page__text--strong">{itemName}</span></Link>
                {item.selectedSpecs ? <div className="cart-page__mobileItemMeta"><span className="cart-page__text cart-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span></div> : null}
                {!canCheckout(item) && <div><span className="cart-page__text cart-page__text--danger">{t('pages.cart.unavailable')}</span></div>}
                {canCheckout(item) && getCartItemLowStockCount(item) !== null ? (
                  <div>
                    <span className="cart-page__text cart-page__text--warning cart-page__urgency">
                      {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                    </span>
                  </div>
                ) : null}
                <span className="cart-page__text cart-page__text--secondary cart-page__mobileItemUnit commerce-atomic commerce-price-quantity">
                  <span className="cart-page__mobileItemUnitPrice commerce-money">{formatMoney(item.price)}</span>
                  <span className="commerce-quantity">x {item.quantity}</span>
                </span>
              </div>
            </div>
            <div className="cart-page__mobileItemBottom">
              <div className="cart-page__mobileItemCommerce">
                <CartQuantityControl
                  checkoutSubmitting={checkoutSubmitting}
                  hasStaleCartData={hasStaleCartData}
                  item={item}
                  itemName={itemName}
                  quantityDraft={quantityDrafts[item.id]}
                  removingItemIds={removingItemIds}
                  setQuantityDrafts={setQuantityDrafts}
                  t={t}
                  updateQuantity={updateQuantity}
                  updatingItemIds={updatingItemIds}
                />
                <CartLineTotal formatMoney={formatMoney} item={item} t={t} />
              </div>
              <div className="cart-page__mobileItemActions">
                <ShopButton type="text" icon={<ShopIcon path={SI.clock} />} size="small" aria-label={saveActionLabel} title={saveActionLabel} onClick={() => saveForLater(item)} disabled={hasStaleCartData || removingItemIds.includes(item.id)}>
                  {t('pages.cart.saveForLaterShort')}
                </ShopButton>
                <ShopPopconfirm
                  rootClassName='shop-mobile-popup-layer cart-page-popconfirm'
                  title={t('pages.cart.deleteConfirm')}
                  onConfirm={() => removeItem(item.id)}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                  cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                >
                  <ShopButton type="text" danger icon={<ShopIcon path={SI.delete} />} size="small" loading={removingItemIds.includes(item.id)} disabled={hasStaleCartData} aria-label={deleteActionLabel} title={deleteActionLabel} />
                </ShopPopconfirm>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  </>
);

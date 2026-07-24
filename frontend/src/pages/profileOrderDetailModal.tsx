import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { OrderCustomer, OrderItemCustomer } from '../types';
import ShopButton from '../components/ShopButton';
import ShopModal from '../components/ShopModal';
import ShopTag from '../components/ShopTag';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import {
  resolveOrderImage,
  useImageFallback,
} from '../utils/profileHelpers';

type ProfileOrderDetailModalProps = {
  dateLocale: string;
  formatMoney: (amount?: number | null) => string;
  formatOrderStatusLabel: (status?: string) => string;
  getOrderStatusColor: (status?: string) => string;
  handleReorder: () => void | Promise<void>;
  handleTrackShipment: (trackingNumber?: string, carrierCode?: string, orderId?: number) => void;
  language: string;
  openProductDetail: (productId: number) => void;
  orderDetailVisible: boolean;
  orderItems: OrderItemCustomer[];
  profileOrderItemName: (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => string;
  reorderSelectedOrderActionLabel: string;
  reordering: boolean;
  selectedOrder: OrderCustomer | null;
  selectedOrderTrackActionLabel: string;
  setOrderDetailVisible: (visible: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile order detail modal:
 * amounts, logistics, return timeline, and reorderable line items.
 */
export const ProfileOrderDetailModal: React.FC<ProfileOrderDetailModalProps> = ({
  dateLocale,
  formatMoney,
  formatOrderStatusLabel,
  getOrderStatusColor,
  handleReorder,
  handleTrackShipment,
  language,
  openProductDetail,
  orderDetailVisible,
  orderItems,
  profileOrderItemName,
  reorderSelectedOrderActionLabel,
  reordering,
  selectedOrder,
  selectedOrderTrackActionLabel,
  setOrderDetailVisible,
  t,
}) => (
      <ShopModal
        title={t('pages.profile.orderDetail', { id: selectedOrder?.orderNo || selectedOrder?.id || '' })}
        open={orderDetailVisible}
        onClose={() => setOrderDetailVisible(false)}
        footer={null}
        width={640}
        className="profile-mobile-safe-modal profile-order-detail-modal"
        rootClassName="profile-order-detail-modalRoot"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        ariaLabel={t('pages.profile.orderDetail', { id: selectedOrder?.orderNo || selectedOrder?.id || '' })}
      >
        {selectedOrder && (
          <div>
            <dl className="profile-page__descList profile-order-detail__descriptions">
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('common.status')}</dt>
                <dd className="profile-page__descValue"><ShopTag color={getOrderStatusColor(selectedOrder.status)}>{formatOrderStatusLabel(selectedOrder.status)}</ShopTag></dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('common.amount')}</dt>
                <dd className="profile-page__descValue"><span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(selectedOrder.totalAmount)}</span></dd>
              </div>
              {selectedOrder.originalAmount ? <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('common.subtotal')}</dt>
                <dd className="profile-page__descValue"><span className="commerce-money">{formatMoney(selectedOrder.originalAmount)}</span></dd>
              </div> : null}
              {selectedOrder.discountAmount && selectedOrder.discountAmount > 0 ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.coupon')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.couponName || '-'} / <span className="commerce-money">-{formatMoney(selectedOrder.discountAmount)}</span></dd>
              </div>
              ) : null}
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.address')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.shippingAddress || '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.paymentMethod')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.paymentMethod ? paymentMethodLabel(selectedOrder.paymentMethod, t) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.adminOrders.tracking')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.trackingNumber ? (
                  <div className="profile-page__inlineRow">
                    <span>{selectedOrder.trackingNumber}</span>
                    {selectedOrder.trackingCarrierName ? <ShopTag>{selectedOrder.trackingCarrierName}</ShopTag> : null}
                    <ShopButton size="small" aria-label={selectedOrderTrackActionLabel} title={selectedOrderTrackActionLabel} onClick={() => handleTrackShipment(selectedOrder.trackingNumber, selectedOrder.trackingCarrierCode, selectedOrder.id)}>{t('pages.adminOrders.track')}</ShopButton>
                  </div>
                ) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnTracking')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.returnTrackingNumber || '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnDeadline')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.returnDeadline ? new Date(selectedOrder.returnDeadline).toLocaleString(dateLocale) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnReason')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.returnReason || '-'}</dd>
              </div>
              {selectedOrder.returnRequestedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnRequestedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.returnRequestedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedOrder.returnApprovedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnApprovedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.returnApprovedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedOrder.returnRejectedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnRejectedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.returnRejectedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedOrder.returnShippedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnShippedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.returnShippedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedOrder.returnedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.returnedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.returnedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedOrder.refundedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.refundedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedOrder.refundedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.shippedAt')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.shippedAt ? new Date(selectedOrder.shippedAt).toLocaleString(dateLocale) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.completedAt')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.completedAt ? new Date(selectedOrder.completedAt).toLocaleString(dateLocale) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.adminOrders.createdAt')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString(dateLocale) : '-'}</dd>
              </div>
            </dl>
            <div className="profile-order-detail__itemsHeader">
              <h5 className="profile-page__title profile-order-detail__itemsTitle">{t('pages.profile.orderItems')}</h5>
              <ShopButton icon={<ShopIcon path={SI.cart} />} loading={reordering} disabled={orderItems.length === 0} aria-label={reorderSelectedOrderActionLabel} title={reorderSelectedOrderActionLabel} onClick={handleReorder}>
                {t('pages.profile.reorder')}
              </ShopButton>
            </div>
            {orderItems.length > 0 ? (
              <ul className="profile-page__itemList profile-order-detail__itemList" role="list">
                {orderItems.map((item, index) => {
                  const itemName = profileOrderItemName(item);
                  const itemActionLabel = `${t('pages.productList.viewDetails')}: ${itemName}`;
                  return (
                    <li key={String(item.id || `${item.productId || 'item'}-${index}`)} className="profile-page__item profile-order-detail__item">
                      <div className="profile-page__itemMeta">
                          <button
                            type="button"
                            aria-label={itemActionLabel}
                            title={itemActionLabel}
                            onClick={() => openProductDetail(item.productId)}
                            className="profile-order-detail__imageButton"
                          >
                            <img
                              src={resolveOrderImage(item.imageUrl)}
                              alt={itemName}
                              className="profile-order-detail__image"
                              loading="lazy"
                              decoding="async"
                              onError={useImageFallback}
                            />
                          </button>
                        <div className="profile-page__itemBody">
                          <button
                            type="button"
                            aria-label={itemActionLabel}
                            title={itemActionLabel}
                            onClick={() => openProductDetail(item.productId)}
                            className="profile-order-detail__productButton"
                          >
                            {itemName}
                          </button>
                          <div className="profile-page__stackTight">
                            {item.selectedSpecs ? <span className="profile-page__text profile-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                            <span className="profile-page__text profile-page__text--secondary profile-order-detail__unit commerce-atomic commerce-price-quantity">
                              <span className="commerce-money">{formatMoney(item.price)}</span>
                              <span className="commerce-quantity">x {item.quantity}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(item.price * item.quantity)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.noOrderItems')}</span>
            )}
          </div>
        )}
      </ShopModal>

);

export default ProfileOrderDetailModal;

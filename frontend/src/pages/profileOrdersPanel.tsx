import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import type { OrderCustomer, OrderItemCustomer } from '../types';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSearchField from '../components/ShopSearchField';
import ShopTag from '../components/ShopTag';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { dispatchDomEvent } from '../utils/domEvents';
import {
  profileOrderLabel,
  resolveOrderImage,
  useImageFallback,
  type OrderActionHint,
} from '../utils/profileHelpers';

export type ProfileOrdersPanelTab = {
  key: string;
  label: string;
  statuses?: string[];
};

type ProfileOrdersPanelProps = {
  afterSaleCount: number;
  afterSaleFocusText: string;
  afterSaleStatuses: string[];
  confirmReceiptOrder: (order: OrderCustomer) => void;
  dateLocale: string;
  fetchOrders: () => void | Promise<void>;
  filteredOrders: OrderCustomer[];
  formatMoney: (amount?: number | null) => string;
  formatOrderStatusLabel: (status?: string) => string;
  getOrderActionHint: (order: OrderCustomer) => OrderActionHint;
  getOrderStatusColor: (status?: string) => string;
  handleCancelOrder: (orderId: number) => void | Promise<void>;
  handleContinuePayment: (order: OrderCustomer) => void | Promise<void>;
  handleTrackShipment: (trackingNumber?: string, carrierCode?: string, orderId?: number) => void;
  handleViewOrder: (order: OrderCustomer) => void | Promise<void>;
  isPaymentReturnIncomplete: boolean;
  isPaymentReturnSuccess: boolean;
  isReturnableOrder: (order: OrderCustomer) => boolean;
  language: string;
  navigate: (path: string) => void;
  openProductDetail: (productId: number) => void;
  openReturnModal: (order: OrderCustomer) => void;
  openSupport: () => void;
  orderItemPreviewFailedByOrderId: Record<number, boolean>;
  orderItemsByOrderId: Record<number, OrderItemCustomer[]>;
  orderListContextLabel: string;
  orderSearchInputLabel: string;
  orderSearchText: string;
  orderStatusFilter: string;
  orderStatusTabs: ProfileOrdersPanelTab[];
  orders: OrderCustomer[];
  ordersLoadFailed: boolean;
  ordersStale: boolean;
  payingOrderId: number | null;
  paymentReturnOrderNo: string;
  paymentReturnStatus: string;
  profileOrderItemName: (item: Pick<OrderItemCustomer, 'productId' | 'productName'>) => string;
  returnApprovedCount: number;
  returnableOrdersCount: number;
  setOrderSearchText: (value: string) => void;
  setOrderStatusFilter: (value: string) => void;
  setReturnShipmentOrder: (order: OrderCustomer | null) => void;
  setReturnTrackingNumber: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile orders tab panel:
 * load/empty recovery, payment-return banners, filters, and order cards.
 */
export const ProfileOrdersPanel: React.FC<ProfileOrdersPanelProps> = ({
  afterSaleCount,
  afterSaleFocusText,
  afterSaleStatuses,
  confirmReceiptOrder,
  dateLocale,
  fetchOrders,
  filteredOrders,
  formatMoney,
  formatOrderStatusLabel,
  getOrderActionHint,
  getOrderStatusColor,
  handleCancelOrder,
  handleContinuePayment,
  handleTrackShipment,
  handleViewOrder,
  isPaymentReturnIncomplete,
  isPaymentReturnSuccess,
  isReturnableOrder,
  language,
  navigate,
  openProductDetail,
  openReturnModal,
  openSupport,
  orderItemPreviewFailedByOrderId,
  orderItemsByOrderId,
  orderListContextLabel,
  orderSearchInputLabel,
  orderSearchText,
  orderStatusFilter,
  orderStatusTabs,
  orders,
  ordersLoadFailed,
  ordersStale,
  payingOrderId,
  paymentReturnOrderNo,
  paymentReturnStatus,
  profileOrderItemName,
  returnApprovedCount,
  returnableOrdersCount,
  setOrderSearchText,
  setOrderStatusFilter,
  setReturnShipmentOrder,
  setReturnTrackingNumber,
  t,
}) => (
  <>
        {ordersLoadFailed && orders.length === 0 ? (
            <div data-profile-orders-load-recovery="true">
              <PageError
                className="profile-section-card profile-load-error"
                title={t('pages.profile.fetchOrdersFailed')}
                description={t('common.loadFailedRetry')}
                actions={[
                  {
                    key: 'retry',
                    label: t('common.retry'),
                    onClick: () => fetchOrders(),
                    type: 'primary',
                  },
                  {
                    key: 'shop',
                    label: t('pages.profile.goShopping'),
                    onClick: () => navigate('/products'),
                    type: 'default',
                  },
                  {
                    key: 'track',
                    label: t('nav.trackOrder'),
                    onClick: () => navigate('/track-order'),
                    type: 'default',
                  },
                  {
                    key: 'coupons',
                    label: t('pages.profile.emptyOrdersCoupons'),
                    onClick: () => navigate('/coupons'),
                    type: 'default',
                  },
                  {
                    key: 'support',
                    label: t('pages.productList.loadRecoverySupport'),
                    onClick: () => dispatchDomEvent('shop:open-support'),
                    type: 'default',
                  },
                ]}
              />
            </div>
          ) : orders.length === 0 ? (
            <PageEmpty
              className="profile-empty-orders"
              data-profile-orders-empty-actions="true"
              description={(
                <div className="profile-empty-orders__copy">
                  <div>{t('pages.profile.noOrders')}</div>
                  <div className="profile-empty-orders__hint">{t('pages.profile.noOrdersHint')}</div>
                </div>
              )}
              actions={[
                {
                  key: 'shop',
                  label: t('pages.profile.goShopping'),
                  onClick: () => navigate('/products'),
                },
                {
                  key: 'coupons',
                  label: t('pages.profile.emptyOrdersCoupons'),
                  onClick: () => navigate('/coupons'),
                  type: 'default',
                },
                {
                  key: 'pet-finder',
                  label: t('pages.profile.emptyOrdersPetFinder'),
                  onClick: () => navigate('/pet-finder'),
                  type: 'default',
                },
                {
                  key: 'track',
                  label: t('pages.profile.authGateTrackOrder'),
                  onClick: () => navigate('/track-order'),
                  type: 'default',
                },
              ]}
            />
          ) : (
            <div className="profile-orders">
              {(isPaymentReturnSuccess || isPaymentReturnIncomplete) ? (
                <ShopAlert
                  className="profile-payment-return"
                  data-profile-payment-return={isPaymentReturnSuccess ? 'success' : paymentReturnStatus === 'failed' ? 'failed' : 'cancelled'}
                  type={isPaymentReturnSuccess ? 'success' : paymentReturnStatus === 'failed' ? 'error' : 'warning'}
                  showIcon
                  role="alert"
                  aria-live="assertive"
                  message={isPaymentReturnSuccess
                    ? t('pages.profile.paymentReturnSynced')
                    : paymentReturnStatus === 'failed'
                      ? (paymentReturnOrderNo
                        ? t('pages.profile.paymentReturnFailedOrder', { orderNo: paymentReturnOrderNo })
                        : t('pages.profile.paymentReturnFailed'))
                      : (paymentReturnOrderNo
                        ? t('pages.profile.paymentReturnCancelledOrder', { orderNo: paymentReturnOrderNo })
                        : t('pages.profile.paymentReturnCancelled'))}
                  description={isPaymentReturnSuccess
                    ? t('pages.checkout.paymentRecoveryNextPaid')
                    : t('pages.checkout.paymentRecoveryNextRetry')}
                  action={(
                    <div className="profile-payment-return__actions" data-profile-payment-return-recovery="true">
                      {isPaymentReturnSuccess ? (
                        <>
                          <ShopButton
                            size="small"
                            type="primary"
                            onClick={() => navigate(paymentReturnOrderNo
                              ? `/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
                              : '/track-order')}
                          >
                            {t('pages.paymentInstructions.stickyTrackOrder')}
                          </ShopButton>
                          <ShopButton size="small" onClick={() => navigate('/products')}>
                            {t('pages.profile.goShopping')}
                          </ShopButton>
                          <ShopButton size="small" onClick={() => navigate('/coupons')}>
                            {t('pages.profile.emptyOrdersCoupons')}
                          </ShopButton>
                        </>
                      ) : (
                        <>
                          <ShopButton
                            size="small"
                            type="primary"
                            onClick={() => navigate('/products')}
                          >
                            {t('pages.orderTracking.shopAgain')}
                          </ShopButton>
                          <ShopButton size="small" onClick={() => navigate('/coupons')}>
                            {t('pages.profile.emptyOrdersCoupons')}
                          </ShopButton>
                          <ShopButton
                            size="small"
                            onClick={() => navigate(paymentReturnOrderNo
                              ? `/track-order?orderNo=${encodeURIComponent(paymentReturnOrderNo)}`
                              : '/track-order')}
                          >
                            {t('pages.paymentInstructions.stickyTrackOrder')}
                          </ShopButton>
                          <ShopButton
                            size="small"
                            onClick={() => dispatchDomEvent('shop:open-support', paymentReturnOrderNo
                              ? { orderNo: paymentReturnOrderNo }
                              : undefined)}
                          >
                            {t('pages.profile.contactSupport')}
                          </ShopButton>
                        </>
                      )}
                    </div>
                  )}
                />
              ) : null}
              <div className="profile-after-sale-panel">
                <div className="profile-after-sale-panel__main">
                  <span className="profile-page__text profile-page__text--strong">{t('pages.profile.afterSaleAssistantTitle')}</span>
                  <span className="profile-page__text profile-page__text--secondary">{afterSaleFocusText}</span>
                </div>
                <div className="profile-after-sale-panel__metrics">
                  <button
                    type="button"
                    className={orderStatusFilter === 'RETURNABLE' ? 'is-active' : ''}
                    aria-pressed={orderStatusFilter === 'RETURNABLE'}
                    aria-label={`${t('pages.profile.afterSaleReturnable')}: ${returnableOrdersCount}`}
                    onClick={() => setOrderStatusFilter('RETURNABLE')}
                  >
                    <strong>{returnableOrdersCount}</strong>
                    <span>{t('pages.profile.afterSaleReturnable')}</span>
                  </button>
                  <button
                    type="button"
                    className={orderStatusFilter === 'AFTER_SALE' ? 'is-active' : ''}
                    aria-pressed={orderStatusFilter === 'AFTER_SALE'}
                    aria-label={`${t('pages.profile.afterSaleActiveCases')}: ${afterSaleCount}`}
                    onClick={() => setOrderStatusFilter('AFTER_SALE')}
                  >
                    <strong>{afterSaleCount}</strong>
                    <span>{t('pages.profile.afterSaleActiveCases')}</span>
                  </button>
                  <button
                    type="button"
                    className={orderStatusFilter === 'RETURN_APPROVED' ? 'is-active' : ''}
                    aria-pressed={orderStatusFilter === 'RETURN_APPROVED'}
                    aria-label={`${t('pages.profile.afterSaleNeedShipment')}: ${returnApprovedCount}`}
                    onClick={() => setOrderStatusFilter('RETURN_APPROVED')}
                  >
                    <strong>{returnApprovedCount}</strong>
                    <span>{t('pages.profile.afterSaleNeedShipment')}</span>
                  </button>
                </div>
              </div>
              {ordersStale ? (
                <ShopAlert
                  type="warning"
                  showIcon
                  role="alert"
                  aria-live="assertive"
                  message={t('pages.profile.ordersStaleWarning')}
                  action={<ShopButton size="small" onClick={() => fetchOrders()}>{t('common.retry')}</ShopButton>}
                />
              ) : null}
              <div className="profile-orders__tabs">
                {orderStatusTabs.map((tab) => {
                  const count = tab.key === 'all'
                    ? orders.length
                    : tab.key === 'RETURNABLE'
                      ? returnableOrdersCount
                      : orders.filter((order) => tab.statuses?.includes(order.status)).length;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={orderStatusFilter === tab.key ? 'profile-orders__tab profile-orders__tab--active' : 'profile-orders__tab'}
                      aria-pressed={orderStatusFilter === tab.key}
                      onClick={() => setOrderStatusFilter(tab.key)}
                    >
                      {tab.label}{tab.key !== 'all' && count > 0 ? ` ${count}` : ''}
                    </button>
                  );
                })}
              </div>
              <div className="profile-orders__toolbar">
                <ShopSearchField
                  className="profile-orders__searchInput"
                  allowClear
                  showSubmit={false}
                  value={orderSearchText}
                  onChange={(value) => setOrderSearchText(value)}
                  placeholder={t('pages.profile.orderSearchPlaceholder')}
                  ariaLabel={orderSearchInputLabel}
                  title={orderSearchInputLabel}
                />
                <ShopButton aria-label={`${t('common.refresh')}: ${orderListContextLabel}`} title={`${t('common.refresh')}: ${orderListContextLabel}`} onClick={() => fetchOrders()}>{t('common.refresh')}</ShopButton>
              </div>
              <div className="profile-orders__header">
                <span>{t('pages.profile.orderInfo')}</span>
                <span>{t('pages.profile.goodsAmount')}</span>
                <span>{t('pages.profile.paidAmount')}</span>
                <span>{t('pages.profile.orderActions')}</span>
              </div>
              {filteredOrders.length === 0 ? (
                <div data-profile-orders-filter-empty="true">
                  <PageEmpty
                    className="profile-empty-orders profile-empty-orders--filtered"
                    description={(
                      <div className="profile-empty-orders__copy">
                        <div>{t('pages.profile.noFilterOrders')}</div>
                        <div className="profile-empty-orders__hint">{t('pages.profile.noFilterOrdersHint')}</div>
                      </div>
                    )}
                    actions={[
                      {
                        key: 'clear-filter',
                        label: t('pages.profile.clearOrderFilter'),
                        onClick: () => setOrderStatusFilter('all'),
                        type: 'primary',
                      },
                      {
                        key: 'shop',
                        label: t('pages.profile.goShopping'),
                        onClick: () => navigate('/products'),
                        type: 'default',
                      },
                      {
                        key: 'coupons',
                        label: t('pages.profile.emptyOrdersCoupons'),
                        onClick: () => navigate('/coupons'),
                        type: 'default',
                      },
                      {
                        key: 'track',
                        label: t('pages.profile.authGateTrackOrder'),
                        onClick: () => navigate('/track-order'),
                        type: 'default',
                      },
                    ]}
                  />
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const items = orderItemsByOrderId[order.id] || [];
                  const itemPreviewFailed = Boolean(orderItemPreviewFailedByOrderId[order.id]);
                  const primaryItem = items[0];
                  const primaryItemName = primaryItem ? profileOrderItemName(primaryItem) : '';
                  const primaryItemActionLabel = primaryItem ? `${t('pages.productList.viewDetails')}: ${primaryItemName}` : '';
                  const actionHint = getOrderActionHint(order);
                  const orderLabel = profileOrderLabel(order);
                  const retryOrderItemsActionLabel = `${t('common.retry')}: ${t('pages.profile.orderItems')} ${orderLabel}`;
                  const detailActionLabel = `${t('pages.profile.detail')}: ${orderLabel}`;
                  const continuePayActionLabel = `${t('pages.profile.continuePay')}: ${orderLabel}`;
                  const confirmReceiptActionLabel = `${t('pages.profile.confirmReceipt')}: ${orderLabel}`;
                  const returnActionLabel = `${t('pages.profile.returnOrder')}: ${orderLabel}`;
                  const submitReturnShipmentActionLabel = `${t('pages.profile.submitReturnShipment')}: ${orderLabel}`;
                  const contactSupportActionLabel = `${t('pages.profile.contactSupport')}: ${orderLabel}`;
                  const trackShipmentActionLabel = order.trackingNumber
                    ? `${t('pages.orderTracking.trackShipment')}: ${orderLabel} / ${order.trackingNumber}`
                    : `${t('pages.orderTracking.trackShipment')}: ${orderLabel}`;
                  const cancelOrderActionLabel = `${t('pages.profile.cancelOrder')}: ${orderLabel}`;
                  return (
                    <div className="profile-order-card" key={order.id}>
                      <div className="profile-order-card__top">
                        <div className="profile-page__chipRow">
                          <span className="profile-page__text">{order.createdAt ? new Date(order.createdAt).toLocaleDateString(dateLocale) : '-'}</span>
                          <span className="profile-page__text profile-page__text--strong">{t('pages.profile.orderNo')}{order.orderNo || order.id}</span>
                          <ShopTag color={getOrderStatusColor(order.status)}>{formatOrderStatusLabel(order.status)}</ShopTag>
                          <button type="button" className="profile-order-card__link" aria-label={detailActionLabel} title={detailActionLabel} onClick={() => handleViewOrder(order)}>
                            {t('pages.profile.detail')}
                          </button>
                        </div>
                        <span className="profile-page__text profile-page__text--secondary">{order.trackingNumber ? t('pages.profile.trackingNo', { number: order.trackingNumber }) : ''}</span>
                      </div>
                      <div className="profile-order-card__body">
                        <div className="profile-order-card__items">
                          {primaryItem ? (
                            <div className="profile-order-item">
                              <button
                                type="button"
                                className="profile-order-item__imageButton"
                                aria-label={primaryItemActionLabel}
                                title={primaryItemActionLabel}
                                onClick={() => openProductDetail(primaryItem.productId)}
                              >
                                <img
                                  src={resolveOrderImage(primaryItem.imageUrl)}
                                  alt={primaryItemName}
                                  loading="lazy"
                                  decoding="async"
                                  onError={useImageFallback}
                                />
                              </button>
                              <div className="profile-order-item__main">
                                <button
                                  type="button"
                                  aria-label={primaryItemActionLabel}
                                  title={primaryItemActionLabel}
                                  onClick={() => openProductDetail(primaryItem.productId)}
                                >
                                  {primaryItemName}
                                </button>
                                <span className="profile-page__text profile-page__text--secondary profile-order-item__unit commerce-atomic commerce-price-quantity">
                                  <span className="commerce-money">{formatMoney(primaryItem.price)}</span>
                                  <span className="commerce-quantity">x {primaryItem.quantity}</span>
                                </span>
                                {primaryItem.selectedSpecs ? <span className="profile-page__text profile-page__text--secondary">{formatSelectedSpecs(primaryItem.selectedSpecs, t, language)}</span> : null}
                                {items.length > 1 ? <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.moreItems', { count: items.length - 1 })}</span> : null}
                                {order.shippingAddress ? <span className="profile-page__text profile-page__text--secondary">{order.shippingAddress}</span> : null}
                              </div>
                            </div>
                          ) : itemPreviewFailed ? (
                            <div className="profile-order-item__previewError">
                              <span className="profile-page__text profile-page__text--warning">{t('pages.profile.orderItemsPreviewFailed')}</span>
                              <ShopButton
                                type="link"
                                size="small"
                                icon={<ShopIcon path={SI.reload} />}
                                aria-label={retryOrderItemsActionLabel}
                                title={retryOrderItemsActionLabel}
                                onClick={() => fetchOrders()}
                              >
                                {t('common.retry')}
                              </ShopButton>
                            </div>
                          ) : (
                            <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.noOrderItems')}</span>
                          )}
                        </div>
                        <div className="profile-order-card__amount">
                          <span className="profile-page__text profile-page__text--secondary profile-order-card__mobileLabel">{t('pages.profile.goodsAmount')}</span>
                          <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(order.originalAmount || order.totalAmount)}</span>
                          {order.discountAmount && order.discountAmount > 0 ? <span className="profile-page__text profile-page__text--secondary profile-price-text commerce-money">-{formatMoney(order.discountAmount)}</span> : null}
                          <span className="profile-page__text profile-page__text--secondary profile-quantity-text commerce-quantity">x{items.reduce((sum, item) => sum + item.quantity, 0) || 1}</span>
                        </div>
                        <div className="profile-order-card__paid">
                          <span className="profile-page__text profile-page__text--secondary profile-order-card__mobileLabel">{t('pages.profile.paidAmount')}</span>
                          <span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(order.totalAmount)}</span>
                          <span className="profile-page__text profile-page__text--secondary profile-order-card__shippingIncluded commerce-atomic">
                            <span>{t('pages.profile.includesShipping', { amount: '' }).trim()}</span>
                            <span className="commerce-money">{formatMoney(order.shippingFee || 0)}</span>
                          </span>
                          <ShopTag>{t('pages.profile.onlineOrder')}</ShopTag>
                        </div>
                        <div className="profile-order-card__actions">
                          <div className={`profile-order-card__next profile-order-card__next--${actionHint.tone}`}>
                            <span className="profile-page__text profile-page__text--strong">{actionHint.title}</span>
                            <span className="profile-page__text profile-page__text--secondary">{actionHint.text}</span>
                          </div>
                          {order.status === 'PENDING_PAYMENT' && (
                            <ShopButton type="primary" aria-label={continuePayActionLabel} title={continuePayActionLabel} loading={payingOrderId === order.id} disabled={ordersStale || payingOrderId !== null} onClick={() => handleContinuePayment(order)}>
                              {t('pages.profile.continuePay')}
                            </ShopButton>
                          )}
                          {order.status === 'SHIPPED' && (
                            <ShopButton type="primary" aria-label={confirmReceiptActionLabel} title={confirmReceiptActionLabel} disabled={ordersStale} onClick={() => confirmReceiptOrder(order)}>{t('pages.profile.confirmReceipt')}</ShopButton>
                          )}
                          {isReturnableOrder(order) && (
                            <ShopButton danger aria-label={returnActionLabel} title={returnActionLabel} disabled={ordersStale} onClick={() => openReturnModal(order)}>{t('pages.profile.returnOrder')}</ShopButton>
                          )}
                          {order.status === 'RETURN_REQUESTED' && (
                            <ShopTag color="gold">{t('status.RETURN_REQUESTED')}</ShopTag>
                          )}
                          {order.status === 'RETURN_APPROVED' && (
                            <ShopButton type="link" aria-label={submitReturnShipmentActionLabel} title={submitReturnShipmentActionLabel} disabled={ordersStale} onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || ''); }}>
                              {t('pages.profile.submitReturnShipment')}
                            </ShopButton>
                          )}
                          {order.status === 'RETURN_SHIPPED' && (
                            <ShopTag color="cyan">{t('status.RETURN_SHIPPED')}</ShopTag>
                          )}
                          {(isReturnableOrder(order) || afterSaleStatuses.includes(order.status)) && (
                            <ShopButton type="link" aria-label={contactSupportActionLabel} title={contactSupportActionLabel} onClick={openSupport}>{t('pages.profile.contactSupport')}</ShopButton>
                          )}
                          <ShopButton type="link" aria-label={detailActionLabel} title={detailActionLabel} onClick={() => handleViewOrder(order)}>{t('pages.profile.detail')}</ShopButton>
                          {order.trackingNumber ? <ShopButton type="link" aria-label={trackShipmentActionLabel} title={trackShipmentActionLabel} onClick={() => handleTrackShipment(order.trackingNumber, order.trackingCarrierCode, order.id)}>{t('pages.orderTracking.trackShipment')}</ShopButton> : null}
                          {order.status === 'PENDING_PAYMENT' && (
                            <ShopPopconfirm
                              rootClassName='shop-mobile-popup-layer profile-popconfirm'
                              title={t('pages.profile.cancelOrderConfirm')}
                              disabled={ordersStale}
                              onConfirm={() => handleCancelOrder(order.id)}
                              okText={t('common.confirm')}
                              cancelText={t('common.cancel')}
                              okButtonProps={{ danger: true, 'aria-label': cancelOrderActionLabel, title: cancelOrderActionLabel }}
                              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${cancelOrderActionLabel}`, title: `${t('common.cancel')}: ${cancelOrderActionLabel}` }}
                            >
                              <ShopButton type="link" danger aria-label={cancelOrderActionLabel} title={cancelOrderActionLabel} disabled={ordersStale}>{t('pages.profile.cancelOrder')}</ShopButton>
                            </ShopPopconfirm>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
  </>
);

export default ProfileOrdersPanel;

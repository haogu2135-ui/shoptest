import React from 'react';
import type { OrderCustomer, PaymentCustomer } from '../types';
import ShopAlert from '../components/ShopAlert';
import ShopButton from '../components/ShopButton';
import ShopModal from '../components/ShopModal';
import ShopSelect from '../components/ShopSelect';
import ShopTag from '../components/ShopTag';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { dispatchDomEvent } from '../utils/domEvents';
import { paymentMethodLabel, type PaymentMethodDetail, type PaymentMethodOption } from '../utils/paymentMethods';
import { navigateToCommercialPaymentUrl, formatPaymentUrlLabel, getPaymentRecoveryState } from '../utils/paymentRecovery';
import { normalizeStatusCode } from '../utils/profileHelpers';


type ProfilePaymentModalProps = {
  closePaymentActionLabel: string;
  dateLocale: string;
  formatMoney: (amount?: number | null) => string;
  formatPaymentStatusLabel: (status?: string) => string;
  getPaymentStatusColor: (status?: string) => string;
  handleRefreshPayment: () => void | Promise<void>;
  loadPaymentChannels: (isActive?: () => boolean) => void | Promise<void>;
  navigate: (path: string) => void;
  openPaymentActionLabel: string;
  orderPayments: PaymentCustomer[];
  paymentChannelsError: string;
  paymentChannelsLoading: boolean;
  paymentLinkActionLabel: string;
  paymentMethodSelectLabel: string;
  paymentModalVisible: boolean;
  paymentOptions: PaymentMethodOption[];
  refreshPaymentActionLabel: string;
  refreshingPayment: boolean;
  retryPaymentChannelsActionLabel: string;
  selectedOrder: OrderCustomer | null;
  selectedPayment: PaymentCustomer | null;
  selectedPaymentExpiredOrFailed: boolean;
  selectedPaymentFailed: boolean;
  selectedPaymentMethod: string;
  selectedPaymentMethodDetail?: PaymentMethodDetail;
  selectedPaymentPaid: boolean;
  selectedPaymentReconcileRequired: boolean;
  selectedPaymentRecovery: ReturnType<typeof getPaymentRecoveryState>;
  setPaymentModalVisible: (visible: boolean) => void;
  setSelectedPaymentMethod: (channel: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Commercial profile continue-payment modal:
 * recovery status, channel retry, payment link, and history multipath.
 */
export const ProfilePaymentModal: React.FC<ProfilePaymentModalProps> = ({
  closePaymentActionLabel,
  dateLocale,
  formatMoney,
  formatPaymentStatusLabel,
  getPaymentStatusColor,
  handleRefreshPayment,
  loadPaymentChannels,
  navigate,
  openPaymentActionLabel,
  orderPayments,
  paymentChannelsError,
  paymentChannelsLoading,
  paymentLinkActionLabel,
  paymentMethodSelectLabel,
  paymentModalVisible,
  paymentOptions,
  refreshPaymentActionLabel,
  refreshingPayment,
  retryPaymentChannelsActionLabel,
  selectedOrder,
  selectedPayment,
  selectedPaymentExpiredOrFailed,
  selectedPaymentFailed,
  selectedPaymentMethod,
  selectedPaymentMethodDetail,
  selectedPaymentPaid,
  selectedPaymentReconcileRequired,
  selectedPaymentRecovery,
  setPaymentModalVisible,
  setSelectedPaymentMethod,
  t,
}) => (
<ShopModal
        title={t('pages.profile.continuePay')}
        open={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        className="profile-mobile-safe-modal profile-payment-modal"
        footer={[
          selectedPayment?.status === 'PENDING' && selectedPayment.paymentUrl && (
            <ShopButton
              key="pay"
              type="primary"
              aria-label={openPaymentActionLabel}
              title={openPaymentActionLabel}
              onClick={() => {
                if (!navigateToCommercialPaymentUrl(selectedPayment.paymentUrl)) {
                  announceAccessibleMessage(t('pages.payment.failed'), 'error');
                }
              }}
            >
              {t('pages.checkout.openPayment')}
            </ShopButton>
          ),
          selectedPayment && !selectedPaymentPaid && !selectedPaymentReconcileRequired && (
            <ShopButton key="refresh" loading={refreshingPayment} disabled={paymentChannelsLoading || paymentOptions.length === 0} aria-label={refreshPaymentActionLabel} title={refreshPaymentActionLabel} onClick={handleRefreshPayment}>
              {t('pages.profile.refreshPayment')}
            </ShopButton>
          ),
          <ShopButton key="close" aria-label={closePaymentActionLabel} title={closePaymentActionLabel} onClick={() => setPaymentModalVisible(false)}>{t('common.cancel')}</ShopButton>,
        ].filter(Boolean)}
      >
        {selectedOrder && selectedPayment && (
          <div className="profile-payment-modal__content">
            <div className="profile-payment-recovery" role="status" aria-live="polite">
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryStatus')}</span>
                <ShopTag color={selectedPaymentReconcileRequired ? 'magenta' : selectedPaymentPaid ? 'green' : selectedPaymentExpiredOrFailed ? 'red' : selectedPaymentRecovery.isExpiringSoon ? 'orange' : 'blue'}>
                  {selectedPaymentReconcileRequired
                    ? t('pages.checkout.paymentRecoveryReconcileRequired')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                    ? t('status.REFUNDED')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDING'
                    ? t('status.REFUNDING')
                    : selectedPaymentPaid
                    ? t('pages.checkout.paymentRecoveryPaid')
                    : selectedPaymentFailed
                      ? t('pages.checkout.paymentRecoveryFailed')
                      : selectedPaymentRecovery.isExpired
                        ? t('pages.checkout.paymentRecoveryExpired')
                        : t('pages.checkout.paymentRecoveryPending')}
                </ShopTag>
              </div>
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryWindow')}</span>
                <span className={`profile-page__text ${selectedPaymentRecovery.isExpired ? 'danger' : selectedPaymentRecovery.isExpiringSoon ? 'profile-page__text--warning' : 'profile-page__text--secondary'}`}>
                  {selectedPaymentRecovery.minutesLeft === null
                    ? t('pages.checkout.paymentRecoveryWindowUnknown')
                    : selectedPaymentRecovery.isExpired
                      ? t('pages.checkout.paymentRecoveryWindowExpired')
                      : t('pages.checkout.paymentRecoveryWindowMinutes', { count: selectedPaymentRecovery.minutesLeft })}
                </span>
              </div>
              <div>
                <span className="profile-page__text profile-page__text--strong">{t('pages.checkout.paymentRecoveryNext')}</span>
                <span className="profile-page__text profile-page__text--secondary">
                  {selectedPaymentReconcileRequired
                    ? t('pages.checkout.paymentRecoveryNextReconcileRequired')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                    ? t('pages.profile.paymentRefundedNext')
                    : normalizeStatusCode(selectedPayment.status) === 'REFUNDING'
                    ? t('pages.profile.paymentRefundingNext')
                    : selectedPaymentPaid
                    ? t('pages.checkout.paymentRecoveryNextPaid')
                    : selectedPaymentFailed
                      ? t('pages.checkout.paymentRecoveryNextFailed')
                      : selectedPaymentRecovery.isExpired
                        ? t('pages.checkout.paymentRecoveryNextRetry')
                        : selectedPayment.paymentUrl
                          ? t('pages.checkout.paymentRecoveryNextOpen')
                          : t('pages.checkout.paymentRecoveryNextRetry')}
                </span>
              </div>
            </div>
            <dl className="profile-page__descList profile-payment-detail__descriptions">
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.orderNo')}</dt>
                <dd className="profile-page__descValue">{selectedOrder.orderNo || selectedOrder.id}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('common.amount')}</dt>
                <dd className="profile-page__descValue"><span className="profile-page__text profile-page__text--strong profile-price-text commerce-money">{formatMoney(selectedOrder.totalAmount)}</span></dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.paymentMethod')}</dt>
                <dd className="profile-page__descValue"><ShopSelect
                  className="profile-payment-modal__methodSelect"
                  value={selectedPaymentMethod}
                  options={paymentOptions}
                  onChange={(value) => setSelectedPaymentMethod(value || '')}
                  popupClassName="shop-mobile-popup-layer"
                  popupZIndex={12050}
                  disabled={selectedPaymentPaid || selectedPaymentReconcileRequired || paymentChannelsLoading || paymentOptions.length === 0}
                  ariaLabel={paymentMethodSelectLabel}
                  title={paymentMethodSelectLabel}
                />
                {paymentOptions.length === 0 ? (
                  <ShopAlert
                    type="warning"
                    showIcon
                    role="alert"
                    aria-live="assertive"
                    message={t('pages.checkout.paymentUnavailable')}
                    description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
                    action={(
                      <ShopButton
                        size="small"
                        loading={paymentChannelsLoading}
                        aria-label={retryPaymentChannelsActionLabel}
                        title={retryPaymentChannelsActionLabel}
                        onClick={() => void loadPaymentChannels()}
                      >
                        {t('common.retry')}
                      </ShopButton>
                    )}
                  />
                ) : null}
                {selectedPaymentMethodDetail ? (
                  <div className="profile-payment-method-hint">
                    <ShopTag color={selectedPaymentMethodDetail.value === 'OXXO' ? 'orange' : selectedPaymentMethodDetail.value === 'SPEI' ? 'blue' : 'green'}>
                      {t(selectedPaymentMethodDetail.badgeKey)}
                    </ShopTag>
                    <span className="profile-page__text profile-page__text--secondary">{t(selectedPaymentMethodDetail.descriptionKey)}</span>
                  </div>
                ) : null}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('common.status')}</dt>
                <dd className="profile-page__descValue"><ShopTag color={getPaymentStatusColor(selectedPayment.status)}>
                  {formatPaymentStatusLabel(selectedPayment.status)}
                </ShopTag></dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.paymentLink')}</dt>
                <dd className="profile-page__descValue">{selectedPayment.paymentUrl && !selectedPaymentPaid && !selectedPaymentReconcileRequired && !selectedPaymentExpiredOrFailed ? (
                  <ShopButton
                    type="link"
                    className="profile-payment-link"
                    aria-label={paymentLinkActionLabel}
                    title={paymentLinkActionLabel}
                    onClick={() => {
                      if (!navigateToCommercialPaymentUrl(selectedPayment.paymentUrl)) {
                        announceAccessibleMessage(t('pages.payment.failed'), 'error');
                      }
                    }}
                  >
                    {formatPaymentUrlLabel(selectedPayment.paymentUrl)}
                  </ShopButton>
                ) : selectedPaymentReconcileRequired ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextReconcileRequired')}</span>
                ) : selectedPaymentFailed ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextFailed')}</span>
                ) : selectedPaymentRecovery.isExpired ? (
                  <span className="profile-page__text profile-page__text--secondary">{t('pages.checkout.paymentRecoveryNextRetry')}</span>
                ) : '-'}</dd>
              </div>
              <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.paymentExpiresAt')}</dt>
                <dd className="profile-page__descValue">{selectedPayment.expiresAt ? new Date(selectedPayment.expiresAt).toLocaleString(dateLocale) : '-'}</dd>
              </div>
              {selectedPayment.paidAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.paidAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedPayment.paidAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedPayment.refundedAt ? (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.profile.refundedAt')}</dt>
                <dd className="profile-page__descValue">{new Date(selectedPayment.refundedAt).toLocaleString(dateLocale)}</dd>
              </div>
              ) : null}
              {selectedPayment.transactionId && (
                <div className="profile-page__descRow">
                <dt className="profile-page__descLabel">{t('pages.checkout.transactionId')}</dt>
                <dd className="profile-page__descValue">{selectedPayment.transactionId}</dd>
              </div>
              )}
            </dl>
            {normalizeStatusCode(selectedPayment.status) === 'REFUNDED' || normalizeStatusCode(selectedPayment.status) === 'REFUNDING' ? (
              <ShopAlert
                type={normalizeStatusCode(selectedPayment.status) === 'REFUNDED' ? 'success' : 'info'}
                showIcon
                className="profile-payment-refund-audit"
                message={normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                  ? t('pages.profile.paymentRefundedTitle')
                  : t('pages.profile.paymentRefundingTitle')}
                description={normalizeStatusCode(selectedPayment.status) === 'REFUNDED'
                  ? t('pages.profile.paymentRefundedText', {
                    date: selectedPayment.refundedAt
                      ? new Date(selectedPayment.refundedAt).toLocaleString(dateLocale)
                      : t('common.unknown'),
                  })
                  : t('pages.profile.paymentRefundingText')}
              />
            ) : null}
            <div>
              <span className="profile-page__text profile-page__text--strong">{t('pages.profile.paymentHistory')}</span>
              {(!orderPayments || orderPayments.length === 0) ? (
                    <div className="profile-payment-history__empty" data-profile-payment-history-empty="true">
                      <div className="profile-payment-history__emptyCopy">
                        <div>{t('pages.profile.noPaymentHistory')}</div>
                        <div className="profile-payment-history__emptyHint">{t('pages.profile.noPaymentHistoryHint')}</div>
                      </div>
                      <div className="profile-payment-history__emptyActions" data-profile-payment-history-empty-actions="true">
                        <ShopButton
                          type="primary"
                          aria-label={t('pages.profile.authGateTrackOrder')}
                          title={t('pages.profile.authGateTrackOrder')}
                          onClick={() => navigate('/track-order')}
                        >
                          {t('pages.profile.authGateTrackOrder')}
                        </ShopButton>
                        <ShopButton
                          aria-label={t('pages.profile.goShopping')}
                          title={t('pages.profile.goShopping')}
                          onClick={() => navigate('/products')}
                        >
                          {t('pages.profile.goShopping')}
                        </ShopButton>
                        <ShopButton
                          aria-label={t('pages.profile.emptyOrdersCoupons')}
                          title={t('pages.profile.emptyOrdersCoupons')}
                          onClick={() => navigate('/coupons')}
                        >
                          {t('pages.profile.emptyOrdersCoupons')}
                        </ShopButton>
                        <ShopButton
                          aria-label={t('pages.productList.loadRecoverySupport')}
                          title={t('pages.productList.loadRecoverySupport')}
                          onClick={() => dispatchDomEvent('shop:open-support')}
                        >
                          {t('pages.productList.loadRecoverySupport')}
                        </ShopButton>
                      </div>
                    </div>
              ) : (
              <ul className="profile-page__itemList profile-payment-history__itemList" role="list">
                {orderPayments.map((payment, index) => (
                  <li key={String(payment.id || `${payment.channel || 'pay'}-${index}`)} className="profile-page__item">
                    <div className="profile-payment-history__item">
                      <div className="profile-page__chipRow">
                        <ShopTag color={getPaymentStatusColor(payment.status)}>
                          {formatPaymentStatusLabel(payment.status)}
                        </ShopTag>
                        <span className="profile-page__text">{paymentMethodLabel(payment.channel, t)}</span>
                        {payment.amount ? <span className="profile-page__text profile-page__text--secondary commerce-money">{formatMoney(payment.amount)}</span> : null}
                      </div>
                      <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleString(dateLocale) : ''}
                      </span>
                      {payment.paidAt ? (
                        <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                          {t('pages.profile.paidAt')}: {new Date(payment.paidAt).toLocaleString(dateLocale)}
                        </span>
                      ) : null}
                      {payment.refundedAt ? (
                        <span className="profile-page__text profile-page__text--secondary profile-payment-history__time">
                          {t('pages.profile.refundedAt')}: {new Date(payment.refundedAt).toLocaleString(dateLocale)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </div>
          </div>
        )}
      </ShopModal>
);

export default ProfilePaymentModal;

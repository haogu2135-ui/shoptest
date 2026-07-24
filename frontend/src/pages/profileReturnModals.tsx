import React from 'react';
import type { OrderCustomer } from '../types';
import ShopButton from '../components/ShopButton';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopModal from '../components/ShopModal';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
  RETURN_REASON_PRESET_KEYS,
  returnReasonPresetI18nKey,
  returnFlowStepI18nKeys,
} from '../utils/returnFlow';

type ProfileReturnModalsProps = {
  dateLocale: string;
  formatMoney: (amount?: number | null) => string;
  handleReturnOrder: () => void | Promise<void>;
  handleSubmitReturnShipment: () => void | Promise<void>;
  requestingReturn: boolean;
  returnReason: string;
  returnReasonInputLabel: string;
  returnRequestOrder: OrderCustomer | null;
  returnShipmentOrder: OrderCustomer | null;
  returnTrackingInputLabel: string;
  returnTrackingNumber: string;
  selectedTrackingCarrierCode?: string;
  selectedTrackingNumber?: string;
  selectedTrackingOrderId?: number;
  setReturnReason: (value: string) => void;
  setReturnRequestOrder: (order: OrderCustomer | null) => void;
  setReturnShipmentOrder: (order: OrderCustomer | null) => void;
  setReturnTrackingNumber: (value: string | ((prev: string) => string)) => void;
  setTrackingVisible: (visible: boolean) => void;
  submitReturnRequestActionLabel: string;
  submitReturnShipmentActionLabel: string;
  submittingReturnShipment: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  trackingVisible: boolean;
};

/**
 * Commercial profile return + tracking modals:
 * return shipment, return request, and logistics tracking widget.
 */
export const ProfileReturnModals: React.FC<ProfileReturnModalsProps> = ({
  dateLocale,
  formatMoney,
  handleReturnOrder,
  handleSubmitReturnShipment,
  requestingReturn,
  returnReason,
  returnReasonInputLabel,
  returnRequestOrder,
  returnShipmentOrder,
  returnTrackingInputLabel,
  returnTrackingNumber,
  selectedTrackingCarrierCode,
  selectedTrackingNumber,
  selectedTrackingOrderId,
  setReturnReason,
  setReturnRequestOrder,
  setReturnShipmentOrder,
  setReturnTrackingNumber,
  setTrackingVisible,
  submitReturnRequestActionLabel,
  submitReturnShipmentActionLabel,
  submittingReturnShipment,
  t,
  trackingVisible,
}) => (
  <>
      <ShopModal
        title={t('pages.profile.submitReturnShipment')}
        open={!!returnShipmentOrder}
        confirmLoading={submittingReturnShipment}
        okText={t('pages.profile.submitReturnShipment')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': submitReturnShipmentActionLabel,
          title: submitReturnShipmentActionLabel,
          disabled: !isReturnTrackingReady(returnTrackingNumber),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${submitReturnShipmentActionLabel}`, title: `${t('common.cancel')}: ${submitReturnShipmentActionLabel}` }}
        onOk={handleSubmitReturnShipment}
        onClose={() => { setReturnShipmentOrder(null); setReturnTrackingNumber(''); }}
        className="profile-mobile-safe-modal profile-return-modal"
      >
        <div className="profile-return-modal__content">
          {returnShipmentOrder ? (
            <div className="profile-return-modal__summary">
              <span className="profile-page__text profile-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: returnShipmentOrder.orderNo || returnShipmentOrder.id,
                  amount: formatMoney(returnShipmentOrder.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnShipmentStepsTitle')}>
            <span className="profile-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnShipmentStepsTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.returnShipmentHint')}</span>
          <ShopInput
            value={returnTrackingNumber}
            onChange={(e) => setReturnTrackingNumber(e.target.value)}
            placeholder={t('pages.profile.returnTrackingPlaceholder')}
            autoComplete="off"
            inputMode="text"
            maxLength={120}
            status={returnTrackingNumber && !isReturnTrackingReady(returnTrackingNumber) ? 'error' : ''}
            aria-label={returnTrackingInputLabel}
            title={returnTrackingInputLabel}
            onBlur={() => setReturnTrackingNumber((value) => normalizeReturnTrackingNumber(value))}
          />
        </div>
      </ShopModal>

      <ShopModal
        title={t('pages.profile.returnOrder')}
        open={!!returnRequestOrder}
        confirmLoading={requestingReturn}
        okText={t('pages.profile.returnOrder')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': submitReturnRequestActionLabel,
          title: submitReturnRequestActionLabel,
          disabled: !isReturnReasonReady(returnReason),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${submitReturnRequestActionLabel}`, title: `${t('common.cancel')}: ${submitReturnRequestActionLabel}` }}
        onOk={handleReturnOrder}
        onClose={() => { setReturnRequestOrder(null); setReturnReason(''); }}
        className="profile-mobile-safe-modal profile-return-modal"
      >
        <div className="profile-return-modal__content">
          {returnRequestOrder ? (
            <div className="profile-return-modal__summary" aria-label={t('pages.profile.returnOrderSummary', {
              orderNo: returnRequestOrder.orderNo || returnRequestOrder.id,
              amount: formatMoney(returnRequestOrder.totalAmount),
            })}>
              <span className="profile-page__text profile-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: returnRequestOrder.orderNo || returnRequestOrder.id,
                  amount: formatMoney(returnRequestOrder.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnTimelineTitle')}>
            <span className="profile-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnTimelineTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.returnReviewHint')}</span>
          {returnRequestOrder?.returnDeadline ? (
            <span className="profile-page__text profile-page__text--secondary">
              {t('pages.profile.returnAvailableUntil', { time: new Date(returnRequestOrder.returnDeadline).toLocaleString(dateLocale) })}
            </span>
          ) : null}
          <div className="profile-return-modal__presets" role="group" aria-label={t('pages.profile.returnReasonPresetsLabel')}>
            <span className="profile-page__text profile-return-modal__presetsLabel">{t('pages.profile.returnReasonPresetsLabel')}</span>
            <div className="profile-return-modal__presetGrid">
              {RETURN_REASON_PRESET_KEYS.map((preset) => {
                const label = t(returnReasonPresetI18nKey(preset));
                const selected = normalizeReturnReason(returnReason).toLowerCase() === label.toLowerCase();
                return (
                  <ShopButton
                    key={preset}
                    size="small"
                    type={selected ? 'primary' : 'default'}
                    className="profile-return-modal__preset"
                    aria-label={label}
                    title={label}
                    aria-pressed={selected}
                    onClick={() => setReturnReason(label)}
                  >
                    {label}
                  </ShopButton>
                );
              })}
            </div>
          </div>
          <ShopTextArea
            rows={4}
            maxLength={500}
            showCount
            value={returnReason}
            status={returnReason && !isReturnReasonReady(returnReason) ? 'error' : ''}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder={t('pages.profile.returnReasonPlaceholder')}
            aria-label={returnReasonInputLabel}
            title={returnReasonInputLabel}
          />
        </div>
      </ShopModal>

      <ShopModal
        title={t('pages.adminOrders.logisticsTracking')}
        open={trackingVisible}
        onClose={() => setTrackingVisible(false)}
        footer={null}
        width={720}
        className="profile-mobile-safe-modal profile-tracking-modal"
      >
        <SeventeenTrackWidget trackingNumber={selectedTrackingNumber} carrierCode={selectedTrackingCarrierCode} orderId={selectedTrackingOrderId} />
      </ShopModal>

  </>
);

export default ProfileReturnModals;

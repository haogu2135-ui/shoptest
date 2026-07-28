import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { FormInstance } from 'antd';
import { Form } from 'antd';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopModal from '../components/ShopModal';
import ShopConfirm from '../components/ShopConfirm';
import PageEmpty from '../components/PageEmpty';
import PageError from '../components/PageError';
import type { OrderCustomer, OrderItemCustomer } from '../types';
import { formatSelectedSpecs } from '../utils/selectedSpecs';
import { paymentMethodLabel } from '../utils/paymentMethods';
import {
  isReturnReasonReady,
  isReturnTrackingReady,
  normalizeReturnReason,
  normalizeReturnTrackingNumber,
  RETURN_REASON_PRESET_KEYS,
  returnReasonPresetI18nKey,
  returnFlowStepI18nKeys,
} from '../utils/returnFlow';
import { dispatchDomEvent } from '../utils/domEvents';
import { focusFirstFormError } from '../utils/formValidationFocus';
import SeventeenTrackWidget from '../components/SeventeenTrackWidget';
import ShopButton from '../components/ShopButton';
import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import {
  orderTrackingImageFallback,
  resolveOrderTrackingImage,
} from './orderTrackingHelpers';

export type OrderTrackingTranslate = (key: string, params?: Record<string, string | number>) => string;

export type OrderTrackingPanelsProps = {
t: OrderTrackingTranslate;
  language: string;
  navigate: NavigateFunction;
  form: FormInstance;
  formatMoney: (value?: number | null) => string;
  formatOrderStatusLabel: (status?: string) => string;
  getOrderStatusColor: (status?: string) => string;
  orderTrackingItemName: (item: OrderItemCustomer) => string;
  loading: boolean;
  paying: boolean;
  canceling: boolean;
  confirmingReceipt: boolean;
  returning: boolean;
  returnShipping: boolean;
  order: OrderCustomer | null;
  items: OrderItemCustomer[];
  lookupError: string;
  detailsRestricted: boolean;
  canShowFullTrackingDetails: boolean;
  canOperateTrackedOrder: boolean;
  canUseGuestActions: boolean;
  canUseSignedInActions: boolean;
  trackedEmail: string;
  trackingStep: number;
  nextAction: { title: string; text: string; tone: string } | null;
  assurancePlan: {
    itemCount: number;
    title: string;
    text: string;
    primaryLabel: string;
    primaryAction: () => void;
  } | null;
  paymentReturnStatus: string;
  paymentReturnEmailGateVisible: boolean;
  paymentReturnEmailInputRef: React.Ref<HTMLInputElement>;
  prefillNoticeVisible: boolean;
  setPrefillNoticeVisible: React.Dispatch<React.SetStateAction<boolean>>;
  dateLocale: string;
  trackActionLabel: (action: string) => string;
  trackedOrderLabel: string;
  returnRequestOpen: boolean;
  setReturnRequestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  returnShipmentOpen: boolean;
  setReturnShipmentOpen: React.Dispatch<React.SetStateAction<boolean>>;
  returnReason: string;
  setReturnReason: React.Dispatch<React.SetStateAction<string>>;
  returnTrackingNumber: string;
  setReturnTrackingNumber: React.Dispatch<React.SetStateAction<string>>;
  returnReasonInputLabel: string;
  returnTrackingInputLabel: string;
  returnRequestActionLabel: string;
  returnShipmentActionLabel: string;
  rollbackConfirmOpen: boolean;
  setRollbackConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  receiptConfirmOpen: boolean;
  setReceiptConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onFinish: (values: { orderNo: string; email: string }) => void;
  continuePayment: () => void;
  cancelPendingPayment: () => void;
  handleRollbackConfirm: () => void;
  confirmReceipt: () => void;
  confirmReceiptWithReview: () => void;
  submitReturnRequest: () => void;
  submitReturnTracking: () => void;
  restoreTrackedItemsToCart: () => void;
  signInForOrder: () => void;
  supportOpen: () => void;
};

/** Lookup form, payment-return recovery, journey, summary, items, logistics. */
export const OrderTrackingMainPanels: React.FC<OrderTrackingPanelsProps> = ({
  t,
  language,
  navigate,
  form,
  formatMoney,
  formatOrderStatusLabel,
  getOrderStatusColor,
  orderTrackingItemName,
  loading,
  paying,
  canceling,
  confirmingReceipt,
  returning,
  returnShipping,
  order,
  items,
  lookupError,
  detailsRestricted,
  canShowFullTrackingDetails,
  canOperateTrackedOrder,
  canUseGuestActions,
  canUseSignedInActions,
  trackedEmail,
  trackingStep,
  nextAction,
  assurancePlan,
  paymentReturnStatus,
  paymentReturnEmailGateVisible,
  paymentReturnEmailInputRef,
  prefillNoticeVisible,
  setPrefillNoticeVisible,
  dateLocale,
  trackActionLabel,
  trackedOrderLabel,
  returnRequestOpen,
  setReturnRequestOpen,
  returnShipmentOpen,
  setReturnShipmentOpen,
  returnReason,
  setReturnReason,
  returnTrackingNumber,
  setReturnTrackingNumber,
  returnReasonInputLabel,
  returnTrackingInputLabel,
  returnRequestActionLabel,
  returnShipmentActionLabel,
  rollbackConfirmOpen,
  setRollbackConfirmOpen,
  receiptConfirmOpen,
  setReceiptConfirmOpen,
  onFinish,
  continuePayment,
  cancelPendingPayment,
  handleRollbackConfirm,
  confirmReceipt,
  confirmReceiptWithReview,
  submitReturnRequest,
  submitReturnTracking,
  restoreTrackedItemsToCart,
  signInForOrder,
  supportOpen
}) => (
  <>
      <h1 className="order-tracking-page__title">{t('pages.orderTracking.title')}</h1>
      {paymentReturnStatus === 'success' ? (
        <ShopAlert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="success"
          type={order && order.status === 'PENDING_PAYMENT' ? 'info' : 'success'}
          showIcon
          role="alert"
          aria-live="assertive"
          message={order && order.status === 'PENDING_PAYMENT'
            ? t('pages.profile.paymentReturnPending')
            : t('pages.checkout.paidTitle')}
          description={order && order.status === 'PENDING_PAYMENT'
            ? t('pages.profile.paymentReturnPending')
            : t('pages.checkout.paymentRecoveryNextPaid')}
        />
      ) : paymentReturnStatus === 'cancelled' || paymentReturnStatus === 'canceled' ? (
        <ShopAlert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="cancelled"
          type="warning"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.checkout.paymentRecoveryPending')}
          description={order
            ? t('pages.checkout.paymentRecoveryNextRetry')
            : t('pages.orderTracking.paymentReturnLookupHint')}
          action={(
            <div className="order-tracking-page__paymentReturnActions" data-order-tracking-payment-return-recovery="true">
              {order && order.status === 'PENDING_PAYMENT' && canOperateTrackedOrder ? (
                <ShopButton
                  size="small"
                  type="primary"
                  icon={<ShopIcon path={SI.creditCard} />}
                  loading={paying}
                  aria-label={trackActionLabel(t('pages.profile.continuePay'))}
                  title={trackActionLabel(t('pages.profile.continuePay'))}
                  onClick={continuePayment}
                >
                  {t('pages.profile.continuePay')}
                </ShopButton>
              ) : null}
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                onClick={() => navigate('/products')}
              >
                {t('pages.orderTracking.shopAgain')}
              </ShopButton>
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.gift} />}
                aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                onClick={() => navigate('/coupons')}
              >
                {t('pages.orderTracking.emptyCoupons')}
              </ShopButton>
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.support} />}
                aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                title={trackActionLabel(t('pages.profile.contactSupport'))}
                onClick={supportOpen}
              >
                {t('pages.profile.contactSupport')}
              </ShopButton>
            </div>
          )}
        />
      ) : paymentReturnStatus === 'failed' ? (
        <ShopAlert
          className="order-tracking-page__paymentReturn"
          data-order-tracking-payment-return="failed"
          type="error"
          showIcon
          role="alert"
          aria-live="assertive"
          message={t('pages.orderTracking.paymentFailedTitle')}
          description={order
            ? t('pages.orderTracking.paymentFailedText')
            : t('pages.orderTracking.paymentReturnLookupHint')}
          action={(
            <div className="order-tracking-page__paymentReturnActions" data-order-tracking-payment-return-recovery="true">
              {order && order.status === 'PENDING_PAYMENT' && canOperateTrackedOrder ? (
                <ShopButton
                  size="small"
                  type="primary"
                  icon={<ShopIcon path={SI.creditCard} />}
                  loading={paying}
                  aria-label={trackActionLabel(t('pages.profile.continuePay'))}
                  title={trackActionLabel(t('pages.profile.continuePay'))}
                  onClick={continuePayment}
                >
                  {t('pages.profile.continuePay')}
                </ShopButton>
              ) : null}
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.shopping} />}
                aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                onClick={() => navigate('/products')}
              >
                {t('pages.orderTracking.shopAgain')}
              </ShopButton>
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.gift} />}
                aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                onClick={() => navigate('/coupons')}
              >
                {t('pages.orderTracking.emptyCoupons')}
              </ShopButton>
              <ShopButton
                size="small"
                icon={<ShopIcon path={SI.support} />}
                aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                title={trackActionLabel(t('pages.profile.contactSupport'))}
                onClick={supportOpen}
              >
                {t('pages.profile.contactSupport')}
              </ShopButton>
            </div>
          )}
        />
      ) : null}
      <section className="order-tracking-page__lookupCard" aria-label={t('pages.orderTracking.title')}>
        <div className="order-tracking-page__lookupHeader">
          <span className="order-tracking-page__lookupIcon"><ShopIcon path={SI.search} /></span>
          <span>
            <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.title')}</span>
            <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.orderTracking.empty')}</span>
          </span>
        </div>
        {paymentReturnEmailGateVisible ? (
          <ShopAlert
            className="order-tracking-page__paymentReturnEmailGate"
            data-order-tracking-payment-return-email-gate="true"
            type="info"
            showIcon
            role="status"
            message={t('pages.orderTracking.paymentReturnEmailRequiredTitle')}
            description={t('pages.orderTracking.paymentReturnEmailRequiredText')}
          />
        ) : null}
        {prefillNoticeVisible ? (
          <ShopAlert
            className="order-tracking-page__prefillNotice"
            type="info"
            showIcon
            message={t('pages.orderTracking.prefillNotice')}
          />
        ) : null}
        <Form
          form={form}
          className="order-tracking-page__lookupForm"
          layout="vertical"
          requiredMark
          validateTrigger={['onChange', 'onBlur']}
          onFinish={onFinish}
          onFinishFailed={() => {
            focusFirstFormError({ rootSelector: '.order-tracking-page__lookupCard' });
          }}
          onValuesChange={() => setPrefillNoticeVisible(false)}
        >
          <Form.Item name="orderNo" label={t('pages.orderTracking.orderNo')} rules={[{ required: true, message: t('pages.orderTracking.orderNoRequired') }]}>
            <ShopInput
              placeholder={t('pages.orderTracking.orderNoPlaceholder')}
              autoComplete="on"
              inputMode="text"
              enterKeyHint="search"
              maxLength={80}
              aria-label={t('pages.orderTracking.orderNo')}
              title={t('pages.orderTracking.orderNo')}
            />
          </Form.Item>
          <Form.Item name="email" label={t('pages.orderTracking.email')} rules={[{ required: true, message: t('pages.orderTracking.emailRequired') }, { type: 'email', message: t('pages.auth.emailInvalid') }]}>
            <ShopInput
              ref={paymentReturnEmailInputRef}
              className={paymentReturnEmailGateVisible ? 'order-tracking-page__emailInput--gate' : undefined}
              placeholder={t('pages.orderTracking.emailPlaceholder')}
              autoComplete="email"
              inputMode="email"
              maxLength={120}
              aria-label={t('pages.orderTracking.email')}
              title={t('pages.orderTracking.email')}
            />
          </Form.Item>
          <ShopButton className="order-tracking-page__lookupButton" type="primary" htmlType="submit" loading={loading} icon={<ShopIcon path={SI.search} />} block>
            {t('pages.orderTracking.search')}
          </ShopButton>
        </Form>
      </section>

      {!order ? (
        <section className="order-tracking-page__emptyState">
          {lookupError ? (
            <div data-order-tracking-lookup-recovery="true">
              <PageError
                className="order-tracking-page__lookupErrorState"
                title={lookupError}
                description={t('pages.orderTracking.empty')}
                actions={[
                  {
                    key: 'retry',
                    label: t('pages.orderTracking.search'),
                    onClick: () => { void form.submit(); },
                    type: 'primary',
                  },
                  {
                    key: 'shop',
                    label: t('pages.orderTracking.shopAgain'),
                    onClick: () => navigate('/products'),
                    type: 'default',
                  },
                  {
                    key: 'coupons',
                    label: t('pages.orderTracking.emptyCoupons'),
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
          ) : (
            <PageEmpty
              className="order-tracking-page__emptyPanel"
              description={(
                <div className="order-tracking-page__emptyCopy">
                  <div>{t('pages.orderTracking.empty')}</div>
                  <div className="order-tracking-page__emptyHint">{t('pages.orderTracking.emptyHint')}</div>
                </div>
              )}
              actions={[
                {
                  key: 'shop',
                  label: t('pages.orderTracking.shopAgain'),
                  onClick: () => navigate('/products'),
                },
                {
                  key: 'coupons',
                  label: t('pages.orderTracking.emptyCoupons'),
                  onClick: () => navigate('/coupons'),
                  type: 'default',
                },
                {
                  key: 'orders',
                  label: t('pages.orderTracking.emptyProfileOrders'),
                  onClick: () => navigate('/profile?tab=orders'),
                  type: 'default',
                },
                {
                  key: 'support',
                  label: t('pages.profile.contactSupport'),
                  onClick: supportOpen,
                  icon: <ShopIcon path={SI.support} />,
                  type: 'default',
                },
              ]}
            />
          )}
        </section>
      ) : (
        <div className="order-tracking-page__stack">
          <section className="order-tracking-page__journey" aria-label={t('pages.orderTracking.journeyTitle')}>
            <div className="order-tracking-page__journeyCopy">
              <span className="order-tracking-page__text order-tracking-page__eyebrow">{t('pages.orderTracking.journeyEyebrow')}</span>
              <h4 className="order-tracking-page__title">{t('pages.orderTracking.journeyTitle')}</h4>
              <span className="order-tracking-page__text order-tracking-page__text--secondary">
                {detailsRestricted
                  ? t('pages.orderTracking.accountDetailsText')
                  : order.trackingNumber
                  ? t('pages.orderTracking.journeyWithTracking', { number: order.trackingNumber })
                  : t('pages.orderTracking.journeyNoTracking')}
              </span>
            </div>
            <div className="order-tracking-page__steps" role="list">
              {[
                { step: 0, label: t('pages.orderTracking.stepPaid'), icon: <ShopIcon path={SI.checkCircle} /> },
                { step: 1, label: t('pages.orderTracking.stepPreparing'), icon: <ShopIcon path={SI.clock} /> },
                { step: 2, label: t('pages.orderTracking.stepInTransit'), icon: <ShopIcon path={SI.truck} /> },
                { step: 3, label: t('pages.orderTracking.stepDelivered'), icon: <ShopIcon path={SI.checkCircle} /> },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`order-tracking-page__step ${trackingStep >= item.step ? 'is-active' : ''}`}
                  role="listitem"
                  aria-current={trackingStep === item.step ? 'step' : undefined}
                  aria-label={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
          {!detailsRestricted ? (
            <section className="order-tracking-page__confidence">
              <div className="order-tracking-page__confidenceCard">
                <ShopIcon path={SI.truck} />
                <span>
                  <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.confidenceDeliveryTitle')}</span>
                  <span className="order-tracking-page__text order-tracking-page__text--secondary">
                    {order.trackingNumber
                      ? t('pages.orderTracking.confidenceDeliveryTracked')
                      : t('pages.orderTracking.confidenceDeliveryPreparing')}
                  </span>
                </span>
              </div>
              <div className="order-tracking-page__confidenceCard">
                <ShopIcon path={SI.support} />
                <span>
                  <span className="order-tracking-page__text order-tracking-page__text--strong">{t('pages.orderTracking.confidenceSupportTitle')}</span>
                  <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.orderTracking.confidenceSupportText')}</span>
                </span>
              </div>
            </section>
          ) : null}
          {nextAction ? (
            <section className={`order-tracking-page__nextAction order-tracking-page__nextAction--${nextAction.tone}`}>
              <div>
                <span className="order-tracking-page__text order-tracking-page__text--strong">{nextAction.title}</span>
                <span className="order-tracking-page__text order-tracking-page__text--secondary">{nextAction.text}</span>
              </div>
              {!canOperateTrackedOrder ? (
                <div className="order-tracking-page__nextActionButtons">
                  <ShopButton type="primary" aria-label={trackActionLabel(t('common.login'))} title={trackActionLabel(t('common.login'))} onClick={signInForOrder}>
                    {t('common.login')}
                  </ShopButton>
                  <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </ShopButton>
                </div>
              ) : order.status === 'PENDING_PAYMENT' ? (
                <div className="order-tracking-page__nextActionButtons">
                  <ShopButton type="primary" icon={<ShopIcon path={SI.creditCard} />} loading={paying} aria-label={trackActionLabel(t('pages.profile.continuePay'))} title={trackActionLabel(t('pages.profile.continuePay'))} onClick={continuePayment}>
                    {t('pages.profile.continuePay')}
                  </ShopButton>
                  <ShopButton
                    aria-label={trackActionLabel(t('pages.paymentInstructions.title'))}
                    title={trackActionLabel(t('pages.paymentInstructions.title'))}
                    onClick={() => {
                      const emailQuery = trackedEmail ? `?guestEmail=${encodeURIComponent(trackedEmail)}` : '';
                      navigate(`/payment/${encodeURIComponent(String(order.orderNo || order.id))}${emailQuery}`);
                    }}
                  >
                    {t('pages.paymentInstructions.title')}
                  </ShopButton>
                  <ShopButton danger icon={<ShopIcon path={SI.rollback} />} loading={canceling} aria-label={trackActionLabel(t('pages.profile.cancelOrder'))} title={trackActionLabel(t('pages.profile.cancelOrder'))} onClick={cancelPendingPayment}>
                    {t('pages.profile.cancelOrder')}
                  </ShopButton>
                  <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </ShopButton>
                </div>
              ) : (
                <div className="order-tracking-page__nextActionButtons">
                  {order.status === 'SHIPPED' ? (
                    <ShopButton type="primary" icon={<ShopIcon path={SI.checkCircle} />} loading={confirmingReceipt} aria-label={trackActionLabel(t('pages.profile.confirmReceipt'))} title={trackActionLabel(t('pages.profile.confirmReceipt'))} onClick={confirmReceiptWithReview}>
                      {t('pages.profile.confirmReceipt')}
                    </ShopButton>
                  ) : null}
                  {order.returnable ? (
                    <ShopButton icon={<ShopIcon path={SI.rollback} />} loading={returning} aria-label={returnRequestActionLabel} title={returnRequestActionLabel} onClick={() => setReturnRequestOpen(true)}>
                      {t('pages.profile.returnOrder')}
                    </ShopButton>
                  ) : null}
                  {order.status === 'RETURN_APPROVED' ? (
                    <ShopButton type="primary" icon={<ShopIcon path={SI.truck} />} loading={returnShipping} aria-label={returnShipmentActionLabel} title={returnShipmentActionLabel} onClick={() => setReturnShipmentOpen(true)}>
                      {t('pages.orderTracking.submitReturnTracking')}
                    </ShopButton>
                  ) : null}
                  <ShopButton icon={<ShopIcon path={SI.support} />} aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen}>
                    {t('pages.profile.contactSupport')}
                  </ShopButton>
                </div>
              )}
            </section>
          ) : null}
          {detailsRestricted ? (
            <ShopAlert
              type="info"
              showIcon
              className="order-tracking-page__restrictedNotice"
              message={t('pages.orderTracking.accountDetailsTitle')}
              description={t('pages.orderTracking.accountDetailsText')}
              action={(
                <ShopButton type="primary" size="small" aria-label={trackActionLabel(t('common.login'))} title={trackActionLabel(t('common.login'))} onClick={signInForOrder}>
                  {t('common.login')}
                </ShopButton>
              )}
            />
          ) : null}
          {assurancePlan ? (
            <section className="order-tracking-page__assurance" aria-label={t('pages.orderTracking.assuranceTitle')}>
              <div>
                <span className="order-tracking-page__text order-tracking-page__eyebrow">{t('pages.orderTracking.assuranceEyebrow')}</span>
                <h4 className="order-tracking-page__title">{assurancePlan.title}</h4>
                <span className="order-tracking-page__text order-tracking-page__text--secondary">{assurancePlan.text}</span>
              </div>
              {!detailsRestricted ? (
                <div className="order-tracking-page__assuranceSignals">
                  <span><ShopIcon path={SI.checkCircle} /> {t('pages.orderTracking.assuranceItems', { count: assurancePlan.itemCount })}</span>
                  <span><ShopIcon path={SI.truck} /> {order.trackingNumber ? t('pages.orderTracking.assuranceTrackingReady') : t('pages.orderTracking.assuranceTrackingPending')}</span>
                  <span><ShopIcon path={SI.support} /> {t('pages.orderTracking.assuranceSupportReady')}</span>
                </div>
              ) : null}
              <div className="order-tracking-page__assuranceActions">
                <ShopButton type="primary" aria-label={trackActionLabel(assurancePlan.primaryLabel)} title={trackActionLabel(assurancePlan.primaryLabel)} onClick={assurancePlan.primaryAction}>
                  {assurancePlan.primaryLabel}
                </ShopButton>
                {order.status === 'COMPLETED' ? (
                  <ShopButton aria-label={trackActionLabel(t('pages.profile.contactSupport'))} title={trackActionLabel(t('pages.profile.contactSupport'))} onClick={supportOpen} icon={<ShopIcon path={SI.support} />}>
                    {t('pages.profile.contactSupport')}
                  </ShopButton>
                ) : null}
              </div>
            </section>
          ) : null}
          <section className="order-tracking-page__summaryCard" aria-label={t('pages.orderTracking.summary')}>
            <dl className="order-tracking-page__descList">
              <div className="order-tracking-page__descRow">
                <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.orderNo')}</dt>
                <dd className="order-tracking-page__descValue">{order.orderNo || order.id}</dd>
              </div>
              {canShowFullTrackingDetails ? (
                <>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('common.status')}</dt>
                    <dd className="order-tracking-page__descValue">
                      <ShopTag color={getOrderStatusColor(order.status)}>{formatOrderStatusLabel(order.status)}</ShopTag>
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('common.amount')}</dt>
                    <dd className="order-tracking-page__descValue">
                      <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__amount commerce-money">{formatMoney(order.totalAmount)}</span>
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.checkout.paymentMethod')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.paymentMethod ? paymentMethodLabel(order.paymentMethod, t) : '-'}
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.checkout.address')}</dt>
                    <dd className="order-tracking-page__descValue">{order.shippingAddress || '-'}</dd>
                  </div>
                </>
              ) : null}
              {canShowFullTrackingDetails ? (
                <>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.createdAt')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString(dateLocale) : '-'}
                    </dd>
                  </div>
                  <div className="order-tracking-page__descRow">
                    <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.trackingNumber')}</dt>
                    <dd className="order-tracking-page__descValue">
                      {order.trackingNumber || t('pages.orderTracking.notShipped')}
                    </dd>
                  </div>
                </>
              ) : null}
              {canShowFullTrackingDetails && order.trackingCarrierName ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.orderTracking.carrier')}</dt>
                  <dd className="order-tracking-page__descValue">{order.trackingCarrierName}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnDeadline ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnDeadline')}</dt>
                  <dd className="order-tracking-page__descValue">{new Date(order.returnDeadline).toLocaleString(dateLocale)}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnReason ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnReason')}</dt>
                  <dd className="order-tracking-page__descValue">{order.returnReason}</dd>
                </div>
              ) : null}
              {canShowFullTrackingDetails && order.returnTrackingNumber ? (
                <div className="order-tracking-page__descRow">
                  <dt className="order-tracking-page__descLabel">{t('pages.profile.returnTracking')}</dt>
                  <dd className="order-tracking-page__descValue">{order.returnTrackingNumber}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {canShowFullTrackingDetails ? (
            <>
              <section className="order-tracking-page__itemsCard" aria-label={t('pages.profile.orderItems')}>
                {(!items || items.length === 0) ? (
                      <div className="order-tracking-page__itemsEmpty" data-order-tracking-items-empty="true">
                        <div className="order-tracking-page__itemsEmptyCopy">
                          <div>{t('pages.profile.noOrderItems')}</div>
                          <div className="order-tracking-page__itemsEmptyHint">{t('pages.orderTracking.noOrderItemsHint')}</div>
                        </div>
                        <div className="order-tracking-page__itemsEmptyActions" data-order-tracking-items-empty-actions="true">
                          <ShopButton
                            type="primary"
                            icon={<ShopIcon path={SI.shopping} />}
                            aria-label={t('pages.orderTracking.shopAgain')}
                            title={t('pages.orderTracking.shopAgain')}
                            onClick={() => navigate('/products')}
                          >
                            {t('pages.orderTracking.shopAgain')}
                          </ShopButton>
                          <ShopButton
                            icon={<ShopIcon path={SI.gift} />}
                            aria-label={t('pages.orderTracking.emptyCoupons')}
                            title={t('pages.orderTracking.emptyCoupons')}
                            onClick={() => navigate('/coupons')}
                          >
                            {t('pages.orderTracking.emptyCoupons')}
                          </ShopButton>
                          <ShopButton
                            icon={<ShopIcon path={SI.support} />}
                            aria-label={t('pages.productList.loadRecoverySupport')}
                            title={t('pages.productList.loadRecoverySupport')}
                            onClick={() => dispatchDomEvent('shop:open-support')}
                          >
                            {t('pages.productList.loadRecoverySupport')}
                          </ShopButton>
                        </div>
                      </div>
                ) : (
                  <ul className="order-tracking-page__itemList" role="list">
                    {items.map((item, index) => {
                    const itemName = orderTrackingItemName(item);
                    return (
                      <li key={String(item.id || `${item.productId || 'item'}-${index}`)} className="order-tracking-page__item">
                        <div className="order-tracking-page__itemMeta">
                            <img
                              src={resolveOrderTrackingImage(item.imageUrl)}
                              alt={itemName}
                              className="order-tracking-page__image order-tracking-page__itemAvatar"
                              onError={(event) => {
                                if (event.currentTarget.src !== orderTrackingImageFallback) {
                                  event.currentTarget.src = orderTrackingImageFallback;
                                }
                              }}
                            />
                          <div className="order-tracking-page__itemBody">
                            <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__itemTitle">{itemName}</span>
                            <div className="order-tracking-page__stack">
                              {item.selectedSpecs ? <span className="order-tracking-page__text order-tracking-page__text--secondary">{formatSelectedSpecs(item.selectedSpecs, t, language)}</span> : null}
                              <span className="order-tracking-page__text order-tracking-page__text--secondary order-tracking-page__itemUnit commerce-atomic commerce-price-quantity">
                                <span className="commerce-money">{formatMoney(item.price)}</span>
                                <span className="commerce-quantity">x {item.quantity}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="order-tracking-page__text order-tracking-page__text--strong order-tracking-page__itemTotal commerce-money">{formatMoney(item.price * item.quantity)}</span>
                      </li>
                    );
                  })}
                  </ul>
                )}
              </section>

              <section className="order-tracking-page__logisticsCard" aria-label={t('pages.orderTracking.logistics')}>
                {order.trackingNumber ? (
                  <SeventeenTrackWidget
                    trackingNumber={order.trackingNumber}
                    carrierCode={order.trackingCarrierCode}
                    orderId={order.id}
                    guestEmail={canUseGuestActions ? trackedEmail : undefined}
                    orderNo={canUseGuestActions ? order.orderNo : undefined}
                  />
                ) : (
                  <div className="order-tracking-page__notShipped" data-order-tracking-not-shipped="true" role="status">
                    <div className="order-tracking-page__emptyPanel">
                      <div className="order-tracking-page__emptyCopy">
                        <div>{t('pages.orderTracking.notShipped')}</div>
                        <div className="order-tracking-page__emptyHint">{t('pages.orderTracking.notShippedHint')}</div>
                      </div>
                      <div className="order-tracking-page__notShippedActions">
                        <ShopButton
                          type="primary"
                          icon={<ShopIcon path={SI.support} />}
                          aria-label={trackActionLabel(t('pages.profile.contactSupport'))}
                          title={trackActionLabel(t('pages.profile.contactSupport'))}
                          onClick={supportOpen}
                        >
                          {t('pages.profile.contactSupport')}
                        </ShopButton>
                        <ShopButton
                          aria-label={trackActionLabel(t('pages.orderTracking.emptyProfileOrders'))}
                          title={trackActionLabel(t('pages.orderTracking.emptyProfileOrders'))}
                          onClick={() => navigate('/profile?tab=orders')}
                        >
                          {t('pages.orderTracking.emptyProfileOrders')}
                        </ShopButton>
                        <ShopButton
                          aria-label={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                          title={trackActionLabel(t('pages.orderTracking.shopAgain'))}
                          onClick={() => navigate('/products')}
                        >
                          {t('pages.orderTracking.shopAgain')}
                        </ShopButton>
                        <ShopButton
                          aria-label={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                          title={trackActionLabel(t('pages.orderTracking.emptyCoupons'))}
                          onClick={() => navigate('/coupons')}
                        >
                          {t('pages.orderTracking.emptyCoupons')}
                        </ShopButton>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}

  </>
);

/** Return request/shipment modals and confirm dialogs. */
export const OrderTrackingDialogs: React.FC<OrderTrackingPanelsProps> = ({
  t,
  language,
  navigate,
  form,
  formatMoney,
  formatOrderStatusLabel,
  getOrderStatusColor,
  orderTrackingItemName,
  loading,
  paying,
  canceling,
  confirmingReceipt,
  returning,
  returnShipping,
  order,
  items,
  lookupError,
  detailsRestricted,
  canShowFullTrackingDetails,
  canOperateTrackedOrder,
  canUseGuestActions,
  canUseSignedInActions,
  trackedEmail,
  trackingStep,
  nextAction,
  assurancePlan,
  paymentReturnStatus,
  paymentReturnEmailGateVisible,
  paymentReturnEmailInputRef,
  prefillNoticeVisible,
  setPrefillNoticeVisible,
  dateLocale,
  trackActionLabel,
  trackedOrderLabel,
  returnRequestOpen,
  setReturnRequestOpen,
  returnShipmentOpen,
  setReturnShipmentOpen,
  returnReason,
  setReturnReason,
  returnTrackingNumber,
  setReturnTrackingNumber,
  returnReasonInputLabel,
  returnTrackingInputLabel,
  returnRequestActionLabel,
  returnShipmentActionLabel,
  rollbackConfirmOpen,
  setRollbackConfirmOpen,
  receiptConfirmOpen,
  setReceiptConfirmOpen,
  onFinish,
  continuePayment,
  cancelPendingPayment,
  handleRollbackConfirm,
  confirmReceipt,
  confirmReceiptWithReview,
  submitReturnRequest,
  submitReturnTracking,
  restoreTrackedItemsToCart,
  signInForOrder,
  supportOpen
}) => (
  <>
      <ShopModal
        title={t('pages.profile.returnOrder')}
        open={returnRequestOpen}
        onOk={submitReturnRequest}
        onClose={() => { setReturnRequestOpen(false); setReturnReason(''); }}
        confirmLoading={returning}
        okText={t('pages.profile.returnOrder')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': returnRequestActionLabel,
          title: returnRequestActionLabel,
          disabled: !isReturnReasonReady(returnReason),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${returnRequestActionLabel}`, title: `${t('common.cancel')}: ${returnRequestActionLabel}` }}
        className="profile-mobile-safe-modal order-tracking-page__returnModal profile-return-modal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
      >
        <div className="order-tracking-page__stack">
          {order ? (
            <div
              className="profile-return-modal__summary"
              aria-label={t('pages.profile.returnOrderSummary', {
                orderNo: order.orderNo || order.id,
                amount: formatMoney(order.totalAmount),
              })}
            >
              <span className="order-tracking-page__text order-tracking-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: order.orderNo || order.id,
                  amount: formatMoney(order.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnTimelineTitle')}>
            <span className="order-tracking-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnTimelineTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.profile.returnReviewHint')}</span>
          {order?.returnDeadline ? (
            <span className="order-tracking-page__text order-tracking-page__text--secondary">
              {t('pages.profile.returnAvailableUntil', { time: new Date(order.returnDeadline).toLocaleString(dateLocale) })}
            </span>
          ) : null}
          <div className="profile-return-modal__presets" role="group" aria-label={t('pages.profile.returnReasonPresetsLabel')}>
            <span className="order-tracking-page__text profile-return-modal__presetsLabel">{t('pages.profile.returnReasonPresetsLabel')}</span>
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
            value={returnReason}
            status={returnReason && !isReturnReasonReady(returnReason) ? 'error' : ''}
            onChange={(event) => setReturnReason(event.target.value)}
            maxLength={500}
            showCount
            placeholder={t('pages.profile.returnReasonPlaceholder')}
            aria-label={returnReasonInputLabel}
            title={returnReasonInputLabel}
          />
        </div>
      </ShopModal>
      <ShopModal
        title={t('pages.profile.submitReturnShipment')}
        open={returnShipmentOpen}
        onOk={submitReturnTracking}
        onClose={() => { setReturnShipmentOpen(false); setReturnTrackingNumber(''); }}
        confirmLoading={returnShipping}
        okText={t('pages.profile.submitReturnShipment')}
        cancelText={t('common.cancel')}
        okButtonProps={{
          'aria-label': returnShipmentActionLabel,
          title: returnShipmentActionLabel,
          disabled: !isReturnTrackingReady(returnTrackingNumber),
        }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${returnShipmentActionLabel}`, title: `${t('common.cancel')}: ${returnShipmentActionLabel}` }}
        className="profile-mobile-safe-modal order-tracking-page__returnModal profile-return-modal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
      >
        <div className="order-tracking-page__stack">
          {order ? (
            <div className="profile-return-modal__summary">
              <span className="order-tracking-page__text order-tracking-page__text--strong">
                {t('pages.profile.returnOrderSummary', {
                  orderNo: order.orderNo || order.id,
                  amount: formatMoney(order.totalAmount),
                })}
              </span>
            </div>
          ) : null}
          <div className="profile-return-modal__timeline" aria-label={t('pages.profile.returnShipmentStepsTitle')}>
            <span className="order-tracking-page__text profile-return-modal__timelineTitle">{t('pages.profile.returnShipmentStepsTitle')}</span>
            <div className="profile-return-modal__steps" role="list">
              {returnFlowStepI18nKeys.map((stepKey) => (
                <span key={stepKey} className="profile-return-modal__step" role="listitem">{t(stepKey)}</span>
              ))}
            </div>
          </div>
          <span className="order-tracking-page__text order-tracking-page__text--secondary">{t('pages.profile.returnShipmentHint')}</span>
          <ShopInput
            value={returnTrackingNumber}
            onChange={(event) => setReturnTrackingNumber(event.target.value)}
            autoComplete="off"
            inputMode="text"
            maxLength={120}
            status={returnTrackingNumber && !isReturnTrackingReady(returnTrackingNumber) ? 'error' : ''}
            placeholder={t('pages.profile.returnTrackingPlaceholder')}
            aria-label={returnTrackingInputLabel}
            title={returnTrackingInputLabel}
            onBlur={() => setReturnTrackingNumber((value) => normalizeReturnTrackingNumber(value))}
          />
        </div>
      </ShopModal>

      <ShopConfirm
        open={rollbackConfirmOpen}
        title={t('pages.checkout.rollbackPaymentTitle')}
        description={t('pages.checkout.rollbackPaymentContent')}
        okText={t('pages.checkout.rollbackPaymentAction')}
        cancelText={t('common.cancel')}
        confirmLoading={canceling}
        okButtonProps={{
          danger: true,
          'aria-label': order ? `${t('pages.checkout.rollbackPaymentAction')}: ${order.orderNo || `#${order.id}`}` : t('pages.checkout.rollbackPaymentAction'),
          title: order ? `${t('pages.checkout.rollbackPaymentAction')}: ${order.orderNo || `#${order.id}`}` : t('pages.checkout.rollbackPaymentAction'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
          title: `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
        }}
        className="profile-mobile-safe-modal order-tracking-page__rollbackConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={handleRollbackConfirm}
        onCancel={() => { if (!canceling) setRollbackConfirmOpen(false); }}
      />
      <ShopConfirm
        open={receiptConfirmOpen}
        title={t('pages.profile.confirmReceiptTitle')}
        description={order ? t('pages.profile.confirmReceiptContent', { orderNo: order.orderNo || order.id }) : t('pages.profile.confirmReceiptTitle')}
        okText={t('pages.profile.confirmReceipt')}
        cancelText={t('common.cancel')}
        confirmLoading={confirmingReceipt}
        okButtonProps={{
          'aria-label': order ? `${t('pages.profile.confirmReceipt')}: ${order.orderNo || `#${order.id}`}` : t('pages.profile.confirmReceipt'),
          title: order ? `${t('pages.profile.confirmReceipt')}: ${order.orderNo || `#${order.id}`}` : t('pages.profile.confirmReceipt'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
          title: `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
        }}
        className="profile-mobile-safe-modal order-tracking-page__receiptConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={confirmReceipt}
        onCancel={() => { if (!confirmingReceipt) setReceiptConfirmOpen(false); }}
      />
  </>
);

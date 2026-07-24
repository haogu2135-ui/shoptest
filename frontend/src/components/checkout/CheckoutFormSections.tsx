import React from 'react';
import { Link } from 'react-router-dom';
import { Form } from 'antd';
import { ShopIcon, SI } from '../ShopIcon';
import ShopButton from '../ShopButton';
import ShopInput, { ShopTextArea } from '../ShopInput';
import ShopSelect, { type ShopSelectOption } from '../ShopSelect';
import ShopCascader, { type ShopCascaderOption } from '../ShopCascader';
import ShopTag from '../ShopTag';
import ShopAlert from '../ShopAlert';
import type { CartItem, UserAddress } from '../../types';
import type { CheckoutTranslationFn } from '../../utils/checkoutHelpers';
import {
  getCartItemLowStockCount,
  hasCompleteCheckoutDetailAddress,
  hasCompleteCheckoutRecipientName,
  isLikelyPhone,
  isValidCheckoutPostalCode,
  normalizeCheckoutPostalCode,
  normalizeCheckoutText,
  normalizeLikelyCheckoutPhone,
} from '../../utils/checkoutHelpers';
import { getCartLineAmount } from '../../utils/cartUi';
import { formatSelectedSpecs } from '../../utils/selectedSpecs';
import type { PaymentMethodDetail } from '../../utils/paymentMethods';
import type { Language } from '../../i18n';

type Translate = CheckoutTranslationFn;
type MoneyFmt = (value: number | null | undefined) => string;

export type CheckoutItemsCardProps = {
  t: Translate;
  language: Language;
  cartItems: CartItem[];
  checkoutItemCount: number;
  cartTotal: number;
  formatMoney: MoneyFmt;
  resolveImage: (imageUrl?: string | null) => string;
  imageFallback: string;
  itemName: (item: Pick<CartItem, 'productId' | 'productName'>) => string;
  onOpenProduct: (productId: number) => void;
};

export const CheckoutItemsCard: React.FC<CheckoutItemsCardProps> = ({
  t,
  language,
  cartItems,
  checkoutItemCount,
  cartTotal,
  formatMoney,
  resolveImage,
  imageFallback,
  itemName,
  onOpenProduct,
}) => (
  <section className="checkout-page__itemsCard checkout-page__sectionCard" aria-label={t('pages.checkout.itemList')}>
    <div className="shop-panel__head">
      <div className="shop-panel__title">{t('pages.checkout.itemList')}</div>
    </div>
    <ul className="checkout-page__itemList" role="list">
      {cartItems.map((item) => {
        const name = itemName(item);
        const itemActionLabel = `${t('pages.productList.viewDetails')}: ${name}`;
        return (
          <li key={item.id} className="checkout-page__item">
            <div className="checkout-page__itemMeta">
              <img
                src={resolveImage(item.imageUrl)}
                alt={name}
                className="checkout-page__itemImage"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  if (event.currentTarget.src !== imageFallback) {
                    event.currentTarget.src = imageFallback;
                  }
                }}
              />
              <div className="checkout-page__itemBody">
                <button
                  type="button"
                  className="checkout-page__itemLink"
                  aria-label={itemActionLabel}
                  title={itemActionLabel}
                  onClick={() => onOpenProduct(item.productId)}
                >
                  {name}
                </button>
                <div className="checkout-page__itemDescription">
                  {item.selectedSpecs ? (
                    <span className="checkout-page__text checkout-page__text--secondary">
                      {formatSelectedSpecs(item.selectedSpecs, t, language)}
                    </span>
                  ) : null}
                  {getCartItemLowStockCount(item) !== null ? (
                    <span className="checkout-page__text checkout-page__text--warning checkout-page__urgency">
                      {t('pages.cart.lowStockLeft', { count: getCartItemLowStockCount(item) ?? 0 })}
                    </span>
                  ) : null}
                  <div className="checkout-page__itemCommerce">
                    <span className="checkout-page__text checkout-page__text--secondary checkout-page__itemUnit commerce-atomic commerce-price-quantity">
                      <span className="commerce-money">{formatMoney(item.price)}</span>
                      <span className="commerce-quantity">x {item.quantity}</span>
                    </span>
                    <span className="checkout-page__text checkout-page__text--strong checkout-page__itemTotal commerce-money">
                      {formatMoney(getCartLineAmount(item))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
    <hr className="checkout-page__divider" />
    <div className="checkout-page__summaryLine">
      <span className="checkout-page__text">{t('pages.checkout.itemSummary', { count: checkoutItemCount })}</span>
      <span className="checkout-page__text checkout-page__text--strong checkout-page__summaryTotal commerce-money">
        {' '}{formatMoney(cartTotal)}
      </span>
    </div>
  </section>
);

export type CheckoutExpressPaymentGridProps = {
  t: Translate;
  paymentMethodsAvailable: boolean;
  paymentChannelsError: string | null;
  paymentUnavailableRecoveryActions: React.ReactNode;
  paymentMethodDetails: PaymentMethodDetail[];
  watchedPaymentMethod?: string;
  recommendedPaymentMethod?: string | null;
  onSelectMethod: (methodValue: string) => void;
  onMethodKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, methodValue: string) => void;
};

export const CheckoutExpressPaymentGrid: React.FC<CheckoutExpressPaymentGridProps> = ({
  t,
  paymentMethodsAvailable,
  paymentChannelsError,
  paymentUnavailableRecoveryActions,
  paymentMethodDetails,
  watchedPaymentMethod,
  recommendedPaymentMethod,
  onSelectMethod,
  onMethodKeyDown,
}) => (
  <section className="checkout-page__expressCard" aria-label={t('pages.checkout.expressCheckout')}>
    <div className="shop-panel__head">
      <div className="shop-panel__title">{t('pages.checkout.expressCheckout')}</div>
    </div>
    <div className="checkout-page__paymentGrid" role="radiogroup" aria-label={t('pages.payment.title')} aria-required="true">
      {!paymentMethodsAvailable ? (
        <ShopAlert
          className="checkout-page__paymentUnavailable"
          data-checkout-payment-unavailable="true"
          type="warning"
          showIcon
          role="alert"
          aria-live="polite"
          message={t('pages.checkout.paymentUnavailable')}
          description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
          action={paymentUnavailableRecoveryActions}
        />
      ) : null}
      {paymentMethodDetails.map((method, index) => {
        const checked = watchedPaymentMethod === method.value;
        const defaultTabStop = !watchedPaymentMethod
          && method.value === (recommendedPaymentMethod || paymentMethodDetails[0]?.value);
        const methodActionLabel = `${method.title}: ${t(method.descriptionKey)}`;
        return (
          <button
            type="button"
            key={method.value}
            role="radio"
            aria-checked={checked}
            aria-label={methodActionLabel}
            title={methodActionLabel}
            tabIndex={checked || defaultTabStop || (!watchedPaymentMethod && !recommendedPaymentMethod && index === 0) ? 0 : -1}
            data-payment-method={method.value}
            className={`checkout-page__paymentMethod${checked ? ' checkout-page__paymentMethod--selected' : ''}`}
            onClick={() => onSelectMethod(method.value)}
            onKeyDown={(event) => onMethodKeyDown(event, method.value)}
          >
            <span className="checkout-page__paymentMethodTop">
              <strong className="checkout-page__paymentMethodTitle">{method.title}</strong>
              <span className="checkout-page__paymentBadges">
                {recommendedPaymentMethod === method.value ? (
                  <ShopTag color="gold">{t('pages.checkout.recommendedPayment')}</ShopTag>
                ) : null}
                <ShopTag color={method.market === 'CN' ? 'red' : method.value === 'OXXO' ? 'orange' : method.value === 'SPEI' ? 'blue' : 'green'}>
                  {t(method.badgeKey)}
                </ShopTag>
              </span>
            </span>
            <span className="checkout-page__paymentMethodDescription">{t(method.descriptionKey)}</span>
          </button>
        );
      })}
    </div>
    <span className="checkout-page__text checkout-page__text--secondary checkout-page__expressHint">
      {t('pages.checkout.expressHint')}
    </span>
  </section>
);

export type CheckoutSubmitPaymentSectionProps = {
  t: Translate;
  paymentMethodsAvailable: boolean;
  paymentChannelsError: string | null;
  paymentUnavailableRecoveryActions: React.ReactNode;
  selectedPaymentTitle?: string;
  checkoutItemCount: number;
  payableAmountText: string;
  shippingQuoteReady: boolean;
  submitting: boolean;
  checkoutSubmitDisabled: boolean;
  checkoutSubmitActionLabel: string;
  checkoutSubmitTooltip?: string;
  submitButtonContent: React.ReactNode;
  checkoutBlockingAction: { key: string } | null;
  checkoutNextAction: { key: string; text: string } | null;
  checkoutCoachActionLabel: string;
  checkoutNextActionLabel: string;
  checkoutConfirmationActionLabel: string;
  paymentChannelsLoading: boolean;
  onReloadPaymentChannels: () => void;
  onOpenSupport: () => void;
  onCart: () => void;
  onBrowse: () => void;
  onCoupons: () => void;
  onNextAction: () => void;
};

export const CheckoutSubmitPaymentSection: React.FC<CheckoutSubmitPaymentSectionProps> = ({
  t,
  paymentMethodsAvailable,
  paymentChannelsError,
  paymentUnavailableRecoveryActions,
  selectedPaymentTitle,
  checkoutItemCount,
  payableAmountText,
  shippingQuoteReady,
  submitting,
  checkoutSubmitDisabled,
  checkoutSubmitActionLabel,
  checkoutSubmitTooltip,
  submitButtonContent,
  checkoutBlockingAction,
  checkoutNextAction,
  checkoutCoachActionLabel,
  checkoutNextActionLabel,
  checkoutConfirmationActionLabel,
  paymentChannelsLoading,
  onReloadPaymentChannels,
  onOpenSupport,
  onCart,
  onBrowse,
  onCoupons,
  onNextAction,
}) => (
  <section id="checkout-payment-card" aria-label={t('pages.payment.title')}>
    <div className="shop-panel__head">
      <div className="shop-panel__title">{t('pages.payment.title')}</div>
    </div>
    <div className="checkout-page__paymentConfidence">
      <ShopIcon path={SI.safety} />
      <span>
        <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.paymentConfidenceTitle')}</span>
        <span className="checkout-page__text checkout-page__text--secondary">
          {!paymentMethodsAvailable
            ? t('pages.checkout.paymentUnavailable')
            : selectedPaymentTitle
              ? t('pages.checkout.paymentConfidenceSelected', { method: selectedPaymentTitle })
              : t('pages.checkout.paymentConfidenceDefault')}
        </span>
      </span>
    </div>
    {!paymentMethodsAvailable ? (
      <ShopAlert
        className="checkout-page__paymentUnavailable"
        data-checkout-payment-unavailable="true"
        type="warning"
        showIcon
        role="alert"
        aria-live="polite"
        message={t('pages.checkout.paymentUnavailable')}
        description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
        action={paymentUnavailableRecoveryActions}
      />
    ) : null}
    <Form.Item name="paymentMethod" rules={[{ required: true, message: t('pages.checkout.paymentRequired') }]} hidden>
      <ShopInput />
    </Form.Item>
    <div className="checkout-page__submitReview">
      <div className="checkout-page__submitMetric">
        <span className="checkout-page__text checkout-page__text--secondary">
          {t('pages.checkout.itemSummary', { count: checkoutItemCount })}
        </span>
        <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>
          {payableAmountText}
        </span>
      </div>
      <div className="checkout-page__submitMetric checkout-page__submitMetric--method">
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.paymentMethod')}</span>
        <span className="checkout-page__text checkout-page__text--strong">
          {selectedPaymentTitle || t('pages.checkout.paymentConfidenceDefault')}
        </span>
      </div>
      <Form.Item className="checkout-page__submitAction">
        <ShopButton
          className="checkout-page__submitButton"
          type="primary"
          htmlType="submit"
          loading={submitting}
          disabled={checkoutSubmitDisabled}
          block
          size="large"
          aria-label={checkoutSubmitActionLabel}
          title={checkoutSubmitTooltip}
        >
          {submitButtonContent}
        </ShopButton>
      </Form.Item>
      <p className="checkout-page__legalNotice" role="note">
        {t('pages.checkout.orderAgreementPrefix')}{' '}
        <Link to="/terms">{t('footer.terms')}</Link>
        {' '}{t('pages.checkout.orderAgreementAnd')}{' '}
        <Link to="/privacy">{t('footer.privacy')}</Link>
        {t('pages.checkout.orderAgreementSuffix')}
      </p>
    </div>
    <div
      className={checkoutBlockingAction ? 'checkout-page__mobilePayBar checkout-page__mobilePayBar--coach' : 'checkout-page__mobilePayBar'}
      role="region"
      aria-label={t('pages.checkout.paymentConfidenceTitle')}
      data-checkout-mobile-coach={checkoutBlockingAction ? 'true' : 'false'}
    >
      <span className="checkout-page__mobilePayBarMeta">
        <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.payable')}</span>
        <span className={`checkout-page__text checkout-page__text--strong ${shippingQuoteReady ? 'commerce-money' : ''}`}>
          {payableAmountText}
        </span>
        <span
          className={checkoutBlockingAction
            ? 'checkout-page__text checkout-page__text--secondary checkout-page__mobilePayBarTrust checkout-page__mobilePayBarCoach'
            : 'checkout-page__text checkout-page__text--secondary checkout-page__mobilePayBarTrust'}
        >
          {checkoutBlockingAction
            ? (checkoutNextAction?.text || checkoutCoachActionLabel)
            : selectedPaymentTitle
              ? t('pages.checkout.mobilePayBarTrust', { method: selectedPaymentTitle })
              : t('pages.checkout.mobilePayBarTrustDefault')}
        </span>
      </span>
      {!paymentMethodsAvailable ? (
        <div
          className="checkout-page__paymentUnavailableActions checkout-page__paymentUnavailableActions--mobile"
          data-checkout-payment-unavailable-recovery="true"
        >
          <ShopButton
            type="primary"
            size="large"
            loading={paymentChannelsLoading}
            aria-label={t('messages.retry')}
            title={t('messages.retry')}
            onClick={onReloadPaymentChannels}
          >
            {t('messages.retry')}
          </ShopButton>
          <ShopButton
            size="large"
            icon={<ShopIcon path={SI.support} />}
            aria-label={t('pages.profile.contactSupport')}
            title={t('pages.profile.contactSupport')}
            onClick={onOpenSupport}
          >
            {t('pages.profile.contactSupport')}
          </ShopButton>
          <ShopButton
            size="large"
            icon={<ShopIcon path={SI.cart} />}
            aria-label={t('pages.cart.title')}
            title={t('pages.cart.title')}
            onClick={onCart}
          >
            {t('pages.cart.title')}
          </ShopButton>
          <ShopButton
            size="large"
            icon={<ShopIcon path={SI.shopping} />}
            aria-label={t('pages.cart.browse')}
            title={t('pages.cart.browse')}
            onClick={onBrowse}
          >
            {t('pages.cart.browse')}
          </ShopButton>
          <ShopButton
            size="large"
            icon={<ShopIcon path={SI.gift} />}
            aria-label={t('nav.coupons')}
            title={t('nav.coupons')}
            onClick={onCoupons}
          >
            {t('nav.coupons')}
          </ShopButton>
        </div>
      ) : (
        <ShopButton
          type="primary"
          htmlType={checkoutBlockingAction ? 'button' : 'submit'}
          onClick={checkoutBlockingAction ? onNextAction : undefined}
          loading={submitting}
          disabled={!checkoutBlockingAction && checkoutSubmitDisabled}
          aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}
          title={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitTooltip}
        >
          {checkoutBlockingAction ? checkoutNextActionLabel : submitButtonContent}
        </ShopButton>
      )}
    </div>
  </section>
);


export type CheckoutGuestContactSectionProps = {
  t: Translate;
  fieldErrorExtra: (fieldName: string) => React.ReactNode;
};

export const CheckoutGuestContactSection: React.FC<CheckoutGuestContactSectionProps> = ({
  t,
  fieldErrorExtra,
}) => (
  <section className="checkout-page__sectionCard" id="checkout-contact-card" aria-label={t('pages.checkout.contact')}>
    <div className="shop-panel__head">
      <div className="shop-panel__title">{t('pages.checkout.contact')}</div>
    </div>
    <Form.Item
      name="guestEmail"
      label={t('pages.checkout.email')}
      rules={[
        { required: true, message: t('pages.checkout.emailRequired') },
        { type: 'email', message: t('pages.checkout.emailInvalid') },
      ]}
      extra={fieldErrorExtra('guestEmail')}
    >
      <ShopInput
        placeholder={t('pages.checkout.guestEmailPlaceholder')}
        autoComplete="email"
        inputMode="email"
        maxLength={120}
      />
    </Form.Item>
    <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.guestHint')}</span>
  </section>
);

export type CheckoutAddressSectionProps = {
  t: Translate;
  addresses: UserAddress[];
  addressLoadFailed: boolean;
  selectedAddressId: number | 'new';
  addressGroupLabel: string;
  regionOptions: ShopCascaderOption[];
  regionOptionsLoading: boolean;
  regionInputLabel: string;
  regionCascaderOpen: boolean;
  fieldErrorExtra: (fieldName: string) => React.ReactNode;
  onRetryAddressLoad: () => void;
  onSelectAddress: (id: number | 'new') => void;
  onRegionOpenChange: (open: boolean) => void;
  onPhoneBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onPostalCodeBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
};

export const CheckoutAddressSection: React.FC<CheckoutAddressSectionProps> = ({
  t,
  addresses,
  addressLoadFailed,
  selectedAddressId,
  addressGroupLabel,
  regionOptions,
  regionOptionsLoading,
  regionInputLabel,
  regionCascaderOpen,
  fieldErrorExtra,
  onRetryAddressLoad,
  onSelectAddress,
  onRegionOpenChange,
  onPhoneBlur,
  onPostalCodeBlur,
}) => (
  <section className="checkout-page__sectionCard" id="checkout-address-card" aria-label={t('pages.checkout.address')}>
    <div className="shop-panel__head">
      <div className="shop-panel__title">{t('pages.checkout.address')}</div>
    </div>
    {addressLoadFailed ? (
      <ShopAlert
        type="warning"
        showIcon
        className="checkout-page__addressLoadAlert"
        message={t('pages.checkout.addressLoadFailed')}
        description={t('pages.checkout.addressLoadFailedDescription')}
        action={<ShopButton size="small" onClick={onRetryAddressLoad}>{t('messages.retry')}</ShopButton>}
      />
    ) : null}
    {addresses.length > 0 && (
      <div
        className="checkout-page__addressGroup"
        role="radiogroup"
        aria-label={addressGroupLabel}
        title={addressGroupLabel}
      >
        {addresses.map((address) => {
          const addressChoiceLabel = [
            normalizeCheckoutText(address.recipientName, 80),
            normalizeLikelyCheckoutPhone(address.phone),
            normalizeCheckoutText(address.address, 260),
            address.isDefault ? t('pages.checkout.defaultAddress') : null,
          ].filter(Boolean).join(', ');
          const selected = String(selectedAddressId) === String(address.id);
          return (
            <button
              key={address.id}
              type="button"
              role="radio"
              className={selected ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
              aria-checked={selected}
              aria-label={addressChoiceLabel}
              title={addressChoiceLabel}
              onClick={() => onSelectAddress(address.id)}
            >
              <div className="checkout-page__addressHeader">
                <span className="checkout-page__text checkout-page__text--strong">{address.recipientName}</span>
                <span className="checkout-page__text checkout-page__text--secondary">{address.phone}</span>
                {address.isDefault && <ShopTag color="orange">{t('pages.checkout.defaultAddress')}</ShopTag>}
              </div>
              <div className="checkout-page__addressText">{address.address}</div>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          className={selectedAddressId === 'new' ? 'checkout-page__addressChoice checkout-page__addressChoice--selected' : 'checkout-page__addressChoice'}
          aria-checked={selectedAddressId === 'new'}
          aria-label={t('pages.checkout.useNewAddress')}
          title={t('pages.checkout.useNewAddress')}
          onClick={() => onSelectAddress('new')}
        >
          <span className="checkout-page__text checkout-page__text--strong">{t('pages.checkout.useNewAddress')}</span>
        </button>
      </div>
    )}

    {(selectedAddressId === 'new' || addresses.length === 0) && (
      <>
        <Form.Item
          name="recipientName"
          label={t('pages.checkout.recipient')}
          rules={[
            { required: true, message: t('pages.checkout.recipientRequired') },
            {
              validator: (_, value) => (
                !value || hasCompleteCheckoutRecipientName(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('pages.checkout.recipientMin')))
              ),
            },
          ]}
          extra={fieldErrorExtra('recipientName')}
        >
          <ShopInput placeholder={t('pages.checkout.recipientRequired')} maxLength={80} autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('pages.profile.phone')}
          rules={[
            { required: true, message: t('pages.checkout.phoneRequired') },
            { validator: (_, value) => (!value || isLikelyPhone(value) ? Promise.resolve() : Promise.reject(new Error(t('pages.checkout.phoneInvalid')))) },
          ]}
          extra={fieldErrorExtra('phone')}
        >
          <ShopInput
            placeholder={t('pages.checkout.phoneRequired')}
            maxLength={40}
            autoComplete="tel"
            inputMode="tel"
            onBlur={onPhoneBlur}
          />
        </Form.Item>
        <Form.Item
          name="region"
          label={t('pages.checkout.region')}
          rules={[{ required: true, message: t('pages.checkout.regionRequired') }]}
          extra={fieldErrorExtra('region')}
        >
          <ShopCascader
            options={regionOptions}
            placeholder={regionOptionsLoading ? t('common.loading') : t('pages.checkout.regionPlaceholder')}
            ariaLabel={regionInputLabel}
            title={regionInputLabel}
            open={regionCascaderOpen}
            onOpenChange={onRegionOpenChange}
            popupClassName="shop-mobile-popup-layer checkout-region-cascader-popup"
            popupZIndex={2400}
          />
        </Form.Item>
        <Form.Item
          name="shippingAddress"
          label={t('pages.checkout.detailAddress')}
          rules={[
            { required: true, message: t('pages.checkout.detailRequired') },
            {
              validator: (_, value) => (
                !value || hasCompleteCheckoutDetailAddress(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('pages.checkout.detailMin')))
              ),
            },
          ]}
          extra={fieldErrorExtra('shippingAddress')}
        >
          <ShopTextArea rows={3} placeholder={t('pages.checkout.detailPlaceholder')} maxLength={260} showCount autoComplete="street-address" />
        </Form.Item>
        <Form.Item
          name="postalCode"
          label={t('pages.checkout.postalCode')}
          dependencies={['region']}
          rules={[
            { required: true, message: t('pages.checkout.postalCodeRequired') },
            ({ getFieldValue }) => ({
              validator: (_, value) => (
                !value || isValidCheckoutPostalCode(value, getFieldValue('region'))
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('pages.checkout.postalCodeInvalid')))
              ),
            }),
          ]}
          extra={fieldErrorExtra('postalCode')}
        >
          <ShopInput
            placeholder={t('pages.checkout.postalCodePlaceholder')}
            maxLength={20}
            autoComplete="postal-code"
            inputMode="text"
            onBlur={onPostalCodeBlur}
          />
        </Form.Item>
      </>
    )}
  </section>
);

type CheckoutOrderSummaryLinesProps = {
  t: Translate;
  cartTotal: number;
  discountAmount?: number;
  showDiscount?: boolean;
  formatMoney: MoneyFmt;
  shippingQuoteReady: boolean;
  shippingFeeText: string;
  shippingPolicyText: string;
  shippingQuotePending: boolean;
  shippingQuoteUnavailable: boolean;
  shippingQuoteFallbackActive: boolean;
  shippingQuoteAlertDescription?: string | null;
  payableAmountText: string;
};

const CheckoutOrderSummaryLines: React.FC<CheckoutOrderSummaryLinesProps> = ({
  t,
  cartTotal,
  discountAmount = 0,
  showDiscount = false,
  formatMoney,
  shippingQuoteReady,
  shippingFeeText,
  shippingPolicyText,
  shippingQuotePending,
  shippingQuoteUnavailable,
  shippingQuoteFallbackActive,
  shippingQuoteAlertDescription,
  payableAmountText,
}) => (
  <div className="checkout-page__couponSummary">
    <div>
      <span className="checkout-page__text">
        {t('common.subtotal')}: <span className="commerce-money">{formatMoney(cartTotal)}</span>
      </span>
    </div>
    {showDiscount && discountAmount > 0 ? (
      <div>
        <span className="checkout-page__text checkout-page__text--success">
          {t('pages.checkout.couponDiscount')}: <span className="commerce-money">-{formatMoney(discountAmount)}</span>
        </span>
      </div>
    ) : null}
    <div>
      <span className="checkout-page__text">
        {t('pages.checkout.shippingFee')}:{' '}
        <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{shippingFeeText}</span>
      </span>
    </div>
    <span className="checkout-page__text checkout-page__text--secondary checkout-page__shippingPolicy">{shippingPolicyText}</span>
    {shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive ? (
      <ShopAlert
        type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}
        showIcon
        message={shippingPolicyText}
        description={shippingQuoteAlertDescription || undefined}
      />
    ) : null}
    <div>
      <span className="checkout-page__text checkout-page__text--strong checkout-page__payableTotal">
        {t('pages.checkout.payable')}:{' '}
        <span className={shippingQuoteReady ? 'commerce-money' : 'checkout-page__pendingAmount'}>{payableAmountText}</span>
      </span>
    </div>
  </div>
);

export type CheckoutCouponAndSummarySectionProps = {
  t: Translate;
  isGuestCheckout: boolean;
  formatMoney: MoneyFmt;
  cartTotal: number;
  discountAmount: number;
  couponSelectLabel: string;
  couponOptions: ShopSelectOption[];
  selectedUserCouponId: number | null;
  couponSelectionErrorMessage: string | null;
  selectedCouponName?: string | null;
  selectedIsBestCoupon: boolean;
  showCouponRulesNotMet: boolean;
  shippingQuoteReady: boolean;
  shippingFeeText: string;
  shippingPolicyText: string;
  shippingQuotePending: boolean;
  shippingQuoteUnavailable: boolean;
  shippingQuoteFallbackActive: boolean;
  shippingQuoteAlertDescription?: string | null;
  payableAmountText: string;
  onSelectCoupon: (value: string | undefined) => void;
};

export const CheckoutCouponAndSummarySection: React.FC<CheckoutCouponAndSummarySectionProps> = ({
  t,
  isGuestCheckout,
  formatMoney,
  cartTotal,
  discountAmount,
  couponSelectLabel,
  couponOptions,
  selectedUserCouponId,
  couponSelectionErrorMessage,
  selectedCouponName,
  selectedIsBestCoupon,
  showCouponRulesNotMet,
  shippingQuoteReady,
  shippingFeeText,
  shippingPolicyText,
  shippingQuotePending,
  shippingQuoteUnavailable,
  shippingQuoteFallbackActive,
  shippingQuoteAlertDescription,
  payableAmountText,
  onSelectCoupon,
}) => {
  if (!isGuestCheckout) {
    return (
      <section className="checkout-page__sectionCard" id="checkout-coupon-card" aria-label={t('pages.checkout.coupon')}>
        <div className="shop-panel__head">
          <div className="shop-panel__title">{t('pages.checkout.coupon')}</div>
        </div>
        <ShopSelect
          allowClear
          className="checkout-page__couponSelect"
          placeholder={t('pages.checkout.selectCoupon')}
          value={selectedUserCouponId != null ? String(selectedUserCouponId) : undefined}
          popupClassName="shop-mobile-popup-layer"
          popupZIndex={2400}
          ariaLabel={couponSelectLabel}
          title={couponSelectLabel}
          onChange={onSelectCoupon}
          options={couponOptions}
        />
        {couponSelectionErrorMessage ? (
          <ShopAlert
            type="warning"
            showIcon
            className="checkout-page__couponAlert"
            message={couponSelectionErrorMessage}
          />
        ) : null}
        {selectedCouponName && discountAmount > 0 ? (
          <ShopAlert
            type="success"
            showIcon
            className="checkout-page__couponAlert"
            message={selectedIsBestCoupon
              ? t('pages.checkout.bestCouponApplied', { name: selectedCouponName })
              : t('pages.checkout.couponAutoApplied', { name: selectedCouponName })}
            description={t('pages.checkout.couponSavings', { amount: formatMoney(discountAmount) })}
          />
        ) : null}
        {showCouponRulesNotMet ? (
          <div className="checkout-page__couponRules">
            <span className="checkout-page__text checkout-page__text--secondary">{t('pages.checkout.couponRulesNotMet')}</span>
          </div>
        ) : null}
        <CheckoutOrderSummaryLines
          t={t}
          cartTotal={cartTotal}
          discountAmount={discountAmount}
          showDiscount
          formatMoney={formatMoney}
          shippingQuoteReady={shippingQuoteReady}
          shippingFeeText={shippingFeeText}
          shippingPolicyText={shippingPolicyText}
          shippingQuotePending={shippingQuotePending}
          shippingQuoteUnavailable={shippingQuoteUnavailable}
          shippingQuoteFallbackActive={shippingQuoteFallbackActive}
          shippingQuoteAlertDescription={shippingQuoteAlertDescription}
          payableAmountText={payableAmountText}
        />
      </section>
    );
  }

  return (
    <section className="checkout-page__sectionCard" id="checkout-coupon-card" aria-label={t('pages.checkout.orderSummary')}>
      <div className="shop-panel__head">
        <div className="shop-panel__title">{t('pages.checkout.orderSummary')}</div>
      </div>
      <CheckoutOrderSummaryLines
        t={t}
        cartTotal={cartTotal}
        formatMoney={formatMoney}
        shippingQuoteReady={shippingQuoteReady}
        shippingFeeText={shippingFeeText}
        shippingPolicyText={shippingPolicyText}
        shippingQuotePending={shippingQuotePending}
        shippingQuoteUnavailable={shippingQuoteUnavailable}
        shippingQuoteFallbackActive={shippingQuoteFallbackActive}
        shippingQuoteAlertDescription={shippingQuoteAlertDescription}
        payableAmountText={payableAmountText}
      />
    </section>
  );
};

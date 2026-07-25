import React, { useMemo } from 'react';
import { Form } from 'antd';
import ShopBreadcrumb from '../ShopBreadcrumb';
import ShopModal from '../ShopModal';
import ShopConfirm from '../ShopConfirm';
import ShopButton from '../ShopButton';
import { ShopIcon, SI } from '../ShopIcon';
import { conversionConfig } from '../../utils/conversionConfig';
import { normalizeCheckoutPostalCode, type CheckoutValidationField } from '../../utils/checkoutHelpers';
import { productImageFallback as checkoutImageFallback, resolveProductImage as resolveCheckoutImage } from '../../utils/productMedia';
import {
  CheckoutHeroSection,
  CheckoutSummaryStrip,
  CheckoutConfirmationBand,
  CheckoutTrustBar,
  CheckoutBenefitStrip,
  CheckoutSupportCoachPanel,
} from './CheckoutConversionSections';
import {
  CheckoutItemsCard,
  CheckoutExpressPaymentGrid,
  CheckoutSubmitPaymentSection,
  CheckoutGuestContactSection,
  CheckoutAddressSection,
  CheckoutCouponAndSummarySection,
} from './CheckoutFormSections';

/** Ready-to-pay checkout form shell: hero, rails, items, address/coupon form, sticky pay. */
export type CheckoutMainShellProps = Record<string, any>;

export const CheckoutMainShell: React.FC<CheckoutMainShellProps> = (props) => {
  const {
    language,
    t,
    checkoutHeroHighlights,
    checkoutSummaryCards,
    checkoutBlockingAction,
    checkoutNextAction,
    checkoutReadinessScore,
    checkoutItemCount,
    payableAmountText,
    shippingQuoteReady,
    selectedPaymentDetail,
    submitting,
    checkoutSubmitDisabled,
    checkoutConfirmationActionLabel,
    checkoutSubmitActionLabel,
    checkoutSubmitTooltip,
    checkoutNextActionLabel,
    shippingFeeText,
    handleCheckoutNextAction,
    form,
    paymentMethodsAvailable,
    paymentChannelsError,
    paymentUnavailableRecoveryActions,
    paymentMethodDetails,
    watchedPaymentMethod,
    recommendedPaymentMethod,
    selectCheckoutPaymentMethod,
    handlePaymentMethodKeyDown,
    freeShippingRemaining,
    freeShippingPercent,
    formatMoney,
    deliveryPromise,
    giftEligible,
    giftUnlocked,
    giftRemaining,
    giftProgress,
    giftName,
    giftCelebrationOpen,
    setGiftCelebrationOpen,
    giftConfirmActionLabel,
    rollbackConfirmOpen,
    cancelingPayment,
    createdOrder,
    handleRollbackConfirm,
    setRollbackConfirmOpen,
    supportPanelOpen,
    handleSupportPanelToggle,
    savingsCoachItems,
    addOnTarget,
    cartItems,
    checkoutSavingsAddOnsActionLabel,
    scrollToAddOns,
    addSuggestedProduct,
    couponOpportunity,
    couponOpportunityActionLabel,
    handleCouponOpportunityAction,
    checkoutReadinessItems,
    checkoutReadinessActionLabel,
    checkoutCoachActionLabel,
    checkoutCartItemName,
    navigate,
    checkoutFormSnapshot,
    handleSubmit,
    closeCheckoutRegionCascader,
    updateCheckoutValidationAnnouncement,
    focusFirstCheckoutValidationError,
    mergeCheckoutFormSnapshot,
    handleCheckoutFormFocusCapture,
    handleCheckoutFormPointerDownCapture,
    checkoutStatusAnnouncement,
    checkoutValidationAnnouncement,
    isGuestCheckout,
    renderCheckoutFieldErrorExtra,
    addresses,
    addressLoadFailed,
    selectedAddressId,
    checkoutAddressGroupLabel,
    regionOptions,
    regionOptionsLoading,
    checkoutRegionInputLabel,
    checkoutRegionCascaderOpen,
    setCheckoutReloadKey,
    setSelectedAddressId,
    loadCheckoutRegionOptions,
    setCheckoutRegionCascaderVisibility,
    handleCheckoutPhoneBlur,
    cartTotal,
    discountAmount,
    checkoutCouponSelectLabel,
    checkoutCouponSelectOptions,
    selectedUserCouponId,
    couponSelectionErrorMessage,
    selectedCoupon,
    selectedIsBestCoupon,
    couponQuote,
    availableCoupons,
    calculateCouponDiscount,
    shippingPolicyText,
    shippingQuotePending,
    shippingQuoteUnavailable,
    shippingQuoteFallbackActive,
    shippingQuoteAlertDescription,
    couponAutoSelectedQuoteRef,
    setCouponManuallyChanged,
    setCouponQuoteErrorMessage,
    setCouponSelectionErrorMessage,
    setSelectedUserCouponId,
    paymentChannelsLoading,
    reloadPaymentChannels,
    openSupport,

  } = props;

  const submitButtonContent = useMemo(() => {
    if (!shippingQuoteReady) {
      return <span className="checkout-page__submitAmountPending">{shippingFeeText}</span>;
    }
    const amountText = payableAmountText;
    const label = t('pages.checkout.submitWithAmount', { amount: amountText });
    const parts = label.split(amountText);
    if (parts.length <= 1) {
      return label;
    }
    return (
      <span className="checkout-page__submitAmountLabel">
        {parts.map((part: string, index: number) => (
          <React.Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <span className="commerce-money">{amountText}</span> : null}
          </React.Fragment>
        ))}
      </span>
    );
  }, [payableAmountText, shippingFeeText, shippingQuoteReady, t]);

  return (

    <div className={`checkout-page checkout-page--${language}`}>
      <ShopBreadcrumb
        ariaLabel={t('pages.checkout.title')}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'cart', label: t('pages.cart.title'), path: '/cart' },
          { key: 'checkout', label: t('pages.checkout.title') },
        ]}
      />
      <CheckoutHeroSection t={t} highlights={checkoutHeroHighlights} />
      <CheckoutSummaryStrip cards={checkoutSummaryCards} />

      <CheckoutConfirmationBand
        t={t}
        checkoutBlockingAction={checkoutBlockingAction}
        checkoutNextAction={checkoutNextAction}
        checkoutReadinessScore={checkoutReadinessScore}
        checkoutItemCount={checkoutItemCount}
        payableAmountText={payableAmountText}
        shippingQuoteReady={shippingQuoteReady}
        selectedPaymentTitle={selectedPaymentDetail?.title}
        submitting={submitting}
        checkoutSubmitDisabled={checkoutSubmitDisabled}
        checkoutConfirmationActionLabel={checkoutConfirmationActionLabel}
        checkoutSubmitActionLabel={checkoutSubmitActionLabel}
        checkoutSubmitTooltip={checkoutSubmitTooltip}
        checkoutNextActionLabel={checkoutNextActionLabel}
        shippingFeeText={shippingFeeText}
        onNextAction={handleCheckoutNextAction}
        onSubmit={() => form.submit()}
      />

      <CheckoutTrustBar t={t} />

      <CheckoutExpressPaymentGrid
        t={t}
        paymentMethodsAvailable={paymentMethodsAvailable}
        paymentChannelsError={paymentChannelsError}
        paymentUnavailableRecoveryActions={paymentUnavailableRecoveryActions}
        paymentMethodDetails={paymentMethodDetails}
        watchedPaymentMethod={watchedPaymentMethod}
        recommendedPaymentMethod={recommendedPaymentMethod}
        onSelectMethod={selectCheckoutPaymentMethod}
        onMethodKeyDown={handlePaymentMethodKeyDown}
      />

      <CheckoutBenefitStrip
        t={t}
        freeShippingRemaining={freeShippingRemaining}
        freeShippingPercent={freeShippingPercent}
        formatMoney={formatMoney}
        deliveryPromise={deliveryPromise}
        giftEligible={giftEligible}
        giftUnlocked={giftUnlocked}
        giftRemaining={giftRemaining}
        giftProgress={giftProgress}
        giftName={giftName}
      />

      <ShopModal
        open={giftCelebrationOpen}
        title={t('pages.checkout.giftModalTitle')}
        onClose={() => setGiftCelebrationOpen(false)}
        footer={<ShopButton type="primary" aria-label={giftConfirmActionLabel} title={giftConfirmActionLabel} onClick={() => setGiftCelebrationOpen(false)}>{t('common.confirm')}</ShopButton>}
        className="profile-mobile-safe-modal checkout-page__giftCelebrationModal"
        rootClassName="checkout-page__giftCelebrationModalRoot"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        ariaLabel={t('pages.checkout.giftModalTitle')}
      >
        <div className="checkout-page__giftModal">
          <span className="checkout-page__giftIcon"><ShopIcon path={SI.gift} /></span>
          <span className="checkout-page__text">{t('pages.checkout.giftModalText', { gift: t(conversionConfig.giftAtCheckout.giftNameKey) })}</span>
        </div>
      </ShopModal>
      <ShopConfirm
        open={rollbackConfirmOpen}
        title={t('pages.checkout.rollbackPaymentTitle')}
        description={t('pages.checkout.rollbackPaymentContent')}
        okText={t('pages.checkout.rollbackPaymentAction')}
        cancelText={t('common.cancel')}
        confirmLoading={cancelingPayment}
        okButtonProps={{
          danger: true,
          'aria-label': createdOrder
            ? `${t('pages.checkout.rollbackPaymentAction')}: ${t('pages.paymentInstructions.orderNo')} ${createdOrder.orderNo || createdOrder.id}, ${formatMoney(createdOrder.totalAmount)}`
            : t('pages.checkout.rollbackPaymentAction'),
          title: createdOrder
            ? `${t('pages.checkout.rollbackPaymentAction')}: ${t('pages.paymentInstructions.orderNo')} ${createdOrder.orderNo || createdOrder.id}, ${formatMoney(createdOrder.totalAmount)}`
            : t('pages.checkout.rollbackPaymentAction'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
          title: `${t('common.cancel')}: ${t('pages.checkout.rollbackPaymentAction')}`,
        }}
        className="profile-mobile-safe-modal checkout-page__rollbackConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={handleRollbackConfirm}
        onCancel={() => { if (!cancelingPayment) setRollbackConfirmOpen(false); }}
      />

      <CheckoutSupportCoachPanel
        t={t}
        supportPanelOpen={supportPanelOpen}
        onSupportPanelToggle={handleSupportPanelToggle}
        checkoutNextAction={checkoutNextAction}
        checkoutReadinessScore={checkoutReadinessScore}
        savingsCoachItems={savingsCoachItems}
        addOnTarget={addOnTarget}
        cartProductIds={cartItems.map((item: { productId: number }) => item.productId)}
        savingsAddOnsActionLabel={checkoutSavingsAddOnsActionLabel}
        onScrollToAddOns={scrollToAddOns}
        onAddSuggestedProduct={addSuggestedProduct}
        couponOpportunity={couponOpportunity}
        couponOpportunityActionLabel={couponOpportunityActionLabel}
        onCouponOpportunityAction={handleCouponOpportunityAction}
        checkoutReadinessItems={checkoutReadinessItems}
        readinessActionLabel={checkoutReadinessActionLabel}
        coachActionLabel={checkoutCoachActionLabel}
        onNextAction={handleCheckoutNextAction}
      />

      <CheckoutItemsCard
        t={t}
        language={language}
        cartItems={cartItems}
        checkoutItemCount={checkoutItemCount}
        cartTotal={cartTotal}
        formatMoney={formatMoney}
        resolveImage={(imageUrl: string | null | undefined) => resolveCheckoutImage(imageUrl || undefined)}
        imageFallback={checkoutImageFallback}
        itemName={checkoutCartItemName}
        onOpenProduct={(productId: number) => navigate(`/products/${productId}`)}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={checkoutFormSnapshot}
        onFinish={handleSubmit}
        onFinishFailed={(info: { errorFields?: CheckoutValidationField[] }) => {
          closeCheckoutRegionCascader();
          updateCheckoutValidationAnnouncement(info.errorFields);
          focusFirstCheckoutValidationError(info.errorFields as CheckoutValidationField[]);
        }}
        onFieldsChange={(_: unknown, allFields: CheckoutValidationField[]) => updateCheckoutValidationAnnouncement(allFields)}
        onValuesChange={(changedValues: Record<string, unknown>) => {
          mergeCheckoutFormSnapshot(changedValues, true);
        }}
        onFocusCapture={handleCheckoutFormFocusCapture}
        onPointerDownCapture={handleCheckoutFormPointerDownCapture}
      >
        {/* status live region */}
        <div
          className="checkout-page__statusLiveRegion"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t('pages.checkout.statusAnnouncementLabel')}
        >
          {checkoutStatusAnnouncement ? (
            <span key={checkoutStatusAnnouncement.id}>{checkoutStatusAnnouncement.text}</span>
          ) : null}
        </div>
        <div
          className="checkout-page__validationLiveRegion"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={t('pages.checkout.validationErrorAnnouncementLabel')}
        >
          {checkoutValidationAnnouncement}
        </div>
        {isGuestCheckout ? (
          <CheckoutGuestContactSection
            t={t}
            fieldErrorExtra={renderCheckoutFieldErrorExtra}
          />
        ) : null}

        <CheckoutAddressSection
          t={t}
          addresses={addresses}
          addressLoadFailed={addressLoadFailed}
          selectedAddressId={selectedAddressId}
          addressGroupLabel={checkoutAddressGroupLabel}
          regionOptions={regionOptions}
          regionOptionsLoading={regionOptionsLoading}
          regionInputLabel={checkoutRegionInputLabel}
          regionCascaderOpen={checkoutRegionCascaderOpen}
          fieldErrorExtra={renderCheckoutFieldErrorExtra}
          onRetryAddressLoad={() => setCheckoutReloadKey((key: number) => key + 1)}
          onSelectAddress={setSelectedAddressId}
          onRegionOpenChange={(open: boolean) => {
            if (open) void loadCheckoutRegionOptions();
            setCheckoutRegionCascaderVisibility(open);
          }}
          onPhoneBlur={handleCheckoutPhoneBlur}
          onPostalCodeBlur={(event: { target: { value: string } }) => form.setFieldValue('postalCode', normalizeCheckoutPostalCode(event.target.value))}
        />

        <CheckoutCouponAndSummarySection
          t={t}
          isGuestCheckout={isGuestCheckout}
          formatMoney={formatMoney}
          cartTotal={cartTotal}
          discountAmount={discountAmount}
          couponSelectLabel={checkoutCouponSelectLabel}
          couponOptions={checkoutCouponSelectOptions}
          selectedUserCouponId={selectedUserCouponId}
          couponSelectionErrorMessage={couponSelectionErrorMessage}
          selectedCouponName={selectedCoupon?.couponName}
          selectedIsBestCoupon={selectedIsBestCoupon}
          showCouponRulesNotMet={Boolean(couponQuote && availableCoupons.length > 0 && !availableCoupons.some((coupon: unknown) => calculateCouponDiscount(coupon) > 0))}
          shippingQuoteReady={shippingQuoteReady}
          shippingFeeText={shippingFeeText}
          shippingPolicyText={shippingPolicyText}
          shippingQuotePending={shippingQuotePending}
          shippingQuoteUnavailable={shippingQuoteUnavailable}
          shippingQuoteFallbackActive={shippingQuoteFallbackActive}
          shippingQuoteAlertDescription={shippingQuoteAlertDescription}
          payableAmountText={payableAmountText}
          onSelectCoupon={(value: string | number | null | undefined) => {
            couponAutoSelectedQuoteRef.current = null;
            setCouponManuallyChanged(true);
            setCouponQuoteErrorMessage(null);
            setCouponSelectionErrorMessage(null);
            setSelectedUserCouponId(value ? Number(value) : null);
          }}
        />


        <CheckoutSubmitPaymentSection
          t={t}
          paymentMethodsAvailable={paymentMethodsAvailable}
          paymentChannelsError={paymentChannelsError}
          paymentUnavailableRecoveryActions={paymentUnavailableRecoveryActions}
          selectedPaymentTitle={selectedPaymentDetail?.title}
          checkoutItemCount={checkoutItemCount}
          payableAmountText={payableAmountText}
          shippingQuoteReady={shippingQuoteReady}
          submitting={submitting}
          checkoutSubmitDisabled={checkoutSubmitDisabled}
          checkoutSubmitActionLabel={checkoutSubmitActionLabel}
          checkoutSubmitTooltip={checkoutSubmitTooltip}
          submitButtonContent={submitButtonContent}
          checkoutBlockingAction={checkoutBlockingAction}
          checkoutNextAction={checkoutNextAction}
          checkoutCoachActionLabel={checkoutCoachActionLabel}
          checkoutNextActionLabel={checkoutNextActionLabel}
          checkoutConfirmationActionLabel={checkoutConfirmationActionLabel}
          paymentChannelsLoading={paymentChannelsLoading}
          onReloadPaymentChannels={reloadPaymentChannels}
          onOpenSupport={openSupport}
          onCart={() => navigate('/cart')}
          onBrowse={() => navigate('/products')}
          onCoupons={() => navigate('/coupons')}
          onNextAction={handleCheckoutNextAction}
        />
      </Form>
    </div>
  
  );
};

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { ShopIcon, SI } from '../components/ShopIcon';
import ShopButton from '../components/ShopButton';
import ShopConfirm from '../components/ShopConfirm';
import PageEmpty from '../components/PageEmpty';
import { buildLoginUrl } from '../utils/authRedirect';
import { handleRovingTablistKeyDown } from '../utils/tablistKeyboard';
import {
  PROFILE_MOBILE_ENTRY_TAB_KEYS,
  PROFILE_TAB_KEYS,
  profileOrderLabel,
} from '../utils/profileHelpers';
import { ProfileOrdersPanel } from './profileOrdersPanel';
import { ProfileAddressesPanel } from './profileAddressesPanel';
import { ProfilePetsPanel } from './profilePetsPanel';
import { ProfileOrderDetailModal } from './profileOrderDetailModal';
import { ProfileReturnModals } from './profileReturnModals';
import { ProfilePaymentModal } from './profilePaymentModal';
import { ProfileInfoPanel } from './profileInfoPanel';
import { ProfileAccountModals } from './profileAccountModals';

type ProfileTranslate = (key: string, params?: Record<string, string | number>) => string;

export type ProfileAuthGateShellProps = {
  language: string;
  t: ProfileTranslate;
  navigate: NavigateFunction;
};

export const ProfileAuthGateShell: React.FC<ProfileAuthGateShellProps> = ({ language, t, navigate }) => (

  <div
    className={`profile-page profile-page--${language} profile-page--empty profile-page--authGate`}
    data-auth-gate="profile-login-required"
  >
    <PageEmpty
      className="profile-page__authGate"
      description={(
        <div className="profile-page__authGateCopy">
          <h1 className="profile-page__title">{t('pages.profile.authGateTitle')}</h1>
          <div className="profile-page__authGateHint">{t('pages.profile.authGateHint')}</div>
        </div>
      )}
      actions={[
        {
          key: 'login',
          label: t('pages.profile.authGateLogin'),
          onClick: () => navigate(buildLoginUrl('/profile')),
        },
        {
          key: 'register',
          label: t('pages.profile.authGateRegister'),
          onClick: () => navigate('/register?redirect=%2Fprofile'),
          type: 'default',
        },
        {
          key: 'orders',
          label: t('pages.profile.authGateTrackOrder'),
          onClick: () => navigate('/track-order'),
          type: 'default',
        },
        {
          key: 'browse',
          label: t('pages.cart.browse'),
          onClick: () => navigate('/products'),
          type: 'default',
        },
        {
          key: 'coupons',
          label: t('pages.profile.emptyOrdersCoupons'),
          onClick: () => navigate('/coupons'),
          type: 'default',
        },
      ]}
    />
  </div>

);

export type ProfileLoadingShellProps = {
  t: ProfileTranslate;
};

export const ProfileLoadingShell: React.FC<ProfileLoadingShellProps> = ({ t }) => (

  <div className="profile-loading" role="status" aria-live="polite" aria-busy="true" aria-label={t('common.loading')}>
    <span className="profile-page__spinner" aria-hidden="true" />
    <span>{t('common.loading')}</span>
  </div>

);

/** Authenticated profile chrome + tab panels + modals. Page owns data/handlers. */
export type ProfileMainShellProps = Record<string, any>;

export const ProfileMainShell: React.FC<ProfileMainShellProps> = (props) => {
  const {
    language,
    t,
    user,
    defaultAddressReady,
    petProfileFocusText,
    addressReadinessText,
    openProfileTab,
    openAddressSetup,
    orders,
    petProfiles,
    addresses,
    accountHealthScore,
    profilePendingPayActionLabel,
    pendingPaymentCount,
    openOrdersWithFilter,
    profileInTransitActionLabel,
    inTransitCount,
    profileAfterSaleActionLabel,
    afterSaleCount,
    profileCompletionActionLabel,
    petProfileProgress,
    profileActiveTab,
    openEditModal,
    setPasswordModalVisible,
    addressReadinessProgress,
    addressesLoadFailed,
    addressesMissingDetailCount,
    addressesMissingPhoneCount,
    addressesStale,
    fetchAddresses,
    handleDeleteAddress,
    handleSetDefault,
    navigate,
    openAddressModal,
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
    handleDeletePet,
    openPetModal,
    openPetShoppingPath,
    petCompletenessText,
    petProfileFocus,
    petSizeLabel,
    petTypeLabel,
    petsMissingBirthdayCount,
    petsMissingFitCount,
    profilePetShoppingFocus,
    addressForm,
    addressModalVisible,
    addressPhoneInputLabel,
    addressRegionInputLabel,
    addressSubmitting,
    changePasswordActionLabel,
    closeAddressModal,
    closePasswordModal,
    closePetModal,
    editForm,
    editModalVisible,
    editProfileActionLabel,
    editingAddress,
    editingPet,
    emailCodeEnabled,
    handleChangePassword,
    handleEditProfile,
    handleSaveAddress,
    handleSavePet,
    handleSendProfileEmailCode,
    loadProfileRegionOptions,
    passwordForm,
    passwordModalVisible,
    passwordSubmitting,
    petForm,
    petModalVisible,
    petSubmitting,
    profileEmailChanged,
    profileEmailCodeCountdown,
    profileEmailCodeSending,
    profileEmailCodeSentTo,
    profileEmailCodeTtlMinutes,
    profilePhoneInputLabel,
    profileSubmitting,
    regionOptions,
    regionOptionsLoading,
    saveAddressActionLabel,
    savePetActionLabel,
    setAddressModalVisible,
    setEditModalVisible,
    setEditingAddress,
    setEditingPet,
    setPetModalVisible,
    setProfileEmailCodeCountdown,
    setProfileEmailCodeSentTo,
    formatPaymentStatusLabel,
    getPaymentStatusColor,
    handleReorder,
    handleReturnOrder,
    orderDetailVisible,
    orderItems,
    orderPayments,
    reorderSelectedOrderActionLabel,
    reordering,
    selectedOrder,
    selectedOrderTrackActionLabel,
    setOrderDetailVisible,
    handleSubmitReturnShipment,
    requestingReturn,
    returnReason,
    returnReasonInputLabel,
    returnRequestOrder,
    returnShipmentOrder,
    returnTrackingInputLabel,
    returnTrackingNumber,
    setReturnReason,
    setReturnRequestOrder,
    setTrackingVisible,
    submitReturnRequestActionLabel,
    submitReturnShipmentActionLabel,
    submittingReturnShipment,
    selectedTrackingCarrierCode,
    selectedTrackingNumber,
    selectedTrackingOrderId,
    trackingVisible,
    closePaymentActionLabel,
    handleRefreshPayment,
    loadPaymentChannels,
    openPaymentActionLabel,
    paymentChannelsError,
    paymentChannelsLoading,
    paymentLinkActionLabel,
    paymentMethodSelectLabel,
    paymentModalVisible,
    paymentOptions,
    refreshPaymentActionLabel,
    refreshingPayment,
    retryPaymentChannelsActionLabel,
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
    confirmingReceipt,
    handleConfirmReceipt,
    receiptConfirmOrder,
    setReceiptConfirmOrder,

  } = props;

  return (

    <div className={`profile-page profile-page--${language}`}>
      <div className="profile-overview">
        <div className="profile-overview__copy">
          <span className="profile-page__text profile-overview__eyebrow">{t('pages.profile.title')}</span>
          <h1 className="profile-page__title">{user.username}</h1>
          <span className="profile-page__text profile-overview__text">
            {defaultAddressReady ? petProfileFocusText : addressReadinessText}
          </span>
          <div className="profile-overview__actions">
            <ShopButton type="primary" onClick={() => openProfileTab('orders')}>
              {t('pages.profile.orders', { count: orders.length })}
            </ShopButton>
            <ShopButton onClick={() => (defaultAddressReady ? openProfileTab('pets') : openAddressSetup())}>
              {defaultAddressReady
                ? (petProfiles.length > 0 ? t('pages.profile.completePetProfile') : t('pages.profile.addPet'))
                : t('pages.profile.addAddress')}
            </ShopButton>
          </div>
        </div>
        <div className="profile-overview__stats" aria-label={t('pages.profile.actionCenterTitle')}>
          <div className="profile-overview__stat">
            <strong>{orders.length}</strong>
            <span>{t('pages.profile.allOrders')}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{addresses.length}</strong>
            <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{petProfiles.length}</strong>
            <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
          </div>
          <div className="profile-overview__stat">
            <strong>{accountHealthScore}%</strong>
            <span>{t('pages.profile.accountHealthTitle')}</span>
          </div>
        </div>
      </div>

      <div className="profile-action-center" aria-label={t('pages.profile.actionCenterTitle')}>
        <div className="profile-action-center__intro">
          <ShopIcon path={SI.user} />
          <div>
            <span className="profile-page__text profile-page__text--strong">{t('pages.profile.actionCenterTitle')}</span>
            <span className="profile-page__text profile-page__text--secondary">{t('pages.profile.actionCenterSubtitle')}</span>
          </div>
        </div>
        <div className="profile-action-center__cards">
          <button type="button" className="profile-action-center__card profile-action-center__card--pay" aria-label={profilePendingPayActionLabel} title={profilePendingPayActionLabel} onClick={() => openOrdersWithFilter('PENDING_PAYMENT')}>
            <ShopIcon path={SI.cart} />
            <span>
              <strong>{pendingPaymentCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionPendingPay')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" aria-label={profileInTransitActionLabel} title={profileInTransitActionLabel} onClick={() => openOrdersWithFilter('SHIPPED')}>
            <ShopIcon path={SI.environment} />
            <span>
              <strong>{inTransitCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionInTransit')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card profile-action-center__card--return" aria-label={profileAfterSaleActionLabel} title={profileAfterSaleActionLabel} onClick={() => openOrdersWithFilter('AFTER_SALE')}>
            <ShopIcon path={SI.heart} />
            <span>
              <strong>{afterSaleCount}</strong>
              <span className="profile-page__text">{t('pages.profile.actionAfterSale')}</span>
            </span>
          </button>
          <button type="button" className="profile-action-center__card" aria-label={profileCompletionActionLabel} title={profileCompletionActionLabel} onClick={() => (defaultAddressReady ? openProfileTab('pets') : openAddressSetup())}>
            {defaultAddressReady ? <ShopIcon path={SI.heart} /> : <ShopIcon path={SI.environment} />}
            <span>
              <strong>{defaultAddressReady ? `${petProfileProgress}%` : '!'}</strong>
              <span className="profile-page__text">{defaultAddressReady ? t('pages.profile.actionPetProfile') : t('pages.profile.actionDefaultAddress')}</span>
            </span>
          </button>
        </div>
      </div>

      <div className="profile-mobile-entry" role="tablist" aria-orientation="horizontal" aria-label={t('pages.profile.title')}>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-orders"
          className={profileActiveTab === 'orders' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'orders'}
          tabIndex={profileActiveTab === 'orders' ? 0 : -1}
          onClick={() => openProfileTab('orders')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.cart} />
          <span>{t('pages.profile.orders', { count: orders.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-addresses"
          className={profileActiveTab === 'addresses' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'addresses'}
          tabIndex={profileActiveTab === 'addresses' ? 0 : -1}
          onClick={() => openProfileTab('addresses')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.environment} />
          <span>{t('pages.profile.addresses', { count: addresses.length })}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-info"
          className={profileActiveTab === 'info' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'info'}
          tabIndex={profileActiveTab === 'info' ? 0 : -1}
          onClick={() => openProfileTab('info')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.user} />
          <span>{t('pages.profile.info')}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="profile-mobile-tab-pets"
          className={profileActiveTab === 'pets' ? 'profile-mobile-entry__item profile-mobile-entry__item--active' : 'profile-mobile-entry__item'}
          aria-selected={profileActiveTab === 'pets'}
          tabIndex={profileActiveTab === 'pets' ? 0 : -1}
          onClick={() => openProfileTab('pets')}
          onKeyDown={(event) => {
            handleRovingTablistKeyDown(event, {
              tabKeys: PROFILE_MOBILE_ENTRY_TAB_KEYS as unknown as string[],
              activeKey: profileActiveTab,
              onActivate: openProfileTab,
              getTabElementId: (key) => `profile-mobile-tab-${key}`,
            });
          }}
        >
          <ShopIcon path={SI.heart} />
          <span>{t('pages.profile.pets', { count: petProfiles.length })}</span>
        </button>
      </div>

      <div className="profile-tabs">
        <div
          className="profile-tabs__nav"
          role="tablist"
          aria-orientation="horizontal"
          aria-label={t('pages.profile.title')}
        >
          <button
            type="button"
            role="tab"
            id="profile-tab-info"
            className={profileActiveTab === 'info' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'info'}
            aria-controls="profile-panel-info"
            tabIndex={profileActiveTab === 'info' ? 0 : -1}
            onClick={() => openProfileTab('info')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.info')}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-addresses"
            className={profileActiveTab === 'addresses' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'addresses'}
            aria-controls="profile-panel-addresses"
            tabIndex={profileActiveTab === 'addresses' ? 0 : -1}
            onClick={() => openProfileTab('addresses')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.addresses', { count: addresses.length })}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-orders"
            className={profileActiveTab === 'orders' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'orders'}
            aria-controls="profile-panel-orders"
            tabIndex={profileActiveTab === 'orders' ? 0 : -1}
            onClick={() => openProfileTab('orders')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.orders', { count: orders.length })}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-pets"
            className={profileActiveTab === 'pets' ? 'profile-tabs__tab profile-tabs__tab--active' : 'profile-tabs__tab'}
            aria-selected={profileActiveTab === 'pets'}
            aria-controls="profile-panel-pets"
            tabIndex={profileActiveTab === 'pets' ? 0 : -1}
            onClick={() => openProfileTab('pets')}
            onKeyDown={(event) => {
              handleRovingTablistKeyDown(event, {
                tabKeys: PROFILE_TAB_KEYS as unknown as string[],
                activeKey: profileActiveTab,
                onActivate: openProfileTab,
                getTabElementId: (key) => `profile-tab-${key}`,
              });
            }}
          >
            <span className="profile-tabs__tabLabel">{t('pages.profile.pets', { count: petProfiles.length })}</span>
          </button>
        </div>
        <div className="profile-tabs__panels">
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-info"
          aria-labelledby="profile-tab-info"
          hidden={profileActiveTab !== 'info'}
        >
          <ProfileInfoPanel
            accountHealthScore={accountHealthScore}
            addresses={addresses}
            defaultAddressReady={defaultAddressReady}
            openEditModal={openEditModal}
            petProfiles={petProfiles}
            setPasswordModalVisible={setPasswordModalVisible}
            t={t}
            user={user}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-addresses"
          aria-labelledby="profile-tab-addresses"
          hidden={profileActiveTab !== 'addresses'}
        >
          <ProfileAddressesPanel
            addressReadinessProgress={addressReadinessProgress}
            addressReadinessText={addressReadinessText}
            addresses={addresses}
            addressesLoadFailed={addressesLoadFailed}
            addressesMissingDetailCount={addressesMissingDetailCount}
            addressesMissingPhoneCount={addressesMissingPhoneCount}
            addressesStale={addressesStale}
            defaultAddressReady={defaultAddressReady}
            fetchAddresses={fetchAddresses}
            handleDeleteAddress={handleDeleteAddress}
            handleSetDefault={handleSetDefault}
            navigate={navigate}
            openAddressModal={openAddressModal}
            t={t}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-orders"
          aria-labelledby="profile-tab-orders"
          hidden={profileActiveTab !== 'orders'}
        >
          <ProfileOrdersPanel
            afterSaleCount={afterSaleCount}
            afterSaleFocusText={afterSaleFocusText}
            afterSaleStatuses={afterSaleStatuses}
            confirmReceiptOrder={confirmReceiptOrder}
            dateLocale={dateLocale}
            fetchOrders={fetchOrders}
            filteredOrders={filteredOrders}
            formatMoney={formatMoney}
            formatOrderStatusLabel={formatOrderStatusLabel}
            getOrderActionHint={getOrderActionHint}
            getOrderStatusColor={getOrderStatusColor}
            handleCancelOrder={handleCancelOrder}
            handleContinuePayment={handleContinuePayment}
            handleTrackShipment={handleTrackShipment}
            handleViewOrder={handleViewOrder}
            isPaymentReturnIncomplete={isPaymentReturnIncomplete}
            isPaymentReturnSuccess={isPaymentReturnSuccess}
            isReturnableOrder={isReturnableOrder}
            language={language}
            navigate={navigate}
            openProductDetail={openProductDetail}
            openReturnModal={openReturnModal}
            openSupport={openSupport}
            orderItemPreviewFailedByOrderId={orderItemPreviewFailedByOrderId}
            orderItemsByOrderId={orderItemsByOrderId}
            orderListContextLabel={orderListContextLabel}
            orderSearchInputLabel={orderSearchInputLabel}
            orderSearchText={orderSearchText}
            orderStatusFilter={orderStatusFilter}
            orderStatusTabs={orderStatusTabs}
            orders={orders}
            ordersLoadFailed={ordersLoadFailed}
            ordersStale={ordersStale}
            payingOrderId={payingOrderId}
            paymentReturnOrderNo={paymentReturnOrderNo}
            paymentReturnStatus={paymentReturnStatus}
            profileOrderItemName={profileOrderItemName}
            returnApprovedCount={returnApprovedCount}
            returnableOrdersCount={returnableOrdersCount}
            setOrderSearchText={setOrderSearchText}
            setOrderStatusFilter={setOrderStatusFilter}
            setReturnShipmentOrder={setReturnShipmentOrder}
            setReturnTrackingNumber={setReturnTrackingNumber}
            t={t}
          />
        </div>
        <div
          className="profile-tabs__panel"
          role="tabpanel"
          id="profile-panel-pets"
          aria-labelledby="profile-tab-pets"
          hidden={profileActiveTab !== 'pets'}
        >
          <ProfilePetsPanel
            handleDeletePet={handleDeletePet}
            navigate={navigate}
            openPetModal={openPetModal}
            openPetShoppingPath={openPetShoppingPath}
            petCompletenessText={petCompletenessText}
            petProfileFocus={petProfileFocus}
            petProfileFocusText={petProfileFocusText}
            petProfileProgress={petProfileProgress}
            petProfiles={petProfiles}
            petSizeLabel={petSizeLabel}
            petTypeLabel={petTypeLabel}
            petsMissingBirthdayCount={petsMissingBirthdayCount}
            petsMissingFitCount={petsMissingFitCount}
            profilePetShoppingFocus={profilePetShoppingFocus}
            t={t}
          />
        </div>
        </div>
      </div>

      <ProfileAccountModals
        addressForm={addressForm}
        addressModalVisible={addressModalVisible}
        addressPhoneInputLabel={addressPhoneInputLabel}
        addressRegionInputLabel={addressRegionInputLabel}
        addressSubmitting={addressSubmitting}
        changePasswordActionLabel={changePasswordActionLabel}
        closeAddressModal={closeAddressModal}
        closePasswordModal={closePasswordModal}
        closePetModal={closePetModal}
        editForm={editForm}
        editModalVisible={editModalVisible}
        editProfileActionLabel={editProfileActionLabel}
        editingAddress={editingAddress}
        editingPet={editingPet}
        emailCodeEnabled={emailCodeEnabled}
        handleChangePassword={handleChangePassword}
        handleEditProfile={handleEditProfile}
        handleSaveAddress={handleSaveAddress}
        handleSavePet={handleSavePet}
        handleSendProfileEmailCode={handleSendProfileEmailCode}
        loadProfileRegionOptions={loadProfileRegionOptions}
        passwordForm={passwordForm}
        passwordModalVisible={passwordModalVisible}
        passwordSubmitting={passwordSubmitting}
        petForm={petForm}
        petModalVisible={petModalVisible}
        petSubmitting={petSubmitting}
        profilePhoneInputLabel={profilePhoneInputLabel}
        profileEmailChanged={profileEmailChanged}
        profileEmailCodeCountdown={profileEmailCodeCountdown}
        profileEmailCodeSending={profileEmailCodeSending}
        profileEmailCodeSentTo={profileEmailCodeSentTo}
        profileEmailCodeTtlMinutes={profileEmailCodeTtlMinutes}
        profileSubmitting={profileSubmitting}
        regionOptions={regionOptions}
        regionOptionsLoading={regionOptionsLoading}
        saveAddressActionLabel={saveAddressActionLabel}
        savePetActionLabel={savePetActionLabel}
        setAddressModalVisible={setAddressModalVisible}
        setEditModalVisible={setEditModalVisible}
        setEditingAddress={setEditingAddress}
        setEditingPet={setEditingPet}
        setPasswordModalVisible={setPasswordModalVisible}
        setPetModalVisible={setPetModalVisible}
        setProfileEmailCodeCountdown={setProfileEmailCodeCountdown}
        setProfileEmailCodeSentTo={setProfileEmailCodeSentTo}
        t={t}
        user={user}
      />

      <ProfileOrderDetailModal
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        formatOrderStatusLabel={formatOrderStatusLabel}
        getOrderStatusColor={getOrderStatusColor}
        handleReorder={handleReorder}
        handleTrackShipment={handleTrackShipment}
        language={language}
        openProductDetail={openProductDetail}
        orderDetailVisible={orderDetailVisible}
        orderItems={orderItems}
        profileOrderItemName={profileOrderItemName}
        reorderSelectedOrderActionLabel={reorderSelectedOrderActionLabel}
        reordering={reordering}
        selectedOrder={selectedOrder}
        selectedOrderTrackActionLabel={selectedOrderTrackActionLabel}
        setOrderDetailVisible={setOrderDetailVisible}
        t={t}
      />

      <ProfileReturnModals
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        handleReturnOrder={handleReturnOrder}
        handleSubmitReturnShipment={handleSubmitReturnShipment}
        requestingReturn={requestingReturn}
        returnReason={returnReason}
        returnReasonInputLabel={returnReasonInputLabel}
        returnRequestOrder={returnRequestOrder}
        returnShipmentOrder={returnShipmentOrder}
        returnTrackingInputLabel={returnTrackingInputLabel}
        returnTrackingNumber={returnTrackingNumber}
        selectedTrackingCarrierCode={selectedTrackingCarrierCode}
        selectedTrackingNumber={selectedTrackingNumber}
        selectedTrackingOrderId={selectedTrackingOrderId}
        setReturnReason={setReturnReason}
        setReturnRequestOrder={setReturnRequestOrder}
        setReturnShipmentOrder={setReturnShipmentOrder}
        setReturnTrackingNumber={setReturnTrackingNumber}
        setTrackingVisible={setTrackingVisible}
        submitReturnRequestActionLabel={submitReturnRequestActionLabel}
        submitReturnShipmentActionLabel={submitReturnShipmentActionLabel}
        submittingReturnShipment={submittingReturnShipment}
        t={t}
        trackingVisible={trackingVisible}
      />

      <ProfilePaymentModal
        closePaymentActionLabel={closePaymentActionLabel}
        dateLocale={dateLocale}
        formatMoney={formatMoney}
        formatPaymentStatusLabel={formatPaymentStatusLabel}
        getPaymentStatusColor={getPaymentStatusColor}
        handleRefreshPayment={handleRefreshPayment}
        loadPaymentChannels={loadPaymentChannels}
        navigate={navigate}
        openPaymentActionLabel={openPaymentActionLabel}
        orderPayments={orderPayments}
        paymentChannelsError={paymentChannelsError}
        paymentChannelsLoading={paymentChannelsLoading}
        paymentLinkActionLabel={paymentLinkActionLabel}
        paymentMethodSelectLabel={paymentMethodSelectLabel}
        paymentModalVisible={paymentModalVisible}
        paymentOptions={paymentOptions}
        refreshPaymentActionLabel={refreshPaymentActionLabel}
        refreshingPayment={refreshingPayment}
        retryPaymentChannelsActionLabel={retryPaymentChannelsActionLabel}
        selectedOrder={selectedOrder}
        selectedPayment={selectedPayment}
        selectedPaymentExpiredOrFailed={selectedPaymentExpiredOrFailed}
        selectedPaymentFailed={selectedPaymentFailed}
        selectedPaymentMethod={selectedPaymentMethod}
        selectedPaymentMethodDetail={selectedPaymentMethodDetail}
        selectedPaymentPaid={selectedPaymentPaid}
        selectedPaymentReconcileRequired={selectedPaymentReconcileRequired}
        selectedPaymentRecovery={selectedPaymentRecovery}
        setPaymentModalVisible={setPaymentModalVisible}
        setSelectedPaymentMethod={setSelectedPaymentMethod}
        t={t}
      />
      <ShopConfirm
        open={Boolean(receiptConfirmOrder)}
        title={t('pages.profile.confirmReceiptTitle')}
        description={receiptConfirmOrder ? t('pages.profile.confirmReceiptContent', { orderNo: receiptConfirmOrder.orderNo || receiptConfirmOrder.id }) : undefined}
        okText={t('pages.profile.confirmReceipt')}
        cancelText={t('common.cancel')}
        confirmLoading={confirmingReceipt}
        okButtonProps={{
          'aria-label': receiptConfirmOrder ? `${t('pages.profile.confirmReceipt')}: ${profileOrderLabel(receiptConfirmOrder)}` : t('pages.profile.confirmReceipt'),
          title: receiptConfirmOrder ? `${t('pages.profile.confirmReceipt')}: ${profileOrderLabel(receiptConfirmOrder)}` : t('pages.profile.confirmReceipt'),
        }}
        cancelButtonProps={{
          'aria-label': `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
          title: `${t('common.cancel')}: ${t('pages.profile.confirmReceipt')}`,
        }}
        className="profile-mobile-safe-modal profile-page__receiptConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={() => receiptConfirmOrder ? handleConfirmReceipt(receiptConfirmOrder.id) : undefined}
        onCancel={() => { if (!confirmingReceipt) setReceiptConfirmOrder(null); }}
      />
    </div>
  
  );
};

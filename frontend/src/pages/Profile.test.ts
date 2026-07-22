import fs from 'fs';
import path from 'path';

const readProfileSource = () => fs.readFileSync(path.resolve(__dirname, 'Profile.tsx'), 'utf8');
const readProfileCss = () => fs.readFileSync(path.resolve(__dirname, 'Profile.css'), 'utf8');
const readLocale = (locale: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../locales/${locale}.json`), 'utf8'));

describe('Profile mobile control visibility', () => {
  it('uses the shared strong password policy for profile password changes', () => {
    const source = readProfileSource();

    expect(source).toContain("from '../utils/passwordPolicy'");
    expect(source).toContain('STRONG_PASSWORD_MIN_LENGTH');
    expect(source).toContain('STRONG_PASSWORD_MAX_LENGTH');
    expect(source).toContain('isCommonPassword(value)');
    expect(source).toContain('hasRequiredPasswordClasses(value)');
    expect(source).toContain("t('pages.profile.newPasswordCommon')");
  });

  it('keeps profile recoverable error handling typed without broad any usage', () => {
    const source = readProfileSource();

    expect(source).toContain('const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(source).toContain('const getProfileApiErrorData = (error: unknown): Record<string, unknown> =>');
    expect(source).toContain('const getProfileApiErrorCode = (error: unknown) =>');
    expect(source).toContain('if (isFormValidationError(err)) {');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('err?.errorFields');
    expect(source).not.toContain('err.response?.data');
    expect(source).not.toContain('catch (err: any)');
  });

  it('uses localized profile address copy instead of stale AddressManager literals', () => {
    const source = readProfileSource();

    expect(source).not.toContain('AddressManager');
    expect(source).not.toContain('data-testid="add-address-button"');
    expect(source).not.toContain('添加新地址');
    expect(source).toContain("{t('pages.profile.addAddress')}");
    expect(source).toContain("title={editingAddress ? t('pages.profile.editAddressTitle') : t('pages.profile.addAddressTitle')}");

    for (const locale of ['en', 'zh', 'es']) {
      const messages = readLocale(locale);
      expect(messages.pages.profile.addAddress).toBeTruthy();
      expect(messages.pages.profile.addAddressTitle).toBeTruthy();
      expect(messages.pages.profile.noAddresses).toBeTruthy();
      expect(messages.pages.profile.regionLoadFailed).toBeTruthy();
    }
  });

  it('lazy-loads address region options instead of importing the full region dataset into Profile', () => {
    const source = readProfileSource();

    expect(source).toContain('loadProfileRegionOptions');
    expect(source).toContain('loadRegionData');
    expect(source).toContain('options={regionOptions}');
    expect(source).toContain('findRegionPath(address.address, options)');
    expect(source).not.toContain('regionData }');
  });

  it('keeps address and pet editor popups above mobile modal content', () => {
    const source = readProfileSource();
    const css = readProfileCss();
    const f3539Css = css.slice(css.indexOf('/* F3539'));

    expect(source).toContain("const profileModalPopupClassNames = { popup: { root: 'shop-mobile-popup-layer profile-modal-popup' } };");
    expect(source).toContain('<Cascader');
    expect(source).toContain('<DatePicker className="profile-pet-modal__field"');
    expect(source.match(/classNames=\{profileModalPopupClassNames\}/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/placement="bottomLeft"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/getPopupContainer=\{\(\) => document\.body\}/g)?.length).toBeGreaterThanOrEqual(4);

    expect(f3539Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer\s*\{[\s\S]*?z-index:\s*12050\s*!important;[\s\S]*?pointer-events:\s*auto\s*!important;/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer\.ant-select-dropdown,[\s\S]*?body \.profile-modal-popup\.shop-mobile-popup-layer\.ant-cascader-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?max-height:\s*min\(320px,\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\)\s*!important;/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer\.ant-picker-dropdown\s*\{[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?top:\s*max\(12px,\s*env\(safe-area-inset-top,\s*0px\)\)\s*!important;[\s\S]*?bottom:\s*auto\s*!important;[\s\S]*?max-height:\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer \.ant-select-item-option-content,[\s\S]*?body \.profile-modal-popup\.shop-mobile-popup-layer \.ant-cascader-menu-item-content\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?word-break:\s*break-word\s*!important;/);
  });

  it('keeps primary account actions, section tabs, and order filters out of hidden rails', () => {
    const source = readProfileSource();
    const css = readProfileCss();
    const fixCss = css.slice(css.indexOf('F3516:'));

    expect(source).toContain('profile-action-center__cards');
    expect(source).toContain('profile-mobile-entry');
    expect(source).toContain('profile-orders__tabs');
    expect(source).toContain("t('pages.profile.actionAfterSale')");
    expect(source).toContain("t('pages.profile.pets'");
    expect(source).toContain("key: 'RETURNABLE'");
    expect(source).toContain("key: 'AFTER_SALE'");
    expect(fixCss).toMatch(/\.profile-action-center__cards,\s*\.profile-mobile-entry,\s*\.profile-orders__tabs\s*\{[\s\S]*?overflow-x:\s*visible\s*!important;[\s\S]*?scroll-snap-type:\s*none\s*!important;[\s\S]*?mask-image:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.profile-action-center__cards\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(fixCss).toMatch(/\.profile-mobile-entry\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(fixCss).toMatch(/\.profile-orders__tabs\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?border-bottom:\s*0\s*!important;/);
    expect(fixCss).not.toMatch(/F3516:[\s\S]*?overflow-x:\s*auto/);
    expect(fixCss).not.toMatch(/F3516:[\s\S]*?scrollbar-width:\s*none/);
  });

  it('names the order item preview fetch limit instead of slicing with a raw page size', () => {
    const source = readProfileSource();
    const fetchOrdersStart = source.indexOf('const fetchOrders = useCallback(async () => {');
    const fetchOrdersSource = source.slice(fetchOrdersStart, source.indexOf('const syncPaymentReturnState', fetchOrdersStart));

    expect(source).toContain('const PROFILE_ORDER_ITEM_PREVIEW_LIMIT = 30;');
    expect(fetchOrdersSource).toContain('sortedOrders.slice(0, PROFILE_ORDER_ITEM_PREVIEW_LIMIT)');
    expect(fetchOrdersSource).not.toContain('sortedOrders.slice(0, 20)');
    expect(fetchOrdersSource).not.toContain('sortedOrders.slice(0, 30)');
  });

  it('shows retryable order item preview failures instead of empty order items', () => {
    const source = readProfileSource();
    const fetchOrdersStart = source.indexOf('const fetchOrders = useCallback(async () => {');
    const fetchOrdersSource = source.slice(fetchOrdersStart, source.indexOf('const syncPaymentReturnState', fetchOrdersStart));

    expect(source).toContain('const [orderItemPreviewFailedByOrderId, setOrderItemPreviewFailedByOrderId]');
    expect(fetchOrdersSource).toContain('failed: false');
    expect(fetchOrdersSource).toContain('failed: true');
    expect(fetchOrdersSource).toContain('setOrderItemPreviewFailedByOrderId(Object.fromEntries(');
    expect(fetchOrdersSource).not.toContain('return [order.id, []] as const;');
    expect(source).toContain("t('pages.profile.orderItemsPreviewFailed')");
    expect(source).toContain('const retryOrderItemsActionLabel');
    expect(source).toContain('icon={<ReloadOutlined />}');
  });

  it('keeps stale order snapshots visible but blocks order state changes until refresh succeeds', () => {
    const source = readProfileSource();

    expect(source).toContain('const ordersStale = ordersLoadFailed && orders.length > 0;');
    expect(source).toContain("t('pages.profile.ordersStaleAfterSaleText')");
    expect(source).toContain("t('pages.profile.nextOrderStaleTitle')");
    expect(source).toContain("t('pages.profile.nextOrderStaleText')");
    expect(source).toContain("message={t('pages.profile.ordersStaleWarning')}");
    expect(source).toContain('disabled={ordersStale || payingOrderId !== null}');
    expect(source).toContain('disabled={ordersStale} onClick={() => confirmReceiptOrder(order)}');
    expect(source).toContain('disabled={ordersStale} onClick={() => openReturnModal(order)}');
    expect(source).toContain('disabled={ordersStale} onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || \'\'); }}');
    expect(source).toContain('disabled={ordersStale}');

    for (const locale of ['en', 'zh', 'es']) {
      const messages = readLocale(locale);
      expect(messages.pages.profile.ordersStaleAfterSaleText).toBeTruthy();
      expect(messages.pages.profile.ordersStaleWarning).toBeTruthy();
      expect(messages.pages.profile.nextOrderStaleTitle).toBeTruthy();
      expect(messages.pages.profile.nextOrderStaleText).toBeTruthy();
    }
  });

  it('keeps stale address snapshots visible but blocks address mutations until refresh succeeds', () => {
    const source = readProfileSource();

    expect(source).toContain('const addressesStale = addressesLoadFailed && addresses.length > 0;');
    expect(source).toContain("t('pages.profile.addressesStaleTitle')");
    expect(source).toContain("description={t('pages.profile.addressesStaleWarning')}");
    expect(source).toContain("announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning')");
    expect(source).toContain('title={addressesStale ? t(\'pages.profile.addressesStaleWarning\') : undefined}');
    expect(source).toContain('disabled={addressesStale} onClick={() => handleSetDefault(address.id)}');
    expect(source).toContain('disabled={addressesStale} onClick={() => openAddressModal(address)}');
    expect(source).toContain('disabled={addressesStale}>{t(\'common.delete\')}</Button>');

    for (const locale of ['en', 'zh', 'es']) {
      const messages = readLocale(locale);
      expect(messages.pages.profile.addressesStaleTitle).toBeTruthy();
      expect(messages.pages.profile.addressesStaleWarning).toBeTruthy();
    }
  });

  it('localizes pet weight display instead of hardcoding a kilogram suffix', () => {
    const source = readProfileSource();
    const en = readLocale('en');
    const zh = readLocale('zh');
    const es = readLocale('es');

    expect(source).toContain("t('pages.profile.petWeightValue', { weight: pet.weight })");
    expect(source).not.toContain('${pet.weight} kg');
    expect(en.pages.profile.petWeightValue).toContain('{weight}');
    expect(zh.pages.profile.petWeightValue).toContain('{weight}');
    expect(es.pages.profile.petWeightValue).toContain('{weight}');
  });

  it('keeps payment polling lifecycle-bound without delayed location redirects', () => {
    const source = readProfileSource();
    const refreshStateStart = source.indexOf('const refreshPaymentState = useCallback(async (orderId: number, isActive: () => boolean = () => true) => {');
    const continuePaymentStart = source.indexOf('const handleContinuePayment = useCallback(async (order: OrderCustomer) => {');
    const pollingEffectStart = source.indexOf('if (!paymentModalVisible || !orderId) return;');
    const channelEffectStart = source.indexOf('paymentApi.getChannels()');
    const refreshStateSource = source.slice(refreshStateStart, continuePaymentStart);
    const pollingEffectSource = source.slice(pollingEffectStart, channelEffectStart);

    expect(source).not.toContain('window.location.href');
    expect(source).not.toMatch(/setTimeout\s*\([\s\S]{0,400}window\.location/);
    expect(source.match(/navigateToCommercialPaymentUrl\(selectedPayment\.paymentUrl\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(refreshStateStart).toBeGreaterThan(-1);
    expect(continuePaymentStart).toBeGreaterThan(refreshStateStart);
    expect(pollingEffectStart).toBeGreaterThan(continuePaymentStart);
    expect(channelEffectStart).toBeGreaterThan(pollingEffectStart);
    expect(refreshStateSource).toContain('if (!mountedRef.current || !isActive()) return;');
    expect(pollingEffectSource).toContain('let disposed = false;');
    expect(pollingEffectSource).toContain('const isActive = () => !disposed && mountedRef.current;');
    expect(pollingEffectSource).toContain('if (polling || !isActive()) return;');
    expect(pollingEffectSource).toContain('await refreshPaymentState(orderId, isActive);');
    expect(pollingEffectSource).toContain('if (isActive()) {');
    expect(pollingEffectSource).toContain('const timer = window.setInterval(syncPaymentState, 5000);');
    expect(pollingEffectSource).toContain('disposed = true;');
    expect(pollingEffectSource).toContain('window.clearInterval(timer);');
  });

  it('waits for payment channels before consuming payment-return sync state', () => {
    const source = readProfileSource();
    const preferredChannelStart = source.indexOf('const getPreferredPaymentChannel = (channels: PaymentChannel[], preferred?: string | null) => {');
    const paymentReturnEffectStart = source.indexOf("if (paymentReturnStatus !== 'success') return;");
    const channelEffectStart = source.indexOf('const loadPaymentChannels = useCallback');
    const paymentReturnEffectSource = source.slice(paymentReturnEffectStart, channelEffectStart);
    const channelEffectSource = source.slice(channelEffectStart, source.indexOf('const handleConfirmReceipt', channelEffectStart));
    const preferredChannelSource = source.slice(preferredChannelStart, source.indexOf('const useImageFallback', preferredChannelStart));

    expect(preferredChannelStart).toBeGreaterThan(-1);
    expect(paymentReturnEffectStart).toBeGreaterThan(-1);
    expect(channelEffectStart).toBeGreaterThan(paymentReturnEffectStart);
    expect(source).toContain('const [paymentChannelsLoaded, setPaymentChannelsLoaded] = useState(false);');
    expect(paymentReturnEffectSource).toContain('if (!paymentChannelsLoaded) return;');
    expect(paymentReturnEffectSource).toContain('handledPaymentReturnRef.current = returnKey;');
    expect(paymentReturnEffectSource.indexOf('if (!paymentChannelsLoaded) return;')).toBeLessThan(paymentReturnEffectSource.indexOf('handledPaymentReturnRef.current = returnKey;'));
    expect(paymentReturnEffectSource).toMatch(/\}, \[[^\]]*paymentChannelsLoaded[^\]]*\]\);/);
    expect(channelEffectSource).toContain('const res = await paymentApi.getChannels();');
    expect(channelEffectSource.match(/setPaymentChannelsLoaded\(true\);/g)?.length).toBe(2);
    expect(channelEffectSource).toContain("const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;");
    expect(channelEffectSource).toContain("setPaymentChannelsError(getApiErrorMessage(error, latestT('pages.checkout.paymentUnavailableDescription'), latestLanguage));");
    expect(channelEffectSource).toContain('void loadPaymentChannels(() => !disposed && mountedRef.current);');
    expect(preferredChannelSource).toContain("const normalizedPreferred = String(preferred || '').trim();");
    expect(preferredChannelSource).toContain("channels.length === 0 || channels.some((channel) => channel.code === normalizedPreferred)");
  });

  it('keeps profile payment channel failures recoverable from the payment modal', () => {
    const source = readProfileSource();
    const channelLoadStart = source.indexOf('const loadPaymentChannels = useCallback');
    const modalStart = source.indexOf('title={t(\'pages.profile.continuePay\')}');
    const modalSource = source.slice(modalStart, source.indexOf('</Modal>', modalStart));

    expect(source).toContain('const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);');
    expect(source).toContain("const [paymentChannelsError, setPaymentChannelsError] = useState('');");
    expect(channelLoadStart).toBeGreaterThan(-1);
    expect(source.slice(channelLoadStart, source.indexOf('const handleConfirmReceipt', channelLoadStart))).toContain('setPaymentChannelsLoading(true);');
    expect(source.slice(channelLoadStart, source.indexOf('const handleConfirmReceipt', channelLoadStart))).toContain('setPaymentChannelsError(\'\');');
    expect(source.slice(channelLoadStart, source.indexOf('const handleConfirmReceipt', channelLoadStart))).toContain('setPaymentChannelsLoading(false);');
    expect(source).toContain("const retryPaymentChannelsActionLabel = `${t('common.retry')}: ${paymentOrderLabel} ${t('pages.checkout.paymentMethod')}`;");
    expect(modalSource).toContain('disabled={paymentChannelsLoading || paymentOptions.length === 0}');
    expect(modalSource).toContain('disabled={selectedPaymentPaid || selectedPaymentReconcileRequired || paymentChannelsLoading || paymentOptions.length === 0}');
    expect(modalSource).toContain("description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}");
    expect(modalSource).toContain('aria-label={retryPaymentChannelsActionLabel}');
    expect(modalSource).toContain('onClick={() => void loadPaymentChannels()}');
  });

  it('uses the shared date locale mapping for profile timestamps', () => {
    const source = readProfileSource();

    expect(source).toContain("const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';");
    expect(source).not.toContain("const dateLocale = language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'es-MX';");
  });

  it('announces the initial profile loading state as a busy status region', () => {
    const source = readProfileSource();
    const loadingStart = source.indexOf('<div className="profile-loading"');
    const loadingSource = source.slice(loadingStart, source.indexOf('</div>', loadingStart));

    expect(loadingStart).toBeGreaterThan(-1);
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain('aria-busy="true"');
    expect(loadingSource).toContain("aria-label={t('common.loading')}");
  });

  it('guards continue-payment actions against duplicate in-flight requests', () => {
    const source = readProfileSource();
    const continuePaymentStart = source.indexOf('const handleContinuePayment = useCallback(async (order: OrderCustomer) => {');
    const refreshPaymentStart = source.indexOf('const handleRefreshPayment = async () => {');
    const continuePaymentSource = source.slice(continuePaymentStart, refreshPaymentStart);

    expect(source).toContain('const continuingPaymentRef = useRef<number | null>(null);');
    expect(continuePaymentStart).toBeGreaterThan(-1);
    expect(refreshPaymentStart).toBeGreaterThan(continuePaymentStart);
    expect(continuePaymentSource).toContain('if (continuingPaymentRef.current !== null) return;');
    expect(continuePaymentSource).toContain('continuingPaymentRef.current = order.id;');
    expect(continuePaymentSource).toContain('if (continuingPaymentRef.current === order.id) {');
    expect(continuePaymentSource).toContain('continuingPaymentRef.current = null;');
    expect(continuePaymentSource).toContain('setPayingOrderId(null);');
    expect(source).toMatch(/loading=\{payingOrderId === order\.id\} disabled=\{ordersStale \|\| payingOrderId !== null\}/);
  });

  it('shows a localized error when pet profiles fail to load', () => {
    const source = readProfileSource();
    const fetchPetProfilesStart = source.indexOf('const fetchPetProfiles = useCallback(async () => {');
    const profileBootstrapStart = source.indexOf('useEffect(() => {', fetchPetProfilesStart);
    const fetchPetProfilesSource = source.slice(fetchPetProfilesStart, profileBootstrapStart);

    expect(fetchPetProfilesStart).toBeGreaterThan(-1);
    expect(fetchPetProfilesSource).toContain("reportNonBlockingError('Profile.fetchPetProfiles', error);");
    expect(fetchPetProfilesSource).toContain('setPetProfiles([]);');
    expect(fetchPetProfilesSource).toContain("announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.fetchPetProfilesFailed'), 'error')");
    expect(fetchPetProfilesSource).toContain('}, []);');
    expect(source).toContain('const profileLocalizationRef = useRef({ t, language });');

    for (const locale of ['en', 'zh', 'es']) {
      const messages = readLocale(locale);
      expect(messages.pages.profile.fetchPetProfilesFailed).toBeTruthy();
    }
  });


  it('opens the orders tab when deep-linking from a notification order number', () => {
    const source = require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8');
    expect(source).toContain("setProfileActiveTab('orders')");
    expect(source).toContain('setOrderSearchText((current) => (current.trim() ? current : deepLinkOrderNo))');
  });

  it('routes cancelled and failed payment returns into pending-payment orders', () => {
    const source = require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8');
    expect(source).toContain('const isPaymentReturnIncomplete = paymentReturnStatus === \'cancelled\'');
    expect(source).toContain("paymentReturnStatus === 'failed'");
    expect(source).toContain("setOrderStatusFilter('PENDING_PAYMENT')");
    expect(source).toContain("latestT('pages.profile.paymentReturnCancelled')");
    expect(source).toContain("latestT('pages.profile.paymentReturnFailed')");
    expect(source).toContain("latestT('pages.profile.paymentReturnCancelledOrder'");
    expect(source).toContain("latestT('pages.profile.paymentReturnFailedOrder'");
    expect(source).toContain('autoResumePaymentReturnRef');
    expect(source).toContain("normalizeStatusCode(targetOrder.status) !== 'PENDING_PAYMENT'");
    expect(source).toContain('void handleContinuePayment(targetOrder)');
    expect(source).toContain('setOrderSearchText(paymentReturnOrderNo)');
  });


  it('announces payment-return recovery as a persistent orders alert', () => {
    const source = readProfileSource();
    expect(source).toContain('className="profile-payment-return"');
    expect(source).toContain('isPaymentReturnSuccess || isPaymentReturnIncomplete');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).toContain("t('pages.profile.paymentReturnSynced')");
    expect(source).toContain("t('pages.profile.paymentReturnFailedOrder'");
    expect(source).toContain("t('pages.profile.paymentReturnCancelledOrder'");
    expect(source).toContain("t('pages.checkout.paymentRecoveryNextPaid')");
    expect(source).toContain("t('pages.checkout.paymentRecoveryNextRetry')");
  });

  it('keeps continue-pay reconcile-safe and hides gateway actions when review is required', () => {
    const source = readProfileSource();
    const modalStart = source.indexOf("title={t('pages.profile.continuePay')}");
    const modalSource = source.slice(modalStart, source.indexOf('</Modal>', modalStart));

    expect(source).toContain("normalizeStatusCode(item.status) === 'RECONCILE_REQUIRED'");
    expect(source).toContain('const paidPayment = paymentList.find');
    expect(source).toContain('const reconcilePayment = paymentList.find');
    expect(source).toContain('const pendingPayment = paymentList.find');
    expect(source).toContain('const reusablePayment = paidPayment || reconcilePayment || pendingPayment');
    expect(source).toContain("normalizeStatusCode(selectedPayment?.status) === 'RECONCILE_REQUIRED'");
    expect(source).toContain("announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning')");
    expect(modalSource).toContain('role="alert"');
    expect(modalSource).toContain('aria-live="assertive"');
    expect(modalSource).toContain('selectedPayment.paymentUrl && !selectedPaymentPaid && !selectedPaymentReconcileRequired');
    expect(modalSource).toContain("t('pages.checkout.paymentRecoveryNextReconcileRequired')");
  });

  it('surfaces refund audit timestamps and customer guidance in the payment modal', () => {
    const source = require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8');
    expect(source).toContain("t('pages.profile.paymentRefundedTitle')");
    expect(source).toContain("t('pages.profile.paymentRefundingTitle')");
    expect(source).toContain("t('pages.profile.paidAt')");
    expect(source).toContain('selectedPayment.refundedAt');
    expect(source).toContain('payment.refundedAt');
    expect(source).toContain('className="profile-payment-recovery" role="status" aria-live="polite"');
    expect(source).not.toContain('selectedPayment.refundReference');
    expect(source).not.toContain('payment.refundReference');
  });


  it('keeps a commercial multi-path guest auth gate instead of hard-redirect-only login', () => {
    const source = readProfileSource();
    const css = readProfileCss();
    expect(source).toContain('profile-page__authGate');
    expect(source).toContain('pages.profile.authGateTitle');
    expect(source).toContain("buildLoginUrl('/profile')");
    expect(source).toContain("navigate('/register?redirect=%2Fprofile')");
    expect(source).toContain("navigate('/track-order')");
    expect(source).not.toContain("message.warning(profileLocalizationRef.current.t('messages.loginRequired'))");
    expect(css).toContain('Commercial guest profile auth gate multi-path conversion');
    expect(css).toMatch(/\.profile-page__authGate \.page-feedback__actions \.ant-btn[\s\S]*?min-height:\s*44px/);
  });

});

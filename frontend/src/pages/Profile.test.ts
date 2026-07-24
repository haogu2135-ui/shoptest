import fs from 'fs';
import path from 'path';

const readProfileSource = () => fs.readFileSync(path.resolve(__dirname, 'Profile.tsx'), 'utf8');
const readProfileOrdersPanelSource = () => fs.readFileSync(path.resolve(__dirname, 'profileOrdersPanel.tsx'), 'utf8');
const readProfileAddressesPanelSource = () => fs.readFileSync(path.resolve(__dirname, 'profileAddressesPanel.tsx'), 'utf8');
const readProfilePetsPanelSource = () => fs.readFileSync(path.resolve(__dirname, 'profilePetsPanel.tsx'), 'utf8');
const readProfileOrderDetailModalSource = () => fs.readFileSync(path.resolve(__dirname, 'profileOrderDetailModal.tsx'), 'utf8');
const readProfileReturnModalsSource = () => fs.readFileSync(path.resolve(__dirname, 'profileReturnModals.tsx'), 'utf8');
const readProfilePaymentModalSource = () => fs.readFileSync(path.resolve(__dirname, 'profilePaymentModal.tsx'), 'utf8');
const readProfileInfoPanelSource = () => fs.readFileSync(path.resolve(__dirname, 'profileInfoPanel.tsx'), 'utf8');
const readProfileAccountModalsSource = () => fs.readFileSync(path.resolve(__dirname, 'profileAccountModals.tsx'), 'utf8');
const readProfileHelpersSource = () => fs.readFileSync(path.resolve(__dirname, '../utils/profileHelpers.ts'), 'utf8');
const readProfilePaymentActionsSource = () => fs.readFileSync(path.resolve(__dirname, '../hooks/useProfilePaymentActions.ts'), 'utf8');
const readProfileAddressActionsSource = () => fs.readFileSync(path.resolve(__dirname, '../hooks/useProfileAddressActions.ts'), 'utf8');
const readProfilePetActionsSource = () => fs.readFileSync(path.resolve(__dirname, '../hooks/useProfilePetActions.ts'), 'utf8');
const readProfileAccountActionsSource = () => fs.readFileSync(path.resolve(__dirname, '../hooks/useProfileAccountActions.ts'), 'utf8');
const readProfileOrderActionsSource = () => fs.readFileSync(path.resolve(__dirname, '../hooks/useProfileOrderActions.ts'), 'utf8');
const readProfileCss = () => fs.readFileSync(path.resolve(__dirname, 'Profile.css'), 'utf8');
const readLocale = (locale: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../locales/${locale}.json`), 'utf8'));

describe('Profile mobile control visibility', () => {
  it('uses the shared strong password policy for profile password changes', () => {
    const source = readProfileSource();
    const accountModals = readProfileAccountModalsSource();

    expect(accountModals).toContain("from '../utils/passwordPolicy'");
    expect(accountModals).toContain('STRONG_PASSWORD_MIN_LENGTH');
    expect(accountModals).toContain('STRONG_PASSWORD_MAX_LENGTH');
    expect(accountModals).toContain('isCommonPassword(value)');
    expect(accountModals).toContain('hasRequiredPasswordClasses(value)');
    expect(accountModals).toContain("t('pages.profile.newPasswordCommon')");
    expect(source).toContain('<ProfileAccountModals');
  });

  it('keeps profile recoverable error handling typed without broad any usage', () => {
    const source = readProfileSource();
    const helpers = readProfileHelpersSource();
    const accountActions = readProfileAccountActionsSource();
    const surface = `${source}\n${helpers}\n${readProfilePaymentActionsSource()}\n${readProfileAddressActionsSource()}\n${readProfilePetActionsSource()}\n${accountActions}\n${readProfileOrderActionsSource()}`;

    expect(helpers).toContain('export const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(helpers).toContain('export const getProfileApiErrorData = (error: unknown): Record<string, unknown> =>');
    expect(helpers).toContain('export const getProfileApiErrorCode = (error: unknown) =>');
    expect(accountActions).toContain('if (isFormValidationError(err)) {');
    expect(surface).toContain('} catch (err: unknown) {');
    expect(surface).not.toMatch(/\bany\b/);
    expect(surface).not.toContain('err?.errorFields');
    expect(surface).not.toContain('err.response?.data');
    expect(surface).not.toContain('catch (err: any)');
  });

  it('uses localized profile address copy instead of stale AddressManager literals', () => {
    const source = readProfileSource();
    const addressesPanel = readProfileAddressesPanelSource();

    expect(source).not.toContain('AddressManager');
    expect(source).not.toContain('data-testid="add-address-button"');
    expect(source).not.toContain('添加新地址');
    expect(addressesPanel).not.toContain('AddressManager');
    expect(addressesPanel).toContain("{t('pages.profile.addAddress')}");
    expect(readProfileAccountModalsSource()).toContain("title={editingAddress ? t('pages.profile.editAddressTitle') : t('pages.profile.addAddressTitle')}");

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
    const accountModals = readProfileAccountModalsSource();
    const addressActions = readProfileAddressActionsSource();

    expect(source).toContain('loadProfileRegionOptions');
    expect(accountModals).toContain('options={regionOptions}');
    expect(source).toContain("import type { RegionOption } from '../regionData'");
    expect(source).not.toContain('loadRegionData');
    expect(source).not.toContain('findRegionPath');
    expect(addressActions).toContain('loadRegionData(language)');
    expect(addressActions).toContain('findRegionPath(address.address, options)');
    expect(addressActions).not.toContain('regionData }');
  });

  it('keeps address and pet editor popups above mobile modal content', () => {
    const source = readProfileSource();
    const accountModals = readProfileAccountModalsSource();
    const surface = `${source}\n${accountModals}`;
    const css = readProfileCss();
    const f3539Css = css.slice(css.indexOf('/* F3539'));

    expect(accountModals).toContain('ShopCascader');
    expect(accountModals).toContain('<ShopDatePicker className="profile-pet-modal__field"');
    expect(accountModals).toContain('ShopSelect');
    expect(accountModals).toContain("popupClassName=\"shop-mobile-popup-layer profile-modal-popup\"");
    expect(accountModals).toContain('popupZIndex={12050}');
    expect(surface).not.toMatch(/import \{[^}]*\bCascader\b[^}]*\} from 'antd'/);
    expect(surface).not.toMatch(/import \{[^}]*\bDatePicker\b[^}]*\} from 'antd'/);
    expect(surface).not.toMatch(/<Cascader\b/);
    expect(surface).not.toMatch(/<DatePicker\b/);
    expect(surface).not.toContain('profileModalPopupClassNames');
    expect((accountModals.match(/popupClassName="shop-mobile-popup-layer profile-modal-popup"/g) || []).length).toBeGreaterThanOrEqual(3);

    expect(f3539Css).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer\s*\{[\s\S]*?z-index:\s*12050\s*!important;[\s\S]*?pointer-events:\s*auto\s*!important;/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer\.shop-select__popup,[\s\S]*?body \.profile-modal-popup\.shop-mobile-popup-layer\.shop-cascader__popup\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?max-height:\s*min\(320px,\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\)\s*!important;/);
    expect(f3539Css).toMatch(/body \.profile-modal-popup\.shop-mobile-popup-layer \.shop-cascader__optionLabel,[\s\S]*?body \.profile-modal-popup\.shop-mobile-popup-layer \.shop-select__option\s*\{[\s\S]*?white-space:\s*normal\s*!important;[\s\S]*?overflow-wrap:\s*anywhere\s*!important;[\s\S]*?word-break:\s*break-word\s*!important;/);
  });

  it('keeps primary account actions, section tabs, and order filters out of hidden rails', () => {
    const source = readProfileSource();
    const css = readProfileCss();
    const fixCss = css.slice(css.indexOf('F3516:'));

    expect(source).toContain('profile-action-center__cards');
    expect(source).toContain('profile-mobile-entry');
    expect(readProfileOrdersPanelSource()).toContain('profile-orders__tabs');
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

    expect(readProfileHelpersSource()).toContain('export const PROFILE_ORDER_ITEM_PREVIEW_LIMIT = 30;');
    expect(fetchOrdersSource).toContain('sortedOrders.slice(0, PROFILE_ORDER_ITEM_PREVIEW_LIMIT)');
    expect(fetchOrdersSource).not.toContain('sortedOrders.slice(0, 20)');
    expect(fetchOrdersSource).not.toContain('sortedOrders.slice(0, 30)');
  });

  it('shows retryable order item preview failures instead of empty order items', () => {
    const source = readProfileSource();
    const panel = readProfileOrdersPanelSource();
    const surface = `${source}\n${panel}`;
    const fetchOrdersStart = source.indexOf('const fetchOrders = useCallback(async () => {');
    const fetchOrdersSource = source.slice(fetchOrdersStart, source.indexOf('const syncPaymentReturnState', fetchOrdersStart));

    expect(source).toContain('const [orderItemPreviewFailedByOrderId, setOrderItemPreviewFailedByOrderId]');
    expect(fetchOrdersSource).toContain('failed: false');
    expect(fetchOrdersSource).toContain('failed: true');
    expect(fetchOrdersSource).toContain('setOrderItemPreviewFailedByOrderId(Object.fromEntries(');
    expect(fetchOrdersSource).not.toContain('return [order.id, []] as const;');
    expect(surface).toContain("t('pages.profile.orderItemsPreviewFailed')");
    expect(panel).toContain('const retryOrderItemsActionLabel');
    expect(panel).toContain('icon={<ShopIcon path={SI.reload} />}');
    expect(panel).toContain('aria-label={retryOrderItemsActionLabel}');
  });

    it('keeps stale order snapshots visible but blocks order state changes until refresh succeeds', () => {
    const source = readProfileSource();
    const panel = readProfileOrdersPanelSource();
    const surface = `${source}\n${panel}`;

    expect(source).toContain('const ordersStale = ordersLoadFailed && orders.length > 0;');
    expect(source).toContain("t('pages.profile.ordersStaleAfterSaleText')");
    expect(source).toContain("t('pages.profile.nextOrderStaleTitle')");
    expect(source).toContain("t('pages.profile.nextOrderStaleText')");
    expect(surface).toContain("message={t('pages.profile.ordersStaleWarning')}");
    expect(surface).toContain('disabled={ordersStale || payingOrderId !== null}');
    expect(surface).toContain('disabled={ordersStale} onClick={() => confirmReceiptOrder(order)}');
    expect(surface).toContain('disabled={ordersStale} onClick={() => openReturnModal(order)}');
    expect(surface).toContain("disabled={ordersStale} onClick={() => { setReturnShipmentOrder(order); setReturnTrackingNumber(order.returnTrackingNumber || ''); }}");
    expect(surface).toContain('disabled={ordersStale}');

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
    const addressesPanel = readProfileAddressesPanelSource();
    const addressActions = readProfileAddressActionsSource();
    const surface = `${source}
${addressesPanel}
${addressActions}`;

    expect(source).toContain('const addressesStale = addressesLoadFailed && addresses.length > 0;');
    expect(addressesPanel).toContain("t('pages.profile.addressesStaleTitle')");
    expect(addressesPanel).toContain("description={t('pages.profile.addressesStaleWarning')}");
    expect(surface).toContain("announceAccessibleMessage(t('pages.profile.addressesStaleWarning'), 'warning')");
    expect(addressesPanel).toContain("title={addressesStale ? t('pages.profile.addressesStaleWarning') : undefined}");
    expect(addressesPanel).toContain('disabled={addressesStale} onClick={() => handleSetDefault(address.id)}');
    expect(addressesPanel).toContain('disabled={addressesStale} onClick={() => openAddressModal(address)}');
    expect(addressesPanel).toContain("disabled={addressesStale}>{t('common.delete')}</ShopButton>");

    for (const locale of ['en', 'zh', 'es']) {
      const messages = readLocale(locale);
      expect(messages.pages.profile.addressesStaleTitle).toBeTruthy();
      expect(messages.pages.profile.addressesStaleWarning).toBeTruthy();
    }
  });

  it('localizes pet weight display instead of hardcoding a kilogram suffix', () => {
    const source = readProfileSource();
    const petsPanel = readProfilePetsPanelSource();
    const en = readLocale('en');
    const zh = readLocale('zh');
    const es = readLocale('es');

    expect(petsPanel).toContain("t('pages.profile.petWeightValue', { weight: pet.weight })");
    expect(source).not.toContain('${pet.weight} kg');
    expect(petsPanel).not.toContain('${pet.weight} kg');
    expect(en.pages.profile.petWeightValue).toContain('{weight}');
    expect(zh.pages.profile.petWeightValue).toContain('{weight}');
    expect(es.pages.profile.petWeightValue).toContain('{weight}');
  });

  it('keeps payment polling lifecycle-bound without delayed location redirects', () => {
    const source = readProfileSource();
    const paymentModal = readProfilePaymentModalSource();
    const paymentActions = readProfilePaymentActionsSource();
    const refreshStateStart = paymentActions.indexOf('const refreshPaymentState = useCallback(async (orderId: number, isActive: () => boolean = () => true) => {');
    const continuePaymentStart = paymentActions.indexOf('const handleContinuePayment = useCallback(async (order: OrderCustomer) => {');
    const pollingEffectStart = source.indexOf('if (!paymentModalVisible || !orderId) return;');
    const channelEffectStart = source.indexOf('void loadPaymentChannels(() => !disposed && mountedRef.current);');
    const refreshStateSource = paymentActions.slice(refreshStateStart, continuePaymentStart);
    const pollingEffectSource = source.slice(pollingEffectStart, channelEffectStart);

    expect(`${source}\n${paymentModal}`).not.toContain('window.location.href');
    expect(`${source}\n${paymentModal}`).not.toMatch(/setTimeout\s*\([\s\S]{0,400}window\.location/);
    expect(paymentModal.match(/navigateToCommercialPaymentUrl\(selectedPayment\.paymentUrl\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('useProfilePaymentActions({');
    expect(refreshStateStart).toBeGreaterThan(-1);
    expect(continuePaymentStart).toBeGreaterThan(refreshStateStart);
    expect(pollingEffectStart).toBeGreaterThan(-1);
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
    const helpers = readProfileHelpersSource();
    const paymentActions = readProfilePaymentActionsSource();
    const preferredChannelStart = helpers.indexOf('export const getPreferredPaymentChannel = (');
    const paymentReturnEffectStart = source.indexOf("if (paymentReturnStatus !== 'success') return;");
    const paymentReturnEffectEnd = source.indexOf('}, [fetchOrders, ordersInitialLoadComplete, paymentChannelsLoaded', paymentReturnEffectStart);
    const paymentReturnEffectSource = source.slice(
      paymentReturnEffectStart,
      paymentReturnEffectEnd > -1 ? paymentReturnEffectEnd + 280 : paymentReturnEffectStart + 1600,
    );
    const channelEffectStart = paymentActions.indexOf('const loadPaymentChannels = useCallback');
    const channelEffectSource = paymentActions.slice(channelEffectStart);
    const preferredChannelSource = helpers.slice(preferredChannelStart, preferredChannelStart + 900);

    expect(preferredChannelStart).toBeGreaterThan(-1);
    expect(paymentReturnEffectStart).toBeGreaterThan(-1);
    expect(channelEffectStart).toBeGreaterThan(-1);
    expect(source).toContain('useProfilePaymentActions({');
    expect(source).toContain('const [paymentChannelsLoaded, setPaymentChannelsLoaded] = useState(false);');
    expect(paymentReturnEffectSource).toContain('if (!paymentChannelsLoaded) return;');
    expect(paymentReturnEffectSource).toContain('handledPaymentReturnRef.current = returnKey;');
    expect(paymentReturnEffectSource.indexOf('if (!paymentChannelsLoaded) return;')).toBeLessThan(paymentReturnEffectSource.indexOf('handledPaymentReturnRef.current = returnKey;'));
    expect(paymentReturnEffectSource).toMatch(/\}, \[[\s\S]*paymentChannelsLoaded[\s\S]*?\]\);/);
    expect(channelEffectSource).toContain('const res = await paymentApi.getChannels();');
    expect(channelEffectSource.match(/setPaymentChannelsLoaded\(true\);/g)?.length).toBe(2);
    expect(channelEffectSource).toContain("const { t: latestT, language: latestLanguage } = profileLocalizationRef.current;");
    expect(channelEffectSource).toContain("setPaymentChannelsError(getApiErrorMessage(error, latestT('pages.checkout.paymentUnavailableDescription'), latestLanguage));");
    expect(source).toContain('void loadPaymentChannels(() => !disposed && mountedRef.current);');
    expect(preferredChannelSource).toContain("const normalizedPreferred = String(preferred || '').trim();");
    expect(preferredChannelSource).toContain('marketChannels.some((channel) => channel.code === normalizedPreferred)');
    expect(preferredChannelSource).toContain('channels.some((channel) => channel.code === normalizedPreferred)');
  });

  it('keeps profile payment channel failures recoverable from the payment modal', () => {
    const source = readProfileSource();
    const paymentModal = readProfilePaymentModalSource();
    const paymentActions = readProfilePaymentActionsSource();
    const channelLoadStart = paymentActions.indexOf('const loadPaymentChannels = useCallback');
    const modalSource = paymentModal;
    const channelLoadSource = paymentActions.slice(channelLoadStart);

    expect(source).toContain('const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);');
    expect(source).toContain("const [paymentChannelsError, setPaymentChannelsError] = useState('');");
    expect(channelLoadStart).toBeGreaterThan(-1);
    expect(channelLoadSource).toContain('setPaymentChannelsLoading(true);');
    expect(channelLoadSource).toContain("setPaymentChannelsError('');");
    expect(channelLoadSource).toContain('setPaymentChannelsLoading(false);');
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
    const paymentActions = readProfilePaymentActionsSource();
    const continuePaymentStart = paymentActions.indexOf('const handleContinuePayment = useCallback(async (order: OrderCustomer) => {');
    const refreshPaymentStart = paymentActions.indexOf('const handleRefreshPayment = useCallback(async () => {');
    const continuePaymentSource = paymentActions.slice(continuePaymentStart, refreshPaymentStart);

    expect(source).toContain('const continuingPaymentRef = useRef<number | null>(null);');
    expect(source).toContain('useProfilePaymentActions({');
    expect(continuePaymentStart).toBeGreaterThan(-1);
    expect(refreshPaymentStart).toBeGreaterThan(continuePaymentStart);
    expect(continuePaymentSource).toContain('if (continuingPaymentRef.current !== null) return;');
    expect(continuePaymentSource).toContain('continuingPaymentRef.current = order.id;');
    expect(continuePaymentSource).toContain('if (continuingPaymentRef.current === order.id) {');
    expect(continuePaymentSource).toContain('continuingPaymentRef.current = null;');
    expect(continuePaymentSource).toContain('setPayingOrderId(null);');
    expect(readProfileOrdersPanelSource()).toMatch(/loading=\{payingOrderId === order\.id\} disabled=\{ordersStale \|\| payingOrderId !== null\}/);
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
    const panel = readProfileOrdersPanelSource();
    expect(panel).toContain('className="profile-payment-return"');
    expect(panel).toContain('isPaymentReturnSuccess || isPaymentReturnIncomplete');
    expect(panel).toContain('role="alert"');
    expect(panel).toContain('aria-live="assertive"');
    expect(panel).toContain("t('pages.profile.paymentReturnSynced')");
    expect(panel).toContain("t('pages.profile.paymentReturnFailedOrder'");
    expect(panel).toContain("t('pages.profile.paymentReturnCancelledOrder'");
    expect(panel).toContain("t('pages.checkout.paymentRecoveryNextPaid')");
    expect(panel).toContain("t('pages.checkout.paymentRecoveryNextRetry')");
    expect(source).toContain('isPaymentReturnSuccess={isPaymentReturnSuccess}');
    expect(source).toContain('isPaymentReturnIncomplete={isPaymentReturnIncomplete}');
  });

  it('keeps continue-pay reconcile-safe and hides gateway actions when review is required', () => {
    const source = readProfileSource();
    const paymentModal = readProfilePaymentModalSource();
    const paymentActions = readProfilePaymentActionsSource();
    const surface = `${source}
${paymentActions}
${paymentModal}`;
    const modalSource = paymentModal;

    expect(surface).toContain("normalizeStatusCode(item.status) === 'RECONCILE_REQUIRED'");
    expect(surface).toContain('const paidPayment = paymentList.find');
    expect(surface).toContain('const reconcilePayment = paymentList.find');
    expect(surface).toContain('const pendingPayment = paymentList.find');
    expect(surface).toContain('const reusablePayment = paidPayment || reconcilePayment || pendingPayment');
    expect(surface).toContain("normalizeStatusCode(selectedPayment?.status) === 'RECONCILE_REQUIRED'");
    expect(surface).toContain("announceAccessibleMessage(t('pages.profile.paymentReturnReconcileRequired'), 'warning')");
    expect(modalSource).toContain('role="alert"');
    expect(modalSource).toContain('aria-live="assertive"');
    expect(modalSource).toContain('selectedPayment.paymentUrl && !selectedPaymentPaid && !selectedPaymentReconcileRequired');
    expect(modalSource).toContain("t('pages.checkout.paymentRecoveryNextReconcileRequired')");
  });

  it('surfaces refund audit timestamps and customer guidance in the payment modal', () => {
    const source = readProfileSource();
    const paymentModal = readProfilePaymentModalSource();
    expect(paymentModal).toContain("t('pages.profile.paymentRefundedTitle')");
    expect(paymentModal).toContain("t('pages.profile.paymentRefundingTitle')");
    expect(paymentModal).toContain("t('pages.profile.paidAt')");
    expect(paymentModal).toContain('selectedPayment.refundedAt');
    expect(paymentModal).toContain('payment.refundedAt');
    expect(paymentModal).toContain('className="profile-payment-recovery" role="status" aria-live="polite"');
    expect(paymentModal).not.toContain('selectedPayment.refundReference');
    expect(paymentModal).not.toContain('payment.refundReference');
    expect(source).toContain('<ProfilePaymentModal');
  });

  it('keeps profile address and pet actions modularized outside the page shell', () => {
    const source = readProfileSource();
    const addressActions = readProfileAddressActionsSource();
    const petActions = readProfilePetActionsSource();

    expect(source).toContain('useProfileAddressActions({');
    expect(source).toContain('useProfilePetActions({');
    expect(source).toContain('handleSaveAddress');
    expect(source).toContain('handleSetDefault');
    expect(source).toContain('openAddressModal');
    expect(source).toContain('handleSavePet');
    expect(source).toContain('openPetModal');
    expect(source).not.toContain('const handleSaveAddress = async () => {');
    expect(source).not.toContain('const openPetModal = (pet?: PetProfile) => {');
    expect(addressActions).toContain('export const useProfileAddressActions');
    expect(addressActions).toContain('const handleSaveAddress = async () => {');
    expect(addressActions).toContain('const openAddressModal = (address?: UserAddress) => {');
    expect(addressActions).toContain('const handleSetDefault = async (id: number) => {');
    expect(addressActions).toContain('loadRegionData(language)');
    expect(petActions).toContain('export const useProfilePetActions');
    expect(petActions).toContain('const handleSavePet = async () => {');
    expect(petActions).toContain('const openPetModal = (pet?: PetProfile) => {');
    expect(petActions).toContain("birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined");
  });

  it('keeps profile account and order actions modularized outside the page shell', () => {
    const source = readProfileSource();
    const accountActions = readProfileAccountActionsSource();
    const orderActions = readProfileOrderActionsSource();

    expect(source).toContain('useProfileAccountActions({');
    expect(source).toContain('useProfileOrderActions({');
    expect(source).toContain('handleEditProfile');
    expect(source).toContain('handleChangePassword');
    expect(source).toContain('handleViewOrder');
    expect(source).toContain('handleReorder');
    expect(source).toContain('openReturnModal');
    expect(source).not.toContain('const handleEditProfile = async () => {');
    expect(source).not.toContain('const handleViewOrder = async (order: OrderCustomer) => {');
    expect(source).not.toContain('const handleReorder = async () => {');
    expect(source).not.toContain('const handleReturnOrder = async () => {');
    expect(accountActions).toContain('export const useProfileAccountActions');
    expect(accountActions).toContain('const handleEditProfile = async () => {');
    expect(accountActions).toContain('const handleSendProfileEmailCode = async () => {');
    expect(accountActions).toContain('const handleChangePassword = async () => {');
    expect(accountActions).toContain('const openEditModal = () => {');
    expect(orderActions).toContain('export const useProfileOrderActions');
    expect(orderActions).toContain('const handleViewOrder = async (order: OrderCustomer) => {');
    expect(orderActions).toContain('const handleReorder = async () => {');
    expect(orderActions).toContain('const handleReturnOrder = async () => {');
    expect(orderActions).toContain('const handleTrackShipment = (trackingNumber?: string, carrierCode?: string, orderId?: number) => {');
  });




  it('keeps profile info panel and account editor modals modularized outside the page shell', () => {
    const source = readProfileSource();
    const infoPanel = readProfileInfoPanelSource();
    const accountModals = readProfileAccountModalsSource();

    expect(source).toContain("from './profileInfoPanel'");
    expect(source).toContain("from './profileAccountModals'");
    expect(source).toContain('<ProfileInfoPanel');
    expect(source).toContain('<ProfileAccountModals');
    expect(source).not.toContain('profile-health-panel');
    expect(source).not.toContain("title={t('pages.profile.editProfileTitle')}");
    expect(infoPanel).toContain('export const ProfileInfoPanel');
    expect(infoPanel).toContain('profile-health-panel');
    expect(accountModals).toContain('export const ProfileAccountModals');
    expect(accountModals).toContain("title={t('pages.profile.editProfileTitle')}");
    expect(accountModals).toContain('validateStrongPassword');
  });

  it('keeps profile order detail, return, and payment modals modularized outside the page shell', () => {
    const source = readProfileSource();
    const orderDetail = readProfileOrderDetailModalSource();
    const returnModals = readProfileReturnModalsSource();
    const paymentModal = readProfilePaymentModalSource();

    expect(source).toContain("from './profileOrderDetailModal'");
    expect(source).toContain("from './profileReturnModals'");
    expect(source).toContain("from './profilePaymentModal'");
    expect(source).toContain('<ProfileOrderDetailModal');
    expect(source).toContain('<ProfileReturnModals');
    expect(source).toContain('<ProfilePaymentModal');
    expect(source).not.toContain('className="profile-mobile-safe-modal profile-order-detail-modal"');
    expect(source).not.toContain('data-profile-payment-history-empty="true"');
    expect(source).not.toContain('className="profile-return-modal__preset"');
    expect(orderDetail).toContain('export const ProfileOrderDetailModal');
    expect(orderDetail).toContain('className="profile-mobile-safe-modal profile-order-detail-modal"');
    expect(orderDetail).toContain('handleReorder');
    expect(returnModals).toContain('export const ProfileReturnModals');
    expect(returnModals).toContain('className="profile-return-modal__preset"');
    expect(returnModals).toContain('SeventeenTrackWidget');
    expect(paymentModal).toContain('export const ProfilePaymentModal');
    expect(paymentModal).toContain('data-profile-payment-history-empty="true"');
    expect(paymentModal).toContain('navigateToCommercialPaymentUrl');
  });

  it('keeps profile addresses and pets panels modularized outside the page shell', () => {
    const source = readProfileSource();
    const addressesPanel = readProfileAddressesPanelSource();
    const petsPanel = readProfilePetsPanelSource();

    expect(source).toContain("from './profileAddressesPanel'");
    expect(source).toContain("from './profilePetsPanel'");
    expect(source).toContain('<ProfileAddressesPanel');
    expect(source).toContain('<ProfilePetsPanel');
    expect(source).toContain('handleDeletePet={handleDeletePet}');
    expect(source).not.toContain('data-profile-addresses-load-recovery="true"');
    expect(source).not.toContain('profile-address-card');
    expect(source).not.toContain('profile-pet-card');
    expect(addressesPanel).toContain('export const ProfileAddressesPanel');
    expect(addressesPanel).toContain('data-profile-addresses-load-recovery="true"');
    expect(addressesPanel).toContain('profile-address-card');
    expect(addressesPanel).toContain('handleSetDefault(address.id)');
    expect(petsPanel).toContain('export const ProfilePetsPanel');
    expect(petsPanel).toContain('profile-pet-card');
    expect(petsPanel).toContain("t('pages.profile.deletePetConfirm')");
    expect(petsPanel).toContain('handleDeletePet(pet.id)');
    expect(petsPanel).toContain('openPetModal(pet)');
  });

  it('keeps profile orders panel modularized outside the page shell', () => {
    const source = readProfileSource();
    const panel = readProfileOrdersPanelSource();

    expect(source).toContain("from './profileOrdersPanel'");
    expect(source).toContain('<ProfileOrdersPanel');
    expect(source).toContain('getOrderActionHint={getOrderActionHint}');
    expect(source).not.toContain('data-profile-orders-load-recovery="true"');
    expect(source).not.toContain('className="profile-order-card"');
    expect(panel).toContain('export const ProfileOrdersPanel');
    expect(panel).toContain('data-profile-orders-load-recovery="true"');
    expect(panel).toContain('className="profile-order-card"');
    expect(panel).toContain('disabled={ordersStale} onClick={() => openReturnModal(order)}');
    expect(panel).toContain('handleContinuePayment(order)');
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

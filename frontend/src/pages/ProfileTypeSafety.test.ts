const readProfileSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8')
);
const readProfileHelpersSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../utils/profileHelpers.ts'), 'utf8')
);
const readProfilePaymentActionsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProfilePaymentActions.ts'), 'utf8')
);

const readProfileAddressActionsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProfileAddressActions.ts'), 'utf8')
);

const readProfilePetActionsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProfilePetActions.ts'), 'utf8')
);

const readProfileAccountActionsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProfileAccountActions.ts'), 'utf8')
);

const readProfileOrderActionsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, '../hooks/useProfileOrderActions.ts'), 'utf8')
);

const readProfileOrdersPanelSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileOrdersPanel.tsx'), 'utf8')
);

const readProfileAddressesPanelSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileAddressesPanel.tsx'), 'utf8')
);

const readProfilePetsPanelSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profilePetsPanel.tsx'), 'utf8')
);

const readProfileOrderDetailModalSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileOrderDetailModal.tsx'), 'utf8')
);

const readProfileReturnModalsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileReturnModals.tsx'), 'utf8')
);

const readProfilePaymentModalSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profilePaymentModal.tsx'), 'utf8')
);

const readProfileInfoPanelSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileInfoPanel.tsx'), 'utf8')
);

const readProfileAccountModalsSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'profileAccountModals.tsx'), 'utf8')
);

export {};

describe('Profile type-safety guard', () => {
  it('keeps profile recoverable failures typed without broad any escapes', () => {
    const source = readProfileSource();
    const helpers = readProfileHelpersSource();
    const paymentActions = readProfilePaymentActionsSource();
    const addressActions = readProfileAddressActionsSource();
    const petActions = readProfilePetActionsSource();
    const accountActions = readProfileAccountActionsSource();
    const orderActions = readProfileOrderActionsSource();
    const ordersPanel = readProfileOrdersPanelSource();
    const addressesPanel = readProfileAddressesPanelSource();
    const petsPanel = readProfilePetsPanelSource();
    const orderDetailModal = readProfileOrderDetailModalSource();
    const returnModals = readProfileReturnModalsSource();
    const paymentModal = readProfilePaymentModalSource();
    const infoPanel = readProfileInfoPanelSource();
    const accountModals = readProfileAccountModalsSource();
    const surface = `${source}\n${helpers}\n${paymentActions}\n${addressActions}\n${petActions}\n${accountActions}\n${orderActions}\n${ordersPanel}\n${addressesPanel}\n${petsPanel}\n${orderDetailModal}\n${returnModals}\n${paymentModal}\n${infoPanel}\n${accountModals}`;

    expect(source).toContain('useProfileAddressActions({');
    expect(source).toContain('useProfilePetActions({');
    expect(source).toContain('useProfileAccountActions({');
    expect(source).toContain('useProfileOrderActions({');
    expect(addressActions).toContain('export const useProfileAddressActions');
    expect(petActions).toContain('export const useProfilePetActions');
    expect(accountActions).toContain('export const useProfileAccountActions');
    expect(orderActions).toContain('export const useProfileOrderActions');
    expect(ordersPanel).toContain('export const ProfileOrdersPanel');
    expect(source).toContain('<ProfileOrdersPanel');
    expect(addressesPanel).toContain('export const ProfileAddressesPanel');
    expect(petsPanel).toContain('export const ProfilePetsPanel');
    expect(source).toContain('<ProfileAddressesPanel');
    expect(source).toContain('<ProfilePetsPanel');
    expect(orderDetailModal).toContain('export const ProfileOrderDetailModal');
    expect(returnModals).toContain('export const ProfileReturnModals');
    expect(paymentModal).toContain('export const ProfilePaymentModal');
    expect(source).toContain('<ProfileOrderDetailModal');
    expect(source).toContain('<ProfileReturnModals');
    expect(source).toContain('<ProfilePaymentModal');
    expect(infoPanel).toContain('export const ProfileInfoPanel');
    expect(accountModals).toContain('export const ProfileAccountModals');
    expect(source).toContain('<ProfileInfoPanel');
    expect(source).toContain('<ProfileAccountModals');
    expect(addressActions).toContain('} catch (err: unknown) {');
    expect(petActions).toContain('} catch (err: unknown) {');
    expect(accountActions).toContain('} catch (err: unknown) {');
    expect(orderActions).toContain('} catch (err: unknown) {');

    expect(surface).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|any\[\]/);
    expect(surface).not.toContain('err?.errorFields');
    expect(surface).not.toContain('err.response?.data');
    expect(helpers).toContain('export const isFormValidationError = (error: unknown): error is FormValidationError =>');
    expect(helpers).toContain('export const getProfileApiErrorData = (error: unknown): Record<string, unknown> =>');
    expect(helpers).toContain('export const getProfileApiErrorCode = (error: unknown) =>');
    expect(accountActions).toContain("import { getApiErrorMessage } from '../utils/apiError';");
    expect(orderActions).toContain("import { getApiErrorMessage } from '../utils/apiError';");
    expect(accountActions).toContain('if (isFormValidationError(err)) {');
    expect(accountActions).toContain('focusProfileModalFormError');
    expect(accountActions).toMatch(/if \(isFormValidationError\(err\)\) \{[\s\S]*?return;/);
    expect(paymentActions).toContain("announceAccessibleMessage(getApiErrorMessage(err, latestT('pages.profile.continuePayFailed'), latestLanguage, { includeClientMessage: true }), 'error')");
  });

  it('keeps payment-return synchronization off the mutable orders dependency', () => {
    const source = readProfileSource();
    const syncStart = source.indexOf('const syncPaymentReturnState = useCallback(async (order: OrderCustomer) => {');
    const addressesStart = source.indexOf('const fetchAddresses = useCallback(async () => {', syncStart);
    const syncSource = source.slice(syncStart, addressesStart);
    const paymentReturnEffectStart = source.indexOf("if (paymentReturnStatus !== 'success') return;");
    const emailCodeEffectStart = source.indexOf('if (profileEmailCodeCountdown <= 0) return;', paymentReturnEffectStart);
    const paymentReturnEffectSource = source.slice(paymentReturnEffectStart, emailCodeEffectStart);

    expect(source).toContain('const [ordersInitialLoadComplete, setOrdersInitialLoadComplete] = useState(false);');
    expect(source).toContain('const ordersRef = useRef<OrderCustomer[]>([]);');
    expect(source).toContain('const paymentReturnSyncSeqRef = useRef(0);');
    expect(source).toContain('paymentReturnSyncSeqRef.current += 1;');
    expect(source).toContain('ordersRef.current = sortedOrders;');
    expect(source).toContain('setOrdersInitialLoadComplete(true);');
    expect(source).toContain("if (!ordersInitialLoadComplete) return;");
    expect(source).toContain('const targetOrder = ordersRef.current.find(');
    expect(syncStart).toBeGreaterThan(-1);
    expect(addressesStart).toBeGreaterThan(syncStart);
    expect(paymentReturnEffectStart).toBeGreaterThan(-1);
    expect(emailCodeEffectStart).toBeGreaterThan(paymentReturnEffectStart);
    expect(syncSource).toContain('const syncSeq = paymentReturnSyncSeqRef.current + 1;');
    expect(syncSource).toContain('paymentReturnSyncSeqRef.current = syncSeq;');
    expect(syncSource).toContain('const isCurrentPaymentReturnSync = () => mountedRef.current && paymentReturnSyncSeqRef.current === syncSeq;');
    expect(syncSource).toContain('const paymentListRes = await paymentApi.syncByOrder(order.id);');
    expect(syncSource).toContain('const mergedPayments = paymentListRes.data || [];');
    expect(syncSource).not.toContain('paymentApi.getByOrder(order.id)');
    expect(syncSource).not.toContain('paymentApi.sync(payment.id)');
    expect(syncSource).not.toContain('Promise.all(paymentList.map');
    expect(syncSource.match(/if \(!isCurrentPaymentReturnSync\(\)\) return;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(syncSource).toContain('await fetchOrders();');
    expect(paymentReturnEffectSource).toContain('syncPaymentReturnState(targetOrder).catch(() => {');
    expect(paymentReturnEffectSource).toContain('if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {');
    expect(paymentReturnEffectSource).toContain("announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.paymentReturnSyncFailed'), 'error')");
    expect(paymentReturnEffectSource.indexOf('if (mountedRef.current && handledPaymentReturnRef.current === returnKey) {')).toBeLessThan(paymentReturnEffectSource.indexOf("announceAccessibleMessage(profileLocalizationRef.current.t('pages.profile.paymentReturnSyncFailed'), 'error')"));
    expect(source).toMatch(/\}, \[fetchOrders, ordersInitialLoadComplete, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
    expect(source).not.toMatch(/\}, \[fetchOrders, orders, [^\]]*paymentReturnOrderId[^\]]*\]\);/);
  });
});

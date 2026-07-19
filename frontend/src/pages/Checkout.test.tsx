import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout, { formatCheckoutDateTime, getCheckoutCouponErrorMessage, isValidCheckoutPostalCode } from './Checkout';
import { addressApi, appConfigApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import { getLocalStorageItem } from '../utils/safeStorage';
import { hasAuthenticatedCartSession, readCheckoutCartItemIds } from '../utils/cartSession';
import { getGuestCartItems } from '../utils/guestCart';

const readCheckoutTestSource = () => require('fs').readFileSync(__filename, 'utf8') as string;
const readCheckoutPageSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Checkout.tsx'), 'utf8') as string;
const readCheckoutCssSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Checkout.css'), 'utf8') as string;
const readMobileAppCssSource = () => require('fs').readFileSync(require('path').resolve(__dirname, '../mobile-app.css'), 'utf8') as string;
const readProfilePageSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'Profile.tsx'), 'utf8') as string;
const readRegionDataSource = () => require('fs').readFileSync(require('path').resolve(__dirname, '../regionData.ts'), 'utf8') as string;

const expectDescribedByText = (field: HTMLElement, expectedText: string) => {
  const describedBy = field.getAttribute('aria-describedby') || '';
  expect(describedBy).toMatch(/\S/);
  const descriptionText = describedBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent || '')
    .join(' ');

  expect(descriptionText).toContain(expectedText);
};

jest.mock('../api', () => ({
  addressApi: { getByUser: jest.fn() },
  appConfigApi: { get: jest.fn() },
  cartApi: { getItems: jest.fn(), addItem: jest.fn() },
  couponApi: { quote: jest.fn() },
  orderApi: { checkout: jest.fn(), guestCheckout: jest.fn(), getById: jest.fn(), cancel: jest.fn() },
  paymentApi: { getChannels: jest.fn(), create: jest.fn(), simulateCallback: jest.fn(), getLatestByOrder: jest.fn() },
  productApi: { getAddOnCandidates: jest.fn(), getByIds: jest.fn() },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    market: { locale: 'en-US', freeShippingThreshold: 899, defaultShippingFee: 30 },
    formatMoney: (value: number | null | undefined = 0) => '$' + Number(value || 0).toFixed(2),
  }),
}));

jest.mock('../hooks/useAppConfig', () => ({
  useAppConfig: () => ({
    config: { runtimeMode: 'production', paymentSimulationEnabled: false, emailCodeEnabled: false },
    loading: false,
  }),
}));

jest.mock('../i18n', () => {
  const labels: Record<string, string> = {
    'pages.checkout.title': 'Checkout',
    'pages.checkout.readinessEyebrow': 'Ready',
    'pages.checkout.savingsCoachSubtitle': 'Keep your order ready.',
    'pages.checkout.paymentUnavailable': 'Payment methods are temporarily unavailable',
    'pages.checkout.paymentUnavailableDescription': 'Checkout is paused until a configured payment channel is available. Please try again later or contact support.',
    'messages.retry': 'Retry',
    'pages.checkout.submitWithAmount': 'Submit {amount}',
    'pages.checkout.paymentConfidenceTitle': 'Payment confidence',
    'pages.checkout.paymentConfidenceDefault': 'Choose a payment method',
    'pages.checkout.paymentConfidenceSelected': '{method}',
    'pages.checkout.paymentRequired': 'Select a payment method',
    'pages.checkout.statusAnnouncementLabel': 'Checkout status updates',
    'pages.checkout.orderCreateFailed': 'Failed to create order, try again later',
    'pages.checkout.emptySelected': 'Nothing selected',
    'pages.checkout.backCart': 'Back to cart',
    'pages.checkout.validationErrorAnnouncementLabel': 'Checkout validation errors',
    'pages.checkout.validationErrorSummary': '{count} checkout field(s) need attention.',
    'pages.checkout.coupon': 'Coupon',
    'pages.checkout.couponErrorExpired': 'This coupon has expired. Choose another coupon or continue without it.',
    'pages.checkout.couponErrorMinimum': 'This order does not meet the coupon minimum. Add more items or choose another coupon.',
    'pages.checkout.couponUnavailable': 'The selected coupon is unavailable',
    'pages.checkout.couponOpportunityBuildText': 'Spend {amount} more for {value}.',
    'pages.checkout.couponOpportunityBuildTitle': 'Coupon within reach',
    'pages.checkout.couponOpportunityReview': 'Review coupons',
    'pages.checkout.paymentMethod': 'Payment method',
    'pages.checkout.itemSummary': '{count} item(s)',
    'pages.checkout.payable': 'Payable',
    'pages.checkout.shippingFee': 'Shipping fee',
    'pages.checkout.address': 'Address',
    'pages.checkout.contact': 'Contact',
    'pages.checkout.email': 'Email',
    'pages.checkout.emailRequired': 'Enter email',
    'pages.checkout.emailInvalid': 'Enter a valid email',
    'pages.checkout.guestHint': 'Guest checkout',
    'pages.checkout.recipient': 'Recipient',
    'pages.checkout.recipientRequired': 'Enter recipient',
    'pages.checkout.recipientMin': 'Recipient name must be at least 2 characters',
    'pages.checkout.phoneRequired': 'Enter phone',
    'pages.checkout.phoneInvalid': 'Enter a valid phone',
    'pages.checkout.region': 'Region',
    'pages.checkout.regionRequired': 'Select region',
    'pages.checkout.regionPlaceholder': 'Select region',
    'pages.checkout.detailAddress': 'Detail address',
    'pages.checkout.detailRequired': 'Enter detail address',
    'pages.checkout.detailMin': 'Enter at least 5 characters for the detailed address',
    'pages.checkout.detailPlaceholder': 'Street address',
    'pages.checkout.postalCode': 'Postal code',
    'pages.checkout.postalCodeRequired': 'Enter postal code',
    'pages.checkout.postalCodeInvalid': 'Invalid postal code',
    'pages.checkout.postalCodePlaceholder': 'Postal code',
    'pages.checkout.expressCheckout': 'Express checkout',
    'pages.checkout.itemList': 'Items',
    'pages.checkout.orderSummary': 'Order summary',
    'pages.checkout.defaultAddress': 'Default',
    'pages.checkout.useNewAddress': 'Use new address',
    'pages.checkout.selectCoupon': 'Select coupon',
    'pages.checkout.shippingFeeCalculating': 'Calculating shipping with the server',
    'pages.checkout.shippingFeeCalculatingDescription': 'Checkout will unlock after server confirmation.',
    'pages.checkout.shippingFeeCalculatingShort': 'Calculating shipping',
    'pages.checkout.shippingFeeUnavailable': 'Shipping fee is temporarily unavailable',
    'pages.checkout.shippingFeeUnavailableShort': 'Shipping unavailable',
    'pages.checkout.shippingFeeFallbackApplied': 'Coupon verification is unavailable; checkout will continue with estimated shipping of {fee}.',
    'pages.checkout.shippingFeeFallbackDescription': 'We removed unavailable coupon pricing for this attempt. You can place the order without a coupon or retry coupons before submitting.',
    'pages.payment.title': 'Payment',
    'pages.cart.browse': 'Browse products',
    'pages.cart.freeShippingUnlocked': 'Free shipping unlocked',
    'pages.cart.freeShippingRemaining': 'Free shipping in {amount}',
    'common.subtotal': 'Subtotal',
  };
  const t = (key: string, params: Record<string, string | number> = {}) => {
    let label = labels[key] || key.replace(/^\w+\./, '');
    Object.entries(params || {}).forEach(([name, value]) => {
      label = label.replace(`{${name}}`, String(value));
    });
    return label;
  };
  return {
    useLanguage: () => ({
      language: 'en',
      t,
    }),
  };
});

jest.mock('../utils/paymentMethods', () => ({
  createPaymentMethodDetails: (channels: Array<Record<'code' | 'displayName' | 'descriptionKey' | 'badgeKey' | 'market', string | undefined>> = []) => (Array.isArray(channels) ? channels : []).map((channel) => ({
    value: channel.code,
    title: channel.displayName || channel.code,
    descriptionKey: channel.descriptionKey || 'pages.checkout.paymentGenericDesc',
    badgeKey: channel.badgeKey || 'pages.checkout.paymentWallet',
    market: channel.market || 'GLOBAL',
  })),
  paymentMethodLabel: (method: string) => method,
}));

jest.mock('../utils/conversionConfig', () => ({
  conversionConfig: {
    paymentRecommendation: { enabled: false, byCurrency: {}, fallback: [] },
    giftAtCheckout: { enabled: false, thresholdsByCurrency: {}, giftNameKey: '' },
    checkout: { autoSelectBestCoupon: false },
    addOnAssistant: { enabled: false, maxSuggestions: 0, maxFallbackSuggestions: 0 },
  },
  getDeliveryPromise: () => ({ enabled: false }),
  getLowStockCount: () => null,
}));

jest.mock('../utils/cartBenefits', () => ({
  getGiftThreshold: () => 0,
  getNearestCartBenefitTarget: () => null,
}));

jest.mock('../utils/productMedia', () => ({
  productImageFallback: '/fallback.png',
  resolveProductImage: (value: string) => value,
}));

jest.mock('../utils/selectedSpecs', () => ({
  formatSelectedSpecs: () => '',
}));

jest.mock('../components/AddOnAssistant', () => () => null);

jest.mock('../utils/cartSession', () => ({
  clearCheckoutCartItemIds: jest.fn(),
  hasAuthenticatedCartSession: jest.fn(() => true),
  readCheckoutCartItemIds: jest.fn(() => [1]),
  syncCheckoutCartItemIds: jest.fn(),
}));

jest.mock('../utils/guestCart', () => ({
  addGuestCartItem: jest.fn(),
  getGuestCartItems: jest.fn(() => []),
  removeGuestCartItems: jest.fn(),
}));

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn(),
  getSessionStorageItem: jest.fn(),
  removeSessionStorageItem: jest.fn(),
  setSessionStorageItem: jest.fn(),
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

describe('Checkout payment availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getLocalStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'token') return 'token';
      if (key === 'userId') return '7';
      return null;
    });
    (hasAuthenticatedCartSession as jest.Mock).mockImplementation(() => true);
    (readCheckoutCartItemIds as jest.Mock).mockImplementation(() => [1]);
    (getGuestCartItems as jest.Mock).mockReturnValue([]);
    (appConfigApi.get as jest.Mock).mockResolvedValue({ data: { runtimeMode: 'production', paymentSimulationEnabled: false, emailCodeEnabled: false } });
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({ data: [] });
    (cartApi.getItems as jest.Mock).mockResolvedValue({
      data: [{
        id: 1,
        userId: 7,
        productId: 101,
        quantity: 1,
        productName: 'Pet food',
        imageUrl: 'https://cdn.example.com/pet-food.jpg',
        price: 120,
        stock: 5,
        productStatus: 'ACTIVE',
      }],
    });
    (addressApi.getByUser as jest.Mock).mockResolvedValue({
      data: [{
        id: 1,
        userId: 7,
        recipientName: 'Alex',
        phone: '555-0100',
        region: ['\u4e2d\u56fd', 'Beijing', 'Beijing', 'Chaoyang'],
        postalCode: '100000',
        detailAddress: '100 Pet Commerce St',
        address: '\u4e2d\u56fd Beijing Beijing Chaoyang 100000 100 Pet Commerce St',
        isDefault: true,
      }],
    });
    (couponApi.quote as jest.Mock).mockResolvedValue({
      data: {
        subtotal: 120,
        discountAmount: 0,
        shippingFee: 30,
        payableAmount: 150,
        availableCoupons: [],
      },
    });
  });

  it('shows payment unavailable state and does not submit checkout', async () => {
    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const paymentUnavailableMessages = await screen.findAllByText('Payment methods are temporarily unavailable');
    expect(paymentUnavailableMessages.length).toBeGreaterThan(0);

    const submitButton = document.querySelector('.checkout-page__submitButton') as HTMLButtonElement | null;
    expect(submitButton).toBeTruthy();
    expect(submitButton).toBeDisabled();

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(orderApi.checkout).not.toHaveBeenCalled();
      expect(orderApi.guestCheckout).not.toHaveBeenCalled();
      expect(paymentApi.create).not.toHaveBeenCalled();
    });
  });

  it('renders payment method radios from configured checkout channels', async () => {
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{
        code: 'STRIPE',
        displayName: 'Stripe',
        descriptionKey: 'pages.checkout.paymentStripeDesc',
        badgeKey: 'pages.checkout.paymentInstant',
        market: 'GLOBAL',
        enabled: true,
      }],
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('radio', { name: /Stripe/ }, { timeout: 5000 })).toHaveClass('checkout-page__paymentMethod');
    expect(screen.queryByText('Payment methods are temporarily unavailable')).not.toBeInTheDocument();
  });

  it('surfaces checkout payment channel load errors and retries the channel request', async () => {
    (paymentApi.getChannels as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { error: 'Gateway configuration unavailable' } } })
      .mockResolvedValueOnce({
        data: [{
          code: 'STRIPE',
          displayName: 'Stripe',
          descriptionKey: 'pages.checkout.paymentStripeDesc',
          badgeKey: 'pages.checkout.paymentInstant',
          market: 'GLOBAL',
          enabled: true,
        }],
      });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const gatewayErrors = await screen.findAllByText('Gateway configuration unavailable');
    expect(gatewayErrors.length).toBeGreaterThan(0);
    expect(paymentApi.getChannels).toHaveBeenCalledTimes(1);

    const retryButtons = await screen.findAllByRole('button', { name: 'Retry' });
    fireEvent.click(retryButtons[0]);

    expect(await screen.findByRole('radio', { name: /Stripe/ }, { timeout: 5000 })).toHaveClass('checkout-page__paymentMethod');
    expect(paymentApi.getChannels).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByText('Gateway configuration unavailable')).toHaveLength(0);
  });

  it('keeps the checkout region Cascader controlled and closes it during scroll-sensitive actions', () => {
    const source = readCheckoutPageSource();

    expect(source).toContain('checkoutRegionCascaderOpen');
    expect(source).toContain('loadCheckoutRegionOptions');
    expect(source).toContain('loadRegionData');
    expect(source).toContain('regionOptionsLanguage === language');
    expect(source).toContain('loadRegionData(language)');
    expect(source).toContain('setRegionOptionsLanguage(language)');
    expect(source).not.toContain('regionData }');
    expect(source).toContain('open={checkoutRegionCascaderOpen}');
    expect(source).toContain('onOpenChange={setCheckoutRegionCascaderVisibility}');
    expect(source).not.toContain('popupVisible={checkoutRegionCascaderOpen}');
    expect(source).not.toContain('onPopupVisibleChange={setCheckoutRegionCascaderVisibility}');
    expect(source).toContain('classList.toggle');
    expect(source).toContain("element.style.setProperty('display', 'none', 'important')");
    expect(source).toContain('element.remove();');
    expect(source).toContain('void loadCheckoutRegionOptions();');
    expect(source).toContain('options={regionOptions}');
    expect(source).toContain("classList.add('checkout-page-active')");
    expect(source).toContain('handleCheckoutFormFocusCapture');
    expect(source).toContain('closeWhenScrollPositionChanges');
    expect(source).toContain('closeStaleCheckoutCascaderAfterScroll');
    expect(source).toContain('window.requestAnimationFrame(closeWhenScrollPositionChanges)');
    expect(source).toContain("window.addEventListener('scroll', closeOnViewportMove, true)");
    expect(source).toContain("document.addEventListener('scroll', closeOnViewportMove, true)");
    expect(source).toContain("document.addEventListener('keydown', closeOnEscape, true)");
    expect(source).toContain('closeCheckoutRegionCascader();');
  });

  it('keeps address region country labels localized for checkout and profile cascaders', () => {
    const checkoutSource = readCheckoutPageSource();
    const profileSource = readProfilePageSource();
    const regionDataSource = readRegionDataSource();

    expect(regionDataSource).toContain("en: 'China'");
    expect(regionDataSource).toContain("en: 'Mexico'");
    expect(regionDataSource).toContain("es: 'M\\u00e9xico'");
    expect(regionDataSource).toContain('label: localizedCountryLabels[region.value]?.[normalizedLanguage] || region.label');
    expect(regionDataSource).toContain('cachedLocalizedRegionData: Partial<Record<RegionLanguage, RegionOption[]>>');

    for (const source of [checkoutSource, profileSource]) {
      expect(source).toContain('regionOptionsLanguage === language');
      expect(source).toContain('loadRegionData(language)');
      expect(source).toContain('setRegionOptionsLanguage(language)');
      expect(source).toContain('options={regionOptions}');
      expect(source).not.toContain('loadRegionData()');
    }
  });

  it('requires saved addresses to carry independent region, postal code, and detail fields', () => {
    const checkoutSource = readCheckoutPageSource();
    const profileSource = readProfilePageSource();

    expect(checkoutSource).toContain("import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';");
    expect(checkoutSource).toContain('const getSavedAddressRegionPath = (address?: UserAddress | null) =>');
    expect(checkoutSource).toContain('const getSavedAddressPostalCode = (address?: UserAddress | null) =>');
    expect(checkoutSource).toContain('const getSavedAddressDetail = (address?: UserAddress | null) =>');
    expect(checkoutSource).toContain('const isCompleteSavedAddress = (address?: UserAddress | null) =>');
    expect(checkoutSource).toContain('const savedPostalCode = getSavedAddressPostalCode(address);');
    expect(checkoutSource).toContain('postalCode: savedPostalCode || undefined,');
    expect(checkoutSource).toContain('&& isValidCheckoutPostalCode(postalCode, regionPath)');
    expect(checkoutSource).toContain(': isCompleteSavedAddress(selectedSavedAddress)');
    expect(checkoutSource).toContain("throw new Error(t('pages.checkout.addressRequired'));");
    expect(checkoutSource).not.toContain('setPostalCode(address.postalCode || "")');
    expect(checkoutSource).not.toContain('&& normalizeCheckoutText(selectedSavedAddress.address, 260)');

    expect(profileSource).toContain("import { isValidRegionalPostalCode, normalizeRegionalPostalCode } from '../utils/postalCode';");
    expect(profileSource).toContain('const isCompleteProfileAddress = (address?: UserAddress | null) =>');
    expect(profileSource).toContain('region: regionPath,');
    expect(profileSource).toContain('postalCode,');
    expect(profileSource).toContain('detailAddress,');
    expect(profileSource).toContain("name=\"postalCode\"");
    expect(profileSource).toContain("addressForm.setFields([{ name: 'postalCode', errors: [t('pages.profile.postalCodeInvalid')] }]);");
  });

  it('allows checkout to continue with no-coupon fallback pricing when coupon quote fails', () => {
    const source = readCheckoutPageSource();
    const localeSources = ['en', 'zh', 'es'].map((locale) => require('fs').readFileSync(require('path').resolve(__dirname, `../locales/${locale}.json`), 'utf8') as string);

    expect(source).toContain("const shippingQuoteFailed = requiresBackendShippingQuote && couponQuoteStatus === 'error';");
    expect(source).toContain('const shippingQuoteFallbackActive = shippingQuoteFailed && !selectedUserCouponId;');
    expect(source).toContain('|| shippingQuoteFallbackActive;');
    expect(source).toContain("t('pages.checkout.shippingFeeFallbackApplied', { fee: formatMoney(shippingFee) })");
    expect(source).toContain("couponQuoteErrorMessage || t('pages.checkout.shippingFeeFallbackDescription')");
    expect(source).toContain('shippingQuotePending || shippingQuoteUnavailable || shippingQuoteFallbackActive');
    expect(source).toContain("type={shippingQuoteUnavailable ? 'error' : shippingQuoteFallbackActive ? 'warning' : 'info'}");

    for (const localeSource of localeSources) {
      expect(localeSource).toContain('shippingFeeFallbackApplied');
      expect(localeSource).toContain('shippingFeeFallbackDescription');
    }
  });

  it('requires meaningful recipient and detailed address lengths before checkout can submit', () => {
    const source = readCheckoutPageSource();
    const localeSources = ['en', 'zh', 'es'].map((locale) => require('fs').readFileSync(require('path').resolve(__dirname, `../locales/${locale}.json`), 'utf8') as string);

    expect(source).toContain('const CHECKOUT_RECIPIENT_MIN_LENGTH = 2;');
    expect(source).toContain('const CHECKOUT_DETAIL_ADDRESS_MIN_LENGTH = 5;');
    expect(source).toContain('const hasCompleteCheckoutRecipientName = (value: unknown) =>');
    expect(source).toContain('const hasCompleteCheckoutDetailAddress = (value: unknown) =>');
    expect(source).toContain('&& hasCompleteCheckoutRecipientName(address.recipientName)');
    expect(source).toContain('&& hasCompleteCheckoutDetailAddress(getSavedAddressDetail(address))');
    expect(source).toContain('hasCompleteCheckoutRecipientName(currentRecipientName)');
    expect(source).toContain('hasCompleteCheckoutDetailAddress(currentShippingAddress)');
    expect(source).toContain("Promise.reject(new Error(t('pages.checkout.recipientMin')))");
    expect(source).toContain("Promise.reject(new Error(t('pages.checkout.detailMin')))");

    for (const localeSource of localeSources) {
      expect(localeSource).toContain('recipientMin');
      expect(localeSource).toContain('detailMin');
    }
  });

  it('resets the mounted guard on effect mount so StrictMode does not drop payment channels', () => {
    const source = readCheckoutPageSource();
    const mountedGuardSource = source.slice(source.indexOf('useEffect(() => {\n    mountedRef.current = true;'));

    expect(mountedGuardSource).toContain('mountedRef.current = true;');
    expect(mountedGuardSource).toContain('mountedRef.current = false;');
  });

  it('loads payment channels from a guarded effect instead of during render', () => {
    const source = readCheckoutPageSource();
    const componentStart = source.indexOf('const CheckoutContent: React.FC<CheckoutContentProps> = ({ form }) => {');
    const channelsEffectStart = source.indexOf('useEffect(() => {\n    if (!hasCheckoutItems) {', componentStart);
    const channelsEffectEnd = source.indexOf('}, [currency, form, hasCheckoutItems, paymentChannelsReloadKey]);', channelsEffectStart);
    const renderBeforeChannelsEffect = source.slice(componentStart, channelsEffectStart);
    const channelsEffect = source.slice(channelsEffectStart, channelsEffectEnd);

    expect(componentStart).toBeGreaterThan(-1);
    expect(channelsEffectStart).toBeGreaterThan(componentStart);
    expect(channelsEffectEnd).toBeGreaterThan(channelsEffectStart);
    expect(renderBeforeChannelsEffect).not.toContain('paymentApi.getChannels()');
    expect(channelsEffect).toContain('paymentApi.getChannels()');
    expect(channelsEffect).toContain('let disposed = false;');
    expect(channelsEffect).toContain('setPaymentChannelsLoading(true);');
    expect(channelsEffect).toContain('setPaymentChannelsError(null);');
    expect(channelsEffect).toContain('if (disposed || !mountedRef.current) return;');
    expect(channelsEffect).toContain('setPaymentChannelsError(getApiErrorMessage(');
    expect(channelsEffect).toContain('setPaymentChannelsLoading(false);');
    expect(channelsEffect).toContain('disposed = true;');
    expect(source).toContain('const [paymentChannelsError, setPaymentChannelsError] = useState<string | null>(null);');
    expect(source).toContain('const [paymentChannelsReloadKey, setPaymentChannelsReloadKey] = useState(0);');
    expect(source).toContain('description={paymentChannelsError || t(\'pages.checkout.paymentUnavailableDescription\')}');
    expect(source).toContain('onClick={() => setPaymentChannelsReloadKey((key) => key + 1)}');
    expect(channelsEffect).not.toContain('.catch(() => {');
  });

  it('keeps payment timers lifecycle-bound without delayed location redirects', () => {
    const source = readCheckoutPageSource();
    const refreshEffectStart = source.indexOf('if (!createdOrderId || payment || !pendingPaymentMethod) return;');
    const pollingEffectStart = source.indexOf("if (!createdOrderId || paymentStatus !== 'PENDING') return;");
    const postCheckoutBranchStart = source.indexOf('if (loading) {');
    const refreshEffect = source.slice(refreshEffectStart, pollingEffectStart);
    const pollingEffect = source.slice(pollingEffectStart, postCheckoutBranchStart);

    expect(source).not.toContain('window.location.href');
    expect(source).not.toMatch(/setTimeout\s*\([\s\S]{0,400}window\.location/);
    expect(source).toContain("import { addressApi, cartApi, clearStoredAuthSession, couponApi, createApiAbortController, orderApi, paymentApi, productApi } from '../api';");
    expect(refreshEffectStart).toBeGreaterThan(-1);
    expect(pollingEffectStart).toBeGreaterThan(refreshEffectStart);
    expect(postCheckoutBranchStart).toBeGreaterThan(pollingEffectStart);
    expect(refreshEffect).toContain('let disposed = false;');
    expect(refreshEffect).toContain('const abortController = createApiAbortController();');
    expect(refreshEffect).toContain('const timer = window.setTimeout(async () => {');
    expect(refreshEffect).toContain('if (disposed || abortController.signal.aborted) return;');
    expect(refreshEffect).toContain('{ signal: abortController.signal },');
    expect(refreshEffect).toContain('if (!disposed && !abortController.signal.aborted) {');
    expect(refreshEffect).toContain('window.clearTimeout(timer);');
    expect(refreshEffect).toContain('abortController.abort();');
    expect(pollingEffect).toContain('let pollAbortController: AbortController | null = null;');
    expect(pollingEffect).toContain('const abortActivePollRequest = () => {');
    expect(pollingEffect).toContain('pollAbortController?.abort();');
    expect(pollingEffect).toContain('const timer = window.setInterval(async () => {');
    expect(pollingEffect).toContain('if (disposed) {');
    expect(pollingEffect).toContain('if (disposed || !ownsThisPoll) return;');
    expect(pollingEffect).toContain('const abortController = createApiAbortController();');
    expect(pollingEffect).toContain('pollAbortController = abortController;');
    expect(pollingEffect).toContain('{ signal: abortController.signal },');
    expect(pollingEffect).toContain('if (disposed || abortController.signal.aborted) return;');
    expect(pollingEffect).toContain('if (disposed) return;');
    expect(pollingEffect).toContain('window.clearInterval(timer);');
    expect(pollingEffect).toContain("window.removeEventListener('storage', handlePaymentPollStorage);");
    expect(pollingEffect).toContain('abortActivePollRequest();');
    expect(source).toContain('const paymentStatus = payment?.status;');
    expect(source).toContain('}, [createdOrderId, createdOrderNo, guestPaymentEmail, paymentStatus, showCheckoutMessage, t]);');
    expect(pollingEffect).not.toMatch(/}, \[[^\]]*\bpayment\b[^\]]*\]\);/);
  });

  it('ignores stale retry payment responses after a newer retry starts', () => {
    const source = readCheckoutPageSource();
    const retryStart = source.indexOf('const retryCreatePayment = async () => {');
    const retryEnd = source.indexOf('const openPaymentUrl = () => {', retryStart);
    const retrySource = source.slice(retryStart, retryEnd);

    expect(source).toContain('const paymentCreateRequestSeqRef = React.useRef(0);');
    expect(retrySource).toContain('const requestSeq = paymentCreateRequestSeqRef.current + 1;');
    expect(retrySource).toContain('paymentCreateRequestSeqRef.current = requestSeq;');
    expect(retrySource).toContain('if (paymentCreateRequestSeqRef.current !== requestSeq) return;');
    expect(retrySource).toContain('if (paymentCreateRequestSeqRef.current === requestSeq) {');
    expect(retrySource).toContain('setPaying(false);');
    expect(retrySource.indexOf('if (paymentCreateRequestSeqRef.current !== requestSeq) return;')).toBeLessThan(retrySource.indexOf('setPayment(paymentRes.data);'));
    expect(retrySource.lastIndexOf('if (paymentCreateRequestSeqRef.current !== requestSeq) return;')).toBeLessThan(retrySource.indexOf('setPaymentCreateError(localizedError);'));
  });

  it('keeps checkout order submission guarded by a synchronous in-flight latch', () => {
    const source = readCheckoutPageSource();
    const handleStart = source.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const handleEnd = source.indexOf('const retryCreatePayment = async () => {', handleStart);
    const handleSubmitSource = source.slice(handleStart, handleEnd);

    expect(handleStart).toBeGreaterThan(-1);
    expect(handleEnd).toBeGreaterThan(handleStart);
    expect(source).toContain('const submittingRef = React.useRef(false);');
    expect(handleSubmitSource).toContain('if (submittingRef.current) {\n      return;\n    }\n    submittingRef.current = true;');
    expect(handleSubmitSource).toContain('} finally {\n      submittingRef.current = false;\n    }');
    expect(handleSubmitSource.indexOf('submittingRef.current = true;')).toBeLessThan(handleSubmitSource.indexOf('setSubmitting(true);'));
    expect(handleSubmitSource.lastIndexOf('setSubmitting(false);')).toBeLessThan(handleSubmitSource.lastIndexOf('submittingRef.current = false;'));
  });

  it('keeps checkout payment actions guarded by synchronous in-flight latches', () => {
    const source = readCheckoutPageSource();
    const retryStart = source.indexOf('const retryCreatePayment = async () => {');
    const retryEnd = source.indexOf('const openPaymentUrl = () => {', retryStart);
    const simulateStart = source.indexOf('const simulatePayment = async () => {');
    const simulateEnd = source.indexOf('const restoreSubmittedCartItems = async () => {', simulateStart);
    const retrySource = source.slice(retryStart, retryEnd);
    const simulateSource = source.slice(simulateStart, simulateEnd);

    expect(retryStart).toBeGreaterThan(-1);
    expect(retryEnd).toBeGreaterThan(retryStart);
    expect(simulateStart).toBeGreaterThan(-1);
    expect(simulateEnd).toBeGreaterThan(simulateStart);
    expect(source).toContain('const paymentRetryingRef = React.useRef(false);');
    expect(source).toContain('const paymentSimulatingRef = React.useRef(false);');
    expect(retrySource).toContain('if (!createdOrder || paymentRetryingRef.current) return;\n    paymentRetryingRef.current = true;');
    expect(retrySource).toContain('paymentRetryingRef.current = false;');
    expect(retrySource.indexOf('paymentRetryingRef.current = true;')).toBeLessThan(retrySource.indexOf('setPaying(true);'));
    expect(retrySource.lastIndexOf('setPaying(false);')).toBeLessThan(retrySource.lastIndexOf('paymentRetryingRef.current = false;'));
    expect(simulateSource).toContain('if (!payment || paymentSimulatingRef.current) return;\n    paymentSimulatingRef.current = true;');
    expect(simulateSource).toContain('paymentSimulatingRef.current = false;');
    expect(simulateSource.indexOf('paymentSimulatingRef.current = true;')).toBeLessThan(simulateSource.indexOf('setSimulatingPayment(true);'));
    expect(simulateSource.lastIndexOf('setSimulatingPayment(false);')).toBeLessThan(simulateSource.lastIndexOf('paymentSimulatingRef.current = false;'));
  });

  it('keeps guest checkout drafts until guest payment is confirmed paid', () => {
    const source = readCheckoutPageSource();
    const submitStart = source.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const submitEnd = source.indexOf('const retryCreatePayment = async () => {', submitStart);
    const submitSource = source.slice(submitStart, submitEnd);
    const paidCleanup = "if (guestPaymentEmail && normalizeStatusCode(paymentStatus) === 'PAID') {\n      removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);\n    }";

    expect(submitStart).toBeGreaterThan(-1);
    expect(submitEnd).toBeGreaterThan(submitStart);
    expect(submitSource).not.toContain('removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);');
    expect(source).toContain(paidCleanup);
    expect(source.indexOf(paidCleanup)).toBeGreaterThan(source.indexOf('const paymentStatus = payment?.status;'));
  });

  it('keeps checkout bootstrap independent of address and payment field state changes', () => {
    const source = readCheckoutPageSource();
    const loadEffectStart = source.indexOf('const selectedCartItemIds = readCheckoutCartItemIds();');
    const nextAddressEffectStart = source.indexOf('useEffect(() => {\n    if (!hasCheckoutItems) return;\n    if (selectedAddressId', loadEffectStart);
    const loadEffect = source.slice(loadEffectStart, nextAddressEffectStart);

    expect(loadEffectStart).toBeGreaterThan(-1);
    expect(nextAddressEffectStart).toBeGreaterThan(loadEffectStart);
    expect(source).not.toContain('useMemo(() => readCheckoutCartItemIds(), [])');
    expect(loadEffect).toContain('const selectedCartItemIds = readCheckoutCartItemIds();');
    expect(loadEffect).toContain('cartApi.getItems(0)');
    expect(loadEffect).toContain('addressApi.getByUser(0)');
    expect(loadEffect).toContain('}, [checkoutReloadKey, form, mergeCheckoutFormSnapshot, navigate, showCheckoutMessage, t]);');
    expect(loadEffect).not.toContain('selectedAddressId');
    expect(loadEffect).not.toContain('watchedPaymentMethod');
    expect(loadEffect).not.toContain('pendingPaymentMethod');
  });

  it('memoizes cart total and item count from cart items', () => {
    const source = readCheckoutPageSource();

    expect(source).toContain('const cartTotal = useMemo(() => roundCartMoney(cartItems.reduce((sum, item) => {');
    expect(source).toContain('}, 0)), [cartItems]);');
    expect(source).toContain('const checkoutItemCount = useMemo(\n    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),\n    [cartItems],\n  );');
    expect(source).not.toContain('const cartTotal = roundCartMoney(cartItems.reduce');
    expect(source).not.toContain('const checkoutItemCount = cartItems.reduce');
  });

  it('keeps checkout form submit values typed without broad any escape hatches', () => {
    const source = readCheckoutPageSource();

    expect(source).toContain('type CheckoutFormValues = {');
    expect(source).toContain('type CheckoutFormSnapshot = Partial<CheckoutFormValues>;');
    expect(source).toContain('type CheckoutFormInstance = FormInstance<CheckoutFormValues>;');
    expect(source).toContain('Form.useForm<CheckoutFormValues>()');
    expect(source).toContain('const buildAddress = (values: CheckoutFormValues) => {');
    expect(source).toContain('const buildRecipientPayload = (values: CheckoutFormValues) => {');
    expect(source).toContain('const handleSubmit = async (values: CheckoutFormValues) => {');
    expect(source).toContain('React.useRef<CheckoutFormSnapshot | null>(null)');
    expect(source).toContain('useState<CheckoutFormSnapshot>');
    expect(source).toContain('React.useRef<CheckoutFormSnapshot>');
    expect(source).not.toContain('buildAddress = (values: any)');
    expect(source).not.toContain('buildRecipientPayload = (values: any)');
    expect(source).not.toContain('handleSubmit = async (values: any)');
    expect(source).not.toContain('React.useRef<Record<string, any>');
    expect(source).not.toContain('useState<Record<string, any>>');
  });

  it('keeps hoisted mock factories free of optional-parameter syntax', () => {
    const source = readCheckoutTestSource();
    const hoistedMocksSource = source.slice(0, source.indexOf('describe('));

    expect(hoistedMocksSource).not.toMatch(/\w+\?:/);
  });

  it('hides the gift incentive when the current currency has no configured threshold', () => {
    const source = readCheckoutPageSource();

    expect(source).toContain('const giftEligible = conversionConfig.giftAtCheckout.enabled && giftThreshold > 0;');
    expect(source).toContain('giftEligible ? {');
    expect(source).toContain('{giftEligible ? (');
    expect(source).not.toContain('{conversionConfig.giftAtCheckout.enabled ? (');
  });

  it('does not re-quote immediately after the backend auto-selects a coupon', () => {
    const source = readCheckoutPageSource();
    const quoteEffectStart = source.indexOf('const couponQuoteCartKey =');
    const quoteEffect = source.slice(quoteEffectStart, source.indexOf('const estimatedShippingSummary', quoteEffectStart));

    expect(source).toContain('const couponAutoSelectedQuoteRef = React.useRef<{ cartKey: string; couponId: number } | null>(null);');
    expect(quoteEffect).toContain('couponAutoSelectedQuoteRef.current?.cartKey === couponQuoteCartKey');
    expect(quoteEffect).toContain('couponAutoSelectedQuoteRef.current.couponId === selectedUserCouponId');
    expect(quoteEffect).toContain('couponAutoSelectedQuoteRef.current = null;');
    expect(quoteEffect).toContain('return;');
    expect(quoteEffect).toContain('if (nextCouponQuote.selectedUserCouponId === nextCouponId) {');
    expect(quoteEffect).toContain('couponAutoSelectedQuoteRef.current = { cartKey: couponQuoteCartKey, couponId: nextCouponId };');
  });

  it('keeps coupon quote status updates cleanup-bound', () => {
    const source = readCheckoutPageSource();
    const quoteEffectStart = source.indexOf('const couponQuoteCartKey =');
    const quoteEffect = source.slice(quoteEffectStart, source.indexOf('const estimatedShippingSummary', quoteEffectStart));

    const firstAsyncGuard = quoteEffect.indexOf('if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;');
    const readyStatus = quoteEffect.indexOf("setCouponQuoteStatus('ready');");
    const firstErrorStatus = quoteEffect.indexOf("setCouponQuoteStatus('error');");
    const catchGuard = quoteEffect.lastIndexOf('if (disposed || !mountedRef.current || couponQuoteSeqRef.current !== requestSeq) return;');
    const catchErrorStatus = quoteEffect.lastIndexOf("setCouponQuoteStatus('error');");

    expect(quoteEffect).toContain('let disposed = false;');
    expect(firstAsyncGuard).toBeGreaterThan(-1);
    expect(firstErrorStatus).toBeGreaterThan(firstAsyncGuard);
    expect(readyStatus).toBeGreaterThan(firstAsyncGuard);
    expect(catchGuard).toBeGreaterThan(firstAsyncGuard);
    expect(catchErrorStatus).toBeGreaterThan(catchGuard);
    expect(quoteEffect).toContain('return () => {\n      disposed = true;\n    };');
  });

  it('does not refetch coupon quotes for language-only changes', () => {
    const source = readCheckoutPageSource();
    const quoteEffectStart = source.indexOf('const couponQuoteCartKey =');
    const quoteEffect = source.slice(quoteEffectStart, source.indexOf('const estimatedShippingSummary', quoteEffectStart));

    expect(source).toContain('const checkoutLocalizationRef = React.useRef({ t, language });');
    expect(source).toContain('checkoutLocalizationRef.current = { t, language };');
    expect(quoteEffect).toContain('const { t: latestT } = checkoutLocalizationRef.current;');
    expect(quoteEffect).toContain('const { t: latestT, language: latestLanguage } = checkoutLocalizationRef.current;');
    expect(quoteEffect).toContain("getCheckoutCouponErrorMessage(error, latestT('pages.checkout.couponUnavailable'), latestT, latestLanguage)");
    expect(quoteEffect).toContain('}, [cartItems, cartTotal, couponManuallyChanged, selectedUserCouponId, showCheckoutMessage]);');
    expect(quoteEffect).not.toMatch(/\}, \[[^\]]*\blanguage\b[^\]]*\]\);/);
    expect(quoteEffect).not.toMatch(/\}, \[[^\]]*\bt\b[^\]]*\]\);/);
  });

  it('debounces guest checkout draft persistence while typing', () => {
    const source = readCheckoutPageSource();
    const effectStart = source.indexOf('if (!hasCheckoutItems || !isGuestCheckout) return;');
    const effectSource = source.slice(effectStart, source.indexOf('}, [hasCheckoutItems, isGuestCheckout', effectStart));

    expect(source).toContain('const CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS = 500;');
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectSource).toContain('const timer = window.setTimeout(() => {');
    expect(effectSource).toContain('setSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY, JSON.stringify(draft));');
    expect(effectSource).toContain('removeSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY);');
    expect(effectSource).toContain('}, CHECKOUT_GUEST_DRAFT_SAVE_DELAY_MS);');
    expect(effectSource).toContain('window.clearTimeout(timer);');
    expect(effectSource.indexOf('setSessionStorageItem(CHECKOUT_GUEST_DRAFT_KEY')).toBeGreaterThan(effectSource.indexOf('window.setTimeout'));
  });

  it('keeps malformed payment expiry timestamps out of the checkout result UI', () => {
    const source = readCheckoutPageSource();

    expect(formatCheckoutDateTime('not-a-date', 'en-US')).toBeNull();
    expect(formatCheckoutDateTime('', 'en-US')).toBeNull();
    expect(formatCheckoutDateTime('2026-06-14T00:00:00Z', 'en-US')).not.toBeNull();
    expect(source).toContain('export const formatCheckoutDateTime = (value: unknown, dateLocale: string) => {');
    expect(source).toContain('Number.isFinite(date.getTime()) ? date.toLocaleString(dateLocale) : null;');
    expect(source).toContain('const paymentExpiresAtText = formatCheckoutDateTime(payment.expiresAt, dateLocale);');
    expect(source).toContain("{paymentExpiresAtText ? <Text>{t('pages.checkout.paymentExpiresAt')}: {paymentExpiresAtText}</Text> : null}");
    expect(source).not.toContain('new Date(payment.expiresAt).toLocaleString(dateLocale)');
  });

  it('refreshes current product prices before restoring submitted guest cart items', () => {
    const source = readCheckoutPageSource();
    const restoreStart = source.indexOf('const restoreSubmittedCartItems = async () => {');
    const restoreSource = source.slice(restoreStart, source.indexOf('const rollbackPendingPayment = () => {', restoreStart));

    expect(source).toContain('const resolveGuestRestorePrice = (item: CartItem, product');
    expect(source).toContain('Product | null) => {');
    expect(restoreSource).toContain('productApi.getByIds(productIds, { bypassCache: true })');
    expect(restoreSource).toContain('latestProducts = new Map');
    expect(restoreSource).toContain('const restorePrice = resolveGuestRestorePrice(item, latestProduct);');
    expect(restoreSource).toContain('addGuestCartItem({');
    expect(restoreSource).toContain('price: restorePrice');
    expect(restoreSource).toContain('}, item.quantity, item.selectedSpecs, restorePrice);');
  });

  it('persists submitted checkout cart lines for rollback after payment-create recovery', () => {
    const source = readCheckoutPageSource();
    const submitStart = source.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const submitSource = source.slice(submitStart, source.indexOf('const retryCreatePayment = async () => {', submitStart));
    const restoreStart = source.indexOf('const restoreSubmittedCartItems = async () => {');
    const restoreSource = source.slice(restoreStart, source.indexOf('const rollbackPendingPayment = () => {', restoreStart));

    expect(submitStart).toBeGreaterThan(-1);
    expect(restoreStart).toBeGreaterThan(-1);
    expect(source).toContain('cartItems: CartItem[];');
    expect(source).toContain("const submittedCartItemsRef = React.useRef<CartItem[]>(initialPendingOrder?.cartItems || []);");
    expect(submitSource).toContain('const submittedCartItems = cartItems.map((item) => ({ ...item }));');
    expect(submitSource).toContain('submittedCartItemsRef.current = submittedCartItems;');
    expect(submitSource).toContain('persistCheckoutPendingOrder(orderRes.data, normalizedPaymentMethod, normalizedGuestEmail, submittedCartItems);');
    expect(restoreSource).toContain('const submittedCartItems = submittedCartItemsRef.current.length > 0 ? submittedCartItemsRef.current : cartItems;');
    expect(restoreSource).toContain('submittedCartItems,');
    expect(restoreSource).toContain('submittedCartItems.map((item) => item.productId)');
    expect(restoreSource).toContain('submittedCartItems.forEach((item) => {');
  });

  it('keys checkout item rows by the current cart item id', () => {
    const source = readCheckoutPageSource();
    const itemListStart = source.indexOf("title={t('pages.checkout.itemList')}");
    const itemListSource = source.slice(itemListStart, source.indexOf('<Divider />', itemListStart));

    expect(itemListStart).toBeGreaterThan(-1);
    expect(itemListSource).toContain('dataSource={cartItems}');
    expect(itemListSource).toContain('rowKey={(item) => item.id}');
  });

  it('keeps narrow mobile checkout pay bar CTA full-width and readable', () => {
    const checkoutCss = readCheckoutCssSource();
    const fixCss = checkoutCss.slice(checkoutCss.indexOf('F3411:'));

    expect(fixCss).toContain('@media (max-width: 430px)');
    expect(fixCss).toMatch(/\.checkout-page__mobilePayBar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page__mobilePayBar \.ant-btn\s*\{[^}]*width:\s*100%\s*!important;[^}]*white-space:\s*normal\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page__mobilePayBar \.ant-btn > span:not\(\.anticon\):not\(\.ant-btn-icon\)\s*\{[^}]*overflow:\s*visible\s*!important;[^}]*text-overflow:\s*clip\s*!important;[^}]*white-space:\s*normal\s*!important;/);
  });

  it('locks mobile checkout pay CTA text fill against App contrast overrides', () => {
    const checkoutCss = readCheckoutCssSource();
    const fixCss = checkoutCss.slice(checkoutCss.indexOf('UI-20260607-06: keep the mobile payment rail clear'));

    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.checkout-page__mobilePayBar \.ant-btn-primary,[\s\S]*?\.checkout-page__mobilePayBar \.ant-btn-primary \.checkout-page__submitAmountPending\s*\{[\s\S]*?color:\s*#ffffff\s*!important;[\s\S]*?-webkit-text-fill-color:\s*#ffffff\s*!important;[\s\S]*?text-shadow:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page__mobilePayBar \.ant-btn-primary:disabled,[\s\S]*?\.checkout-page__mobilePayBar \.ant-btn-primary:disabled :where\(span,\s*strong,\s*b,\s*\.ant-typography,\s*\.commerce-money\)\s*\{[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)\s*!important;[\s\S]*?-webkit-text-fill-color:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)\s*!important;/);
  });

  it('turns the mobile pay bar into the next required checkout action before submit is ready', () => {
    const source = readCheckoutPageSource();

    expect(source).toContain("htmlType={checkoutBlockingAction ? 'button' : 'submit'}");
    expect(source).toContain('onClick={checkoutBlockingAction ? handleCheckoutNextAction : undefined}');
    expect(source).toContain('disabled={!checkoutBlockingAction && checkoutSubmitDisabled}');
    expect(source).toContain('aria-label={checkoutBlockingAction ? checkoutConfirmationActionLabel : checkoutSubmitActionLabel}');
    expect(source).toContain('{checkoutBlockingAction ? checkoutNextActionLabel : renderSubmitWithAmount()}');
  });

  it('orders mobile checkout forms before promotional readiness content', () => {
    const checkoutCss = readCheckoutCssSource();
    const fixCss = checkoutCss.slice(checkoutCss.indexOf('Mobile checkout flow:'));

    expect(fixCss).toContain('@media (max-width: 780px)');
    expect(fixCss).toMatch(/\.checkout-page\s*\{[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page__heroStats,[\s\S]*?\.checkout-page__summaryStrip,[\s\S]*?\.checkout-page__trustBar,[\s\S]*?\.checkout-page__benefitStrip\s*\{[\s\S]*?display:\s*none\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page > form,[\s\S]*?\.checkout-page > \.ant-form\s*\{[\s\S]*?order:\s*4\s*!important;[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;/);
    expect(fixCss).toMatch(/#checkout-address-card\s*\{[\s\S]*?order:\s*1\s*!important;[\s\S]*?scroll-margin-top:\s*76px\s*!important;/);
    expect(fixCss).toMatch(/#checkout-payment-card\s*\{[\s\S]*?order:\s*3\s*!important;/);
  });

  it('keeps empty checkout trust signals readable at common phone widths', () => {
    const checkoutSource = readCheckoutPageSource();
    const checkoutCss = readCheckoutCssSource();
    const fixCss = checkoutCss.slice(checkoutCss.indexOf('F2723:'));

    expect(checkoutSource).toContain('className="checkout-page__emptySignals"');
    expect(checkoutSource).toContain("t('pages.checkout.trustSecureTitle')");
    expect(checkoutSource).toContain("t('pages.checkout.trustSupportTitle')");
    expect(checkoutCss.indexOf('F2723:')).toBeGreaterThan(checkoutCss.indexOf('Android UI closure: checkout fields, empty state and pay actions.'));
    expect(fixCss).toContain('@media (max-width: 420px)');
    expect(fixCss).toMatch(/\.checkout-page__emptySignals\s*\{[^}]*display:\s*grid\s*!important;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;[^}]*width:\s*min\(100%,\s*360px\)\s*!important;[^}]*justify-content:\s*stretch\s*!important;/);
    expect(fixCss).toMatch(/\.checkout-page__emptySignals span\s*\{[^}]*flex:\s*initial\s*!important;[^}]*justify-content:\s*flex-start\s*!important;[^}]*overflow-wrap:\s*normal\s*!important;[^}]*word-break:\s*normal\s*!important;[^}]*white-space:\s*normal\s*!important;/);
  });

  it('pins Android checkout pay bar to safe-area bottom when the bottom nav is hidden', () => {
    const mobileAppCss = readMobileAppCssSource();
    const checkoutPayBarRules = Array.from(
      mobileAppCss.matchAll(/body\.shop-mobile-app\.shop-mobile-app\.shop-mobile-app \.shop-app-shell--checkout-flow \.checkout-page__mobilePayBar\s*\{([^}]*)\}/g),
    );
    const checkoutPayBarBottomRules = checkoutPayBarRules
      .map((match) => match[1])
      .filter((rule) => rule.includes('bottom:'));
    const finalCheckoutPayBarBottomRule = checkoutPayBarBottomRules[checkoutPayBarBottomRules.length - 1] || '';
    const fixCss = mobileAppCss.slice(mobileAppCss.indexOf('F3412:'));

    expect(fixCss).toContain('@media (max-width: 860px)');
    expect(finalCheckoutPayBarBottomRule).toContain('bottom: max(var(--shop-mobile-floating-action-gap, 10px), env(safe-area-inset-bottom, 0px)) !important;');
    expect(finalCheckoutPayBarBottomRule).not.toContain('--shop-mobile-bottom-nav-height');
  });

  it('keeps Android address Cascader sizing on one safe-area viewport formula', () => {
    const mobileAppCss = readMobileAppCssSource();
    const cascaderCss = mobileAppCss.slice(mobileAppCss.indexOf('Address cascader: keep linked region menus inside phone-width App popups.'));
    const finalCascaderCss = mobileAppCss.slice(mobileAppCss.indexOf('Submitted BUG-14: App address cascader linked levels must stay inside the phone frame.'));

    expect(cascaderCss).toContain('--shop-address-cascader-available-height: calc(100vh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));');
    expect(cascaderCss).toContain('--shop-address-cascader-available-height: calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));');
    expect(cascaderCss).toContain('max-height: var(--shop-address-cascader-available-height) !important;');
    expect(cascaderCss).toContain('max-height: var(--shop-address-cascader-level-height) !important;');
    expect(finalCascaderCss).toContain('height: auto !important;');
    expect(finalCascaderCss).toContain('flex-direction: column !important;');
    expect(finalCascaderCss).toContain('max-height: var(--shop-address-cascader-available-height) !important;');
    expect(finalCascaderCss).toContain('height: var(--shop-address-cascader-level-height) !important;');
    expect(cascaderCss).not.toMatch(/\b(?:56|66)dvh\b/);
  });

  it('labels coupon opportunity actions with checkout context', async () => {
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{ code: 'STRIPE', displayName: 'Stripe', enabled: true }],
    });
    (couponApi.quote as jest.Mock).mockResolvedValue({
      data: {
        subtotal: 120,
        discountAmount: 0,
        shippingFee: 30,
        payableAmount: 150,
        availableCoupons: [{
          id: 20,
          couponName: 'Save 10',
          couponType: 'FULL_REDUCTION',
          thresholdAmount: 200,
          reductionAmount: 10,
        }],
      },
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const reviewCouponsButton = await screen.findByRole('button', {
      name: 'Review coupons: Coupon within reach',
    });
    expect(reviewCouponsButton).toHaveAttribute('title', 'Review coupons: Coupon within reach');
  });

  it('normalizes null coupon arrays from quote responses', async () => {
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{ code: 'STRIPE', displayName: 'Stripe', enabled: true }],
    });
    (couponApi.quote as jest.Mock).mockResolvedValue({
      data: {
        subtotal: 120,
        discountAmount: 0,
        shippingFee: 30,
        payableAmount: 150,
        availableCoupons: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('combobox', { name: 'Coupon: Select coupon' })).toBeInTheDocument();
    expect(screen.getByTitle('Coupon: Select coupon')).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: /Review coupons/,
    })).not.toBeInTheDocument();
  });

  it('maps coupon validation errors to specific localized checkout messages', () => {
    const t = (key: string) => ({
      'pages.checkout.couponErrorExpired': '优惠券已过期',
      'pages.checkout.couponErrorMinimum': '订单未达到优惠券门槛',
      'pages.checkout.couponUnavailable': '所选优惠券不可用',
    }[key] || key);

    expect(getCheckoutCouponErrorMessage({
      response: { status: 400, data: { error: 'Order amount does not meet coupon threshold' } },
    }, '所选优惠券不可用', t, 'zh')).toBe('订单未达到优惠券门槛');

    expect(getCheckoutCouponErrorMessage({
      response: { status: 400, data: { error: 'Coupon has expired' } },
    }, '所选优惠券不可用', t, 'zh')).toBe('优惠券已过期');
  });

  it('validates checkout postal codes against the selected region rules', () => {
    expect(isValidCheckoutPostalCode('100000', ['\u4e2d\u56fd', 'Beijing'])).toBe(true);
    expect(isValidCheckoutPostalCode('1000', ['\u4e2d\u56fd', 'Beijing'])).toBe(false);
    expect(isValidCheckoutPostalCode('01000', ['\u58a8\u897f\u54e5', 'Ciudad de M\u00e9xico'])).toBe(true);
    expect(isValidCheckoutPostalCode('0100A', ['\u58a8\u897f\u54e5', 'Ciudad de M\u00e9xico'])).toBe(false);
    expect(isValidCheckoutPostalCode('10001-1234', ['United States'])).toBe(true);
    expect(isValidCheckoutPostalCode('SW1A 1AA', ['United Kingdom'])).toBe(true);
  });

  it('shows specific coupon quote errors instead of the generic unavailable copy', async () => {
    (couponApi.quote as jest.Mock).mockRejectedValue({
      response: {
        status: 400,
        data: { error: 'Order amount does not meet coupon threshold' },
      },
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    expect(await screen.findByText('This order does not meet the coupon minimum. Add more items or choose another coupon.')).toBeInTheDocument();
    expect(screen.queryByText('The selected coupon is unavailable')).not.toBeInTheDocument();
  });

  it('announces checkout form validation errors in an aria-live region', async () => {
    (hasAuthenticatedCartSession as jest.Mock).mockImplementation(() => false);
    (readCheckoutCartItemIds as jest.Mock).mockImplementation(() => [901]);
    (getGuestCartItems as jest.Mock).mockReturnValue([{
      id: 901,
      userId: 0,
      productId: 101,
      quantity: 1,
      productName: 'Pet food',
      imageUrl: 'https://cdn.example.com/pet-food.jpg',
      price: 120,
      stock: 5,
      productStatus: 'ACTIVE',
    }]);
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{ code: 'STRIPE', displayName: 'Stripe', enabled: true }],
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const liveRegion = await screen.findByRole('status', { name: 'Checkout validation errors' });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('checkout field(s) need attention');
      expect(liveRegion).toHaveTextContent('Enter email');
      expect(liveRegion).toHaveTextContent('Enter recipient');
      expect(liveRegion).toHaveTextContent('Enter postal code');
    });
  });

  it('announces checkout status messages in an aria-live region', async () => {
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{ code: 'STRIPE', displayName: 'Stripe', enabled: true }],
    });
    (orderApi.checkout as jest.Mock).mockRejectedValueOnce({
      response: { status: 500, data: {} },
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const statusRegion = await screen.findByRole('status', { name: 'Checkout status updates' });
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion).toHaveAttribute('aria-atomic', 'true');

    expect(await screen.findByRole('radio', { name: /Stripe/ }, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => {
      const submitButton = document.querySelector('.checkout-page__submitButton') as HTMLButtonElement | null;
      expect(submitButton).toBeTruthy();
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(document.querySelector('.checkout-page__submitButton') as HTMLButtonElement);

    await waitFor(() => {
      expect(orderApi.checkout).toHaveBeenCalled();
      expect(screen.getByRole('status', { name: 'Checkout status updates' })).toHaveTextContent('Failed to create order, try again later');
    });
  });

  it('associates checkout validation errors with the fields that failed', async () => {
    (hasAuthenticatedCartSession as jest.Mock).mockImplementation(() => false);
    (readCheckoutCartItemIds as jest.Mock).mockImplementation(() => [901]);
    (getGuestCartItems as jest.Mock).mockReturnValue([{
      id: 901,
      userId: 0,
      productId: 101,
      quantity: 1,
      productName: 'Pet food',
      imageUrl: 'https://cdn.example.com/pet-food.jpg',
      price: 120,
      stock: 5,
      productStatus: 'ACTIVE',
    }]);
    (paymentApi.getChannels as jest.Mock).mockResolvedValue({
      data: [{ code: 'STRIPE', displayName: 'Stripe', enabled: true }],
    });

    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <Checkout />
      </MemoryRouter>,
    );

    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expectDescribedByText(screen.getByLabelText('Email'), 'Enter email');
      expectDescribedByText(screen.getByLabelText('Recipient'), 'Enter recipient');
      expectDescribedByText(screen.getByLabelText('Postal code'), 'Enter postal code');
    });
  });
});

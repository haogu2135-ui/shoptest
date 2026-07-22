import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { message } from 'antd';
import fs from 'fs';
import path from 'path';
import Cart, { deriveCartCheckoutMetrics } from './Cart';
import Checkout from './Checkout';
import { addressApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import { loadRegionData, type RegionOption } from '../regionData';
import { getGuestCartItems, removeGuestCartItems } from '../utils/guestCart';
import { clearCheckoutCartItemIds, hasAuthenticatedCartSession, readCheckoutCartItemIds, syncCheckoutCartItemIds } from '../utils/cartSession';
import { getSavedForLaterItems, saveCartItemForLater } from '../utils/saveForLater';
import { dispatchDomEvent } from '../utils/domEvents';
import { getApiErrorMessage } from '../utils/apiError';
import { announceAccessibleMessage } from '../utils/accessibleMessage';

const mockNavigate = jest.fn();
let mockLocalStorage: Record<string, string | null> = {};
let mockSessionStorage: Record<string, string | null> = {};
let mockGuestCartItems: any[] = [];
let mockCheckoutCartItemIds: number[] = [];
let cartCheckoutFlowFakeTimersActive = false;

const configureSafeStorageMock = () => {
  const safeStorage = jest.requireMock('../utils/safeStorage');
  safeStorage.getLocalStorageItem.mockImplementation((key: string) => (
    Object.prototype.hasOwnProperty.call(mockLocalStorage, key)
      ? mockLocalStorage[key]
      : window.localStorage.getItem(key)
  ));
  safeStorage.getSessionStorageItem.mockImplementation((key: string) => (
    Object.prototype.hasOwnProperty.call(mockSessionStorage, key)
      ? mockSessionStorage[key]
      : window.sessionStorage.getItem(key)
  ));
  safeStorage.removeLocalStorageItem.mockImplementation((key: string) => {
    delete mockLocalStorage[key];
    window.localStorage.removeItem(key);
    return true;
  });
  safeStorage.removeSessionStorageItem.mockImplementation((key: string) => {
    delete mockSessionStorage[key];
    window.sessionStorage.removeItem(key);
    return true;
  });
  safeStorage.setLocalStorageItem.mockImplementation((key: string, value: string) => {
    mockLocalStorage[key] = value;
    window.localStorage.setItem(key, value);
    return true;
  });
  safeStorage.setSessionStorageItem.mockImplementation((key: string, value: string) => {
    mockSessionStorage[key] = value;
    window.sessionStorage.setItem(key, value);
    return true;
  });
};


jest.mock('../utils/accessibleMessage', () => ({
  announceAccessibleMessage: jest.fn(),
  runWithoutAccessibleMessageAnnouncement: (fn: () => void) => fn(),
}));
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../api', () => ({
  createApiAbortController: () => new AbortController(),
  addressApi: { getByUser: jest.fn() },
  cartApi: {
    addItem: jest.fn(),
    getItems: jest.fn(),
    removeItem: jest.fn(),
    removeItems: jest.fn(),
    updateQuantity: jest.fn(),
  },
  clearStoredAuthSession: jest.fn(),
  couponApi: { quote: jest.fn() },
  orderApi: {
    cancel: jest.fn(),
    checkout: jest.fn(),
    getById: jest.fn(),
    guestCheckout: jest.fn(),
  },
  paymentApi: {
    create: jest.fn(),
    getChannels: jest.fn(),
    getLatestByOrder: jest.fn(),
    simulateCallback: jest.fn(),
  },
  productApi: {
    getAddOnCandidates: jest.fn(),
    getByIds: jest.fn(),
  },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    market: { locale: 'en-US', freeShippingThreshold: 100, defaultShippingFee: 5 },
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../hooks/useAppConfig', () => ({
  useAppConfig: () => ({
    config: { runtimeMode: 'production', paymentSimulationEnabled: false, emailCodeEnabled: false },
    loading: false,
  }),
}));

jest.mock('../i18n', () => {
  const humanizeKey = (key: string) => {
    const last = key.split('.').pop() || key;
    return last
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  };
  const labels: Record<string, string> = {
    'common.actions': 'Actions',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.loading': 'Loading',
    'common.quantity': 'Quantity',
    'common.siteTitle': 'ShopMX Pet Store',
    'common.subtotal': 'Subtotal',
    'common.total': 'Total',
    'messages.addCartSuccess': 'Added to cart',
    'messages.addFailed': 'Add failed',
    'messages.deleteFailed': 'Delete failed',
    'messages.deleteSuccess': 'Deleted',
    'messages.loadFailed': 'Load failed',
    'messages.operationFailed': 'Operation failed',
    'messages.retry': 'Retry',
    'nav.coupons': 'Coupons',
    'nav.history': 'History',
    'nav.petFinder': 'Pet finder',
    'pages.cart.blockedItems': '{count} blocked',
    'pages.cart.browse': 'Browse products',
    'pages.cart.checkout': 'Checkout',
    'pages.cart.checkoutSyncFailed': 'Checkout could not continue',
    'pages.cart.checkoutSyncing': 'Checkout after quantity sync',
    'pages.cart.chooseItems': 'Choose items',
    'pages.cart.clearUnavailable': 'Clear unavailable',
    'pages.cart.clearUnavailableConfirm': 'Remove {count} unavailable items?',
    'pages.cart.decreaseQuantity': 'Decrease quantity',
    'pages.cart.deleteConfirm': 'Delete this item?',
    'pages.cart.deleteSelected': 'Delete selected',
    'pages.cart.deleteSelectedConfirm': 'Delete {count} selected?',
    'pages.cart.drawerGiftUnlocked': 'Gift unlocked',
    'pages.cart.empty': 'Your cart is empty',
    'pages.cart.fetchFailed': 'Cart failed to load',
    'pages.cart.freeShippingRemaining': 'Free shipping in {amount}',
    'pages.cart.freeShippingUnlocked': 'You unlocked free shipping',
    'pages.cart.shippingCalculatedAtCheckout': 'Shipping calculated at checkout',
    'pages.cart.lowStockLeft': '{count} left',
    'pages.cart.moveAllToCart': 'Move all to cart',
    'pages.cart.moveToCart': 'Move to cart',
    'pages.cart.nextActionCheckoutText': 'Ready to checkout {amount}',
    'pages.cart.nextActionCheckoutTitle': 'Ready to checkout',
    'pages.cart.nextActionEyebrow': 'Cart status',
    'pages.cart.nextActionFindAddOn': 'Find add-ons',
    'pages.cart.product': 'Product',
    'pages.cart.quantityFailed': 'Quantity update failed',
    'pages.cart.increaseQuantity': 'Increase quantity',
    'pages.cart.readinessFreeShippingGap': '{amount} to free shipping',
    'pages.cart.readinessNeedsAction': 'Needs action',
    'pages.cart.readinessReady': 'Ready',
    'pages.cart.readinessSubtitle': '{selected} of {available} ready',
    'pages.cart.readyItems': '{count} ready',
    'pages.cart.recentAddToCart': 'Add to cart',
    'pages.cart.recentRecoverySubtitle': 'Recently viewed products',
    'pages.cart.recentRecoveryTitle': 'Recently viewed',
    'pages.cart.removeSelected': 'Remove selected',
    'pages.cart.removedSelected': 'Removed {count}',
    'pages.cart.saveForLater': 'Save for later',
    'pages.cart.saveForLaterShort': 'Save',
    'pages.cart.saveForLaterTitle': 'Saved for later',
    'pages.cart.savedValueText': '{count} saved worth {amount}',
    'pages.cart.savedValueTitle': 'Saved value',
    'pages.cart.saveForLaterEmpty': 'No saved items yet',
    'pages.cart.selectAll': 'Select all',
    'pages.cart.selectCheckoutReady': 'Select ready items',
    'pages.cart.selectedSummary': '{count} selected',
    'pages.cart.title': 'Cart',
    'pages.cart.unavailable': 'Unavailable',
    'pages.cart.unavailableSummary': '{count} unavailable',
    'pages.cart.unitPrice': 'Unit price',
    'pages.cart.yourCart': 'Your cart',
    'pages.checkout.address': 'Address',
    'pages.checkout.backCart': 'Back to cart',
    'pages.checkout.bestCoupon': 'Best coupon',
    'pages.checkout.channel': 'Channel',
    'pages.checkout.contact': 'Contact',
    'pages.checkout.coupon': 'Coupon',
    'pages.checkout.couponDiscount': 'Coupon discount',
    'pages.checkout.couponOpportunityReview': 'Review coupons',
    'pages.checkout.deliveryPromise': 'Delivery {window}',
    'pages.checkout.detailAddress': 'Detail address',
    'pages.checkout.detailPlaceholder': 'Street and number',
    'pages.checkout.detailRequired': 'Detail address required',
    'pages.checkout.defaultAddress': 'Default address',
    'pages.checkout.email': 'Email',
    'pages.checkout.emailInvalid': 'Invalid email',
    'pages.checkout.emailRequired': 'Email required',
    'pages.checkout.emptySelected': 'Nothing selected',
    'pages.checkout.expressCheckout': 'Express checkout',
    'pages.checkout.expressHint': 'Choose how to pay.',
    'pages.checkout.guestEmailPlaceholder': 'guest@example.com',
    'pages.checkout.guestHint': 'Guest checkout',
    'pages.checkout.itemList': 'Items',
    'pages.checkout.itemSummary': '{count} item(s)',
    'pages.checkout.localCard': 'Local card',
    'pages.checkout.nextActionAddress': 'Add address',
    'pages.checkout.nextActionPayment': 'Choose payment',
    'pages.checkout.nextActionReadyText': 'Ready to submit',
    'pages.checkout.nextActionReadyTitle': 'Ready',
    'pages.checkout.nextActionReviewCart': 'Review cart',
    'pages.checkout.nextActionSavings': 'Review savings',
    'pages.checkout.nextActionSupport': 'Contact support',
    'pages.checkout.nextActionTitle': 'Next action',
    'pages.checkout.noValidCoupons': 'No valid coupons',
    'pages.checkout.orderCreated': 'Order created',
    'pages.checkout.orderCreateFailed': 'Order create failed',
    'pages.checkout.orderSummary': 'Order summary',
    'pages.checkout.payable': 'Payable',
    'pages.checkout.paymentCard': 'Payment card',
    'pages.checkout.paymentChina': 'China',
    'pages.checkout.paymentConfidenceDefault': 'Choose a payment method',
    'pages.checkout.paymentConfidenceSelected': '{method}',
    'pages.checkout.paymentConfidenceTitle': 'Payment confidence',
    'pages.checkout.paymentGenericDesc': 'Secure payment',
    'pages.checkout.paymentMexico': 'Mexico',
    'pages.checkout.paymentMethod': 'Payment method',
    'pages.checkout.paymentRequired': 'Select a payment method',
    'pages.checkout.paymentStatus': 'Payment status',
    'pages.checkout.phoneInvalid': 'Invalid phone',
    'pages.checkout.phoneRequired': 'Phone required',
    'pages.checkout.postalCode': 'Postal code',
    'pages.checkout.postalCodeInvalid': 'Invalid postal code',
    'pages.checkout.postalCodePlaceholder': 'Postal code',
    'pages.checkout.postalCodeRequired': 'Postal code required',
    'pages.checkout.readinessAddress': 'Address',
    'pages.checkout.readinessAddressNeeded': 'Address needed',
    'pages.checkout.readinessAddressReady': 'Address ready',
    'pages.checkout.readinessEyebrow': 'Ready',
    'pages.checkout.readinessFreeShippingGap': '{amount} to free shipping',
    'pages.checkout.readinessFreeShippingReady': 'Free shipping ready',
    'pages.checkout.readinessItems': 'Items',
    'pages.checkout.readinessItemsText': '{count} ready',
    'pages.checkout.readinessPayment': 'Payment',
    'pages.checkout.readinessPaymentNeeded': 'Payment needed',
    'pages.checkout.readinessPaymentSelected': '{method}',
    'pages.checkout.readinessSavings': 'Savings',
    'pages.checkout.readinessTitle': 'Readiness',
    'pages.checkout.recipient': 'Recipient',
    'pages.checkout.recipientRequired': 'Recipient required',
    'pages.checkout.region': 'Region',
    'pages.checkout.regionPlaceholder': 'Choose region',
    'pages.checkout.regionRequired': 'Region required',
    'pages.checkout.savingsCoachEyebrow': 'Savings',
    'pages.checkout.savingsCoachSubtitle': 'Keep your order ready.',
    'pages.checkout.savingsCoachTitle': 'Savings coach',
    'pages.checkout.savingsCouponEmpty': 'No coupon',
    'pages.checkout.savingsCouponTitle': 'Coupon',
    'pages.checkout.savingsFreeShippingText': '{amount} to free shipping',
    'pages.checkout.savingsFreeShippingTitle': 'Shipping',
    'pages.checkout.savingsFreeShippingUnlocked': 'Free shipping unlocked',
    'pages.checkout.selectCoupon': 'Select coupon',
    'pages.checkout.shippingFee': 'Shipping fee',
    'pages.checkout.shippingPolicyFreeApplied': 'Free shipping applied',
    'pages.checkout.shippingPolicyStandardWithThreshold': '{fee} shipping, free over {threshold}',
    'pages.checkout.submitWithAmount': 'Submit {amount}',
    'pages.checkout.title': 'Checkout',
    'pages.checkout.useNewAddress': 'Use new address',
    'pages.checkout.trustReturnsText': 'Returns supported',
    'pages.checkout.trustReturnsTitle': 'Returns',
    'pages.checkout.trustSecureText': 'Secure checkout',
    'pages.checkout.trustSecureTitle': 'Secure',
    'pages.checkout.trustSupportText': 'Support available',
    'pages.checkout.trustSupportTitle': 'Support',
    'pages.checkout.trustTitle': 'Trust',
    'pages.payment.createFailed': 'Payment create failed',
    'pages.payment.failed': 'Payment failed',
    'pages.payment.title': 'Payment',
    'pages.productList.allCategories': 'All products',
    'pages.productList.viewDetails': 'View details',
    'pages.productList.viewPick': 'View pick',
    'pages.profile.phone': 'Phone',
    'pages.profile.productFallback': 'Product #{id}',
    'pages.wishlist.selectOptions': 'Select options',
  };
  const t = (key: string, params?: Record<string, string | number>) => {
    let label = labels[key] || humanizeKey(key);
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

jest.mock('../utils/safeStorage', () => ({
  getLocalStorageItem: jest.fn((key: string) => mockLocalStorage[key] || null),
  getSessionStorageItem: jest.fn((key: string) => mockSessionStorage[key] || null),
  removeLocalStorageItem: jest.fn((key: string) => {
    delete mockLocalStorage[key];
    return true;
  }),
  removeSessionStorageItem: jest.fn((key: string) => {
    delete mockSessionStorage[key];
    return true;
  }),
  setLocalStorageItem: jest.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
    return true;
  }),
  setSessionStorageItem: jest.fn((key: string, value: string) => {
    mockSessionStorage[key] = value;
    return true;
  }),
}));

jest.mock('../regionData', () => ({
  loadRegionData: jest.fn(),
}));

jest.mock('../utils/guestCart', () => ({
  addGuestCartItem: jest.fn(),
  getGuestCartItems: jest.fn(() => mockGuestCartItems),
  removeGuestCartItem: jest.fn((itemId: number) => {
    mockGuestCartItems = mockGuestCartItems.filter((item) => item.id !== itemId);
    return mockGuestCartItems;
  }),
  removeGuestCartItems: jest.fn((itemIds: number[]) => {
    mockGuestCartItems = mockGuestCartItems.filter((item) => !itemIds.includes(item.id));
    return mockGuestCartItems;
  }),
  updateGuestCartQuantity: jest.fn((itemId: number, quantity: number) => {
    mockGuestCartItems = mockGuestCartItems.map((item) => (
      item.id === itemId ? { ...item, quantity } : item
    ));
    return mockGuestCartItems;
  }),
}));

jest.mock('../utils/cartSession', () => ({
  clearCheckoutCartItemIds: jest.fn(() => {
    mockCheckoutCartItemIds = [];
  }),
  hasAuthenticatedCartSession: jest.fn(() => Boolean(mockLocalStorage.token)),
  readCheckoutCartItemIds: jest.fn(() => mockCheckoutCartItemIds),
  syncCheckoutCartItemIds: jest.fn((items: Array<{ id: number }>) => {
    mockCheckoutCartItemIds = Array.from(new Set(items.map((item) => item.id)));
  }),
}));

jest.mock('../utils/saveForLater', () => ({
  getSavedForLaterItems: jest.fn(() => []),
  removeSavedForLaterItem: jest.fn(() => []),
  removeSavedForLaterProduct: jest.fn(),
  replaceSavedForLaterItems: jest.fn(),
  saveCartItemForLater: jest.fn(() => ({})),
}));

jest.mock('../utils/conversionConfig', () => ({
  conversionConfig: {
    addOnAssistant: { enabled: false, maxFallbackSuggestions: 0, maxSuggestions: 0 },
    cartRecentlyViewed: { enabled: false, maxItems: 0 },
    checkout: { autoSelectBestCoupon: false },
    giftAtCheckout: { enabled: false, giftNameKey: 'pages.checkout.giftName' },
    paymentRecommendation: { byCurrency: {}, enabled: false, fallback: [] },
    saveForLater: { enabled: false, maxBulkRestoreItems: 20, reminderAfterDays: 30 },
  },
  getDeliveryPromise: () => ({ enabled: false }),
  getLowStockCount: () => null,
}));

jest.mock('../utils/cartBenefits', () => ({
  getGiftThreshold: () => 0,
  getNearestCartBenefitTarget: () => null,
  isGiftUnlocked: () => false,
}));

jest.mock('../utils/paymentMethods', () => ({
  filterPaymentChannelsForMarket: (channels: any[] = []) => channels,
  createPaymentMethodDetails: (channels: any[]) => channels.map((channel) => ({
    value: channel.code,
    title: channel.displayName,
    descriptionKey: channel.descriptionKey || 'pages.checkout.paymentGenericDesc',
    badgeKey: channel.badgeKey || 'pages.checkout.paymentMexico',
    market: channel.market || 'GLOBAL',
  })),
  paymentMethodLabel: (method: string) => method,
}));

jest.mock('../utils/productMedia', () => ({
  productImageFallback: '/fallback.png',
  resolveProductImage: (value: string) => value || '/fallback.png',
}));

jest.mock('../utils/selectedSpecs', () => ({
  formatSelectedSpecs: () => '',
}));

jest.mock('../utils/productViewPreferences', () => ({
  loadProductViewPreferences: () => ({ recent: [] }),
}));

jest.mock('../utils/productOptions', () => ({
  needsOptionSelection: () => false,
}));

jest.mock('../utils/localizedProduct', () => ({
  localizeProduct: (product: any) => product,
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

jest.mock('../utils/apiError', () => ({
  getApiErrorMessage: jest.fn((_error: unknown, fallback: string) => fallback),
  isAuthExpiredError: jest.fn(() => false),
}));

jest.mock('../utils/safeUrl', () => ({
  navigateToSafeUrl: jest.fn(() => true),
}));

jest.mock('../utils/paymentRecovery', () => ({
  navigateToCommercialPaymentUrl: jest.fn(() => true),
  getPaymentRecoveryState: () => ({ isPaid: false, isExpired: false, isExpiringSoon: false, minutesLeft: null }),
  formatPaymentUrlLabel: (value: string) => value || '-',
}));

jest.mock('../utils/authRedirect', () => ({
  buildLoginUrlFromWindow: () => '/login',
}));

jest.mock('../utils/guestSupportContext', () => ({
  saveGuestSupportContext: jest.fn(),
}));

jest.mock('../utils/nativeBack', () => ({
  useNativeBackHandler: jest.fn(),
}));

jest.mock('../utils/nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

jest.mock('../components/AddOnAssistant', () => () => null);

jest.mock('../components/SkeletonLoader', () => ({
  ProductCardSkeleton: () => <div />,
  StatsStripSkeleton: () => <div />,
}));

const guestCartItem = {
  id: 91,
  productId: 501,
  quantity: 2,
  productName: 'Guest Bowl',
  imageUrl: '/guest-bowl.png',
  price: 25,
  stock: 10,
  productStatus: 'ACTIVE',
  selectedSpecs: 'size=S',
};

const memberCartItem = {
  id: 11,
  userId: 7,
  productId: 601,
  quantity: 1,
  productName: 'Member Kibble',
  imageUrl: '/member-kibble.png',
  price: 40,
  stock: 5,
  productStatus: 'ACTIVE',
};

const secondMemberCartItem = {
  ...memberCartItem,
  id: 12,
  productId: 602,
  productName: 'Member Treats',
  imageUrl: '/member-treats.png',
  price: 12,
};

const guestCheckoutRegionPath = ['Beijing', 'Beijing', 'Chaoyang'];
const mexicoCheckoutRegionPath = ['\u58a8\u897f\u54e5', 'Ciudad de M\u00e9xico', 'Centro'];
const memberCheckoutRegionPath = ['\u4e2d\u56fd', '\u5317\u4eac\u5e02', '\u671d\u9633\u533a'];

const checkoutRegionOptions: RegionOption[] = [
  {
    value: 'Beijing',
    label: 'Beijing',
    children: [{
      value: 'Beijing',
      label: 'Beijing',
      children: [{ value: 'Chaoyang', label: 'Chaoyang' }],
    }],
  },
  {
    value: '\u58a8\u897f\u54e5',
    label: 'Mexico',
    children: [{
      value: 'Ciudad de M\u00e9xico',
      label: 'Ciudad de M\u00e9xico',
      children: [{ value: 'Centro', label: 'Centro' }],
    }],
  },
  {
    value: '\u4e2d\u56fd',
    label: 'China',
    children: [{
      value: '\u5317\u4eac\u5e02',
      label: 'Beijing',
      children: [{ value: '\u671d\u9633\u533a', label: 'Chaoyang' }],
    }],
  },
];

const renderWithRouter = (component: React.ReactElement, route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    {component}
  </MemoryRouter>,
);

const setPaymentChannels = (code: string, displayName: string) => {
  (paymentApi.getChannels as jest.Mock).mockResolvedValue({
    data: [{ code, displayName, market: 'GLOBAL', recommended: true, sortOrder: 1 }],
  });
};

const getPrimarySubmitButton = () => (
  document.querySelector('.checkout-page__confirmationButton') as HTMLButtonElement
);

const getCartSummaryCheckoutButton = () => (
  screen.getByRole('button', { name: /^Checkout: \d+ selected/ })
);

const getQuantityGroup = (productName: string) => (
  screen.getAllByRole('group', { name: `Quantity: ${productName}` })[0] as HTMLElement
);

const getQuantityInput = (productName: string) => (
  within(getQuantityGroup(productName)).getByRole('spinbutton') as HTMLInputElement
);

const getQuantityButtons = (productName: string) => {
  const group = getQuantityGroup(productName);
  return {
    decrease: within(group).getByRole('button', { name: `Decrease quantity: ${productName}` }),
    increase: within(group).getByRole('button', { name: `Increase quantity: ${productName}` }),
  };
};

const useQuantityFakeTimers = () => {
  cartCheckoutFlowFakeTimersActive = true;
  jest.useFakeTimers({ shouldClearNativeTimers: true } as any);
};

const advanceQuantityDebounce = async (ms = 350) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
};


const waitForCondition = async (
  assertion: () => void,
  options?: Parameters<typeof waitFor>[1],
) => {
  if (cartCheckoutFlowFakeTimersActive) {
    return waitFor(assertion, {
      timeout: 5000,
      ...(options || {}),
      advanceTimers: (ms: number) => {
        jest.advanceTimersByTime(ms);
      },
    } as any);
  }
  return waitFor(assertion, { timeout: 5000, ...(options || {}) });
};

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const getPopconfirmOkButton = () => (
  document.querySelector('.cart-page-popconfirm .ant-popconfirm-buttons .ant-btn-primary') as HTMLButtonElement | null
);

const clickOpenPopconfirmOk = async () => {
  await flushMicrotasks();
  let okButton = getPopconfirmOkButton();
  if (!okButton && cartCheckoutFlowFakeTimersActive) {
    for (const delayMs of [0, 50, 100, 100]) {
      await act(async () => {
        jest.advanceTimersByTime(delayMs);
        await Promise.resolve();
      });
      okButton = getPopconfirmOkButton();
      if (okButton) break;
    }
  }
  if (!okButton) {
    await waitForCondition(() => {
      expect(getPopconfirmOkButton()).toBeInTheDocument();
    });
    okButton = getPopconfirmOkButton();
  }
  expect(okButton).toBeInTheDocument();
  fireEvent.click(okButton as HTMLButtonElement);
  await flushMicrotasks();
};

describe('cart to checkout flows', () => {
  jest.setTimeout(60000);
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockNavigate.mockReset();
    mockLocalStorage = {};
    mockSessionStorage = {};
    mockGuestCartItems = [];
    mockCheckoutCartItemIds = [];
    cartCheckoutFlowFakeTimersActive = false;
    configureSafeStorageMock();
    (getGuestCartItems as jest.Mock).mockImplementation(() => mockGuestCartItems);
    (hasAuthenticatedCartSession as jest.Mock).mockImplementation(() => Boolean(mockLocalStorage.token));
    (readCheckoutCartItemIds as jest.Mock).mockImplementation(() => mockCheckoutCartItemIds);
    (syncCheckoutCartItemIds as jest.Mock).mockImplementation((items: Array<{ id: number }>) => {
      mockCheckoutCartItemIds = Array.from(new Set(items.map((item) => item.id)));
    });
    (clearCheckoutCartItemIds as jest.Mock).mockImplementation(() => {
      mockCheckoutCartItemIds = [];
    });
    (cartApi.addItem as jest.Mock).mockResolvedValue({ data: {} });
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [] });
    (cartApi.removeItem as jest.Mock).mockResolvedValue({ data: {} });
    (cartApi.removeItems as jest.Mock).mockResolvedValue({ data: {} });
    (cartApi.updateQuantity as jest.Mock).mockResolvedValue({ data: {} });
    (loadRegionData as jest.Mock).mockResolvedValue(checkoutRegionOptions);
    (getApiErrorMessage as jest.Mock).mockImplementation((_error: unknown, fallback: string) => fallback);
    (getSavedForLaterItems as jest.Mock).mockReturnValue([]);
    (saveCartItemForLater as jest.Mock).mockImplementation((item: any) => ({
      ...item,
      id: 9000 + Number(item.id || 0),
      savedAt: Date.now(),
      sourceCartItemId: item.id,
    }));
    (addressApi.getByUser as jest.Mock).mockResolvedValue({ data: [] });
    (couponApi.quote as jest.Mock).mockResolvedValue({
      data: {
        availableCoupons: [],
        discountAmount: 0,
        payableAmount: 45,
        shippingFee: 5,
        subtotal: 40,
      },
    });
    (orderApi.checkout as jest.Mock).mockResolvedValue({
      data: {
        id: 2001,
        orderNo: 'ORDER-2001',
        status: 'PENDING_PAYMENT',
        totalAmount: 45,
        shippingFee: 5,
      },
    });
    (orderApi.guestCheckout as jest.Mock).mockResolvedValue({
      data: {
        id: 1001,
        orderNo: 'GUEST-1001',
        status: 'PENDING_PAYMENT',
        totalAmount: 55,
        shippingFee: 5,
      },
    });
    (paymentApi.create as jest.Mock).mockResolvedValue({
      data: {
        id: 3001,
        orderId: 2001,
        orderNo: 'ORDER-2001',
        amount: 45,
        channel: 'STRIPE',
        status: 'PENDING',
        createdAt: '2026-06-05T00:00:00Z',
      },
    });
    setPaymentChannels('STRIPE', 'Stripe');
  });

  afterEach(() => {
    cartCheckoutFlowFakeTimersActive = false;
    jest.useRealTimers();
  });

  it('derives cart checkout validation metrics in a single pass', () => {
    const availableItem = { ...memberCartItem, quantity: 2, stock: 20 };
    const unavailableItem = { ...secondMemberCartItem, quantity: 3, stock: 0 };
    const unselectedAvailableItem = { ...memberCartItem, id: 13, productId: 603, productName: 'Member Chews', quantity: 4, price: 5, stock: 10 };
    const canCheckoutItem = jest.fn((item: typeof memberCartItem) => Number(item.stock) > 0);

    const metrics = deriveCartCheckoutMetrics(
      [availableItem, unavailableItem, unselectedAvailableItem],
      [availableItem.id, unavailableItem.id, 9999],
      canCheckoutItem as any,
    );

    expect(canCheckoutItem).toHaveBeenCalledTimes(3);
    expect(metrics.purchasableItems.map((item) => item.id)).toEqual([availableItem.id, unselectedAvailableItem.id]);
    expect(metrics.unavailableItems.map((item) => item.id)).toEqual([unavailableItem.id]);
    expect(metrics.selectedItems.map((item) => item.id)).toEqual([availableItem.id, unavailableItem.id]);
    expect(metrics.selectedPurchasableCount).toBe(1);
    expect(metrics.selectedUnitCount).toBe(5);
    expect(metrics.purchasableUnitCount).toBe(6);
    expect(metrics.selectedTotal).toBe(116);
    expect(metrics.checkoutBlocked).toBe(true);
  });

  it('uses local guest cart items and carries selected items into checkout', async () => {
    mockGuestCartItems = [guestCartItem];

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Guest Bowl');

    expect(cartApi.getItems).not.toHaveBeenCalled();
    expect(getGuestCartItems).toHaveBeenCalled();

    fireEvent.click(getCartSummaryCheckoutButton());

    await waitForCondition(() => {
      expect(syncCheckoutCartItemIds).toHaveBeenCalledWith([guestCartItem]);
      expect(mockNavigate).toHaveBeenCalledWith('/checkout');
    });
  });

  it('shows item-level free shipping as unlocked in the cart below the global threshold', async () => {
    mockGuestCartItems = [{ ...guestCartItem, freeShipping: true }];

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Guest Bowl');

    expect(screen.getAllByText('You unlocked free shipping').length).toBeGreaterThan(0);
    expect(screen.queryByText('$50.00 to free shipping')).not.toBeInTheDocument();
  });

  it('uses a product placeholder for saved-for-later items without an image', async () => {
    (getSavedForLaterItems as jest.Mock).mockReturnValue([{
      ...memberCartItem,
      id: 911,
      imageUrl: '',
      savedAt: Date.now(),
      sourceCartItemId: memberCartItem.id,
    }]);

    renderWithRouter(<Cart />, '/cart');

    const savedImage = await screen.findByAltText('Member Kibble');

    expect(savedImage).toHaveAttribute('src', '/fallback.png');
  });

  it('does not crash when saved-for-later storage returns a non-array snapshot', async () => {
    (getSavedForLaterItems as jest.Mock).mockReturnValue({
      ...memberCartItem,
      id: 911,
      savedAt: Date.now(),
    });

    renderWithRouter(<Cart />, '/cart');

    await screen.findByText('Your cart is empty');

    expect(screen.queryByText('Member Kibble')).not.toBeInTheDocument();
  });

  it('shows specific cart load recovery details when the API returns an error', async () => {
    const apiMessage = 'Inventory service is unavailable for your cart. Try again in a minute.';
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockRejectedValue({
      response: {
        status: 503,
        data: { message: apiMessage },
      },
    });
    (getApiErrorMessage as jest.Mock).mockReturnValue(apiMessage);

    renderWithRouter(<Cart />, '/cart');

    expect(await screen.findByText(apiMessage)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry: Cart failed to load' })).toBeInTheDocument();
    expect(getApiErrorMessage).toHaveBeenCalledWith(expect.anything(), 'Cart failed to load', 'en');
  });

  it('loads authenticated cart items from the cart API and updates quantity through the API', async () => {
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [memberCartItem] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAccessibleName('Select all');

    expect(cartApi.getItems).toHaveBeenCalledWith(0);

    useQuantityFakeTimers();
    fireEvent.click(screen.getAllByRole('button', { name: 'Increase quantity: Member Kibble' })[0]);
    await advanceQuantityDebounce();

    await waitForCondition(() => {
      expect(cartApi.updateQuantity).toHaveBeenCalledWith(11, 2);
    });

    fireEvent.click(getCartSummaryCheckoutButton());

    await waitForCondition(() => {
      expect(syncCheckoutCartItemIds).toHaveBeenCalledWith([{ ...memberCartItem, quantity: 2 }]);
      expect(mockNavigate).toHaveBeenCalledWith('/checkout');
    });
  });

  it('shows product-specific quantity controls and updates visible quantity before API sync', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    const titles = await screen.findAllByText('Member Kibble');
    expect(titles.length).toBeGreaterThan(0);

    useQuantityFakeTimers();
    const { decrease, increase } = getQuantityButtons('Member Kibble');
    expect(decrease).toBeDisabled();
    expect(getQuantityGroup('Member Kibble')).toHaveAttribute('aria-label', 'Quantity: Member Kibble');

    fireEvent.click(increase);
    expect(getQuantityInput('Member Kibble')).toHaveValue(2);
    expect(getQuantityGroup('Member Kibble')).toHaveAttribute('aria-busy', 'true');
    expect(cartApi.updateQuantity).not.toHaveBeenCalled();

    await advanceQuantityDebounce();
    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
    expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 2);
  });

  it('keeps mobile cart quantity controls at least 44px tall in CSS', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'Cart.css'), 'utf8');

    expect(css).toContain('.cart-page__quantityStepper .ant-btn');
    expect(css).toMatch(/\.cart-page__mobileItemBottom \.cart-page__quantityStepper \.ant-btn[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.cart-page__mobileItemBottom \.cart-page__quantityInput[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.cart-page__quantityStepper[\s\S]*?min-height:\s*48px\s*!important/);
    expect(css).toMatch(/\.cart-page__quantityStepper \.ant-btn[\s\S]*?min-width:\s*48px\s*!important/);
    expect(css).toMatch(/\.cart-page__quantityInput[\s\S]*?height:\s*48px\s*!important/);
  });

  it('keeps cart surface color rules defined once', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'Cart.css'), 'utf8');

    expect(css.match(/\.cart-page \.cart-page__summaryStripCard,/g) ?? []).toHaveLength(1);
    expect(css.match(/\.cart-page \.cart-page__nextAction--warning,/g) ?? []).toHaveLength(1);
    expect(css.match(/\.cart-page \.cart-page__nextAction--warm,/g) ?? []).toHaveLength(1);
    expect(css.match(/\.cart-page \.cart-page__confidencePanel > summary::after/g) ?? []).toHaveLength(1);
    expect(css.match(/\.cart-page \.cart-page__checkoutPathStep p/g) ?? []).toHaveLength(1);
  });

  it('keeps mobile cart hero stats inside the viewport instead of a clipped rail', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'Cart.css'), 'utf8');
    const f2709Start = css.lastIndexOf('F2709: mobile cart hero stats must fit the viewport without clipping.');
    const f2709Css = css.slice(f2709Start);

    expect(f2709Start).toBeGreaterThan(css.lastIndexOf('UI-20260607-06D: keep APP cart KPI cards and lower actions out of fixed rails.'));
    expect(f2709Css).toMatch(/@media \(max-width:\s*640px\)\s*\{/);
    expect(f2709Css).toMatch(/\.cart-page__heroStats\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*?grid-auto-flow:\s*row\s*!important;[\s\S]*?overflow-x:\s*visible\s*!important;[\s\S]*?mask-image:\s*none\s*!important;/);
    expect(f2709Css).toMatch(/\.cart-page__heroStat,[\s\S]*?\.cart-page__loadingStat\s*\{[\s\S]*?min-width:\s*0\s*!important;[\s\S]*?max-width:\s*100%\s*!important;[\s\S]*?scroll-snap-align:\s*none\s*!important;/);
    expect(f2709Css).toMatch(/\.cart-page__heroStat strong,[\s\S]*?\.cart-page__heroStat span\s*\{[\s\S]*?overflow:\s*visible\s*!important;[\s\S]*?text-overflow:\s*clip\s*!important;[\s\S]*?white-space:\s*normal\s*!important;/);
    expect(f2709Css).toMatch(/@media \(max-width:\s*380px\)\s*\{[\s\S]*?\.cart-page__heroStats\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/);
    expect(f2709Css).not.toMatch(/grid-auto-flow:\s*column/);
  });

  it('keeps Chinese cart copy wrapped on dense cart surfaces', () => {
    const css = fs.readFileSync(path.resolve(__dirname, 'Cart.css'), 'utf8');
    const zhStart = css.indexOf('Chinese cart pass: CJK copy needs explicit break opportunities');
    const zhCss = css.slice(zhStart, css.indexOf('.cart-page .ant-card'));

    expect(zhStart).toBeGreaterThan(-1);
    expect(zhCss).toContain('.cart-page--zh');
    expect(zhCss).toMatch(/\.cart-page--zh\s*\{[\s\S]*?line-break:\s*strict;[\s\S]*?overflow-wrap:\s*anywhere;/);
    expect(zhCss).toMatch(/\.cart-page--zh \.cart-page__mobileItemTitle,[\s\S]*?\.cart-page--zh \.cart-page__itemTitle\s*\{[\s\S]*?line-height:\s*1\.25;/);
    expect(zhCss).toMatch(/\.cart-page--zh \.cart-page__heroActions \.ant-btn,[\s\S]*?\.cart-page--zh \.cart-page__summary \.ant-btn-primary\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?white-space:\s*normal;/);
    expect(zhCss).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*?\.cart-page--zh \.cart-page__heroActions,[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?\.cart-page--zh \.cart-page__summary \.ant-btn-primary\s*\{[\s\S]*?width:\s*100%;/);
  });

  it('keeps checkout as the primary next action once purchasable items are selected', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const checkoutBranch = source.indexOf('if (selectedItems.some(canCheckout))');
    const addOnBranch = source.indexOf('if (selectedItems.length > 0 && benefitTarget)');

    expect(checkoutBranch).toBeGreaterThan(-1);
    expect(addOnBranch).toBeGreaterThan(-1);
    expect(checkoutBranch).toBeLessThan(addOnBranch);
    expect(source.slice(checkoutBranch, addOnBranch)).toContain("key: 'checkout'");
    expect(source.slice(checkoutBranch, addOnBranch)).toContain("label: t('pages.cart.checkout')");
    expect(source.slice(checkoutBranch, addOnBranch)).toContain('action: goCheckout');
  });

  it('keeps the top checkout action label distinct from the summary checkout button', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');

    expect(source).toContain("const cartNextActionLabel = `${cartNextAction.label}: ${cartNextAction.title}`;");
    expect(source).toContain("const cartTopNextActionLabel = `${t('pages.cart.nextActionEyebrow')}: ${cartNextActionLabel}`;");
    expect(source).toContain('aria-label={cartItems.length > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}');
    expect(source).toContain('title={cartItems.length > 0 ? cartTopNextActionLabel : emptyBrowseActionLabel}');
    expect(source).toContain('aria-label={checkoutActionLabel}');
    expect(source).not.toContain('`${cartNextActionLabel} (top action)`');
  });

  it('keeps checkout flow tests aligned with async region data, payment channel, and popconfirm timer setup', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'CartCheckoutFlow.test.tsx'), 'utf8');
    const setupTestsSource = fs.readFileSync(path.resolve(__dirname, '../setupTests.ts'), 'utf8');

    expect(source).toContain("import { loadRegionData, type RegionOption } from '../regionData';");
    expect(source).toContain("jest.mock('../regionData', () => ({");
    expect(source).toContain('(loadRegionData as jest.Mock).mockResolvedValue(checkoutRegionOptions);');
    expect(source).toContain("setPaymentChannels('STRIPE', 'Stripe');");
    expect(source).toContain("const guestCheckoutRegionPath = ['Beijing', 'Beijing', 'Chaoyang'];");
    expect(source).toContain('region: guestCheckoutRegionPath,');
    expect(source).toContain('let cartCheckoutFlowFakeTimersActive = false;');
    expect(source).toContain('if (!okButton && cartCheckoutFlowFakeTimersActive) {');
    expect(source).toContain('for (const delayMs of [0, 50, 100, 100])');
    expect(source).toContain("document.querySelector('.checkout-page__confirmationButton')");
    expect(source).toContain('const getPrimarySubmitButton = () => (');
    expect(source).toContain("document.querySelector('.checkout-page__confirmationButton') as HTMLButtonElement");
    expect(source).not.toContain("const getPrimarySubmitButton = () => (\n  document.querySelector('.checkout-page__submitButton')");
    expect(setupTestsSource).toContain("if (typeof MessageChannel === 'undefined') {");
    expect(setupTestsSource).toContain("Object.defineProperty(globalThis, 'MessageChannel'");
  });

  it('keeps cart checkout submission tied to the latest selected item snapshot', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const checkoutStart = source.indexOf('const goCheckout = useCallback(async () => {');
    const checkoutEnd = source.indexOf('const removeSelectedItems = () => {', checkoutStart);
    const checkoutSource = source.slice(checkoutStart, checkoutEnd);

    expect(source).toContain('const checkoutSubmittingRef = useRef(false);');
    expect(checkoutStart).toBeGreaterThan(-1);
    expect(checkoutEnd).toBeGreaterThan(checkoutStart);
    expect(source).not.toContain('const goCheckout = async () => {');
    expect(checkoutSource).toContain('if (checkoutSubmittingRef.current) return;');
    expect(checkoutSource).toContain('const checkoutItems = selectedItems.filter(canCheckout);');
    expect(checkoutSource.indexOf('checkoutSubmittingRef.current = true;')).toBeLessThan(checkoutSource.indexOf('setCheckoutSubmitting(true);'));
    expect(checkoutSource.indexOf('setCheckoutSubmitting(true);')).toBeLessThan(checkoutSource.indexOf('await flushPendingQuantityUpdates(checkoutItems);'));
    expect(checkoutSource).toContain('checkoutSubmittingRef.current = false;');
    expect(checkoutSource).toContain('}, [flushPendingQuantityUpdates, hasStaleCartData, navigate, selectedItems, t]);');
  });

  it('derives the cart hero shipping highlight from the shared shipping summary', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const highlightStart = source.indexOf('const cartHeroHighlights = [');
    const highlightEnd = source.indexOf('const cartSummaryCards = [');
    const highlightSource = source.slice(highlightStart, highlightEnd);

    expect(highlightStart).toBeGreaterThan(-1);
    expect(highlightEnd).toBeGreaterThan(highlightStart);
    expect(source).toContain('deriveCartShippingSummary(selectedItems, freeShippingThreshold, selectedTotal)');
    expect(source).toContain('freeShippingUnlocked ? 0 : freeShippingThreshold');
    expect(source).toContain('} = useMemo(() => {');
    expect(source).toContain('const savedItemsTotal = useMemo(');
    expect(source).not.toContain('const shippingSummary = deriveCartShippingSummary');
    expect(highlightSource).toContain("key: 'shipping'");
    expect(highlightSource).toContain('title: freeShippingStatusTitle');
    expect(highlightSource).toContain('text: freeShippingProgressText');
    expect(highlightSource).not.toMatch(/key:\s*'shipping'[\s\S]*?title:\s*t\('pages\.cart\.freeShippingUnlocked'\)/);
  });

  it('keeps cart amount phrase fragment keys tied to rendered text content', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const amountTextStart = source.indexOf('const renderCartAmountText = (label: string, amount: string) => {');
    const amountTextEnd = source.indexOf('const freeShippingRemainingText', amountTextStart);
    const amountTextSource = source.slice(amountTextStart, amountTextEnd);

    expect(amountTextStart).toBeGreaterThan(-1);
    expect(amountTextEnd).toBeGreaterThan(amountTextStart);
    expect(amountTextSource).toContain('const parts = label.split(amount);');
    expect(amountTextSource).toContain('key={`${part}-${index}`}');
    expect(amountTextSource).not.toContain('key={index}');
    expect(amountTextSource).not.toContain('key={i}');
  });

  it('keeps cart error handling typed without broad any usage', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');

    expect(source).toContain("import { getApiErrorMessage, isAuthExpiredError } from '../utils/apiError';");
    expect(source).toContain('} catch (error: unknown) {');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('error?.response?.status');
    expect(source).not.toContain('catch (error: any)');
    expect(source).not.toContain('catch (err: any)');
  });

  it('guards cart state against stale authenticated snapshot responses', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const fetchStart = source.indexOf('const fetchCartItems = useCallback(async () => {');
    const fetchEnd = source.indexOf('const isCartMounted = useCallback', fetchStart);
    const fetchSource = source.slice(fetchStart, fetchEnd);
    const mutationStart = source.indexOf('const updateQuantity = (item: CartItem, quantity: number) => {');
    const mutationEnd = source.indexOf('const cartCheckoutMetrics = useMemo', mutationStart);
    const mutationSource = source.slice(mutationStart, mutationEnd);
    const suggestedStart = source.indexOf('const addSuggestedProduct = async (product: Product) => {');
    const suggestedEnd = source.indexOf('const addRecentProduct = async (product: Product) => {', suggestedStart);
    const suggestedSource = source.slice(suggestedStart, suggestedEnd);

    expect(source).toContain('const cartSnapshotRequestRef = useRef(0);');
    expect(source).toContain('const beginCartSnapshotRequest = useCallback(() => {');
    expect(source).toContain('const isCurrentCartSnapshotRequest = useCallback((requestId: number) => (');
    expect(source).toContain('const invalidateCartSnapshotRequests = useCallback(() => {');
    expect(fetchStart).toBeGreaterThan(-1);
    expect(fetchEnd).toBeGreaterThan(fetchStart);
    expect(fetchSource).toContain('const requestId = beginCartSnapshotRequest();');
    expect(fetchSource).toContain('const response = await cartApi.getItems(0);');
    expect(fetchSource).toContain('if (!isCurrentCartSnapshotRequest(requestId)) return;');
    expect(fetchSource).toContain('if (isCurrentCartSnapshotRequest(requestId)) setLoading(false);');
    expect(mutationStart).toBeGreaterThan(-1);
    expect(mutationEnd).toBeGreaterThan(mutationStart);
    expect(mutationSource).toContain('invalidateCartSnapshotRequests();');
    expect(mutationSource).toContain('const cartSnapshotRequestId = invalidateCartSnapshotRequests();');
    expect(mutationSource).toContain('if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {');
    expect(suggestedStart).toBeGreaterThan(-1);
    expect(suggestedEnd).toBeGreaterThan(suggestedStart);
    expect(suggestedSource).toContain('const cartSnapshotRequestId = invalidateCartSnapshotRequests();');
    expect(suggestedSource).toContain('const response = await cartApi.getItems(0);');
    expect(suggestedSource).toContain('if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {');
    expect(suggestedSource).toContain('setCartItems(nextItems);');
  });

  it('contains cart refresh failures inside quantity sync error recovery', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const handlerStart = source.indexOf('const handleQuantitySyncError = useCallback(async (err: unknown) => {');
    const handlerEnd = source.indexOf('const {\n    cancelQuantitySync', handlerStart);
    const handlerSource = source.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(handlerSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, t('pages.cart.quantityFailed'), language), 'error');");
    expect(handlerSource).toContain('try {\n      await fetchCartItems();\n    } catch (refreshError) {');
    expect(handlerSource).toContain("reportNonBlockingError('Cart.handleQuantitySyncError.fetchCartItems', refreshError);");
  });

  it('keeps remove and save-for-later cart mutations from rolling back stale cart rows', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const removeStart = source.indexOf('const removeItem = async (itemId: number) => {');
    const removeEnd = source.indexOf('const saveForLater = async (item: CartItem) => {', removeStart);
    const removeSource = source.slice(removeStart, removeEnd);
    const removeCatchStart = removeSource.indexOf('} catch (err: unknown) {');
    const removeCatchEnd = removeSource.indexOf('} finally {', removeCatchStart);
    const removeCatchSource = removeSource.slice(removeCatchStart, removeCatchEnd);
    const saveStart = source.indexOf('const saveForLater = async (item: CartItem) => {');
    const saveEnd = source.indexOf('const moveSavedItemToCart = async (item: SavedForLaterItem) => {', saveStart);
    const saveSource = source.slice(saveStart, saveEnd);
    const saveCatchStart = saveSource.indexOf('} catch (error: unknown) {');
    const saveCatchEnd = saveSource.indexOf('} finally {', saveCatchStart);
    const saveCatchSource = saveSource.slice(saveCatchStart, saveCatchEnd);
    const removeItemsStart = source.indexOf('const removeItems = async (itemIds: number[], successMessage: string) => {');
    const removeItemsEnd = source.indexOf('const cartCheckoutMetrics = useMemo', removeItemsStart);
    const removeItemsSource = source.slice(removeItemsStart, removeItemsEnd);

    expect(removeStart).toBeGreaterThan(-1);
    expect(removeEnd).toBeGreaterThan(removeStart);
    expect(removeSource).toContain('if (removingItemIds.includes(itemId)) return;');
    expect(removeSource).toContain('setRemovingItemIds((ids) => Array.from(new Set([...ids, itemId])));');
    expect(removeSource.indexOf('await cartApi.removeItem(itemId);')).toBeLessThan(removeSource.indexOf('setCartItems((items) => normalizeCartItems(items).filter((item) => item.id !== itemId));'));
    expect(removeCatchSource).toContain("announceAccessibleMessage(getApiErrorMessage(err, t('messages.deleteFailed'), language), 'error');");
    expect(removeCatchSource).not.toContain('setCartItems');
    expect(saveStart).toBeGreaterThan(-1);
    expect(saveEnd).toBeGreaterThan(saveStart);
    expect(saveSource).toContain('const previousSavedItems = getSavedForLaterItemsSnapshot();');
    expect(saveSource).toContain('const savedItem = saveCartItemForLater(item);');
    expect(saveSource.indexOf('await cartApi.removeItem(item.id);')).toBeLessThan(saveSource.indexOf('setCartItems((items) => normalizeCartItems(items).filter((cartItem) => cartItem.id !== item.id));'));
    expect(saveCatchSource).toContain('replaceSavedForLaterItems(previousSavedItems);');
    expect(saveCatchSource).toContain('setSavedItems(previousSavedItems);');
    expect(saveCatchSource).not.toContain('setCartItems');
    expect(removeItemsStart).toBeGreaterThan(-1);
    expect(removeItemsEnd).toBeGreaterThan(removeItemsStart);
    expect(removeItemsSource.indexOf('await cartApi.removeItems(normalizedIds);')).toBeLessThan(removeItemsSource.indexOf('setCartItems((items) => normalizeCartItems(items).filter((item) => !normalizedIds.includes(item.id)));'));
  });

  it('keeps saved-for-later and guest-cart storage changes synchronized across tabs', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const saveForLaterSource = fs.readFileSync(path.resolve(__dirname, '../utils/saveForLater.ts'), 'utf8');
    const storageStart = source.indexOf('const refreshSavedItems = () => setSavedItems(getSavedForLaterItemsSnapshot());');
    const storageEffectStart = source.lastIndexOf('useEffect(() => {', storageStart);
    const storageEffectEnd = source.indexOf('}, [resetCheckoutStateAfterCartMutation]);', storageStart);
    const storageSource = source.slice(storageEffectStart, storageEffectEnd);

    expect(saveForLaterSource).toContain("export const SAVE_FOR_LATER_STORAGE_KEY = 'shop-save-for-later';");
    expect(saveForLaterSource).toContain('getLocalStorageItem(SAVE_FOR_LATER_STORAGE_KEY)');
    expect(saveForLaterSource).toContain('setLocalStorageItem(SAVE_FOR_LATER_STORAGE_KEY, JSON.stringify(normalizeSavedItems(items)))');
    expect(saveForLaterSource).toContain("dispatchDomEvent('shop:save-for-later-updated');");
    expect(source).toContain('SAVE_FOR_LATER_STORAGE_KEY,');
    expect(storageEffectStart).toBeGreaterThan(-1);
    expect(storageStart).toBeGreaterThan(-1);
    expect(storageEffectEnd).toBeGreaterThan(storageStart);
    expect(storageSource).toContain('const refreshSavedItems = () => setSavedItems(getSavedForLaterItemsSnapshot());');
    expect(storageSource).toContain('const allStorageCleared = event.key === null;');
    expect(storageSource).toContain('if (allStorageCleared || event.key === SAVE_FOR_LATER_STORAGE_KEY) {');
    expect(storageSource).toContain('refreshSavedItems();');
    expect(storageSource).toContain("if ((!allStorageCleared && event.key !== 'shop-guest-cart') || getLocalStorageItem('token')) return;");
    expect(storageSource).toContain('setCartItems(guestItems);');
    expect(storageSource).toContain('setSelectedIds(guestItems.filter(canCheckout).map((item) => item.id));');
    expect(storageSource).toContain("window.addEventListener('shop:save-for-later-updated', refreshSavedItems);");
    expect(storageSource).toContain("window.addEventListener('storage', refreshCartStorage);");
    expect(storageSource).toContain("window.removeEventListener('storage', refreshCartStorage);");
  });

  it('clears recently viewed recovery cache after cart mutations that change recovery context', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const resetStart = source.indexOf('const resetCheckoutStateAfterCartMutation = useCallback(() => {');
    const resetEnd = source.indexOf('const beginCartSnapshotRequest = useCallback', resetStart);
    const resetSource = source.slice(resetStart, resetEnd);
    const restoreStart = source.indexOf('const moveSavedItemToCart = async (item: SavedForLaterItem) => {');
    const restoreEnd = source.indexOf('const removeSavedItem = (itemId: number) => {', restoreStart);
    const restoreSource = source.slice(restoreStart, restoreEnd);
    const suggestedStart = source.indexOf('const addSuggestedProduct = async (product: Product) => {');
    const suggestedEnd = source.indexOf('const addRecentProduct = async (product: Product) => {', suggestedStart);
    const suggestedSource = source.slice(suggestedStart, suggestedEnd);

    expect(source).toContain('const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;');
    expect(source).toContain('const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;');
    expect(source).toContain('const recentProductsCache = new Map<string, RecentProductsCacheEntry>();');
    expect(source).toContain('const clearRecentProductsCache = () => {\n  recentProductsCache.clear();\n};');
    expect(source).not.toContain('recentProductsCache._timestamp');
    expect(resetStart).toBeGreaterThan(-1);
    expect(resetEnd).toBeGreaterThan(resetStart);
    expect(resetSource).toContain('clearRecentProductsCache();');
    expect(restoreStart).toBeGreaterThan(-1);
    expect(restoreEnd).toBeGreaterThan(restoreStart);
    expect((restoreSource.match(/clearRecentProductsCache\(\);/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(suggestedStart).toBeGreaterThan(-1);
    expect(suggestedEnd).toBeGreaterThan(suggestedStart);
    expect((suggestedSource.match(/clearRecentProductsCache\(\);/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('prunes selected cart ids when the visible checkoutable cart items change', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const pruneMarker = 'const checkoutableItemIds = new Set(cartItems.filter(canCheckout).map((item) => item.id));';
    const pruneStart = source.indexOf(pruneMarker);
    const effectStart = source.lastIndexOf('useEffect(() => {', pruneStart);
    const effectEnd = source.indexOf('useEffect(() => {', pruneStart);
    const effectSource = source.slice(effectStart, effectEnd);

    expect(pruneStart).toBeGreaterThan(-1);
    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(pruneStart);
    expect(effectSource).toContain('setSelectedIds((ids) => {');
    expect(effectSource).toContain('if (ids.length === 0) return ids;');
    expect(effectSource).toContain(pruneMarker);
    expect(effectSource).toContain('if (!checkoutableItemIds.has(id)) {');
    expect(effectSource).toContain('if (nextIds.includes(id)) {');
    expect(effectSource).toContain('nextIds.push(id);');
    expect(effectSource).toContain('return changed ? nextIds : ids;');
    expect(effectSource).toContain('}, [cartItems]);');
  });

  it('persists only the final visible quantity after rapid authenticated input edits', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    const quantityInput = getQuantityInput('Member Kibble');

    fireEvent.change(quantityInput, { target: { value: '1' } });
    fireEvent.change(quantityInput, { target: { value: '12' } });

    expect(quantityInput).toHaveValue(12);
    expect(cartApi.updateQuantity).not.toHaveBeenCalled();

    await advanceQuantityDebounce(349);
    expect(cartApi.updateQuantity).not.toHaveBeenCalled();

    await advanceQuantityDebounce(1);

    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
    expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 12);
  });

  it('allows quantity input to stay empty until blur applies the fallback', async () => {
    const item = { ...memberCartItem, quantity: 2, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    const quantityInput = getQuantityInput('Member Kibble');

    fireEvent.change(quantityInput, { target: { value: '' } });

    expect(quantityInput.value).toBe('');
    expect(cartApi.updateQuantity).not.toHaveBeenCalled();

    fireEvent.blur(quantityInput);

    expect(quantityInput).toHaveValue(1);

    await advanceQuantityDebounce();

    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
    expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 1);
  });

  it('keeps cart quantity source free of stale callbacks and invalid empty syncs', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const cartUiSource = fs.readFileSync(path.resolve(__dirname, '../utils/cartUi.ts'), 'utf8');
    const updateStart = source.indexOf('const updateQuantity = (item: CartItem, quantity: number) => {');
    const updateEnd = source.indexOf('const renderQuantityControl', updateStart);
    const updateSource = source.slice(updateStart, updateEnd);

    expect(updateStart).toBeGreaterThan(-1);
    expect(updateEnd).toBeGreaterThan(updateStart);
    expect(updateSource).not.toContain('useCallback(');
    expect(updateSource).toContain('const normalizedQuantity = normalizeCartQuantity(item, quantity);');
    expect(updateSource).toContain('setCartItems((items) =>');
    expect(updateSource).toContain('scheduleQuantitySync(item.id, normalizedQuantity)');
    expect(cartUiSource).toContain('export const DEFAULT_CART_QUANTITY_LIMIT = 99;');
    expect(cartUiSource).toContain('Math.min(getCartLineQuantity(quantity), getCartQuantityLimit(item?.stock))');
    expect(source).toContain('const limit = getCartQuantityLimit(item.stock);');
    expect(source).toContain('type="number"');
    expect(source).toContain('max={limit}');
    expect(source).toContain("if (nextValue === '')");
    expect(source).toContain("setQuantityDrafts((drafts) => ({ ...drafts, [item.id]: '' }))");
    expect(source).toContain('return;');
    expect(source).toContain('updateQuantity(item, Math.floor(Number(nextValue) || 1));');
    expect(source).toContain('onBlur={() => {');
    expect(source).toContain('updateQuantity(item, 1);');
    expect(source).toContain('disabled={disabled || quantity >= limit}');
    expect(source).not.toContain("parseInt('', 10)");
  });

  it('keeps stale cart snapshots read-only until a refresh succeeds', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const staleMarker = 'const hasStaleCartData = loadError && cartItems.length > 0;';
    const nextActionStart = source.indexOf('const cartNextAction = (() => {');
    const nextActionEnd = source.indexOf('const cartHeroHighlights = [', nextActionStart);
    const nextActionSource = source.slice(nextActionStart, nextActionEnd);
    const checkoutStart = source.indexOf('const goCheckout = useCallback(async () => {');
    const checkoutEnd = source.indexOf('const removeSelectedItems = () => {', checkoutStart);
    const checkoutSource = source.slice(checkoutStart, checkoutEnd);
    const staleAlertStart = source.indexOf('{hasStaleCartData ? (');
    const staleAlertEnd = source.indexOf('{showRecentlyViewedRecovery ? (', staleAlertStart);
    const staleAlertSource = source.slice(staleAlertStart, staleAlertEnd);

    expect(source).toContain(staleMarker);
    expect(source).toContain('const refreshCartItems = useCallback(() => {');
    expect(nextActionStart).toBeGreaterThan(-1);
    expect(nextActionEnd).toBeGreaterThan(nextActionStart);
    expect(nextActionSource).toContain('if (hasStaleCartData) {');
    expect(nextActionSource).toContain("key: 'refresh'");
    expect(nextActionSource).toContain("label: t('messages.retry')");
    expect(nextActionSource).toContain('action: refreshCartItems');
    expect(checkoutStart).toBeGreaterThan(-1);
    expect(checkoutEnd).toBeGreaterThan(checkoutStart);
    expect(checkoutSource).toContain('if (hasStaleCartData) {');
    expect(checkoutSource).toContain("announceAccessibleMessage(t('pages.cart.staleDataWarning'), 'warning');");
    expect(source).toContain('if (hasStaleCartData) return;\n    const normalizedQuantity = normalizeCartQuantity(item, quantity);');
    expect(source).toContain('if (hasStaleCartData) return;\n    if (removingItemIds.includes(itemId)) return;');
    expect(source).toContain('if (hasStaleCartData) return;\n    if (removingItemIds.includes(item.id)) return;');
    expect(source).toContain('if (hasStaleCartData) return;\n    setSelectedIds(checked ? purchasableItems.map((item) => item.id) : []);');
    expect(staleAlertStart).toBeGreaterThan(-1);
    expect(staleAlertEnd).toBeGreaterThan(staleAlertStart);
    expect(staleAlertSource).toContain("message={t('pages.cart.staleDataTitle')}");
    expect(staleAlertSource).toContain("description={loadErrorMessage || t('pages.cart.staleDataWarning')}");
    expect(staleAlertSource).toContain('onClick={refreshCartItems}');
  });

  it('keeps saved-item restore actions visibly pending while a restore is in flight', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const restoreStart = source.indexOf('const moveSavedItemToCart = async (item: SavedForLaterItem) => {');
    const restoreEnd = source.indexOf('const moveSavedItemsToCart', restoreStart);
    const restoreSource = source.slice(restoreStart, restoreEnd);
    const savedRenderStart = source.indexOf('const restoringSavedItem = restoringSaved || restoringSavedItemIds.includes(item.id);');
    const savedRenderEnd = source.indexOf('icon={<ShopIcon path={SI.delete} />}', savedRenderStart) + 80;
    const savedRenderSource = source.slice(savedRenderStart, savedRenderEnd);

    expect(source).toContain('const [restoringSavedItemIds, setRestoringSavedItemIds] = useState<number[]>([]);');
    expect(restoreStart).toBeGreaterThan(-1);
    expect(restoreEnd).toBeGreaterThan(restoreStart);
    expect(restoreSource).toContain('if (restoringSaved || restoringSavedItemIds.includes(item.id)) return;');
    expect(restoreSource).toContain('setRestoringSavedItemIds((ids) => Array.from(new Set([...ids, item.id])));');
    expect(restoreSource).toContain('setRestoringSavedItemIds((ids) => ids.filter((id) => id !== item.id));');
    expect(savedRenderStart).toBeGreaterThan(-1);
    expect(savedRenderEnd).toBeGreaterThan(savedRenderStart);
    expect(savedRenderSource).toContain('const restoringSavedItem = restoringSaved || restoringSavedItemIds.includes(item.id);');
    expect(savedRenderSource).toContain('loading={restoringSavedItem}');
    expect(savedRenderSource).toContain('disabled={hasStaleCartData || restoringSavedItem}');
    expect(savedRenderSource).toContain('<Button danger type="text" icon={<ShopIcon path={SI.delete} />} disabled={restoringSavedItem}');
  });

  it('keeps saved-for-later items exposed as a navigable list', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');

    expect(source).toContain('<div className="cart-page__savedGrid" role="list" aria-label={t(\'pages.cart.saveForLaterTitle\')}>');
    expect(source).toContain('<div className="cart-page__savedItem" key={item.id} role="listitem">');
    expect(source).not.toContain('className="products-grid"');
  });

  it('keeps authenticated bulk saved-item restore on the canonical cart snapshot', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'Cart.tsx'), 'utf8');
    const restoreStart = source.indexOf('const moveSavedItemsToCart = async (items: SavedForLaterItem[]) => {');
    const restoreEnd = source.indexOf('const removeSavedItem = (itemId: number) => {', restoreStart);
    const restoreSource = source.slice(restoreStart, restoreEnd);
    const authenticatedStart = restoreSource.indexOf('if (authenticated) {');
    const authenticatedEnd = restoreSource.indexOf('} else {', authenticatedStart);
    const authenticatedSource = restoreSource.slice(authenticatedStart, authenticatedEnd);

    expect(restoreStart).toBeGreaterThan(-1);
    expect(restoreEnd).toBeGreaterThan(restoreStart);
    expect(authenticatedStart).toBeGreaterThan(-1);
    expect(authenticatedEnd).toBeGreaterThan(authenticatedStart);
    expect(authenticatedSource).toContain('const results = await allSettledWithConcurrency(');
    expect(authenticatedSource).toContain('restoredItems = targetItems.filter((_, index) => results[index].status === \'fulfilled\');');
    expect(authenticatedSource).toContain('const response = await cartApi.getItems(0);');
    expect(authenticatedSource).toContain('if (isCurrentCartSnapshotRequest(cartSnapshotRequestId)) {');
    expect(authenticatedSource).toContain('const nextItems = normalizeCartItems(response.data);');
    expect(authenticatedSource).toContain('setCartItems(nextItems);');
    expect(authenticatedSource).toContain('setSelectedIds(nextItems.filter(canCheckout).map((cartItem) => cartItem.id));');
    expect(authenticatedSource).not.toContain('concat(');
    expect(authenticatedSource).not.toContain('newItems');
  });

  it('persists only the final visible quantity after rapid authenticated plus/minus edits', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    const { decrease, increase } = getQuantityButtons('Member Kibble');

    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(decrease);

    expect(getQuantityInput('Member Kibble')).toHaveValue(2);
    expect(cartApi.updateQuantity).not.toHaveBeenCalled();

    await advanceQuantityDebounce();

    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
    expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 2);
  });

  it('cancels pending authenticated quantity sync when deleting that cart item', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    fireEvent.change(getQuantityInput('Member Kibble'), { target: { value: '12' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete: Member Kibble' })[0]);
    await clickOpenPopconfirmOk();

    expect(cartApi.removeItem).toHaveBeenCalledWith(item.id);

    await advanceQuantityDebounce(400);

    expect(cartApi.updateQuantity).not.toHaveBeenCalled();
  });

  it('cancels pending authenticated quantity sync when saving that cart item for later', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    fireEvent.change(getQuantityInput('Member Kibble'), { target: { value: '12' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Save for later: Member Kibble' })[0]);
      await Promise.resolve();
    });
    await flushMicrotasks();

    await waitForCondition(() => {
      expect(saveCartItemForLater).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }));
      expect(cartApi.removeItem).toHaveBeenCalledWith(item.id);
    });

    await advanceQuantityDebounce(400);

    expect(cartApi.updateQuantity).not.toHaveBeenCalled();
  });

  it('cancels pending authenticated quantity sync when bulk removing selected cart items', async () => {
    const item = { ...memberCartItem, stock: 20 };
    const secondItem = { ...secondMemberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item, secondItem] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');
    await screen.findAllByText('Member Treats');

    useQuantityFakeTimers();
    fireEvent.change(getQuantityInput('Member Kibble'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected: 2 selected' }));
    await clickOpenPopconfirmOk();

    expect(cartApi.removeItems).toHaveBeenCalledWith([item.id, secondItem.id]);

    await advanceQuantityDebounce(400);

    expect(cartApi.updateQuantity).not.toHaveBeenCalled();
  });

  it('clears stale checkout selection when removing all selected cart items', async () => {
    const item = { ...memberCartItem, stock: 20 };
    const secondItem = { ...secondMemberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    mockCheckoutCartItemIds = [item.id, secondItem.id];
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item, secondItem] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');
    await screen.findAllByText('Member Treats');

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected: 2 selected' }));
    await clickOpenPopconfirmOk();

    await waitForCondition(() => {
      expect(cartApi.removeItems).toHaveBeenCalledWith([item.id, secondItem.id]);
    });
    expect(clearCheckoutCartItemIds).toHaveBeenCalled();
    expect(mockCheckoutCartItemIds).toEqual([]);
  });

  it('flushes final visible authenticated quantity before navigating to checkout', async () => {
    const item = { ...memberCartItem, stock: 20 };
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    fireEvent.change(getQuantityInput('Member Kibble'), { target: { value: '12' } });
    fireEvent.click(getCartSummaryCheckoutButton());
    await flushMicrotasks();

    await waitForCondition(() => {
      expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
      expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 12);
      expect(syncCheckoutCartItemIds).toHaveBeenCalledWith([{ ...item, quantity: 12 }]);
      expect(mockNavigate).toHaveBeenCalledWith('/checkout');
    });

    await advanceQuantityDebounce(400);

    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
  });

  it('blocks checkout navigation when pending authenticated quantity persistence fails', async () => {
    const item = { ...memberCartItem, stock: 20 };
    (announceAccessibleMessage as jest.Mock).mockClear();
    mockLocalStorage = { token: 'member-token', userId: '7' };
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [item] });
    (cartApi.updateQuantity as jest.Mock).mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Stock changed before checkout' } },
    });
    (getApiErrorMessage as jest.Mock).mockReturnValue('Stock changed before checkout');

    renderWithRouter(<Cart />, '/cart');

    await screen.findAllByText('Member Kibble');

    useQuantityFakeTimers();
    fireEvent.change(getQuantityInput('Member Kibble'), { target: { value: '12' } });
    fireEvent.click(getCartSummaryCheckoutButton());
    await flushMicrotasks();

    await waitForCondition(() => {
      expect(cartApi.updateQuantity).toHaveBeenCalledWith(item.id, 12);
      expect(getApiErrorMessage).toHaveBeenCalledWith(expect.anything(), 'Quantity update failed', 'en');
    });

    expect(announceAccessibleMessage).toHaveBeenCalledWith('Checkout could not continue', 'warning');
    expect(syncCheckoutCartItemIds).not.toHaveBeenCalledWith([{ ...item, quantity: 12 }]);
    expect(mockNavigate).not.toHaveBeenCalledWith('/checkout');

    await advanceQuantityDebounce(400);

    expect(cartApi.updateQuantity).toHaveBeenCalledTimes(1);
  });

  it('creates a guest checkout order, creates payment, and removes submitted guest cart items', async () => {
    mockGuestCartItems = [guestCartItem];
    mockCheckoutCartItemIds = [guestCartItem.id];
    const guestDraft = JSON.stringify({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      phone: '555-123-4567',
      postalCode: '100000',
      region: guestCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    });
    mockSessionStorage['checkoutGuestDraft'] = guestDraft;
    window.sessionStorage.setItem('checkoutGuestDraft', guestDraft);
    setPaymentChannels('MERCADO_PAGO', 'Mercado Pago');
    (paymentApi.create as jest.Mock).mockResolvedValue({
      data: {
        id: 3002,
        orderId: 1001,
        orderNo: 'GUEST-1001',
        amount: 55,
        channel: 'MERCADO_PAGO',
        status: 'PENDING',
        createdAt: '2026-06-05T00:00:00Z',
      },
    });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Guest Bowl');
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '100000' } });

    await waitForCondition(() => {
      expect(getPrimarySubmitButton().textContent || '').toMatch(/Submit/);
      expect(getPrimarySubmitButton()).not.toBeDisabled();
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(orderApi.guestCheckout).toHaveBeenCalled();
    });

    expect(orderApi.guestCheckout).toHaveBeenCalledWith({
      guestEmail: 'guest@example.com',
      guestName: 'Guest Buyer',
      guestPhone: '5551234567',
      shippingAddress: expect.stringContaining('Guest Buyer / 5551234567 / Beijing Beijing Chaoyang 100000 88 Guest Road'),
      paymentMethod: 'MERCADO_PAGO',
      items: [{
        productId: 501,
        quantity: 2,
        selectedSpecs: 'size=S',
      }],
    }, { idempotencyKey: expect.stringMatching(/^checkout-/) });
    expect(orderApi.checkout).not.toHaveBeenCalled();
    expect(removeGuestCartItems).toHaveBeenCalledWith([guestCartItem.id]);
    expect(clearCheckoutCartItemIds).toHaveBeenCalled();
    expect(paymentApi.create).toHaveBeenCalledWith(1001, 'MERCADO_PAGO', 'guest@example.com', 'GUEST-1001');
    await waitForCondition(() => {
      expect(mockSessionStorage['checkoutIdempotencyKey']).toBeUndefined();
      expect(mockSessionStorage['checkoutPendingOrder']).toBeUndefined();
      expect(window.sessionStorage.getItem('checkoutIdempotencyKey')).toBeNull();
      expect(window.sessionStorage.getItem('checkoutPendingOrder')).toBeNull();
    });
  });

  it('keeps the checkout idempotency key and pending order snapshot when payment creation fails', async () => {
    mockGuestCartItems = [guestCartItem];
    mockCheckoutCartItemIds = [guestCartItem.id];
    const guestDraft = JSON.stringify({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      phone: '555-123-4567',
      postalCode: '100000',
      region: guestCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    });
    mockSessionStorage['checkoutGuestDraft'] = guestDraft;
    window.sessionStorage.setItem('checkoutGuestDraft', guestDraft);
    setPaymentChannels('MERCADO_PAGO', 'Mercado Pago');
    (paymentApi.create as jest.Mock).mockRejectedValueOnce({ response: { status: 502 } });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Guest Bowl');
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '100000' } });

    await waitForCondition(() => {
      expect(getPrimarySubmitButton().textContent || '').toMatch(/Submit/);
      expect(getPrimarySubmitButton()).not.toBeDisabled();
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(paymentApi.create).toHaveBeenCalledWith(1001, 'MERCADO_PAGO', 'guest@example.com', 'GUEST-1001');
    });
    await waitForCondition(() => {
      expect(screen.getByText('Payment create failed')).toBeInTheDocument();
    });

    const submittedKey = (orderApi.guestCheckout as jest.Mock).mock.calls[0][1].idempotencyKey;
    expect(mockSessionStorage['checkoutIdempotencyKey']).toBe(submittedKey);
    expect(window.sessionStorage.getItem('checkoutIdempotencyKey')).toBe(submittedKey);
    expect(mockSessionStorage['checkoutPendingOrder']).toEqual(expect.any(String));
    expect(window.sessionStorage.getItem('checkoutPendingOrder')).toBe(mockSessionStorage['checkoutPendingOrder']);
    // Guest draft may keep the original typed phone or re-persist normalized digits after hydration.
    const storedGuestDraft = JSON.parse(String(mockSessionStorage['checkoutGuestDraft'] || '{}'));
    expect(storedGuestDraft).toEqual(expect.objectContaining({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      postalCode: '100000',
      region: guestCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    }));
    expect(String(storedGuestDraft.phone || '').replace(/\D/g, '')).toBe('5551234567');
    expect(JSON.parse(String(window.sessionStorage.getItem('checkoutGuestDraft') || '{}'))).toEqual(storedGuestDraft);

    const pendingOrder = JSON.parse(mockSessionStorage['checkoutPendingOrder'] as string);
    expect(pendingOrder).toEqual(expect.objectContaining({
      paymentMethod: 'MERCADO_PAGO',
      guestPaymentEmail: 'guest@example.com',
      savedAt: expect.any(Number),
    }));
    expect(pendingOrder.order).toEqual(expect.objectContaining({
      id: 1001,
      orderNo: 'GUEST-1001',
      status: 'PENDING_PAYMENT',
    }));
  });

  it('keeps the checkout idempotency key when guest order creation has a transient server error', async () => {
    mockGuestCartItems = [guestCartItem];
    mockCheckoutCartItemIds = [guestCartItem.id];
    const guestDraft = JSON.stringify({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      phone: '555-123-4567',
      postalCode: '100000',
      region: guestCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    });
    mockSessionStorage['checkoutGuestDraft'] = guestDraft;
    window.sessionStorage.setItem('checkoutGuestDraft', guestDraft);
    setPaymentChannels('MERCADO_PAGO', 'Mercado Pago');
    (orderApi.guestCheckout as jest.Mock).mockRejectedValueOnce({ response: { status: 502 } });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Guest Bowl');
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '100000' } });

    await waitForCondition(() => {
      expect(getPrimarySubmitButton().textContent || '').toMatch(/Submit/);
      expect(getPrimarySubmitButton()).not.toBeDisabled();
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(orderApi.guestCheckout).toHaveBeenCalled();
    });

    const submittedKey = (orderApi.guestCheckout as jest.Mock).mock.calls[0][1].idempotencyKey;
    expect(mockSessionStorage['checkoutIdempotencyKey']).toBe(submittedKey);
    expect(window.sessionStorage.getItem('checkoutIdempotencyKey')).toBe(submittedKey);
    expect(mockSessionStorage['checkoutPendingOrder']).toBeUndefined();
    expect(window.sessionStorage.getItem('checkoutPendingOrder')).toBeNull();
    expect(paymentApi.create).not.toHaveBeenCalled();
  });

  it('recovers a pending guest order after refresh and clears recovery storage when retry creates payment', async () => {
    const pendingSnapshot = JSON.stringify({
      order: {
        id: 1001,
        orderNo: 'GUEST-1001',
        status: 'PENDING_PAYMENT',
        totalAmount: 55,
        shippingFee: 5,
      },
      paymentMethod: 'MERCADO_PAGO',
      guestPaymentEmail: 'guest@example.com',
      savedAt: Date.now(),
    });
    mockSessionStorage['checkoutIdempotencyKey'] = 'checkout-existing-key';
    mockSessionStorage['checkoutPendingOrder'] = pendingSnapshot;
    window.sessionStorage.setItem('checkoutIdempotencyKey', 'checkout-existing-key');
    window.sessionStorage.setItem('checkoutPendingOrder', pendingSnapshot);
    (paymentApi.create as jest.Mock).mockResolvedValueOnce({
      data: {
        id: 3003,
        orderId: 1001,
        orderNo: 'GUEST-1001',
        amount: 55,
        channel: 'MERCADO_PAGO',
        status: 'PENDING',
        createdAt: '2026-06-05T00:00:00Z',
      },
    });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText(/Order Created Payment Pending/i);
    fireEvent.click(screen.getByRole('button', { name: /Retry Payment/i }));

    await waitForCondition(() => {
      expect(paymentApi.create).toHaveBeenCalledWith(1001, 'MERCADO_PAGO', 'guest@example.com', 'GUEST-1001');
    });
    await waitForCondition(() => {
      expect(mockSessionStorage['checkoutIdempotencyKey']).toBeUndefined();
      expect(mockSessionStorage['checkoutPendingOrder']).toBeUndefined();
      expect(window.sessionStorage.getItem('checkoutIdempotencyKey')).toBeNull();
      expect(window.sessionStorage.getItem('checkoutPendingOrder')).toBeNull();
    });
  });

  it('does not add the default guest shipping fee when all selected items are product-level free shipping', async () => {
    mockGuestCartItems = [{ ...guestCartItem, freeShipping: true }];
    mockCheckoutCartItemIds = [guestCartItem.id];
    const guestDraft = JSON.stringify({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      phone: '555-123-4567',
      postalCode: '100000',
      region: guestCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    });
    mockSessionStorage['checkoutGuestDraft'] = guestDraft;
    window.sessionStorage.setItem('checkoutGuestDraft', guestDraft);
    setPaymentChannels('MERCADO_PAGO', 'Mercado Pago');
    (orderApi.guestCheckout as jest.Mock).mockResolvedValue({
      data: {
        id: 1001,
        orderNo: 'GUEST-1001',
        status: 'PENDING_PAYMENT',
        totalAmount: 50,
        shippingFee: 0,
      },
    });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Guest Bowl');
    await waitForCondition(() => {
      expect(getPrimarySubmitButton()).toHaveTextContent('Submit $50.00');
      expect(getPrimarySubmitButton()).not.toBeDisabled();
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(orderApi.guestCheckout).toHaveBeenCalled();
    });
    expect(paymentApi.create).toHaveBeenCalledWith(1001, 'MERCADO_PAGO', 'guest@example.com', 'GUEST-1001');
  });

  it('blocks guest checkout when the postal code does not match the selected region', async () => {
    mockGuestCartItems = [guestCartItem];
    mockCheckoutCartItemIds = [guestCartItem.id];
    const guestDraft = JSON.stringify({
      guestEmail: 'guest@example.com',
      recipientName: 'Guest Buyer',
      phone: '555-123-4567',
      postalCode: '0100A',
      region: mexicoCheckoutRegionPath,
      shippingAddress: '88 Guest Road',
    });
    mockSessionStorage['checkoutGuestDraft'] = guestDraft;
    window.sessionStorage.setItem('checkoutGuestDraft', guestDraft);
    setPaymentChannels('MERCADO_PAGO', 'Mercado Pago');

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Guest Bowl');

    // Incomplete/invalid address stays a guided next action (enabled), not a dead disabled CTA.
    await waitForCondition(() => {
      expect(getPrimarySubmitButton()).not.toBeDisabled();
      expect(getPrimarySubmitButton().textContent || '').toMatch(/address|Address|Complete|Add/i);
    });

    fireEvent.click(getPrimarySubmitButton());
    expect(orderApi.guestCheckout).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '01000' } });

    await waitForCondition(() => {
      expect(getPrimarySubmitButton()).not.toBeDisabled();
      expect(getPrimarySubmitButton().textContent || '').toMatch(/Submit|\$/);
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(orderApi.guestCheckout).toHaveBeenCalled();
    });
    expect(orderApi.guestCheckout).toHaveBeenCalledWith(expect.objectContaining({
      shippingAddress: expect.stringContaining('\u58a8\u897f\u54e5 Ciudad de M\u00e9xico Centro 01000 88 Guest Road'),
    }), { idempotencyKey: expect.stringMatching(/^checkout-/) });
  });

  it('creates an authenticated checkout order from selected cart IDs and starts payment', async () => {
    mockLocalStorage = { token: 'member-token', userId: '7' };
    mockCheckoutCartItemIds = [memberCartItem.id];
    setPaymentChannels('STRIPE', 'Stripe');
    (cartApi.getItems as jest.Mock).mockResolvedValue({ data: [memberCartItem] });
    (addressApi.getByUser as jest.Mock).mockResolvedValue({
      data: [{
        id: 70,
        userId: 7,
        recipientName: 'Member Buyer',
        phone: '555-222-3333',
        region: memberCheckoutRegionPath,
        postalCode: '100000',
        detailAddress: '1 Member Way',
        address: '\u4e2d\u56fd \u5317\u4eac\u5e02 \u671d\u9633\u533a 100000 1 Member Way',
        isDefault: true,
      }],
    });
    (couponApi.quote as jest.Mock).mockResolvedValue({
      data: {
        availableCoupons: [],
        discountAmount: 0,
        payableAmount: 45,
        shippingFee: 5,
        subtotal: 40,
      },
    });

    renderWithRouter(<Checkout />, '/checkout');

    await screen.findAllByText('Member Kibble');
    await waitForCondition(() => {
      expect(screen.getByRole('radio', { name: 'Member Buyer, 5552223333, \u4e2d\u56fd \u5317\u4eac\u5e02 \u671d\u9633\u533a 100000 1 Member Way, Default address' })).toBeChecked();
    });
    expect(screen.getByRole('radio', { name: 'Use new address' })).toBeInTheDocument();

    await waitForCondition(() => {
      expect(getPrimarySubmitButton().textContent || '').toMatch(/Submit/);
      expect(getPrimarySubmitButton()).not.toBeDisabled();
    });

    fireEvent.click(getPrimarySubmitButton());

    await waitForCondition(() => {
      expect(orderApi.checkout).toHaveBeenCalled();
    });

    expect(orderApi.checkout).toHaveBeenCalledWith({
      cartItemIds: [memberCartItem.id],
      shippingAddress: 'Member Buyer / 5552223333 / \u4e2d\u56fd \u5317\u4eac\u5e02 \u671d\u9633\u533a 100000 1 Member Way',
      recipientName: 'Member Buyer',
      recipientPhone: '5552223333',
      paymentMethod: 'STRIPE',
      userCouponId: null,
    }, { idempotencyKey: expect.stringMatching(/^checkout-/) });
    expect(orderApi.guestCheckout).not.toHaveBeenCalled();
    expect(removeGuestCartItems).not.toHaveBeenCalled();
    expect(clearCheckoutCartItemIds).toHaveBeenCalled();
    expect(dispatchDomEvent).toHaveBeenCalledWith('shop:cart-updated');
    expect(paymentApi.create).toHaveBeenCalledWith(2001, 'STRIPE', undefined, undefined);
  });
});

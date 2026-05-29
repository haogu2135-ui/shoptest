import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout from './Checkout';
import { addressApi, appConfigApi, cartApi, couponApi, orderApi, paymentApi } from '../api';
import { getLocalStorageItem } from '../utils/safeStorage';

jest.mock('../api', () => ({
  addressApi: { getByUser: jest.fn() },
  appConfigApi: { get: jest.fn() },
  cartApi: { getItems: jest.fn(), addItem: jest.fn() },
  couponApi: { quote: jest.fn() },
  orderApi: { checkout: jest.fn(), guestCheckout: jest.fn(), getById: jest.fn(), cancel: jest.fn() },
  paymentApi: { getChannels: jest.fn(), create: jest.fn(), simulateCallback: jest.fn(), getLatestByOrder: jest.fn() },
  productApi: { getAddOnCandidates: jest.fn() },
}));

jest.mock('../hooks/useMarket', () => ({
  useMarket: () => ({
    currency: 'USD',
    market: { locale: 'en-US', freeShippingThreshold: 899, defaultShippingFee: 30 },
    formatMoney: (value?: number | null) => `$${Number(value || 0).toFixed(2)}`,
  }),
}));

jest.mock('../hooks/useAppConfig', () => ({
  useAppConfig: () => ({
    config: { runtimeMode: 'production', paymentSimulationEnabled: false, emailCodeEnabled: false },
    loading: false,
  }),
}));

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string, params?: Record<string, string | number>) => {
      const labels: Record<string, string> = {
        'pages.checkout.title': 'Checkout',
        'pages.checkout.readinessEyebrow': 'Ready',
        'pages.checkout.savingsCoachSubtitle': 'Keep your order ready.',
        'pages.checkout.paymentUnavailable': 'Payment methods are temporarily unavailable',
        'pages.checkout.paymentUnavailableDescription': 'Checkout is paused until a configured payment channel is available. Please try again later or contact support.',
        'pages.checkout.submitWithAmount': 'Submit {amount}',
        'pages.checkout.paymentConfidenceTitle': 'Payment confidence',
        'pages.checkout.paymentConfidenceDefault': 'Choose a payment method',
        'pages.checkout.paymentConfidenceSelected': '{method}',
        'pages.checkout.paymentRequired': 'Select a payment method',
        'pages.checkout.emptySelected': 'Nothing selected',
        'pages.checkout.backCart': 'Back to cart',
        'pages.checkout.paymentMethod': 'Payment method',
        'pages.checkout.itemSummary': '{count} item(s)',
        'pages.checkout.payable': 'Payable',
        'pages.checkout.shippingFee': 'Shipping fee',
        'pages.checkout.address': 'Address',
        'pages.checkout.contact': 'Contact',
        'pages.checkout.email': 'Email',
        'pages.checkout.guestHint': 'Guest checkout',
        'pages.checkout.recipient': 'Recipient',
        'pages.checkout.region': 'Region',
        'pages.checkout.detailAddress': 'Detail address',
        'pages.checkout.postalCode': 'Postal code',
        'pages.checkout.expressCheckout': 'Express checkout',
        'pages.checkout.itemList': 'Items',
        'pages.checkout.orderSummary': 'Order summary',
        'pages.checkout.defaultAddress': 'Default',
        'pages.checkout.useNewAddress': 'Use new address',
        'pages.checkout.selectCoupon': 'Select coupon',
        'pages.payment.title': 'Payment',
        'pages.cart.browse': 'Browse products',
        'pages.cart.freeShippingUnlocked': 'Free shipping unlocked',
        'pages.cart.freeShippingRemaining': 'Free shipping in {amount}',
        'common.subtotal': 'Subtotal',
      };
      return labels[key] || key.replace(/^\w+\./, '');
    },
  }),
}));

jest.mock('../utils/paymentMethods', () => ({
  createPaymentMethodDetails: () => [],
  paymentMethodLabel: (method: string) => method,
}));

jest.mock('../utils/conversionConfig', () => ({
  conversionConfig: {
    paymentRecommendation: { enabled: false, byCurrency: {}, fallback: [] },
    giftAtCheckout: { enabled: false, thresholdMxn: 0, giftNameKey: '' },
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
  readCheckoutCartItemIds: () => [1],
  syncCheckoutCartItemIds: jest.fn(),
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
        address: '100 Pet Commerce St',
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
});

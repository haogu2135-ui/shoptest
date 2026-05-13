export const conversionConfig = {
  giftAtCheckout: {
    enabled: true,
    thresholdMxn: 1299,
    giftNameKey: 'pages.checkout.giftToyName',
  },
  subscription: {
    enabled: true,
    discountPercent: 20,
    defaultInterval: '4w',
    intervals: ['2w', '4w', '8w'],
  },
  addOnAssistant: {
    enabled: true,
    maxSuggestions: 3,
    priceCeilingMxn: 260,
    priceCeilingRatio: 1.35,
    priceFloorRatio: 0.45,
  },
  deliveryPromise: {
    enabled: true,
    shipCutoffHour: 15,
    marketWindows: {
      MXN: { minDays: 2, maxDays: 5 },
      USD: { minDays: 4, maxDays: 8 },
      CAD: { minDays: 5, maxDays: 9 },
      EUR: { minDays: 6, maxDays: 10 },
      GBP: { minDays: 6, maxDays: 10 },
    },
    fallbackWindow: { minDays: 5, maxDays: 10 },
  },
  cartUrgency: {
    enabled: true,
    lowStockThreshold: 5,
  },
  saveForLater: {
    enabled: true,
    reminderAfterDays: 3,
    maxBulkRestoreItems: 8,
  },
  checkout: {
    autoSelectBestCoupon: true,
  },
  cartRecentlyViewed: {
    enabled: true,
    maxItems: 4,
  },
  paymentRecommendation: {
    enabled: true,
    byCurrency: {
      MXN: ['MERCADO_PAGO', 'SPEI', 'OXXO'],
      USD: ['STRIPE', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY'],
      CAD: ['STRIPE', 'PAYPAL'],
      EUR: ['STRIPE', 'PAYPAL'],
      GBP: ['STRIPE', 'PAYPAL'],
    },
    fallback: ['STRIPE', 'PAYPAL'],
  },
  productTrustBadges: {
    enabled: true,
    badges: [
      { icon: 'check', titleKey: 'pages.productDetail.trustAuthenticTitle', textKey: 'pages.productDetail.trustAuthenticText' },
      { icon: 'truck', titleKey: 'pages.productDetail.trustShippingTitle', textKey: 'pages.productDetail.trustShippingText' },
      { icon: 'shield', titleKey: 'pages.productDetail.trustReturnsTitle', textKey: 'pages.productDetail.trustReturnsText' },
      { icon: 'support', titleKey: 'pages.productDetail.trustSupportTitle', textKey: 'pages.productDetail.trustSupportText' },
    ],
  },
  productValueBadge: {
    enabled: true,
    minDiscountPercent: 15,
    minPositiveRate: 88,
    minReviewCount: 3,
  },
  socialProof: {
    enabled: true,
    rotateMs: 5200,
    events: [
      { cityKey: 'home.socialProofCities.newYork', name: 'Lucy', productKey: 'home.socialProofProducts.feeder', minutesAgo: 4 },
      { cityKey: 'home.socialProofCities.mexicoCity', name: 'Sofia', productKey: 'home.socialProofProducts.fountain', minutesAgo: 7 },
      { cityKey: 'home.socialProofCities.toronto', name: 'Milo', productKey: 'home.socialProofProducts.bed', minutesAgo: 11 },
      { cityKey: 'home.socialProofCities.shanghai', name: 'Nico', productKey: 'home.socialProofProducts.harness', minutesAgo: 15 },
    ],
  },
  sizeCalculator: {
    breedDefaults: [
      { tokens: ['chihuahua', 'yorkie', 'pomeranian', 'cat', 'kitten', '猫', '吉娃娃', '约克夏'], size: 'XS' },
      { tokens: ['poodle', 'shih', 'dachshund', 'corgi', '柴犬', '贵宾', '柯基'], size: 'S' },
      { tokens: ['beagle', 'bulldog', 'spaniel', '边牧', '斗牛'], size: 'M' },
      { tokens: ['retriever', 'labrador', 'husky', 'samoyed', '金毛', '拉布拉多', '哈士奇', '萨摩耶'], size: 'L' },
      { tokens: ['shepherd', 'rottweiler', 'great dane', 'mastiff', '德牧', '罗威纳'], size: 'XL' },
    ],
    weightBandsKg: [
      { max: 3, size: 'XS' },
      { max: 8, size: 'S' },
      { max: 18, size: 'M' },
      { max: 32, size: 'L' },
      { max: Infinity, size: 'XL' },
    ],
  },
};

export type RecommendedPetSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export type DeliveryPromiseInput = {
  currency?: string;
  locale?: string;
  now?: Date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getDeliveryPromise = ({ currency = 'USD', locale = 'en-US', now = new Date() }: DeliveryPromiseInput) => {
  const config = conversionConfig.deliveryPromise;
  const windowConfig = config.marketWindows[currency as keyof typeof config.marketWindows] || config.fallbackWindow;
  const shipsToday = now.getHours() < config.shipCutoffHour;
  const shipDate = shipsToday ? now : addDays(now, 1);
  const earliest = addDays(shipDate, windowConfig.minDays);
  const latest = addDays(shipDate, windowConfig.maxDays);
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  return {
    enabled: config.enabled,
    shipsToday,
    cutoffHour: config.shipCutoffHour,
    minDays: windowConfig.minDays,
    maxDays: windowConfig.maxDays,
    windowText: `${dateFormatter.format(earliest)} - ${dateFormatter.format(latest)}`,
  };
};

export const getLowStockCount = (stock?: number | null, quantity = 1) => {
  if (!conversionConfig.cartUrgency.enabled || stock === undefined || stock === null) return null;
  const availableStock = Number(stock);
  if (availableStock < Math.max(1, quantity)) return 0;
  return availableStock <= conversionConfig.cartUrgency.lowStockThreshold ? availableStock : null;
};

export const estimatePetSize = (breed: string, weightKg?: number | null): RecommendedPetSize | null => {
  const normalizedBreed = breed.trim().toLowerCase();
  const breedMatch = conversionConfig.sizeCalculator.breedDefaults.find((entry) =>
    entry.tokens.some((token) => normalizedBreed.includes(token.toLowerCase())),
  );
  if (breedMatch) return breedMatch.size as RecommendedPetSize;
  if (!weightKg || weightKg <= 0) return null;
  return conversionConfig.sizeCalculator.weightBandsKg.find((band) => weightKg <= band.max)?.size as RecommendedPetSize;
};

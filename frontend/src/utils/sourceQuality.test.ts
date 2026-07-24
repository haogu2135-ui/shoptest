import * as fs from 'fs';
import * as path from 'path';

const directive = ['eslint', 'disable'].join('-');
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.json']);
const scriptExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const backendContractExtensions = new Set(['.java', '.groovy', '.xml']);

const collectFiles = (root: string): string[] => {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(fullPath);
    }
    return fileExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
};

const collectFilesByExtension = (root: string, extensions: Set<string>): string[] => {
  if (!fs.existsSync(root)) {
    return [];
  }

  const ignoredDirectories = new Set(['.git', 'node_modules', 'target', 'build', 'build-output', 'tmp-build']);
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return collectFilesByExtension(fullPath, extensions);
    }
    return extensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
};

describe('source quality contracts', () => {
  it('keeps frontend source free of ESLint suppression directives', () => {
    const roots = [
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../../scripts'),
    ];
    const offenders = roots
      .flatMap(collectFiles)
      .filter((file) => fs.readFileSync(file, 'utf8').includes(directive))
      .map((file) => path.relative(path.resolve(__dirname, '../..'), file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps modal accessibility on current primitives instead of stale custom dialogs', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const frontendProjectRoot = path.resolve(__dirname, '../..');
    const files = collectFiles(frontendRoot)
      .filter((file) => scriptExtensions.has(path.extname(file)))
      .filter((file) => !/\.(test|spec)\.[tj]sx?$/.test(file));
    const relativeFiles = files.map((file) => path.relative(frontendProjectRoot, file)).sort();

    expect(relativeFiles.filter((file) => /(^|\/)ConfirmDialog\.tsx$/.test(file))).toEqual([]);
    expect(relativeFiles.filter((file) => /(^|\/)CheckoutForm\.tsx$/.test(file))).toEqual([]);

    const customDialogOffenders = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/<[a-z][\w.-]*\b[^>]*\brole=(?:"dialog"|'dialog'|\{'dialog'\})[^>]*>/g))
        .filter(([tag]) => !/\baria-modal=/.test(tag))
        .map(() => path.relative(frontendProjectRoot, file));
    });

    expect(customDialogOffenders).toEqual([]);
  });

  it('keeps commerce skeleton loading states announced by containers only', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const readSource = (relativePath: string) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
    const skeletonSource = readSource('components/SkeletonLoader.tsx');
    const skeletonCssSource = readSource('components/SkeletonLoader.css');
    const homeSource = readSource('pages/Home.tsx');
    const productListSource = readSource('pages/ProductList.tsx');
    const cartSource = readSource('pages/Cart.tsx');

    expect(skeletonSource).toMatch(/className=\{`skeleton skeleton--\$\{type\} \$\{className\}`\} aria-hidden="true"/);
    expect(skeletonSource).toMatch(/className=\{`hero-skeleton \$\{className\}`\} aria-hidden="true"/);
    expect(skeletonSource).toContain('<div className="product-skeleton" aria-hidden="true">');
    expect(skeletonSource).toContain('<div className="stats-strip-skeleton" aria-hidden="true">');
    expect(skeletonCssSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(skeletonCssSource).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.shimmer \{[\s\S]*?animation: none;/);
    expect(skeletonCssSource).not.toContain('animation: pulse-fade 1.6s ease-in-out infinite;');

    expect(homeSource).toContain('shopee-home--loading');
    expect(homeSource).toContain('aria-busy="true"');
    expect(homeSource).toContain('data-home-loading-shell="true"');
    expect(homeSource).toContain('<div role="status" aria-live="polite" aria-busy="true" aria-label={t(\'common.loading\')}>');
    expect(productListSource).toContain('<div className="product-list__loading" role="status" aria-live="polite" aria-busy="true" aria-label={t(\'common.loading\')}>');
    expect(cartSource).toContain('<div className={`cart-page cart-page--${language}`} role="status" aria-live="polite" aria-busy="true" aria-label={t(\'common.loading\')}>');
  });

  it('keeps checkout and cart on current regression-365 contracts instead of stale legacy paths', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const repoRoot = path.resolve(__dirname, '../../..');
    const readFrontend = (relativePath: string) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
    const readRepo = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    const checkoutSource = readFrontend('pages/Checkout.tsx');
    const orderActionsSource = readFrontend('hooks/useCheckoutOrderActions.ts');
    const checkoutFormSectionsSource = readFrontend('components/checkout/CheckoutFormSections.tsx');
    const checkoutTestSource = readFrontend('pages/Checkout.test.tsx');
    const checkoutCssSource = readFrontend('pages/Checkout.css');
    const cartSource = readFrontend('pages/Cart.tsx');
    const cartUiSource = readFrontend('utils/cartUi.ts');
    const cartSessionSource = readFrontend('utils/cartSession.ts');
    const skeletonCssSource = readFrontend('components/SkeletonLoader.css');
    const orderServiceSource = readRepo('src/main/java/com/example/shop/service/OrderService.java');
    const checkoutRequestSource = readRepo('src/main/java/com/example/shop/dto/CheckoutRequest.java');
    const guestCheckoutRequestSource = readRepo('src/main/java/com/example/shop/dto/GuestCheckoutRequest.java');
    const paymentFlowTestSource = readRepo('src/test/java/com/example/shop/service/PaymentFlowServiceTest.java');
    const backendSources = collectFilesByExtension(path.join(repoRoot, 'src'), backendContractExtensions)
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const staleCheckoutApi = ['Checkout', 'API'].join('');
    const staleCreateOrder = ['create', 'Order'].join('');
    const staleCompleteCheckoutSpy = ['complete', 'Checkout', 'Spy'].join('');
    const staleAdminAddToCart = ['admin', 'Add', 'To', 'Cart'].join('');
    const staleEmptyCartMessage = ['empty', 'cart', 'message'].join('-');
    const staleCheckoutUser = ['checkout', 'user'].join('_');
    const submitStart = orderActionsSource.indexOf('const handleSubmit = async (values: CheckoutFormValues) => {');
    const submitSource = orderActionsSource.slice(submitStart, orderActionsSource.indexOf('const retryCreatePayment = async () => {', submitStart));

    expect(backendSources).not.toContain('CouponValidationServiceTest.groovy');
    expect(backendSources).not.toContain('CouponValidationService');
    expect(backendSources).not.toContain('CartItemRestControllerTest.groovy');
    expect(backendSources).not.toContain('checkout_total_div_100');

    expect(checkoutSource).not.toContain(staleCheckoutUser);
    expect(checkoutSource).not.toContain('hiddenAddress');
    expect(checkoutSource).not.toContain('dispatch(loadCartFromServer');
    expect(checkoutSource).not.toContain('tagStyle');
    expect(checkoutSource).not.toContain('tagTextStyle');
    expect(checkoutSource).not.toContain('API_BASE_URL');
    expect(checkoutSource).not.toMatch(/\bfetchCart\b/);
    expect(checkoutSource).not.toContain('window.scrollTo(0, 0)');
    expect(checkoutSource).not.toMatch(/\bconsole\.(warn|error)\b/);
    expect(`${checkoutSource}\n${fs.readFileSync(path.join(frontendRoot, 'hooks/useCheckoutConversionCoach.tsx'), 'utf8')}`).toContain('scrollCheckoutElementIntoView');
    expect(checkoutFormSectionsSource).toContain('key={item.id}');
    expect(checkoutSource).toContain('useCheckoutOrderActions({');

    expect(submitStart).toBeGreaterThan(-1);
    expect(submitSource).toContain('cartItems.some((item) => !isPurchasable(item))');
    expect(submitSource).toContain('cartItemIds: cartItems.map((item) => item.id)');
    expect(submitSource).toContain('shippingAddress,');
    expect(submitSource).toContain('recipientName: recipientPayload.recipientName');
    expect(submitSource).toContain('recipientPhone: recipientPayload.recipientPhone');
    expect(submitSource).not.toContain('unitPrice');
    expect(submitSource).not.toContain('price: item.price');

    expect(checkoutTestSource).not.toContain(staleCheckoutApi);
    expect(checkoutTestSource).not.toContain(staleCreateOrder);
    expect(checkoutTestSource).not.toContain(staleCompleteCheckoutSpy);
    expect(checkoutTestSource).not.toContain(staleAdminAddToCart);
    expect(checkoutTestSource).not.toContain(staleEmptyCartMessage);
    expect(checkoutTestSource).not.toContain('@ts-ignore');
    expect(checkoutTestSource).toContain('orderApi: { checkout: jest.fn(), guestCheckout: jest.fn()');
    expect(checkoutTestSource).toContain('expect(orderApi.checkout).toHaveBeenCalled();');

    expect(cartSource).not.toContain('calculateChange');
    expect(cartSource).not.toMatch(/\bconsole\.(warn|error)\b/);
    expect(cartSource + fs.readFileSync(path.join(frontendRoot, 'hooks', 'useCartQuantityActions.ts'), 'utf8')).toContain('const normalizedQuantity = normalizeCartQuantity(item, quantity);');
    expect(cartSource).toContain('max={limit}');
    expect(cartSource).toContain('disabled={disabled || quantity >= limit}');
    expect(cartUiSource).toContain('Math.min(getCartLineQuantity(quantity), getCartQuantityLimit(item?.stock))');
    expect(cartUiSource).toContain('stock >= getCartLineQuantity(item.quantity)');
    expect(cartSessionSource).toContain('return `${CHECKOUT_CART_ITEM_IDS_KEY}:auth:${userId}`;');

    expect(checkoutCssSource).not.toContain('.checkout-container');
    expect(checkoutCssSource).not.toContain('.empty-cart');
    expect(checkoutCssSource).not.toContain('.payment-method .ant-select-dropdown');
    expect(checkoutCssSource).not.toContain('z-index: 1001');
    expect(checkoutCssSource).not.toContain('checkout-skeleton-item');
    expect(checkoutCssSource).toContain('@media (max-width: 720px)');
    expect(checkoutCssSource).toContain('@media (max-width: 480px)');
    expect(skeletonCssSource).toContain('@media (prefers-reduced-motion: reduce)');

    expect(checkoutRequestSource).toContain('private List<Long> cartItemIds;');
    expect(checkoutRequestSource).not.toContain('unitPrice');
    expect(guestCheckoutRequestSource).not.toContain('unitPrice');
    expect(orderServiceSource).toContain('assertCheckoutItemOwnership(userId, cartItemIds, selectedItems);');
    expect(orderServiceSource).toContain('findByIdsForUpdate(cartItemIds)');
    expect(orderServiceSource).toContain('productRepository.findAllByIdForUpdate(productIds)');
    expect(orderServiceSource).toContain('reserveProductStock(product');
    expect(paymentFlowTestSource).toContain('checkoutUsesAuthoritativeProductPriceInsteadOfCartSnapshotPrice');
  });

  it('keeps AntD message feedback mirrored into screen-reader announcements', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const appSource = fs.readFileSync(path.join(frontendRoot, 'App.tsx'), 'utf8');
    const appCssSource = fs.readFileSync(path.join(frontendRoot, 'App.css'), 'utf8');
    const accessibleMessageSource = fs.readFileSync(path.join(frontendRoot, 'utils/accessibleMessage.ts'), 'utf8');
    const checkoutSource = fs.readFileSync(path.join(frontendRoot, 'pages/Checkout.tsx'), 'utf8');

    expect(appSource).toContain("import { subscribeAccessibleMessages, type AccessibleMessageAnnouncement } from './utils/accessibleMessage';");
    expect(appSource).toContain('export const AccessibleMessageLiveRegion');
    expect(appSource).toContain('<AccessibleMessageLiveRegion />');
    expect(appSource).toContain('aria-label={t(\'app.statusAnnouncementLabel\')}');
    expect(appCssSource).toContain('.app-message-live-region');
    expect(appCssSource).toContain('clip-path: inset(50%);');
    expect(accessibleMessageSource).toContain("const messageMethods: MessageMethodName[] = ['success', 'error', 'warning', 'info'];");
    expect(accessibleMessageSource).toContain('message.open');
    expect(accessibleMessageSource).toContain('export const announceAccessibleMessage');
    expect(checkoutSource).toContain('announceAccessibleMessage(messageText, type)');
    expect(checkoutSource).toContain('const showCheckoutMessage = useCallback((type: CheckoutMessageType, messageText: string) => {');
  });

  it('keeps native mobile keyboard focus indicators visible across common controls', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const mobileAppCss = fs.readFileSync(path.join(frontendRoot, 'mobile-app.css'), 'utf8');

    expect(mobileAppCss).toContain(':focus-visible');
    expect(mobileAppCss).toContain('.shop-nav__bottomItem');
    expect(mobileAppCss).toContain('.ant-select-focused .ant-select-selector');
    expect(mobileAppCss).toContain('.ant-checkbox-wrapper:has(input:focus-visible)');
    expect(mobileAppCss).toContain('outline: 3px solid rgba(238, 77, 45, 0.82) !important;');
    expect(mobileAppCss).toContain('outline-offset: 3px;');
    expect(mobileAppCss).toContain('0 0 0 6px rgba(18, 71, 52, 0.18) !important;');
  });

  it('keeps dark browser chrome advertising aligned with implemented dark CSS', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const publicRoot = path.resolve(__dirname, '../../public');
    const indexHtml = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
    const cssSource = collectFiles(frontendRoot)
      .filter((file) => path.extname(file) === '.css')
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const advertisesDarkThemeColor = /<meta\s+name="theme-color"\s+media="[^"]*prefers-color-scheme\s*:\s*dark[^"]*"/.test(indexHtml);
    const implementsDarkCss = /prefers-color-scheme\s*:\s*dark|color-scheme\s*:\s*dark/.test(cssSource);

    expect(advertisesDarkThemeColor).toBe(implementsDarkCss);
  });

  it('keeps app layer z-index values routed through shared scale tokens', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const targets = ['App.css', 'mobile-app.css'];
    const sources = Object.fromEntries(
      targets.map((relativePath) => [
        relativePath,
        fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8'),
      ]),
    );
    const appCss = sources['App.css'];
    const combinedSource = Object.values(sources).join('\n');
    const rawZIndexOffenders = Object.entries(sources).flatMap(([relativePath, source]) => (
      Array.from(source.matchAll(/z-index\s*:\s*([^;]+);/g))
        .map(([, value]) => ({ file: relativePath, value: value.trim() }))
        .filter(({ value }) => !value.startsWith('var(') && !value.startsWith('auto'))
    ));

    expect(appCss).toContain('--shop-z-critical-mobile-nav: 9000;');
    expect(appCss).toContain('--shop-z-support-open-button: 9800;');
    expect(combinedSource).toContain('z-index: var(--shop-z-skip-link);');
    expect(combinedSource).toContain('z-index: var(--shop-z-critical-mobile-nav) !important;');
    expect(combinedSource).toContain('z-index: var(--shop-z-support-open-button) !important;');
    expect(rawZIndexOffenders).toEqual([]);
  });

  it('keeps storefront personalization on current preference utilities instead of stale Zustand context wiring', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const frontendProjectRoot = path.resolve(__dirname, '../..');
    const packageJson = fs.readFileSync(path.join(frontendProjectRoot, 'package.json'), 'utf8');
    const scriptSource = collectFiles(frontendRoot)
      .filter((file) => scriptExtensions.has(path.extname(file)))
      .filter((file) => !/\.(test|spec)\.[tj]sx?$/.test(file))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    const homeSource = fs.readFileSync(path.join(frontendRoot, 'pages/Home.tsx'), 'utf8');

    expect(packageJson).not.toContain('"zustand"');
    expect(scriptSource).not.toContain('StorefrontContext');
    expect(scriptSource).not.toMatch(/\bfrom ['"]zustand['"]/);
    expect(homeSource).toContain("import { clearProductViewHistory, loadProductViewPreferences, PRODUCT_VIEW_PREFERENCES_KEY } from '../utils/productViewPreferences';");
    expect(homeSource).toContain("import { getLocalStorageItem, hasStoredValue, setLocalStorageItem } from '../utils/safeStorage';");
    expect(homeSource).toContain('const [viewPreferences, setViewPreferences] = useState(() => loadProductViewPreferences());');
    expect(homeSource).not.toContain('window.localStorage');
  });

  it('keeps Home daily discovery cards progressively rendered instead of mounting the full product page', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const homeSource = fs.readFileSync(path.join(frontendRoot, 'pages/Home.tsx'), 'utf8');
    const discoverySectionStart = homeSource.indexOf('<section className="shopee-section shopee-discovery shopee-for-you">');
    const petGalleryComponentStart = homeSource.indexOf('<LazyHomePetGallery', discoverySectionStart);
    const discoverySectionSource = homeSource.slice(discoverySectionStart, petGalleryComponentStart);

    expect(discoverySectionStart).toBeGreaterThanOrEqual(0);
    expect(petGalleryComponentStart).toBeGreaterThan(discoverySectionStart);
    expect(homeSource).toContain('const DISCOVERY_BATCH_SIZE = 12;');
    expect(homeSource).toContain('const HOME_PRODUCT_PAGE_SIZE = 48;');
    expect(homeSource).toContain('const [visibleCount, setVisibleCount] = useState(DISCOVERY_BATCH_SIZE);');
    expect(homeSource).toContain('setVisibleCount(DISCOVERY_BATCH_SIZE);');
    expect(homeSource).toContain('const visibleDiscoveryProducts = useMemo(');
    expect(homeSource).toContain('() => discoveryProducts.slice(0, visibleCount),');
    expect(homeSource).toContain('[discoveryProducts, visibleCount],');
    expect(homeSource).toContain('const hasMoreDiscoveryProducts = visibleCount < discoveryProducts.length;');
    expect(homeSource).toContain('const { scrollHeight, viewportHeight, scrollTop } = getAppScrollMetrics();');
    expect(homeSource).toContain('setVisibleCount((count) => Math.min(count + DISCOVERY_BATCH_SIZE, discoveryProducts.length));');
    expect(homeSource).toContain('const removeScrollListener = addAppScrollListener(handleScroll, { passive: true });');
    expect(discoverySectionSource).toContain('visibleDiscoveryProducts.map((product, index) => (');
    expect(discoverySectionSource).not.toContain('discoveryProducts.map((product, index) => (');
  });

  it('keeps Home product card rendering extracted from the page shell', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const homeSource = fs.readFileSync(path.join(frontendRoot, 'pages/Home.tsx'), 'utf8');
    const cardSource = fs.readFileSync(path.join(frontendRoot, 'components/HomeProductCard.tsx'), 'utf8');

    expect(homeSource).toContain("import HomeProductCard from '../components/HomeProductCard';");
    expect(homeSource).not.toContain('const HomeProductCard:');
    expect(homeSource).not.toContain('type HomeProductCardProps');
    expect(homeSource).not.toContain('const buildHomeProductCardModel');
    expect(cardSource).toContain('export type HomeProductCardProps = {');
    expect(cardSource).toContain('const HomeProductCard: React.FC<HomeProductCardProps>');
    expect(cardSource).toContain('const buildHomeProductCardModel');
    expect(cardSource).toContain('needsOptionSelection(product)');
  });

  it('keeps Home pet gallery rendering extracted from the page shell', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const homeSource = fs.readFileSync(path.join(frontendRoot, 'pages/Home.tsx'), 'utf8');
    const petGallerySource = fs.readFileSync(path.join(frontendRoot, 'components/HomePetGallery.tsx'), 'utf8');

    expect(homeSource).toContain("import type { HomePetGalleryItem } from '../components/HomePetGallery';");
    expect(homeSource).toContain('webpackChunkName: "home-pet-gallery"');
    expect(homeSource).toContain('LazyHomePetGallery');
    expect(homeSource).toContain('<LazyHomePetGallery');
    expect(homeSource).not.toContain('<section className="shopee-section pet-ugc">');
    expect(homeSource).not.toContain('className="profile-mobile-safe-modal pet-ugc-preview"');
    expect(homeSource).not.toContain('const petGalleryImageSizes');
    expect(petGallerySource).toContain('export type HomePetGalleryItem = {');
    expect(petGallerySource).toContain('<section className="shopee-section pet-ugc">');
    expect(petGallerySource).toContain('className="profile-mobile-safe-modal pet-ugc-preview"');
  });

  it('keeps recoverable page failures bound to diagnostics instead of empty catch blocks', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const targets = [
      'App.tsx',
      'components/NativeMobileUpdateGate.tsx',
      'pages/ProductCompare.tsx',
      'pages/Checkout.tsx',
      'hooks/useCheckoutGuestDraft.ts',
      'utils/checkoutHelpers.ts',
      'pages/Profile.tsx',
    ];
    const expectedContexts = [
      'App.mobileUpdateDownload',
      'App.copyDownloadLink',
      'ProductCompare.fetchComparedProducts',
      'ProductCompare.addToCart',
      'ProductCompare.addDirectReadyProductsToCart',
      'Checkout.parseCartItemSelectedSpecs',
      'Checkout.parsePaymentPollResult',
      'Checkout.readGuestDraft',
      'Checkout.hydrateGuestDraft',
      'Profile.fetchUserInfo',
      'Profile.fetchOrders',
    ];

    const sources = Object.fromEntries(
      targets.map((relativePath) => [
        relativePath,
        fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8'),
      ]),
    );
    const emptyCatchOffenders = Object.entries(sources)
      .filter(([, source]) => /\bcatch\s*\{/.test(source))
      .map(([relativePath]) => relativePath);
    const combinedSource = Object.values(sources).join('\n');

    expect(emptyCatchOffenders).toEqual([]);
    expectedContexts.forEach((context) => {
      expect(combinedSource).toContain(`reportNonBlockingError('${context}', error)`);
    });
  });

  it('keeps production frontend catch clauses from omitting error bindings', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const frontendProjectRoot = path.resolve(__dirname, '../..');
    const files = collectFilesByExtension(frontendRoot, scriptExtensions)
      .filter((file) => !/\.(test|spec)\.[tj]sx?$/.test(file));
    const offenders = files
      .filter((file) => /\bcatch\s*\{/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(frontendProjectRoot, file))
      .sort();
    const combinedSource = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

    expect(offenders).toEqual([]);
    [
      'Cart.goCheckout',
      'CartDrawer.goCheckout',
      'Home.fetchHome',
      'Notifications.fetchNotifications',
      'PetGallery.refreshGallery',
      'safeStorage.getLocalStorageItem',
      'productOptions.getProductVariants',
      'domEvents.dispatchDomEvent.primary',
    ].forEach((context) => {
      expect(combinedSource).toContain(`reportNonBlockingError('${context}'`);
    });
  });

  it('keeps reportNonBlockingError calls using a string context first', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const frontendProjectRoot = path.resolve(__dirname, '../..');
    const files = collectFilesByExtension(frontendRoot, scriptExtensions)
      .filter((file) => !/\.(test|spec)\.[tj]sx?$/.test(file));
    const offenders = files
      .filter((file) => /reportNonBlockingError\s*\(\s*\{/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(frontendProjectRoot, file))
      .sort();
    const checkoutSource = fs.readFileSync(path.join(frontendRoot, 'pages/Checkout.tsx'), 'utf8');
    const paymentRecoverySource = fs.readFileSync(path.join(frontendRoot, 'utils/paymentRecovery.ts'), 'utf8');

    expect(offenders).toEqual([]);
    expect(checkoutSource).not.toMatch(/reportNonBlockingError\s*\(\s*\{/);
    expect(paymentRecoverySource).not.toContain('reportNonBlockingError(');
  });

  it('keeps production frontend console calls behind the client error reporter', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const frontendProjectRoot = path.resolve(__dirname, '../..');
    const files = collectFilesByExtension(frontendRoot, scriptExtensions)
      .filter((file) => !/\.(test|spec)\.[tj]sx?$/.test(file));
    const reporterPath = path.join(frontendRoot, 'utils/nonBlockingError.ts');
    const directConsoleOffenders = files
      .filter((file) => file !== reporterPath)
      .filter((file) => /\bconsole\.(error|warn|log|info|debug)\b/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(frontendProjectRoot, file))
      .sort();
    const reporterSource = fs.readFileSync(reporterPath, 'utf8');

    expect(directConsoleOffenders).toEqual([]);
    expect(reporterSource).toContain('const shouldLogClientErrorsToConsole = () => process.env.NODE_ENV !== \'production\';');
    expect(reporterSource).toContain('if (shouldLogClientErrorsToConsole() && typeof console !== \'undefined\' && typeof console.debug === \'function\')');
    expect(reporterSource).toContain('if (shouldLogClientErrorsToConsole() && typeof console !== \'undefined\' && typeof console.warn === \'function\')');
  });

  it('keeps critical navigation/auth/support fallbacks observable instead of silent promise catches', () => {
    const frontendRoot = path.resolve(__dirname, '..');
    const targets = [
      'components/Navbar.tsx',
      'components/CustomerSupportWidget.tsx',
      'hooks/useAuth.ts',
    ];
    const expectedContexts = [
      'Navbar.openNativeAndroidDownload',
      'Navbar.refreshAdminAccess',
      'Navbar.logoutRevoke',
      'CustomerSupportWidget.loadUnreadCount',
      'CustomerSupportWidget.fetchSupportOrders',
      'CustomerSupportWidget.loadSession',
      'CustomerSupportWidget.markReadAfterSessionLoad',
      'CustomerSupportWidget.loadSessionHistory',
      'CustomerSupportWidget.markReadAfterIncomingMessage',
      'CustomerSupportWidget.trackGuestOrderForContext',
      'CustomerSupportWidget.markGuestReadAfterSessionLoad',
      'CustomerSupportWidget.markGuestReadAfterPoll',
      'CustomerSupportWidget.markReadAfterPoll',
      'CustomerSupportWidget.openOrderDetail',
      'CustomerSupportWidget.closeSession',
      'CustomerSupportWidget.loadSessionHistoryAfterSwitch',
      'CustomerSupportWidget.markReadAfterSwitch',
      'CustomerSupportWidget.markGuestReadAfterSwitch',
      'CustomerSupportWidget.switchSession',
      'useAuth.hydrateStoredProfile',
      'useAuth.logoutRevoke',
    ];
    const combinedSource = targets
      .map((relativePath) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8'))
      .join('\n');

    expect(combinedSource).not.toMatch(/\.catch\(\s*\(\)\s*=>/);
    expect(combinedSource).not.toMatch(/\bcatch\s*\{/);
    expect(combinedSource).toContain("cart: 'Navbar.refreshCartBadge'");
    expect(combinedSource).toContain("notification: 'Navbar.refreshNotificationBadge'");
    expectedContexts.forEach((context) => {
      expect(combinedSource).toContain(`reportNonBlockingError('${context}'`);
    });
  });
});

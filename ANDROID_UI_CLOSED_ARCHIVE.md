# Android UI Closed Issue Archive

> Created: 2026-06-05 23:36 UTC
> Scope: issues from `ANDROID_UI_ISSUES.md`, `ANDROID_UI_REGRESSION_PLAN.md`, and `ANDROID_UI_REGRESSION_REPORT.md` that are closed at source level or already have screenshot/static PASS evidence. Items that still need Android WebView/device computed-style verification remain in the regression plan.

## 2026-06-05 23:36 UTC Source-Closed Archive

### Runtime Cascade Closure

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| Lazy CSS can override Android final touch/font fixes | SOURCE_CLOSED / REGRESSION_PENDING | `frontend/src/utils/androidUiFinalGuard.ts` injects a final mobile CSS guard and keeps it as the last `<head>` style after route CSS loads; `frontend/src/App.tsx` installs and refreshes it on route changes. | Recheck Android WebView/App at 360/380/428/768px for computed touch target, input font, modal, drawer, product detail, home, and admin pages. |

### Screenshot/Static PASS Items

| ID | Area | Archived status | Evidence |
|---|---|---|---|
| T01 | Navbar bottom navigation buttons | PASS / ARCHIVED | Regression report recorded 44-50px targets after source fixes. |
| T02 | Native/mobile global button protection | PASS / ARCHIVED | `mobile-app.css` and runtime final guard enforce 44px controls. |
| T03 | Home product-card quick actions | PASS / ARCHIVED | Product-card actions are 44px and App home product cards are simplified. |
| T04 | Home small text | PASS / ARCHIVED | App home text floors and product-card title/price hierarchy are guarded. |
| T05 | ProductReview small text | PASS / ARCHIVED | `ProductReview.css` plus final guard keep mobile text readable. |
| T06 | OrderManagement partial buttons | PASS / ARCHIVED | Page guard and final guard keep admin order controls >=44px. |
| T07 | BugManagement buttons | PASS / ARCHIVED | Existing mobile card/table CSS keeps BUG controls >=44px. |
| T08 | SystemMonitor buttons | PASS / ARCHIVED | Existing SystemMonitor mobile guard keeps controls >=44px. |

### Source-Closed, Device Regression Pending

| Area | Archived status | Evidence |
|---|---|---|
| T09-T21 historical touch-target failures | SOURCE_CLOSED / REGRESSION_PENDING | Page CSS guards and the final runtime guard cover Cart, PetGallery, PetFinder, CustomerSupportWidget, Login, Register, CouponCenter, ProductCompare, Notifications, Wishlist, ProductReview, OrderManagement, and AdminDashboard. |
| T20-T31 font/input floor failures | SOURCE_CLOSED / REGRESSION_PENDING | Mobile/page guards and final runtime guard enforce >=12px compact text and 16px inputs/select search fields. |
| T32-T36 contrast failures | SOURCE_CLOSED / REGRESSION_PENDING | `mobile-page-contrast.css`, `mobileContrastGuard`, and final guards keep links/status colors distinguishable and readable. |
| T37-T47 TSX accessibility/state failures | SOURCE_CLOSED / REGRESSION_PENDING | Support widget Escape/loading/order-error states, Profile `Spin`/`aria-live`/tab roles, and native back debounce are implemented. |
| T48-T68 second-round admin/auxiliary failures | SOURCE_CLOSED / REGRESSION_PENDING | Admin/auxiliary CSS guards plus runtime guard cover table actions, filters, modals, small text, contrast, and overflow grids. |
| T69-T72 global files and Skeleton checks | SOURCE_CLOSED / REGRESSION_PENDING | Global input/button floors, `overflow-x: clip` fallback, and Skeleton shimmer sizing were source-fixed; runtime guard closes late CSS cascade risk. |
| Fourth-round management/component/i18n findings | SOURCE_CLOSED / REGRESSION_PENDING | SearchBar, AddOnAssistant, PetPersonalizedAssistant, Payment, SocialProofToast, ProductManagement import tooltip, CouponManagement grant modal, and remaining management pages have final source guards. |
| PWA/Android metadata findings | SOURCE_CLOSED / REGRESSION_PENDING | `index.html` and `manifest.json` include green theme colors, Android full-screen meta, telephone detection off, maskable icons, scope, orientation, categories, and description. |
| Product detail commerce UX findings | SOURCE_CLOSED / REGRESSION_PENDING | Main image/thumb sizes, title hierarchy, price/delivery, SKU selected state, 44px quantity controls, no-review/FAQ sections, and related accessory recommendations are source-closed. |
| Home first-screen/storefront-density findings | SOURCE_CLOSED / REGRESSION_PENDING | App home source prioritizes search/nav, banner CTA, categories, limited-time activity, best sellers, for-you, and bottom nav; product cards keep 1:1 images, two-line names, price, and add-to-cart action. |

## Active Follow-Up

The active follow-up is no longer source implementation. It is Android WebView/device or screenshot regression against `ANDROID_UI_REGRESSION_PLAN.md`, especially computed style checks at 360/380/428/768px and the latest runtime guard cascade behavior. As of 2026-06-06 05:55 UTC, use the published release-signed APK `1.0.35` / `10035` as the current APP regression target.

## 2026-06-06 05:55 UTC Runtime Release Archive Sync

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| Android UI source closures included in current APK | RELEASED / REGRESSION_PENDING | Public manifest reports `1.0.35` / `10035`, versioned APK `shoptest-1.0.35.apk`, size `3122023`, SHA256 `a7753de4e5d535230025ee502ed041223307e5cc950dcc1b616b9cb21769373a`, release cert `9962289890D74A1FE9DA3E4D6471D2C00B21C76FC9C0622FB93348CF825D880A`. | Android WebView/device screenshots and computed-style checks for home, product detail, bottom nav, login/logout, cart/checkout, support, admin pages, and runtime guard cascade at 360/380/428/768px. |
| APP login recovery prerequisite for UI regression | RUNTIME_FIXED / DEVICE_REGRESSION_PENDING | QA/production IP `129.146.180.88` login blocks were released; active LOGIN blocks are `0`; Redis `login:ip:129.146.180.88` is absent; bad-password `/api/auth/login` returns backend `400` at `/auth/login` instead of blacklist `403`. | Verify valid login, bad-password message, token persistence, logout/re-login, and authenticated screens inside the APK before judging downstream logged-in UI states. |

## 2026-06-06 00:16 UTC Source-Closed Archive

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| F1513 CartPageMemo stale cart-total report | STALE / ARCHIVED | Current source has no `frontend/src/pages/CartPageMemo.tsx` and no matching stale `cartTotal` memo path. | None unless the file/path is reintroduced with current evidence. |
| F1514 cart stock-out quantity display | SOURCE_CLOSED / REGRESSION_PENDING | `Cart.tsx` renders stock-out/unavailable quantity as localized status chip; `Cart.css` keeps the chip readable/touch-stable; unavailable line totals no longer render as purchasable money. | Android WebView cart table/card regression for stock=0, inactive product, quantity > stock, guest/auth carts. |
| F1515 checkout shipping quote default-free risk | SOURCE_CLOSED / REGRESSION_PENDING | `Checkout.tsx` tracks quote `idle/loading/ready/error`, clears stale quote values, shows calculating/unavailable shipping states, disables submit, and blocks submit when authenticated quote is not ready. | Android/customer checkout regression for slow quote, quote failure, coupon failure, successful free/paid shipping, and guest checkout. |

## 2026-06-06 00:34 UTC Source-Closed Archive

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| F1516 payment retry missing report | CURRENT_SOURCE_COVERED / ARCHIVED | Current `Checkout.tsx` already exposes retry-payment actions through `retryCreatePayment` in payment-pending/recovery states. | Keep normal failed-payment recovery regression only. |
| F1517 checkout saved-address load failure | SOURCE_CLOSED / REGRESSION_PENDING | `Checkout.tsx` logs `Checkout.loadAddresses`, shows a localized address-card warning/description and retry action, and keeps new-address checkout available when saved addresses fail to load. | Android/WebView checkout regression for saved-address API failure, retry success, and continue-with-new-address submit. |
| F1518 ErrorBoundary diagnostics | SOURCE_CLOSED / REGRESSION_PENDING | `ErrorBoundary.tsx` reports caught errors and component stack through `reportNonBlockingError` instead of only `console.error`. | Force one render error and verify fallback UI plus non-blocking diagnostic. |
| F1519-F1525 stale utility reports | STALE / ARCHIVED | Current source has no `storeServices.ts`, no standalone `cartApi.ts` `getCart`/`clearLocal`, no `saveGuestOrderNumber`, no `paymentRecovery.checkPaymentStatus/updatePaymentStatus`, and no `capitalizeFirstLetter`. | None for the old paths unless current source evidence returns. |

## 2026-06-06 00:36 UTC Source-Closed Archive

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| F1556 guest cart product names disappear | SOURCE_CLOSED / REGRESSION_PENDING | `guestCart.ts` now normalizes legacy nested guest-cart `product` snapshots into flat `CartItem` metadata, including `productName` and `imageUrl` when present. | Android/WebView guest cart, checkout, and cart drawer regression with old localStorage rows and current add-to-cart rows. |
| F1557 nameless cart rows render blank title | SOURCE_CLOSED / REGRESSION_PENDING | Nameless but valid guest-cart rows preserve `productId`, allowing existing Cart/Checkout/CartDrawer fallback helpers to render `Product #{id}` instead of blank text. | Android/WebView regression for incomplete guest-cart metadata and fallback title readability. |

## 2026-06-05 23:45 UTC Archive Sync

- Closed Android UI items remain archived here instead of being re-listed as active source work.
- `SOURCE_CLOSED / REGRESSION_PENDING` rows still require Android WebView/device computed-style or screenshot evidence before runtime closure.
- No build, APK publish, device run, Playwright screenshot, or service restart was performed for this archive sync.

## 2026-06-06 01:35 UTC Archive Sync

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| ANDROID_UI_ISSUES historical P0/P1 CSS/TSX findings | SOURCE_CLOSED / REGRESSION_PENDING | The current Android UI ledgers already record source closures for touch targets, 12px text floors, 16px inputs, contrast guards, ErrorBoundary/ARIA/support-state fixes, native back handling, PWA metadata, and the runtime Android final guard. | Android WebView/device or screenshot computed-style checks at 360/380/428/768px. |
| Android homepage/storefront density findings | SOURCE_CLOSED / REGRESSION_PENDING | Current source keeps App home priority to search, hero CTA, category entry, limited-time activity, best sellers, for-you products, and simplified 1:1 product cards; final guard prevents lazy CSS from reopening old card-density issues. | Verify against current APK/WebView screenshots, especially App home first viewport and bottom nav active state. |
| Android product detail commerce UX findings | SOURCE_CLOSED / REGRESSION_PENDING | Current source includes larger main image/thumbs, title/rating/price/delivery hierarchy, selected SKU green state, 44px quantity controls, empty-review prompt, FAQ, and related accessory recommendations. | Verify product detail at 360/380/428/768px and image carousel/thumb scrolling on Android WebView. |
| Backend guest-order fixes affecting App order flows | SOURCE_FIXED / REGRESSION_PENDING | New guest checkout stores PII in dedicated recipient/contact fields and persists `guest_order`; order tracking/support/payment-return paths no longer rely only on `[Guest]` in `shippingAddress`. | Regress guest checkout, track order, guest cancel/return, support entry, and payment return in Android App/WebView. |

## 2026-06-06 01:52 UTC Archive Sync

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| Cart suggested/add-on malformed product id | SOURCE_CLOSED / REGRESSION_PENDING | `Cart.tsx` validates suggested-product ids as positive safe integers before authenticated add or guest-cart write. | Android App/WebView cart suggested/add-on add-to-cart for guest/auth sessions and invalid id fixtures. |
| Profile raw translation key fallback | CURRENT_SOURCE_COVERED / ARCHIVED | Current `Profile.tsx` no longer has the reported arbitrary fallback, and shared `i18n.tsx` humanizes missing keys after English fallback. | None unless a current Profile screenshot/source path shows raw keys. |
| Guest cart nested product leakage | SOURCE_CLOSED / REGRESSION_PENDING | `guestCart.ts` returns `NormalizedGuestCartItem[]` and strips legacy nested `product` snapshots from returned/persisted rows. | Android App/WebView Cart/Checkout/CartDrawer with old localStorage nested rows and new add/update/remove rows. |

## 2026-06-06 02:18 UTC Source-Closed Archive

| Area | Archived status | Evidence | Remaining regression |
|---|---|---|---|
| Support chat/admin support message HTML payload display | SOURCE_CLOSED / REGRESSION_PENDING | `SupportService.normalizeContent()` decodes common/numeric HTML entities and neutralizes `<`/`>` before persisting support messages. `CustomerSupportWidget.tsx` and `SupportManagement.tsx` render message content as React text. | Android WebView/App support regression with customer, guest-order, admin reply, and WebSocket messages containing raw/encoded/nested-encoded HTML. Verify safe text display, no script execution, readable wrapping, and no message-bubble overflow. |

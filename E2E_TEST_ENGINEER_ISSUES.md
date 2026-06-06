# E2E Test Engineer Issues

This file tracks E2E scenarios queued for browser, Android WebView, or device validation. Source-only fixes are not treated as verified until an E2E run records runtime evidence.

## Current Queue

## 2026-06-06 21:35 UTC Implementation Cycle #502 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2086.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderStatsServiceTest,OrderMapperSlaConsistencyTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin order wildcard search | SOURCE_FIXED / E2E PENDING | In admin order management, search for order/customer fields containing literal `%`, `_`, `!`, and `\` characters. Verify these characters do not broaden results as SQL wildcards and normal contains searches still work. |
| Admin order filtered counts/export | SOURCE_FIXED / E2E PENDING | Repeat wildcard searches with status/quick filters, summary counters, pagination, and order export. Verify counts/export rows match the visible filtered result set. |

## 2026-06-06 21:27 UTC Implementation Cycle #501 Regression Handoff

Source status: CURRENT_SOURCE_COVERED / NON_ISSUE for F2085.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReviewServiceTest test` ✅
- Static schema review: `schema.sql`, `V1_init.sql`, and `V6__review_unique_product_user_order.sql` contain `uk_reviews_product_user_order (product_id, user_id, order_id)`; `reviews.order_id` remains indexed and FK-backed

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Review uniqueness business rule | CURRENT_SOURCE_COVERED / E2E PENDING | Create or seed a completed order with at least two products for one user. Verify each product can receive one review tied to the same order, while a second review for the same product/user/order is rejected readably. |
| Review schema migration guard | CURRENT_SOURCE_COVERED / E2E PENDING | On a migrated environment, confirm `uk_reviews_product_user_order` exists and no `UNIQUE(order_id)` constraint blocks multi-product review submission. |

## 2026-06-06 21:22 UTC Implementation Cycle #500 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2084.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-zh-locale-f2084 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only
- Static locale check: `rg -n '\$[0-9]' frontend/src/locales/zh.json` ✅ no matches

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Chinese cart/free-shipping amount copy | SOURCE_FIXED / E2E PENDING | Switch the storefront to Chinese and inspect cart, cart drawer, checkout shipping policy, coupon threshold/gap text, and free-shipping prompts. Verify threshold amounts render through localized money formatting and no literal `$20`, `$0`, or `$299` appears in Chinese UI copy. |
| Chinese marketing/notification copy | SOURCE_FIXED / E2E PENDING | Open the Chinese storefront/home promotional area and notification campaign template preview or seeded notification content. Verify new-user and free-shipping copy is localized and does not contain hardcoded dollar-denominated numeric amounts. |

## 2026-06-06 21:15 UTC Implementation Cycle #499 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2083.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-ordertracking-f2083 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order tracking lookup abort on navigation | SOURCE_FIXED / E2E PENDING | Open `/track-order` with a delayed `/orders/track` response, submit a guest lookup, then navigate away before the response returns. Verify the browser aborts the in-flight request and no stale tracked order, lookup error, toast, or loading state appears after leaving the page. |
| Order tracking superseded lookup | SOURCE_FIXED / E2E PENDING | Submit one tracking lookup with a delayed response, immediately submit a different order/email lookup, and verify the first request is aborted or ignored while only the second order populates the page. |
| Order tracking paid refresh | SOURCE_FIXED / E2E PENDING | On a tracked pending-payment order, complete or simulate payment and use the continue-payment flow. Verify the post-payment tracked-order refresh completes normally while any previous refresh request is cancelled and does not overwrite the final paid/order state. |

## 2026-06-06 21:04 UTC Implementation Cycle #498 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2082.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-checkout-f2082 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout pending-payment multi-tab owner lock | SOURCE_FIXED / E2E PENDING | Open the same pending-payment checkout result in two browser tabs for the same order. Verify only one tab repeatedly calls the latest-payment endpoint while the sibling tab does not poll independently and instead updates from the shared storage result when the payment status changes. |
| Checkout polling owner takeover | SOURCE_FIXED / E2E PENDING | Start a pending-payment poll, close or navigate away from the owner tab, wait for the lock TTL to expire, and verify another open checkout tab can take ownership and resume polling without duplicate overlapping latest-payment requests. |
| Checkout paid-state broadcast | SOURCE_FIXED / E2E PENDING | Complete or simulate payment from the owner tab while another tab is open on the pending result. Verify the sibling tab updates to the terminal paid/payment state without firing its own duplicate payment polling request. |

## 2026-06-06 20:52 UTC Implementation Cycle #497 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2081.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-cart-f2081 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart recently viewed cache long session | SOURCE_FIXED / E2E PENDING | In one browser session, repeatedly change recently viewed product history and reopen `/cart` across more than 50 distinct recent-product cache keys/language combinations. Verify the cart recently viewed recovery UI still shows correct products and browser heap does not grow from unbounded `recentProductsCache` entries. |
| Cart recently viewed cache TTL refresh | SOURCE_FIXED / E2E PENDING | Reopen `/cart` with the same recent-products key within the 2-minute cache TTL and verify cached products render without an extra product batch request; after TTL expiry, verify the next cart load refreshes from the product API and expired entries are not reused. |

## 2026-06-06 20:48 UTC Implementation Cycle #496 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2080.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReviewServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product average rating consistency | SOURCE_FIXED / E2E PENDING | With approved reviews on an active product, read the product detail/review average while concurrently adding or approving another review. Verify the response does not mix product visibility and average-rating reads from different transaction snapshots, and the final average becomes correct after the write commits. |
| Inactive product average rating guard | SOURCE_FIXED / E2E PENDING | Mark a product inactive while reviews exist, then call the public product/review average path. Verify inactive products still return the guarded zero/no-public-rating behavior and do not expose stale averages. |

## 2026-06-06 20:42 UTC Implementation Cycle #495 Regression Handoff

Source status: SOURCE_FIXED for F2079. SOURCE_COVERED / NON_ISSUE for F2077 and F2078.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderStatsServiceTest test` ✅
- Static source review: `AdminBugReportService` has no `getAll()` or `getStatusTimeStats()` methods; admin bug list uses `LIMIT/OFFSET`, and summary uses count/group queries.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin bug list pagination bound | SOURCE_COVERED / E2E OPTIONAL | With enough admin bug rows to exceed one page, call `/admin/bugs?page=1&size=20`, an oversized `size`, and filtered/scan-queue variants. Verify responses are bounded and include accurate pagination metadata. |
| Admin bug summary aggregation | SOURCE_COVERED / E2E OPTIONAL | Open the admin bug summary/dashboard and verify counts by status/severity match fixture data without any full bug-list response being requested by the UI. |
| Admin order legacy/admin list bound | SOURCE_FIXED / E2E PENDING | Open `/admin/orders` and `/admin/orders/page` with large order fixtures and oversized `size`. Verify API responses stay capped/paged, pagination totals remain accurate, and no legacy path returns every order row. |

## 2026-06-06 20:34 UTC Implementation Cycle #494 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2076.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminBugReportServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin bug update missing-row failure | SOURCE_FIXED / E2E PENDING | Attempt to update a bug id that does not exist, or delete the row between loading and saving. Verify the API returns a clear failure (`Bug report not found`/bad request path), no success audit is recorded, and the UI does not treat the update as saved. |
| Admin bug update normal path | SOURCE_FIXED / E2E PENDING | Update an existing bug's editable fields and verify the row changes, audit success is recorded, and status/fixed/regression/closed timestamps keep their existing behavior. |

## 2026-06-06 20:29 UTC Implementation Cycle #493 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2075.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReviewServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Concurrent duplicate product review | SOURCE_FIXED / E2E PENDING | For one completed order item, submit two review-create requests for the same `productId`, `userId`, and `orderId` concurrently. Verify exactly one review row is created and the losing request receives the existing already-reviewed business error, not a 500. |
| Multi-item order review allowance | SOURCE_FIXED / E2E PENDING | For a completed order with two purchased products, submit one review for each different product. Verify both succeed, confirming the new uniqueness is product/user/order scoped rather than order-only. |
| Review unique-index migration | SOURCE_FIXED / E2E PENDING | On a database with duplicate same-product/user/order reviews, run migrations and verify `uk_reviews_product_user_order` exists, the earliest duplicate is retained, later exact duplicates are removed, and future duplicate inserts are rejected. |

## 2026-06-06 20:25 UTC Implementation Cycle #492 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2074.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-profile-reorder-f2074 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile reorder quick navigation | SOURCE_FIXED / E2E PENDING | Open Profile order details for an order with multiple items, click reorder while one or more cart-add requests are delayed, navigate away before completion, and verify no React unmounted-state warning, stale reorder toast, stale cart drawer open, or stale loading state appears after leaving. |
| Profile reorder partial failure while mounted | SOURCE_FIXED / E2E PENDING | Keep Profile mounted, make one reorder item add fail and another succeed, and verify the partial success toast/cart-updated behavior still works normally. |

## 2026-06-06 20:22 UTC Implementation Cycle #491 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2073.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-ordertracking-f2073 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| OrderTracking quick navigation during guest lookup | SOURCE_FIXED / E2E PENDING | Open `/track-order`, submit a guest order lookup while the `/orders/track` response is delayed, navigate away before it resolves, and verify no React unmounted-state warning, no stale toast, and no stale tracked order state appears after leaving. |
| OrderTracking overlapping lookup race | SOURCE_FIXED / E2E PENDING | Submit lookup A with a delayed response, then submit lookup B before A resolves. Verify only lookup B can update the visible order/items/error/loading state and lookup A cannot overwrite the newer result when it completes later. |

## 2026-06-06 20:15 UTC Implementation Cycle #490 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2072.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReviewServiceTest,AdminControllerReviewPageTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin review listing pagination bound | SOURCE_FIXED / E2E PENDING | Seed enough reviews to exceed one page, call `/admin/reviews?page=1&size=20`, `/admin/reviews?page=99&size=500`, and filtered status/search variants. Verify responses include bounded `items`, accurate `total`, normalized `page`, capped `size`, `totalPages`, and `summary`; no endpoint should return every review row in one response. |
| Admin review list large-catalog safety | SOURCE_FIXED / E2E PENDING | With a large review fixture, monitor DB/API logs while opening the admin review page and changing filters. Verify review rows are loaded through paged queries only and the page stays responsive without heap spikes or timeout behavior. |

## 2026-06-06 20:10 UTC Implementation Cycle #489 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2050.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-alerts-f2050 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| AlertManagement read permission gate | SOURCE_FIXED / E2E PENDING | With an admin role that can reach the admin shell but lacks the `alerts` page permission, direct-load `/admin/alerts` and verify the page renders the no-permission state, no alert count/table/filter data is visible, refresh is unavailable, and browser/network logs show no `/admin/alerts` or `/admin/alerts/summary` data request. |
| AlertManagement permitted role load | SOURCE_FIXED / E2E PENDING | Grant the same role the `alerts` page permission, reload `/admin/alerts`, and verify summary cards/table/filter data load normally from the alert endpoints. Confirm roles without alert action permissions still cannot run self-check, acknowledge, resolve, batch acknowledge/resolve, or purge actions unless the matching action permission is granted. |

## 2026-06-06 20:02 UTC Implementation Cycle #488 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for TEST_ISSUES Regression #477 duplicate-ID F2048 and F2049.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-guards-f2048 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| AdminDashboard quick navigation during dashboard load | SOURCE_FIXED / E2E PENDING | Open `/admin/dashboard` with a delayed `/admin/dashboard` API response, navigate away before it resolves, and verify no React unmounted-state warning, stale error, or stale loading update. Return to the dashboard and verify normal stats render. |
| OrderManagement quick navigation during carrier load | SOURCE_FIXED / E2E PENDING | Open `/admin/orders` with a delayed logistics carrier options response, navigate away before it resolves, and verify no React unmounted-state warning or stale carrier update. Return to order management and verify carrier data still loads when staying mounted. |

## 2026-06-06 19:58 UTC Implementation Cycle #487 Regression Handoff

Source status: CURRENT_SOURCE_COVERED / E2E PENDING for F2018.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=SupportWebSocketHandlerAuthenticationTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Support WebSocket handshake authentication | CURRENT_SOURCE_COVERED / E2E PENDING | Connect to `/ws/support` with no `Sec-WebSocket-Protocol` auth token and with an invalid/revoked token; both should close before receiving `CONNECTED`. Connect with a valid logged-in user's JWT via `support.v1, auth.<base64url-token>` and verify `CONNECTED`, message send/receive, and no token appears in the WebSocket URL. |

## 2026-06-06 19:54 UTC Implementation Cycle #486 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2019 and F2020.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminSystemControllerTest,AdminRegistryControllerTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin system status detail permission | SOURCE_FIXED / E2E PENDING | With an admin role that can access the `system` page but lacks `system:status`, call `/admin/system/status` and `/admin/system/readiness`; both should return 403 and no infrastructure payload. Grant `system:status` and verify both endpoints return the existing status/readiness payload. |
| Admin registry topology detail permission | SOURCE_FIXED / E2E PENDING | With an admin role that can access the `registry` page but lacks `registry:status`, call `/admin/registry` and `/admin/registry/readiness`; both should return 403 and must not expose known services or instances. Grant `registry:status` and verify the registry payload returns normally. |

## 2026-06-06 19:48 UTC Implementation Cycle #485 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2021.

Local verification already run:
- Backend email-code Maven: `./mvnw -q -Dtest=EmailLoginServiceTest test` ✅
- Backend auth/profile Maven: `./mvnw -q -Dtest=AuthControllerForgotPasswordTest,UserControllerUpdateProfileTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Email-code account enumeration timing | SOURCE_FIXED / E2E PENDING | Compare repeated `/auth/email-code` and `/auth/password-reset-code` requests for registered, disabled, and unknown emails under the same client IP. Verify response shape remains non-enumerating and unknown/disabled paths are not observably immediate compared with delivery paths, within the configured `MAIL_ACCOUNT_ENUMERATION_PADDING_MS`. |

## 2026-06-06 19:43 UTC Implementation Cycle #484 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2013 and F2030.

Local verification already run:
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-profile-f2013 MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅, with existing Browserslist stale-data warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile quick navigation during async loads | SOURCE_FIXED / E2E PENDING | Open Profile with delayed profile, orders, addresses, pet profiles, payment channels, and payment polling responses; navigate away before each resolves. Verify no React unmounted-state warning, no stale toast after leaving, and normal Profile data still loads when staying on the page. |
| Profile payment-return order sync race | SOURCE_FIXED / E2E PENDING | Return to `/profile?payment=success&orderNo=...` while the initial orders request is delayed and payment sync completes first. Verify the final visible order/payment state is the synced latest state and is not overwritten by the older initial orders response. |

## 2026-06-06 19:40 UTC Implementation Cycle #483 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2023. F2022 is CURRENT_SOURCE_COVERED / NON_ISSUE because JWT authentication reloads user details and rejects tokens issued before `passwordChangedAt`; password reset/change updates that timestamp.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest#cancellingPendingPaymentOrderReleasesCouponFromPreUpdateStatus test` ✅
- Backend payment flow Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` ✅
- Backend JWT Maven: `./mvnw -q -Dtest=JwtServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pending-payment cancellation with coupon | SOURCE_FIXED / E2E PENDING | Place an authenticated order using a coupon, cancel it while still `PENDING_PAYMENT`, and verify the order becomes `CANCELLED`, pending payment rows are closed, stock is restored, and the user coupon returns to usable/unconsumed state. |
| Password reset invalidates old JWT | CURRENT_SOURCE_COVERED / E2E PENDING | Log in and capture an access token, complete password reset/change, then call an authenticated endpoint with the old token. Verify it is rejected, while a fresh login token succeeds. |

## 2026-06-06 19:36 UTC Implementation Cycle #482 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2012. F2011 is CURRENT_SOURCE_COVERED / NON_ISSUE because the public bootstrap route is token-gated, DB-lock protected, refuses creation after any admin exists, and production readiness fails when the bootstrap token remains configured.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest#checkoutPersistsDiscountedTotalBeforeCouponIsMarkedUsed test` ✅
- Backend payment flow Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` ✅
- Backend bootstrap guard Maven: `./mvnw -q -Dtest=UserServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon checkout payment amount | SOURCE_FIXED / E2E PENDING | Complete authenticated checkout with a coupon and shipping fee. Verify the inserted/visible order total and payment-create amount are already discounted before coupon-mark-used completes; no transient undiscounted payment amount should be observable. |
| Admin bootstrap guard | CURRENT_SOURCE_COVERED / E2E PENDING | In a seeded environment with an existing ADMIN/SUPER_ADMIN, POST `/users/create-admin` with missing, wrong, and valid `X-Bootstrap-Token`; all should be rejected without creating another admin. In production readiness, confirm a configured `admin.bootstrap-token` is reported as a failing check after bootstrap. |

## 2026-06-06 19:26 UTC Implementation Cycle #481 Regression Handoff

Source status: SOURCE_FIXED / E2E PENDING for F2014, F2016, F2026, F2027, F2029, F2036, F2037. F2035 is CURRENT_SOURCE_COVERED / NON_ISSUE because `AdminLayout.tsx` already wraps the admin `<Outlet />` in an `ErrorBoundary`.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminSystemControllerTest,AdminRegistryControllerTest,SecurityConfigCorsTest test` ✅
- Frontend build: `CI=true BUILD_PATH=/tmp/shoptest-frontend-build-f201x MOBILE_RELEASE_SKIP_GENERATION=true npm run build` ✅
- Frontend targeted Jest: `npm test -- --runInBand --watchAll=false src/pages/Checkout.test.tsx src/pages/CartCheckoutFlow.test.tsx` ✅ 12/12, with existing React act / Router future warnings only

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin controller defense-in-depth | SOURCE_FIXED / E2E PENDING | As anonymous, USER, and ADMIN, hit `/admin/alerts`, `/admin/config-center`, `/admin/ip-blacklist`, `/admin/logs`, `/admin/registry`, `/admin/system/status`, and `/admin/traffic-control`. Verify anonymous/user blocked, admin accepted, and no 500 from new class-level `@PreAuthorize`. |
| CORS explicit headers | SOURCE_FIXED / E2E PENDING | Browser preflight from allowed origin with `Authorization`, `Content-Type`, `Accept-Language`, request/correlation IDs, `X-Bootstrap-Token`, and `Idempotency-Key`; verify allowed. Also verify an unexpected custom header is rejected or not echoed. |
| Admin keyboard focus | SOURCE_FIXED / E2E PENDING | Keyboard-tab through AdminDashboard action/readiness/payment/SLA cards and AlertManagement stat cards. Verify visible focus outline, no layout jump, and hover/active states remain visually coherent. |
| Cart recently-viewed quick navigation | SOURCE_FIXED / E2E PENDING | Open Cart with recently-viewed products, navigate away before product lookup resolves, then return. Verify no React unmounted-state warning and no stale recently-viewed products overwrite current state. |
| Checkout async quick navigation | SOURCE_FIXED / E2E PENDING | Open authenticated Checkout while payment channels, address load, and coupon quote are delayed; navigate away before each resolves. Verify no unmounted-state warning, no stale message/toast after leaving, and normal checkout still works when staying on page. |

## 2026-06-06 02:18 UTC Static Support Stored-XSS E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Support message stored HTML/script payloads | SOURCE_FIXED / E2E PENDING | `SupportService.normalizeContent()` now decodes common/numeric HTML entities and neutralizes `<`/`>` before persisted support messages are inserted. Current customer/admin support views render message content as React text. | Run customer, guest-order, admin reply, and support WebSocket flows with raw `<script>`, encoded `&lt;img src=x onerror=...&gt;`, and nested `&amp;lt;script&amp;gt;` payloads. Assert returned/persisted content contains no raw `<` or `>` and no script/HTML executes. |

## 2026-06-06 02:30 UTC Static Public Catalog Pagination E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Public catalog and search bounded responses | SOURCE_FIXED / E2E PENDING | `ProductServiceImpl.findPublicProducts(ProductListQuery)` now always uses the JPA paged query, including callers that omit page/size; legacy `ProductService.search(...)` uses capped page 0 via `product.search-legacy-max-results`. | Cover `/search`, `/home/products`, and product-list category/filter/sort flows with missing, oversized, invalid, and normal pagination parameters. Verify bounded results, stable first-page sort/filter behavior, and no duplicate/missing product cards. |

## 2026-06-06 02:36 UTC Static Coupon Pagination E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Coupon center/admin/wallet bounded responses | CURRENT_SOURCE_COVERED / E2E PENDING | Public coupons use capped pageable repository reads, admin coupon list/search uses `PageRequest`, and wallet/available coupon reads use limited mapper calls. | Cover coupon center, admin coupon list/search/filter, wallet coupons, available coupons, checkout coupon selector, and large/empty coupon fixtures. |

## 2026-06-06 02:47 UTC Static Brand and Order Pagination E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Public brand dictionary and brand-search bounded responses | SOURCE_FIXED / E2E PENDING | `ProductService.getProductsByBrand` is absent in current source; public product brand keyword matching uses the paged JPA product query, and `/brands` now calls capped pageable `BrandService.findAll(true, publicBrandLimit())` using `brand.public-list-max-rows`. | Cover `/brands`, product list/search with brand keywords, home/product selectors that consume active brands, and admin product brand options against large active/inactive brand fixtures. Verify bounded counts, active-only public fields, no duplicate/missing options, and stable UI layout. |
| Admin order status bounded responses | CURRENT_SOURCE_COVERED / E2E PENDING | Current `/admin/orders` and `/admin/orders/page` use `OrderMapper.searchAdminOrders` with SQL `orders.status = #{status}` plus `LIMIT/OFFSET`; no Java-side `getOrdersByStatus` full-table filter path exists. | Cover admin order status tabs/filters, quick filters, search, page beyond total, oversized size, and export cap. Verify totals, pages, and summary remain coherent with large order fixtures. |

## 2026-06-06 03:04 UTC Static Order Read N+1 E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Order list/detail guest-customer enrichment | SOURCE_FIXED / E2E PENDING | `OrderService.buildOrderDetail` is absent and item details already use one joined item/product query. `OrderMapper` now reuses `orderCustomerSelectColumns` for single-order, order-number, user-order-list, admin-list, and recent-admin-order reads, so these rows carry customer display/type and computed guest flags without per-order user fallback lookups. | Cover `/orders/me`, `/orders/{id}`, `/orders/guest/{id}`, `/orders/track`, `/admin/orders`, admin dashboard recent orders, order items tab, and order payments tab with registered, guest-flag, legacy `[Guest]`, and `users.status=GUEST` fixtures. Verify no lost customer labels, no guest/member misclassification, and no extra per-row user lookup in query logs if available. |

## 2026-06-06 03:26 UTC Static Dashboard Product Counts E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Admin dashboard product-count aggregation | SOURCE_FIXED / E2E PENDING | `/admin/dashboard` now gets total, active, inactive, pending-review, and low-stock product counts from one `ProductRepository.countDashboardProductCounts()` aggregate projection via `ProductService.countDashboardProductSummary()`, then reuses that row in `AdminController.getDashboard()`. | Cover `/admin/dashboard` with mixed `ACTIVE`, `INACTIVE`, `PENDING_REVIEW`, `REJECTED`, null/blank status, and low-stock fixtures. Verify count cards and API response shape remain compatible, `inactiveProducts` is present, and product count queries are not repeated if query logs are available. |

## 2026-06-06 03:38 UTC Static Public Review List N+1 E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Public product review list product/user fetch | SOURCE_FIXED / E2E PENDING | `ReviewService.getPublicReviewsByProductId(...)` remains bounded by `review.public-max-rows`; public review repository queries now join-fetch `Review.product` and `Review.user` before `PublicReviewResponse` mapping. Review images are read from the same `reviews.image_urls` column. | Cover `/reviews/product/{id}` and `/products/{id}/reviews` as anonymous and logged-in users with approved reviews, the current user's pending review, uploaded image URLs, admin replies, inactive products, and large review fixtures. Verify response shape, masked usernames, editability, ordering, limit, average rating, and no per-row product/user lookup if query logs are available. |

## 2026-06-06 03:51 UTC Static Admin User Summary E2E Addendum

No browser E2E, Playwright trace/video, backend test, service restart, Nginx reload, device install, APK publish, curl, Jest, Maven, or commit was run in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Admin user summary aggregation | CURRENT_SOURCE_COVERED / E2E PENDING | The reported `AdminUserService.getUserStats` path is absent. Current `/admin/users/summary` calls `UserService.adminSummary(...)`, which delegates to one `UserMapper.adminSummary` conditional-aggregate SQL for total, active, banned, admin, customer, missing email/phone, and ready users under the same filters. | Cover `/admin/users/summary` with keyword, role, and status filters plus mixed admin/customer/guest/active/banned fixtures. Verify counts, `adminRatioPercent`, `healthScore`, and coherence with `/admin/users/page` filtered totals/list. |

### 2026-06-06 00:16 UTC - Cart and Checkout Source-Fix Regression Queue

Status: QUEUED / NOT RUN

Source context:
- F1513 is stale/current-source-covered: current source has no `CartPageMemo.tsx` and no matching stale cart-total memo path.
- F1514 is source-fixed: cart stock-out and unavailable lines render localized status chips instead of disabled quantity `1`, and unavailable totals no longer render as money.
- F1515 is source-fixed: authenticated checkout fails closed while backend shipping/coupon quote is idle, loading, failed, or unavailable; submit is disabled/blocked until quote is ready.

Required E2E coverage:

| ID | Priority | Scenario | Required evidence |
|---|---|---|---|
| E2E-CART-001 | P0 | Guest cart with purchasable, stock-out, inactive/unavailable, and quantity-above-stock lines | Unavailable lines show localized status chips, no disabled quantity `1`, no money total for unavailable lines, purchasable totals remain correct, no horizontal overflow on mobile/WebView viewports. |
| E2E-CART-002 | P0 | Authenticated cart with the same mixed availability fixture | Auth cart API rows produce the same status-chip and total behavior as guest cart rows. |
| E2E-CART-003 | P0 | Select all, clear unavailable, and checkout navigation from cart | Select-all excludes or normalizes unavailable lines as intended, clear-unavailable removes only unavailable lines, checkout navigation carries only selected purchasable item IDs. |
| E2E-CHECKOUT-001 | P0 | Authenticated checkout with delayed shipping/coupon quote | Shipping/total area shows calculating state, submit is disabled while quote is pending, direct submit attempts are blocked, and ready quote later enables submit with real paid/free shipping values. |
| E2E-CHECKOUT-002 | P0 | Authenticated checkout with quote HTTP 500 | Shipping/total area shows unavailable/error state, no free-shipping fallback is displayed, submit remains disabled, and no order/payment request is sent. |
| E2E-CHECKOUT-003 | P0 | Authenticated checkout with quote network failure | Same fail-closed behavior as quote HTTP 500, including no order/payment request. |
| E2E-CHECKOUT-004 | P1 | Authenticated checkout selected-coupon quote failure | Coupon failure clears/blocks stale quote totals, shows unavailable/error state, keeps submit disabled, and does not create an order. |
| E2E-CHECKOUT-005 | P0 | Authenticated checkout success with paid shipping | Quote response displays the real paid shipping fee and payable amount, submit enables only after quote readiness, order creation uses selected cart IDs, and payment creation starts. |
| E2E-CHECKOUT-006 | P0 | Authenticated checkout success with free shipping | Quote response displays free shipping only after backend quote readiness, submit enables, order creation uses selected cart IDs, and payment creation starts. |
| E2E-CHECKOUT-007 | P0 | Guest checkout success | Guest checkout remains independent of authenticated quote gating, uses selected guest cart items, creates guest order/payment, removes submitted guest cart items, and clears checkout selection. |

Suggested harness:
- Prefer deterministic route-fulfilled API fixtures for browser/Android WebView E2E so delayed, 500, and network-failure quote states are reproducible.
- Cover at least desktop storefront width and Android WebView-like mobile width; include Android/App class injection if using the App smoke harness.
- Record DOM/network assertions only unless the run explicitly requires screenshots or device artifacts.

Not run in this handoff:
- No Playwright, Appium, Jest, Maven, build, APK packaging, curl, screenshot, video, or trace run was performed for this queue entry.

## 2026-06-06 01:52 UTC Static Cart/Guest-Cart E2E Addendum

No browser E2E, Playwright run, build, service restart, APK publish, curl, Jest, Maven, or code commit was performed in this pass. This queue entry refers to frontend `TEST_ISSUES.md` F1558-F1560 only.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Cart suggested/add-on add-to-cart id safety | SOURCE FIXED / E2E PENDING | `Cart.tsx` rejects invalid suggested-product ids before cart API or guest-cart mutation and uses the guarded numeric id for selected-item sync. | Add authenticated and guest cart E2E with a normal suggested product and an invalid/non-numeric fixture id. Verify no malformed cart row, readable add failure, and valid add selects the new row. |
| Legacy guest-cart flat migration | SOURCE FIXED / E2E PENDING | `guestCart.ts` consumes nested `item.product` snapshots only during normalization and returns/persists `NormalizedGuestCartItem[]` without `product`. | Seed localStorage with legacy nested rows, open Cart, Checkout, and CartDrawer, then update/remove/add rows. Verify product title/image/price survive migration and storage is rewritten flat. |
| Profile missing translation fallback | CURRENT_SOURCE_COVERED / NON_ISSUE | Current Profile source lacks the reported arbitrary fallback; shared i18n fallback humanizes missing keys. | No dedicated old-path E2E unless a current raw translation key appears in rendered Profile. Keep normal Profile locale coverage. |

## 2026-06-06 02:08 UTC Static Regression #66 E2E Addendum

No browser E2E, Playwright run, build, service restart, APK publish, curl, Jest, Maven, or code commit was performed in this pass.

| Flow | Current result | Evidence | E2E follow-up |
|---|---|---|---|
| Backend support admin response test compile | SOURCE FIXED / E2E PENDING | `SupportControllerAdminResponseTest` constructor call matches the current controller dependencies. | Rerun backend targeted test or Maven suite when permitted; compile should no longer fail on stale `UserRepository` argument. |
| CartCheckoutFlow item-name visibility | SOURCE COVERED / E2E PENDING | Cart/Checkout render names from flat `productName`, guest-cart migration preserves product metadata, and test i18n fallback matches production humanized fallback. | Rerun `CartCheckoutFlow.test.tsx`; if Guest Bowl/Member Kibble still fail, capture rendered DOM and current mock state before reopening. |

## 2026-06-06 01:35 UTC Guest Order E2E Queue

Source context:
- F1541/F1545 are source-fixed: guest/member detection now persists `orders.guest_order` and uses explicit guest semantics before legacy `[Guest]` prefix fallback.
- F1546 is source-fixed: new guest checkout stores delivery address in `shippingAddress` and stores name/phone/email in dedicated order fields.
- F1543/F1547/F1548/F1549/F1550/F1551/F1552/F1554 are archived as stale/current-source-covered; F1553 remains open.

Required E2E coverage:

| ID | Priority | Scenario | Required evidence |
|---|---|---|---|
| E2E-GUEST-ORDER-001 | P0 | New guest checkout persistence contract | Created order has `guestOrder=true`, delivery-only `shippingAddress`, populated `recipientName`, `recipientPhone`, and `contactEmail`, and no `[Guest] name / phone / email` concatenation. |
| E2E-GUEST-ORDER-002 | P0 | Guest track/detail/items access | New `guest_order` row can be tracked and opened with order number + email; member order with matching email still requires account login. |
| E2E-GUEST-ORDER-003 | P1 | Guest actions and support | Guest cancel/return/return-shipment and guest support session entry work for new `guest_order` rows and reject wrong email/order number. |
| E2E-GUEST-ORDER-004 | P1 | Payment return routing | Guest payment success/cancel return routes to the track-order experience for new `guest_order` rows. |
| E2E-GUEST-ORDER-005 | P2 | Legacy compatibility | Existing `[Guest] name / phone / email / address` orders still track and render sanitized customer responses. |

Not run in this handoff:
- No Playwright, Appium, Jest, Maven, build, APK packaging, curl, screenshot, video, or trace run was performed for this queue entry.

### 2026-06-06 01:12 UTC - Rate-Limit Source-Fix Regression Queue

Status: QUEUED / NOT RUN

Source context:
- F1538 is source-fixed: payment create/sync/callback/webhook routes now have endpoint-specific rate-limit buckets.
- F1539 is source-fixed: guest order lookup routes now have endpoint-specific rate-limit buckets.
- F1540 is source-fixed: guest order cancel/confirm/return/return-shipment routes now have endpoint-specific rate-limit buckets.

Required E2E coverage:

| ID | Priority | Scenario | Required evidence |
|---|---|---|---|
| E2E-RATE-001 | P0 | Payment create burst on `POST /payment` or `/payments` | Normal first calls succeed as expected; requests over configured threshold receive 429 with rate-limit headers; no extra order/payment rows or stock corruption. |
| E2E-RATE-002 | P0 | Payment sync and callback burst | Sync/callback routes receive 429 after threshold while normal single sync/callback remains accepted. |
| E2E-RATE-003 | P0 | Guest order lookup burst | `GET /orders/guest/**` and `POST /orders/track` are throttled after the configured lookup threshold. |
| E2E-RATE-004 | P0 | Guest order mutation burst | Guest cancel/confirm/return/return-shipment endpoints are throttled after the configured mutation threshold. |

Not run in this handoff:
- No Playwright, Appium, Jest, Maven, build, APK packaging, curl, screenshot, video, or trace run was performed for this queue entry.

### 2026-06-06 00:57 UTC - Product/Review/Stale-Path Source-Fix Regression Queue

Status: QUEUED / NOT RUN

Source context:
- F1500 is source-fixed: direct product saves now require normalized non-empty names, `price > 0`, required stock/category, and safe image URL normalization.
- F1502/F1533 are source-fixed: review submit/list/alias/reviewable-order endpoints now use typed `ReviewCreateRequest`, `PublicReviewResponse`, `ProductReviewsResponse`, and `List<ReviewableOrderResponse>`.
- F1499/F1501/F1503/F1504/F1542 are stale/current-source-covered: the reported old product timestamp leak, WeChat query-param callback, MessageController raw query-map, arbitrary user-status endpoint, and missing create-admin count guard are absent or guarded in current source.

Required E2E coverage:

| ID | Priority | Scenario | Required evidence |
|---|---|---|---|
| E2E-PRODUCT-001 | P0 | Admin product create/update with blank or HTML-only product name | Backend rejects the payload with a readable validation error and no product mutation persists. |
| E2E-PRODUCT-002 | P0 | Admin product create/update with zero, negative, and positive prices | Zero/negative prices fail; positive price saves normally and remains visible after reload. |
| E2E-PRODUCT-003 | P1 | Admin product image URL validation | Unsafe `javascript:`/private-host URLs fail; valid `/uploads/...` and https image URLs save normally. |
| E2E-REVIEW-001 | P0 | Review submit validation | Missing order, invalid rating, blank/long comment, and invalid image URLs fail readably without page breakage. |
| E2E-REVIEW-002 | P0 | Review submit happy path | Completed eligible order can submit a review with 0/1/max images, response maps to `PublicReviewResponse`, and product detail shows the submitted review after reload. |
| E2E-USER-STATUS-001 | P1 | Admin user status guarded flows | Active/ban/unban succeeds as permitted; invalid status, self status change, guest status mutation, and non-super-admin privileged-operator status changes fail readably. |
| E2E-BOOTSTRAP-001 | P2 | Concurrent admin bootstrap on initialized system | After one admin exists, repeated/concurrent bootstrap attempts fail; do not treat bootstrap token exposure as closed by this count-guard check. |

Not run in this handoff:
- No Playwright, Appium, Jest, Maven, build, APK packaging, curl, screenshot, video, or trace run was performed for this queue entry.

# E2E Test Engineer Issues

This file tracks E2E scenarios queued for browser, Android WebView, or device validation. Source-only fixes are not treated as verified until an E2E run records runtime evidence.

## Current Queue

## 2026-06-10 21:11 UTC QA F3515 CustomerSupportWidget Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Customer Support Widget production `any` usage is closed.
- `CustomerSupportWidget.tsx` legacy Safari audio compatibility now uses `LegacyAudioWindow` instead of `window as any`.
- Guest support session load, message send, and order-send failures now use `unknown`; localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `CustomerSupportWidgetTypeSafety.test.ts` source guard rejects the old support widget `any`/`window as any` patterns and requires typed browser compatibility access.
- Source search for production `any` in `CustomerSupportWidget.tsx` returned no matches.
- `git diff --check -- frontend/src/components/CustomerSupportWidget.tsx frontend/src/components/CustomerSupportWidgetTypeSafety.test.ts` passed.
- Jest/TypeScript were not rerun in this round because `frontend/node_modules` was intentionally removed during workspace cleanup.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated support widget | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log in, open the floating support widget, verify session creation, message history, unread reset, websocket fallback behavior, localized load failure, and notification tone still work. |
| Guest order support context | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open support from a guest order context, verify guest session creation, tracked order context, localized load failure, and guest read markers. |
| Send message and order | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Send a normal message and share an order with websocket online/offline paths; verify success/failure toasts, content clearing, session history updates, and duplicate order sends are avoided. |
| Mobile support widget | PARTIAL_SOURCE_FIXED / MOBILE STOREFRONT E2E RECOMMENDED | Check phone/tablet widths for floating button position, draggable state, order picker popup, conversation panel, keyboard clearance, and no overlap with bottom navigation. |

## 2026-06-10 21:03 UTC QA F3515 CartDrawer Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Cart Drawer production `any` usage is closed.
- `CartDrawer.tsx` cart load/remove/save-for-later/clear-blocked failures now use `unknown`.
- Auth-expired status detection narrows an `unknown` error response; localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `CartDrawerTypeSafety.test.ts` source guard rejects the old Cart Drawer `any` catch patterns and requires the typed auth-expired helper.
- `CI=true npm test -- --runTestsByPath src/components/CartDrawerTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `CartDrawer.tsx` returned no matches.
- `git diff --check -- frontend/src/components/CartDrawer.tsx frontend/src/components/CartDrawerTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated cart drawer load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log in, open the cart drawer with active and blocked items, and verify loading state, localized load failure, auth-expired fallback to guest cart, totals, free-shipping copy, and checkout enablement. |
| Guest cart drawer | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log out, add guest items, open drawer, change quantities, remove items, and verify guest cart state and badge updates remain correct. |
| Save for later and remove | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Save an item for later and remove an item with API success/failure; verify optimistic state, rollback on failure, localized errors, and cart-updated events. |
| Clear blocked items and checkout | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Include unavailable/low-stock items, clear blocked items, then start checkout or express checkout; verify localized failure handling and persisted checkout item IDs. |
| Mobile cart drawer | PARTIAL_SOURCE_FIXED / MOBILE STOREFRONT E2E RECOMMENDED | Check phone/tablet widths for drawer stacking, trust rows, quantity controls, action footer, add-on panels, and no overlap with bottom navigation. |

## 2026-06-10 20:58 UTC QA F3515 OrderTracking Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Order Tracking production `any` usage is closed.
- `OrderTracking.tsx` order lookup, refresh, payment continuation, cancellation, receipt confirmation, return request, and return shipment failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `OrderTrackingTypeSafety.test.ts` source guard rejects the old Order Tracking `any` catch patterns.
- `CI=true npm test -- --runTestsByPath src/pages/OrderTrackingTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `OrderTracking.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/OrderTracking.tsx frontend/src/pages/OrderTrackingTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest order lookup | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open `/track-order`, submit a valid and invalid guest order/email pair, and verify result rendering, localized lookup failure, URL email stripping, and support context behavior. |
| Order refresh and logistics | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Refresh a tracked order with shipped and pending statuses; verify refreshed order details, localized refresh failure warning, and the carrier widget remains usable. |
| Payment/cancel actions | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | For a pending-payment order, continue payment and cancel/restore to cart; verify success/failure messages, safe payment URL navigation, and cart update behavior. |
| Receipt and return actions | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | For shipped/returnable orders, confirm receipt, request return, and submit return tracking; verify localized success/failure handling and refreshed status. |
| Mobile order tracking | PARTIAL_SOURCE_FIXED / MOBILE STOREFRONT E2E RECOMMENDED | Check phone/tablet widths for lookup form, result actions, return modals, logistics widget, and no action rail clipping. |

## 2026-06-10 19:05 UTC QA F3515 BugManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Bug Management production `any` usage is closed.
- `BugManagement.tsx` bug list/summary/save/status failures now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`; localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `BugManagementTypeSafety.test.ts` source guard rejects the old Bug Management `any` catch and direct `error?.errorFields` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/BugManagementTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` and direct validation-error access in `BugManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/BugManagement.tsx frontend/src/pages/BugManagementTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Bug list/search/filter | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/bugs`, search and filter by status/severity/module/scan queue, and verify list rows, summary cards, pagination, loading skeleton, empty state, and localized load-failure handling. |
| Bug create/edit validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open create/edit modal, trigger required-field validation, then save a valid bug and verify localized success/error handling plus refreshed list/summary. |
| Bug scan/status update | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Scan or update a bug status with permitted and non-permitted users; verify validation, localized failure handling, status refresh, and regression handoff fields. |
| Mobile bug admin | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for toolbar filters, modal footer clearance, table-card labels, popups, and no overlap with admin chrome. |

## 2026-06-10 18:56 UTC QA F3515 SecurityAuditLogManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Security Audit Log Management production `any` usage is closed.
- `SecurityAuditLogManagement.tsx` audit-log load/export/purge failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `SecurityAuditLogManagementTypeSafety.test.ts` source guard rejects the old audit-log `any` catch patterns.
- `CI=true npm test -- --runTestsByPath src/pages/SecurityAuditLogManagementTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `SecurityAuditLogManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/SecurityAuditLogManagement.tsx frontend/src/pages/SecurityAuditLogManagementTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Audit log list load | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/audit-logs`, load representative success/failure/result/resource filters, and verify localized list, summary cards, pagination, loading state, empty state, and localized load-failure toast. |
| Audit log export | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | With export permission, export filtered audit logs, verify CSV download, truncated-export warning headers, and localized export failure handling. |
| Audit log purge | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | With purge permission, purge old audit logs and verify success count, refreshed list/summary, and localized purge failure handling. |
| Mobile audit log filters | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for filter wrapping, date range popup layering, export/purge buttons, table horizontal scroll, and no overlap with admin header. |

## 2026-06-10 18:47 UTC QA F3515 AdminDashboard Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Admin Dashboard production `any` usage is closed.
- `AdminDashboard.tsx` dashboard load failures now use `unknown`.
- Top-product table rows are typed from `DashboardStats['topProducts']`, while product-image fallback and `dashboardProductName(row)` behavior are unchanged.

Local verification already run:
- `AdminDashboardTypeSafety.test.ts` source guard rejects the old Admin Dashboard `any` catch and `row: any` table patterns.
- `CI=true npm test -- --runTestsByPath src/pages/AdminDashboardTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `AdminDashboard.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/AdminDashboard.tsx frontend/src/pages/AdminDashboardTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin dashboard load success | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/dashboard` with representative orders/products/users/revenue data and verify summary cards, readiness score, action center, SLA cards, charts, payment-method breakdown, and tracking panel still render after the deferred widgets appear. |
| Admin dashboard load failure | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Simulate dashboard API failure and verify the localized error panel, reload button, and non-crashing state remain usable. |
| Top products table | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Verify top product rows with image URL, missing image URL, and missing product name still show the correct image/avatar fallback, product fallback label, quantity, and revenue formatting. |
| Mobile admin dashboard | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for readiness cards, action buttons, deferred chart/tracking placeholders, top-product table horizontal scroll, and no text overlap. |

## 2026-06-10 18:34 UTC QA F3515 Navbar Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Navbar production `any` usage is closed.
- `Navbar.tsx` authenticated cart badge rows are now typed as `CartItem`.
- Badge quantity normalization via `normalizeBadgeCount(item.quantity)` is unchanged.

Local verification already run:
- `NavbarTypeSafety.test.ts` source guard rejects the old Navbar cart badge `item: any` pattern.
- `CI=true npm test -- --runTestsByPath src/components/NavbarTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `Navbar.tsx` returned no matches.
- `git diff --check -- frontend/src/components/Navbar.tsx frontend/src/components/NavbarTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated cart badge | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log in with cart rows containing normal, string-like, zero, and invalid quantities; verify the Navbar cart badge shows the normalized total and updates after cart events. |
| Guest cart badge | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log out and verify guest cart badge counting still matches local guest-cart quantities. |
| Badge load failure handling | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Simulate cart badge API failure and verify the badge resets safely plus localized non-blocking warning behavior remains usable. |
| Mobile Navbar badge layout | PARTIAL_SOURCE_FIXED / MOBILE STOREFRONT E2E RECOMMENDED | Check phone/tablet widths for cart badge, notification badge, menu overflow, and dropdown layering. |

## 2026-06-10 18:18 UTC QA F3515 ProductReview Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Product Review production `any` usage is closed.
- `ProductReview.tsx` review-submit failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `ProductReviewTypeSafety.test.ts` source guard rejects the old Product Review `any` catch patterns.
- `CI=true npm test -- --runTestsByPath src/components/ProductReviewTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `ProductReview.tsx` returned no matches.
- `git diff --check -- frontend/src/components/ProductReview.tsx frontend/src/components/ProductReviewTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Review submit success/failure | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open a reviewable product while logged in, submit a review with rating/comment, then simulate submit failure and verify localized error handling and form reset only after success. |
| Review list rendering | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Verify existing review rows, admin replies, rating display, dates, empty state, and pagination remain usable. |
| Mobile product review layout | PARTIAL_SOURCE_FIXED / MOBILE STOREFRONT E2E RECOMMENDED | Check phone/tablet widths for order select popup, rating row, textarea count, and submit button spacing. |

## 2026-06-10 18:09 UTC QA F3515 Register Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Register production `any` usage is closed.
- `Register.tsx` register-code send and account-registration submit failures now use `unknown`.
- API error data narrows through typed helpers, AntD validation failures narrow through `isFormValidationError(...)`, email-code-required detection uses a typed helper, and the email-code input ref uses AntD `InputRef`.
- Customer-facing register-code and registration-submit messages are unchanged.

Local verification already run:
- `RegisterTypeSafety.test.ts` source guard rejects the old register `useRef<any>`, `catch (...: any)`, direct `error?.errorFields`, and direct `error.response?.data` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/RegisterTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` and direct validation/API-error access in `Register.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/Register.tsx frontend/src/pages/RegisterTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Register-code send success | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Open `/register`, enter a valid email, send a code, and verify masked-email confirmation, TTL/countdown, focus movement to the code field, and localized success text. |
| Register-code validation and rate limit | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Trigger empty/invalid email validation and a backend `RATE_LIMITED` response; verify form validation stays separate from API toast handling, countdown uses retry-after data, and localized rate-limit copy appears. |
| Register submit duplicate fields | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Submit duplicate username/email/phone responses and verify the correct field receives localized inline errors plus toast handling. |
| Register submit email-code required/invalid | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Trigger email-code-required, invalid-code, and too-many-attempts responses and verify the code field, countdown, focus movement, and localized copy. |
| Register success | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Complete a valid registration, verify normalized username/email/phone/code payload, login prefill storage, success toast, and redirect to `/login`. |
| Mobile register layout | PARTIAL_SOURCE_FIXED / MOBILE AUTH E2E RECOMMENDED | Check 320-430px widths for validation scrolling, code addon button fit, strong-password errors, visible labels, and no overlap with page chrome. |

## 2026-06-10 17:59 UTC QA F3515 ForgotPassword Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Forgot Password production `any` usage is closed.
- `ForgotPassword.tsx` reset-code send and password-reset submit failures now use `unknown`.
- API error data narrows through typed helpers, AntD validation failures narrow through `isFormValidationError(...)`, and the email-code input ref uses AntD `InputRef`.
- Customer-facing reset-code and reset-submit messages are unchanged.

Local verification already run:
- `ForgotPasswordTypeSafety.test.ts` source guard rejects the old reset-password `useRef<any>`, `catch (...: any)`, direct `error?.errorFields`, and direct `error.response?.data?.code` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/ForgotPasswordTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` and direct validation/API-error access in `ForgotPassword.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/ForgotPassword.tsx frontend/src/pages/ForgotPasswordTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Reset-code send success | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Open `/forgot-password`, enter a valid email, send a reset code, and verify masked-email confirmation, TTL/countdown, focus movement to the code field, and localized success text. |
| Reset-code validation and rate limit | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Trigger empty/invalid email validation and a backend `RATE_LIMITED` response; verify form validation is silent to API toast handling, countdown uses retry-after data, and localized rate-limit copy appears. |
| Reset-submit invalid code | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Submit an invalid or too-many-attempts code and verify the code field receives the localized inline error and matching toast. |
| Reset-submit success | PARTIAL_SOURCE_FIXED / AUTH E2E RECOMMENDED | Complete a valid reset, verify normalized login/email/code are submitted, success toast appears, and the user is redirected to `/login`. |
| Mobile reset password layout | PARTIAL_SOURCE_FIXED / MOBILE AUTH E2E RECOMMENDED | Check 320-430px widths for reset guide wrapping, code addon button fit, countdown text, strong-password errors, and no overlap with page chrome. |

## 2026-06-10 17:51 UTC QA F3515 AnnouncementManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Announcement Management production `any` usage is closed.
- `AnnouncementManagement.tsx` announcement list, save, status-toggle, and delete failures now use `unknown`.
- AntD validation failures now narrow through `isFormValidationError(...)`, and the editor form is typed with `AnnouncementFormValues`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `AnnouncementManagementTypeSafety.test.ts` source guard rejects the old announcement management `any` and direct `error?.errorFields` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/AnnouncementManagementTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` and direct validation-error access in `AnnouncementManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/AnnouncementManagement.tsx frontend/src/pages/AnnouncementManagementTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Announcement list/search/filter | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/announcements`, search and filter by status, page through rows, and verify stats, loading state, empty state, and localized load-failure handling. |
| Announcement create/edit validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open the editor, trigger required-field/date/link validation, then create or edit a valid announcement and verify localized success/error handling and refreshed list/summary state. |
| Announcement status toggle | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Toggle an announcement active/inactive and verify permission gating, localized failure handling, row state, and summary counts. |
| Announcement delete | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete a permitted announcement and verify popconfirm behavior, permission gating, localized success/error handling, and refreshed list/summary state. |
| Mobile announcement editor | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for modal scrolling, date picker layering, toolbar wrapping, and table horizontal scroll. |

## 2026-06-10 17:42 UTC QA F3515 PetGalleryManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Pet Gallery Management production `any` usage is closed.
- `PetGalleryManagement.tsx` gallery list and delete failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `PetGalleryManagementTypeSafety.test.ts` source guard rejects the old Pet Gallery Management `any` catch patterns.
- `CI=true npm test -- --runTestsByPath src/pages/PetGalleryManagementTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `PetGalleryManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/PetGalleryManagement.tsx frontend/src/pages/PetGalleryManagementTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet gallery list/search/filter | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/pet-gallery`, search/filter by status/source, page through photos, and verify stats, table rows, empty state, loading, and localized load-failure handling. |
| Pet gallery delete | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete a permitted photo and verify popconfirm placement, permission gating, localized success/error handling, and refreshed list state. |
| Media rendering fallback | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Verify broken/missing gallery image URLs use the media fallback and do not break row layout. |
| Mobile pet gallery admin layout | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for filters, stats, table horizontal scroll, image thumbnails, and delete popconfirm layering. |

## 2026-06-10 17:33 UTC QA F3515 LogisticsCarrierManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Logistics Carrier Management production `any` usage is closed.
- `LogisticsCarrierManagement.tsx` carrier list, save, and delete failures now use `unknown`.
- AntD validation failures now narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `LogisticsCarrierManagementTypeSafety.test.ts` source guard rejects the old carrier management `any` and direct `err?.errorFields` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/LogisticsCarrierManagementTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` and direct `err?.errorFields` in `LogisticsCarrierManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/LogisticsCarrierManagement.tsx frontend/src/pages/LogisticsCarrierManagementTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Carrier list/search/filter | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/logistics-carriers`, search/filter carriers, and verify readiness metrics, table rows, loading state, and localized load-failure handling. |
| Carrier create/edit validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open the carrier modal, trigger required-field validation, then create/edit a carrier and verify validation failures do not show API-error toasts while real API failures still do. |
| Carrier delete | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete a permitted carrier and verify confirmation copy, permission gating, localized success/error handling, and refreshed list state. |
| Mobile carrier admin layout | PARTIAL_SOURCE_FIXED / MOBILE ADMIN E2E RECOMMENDED | Check phone/tablet widths for search/status controls, readiness grid, table horizontal scroll, modal footer, and popup layering. |

## 2026-06-10 17:25 UTC QA F3515 StockAlerts Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Stock Alerts production `any` usage is closed.
- `StockAlerts.tsx` stock-alert product loading and add-to-cart failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `StockAlertsTypeSafety.test.ts` source guard rejects the old Stock Alerts `any` catch patterns.
- `CI=true npm test -- --runTestsByPath src/pages/StockAlertsTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any` in `StockAlerts.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/StockAlerts.tsx frontend/src/pages/StockAlertsTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Stock alert list load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open the stock-alerts page with saved alerts and verify product cards, back-in-stock state, loading state, localized error handling, and empty state render normally. |
| Add ready item to cart | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Add a ready in-stock alert item to cart as logged-in and guest users; verify success/error toasts, cart update events, and cart drawer behavior. |
| Bulk add ready items | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Use the add-ready-items action with multiple eligible products and verify partial failures do not break the page and success count is localized. |
| Mobile stock alerts layout | PARTIAL_SOURCE_FIXED / MOBILE E2E RECOMMENDED | Check phone/WebView widths for action buttons, stock tags, image sizing, and next-action panel overlap. |

## 2026-06-10 17:14 UTC QA F3515 UserManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but admin User Management production `any` usage is closed.
- `UserManagement.tsx` user list, role update, export, status toggle, profile save, and delete failures now use `unknown`.
- AntD validation failures now narrow through `isFormValidationError(...)`; the action-column render placeholder uses `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `UserManagement.test.ts` source guard rejects the old User Management `any` and direct `error?.errorFields` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/UserManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for production `any`, direct `error?.errorFields`, and old action render placeholders in `UserManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/UserManagement.tsx frontend/src/pages/UserManagement.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin users list | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open `/admin/users`, search/filter/page through users, and verify summary cards, table rows, pagination labels, and loading/error states still render normally. |
| Role/status mutations | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Change a user's role, ban/unban an eligible user, and verify confirmations, localized success/error toasts, permissions, and refreshed row state. |
| Profile edit | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open the profile edit modal, trigger validation, save address changes, and verify validation failures do not show API-error toasts while real API failures still do. |
| Export/delete actions | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Export the filtered user CSV and delete a permitted non-self user; verify permission gating, confirmation copy, and localized failure handling. |

## 2026-06-10 17:07 UTC QA F3515 Limited-Time Countdown Test Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but the limited-time countdown test-helper `as any` usage is closed.
- `limitedTimeCountdown.test.ts` fixtures now derive their type from the production helper parameter contract.
- `supportWorkflow.ts` broad `any` hits were triaged as English customer/admin copy, not TypeScript type escapes.
- Runtime production code was not changed in this handoff.

Local verification already run:
- `CI=true npm test -- --runTestsByPath src/utils/limitedTimeCountdown.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any`, `: any`, and `as any` in `limitedTimeCountdown.test.ts` and `limitedTimeCountdown.ts` returned no matches.
- `git diff --check -- frontend/src/utils/limitedTimeCountdown.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Limited-time discount countdown | TEST_ONLY_TYPE_FIX / NO DEDICATED E2E REQUIRED | No runtime code changed. Keep the normal product-card/product-detail sale countdown smoke in the broader storefront regression suite. |

## 2026-06-10 16:59 UTC QA F3515 SeventeenTrackWidget Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but SeventeenTrackWidget production `any` usage is closed.
- `SeventeenTrackWidget.tsx` logistics tracking failures now use `unknown`.
- Provider-configuration detection now uses `getApiErrorDiagnosticText(...)` instead of direct `err?.response?.data` parsing.
- Localized customer-facing `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `SeventeenTrackWidget.test.ts` source guard rejects the old widget `any` and direct error parsing patterns.
- `CI=true npm test -- --runTestsByPath src/components/SeventeenTrackWidget.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` and direct `err?.response?.data` parsing in `SeventeenTrackWidget.tsx` returned no matches.
- `git diff --check -- frontend/src/components/SeventeenTrackWidget.tsx frontend/src/components/SeventeenTrackWidget.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Tracking lookup success | PARTIAL_SOURCE_FIXED / ORDER E2E RECOMMENDED | Open an order tracking surface with a carrier/tracking number and verify the logistics widget renders status tags, summary, event timeline, and accessible labels normally. |
| Provider configuration fallback | PARTIAL_SOURCE_FIXED / ORDER E2E RECOMMENDED | Simulate a logistics provider configuration error and verify the widget shows the no-tracking-data fallback instead of exposing raw provider/server text. |
| Tracking lookup failure | PARTIAL_SOURCE_FIXED / ORDER E2E RECOMMENDED | Simulate a non-configuration tracking failure and verify the localized warning alert/toast appears, result state clears, and loading state resets. |
| Manual retry/mobile layout | PARTIAL_SOURCE_FIXED / ORDER E2E RECOMMENDED | On desktop and phone/WebView widths, enter a tracking number manually, press Enter and the search button, and verify the input/button/results layout remains readable without overlap. |

## 2026-06-10 16:42 UTC QA F3515 Payment Component Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Payment component production `any` usage is closed.
- `Payment.tsx` payment creation failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `PaymentTypeSafety.test.ts` source guard rejects the old Payment component `any` patterns.
- `CI=true npm test -- --runTestsByPath src/components/PaymentTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `Payment.tsx` returned no matches.
- `git diff --check -- frontend/src/components/Payment.tsx frontend/src/components/PaymentTypeSafety.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment channel load | PARTIAL_SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Open the payment modal for an order and verify available channels, default recommended channel, market badges, and unavailable-channel copy render normally. |
| Payment create success | PARTIAL_SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Confirm payment for hosted-URL and no-URL success paths. Verify loading state, safe URL navigation behavior, localized success copy, and `onSuccess` behavior. |
| Payment create failure | PARTIAL_SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Simulate `paymentApi.create` failure and verify the localized API error toast appears and loading state resets. |
| Guest payment context | PARTIAL_SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Run a guest order payment attempt and verify guest email/orderNo context is preserved in the payment create request and modal labels. |

## 2026-06-10 16:23 UTC QA F3515 AddOnAssistant Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Add-on Assistant production `any` usage is closed.
- `AddOnAssistant.tsx` add-on quick-add failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `AddOnAssistant.test.ts` source guard rejects the old Add-on Assistant `any` patterns.
- `CI=true npm test -- --runTestsByPath src/components/AddOnAssistant.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `AddOnAssistant.tsx` returned no matches.
- `git diff --check -- frontend/src/components/AddOnAssistant.tsx frontend/src/components/AddOnAssistant.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Add-on suggestions load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open a cart/checkout surface that renders Add-on Assistant with a remaining shipping/gift gap and verify suggestions, badges, pricing, and target amount render normally. |
| Add-on quick add | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Quick-add an add-on suggestion and verify loading state, localized success/error messages, cart update behavior, and removal from the suggestion list. |
| Empty/disabled states | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Verify the assistant stays hidden when disabled, when remaining amount is zero, or when no valid suggestions are returned. |
| Mobile readability | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Check the Add-on Assistant on phone/WebView widths and verify labels, badges, images, and quick-add buttons do not overlap. |

## 2026-06-10 16:14 UTC QA F3515 PetPersonalizedAssistant Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Pet Personalized Assistant production `any` usage is closed.
- `PetPersonalizedAssistant.tsx` personalized quick-add failures now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `PetPersonalizedAssistant.test.ts` source guard rejects the old Pet Personalized Assistant `any` patterns.
- `CI=true npm test -- --runTestsByPath src/components/PetPersonalizedAssistant.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `PetPersonalizedAssistant.tsx` returned no matches.
- `git diff --check -- frontend/src/components/PetPersonalizedAssistant.tsx frontend/src/components/PetPersonalizedAssistant.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Personalized recommendations load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Log in with pet profiles, open a surface that renders the assistant, and verify recommended products, pet context, deal/ready tags, and compact/default variants render normally. |
| Personalized quick add | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Quick-add a recommendation without required options and verify loading state, localized success/error messages, cart update behavior, and removal from the assistant list. |
| Option-required recommendation | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Select a recommendation with options and verify it navigates to product detail instead of calling quick add. |
| Guest/no-pet states | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Verify guests see no assistant, and logged-in users without pet profiles see the add-pet/browse actions with responsive layout intact. |

## 2026-06-10 16:04 UTC QA F3515 ConfigCenter Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Config Center production `any` usage is closed.
- `ConfigCenter.tsx` config snapshot load, publish, and runtime-apply catches now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `ConfigCenterTypeSafety.test.ts` source guard rejects the old Config Center `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/ConfigCenterTypeSafety.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `ConfigCenter.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/ConfigCenter.tsx frontend/src/pages/ConfigCenterTypeSafety.test.ts QA_ISSUES.md TEST_ISSUES.md E2E_TEST_ENGINEER_ISSUES.md` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Config snapshot load | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Config Center, load the default config target, change dataId/group/namespace, refresh, and verify snapshot cards, masked sensitive keys, and effective properties render normally. |
| Publish config | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Publish valid and invalid config content with allowed and denied roles. Verify validation copy, confirmation copy, loading state, localized success/error messages, and refreshed content. |
| Runtime apply | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Apply runtime config only with allowed and denied roles. Verify confirmation copy, permission denial, localized API errors, and runtime-applied status. |
| Mobile config editor | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Config Center on phone/tablet widths and verify the content editor, Popconfirm overlays, and table sections stay inside the visible viewport. |

## 2026-06-10 15:55 UTC QA F3515 CategoryManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Category Management production `any` usage is closed.
- `CategoryManagement.tsx` category list load, category delete, and category save catches now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.
- `CategoryManagement.test.ts` also refreshed the stale mobile popup z-index guard from `2100` to `var(--shop-z-floating-panel)`.

Local verification already run:
- `CategoryManagement.test.ts` source guard rejects the old Category Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/CategoryManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `CategoryManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/CategoryManagement.tsx frontend/src/pages/CategoryManagement.test.ts frontend/src/pages/LogManagement.tsx frontend/src/pages/LogManagement.test.ts frontend/src/pages/BrandManagement.tsx frontend/src/pages/BrandManagement.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Category tree and search | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Category Management, load the tree/table, search localized names/descriptions, and verify readiness metrics plus path labels render normally. |
| Create/edit category | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Create and edit root/child categories with required validation, localized content, image preview, and parent TreeSelect. Verify validation copy, popup layering, save state, localized success/error messages, and refreshed data. |
| Category delete | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete categories with allowed and denied roles, including parent-with-child failure. Verify confirmation copy, permission denial, localized API errors, and refreshed data. |
| Mobile editor popup | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open the parent TreeSelect inside the category modal on phone/tablet widths and verify it stays above the modal and inside the visible viewport. |

## 2026-06-10 15:45 UTC QA F3515 LogManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Log Management production `any` usage is closed.
- `LogManagement.tsx` log status load, debug-level toggle, and log download catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `LogManagement.test.ts` source guard rejects the old Log Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/LogManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `LogManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/LogManagement.tsx frontend/src/pages/LogManagement.test.ts frontend/src/pages/BrandManagement.tsx frontend/src/pages/BrandManagement.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Logger status load | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Log Management, load the default logger and a custom logger, and verify current level, debug state, and available file counts render normally. |
| Debug toggle | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Toggle debug logging with allowed and denied roles. Verify confirmation copy, loading state, localized success/error messages, and refreshed status. |
| Log download | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Download logs for a selected time range, keyword, and level. Verify range validation, filename, loading state, permission denial, and localized API failure handling. |
| Mobile RangePicker | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open the log export RangePicker on phone/tablet/short landscape and verify the popup remains inside the visible viewport. |

## 2026-06-10 15:24 UTC QA F3515 BrandManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Brand Management production `any` usage is closed.
- `BrandManagement.tsx` brand list load, brand save, and brand delete catches now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `BrandManagement.test.ts` source guard rejects the old Brand Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/BrandManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `BrandManagement.tsx` returned no matches.
- `git diff --check -- frontend/src/pages/BrandManagement.tsx frontend/src/pages/BrandManagement.test.ts` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Brand list and filters | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Brand Management, load the brand list, search by name/description/URL, filter active/inactive status, and verify health metrics and table rows render normally. |
| Create/edit brand | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Create and edit a brand with required-field validation, logo preview, website URL, status, sort order, and long description. Verify validation copy, save loading state, localized success/error messages, and refreshed data. |
| Brand delete | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete a brand with allowed and denied roles. Verify confirmation copy, permission denial, localized success/error messages, and refreshed list data. |
| Brand API failure | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Simulate list/save/delete API failures and verify localized error handling without stale modal/loading state. |

## 2026-06-10 15:12 UTC QA F3515 BrowsingHistory Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Browsing History production `any` usage is closed.
- `BrowsingHistory.tsx` add-to-cart catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `BrowsingHistory.test.ts` source guard rejects the old Browsing History `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/BrowsingHistory.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `BrowsingHistory.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Browsing history load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Seed local product-view history, open Browsing History, and verify loaded products, retry load-error state, filters, and mobile recommendation action. |
| Add history item to cart | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Add a direct-add history product as guest and logged-in user. Verify localized success/error messages, guest cart behavior, cart-open event, and option-selection redirect. |
| Add-to-cart failure | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Simulate `cartApi.addItem` failure and verify localized API error handling without clearing history state. |
| History management | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Remove one item, clear all history, and verify storage sync, empty quick actions, and responsive layout. |

## 2026-06-10 15:08 UTC QA F3515 Wishlist Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Wishlist production `any` usage is closed.
- `Wishlist.tsx` single-item add-to-cart catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `Wishlist.test.tsx` source guard rejects the old Wishlist production `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed with existing React/Router/non-blocking-error warning noise only.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `Wishlist.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist load/auth | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open Wishlist as guest and logged-in user. Verify deduplicated login redirect warning, loaded item cards, empty state, and mobile action bar behavior. |
| Single add to cart | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Add a direct-add wishlist item to cart and verify localized success/error messages, cart drawer event, and stable button state. |
| Add-to-cart failure | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Simulate `cartApi.addItem` failure and verify the localized API error toast appears without mutating the wishlist. |
| Bulk add/remove flows | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Run Add all to cart, remove, and clear unavailable actions. Verify dedupe/pending guards, event dispatches, and responsive layout. |

## 2026-06-10 15:04 UTC QA F3515 CouponCenter Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Coupon Center production `any` usage is closed.
- `CouponCenter.tsx` single-coupon claim catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `CouponCenter.test.ts` source guard rejects the old Coupon Center `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/CouponCenter.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `CouponCenter.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon center load | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Open Coupon Center as guest and logged-in user. Verify public coupons, wallet coupons, cart subtotal, fallback load state, and mobile rails render correctly. |
| Single coupon claim | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Claim a live coupon as a logged-in user. Verify loading state, localized success/error messages, `shop:coupons-updated` event behavior, and refreshed coupon ownership. |
| Claim failure | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Simulate `couponApi.claim` failure and verify the localized API error toast appears without leaving the card in a loading state. |
| Guest claim redirect | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Attempt single and batch claims as guest and verify login warning plus return URL behavior. |

## 2026-06-10 15:01 UTC QA F3515 SystemMonitor Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but System Monitor production `any` usage is closed.
- `SystemMonitor.tsx` system status load catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `SystemMonitor.test.ts` source guard rejects the old System Monitor `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/SystemMonitor.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `SystemMonitor.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| System status dashboard | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open System Monitor, refresh status, and verify overall health, application name, uptime, CPU, JVM memory, and disk cards render correctly. |
| Dependency diagnostics | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Verify database, Redis, Nacos, and production-config descriptions render long diagnostics without mobile overflow. |
| Status load failure | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Simulate `getSystemStatus` failure and verify localized error messaging, loading state reset, and stable retry behavior. |
| Resource risk states | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Mock memory/disk/dependency warning states and verify alert tone, progress states, and status tags stay readable across desktop and mobile. |

## 2026-06-10 14:58 UTC QA F3515 NotificationManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Notification Management production `any` usage is closed.
- `NotificationManagement.tsx` broadcast send catches now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `NotificationManagement.test.ts` source guard rejects the old Notification Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/NotificationManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `NotificationManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Broadcast compose validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Notification Management, submit with required fields missing, and verify validation copy appears without a global API error toast. |
| Promotion template and preview | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Insert the promotion template, switch HTML/plain-text formats, and verify sanitized preview, readiness tags, and content counters stay stable. |
| Broadcast send success/failure | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Send a valid broadcast with allowed roles and simulate API failure. Verify loading state, localized success/error messages, notification-updated event behavior, and form reset only on success. |
| Permission denial | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Visit as a role without notification broadcast permission and verify the send action is hidden or denied consistently. |

## 2026-06-10 14:54 UTC QA F3515 RegistryManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Registry Management production `any` usage is closed.
- `RegistryManagement.tsx` registry status load catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `RegistryManagement.test.ts` source guard rejects the old Registry Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/RegistryManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `RegistryManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Registry status dashboard | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Registry Management, refresh status, and verify service name, registration status, discovered service count, and current instance count render normally. |
| Registry configuration/details | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Verify registry config, current instance config, gateway tags, discovered service table, metadata tags, and copyable URI fields after a successful status load. |
| Service search | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Search by service id, host, port, and URI. Verify filtered rows, empty state, clear behavior, and responsive table scrolling. |
| Registry API failure | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Simulate a failed registry-status request and verify localized error messaging and stable refresh/loading behavior. |

## 2026-06-10 14:45 UTC QA F3515 PermissionManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Permission Management production `any` usage is closed.
- `PermissionManagement.tsx` role list load and role save catches now use `unknown`.
- AntD validation failures narrow through `isFormValidationError(...)`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `PermissionManagement.test.ts` source guard rejects the old Permission Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/PermissionManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `PermissionManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Role list/search/export | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Permission Management, load/search the role list, export roles, and verify loading state, table data, and localized error handling. |
| Create/edit custom role | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Create and edit a custom role with required-field validation and a long permission checklist. Verify validation copy, permission tree behavior, save loading state, success/error messages, and refreshed list data. |
| Reserved role read-only behavior | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open reserved roles and verify edit/delete restrictions remain visible and enforced. |
| Non-super-admin access | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Visit Permission Management as a non-super-admin and verify redirect or denial behavior. |
| Permission persistence | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Save a role permission change, reload the page/session, and verify selected permissions persist. |

## 2026-06-10 14:26 UTC QA F3515 TrafficControl Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Traffic Control production `any` usage is closed.
- `TrafficControl.tsx` traffic-control status load, circuit reset, and rate-limit clear catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `TrafficControl.test.ts` source guard rejects the old Traffic Control `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/TrafficControl.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `TrafficControl.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Traffic status dashboard | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Traffic Control, refresh the status dashboard, and verify rate-limit counters, circuit table, and last failure/open-until fields render normally. |
| Circuit reset | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Reset one circuit and reset all circuits with allowed and denied roles. Verify confirmations, loading state, localized success/error messages, and refreshed status data. |
| Rate-limit clear | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Clear rate-limit counters with allowed and denied roles. Verify confirmation copy, loading state, localized success/error messages, and refreshed status data. |

## 2026-06-10 14:18 UTC QA F3515 ProductQuestionManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Product Question Management production `any` usage is closed.
- `ProductQuestionManagement.tsx` admin product-question summary/list load, answer submit, and delete catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `ProductQuestionManagement.test.ts` source guard rejects the old Product Question Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/ProductQuestionManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `ProductQuestionManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Question list and scoped summary | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Product Question Management, switch unanswered/answered/all filters, search by keyword, and verify summary metrics plus table/mobile cards stay aligned with the active scope. |
| Answer modal | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open a pending question, submit a valid answer, trigger empty-answer validation, and verify localized success/error messages plus refreshed row state. |
| Delete question | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Delete a question with allowed and denied roles. Verify confirmation copy, loading state, list refresh, and localized API failure messages. |
| Mobile question cards | PARTIAL_SOURCE_FIXED / ADMIN E2E OPTIONAL | Recheck narrow admin/App/WebView screens to confirm question cards, answer/delete actions, search, status filter, and answer modal remain usable after the source-only typing change. |

## 2026-06-10 14:05 UTC QA F3515 AlertManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Alert Management production `any` usage is closed.
- `AlertManagement.tsx` alert list/summary load, self-check, acknowledge, resolve, batch acknowledge, batch resolve, and purge catches now use `unknown`.
- Localized `getApiErrorMessage(...)` handling is unchanged.

Local verification already run:
- `AlertManagement.test.ts` source guard rejects the old Alert Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/AlertManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `AlertManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Alert list and summary filters | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Alert Management, filter by status/severity/category, refresh, and verify alert rows, summary cards, and selected rows stay in sync. |
| Self-check action | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Run alert self-check with allowed and denied roles. Verify loading state, localized success/error messages, and summary/list refresh behavior. |
| Single acknowledge/resolve | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Acknowledge an open alert and resolve an unresolved alert. Verify row state updates, actions disable for ineligible statuses, and API failures show localized messages. |
| Batch acknowledge/resolve | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Select multiple open/unresolved alerts and run batch acknowledge/resolve. Verify selection clears, updated counts match, and ineligible selections show warning messages. |
| Purge resolved alerts | PARTIAL_SOURCE_FIXED / ADMIN E2E OPTIONAL | Change retention days and purge resolved alerts with allowed/denied roles. Verify confirmation copy, deleted count, and refreshed summary/list state. |

## 2026-06-10 13:54 UTC QA F3515 ProductManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Product Management production `any` usage is closed.
- `ProductManagement.tsx` product option/variant/detail parsing now uses typed `unknown` boundaries and normalizers.
- Product import error payloads narrow through typed helpers; form validation errors narrow through `isFormValidationError(...)`.
- Admin product load/category/brand/delete/status/batch/import catches and table render placeholders now use `unknown`.

Local verification already run:
- `ProductManagement.test.ts` source guard rejects the old Product Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/ProductManagement.test.ts src/pages/ProductManagement.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `ProductManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product list, filters, and listing-quality cards | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Product Management, search/filter by category/status/listing-quality, change pages, and verify rows plus counts remain aligned with the active filters. |
| Product editor create/update | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Create and edit products with images, localized content, rich detail blocks, shipping/free-shipping fields, limited-time pricing, and bundle fields. Trigger validation failures and verify errors stay in the modal. |
| Variants and stock sync | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Generate variants from option groups, edit variant price/stock/image fields, sync stock from variants, save, reopen, and verify options/stock/price values persist without malformed option text. |
| URL import preview/apply | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Run URL import preview, apply a valid preview into the editor, and verify imported images/specs/detail blocks populate correctly. Trigger invalid URL/API failure and confirm localized messages. |
| CSV import preview/apply/reject | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Upload valid and invalid CSV files, verify preview blocked/ready modals, duplicate warning, error report download, apply success, and import history refresh behavior. |
| Product actions and export | PARTIAL_SOURCE_FIXED / ADMIN E2E OPTIONAL | Toggle featured, duplicate, approve/reject/review, delete, download templates, and export filtered products. Verify permission-denied roles cannot mutate products. |

## 2026-06-10 09:54 UTC QA F3515 OrderManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Order Management production `any` usage is closed.
- `OrderManagement.tsx` admin order load/status/ship/detail/refund/payment sync/batch ship/export catches now use `unknown`.
- Order, payment, and order-item table render placeholders now use `unknown` instead of `any`.

Local verification already run:
- `OrderManagement.test.ts` source guard rejects the old Order Management `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/OrderManagement.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `OrderManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order list, filters, and summary cards | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Order Management, search/filter by status and keyword, change pages, and verify quick cards plus table rows still match the selected scope. |
| Status transitions and permissions | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Exercise allowed and denied status transitions for representative paid, shipped, completed, canceled, and refund-related orders. Verify localized success/error messages and audit-safe denial behavior. |
| Single and batch shipment | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Ship one order and batch ship multiple orders with the carrier dropdown, tracking numbers, and label/print actions. Verify modal validation, dropdown layering, and refreshed row state. |
| Detail modal and payment sync | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open order detail, confirm item/payment evidence tables load, run payment sync where available, and verify loading/failure states stay inside the modal without stale data. |
| Refund modal and payment evidence | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open refund flow, inspect payment/refund evidence, submit valid and invalid refund requests, and verify localized messages plus refreshed order/payment status. |
| CSV export and truncation warning | PARTIAL_SOURCE_FIXED / ADMIN E2E OPTIONAL | Export filtered orders, verify CSV columns/encoding, and confirm the truncation warning appears when the export cap is reached. |

## 2026-06-10 09:44 UTC QA F3515 Profile Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Profile production `any` usage is closed.
- `Profile.tsx` form validation errors now narrow through `isFormValidationError(...)`.
- Profile API error codes and retry metadata now narrow through `getProfileApiErrorData(...)` / `getProfileApiErrorCode(...)`.
- Account/order/payment/address/pet error catches use `unknown` and still route through the existing localized API error helper.

Local verification already run:
- `Profile.test.ts` source guard rejects the old Profile `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `Profile.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile edit and email code | PARTIAL_SOURCE_FIXED / PROFILE E2E RECOMMENDED | Edit phone/email, trigger email-code validation, resend throttling, invalid-code, and too-many-attempts states. Verify field errors stay on the form and localized API messages still render. |
| Orders and payment recovery | PARTIAL_SOURCE_FIXED / ORDER/PAYMENT E2E RECOMMENDED | Open orders, continue payment, refresh payment URL, return from payment success URL, and confirm payment polling still updates state without duplicate in-flight requests. |
| Order after-sale actions | PARTIAL_SOURCE_FIXED / ORDER E2E RECOMMENDED | Cancel, confirm receipt, request return, and submit return shipment for eligible seeded orders. Verify localized success/error messages and order refresh behavior remain intact. |
| Address and pet profile forms | PARTIAL_SOURCE_FIXED / PROFILE E2E RECOMMENDED | Add/edit/delete/default address and add/edit/delete pet profile. Trigger validation failures and API failures to verify modal field errors and localized fallback toasts still work. |

## 2026-06-10 09:33 UTC QA F3515 CouponManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Coupon Management production `any` usage is closed.
- `CouponManagement.tsx` form validation errors now narrow through `isFormValidationError(...)`.
- Coupon load/save/delete/grant/run-birthday catches use `unknown`, and coupon table render placeholders use `unknown`.
- The existing mobile popup CSS guard was refreshed to the current `var(--shop-z-floating-panel)` z-index token.

Local verification already run:
- `CouponManagement.test.tsx` source guard rejects the old coupon catch/form/table `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/CouponManagement.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed with existing React/console warning noise only.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `CouponManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon list and filters | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Coupon Management, search by keyword, filter status/scope, change pages, and verify list rows plus insight counts still align with the active filter scope. |
| Coupon editor validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open create/edit coupon, trigger required-field and date-range validation, then save a valid full-reduction and discount coupon. Verify validation stays in the modal and failures show localized API messages. |
| Grant flow | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Grant a coupon to multiple users, including user search. Verify confirmation, success count, modal cleanup, and API failure messages remain intact. |
| Pet birthday coupon config | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Load birthday config, run birthday grants, edit config for full-reduction and discount types, and verify save/run success or permission-denial behavior remains correct. |

## 2026-06-10 09:17 UTC QA F3515 SupportManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but admin Support Management production `any` usage is closed.
- `SupportManagement.tsx` legacy `webkitAudioContext` access now uses `LegacyAudioWindow` instead of `window as any`.
- Support queue/message/send/close/reissue/order-detail/assign/reopen error catches now use `unknown` and still route through the existing localized API error helper.

Local verification already run:
- `SupportManagement.test.tsx` source guard rejects the old support `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/SupportManagement.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed with existing React/AntD act warning noise only.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `SupportManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin support queue load | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Open Support Management with open, closed, and needs-reply filters plus keyword search. Verify queue rows, summary counts, pagination, and load-failure messages still behave normally. |
| Conversation handling | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Select a session, load messages, send a reply, mark read, and verify WebSocket/HTTP fallback behavior still updates the conversation and queue. |
| Support actions | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Assign to self, close, reopen, and reissue birthday coupons with allowed and denied roles. Verify localized success/error messages and permission denials remain intact. |
| Order detail and notification tone | PARTIAL_SOURCE_FIXED / ADMIN E2E OPTIONAL | Open order context from a support message and verify order detail loads; on a browser that exposes legacy `webkitAudioContext`, verify the new-message tone path does not throw. |

## 2026-06-10 09:06 UTC QA F3515 Cart Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Cart production `any` usage is closed.
- `Cart.tsx` auth-expired detection now accepts `unknown` and narrows the API response status.
- Cart load/delete/save-for-later/move/restore/remove/recent-add error catches now use `unknown` and still route through the existing localized API error helper.

Local verification already run:
- `CartCheckoutFlow.test.tsx` source guard rejects the old Cart auth/catch `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed with existing React/Router/fake-timer warning noise only.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `Cart.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart load recovery | PARTIAL_SOURCE_FIXED / CART E2E RECOMMENDED | Load cart as a logged-in user and as a guest. Force a 401/403 authenticated cart load and verify the guest cart fallback still appears without a crash or stale checkout selection. |
| Cart item mutations | PARTIAL_SOURCE_FIXED / CART E2E RECOMMENDED | Delete an item, save an item for later, move it back, and bulk-remove selected items. Verify success/error toasts remain localized and cart quantity/session events still update the shell. |
| Quantity-to-checkout flow | PARTIAL_SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Edit authenticated quantities rapidly, navigate to checkout, and verify the final visible quantity is flushed before checkout and failure still blocks navigation with the expected localized message. |
| Recent product add-on | PARTIAL_SOURCE_FIXED / CART E2E OPTIONAL | Add a recent product from cart recovery suggestions. Verify option-required items route to Product Detail and simple items add to cart with the existing success/error behavior. |

## 2026-06-10 08:55 UTC QA F3515 IpBlacklistManagement Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but IP blacklist admin page production `any` usage is closed.
- `IpBlacklistManagement.tsx` load error slots and block/release/batch-release catch bindings now use `unknown`.
- AntD validation failures are narrowed through `isFormValidationError(...)`; the page no longer reads `error?.errorFields` from an `any` catch.

Local verification already run:
- `IpBlacklistManagement.test.ts` source guard rejects the old list/status/catch `any` patterns and requires the typed validation guard.
- `CI=true npm test -- --runTestsByPath src/pages/IpBlacklistManagement.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `IpBlacklistManagement.tsx` returned no matches.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Manual block and validation | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | In admin IP blacklist, open manual block, trigger required-field validation, then submit a valid public test IP. Verify validation failures stay in the modal without a generic error toast, successful blocks refresh list/status counts, and localized success/failure messages still render. |
| Single release | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Release a blocked or monitoring entry from the table. Verify the row/status counts refresh and API failures still show the localized release-failed message. |
| Batch release | PARTIAL_SOURCE_FIXED / ADMIN E2E RECOMMENDED | Select multiple releasable rows and batch release them. Verify selection clears, requested/released counts match the UI, and non-releasable released rows are ignored as expected. |
| Permission denial | PARTIAL_SOURCE_FIXED / SECURITY E2E RECOMMENDED | Use an admin role lacking block/release permissions. Verify block/release controls deny actions without mutating entries, consistent with the broader F3496 IP blacklist handoff. |

## 2026-06-10 08:37 UTC QA F3515 ProductDetail Type-Safety Partial Fix Handoff

Source status:
- QA F3515 remains OPEN overall, but Product Detail production `any` usage is closed.
- `ProductDetail.tsx` recommendation state/handlers are typed and `productDetailHelpers.tsx` has no `any` token.
- Product Detail catch bindings now use `unknown` with the shared API error-message helper.

Local verification already run:
- `ProductDetail.test.tsx` source guard rejects the old recommendation/catch `any` patterns.
- `CI=true npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing warning noise only.
- `npx tsc --noEmit --pretty false` passed.
- Source search for `any` in `ProductDetail.tsx` and `productDetailHelpers.tsx` returned no matches.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product detail recommendations | PARTIAL_SOURCE_FIXED / PRODUCT DETAIL E2E OPTIONAL | Open a product with related recommendations, verify cards render image/name/price/review proof correctly, sold-out items disable add-to-cart, and option-required recommendations route to detail selection. |
| Recommendation add-to-cart | PARTIAL_SOURCE_FIXED / CART E2E OPTIONAL | Add a recommendation to cart as a guest and as a logged-in user. Verify the cart drawer opens, quantity increments once, and API/error failures still show localized failure messages. |
| Product detail core smoke | PARTIAL_SOURCE_FIXED / PRODUCT DETAIL E2E OPTIONAL | Re-run product detail gallery, buy-now, favorite, stock alert, compare, review/question lazy sections, and recommendation carousel keyboard focus smoke to ensure the type-only change did not alter behavior. |

## 2026-06-10 08:18 UTC QA F3497 Product Search Cache Closure Handoff

Source status:
- QA F3497 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_OPTIONAL.
- `ProductServiceImpl` has no `ThreadLocal` and no `@Cacheable`; the stale double-cache leak path is absent.
- The active product-search cache is a bounded, TTL-controlled `ConcurrentMap` with targeted invalidation.

Local verification already run:
- `ProductSearchServiceTest.searchCacheAvoidsStartupRedisHotKeyWarmupContract()` rejects future `ThreadLocal` / `@Cacheable` reintroduction.
- Existing product search cache tests cover targeted invalidation and max-entry eviction.
- `./mvnw -q -Dtest=ProductSearchServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront search/list smoke | CURRENT_SOURCE_COVERED / SEARCH E2E OPTIONAL | Search and filter product lists across keyword, category, discount, featured, and paging paths. Verify results remain consistent after repeated requests and no stale user-specific state leaks between sessions. |
| Product update invalidation | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | Update a product name/status/category in admin, then re-run storefront search/list queries and verify changed products appear/disappear according to public catalog rules without waiting for a full deploy. |
| Cache TTL/cap ops smoke | CURRENT_SOURCE_COVERED / OPS E2E OPTIONAL | In staging with short `product.search-cache-ttl-ms` and low `product.search-cache-max-entries`, issue multiple distinct searches and verify behavior remains stable under eviction/expiry. |

## 2026-06-10 08:13 UTC QA F3496 Admin IP Blacklist Current-Source Closure Handoff

Source status:
- QA F3496 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- Current `AdminIpBlacklistController` is a thin admin boundary over `IpBlacklistService`; the stale count/XOR/PII/range code paths are absent.
- Mutations require dedicated `IP_BLACKLIST_*` action permissions and audit metadata is masked.

Local verification already run:
- `IpBlacklistServiceTest.adminIpBlacklistControllerDoesNotContainLegacyBrokenReportLogic()` guards the thin controller contract and stale-token absence.
- Existing `IpBlacklistServiceTest` covers invalid/trusted IP rejection, CIDR trusted matching, batch-release id normalization/masked actor, oversized batch rejection, read-only search/status, and database-only blocking lookup.
- `./mvnw -q -Dtest=IpBlacklistServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Manual block and release | CURRENT_SOURCE_COVERED / ADMIN E2E RECOMMENDED | As an admin with the right action permissions, manually block a valid public test IP, verify it appears in the list/status counts, then release it and verify counts/list update without exposing unmasked reason/actor secrets in audit metadata. |
| Batch release | CURRENT_SOURCE_COVERED / ADMIN E2E RECOMMENDED | Select multiple blocked/monitoring entries, release them in batch, and verify requested/released/ignored counts and returned ids match the UI selection after duplicate/invalid ids are normalized. |
| Permission denial | CURRENT_SOURCE_COVERED / SECURITY E2E RECOMMENDED | Use an admin role lacking block/release/record-failure action permissions and verify mutation requests fail with 403, create failure audit records, and do not mutate blacklist entries. |
| Search/status smoke | CURRENT_SOURCE_COVERED / ADMIN E2E RECOMMENDED | Filter by status/source/IP and verify list rows plus status summary remain consistent with seeded blocked/monitoring/released entries and legacy login-failure snapshots. |

## 2026-06-10 08:05 UTC QA F3495 Vaccination Notification Type Closure Handoff

Source status:
- QA F3495 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_OPTIONAL.
- Current production source has no `PetHealthController`, no `updateVaccinationStatus`, and no vaccination notification path.
- A source guard now rejects future production Java handlers that pair `updateVaccinationStatus` with `VACCINATION_REMINDER`.

Local verification already run:
- `EmptyCatchBlockContractTest.currentSourceDoesNotUseReminderTemplateForVaccinationStatusUpdates()` covers the regression guard.
- `./mvnw -q -Dtest=EmptyCatchBlockContractTest test` passed.
- Production source search for `PetHealthController|updateVaccinationStatus|VACCINATION_REMINDER|vaccination` returned no matches.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet health route inventory | CURRENT_SOURCE_COVERED / PET E2E OPTIONAL | Confirm the current app has no exposed vaccination-status update route in browser/API navigation. If a future Pet Health module is added, validate status-update notifications use a status-update template, not a reminder template. |
| Existing pet profile/gallery smoke | CURRENT_SOURCE_COVERED / PET E2E OPTIONAL | Keep pet profile and pet gallery smoke coverage to verify current pet features remain unaffected by this source-only closure. |

## 2026-06-10 07:58 UTC QA F3494 Pet Controller Exception Handling Closure Handoff

Source status:
- QA F3494 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_OPTIONAL.
- Current source only has `PetGalleryController` among the named reported controllers, and it has no catch blocks.
- `PetProfileController` only maps explicit business exceptions to 400/409 responses; broad Pet controller catches are now guarded by `EmptyCatchBlockContractTest`.

Local verification already run:
- `EmptyCatchBlockContractTest.petControllersDoNotUseBroadExceptionCatchHandlers()` rejects broad `catch (Exception|RuntimeException|NullPointerException)` handlers in current/future Pet controller files.
- `./mvnw -q -Dtest=EmptyCatchBlockContractTest test` passed after restoring the existing frontend empty-catch guard in `nonBlockingError.ts`.
- `CI=true npm test -- --runTestsByPath src/utils/nonBlockingError.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet gallery happy path | CURRENT_SOURCE_COVERED / PET E2E OPTIONAL | Exercise pet gallery list, quota, upload, like, and delete paths. Verify normal responses remain unchanged and unexpected server errors surface through the global API error path rather than silent success. |
| Pet profile business errors | CURRENT_SOURCE_COVERED / PET E2E OPTIONAL | Submit invalid pet profile data and duplicate/limit-conflict cases. Verify the UI receives explicit 400/409 errors and does not silently continue. |
| Client error dispatch fallback | SOURCE_FIXED / FRONTEND E2E OPTIONAL | In a browser harness, force `/api/errors` dispatch to throw synchronously and verify the app remains usable while a debug diagnostic is emitted locally without a recursive user-visible failure. |

## 2026-06-10 07:51 UTC QA F3493 Notification Send Failure Closure Handoff

Source status:
- QA F3493 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_OPTIONAL.
- Current `NotificationController` has no `sendNotification(...)` endpoint and no debug-only catch that returns false success.
- Admin notification broadcast delegates to `NotificationService.broadcastToCustomers(...)`; validation failures return 400, and non-validation write failures propagate instead of reporting success.

Local verification already run:
- `NotificationServiceTest.broadcastPropagatesBatchInsertFailures()` verifies batch insert/runtime failures are not converted into a successful sent count.
- `NotificationServiceTest.notificationControllerDoesNotOwnSilentSendNotificationEndpoint()` rejects the old `sendNotification(` controller method and `log.debug("sendNotification end")` catch pattern.
- `./mvnw -q -Dtest=NotificationServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin broadcast validation failure | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | Submit an admin notification broadcast without title/message or with oversized fields. Verify the API returns 400, no success audit is recorded, and the UI shows a failure state rather than a sent count. |
| Admin broadcast storage failure | CURRENT_SOURCE_COVERED / OPS E2E OPTIONAL | In staging, force the notification insert/batch insert to fail during broadcast. Verify the request fails, no false `sent` success is shown, and logs/audit evidence identify the failed broadcast without exposing message secrets beyond normal admin audit metadata. |
| Normal broadcast smoke | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | Broadcast a valid test notification to active customers and verify recipients receive it, the response sent count matches inserted notifications, and notification HTML sanitization still strips unsafe content. |

## 2026-06-10 07:45 UTC QA F3467 Product URL Import Observability Duplicate Handoff

Source status:
- QA F3467 FIXED / DUPLICATE_OF_F3505 / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED / E2E_OPTIONAL.
- Current `ProductUrlImportService` has no `catch (... ignored)` matches.
- F3505 already added debug logging to tolerant import fallbacks and a source guard requiring log context for future service catch blocks.

Local verification already run:
- `ProductUrlImportServiceTest.productUrlImportExceptionFallbacksRemainObservable()` rejects ignored catch bindings and non-`ResponseStatusException` catches without `log.` context.
- `./mvnw -q -Dtest=ProductUrlImportServiceTest test` passed.
- Targeted static search for ignored catch bindings in `ProductUrlImportService` returned no matches.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Valid supplier URL import | CURRENT_SOURCE_COVERED / IMPORT E2E OPTIONAL | In admin product URL import, import or preview a valid supplier/product page and verify extracted name, price, description, and image candidates still populate normally after the observability changes. |
| Malformed or metadata-poor page | CURRENT_SOURCE_COVERED / IMPORT E2E OPTIONAL | Import a page with malformed embedded JSON, missing product metadata, or malformed image URLs. Verify the UI returns the existing best-effort preview/error behavior and backend logs include debug context for the ignored fallback without a stackless silent drop. |
| Blocked unsafe URL | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | Submit local/private/unsupported URL targets and verify import remains blocked with the expected user-facing error while logs avoid leaking credentials or full sensitive URLs. |

## 2026-06-10 07:40 UTC QA F3466 Support WebSocket Exhaustion Fallback Handoff

Source status:
- QA F3466 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- `useReconnectingWebSocket(...)` caps reconnect attempts and invokes `onReconnectExhausted(...)` once after exhaustion.
- `CustomerSupportWidget` and `SupportManagement` show the localized connection-failed warning, report `*.websocketReconnectExhausted`, and keep HTTP polling active after WebSocket exhaustion.

Local verification already run:
- `useReconnectingWebSocket.test.tsx` covers reconnect exhaustion callback behavior.
- `CustomerSupportWidget.test.tsx` requires the visible exhaustion warning, diagnostic report, and continued customer message polling fallback.
- `SupportManagement.test.tsx` requires the visible exhaustion warning, diagnostic report, and continued admin session/message polling fallback.
- `CI=true npm test -- --runTestsByPath src/hooks/useReconnectingWebSocket.test.tsx src/components/CustomerSupportWidget.test.tsx src/pages/SupportManagement.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React/AntD act warnings only.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer support reconnect exhaustion | CURRENT_SOURCE_COVERED / FRONTEND E2E RECOMMENDED | In a browser run, open customer support chat, block or reject the support WebSocket until reconnect attempts exhaust, and verify the localized connection-failed warning appears once while HTTP polling still refreshes incoming messages/session state. |
| Admin support reconnect exhaustion | CURRENT_SOURCE_COVERED / ADMIN E2E RECOMMENDED | In admin support management, force WebSocket connection failures through exhaustion and verify the warning appears, session/message lists continue to refresh via HTTP polling, and the page remains usable for manual refresh/retry. |
| Diagnostic safety | CURRENT_SOURCE_COVERED / OBSERVABILITY E2E OPTIONAL | Combine with F3461 telemetry and verify `CustomerSupportWidget.websocketReconnectExhausted` / `SupportManagement.websocketReconnectExhausted` reports are sanitized, include attempt count context, and do not include tokens, WebSocket protocol values, message bodies, or customer PII. |

## 2026-06-10 07:28 UTC QA F3465 Route Error Boundary Coverage Handoff

Source status:
- QA F3465 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- Storefront route content is wrapped by `<ErrorBoundary key={location.pathname}>` around `<Outlet />`.
- Concrete admin child routes render through `adminRouteElement(...)` / `AdminRouteBoundary` with recovery to `/admin/dashboard`.

Local verification already run:
- `App.test.tsx` source guard verifies storefront `<Outlet />` is inside the pathname-keyed boundary.
- `App.test.tsx` source guard verifies concrete `/admin/*` child routes use `adminRouteElement(...)`.
- `CI=true npm test -- --runTestsByPath src/App.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront route render failure isolation | CURRENT_SOURCE_COVERED / FRONTEND E2E RECOMMENDED | In a test build or harness, force one storefront page component such as Product Detail or Checkout to throw during render. Verify the storefront navbar/footer remain available, the localized route fallback appears, and navigating to another storefront route recovers without a full app reload. |
| Admin page render failure isolation | CURRENT_SOURCE_COVERED / ADMIN E2E RECOMMENDED | Force one concrete admin page to throw during render. Verify the admin shell/sidebar/header remain available, the fallback recovery action routes to `/admin/dashboard`, and other admin pages can still be opened. |
| Boundary telemetry continuity | CURRENT_SOURCE_COVERED / OBSERVABILITY E2E OPTIONAL | Combine with F3461 telemetry: force a route render error and verify one sanitized `POST /api/errors` / System Alert is emitted while the boundary fallback remains localized. |

## 2026-06-10 06:20 UTC QA F3464 Backend Slow Request Latency Logging Handoff

Source status:
- QA F3464 SOURCE_FIXED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- `RequestCorrelationFilter` now logs slow servlet requests with method, normalized path, status, durationMs, thresholdMs, and requestId.
- Defaults: API threshold `1000ms`, admin threshold `5000ms`, logging enabled. Environment controls: `OBSERVABILITY_REQUEST_LATENCY_ENABLED`, `OBSERVABILITY_SLOW_REQUEST_API_THRESHOLD_MS`, `OBSERVABILITY_SLOW_REQUEST_ADMIN_THRESHOLD_MS`.

Local verification already run:
- `RequestCorrelationFilterTest.logsSlowApiRequestsWithCorrelationContext(...)` verifies slow request log context and query-string redaction.
- `RequestCorrelationFilterTest.appliesAdminSlowRequestThresholdToAdminPaths(...)` verifies `/admin/...` uses the admin threshold rather than the API threshold.
- `RequestCorrelationFilterTest.canDisableSlowRequestLogging(...)` verifies the kill switch.
- `./mvnw -q -Dtest=RequestCorrelationFilterTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| API slow request log | SOURCE_FIXED / OBSERVABILITY E2E RECOMMENDED | In staging, temporarily set a low API threshold and call a deliberately slow non-admin endpoint. Verify one WARN `Slow HTTP request` log includes method/path/status/duration/threshold/requestId and omits query string, Authorization, cookies, and body data. |
| Admin slow threshold | SOURCE_FIXED / ADMIN OBSERVABILITY E2E RECOMMENDED | With API threshold low and admin threshold higher, call `/admin/...` and verify it does not log until the admin threshold is crossed. Then lower the admin threshold and verify the same request logs with requestId context. |
| Disable switch | SOURCE_FIXED / OPS E2E OPTIONAL | Set `OBSERVABILITY_REQUEST_LATENCY_ENABLED=false`, repeat a slow request, and verify no `Slow HTTP request` log is emitted while `X-Request-Id` response/header behavior remains intact. |

## 2026-06-10 06:10 UTC QA F3463 / TEST F2581 Scheduler Failure Logging Handoff

Source status:
- QA F3463 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED / E2E_PENDING.
- TEST F2581 FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED / E2E_PENDING.
- Payment and unpaid-order expiry schedulers now log row-level failures with stack traces and continue later rows.

Local verification already run:
- `PaymentFlowServiceTest.expirePendingPaymentsLogsRowFailuresAndContinues(...)` verifies a failed payment expiry row logs `Payment expiry scan skipped payment after failure` with payment/order context and the later row still expires.
- `OrderStatsServiceTest.expiredOrderScanLogsRowFailuresAndContinues(...)` verifies a failed unpaid-order expiry row logs `Skipping expired-order cancellation during scan for order ...` and the later row still runs.
- `./mvnw -q -Dtest=OrderStatsServiceTest,PaymentFlowServiceTest#expirePendingPaymentsLogsRowFailuresAndContinues test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment expiry row failure isolation | CURRENT_SOURCE_COVERED / BACKEND E2E RECOMMENDED | In staging, seed multiple expired pending payments and force one early row to fail during expiry. Run the payment scheduler and verify logs include paymentId/orderId/orderNo plus stack trace, later rows continue processing, and the scheduler does not abort the whole batch. |
| Unpaid order row failure isolation | CURRENT_SOURCE_COVERED / BACKEND E2E RECOMMENDED | Seed multiple stale `PENDING_PAYMENT` orders and force one early cancellation to fail. Run the order scheduler and verify logs include the order id plus stack trace, later rows continue processing, and eligible later orders are evaluated. |
| Operator log safety | CURRENT_SOURCE_COVERED / OBSERVABILITY E2E OPTIONAL | Inspect scheduler logs from the failure-injection run and confirm they contain row identifiers and exception traces without customer PII, payment URLs, or provider secrets. |

## 2026-06-10 06:02 UTC QA F3462 / TEST F3455 Payment Gateway Retry Handoff

Source status:
- QA F3462 SOURCE_FIXED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- TEST F3455 payment-gateway portion PARTIAL_SOURCE_FIXED / PAYMENT_GATEWAY_RETRY_FIXED; broader Redis/other external-call retry scope remains separate.
- `PaymentService` retries `GENERIC_API` gateway create/refresh HTTP calls on transient failures with the same gateway idempotency key across attempts.
- Retry attempts/backoff are configurable with `payment.gateway-http-max-attempts`, `payment.gateway-http-retry-initial-delay-ms`, and `payment.gateway-http-retry-max-delay-ms`.

Local verification already run:
- `PaymentFlowServiceTest.genericApiPaymentCreateRetriesTransientGatewayFailureWithSameIdempotencyKey()` verifies a first 500 response retries and the second successful gateway response creates one payment with the same `Idempotency-Key` header and payload key.
- `PaymentFlowServiceTest.genericApiPaymentCreateDoesNotRetryNonTransientGatewayClientError()` verifies HTTP 400 is not retried, no payment row is inserted, and the thrown message exposes only `HTTP 400`, not gateway URL/body details.
- `./mvnw -q -Dtest=PaymentFlowServiceTest#genericApiPaymentCreateRetriesTransientGatewayFailureWithSameIdempotencyKey+genericApiPaymentCreateDoesNotRetryNonTransientGatewayClientError+genericApiPaymentCreateSendsIdempotencyKey test` passed.
- `./mvnw -q -Dtest=PaymentFlowServiceTest,StripeProviderErrorContractTest,PaymentServiceObservabilityContractTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Generic gateway transient 500 | SOURCE_FIXED / PAYMENT E2E RECOMMENDED | Configure a `GENERIC_API` payment channel in staging and force the first gateway create call to return 500, then succeed. Verify checkout still reaches the payment URL, only one local payment row is created, and both gateway calls use the same idempotency key. |
| Generic gateway network/timeout failure | SOURCE_FIXED / PAYMENT E2E RECOMMENDED | Simulate a timeout or connection reset before a successful retry. Verify the shopper sees a successful payment creation after retry and app logs include safe retry context without gateway URL, auth header, provider body, or secret values. |
| Non-transient gateway 4xx | SOURCE_FIXED / PAYMENT E2E RECOMMENDED | Force the gateway create endpoint to return 400/401/403. Verify there is no retry storm, no payment row is inserted for the failed create, the API/client error remains safe, and logs expose only HTTP status/operator context. |
| Retry configuration bounds | SOURCE_FIXED / OPS E2E OPTIONAL | In a controlled environment, set `payment.gateway-http-max-attempts=1` and then `5`; verify retry count obeys the runtime config and never exceeds the hard cap. Use zero/short retry delays for test speed. |
| Circuit-breaker compatibility | SOURCE_FIXED / OPS E2E OPTIONAL | With the circuit breaker enabled, force repeated retryable gateway failures and verify retries still pass through the circuit breaker, exhausted attempts fail safely, and breaker behavior remains observable. |

## 2026-06-10 05:45 UTC QA/TEST F3461 Frontend Error Reporting Handoff

Source status:
- QA/TEST F3461 SOURCE_FIXED / REGRESSION_GUARD_ADDED / E2E_PENDING.
- Frontend non-blocking diagnostics now remote-report through the configured API base `/errors` endpoint (`/api/errors` in production) while keeping local console diagnostics.
- Backend `POST /errors` records sanitized `CLIENT` / `FRONTEND` system alerts and can be disabled with `alerts.client-error.enabled=false`.

Local verification already run:
- `nonBlockingError.test.ts` covers disabled Jest default, explicit remote POST, ErrorBoundary nested errors, dedupe, global `window.error`, and non-Error object summaries without raw sensitive values.
- `ClientErrorReportControllerTest` verifies accepted and rejected report bodies.
- `SystemAlertServiceTest` verifies sanitized frontend alert recording, normalized paths, request id metadata, and disabled alert writes.
- `SecurityConfigCorsTest` verifies public `POST /errors` remains explicit.
- `CI=true npm test -- --runTestsByPath src/utils/nonBlockingError.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -q -Dtest=ClientErrorReportControllerTest,SystemAlertServiceTest,SecurityConfigCorsTest test` passed.
- `./mvnw -q -DskipTests compile` passed.
- `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| ErrorBoundary runtime report | SOURCE_FIXED / FRONTEND E2E RECOMMENDED | Force a render error in a controlled route/component. Verify the localized fallback still renders, the browser sends one `POST /api/errors`, and System Alerts shows a `CLIENT` / `FRONTEND` alert with context/path/request id but no raw stack secrets. |
| Global browser error and unhandled rejection | SOURCE_FIXED / FRONTEND E2E RECOMMENDED | Trigger `window.error` and an unhandled rejected promise in a staging harness. Verify reports are sent, deduped on immediate repeats, and normal app interaction continues. |
| API/catch fallback telemetry | SOURCE_FIXED / FRONTEND E2E RECOMMENDED | Force a recoverable API/storage failure on a page that calls `reportNonBlockingError(...)` (for example announcement load, cart fallback, or support polling). Verify existing UI fallback behavior is preserved and a sanitized report reaches `/api/errors`. |
| Sensitive data guard | SOURCE_FIXED / SECURITY E2E RECOMMENDED | Trigger a client error message containing token/password/Authorization/JWT/email/query-string values. Verify network payload and stored System Alert metadata mask or omit those values. |
| Backend disable switch | SOURCE_FIXED / OPS E2E OPTIONAL | With `alerts.client-error.enabled=false`, POST a valid report and verify the endpoint still accepts it but no new System Alert row is created. |

## 2026-06-10 05:20 UTC QA F3457 Payment Lifecycle Observability Handoff

Source status:
- QA F3457 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Payment lifecycle transitions now emit safe operator logs without payment URLs, secrets, or provider payloads.

Local verification already run:
- `PaymentServiceObservabilityContractTest` requires lifecycle logs for creation, refresh, callback paid/failed, Stripe webhook paid, Stripe sync paid/expired, expiry, reconciliation, and rejected callback/webhook paths.
- `PaymentFlowServiceTest` still passes with the payment lifecycle logging changes.
- `./mvnw -q -Dtest=PaymentServiceObservabilityContractTest,PaymentFlowServiceTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment creation observability | SOURCE_FIXED / PAYMENT E2E RECOMMENDED | Create redirect, Stripe, and generic/API payments where configured. Verify successful creation/reuse/refresh flows produce one safe lifecycle log with payment/order/channel/amount/status context and no payment URL or secret material. |
| Callback and webhook observability | SOURCE_FIXED / PAYMENT E2E RECOMMENDED | Run successful callback, failed callback, Stripe completed webhook, invalid callback signature, and invalid Stripe signature scenarios. Verify logs identify the transition/rejection with payment/order context while responses remain safe. |
| Provider sync and expiry observability | SOURCE_FIXED / PAYMENT E2E OPTIONAL | Force Stripe sync paid/expired outcomes and scheduled expiry. Verify sync/expiry logs identify the payment/order context, reconciliation cases are visible, and no provider payload or hosted checkout URL appears in application logs. |

## 2026-06-10 05:08 UTC QA F3458/F3459 API 4xx Observability Handoff

Source status:
- QA F3458/F3459 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Global API 400 and 403 handler paths now write application logs with path/request id context.
- Access-denied responses now also record an `ACCESS_DENIED` security event.

Local verification already run:
- `GlobalApiExceptionHandlerTest.badRequestWritesApplicationLogAndRecordsAlert()` verifies 400 logging plus existing alert recording.
- `GlobalApiExceptionHandlerTest.accessDeniedWritesApplicationLogAndRecordsSecurityAlert()` verifies 403 logging, security-alert recording, and unchanged `Forbidden` response.
- `./mvnw -q -Dtest=GlobalApiExceptionHandlerTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Bad request observability | SOURCE_FIXED / API E2E RECOMMENDED | Trigger representative 400s such as malformed JSON, missing required params, invalid IDs, and business validation errors. Verify response payloads remain safe/uniform and app logs include path/requestId/reason. |
| Access-denied observability | SOURCE_FIXED / SECURITY E2E RECOMMENDED | Call an admin/action endpoint with an authenticated role missing the required permission. Verify the API still returns the uniform 403 body, logs path/requestId/reason, and an `ACCESS_DENIED` security alert appears in system alerts. |
| Sensitive message handling | SOURCE_FIXED / API E2E OPTIONAL | Trigger a 400 with an internal/sensitive exception reason in a controlled test endpoint or mocked controller. Verify the client response remains generic while logs/alerts retain enough internal context for operators. |

## 2026-06-10 04:58 UTC QA F3455 Scheduled Expiry Batch Handoff

Source status:
- QA F3455 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Payment and unpaid-order expiry schedulers now use bounded seek pagination instead of unbounded mapper reads.

Local verification already run:
- `PaymentMapper.findExpiredPending` and `OrderMapper.findPendingPaymentBefore` apply `id > #{afterId}`, `ORDER BY id ASC`, and `LIMIT #{limit}`.
- `PaymentService.expirePendingPayments()` and `OrderService.cancelExpiredUnpaidOrders()` advance by the last id returned while preserving per-row skip/log behavior.
- `ScheduledExpiryMapperContractTest`, `PaymentFlowServiceTest`, and `OrderStatsServiceTest` cover mapper shape and scheduler paging behavior.
- `./mvnw -q -Dtest=PaymentFlowServiceTest,OrderStatsServiceTest,ScheduledExpiryMapperContractTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Expired pending payment batch sweep | SOURCE_FIXED / BACKEND E2E RECOMMENDED | Seed more expired pending payments than `payment.expiry-scan-batch-size`, plus future/null-expiry payments. Run the expiry scheduler and verify expired rows are processed across pages while future/null rows remain active. |
| Unpaid order batch cancellation | SOURCE_FIXED / BACKEND E2E RECOMMENDED | Seed more stale `PENDING_PAYMENT` orders than `order.expiry-scan-batch-size`, including rows with active non-expired pending payments. Run the order expiry scheduler and verify only eligible orders cancel across pages. |
| Row failure isolation across pages | SOURCE_FIXED / OBSERVABILITY E2E RECOMMENDED | Force one payment/order row in an early batch to fail, then verify later rows in the same batch and following pages still process and logs include the skipped row id/context. |
| Query boundedness/performance smoke | SOURCE_FIXED / DB E2E OPTIONAL | Capture SQL or DB metrics during scheduler runs and verify expiry scans use bounded `ORDER BY id ASC LIMIT ...` queries instead of loading all matching rows at once. |

## 2026-06-10 04:39 UTC QA F3454 Admin Support Unread Query Handoff

Source status:
- QA F3454 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Admin support session paging now uses the shared unread aggregate join instead of per-row unread subqueries.

Local verification already run:
- `SupportSessionMapper.findAdminPage` includes `supportUnreadJoin`.
- `supportSessionAdminPageColumns` reads `COALESCE(unread.unread_by_user, 0)` and `COALESCE(unread.unread_by_admin, 0)`.
- `SupportSessionMapperContractTest` rejects reintroduced `SELECT COUNT(*) FROM support_messages` in admin page columns.
- `./mvnw -q -Dtest=SupportSessionMapperContractTest,SupportServiceTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin support queue pagination | SOURCE_FIXED / ADMIN SUPPORT E2E RECOMMENDED | Seed support sessions with varied unread admin/user counts, open `/admin/support`, and verify page totals, unread badges, assigned-admin names, and pagination remain correct. |
| Admin support unread ordering | SOURCE_FIXED / ADMIN SUPPORT E2E RECOMMENDED | Verify sessions with higher `unreadByAdmin` still sort before lower-unread sessions, with updated time/id tie-breakers preserved. |
| Query-plan/performance smoke | SOURCE_FIXED / DB E2E OPTIONAL | Capture SQL or EXPLAIN for admin support page and confirm unread counts come from the aggregate LEFT JOIN, not two correlated unread count subqueries per row. |

## 2026-06-10 04:32 UTC QA F3452 Redis KEYS Removal Handoff

Source status:
- QA F3452 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Production Redis key enumeration no longer calls blocking `KEYS`; TokenBlacklist login-failure snapshots and RateLimit bucket clears use `SCAN`.

Local verification already run:
- `TokenBlacklistService.findLoginIpFailures()` scans `login:ip:*` through Redis `SCAN` with bounded `security.ip-blacklist.redis-scan-count`.
- `RateLimitService.clearRedisBuckets()` remains SCAN-based from F3427.
- Production scan `rg -n "\\.keys\\(" src/main/java/com/example/shop -g "*.java"` returned no matches.
- `./mvnw -q -Dtest=TokenBlacklistServiceTest,RateLimitServiceTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Login failure snapshot/admin security view | SOURCE_FIXED / API E2E RECOMMENDED | Seed several Redis `login:ip:*` counters with TTLs, call the admin/security endpoint or UI that reads login failure snapshots, and verify counters/locked state render correctly without Redis `KEYS` in command logs. |
| Rate-limit bucket clear regression | SOURCE_FIXED / API E2E OPTIONAL | With Redis rate limiting enabled, generate a few rate-limit buckets, trigger admin clear/reset, and verify buckets clear while Redis command logs show `SCAN`/`DEL`, not `KEYS`. |
| High-key-count safety | SOURCE_FIXED / PERF SMOKE OPTIONAL | In staging only, seed many unrelated Redis keys plus login/rate-limit keys and confirm snapshot/clear operations do not block unrelated Redis reads noticeably. |

## 2026-06-10 04:22 UTC QA F3450 Service Transaction Rollback Handoff

Source status:
- QA F3450 SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- Service-layer transactions now declare `rollbackFor = Exception.class` so checked exceptions cannot commit partial writes.

Local verification already run:
- Source scan for service `@Transactional` annotations missing `rollbackFor = Exception.class` returned no matches.
- `TransactionRollbackContractTest` now rejects future service transactions without checked-exception rollback coverage.
- `./mvnw -q -Dtest=TransactionRollbackContractTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Member and guest checkout write paths | SOURCE_FIXED / API E2E RECOMMENDED | Run normal registered checkout and guest checkout smoke flows, including stock reservation and cart cleanup, to confirm transaction annotation changes did not alter successful write behavior. |
| Payment/refund write paths | SOURCE_FIXED / API E2E RECOMMENDED | Run payment create/latest status, simulated callback or configured gateway callback, and refund request/admin handling smoke where available. Verify normal state transitions still persist. |
| Admin/user/support write paths | SOURCE_FIXED / API E2E OPTIONAL | Exercise representative admin product/category/coupon/user/support mutations. This change is compile-safe and contract-guarded, but runtime smoke helps confirm no proxy/transaction wiring regression. |

## 2026-06-10 04:13 UTC QA F3499 Backend Empty Catch Closure Handoff

Source status:
- QA F3499 FIXED / DUPLICATE_OF_F3526 / REGRESSION_GUARD_EXTENDED.
- The backend empty-catch report is covered by the broader F3526 silent-catch source fix.

Local verification already run:
- Current `src/main/java` has no empty/comment-only catch handlers.
- Current `src/main/java` has no `.printStackTrace()` calls.
- `EmptyCatchBlockContractTest` now rejects empty/comment-only catch bodies in production Java/frontend sources and rejects production Java `.printStackTrace()` calls.
- `./mvnw -q -Dtest=EmptyCatchBlockContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Backend exception observability | SOURCE_FIXED / API E2E OPTIONAL | Runtime E2E is optional because this is a static observability contract. Reuse normal admin/storefront API smoke tests and confirm no behavior regression; backend log inspection can verify expected structured warning/debug entries for deliberately forced non-blocking fallback paths. |
| Regression guard | SOURCE_FIXED / NO MANUAL E2E REQUIRED | CI should keep `EmptyCatchBlockContractTest` in the backend test suite so future empty catches or production `printStackTrace()` calls fail before release. |

## 2026-06-10 04:06 UTC QA F3447/F3448 Payment and Guest Support Polling Handoff

Source status:
- QA F3447 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.
- QA F3448 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `Checkout.tsx` pending-payment polling depends on `paymentStatus = payment?.status`, not the whole `payment` object.
- `CustomerSupportWidget` reads guest polling order/email through `activeGuestContextRef` and drops in-flight guest poll results after the guest context changes.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (31/31).
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout pending payment polling | CURRENT_SOURCE_COVERED / E2E_PENDING | Start a checkout payment that remains `PENDING`, keep `/payments/order/{id}/latest` returning updated PENDING payloads, and verify the browser keeps one stable 5s polling cadence without repeatedly resetting the interval. Then return `PAID` and verify the order/payment UI updates and polling stops. |
| Guest support order-context switch | SOURCE_FIXED / E2E_PENDING | Open support from guest order tracking for order A, trigger or wait for a poll, then switch to order B before the old poll completes. Verify subsequent guest message fetch/read-marker calls use order B email/orderNo and no messages from order A are merged into the active chat. |
| Authenticated support regression | SOURCE_FIXED / E2E_PENDING | While logged in, open the support widget and verify normal authenticated session polling and read markers still use member APIs, with no guest order/email parameters. |

## 2026-06-10 04:01 UTC QA F933 Admin User Password Exposure Handoff

Source status:
- QA F933 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.
- Current backend source does not expose password hashes through admin user response DTOs or admin user CSV export.

Local verification already run:
- `User.password` is `@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)`.
- `AdminUserResponse` has no `password` field and does not call `user.getPassword()`.
- Admin user list/update/role responses map users through `AdminUserResponse.from(...)`.
- `/admin/users/export` CSV header/data omit password/hash columns.
- `./mvnw -q -Dtest=AdminRequestValidationContractTest,UserJsonSerializationTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin user list payload | CURRENT_SOURCE_COVERED / API E2E OPTIONAL | Log in as an admin/super-admin, call `/admin/users` with a fixture user that has an encoded password, and verify response JSON items contain no `password`, `passwordHash`, or encoded hash value. |
| Admin user export | CURRENT_SOURCE_COVERED / API E2E OPTIONAL | Call `/admin/users/export` and verify CSV headers/data include only allowed columns and no password/hash material. |
| Admin user mutation responses | CURRENT_SOURCE_COVERED / API E2E OPTIONAL | Assign a role and update allowed user fields, then verify response JSON uses safe admin user fields only. |

## 2026-06-10 03:49 UTC Frontend F981 Home Pet Gallery Extraction Handoff

Source status:
- QA frontend F981 PARTIAL_SOURCE_FIXED / REGRESSION_GUARD_ADDED.
- F981 remains open for broader large-component decomposition: `Home.tsx` is now 1305 lines, but still exceeds 1000 lines; `Checkout.tsx`, `ProductList.tsx`, and `CustomerSupportWidget.tsx` remain large.

Local verification already run:
- `HomePetGallery` moved Pet UGC upload controls, gallery grid cards, like/delete controls, responsive image fallback, and preview modal out of `pages/Home.tsx` into `components/HomePetGallery.tsx`.
- `Home.tsx` still owns the data-loading/quota/upload/like/delete state and passes typed `HomePetGalleryItem` props/callbacks to the extracted component.
- `sourceQuality.test.ts` rejects reintroducing the inline Pet UGC section or preview modal into `Home.tsx`.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (15/15).
- `npx tsc --noEmit --pretty false` passed.
- `git diff --check -- frontend/src/pages/Home.tsx frontend/src/components/HomePetGallery.tsx frontend/src/utils/sourceQuality.test.ts` passed.
- F3498 retest: `CI=true npm test -- --runTestsByPath src/pages/OrderTracking.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (6/6), so the latest F3498 regression note is stale against current source.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Home Pet UGC desktop/mobile render | PARTIAL_SOURCE_FIXED / E2E_PENDING | Load Home with backend Pet Gallery photos and fallback UGC images on desktop and mobile. Verify upload controls, card labels, like counts, delete buttons for owned photos, and preview modal render with no layout shift or clipped controls. |
| Home Pet UGC interactions | PARTIAL_SOURCE_FIXED / E2E_PENDING | As guest, verify upload prompts login and fallback likes persist locally. As signed-in user, upload a JPEG/PNG/GIF within size limits, like a server photo, delete an owned photo, and open/close the preview modal. |
| Home Pet UGC image resilience | PARTIAL_SOURCE_FIXED / E2E_PENDING | Force broken Pet Gallery image URLs and verify the extracted component swaps to the media fallback, keeps alt text/labels readable, and does not break the Home page shell. |

## 2026-06-10 03:40 UTC QA F975 Frontend Catch-Binding Handoff

Source status:
- QA/TEST F975 FIXED / SOURCE_FIXED / FRONTEND_CATCH_BINDINGS_CLOSED / REGRESSION_GUARD_ADDED.
- Production frontend no longer contains optional catch-binding syntax `catch { ... }`; operational fallbacks now bind `error` and report via `reportNonBlockingError(...)`. Pure URL/format validation catches bind `_error` intentionally because malformed input is the expected negative validation path.

Local verification already run:
- `rg -n "catch\\s*\\{" frontend/src --glob '!**/*.test.*'` returned no matches.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (14/14).
- `npx tsc --noEmit --pretty false` passed.
- `CI=true npm test -- --runTestsByPath src/components/CartDrawer.test.ts src/utils/cartSession.test.ts src/utils/guestCart.test.ts src/pages/Notifications.test.ts src/pages/Wishlist.test.tsx src/pages/PetGallery.test.ts src/components/ProductRichDetail.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (43/43).
- Note: an earlier exploratory command included nonexistent `src/pages/Cart.test.tsx` and failed with ENOENT only; the actual cart-related tests above supersede it.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storage-restricted fallback observability | SOURCE_FIXED / BROWSER E2E PENDING | In a browser profile where localStorage/sessionStorage throws or is disabled, open cart, wishlist, compare, stock alerts, saved-for-later, and recent-history flows. Verify the UI still falls back as before and console/telemetry has `[shop] safeStorage.*` or feature-specific diagnostic context. |
| Cart and checkout entry fallbacks | SOURCE_FIXED / CART E2E PENDING | Force cart item fetch or checkout-session persistence failure from Cart and CartDrawer. Verify user-facing warnings remain localized, drawer/page state recovers, and `Cart.goCheckout` / `CartDrawer.goCheckout` diagnostics are emitted. |
| Home and Pet Gallery data fallback | SOURCE_FIXED / STOREFRONT E2E PENDING | Fail Home catalog/personalization/pet-gallery requests and Pet Gallery quota/list requests. Verify fallback catalog/gallery UI remains usable, no blank page occurs, and diagnostics include `Home.*` and `PetGallery.*` contexts. |
| Notifications, Wishlist, Coupon, Announcement admin fallbacks | SOURCE_FIXED / UI E2E PENDING | Force representative API failures in Notifications, Wishlist, CouponCenter, CouponManagement, AnnouncementManagement, BrowsingHistory, and PaymentInstructions. Verify existing messages/error states still render and diagnostics are observable. |
| Rich content parsing fallback | SOURCE_FIXED / PRODUCT DETAIL E2E OPTIONAL | Load product detail rich content with malformed JSON/media URLs. Verify content falls back safely, no crash occurs, and ProductRichDetail diagnostics appear for malformed stored rich content. |

## 2026-06-10 02:48 UTC QA F1196-F1212 Checkout+Cart Current-Source Handoff

Source status:
- QA F1206 FIXED / SOURCE_FIXED / CHECKOUT_LIST_ROW_KEYED / REGRESSION_GUARD_ADDED.
- QA F1196/F1197/F1198/F1199/F1200/F1201/F1202/F1203/F1204/F1207/F1208/F1209/F1210/F1211 WONTFIX / CURRENT_SOURCE_COVERED / STALE_LEGACY_EVIDENCE / REGRESSION_GUARD_ADDED.
- TEST F1198 SOURCE_FIXED / NAVBAR_LOGOUT_REVOKE_DIAGNOSTIC / REGRESSION_GUARD_ADDED.
- TEST F1199/F1200/F1201/F1202/F1203/F1204/F1205/F1206/F1207/F1208/F1209/F1211 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts src/pages/Checkout.test.tsx src/utils/cartUi.test.ts src/components/Navbar.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React/Router/AntD warning noise.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -q -Dtest=PaymentFlowServiceTest#checkoutUsesAuthoritativeProductPriceInsteadOfCartSnapshotPrice test` passed.
- Current source has no legacy `checkout_user`, `CheckoutAPI`, `completeCheckoutSpy`, `adminAddToCart`, `empty-cart-message`, `CouponValidationServiceTest.groovy`, `CartItemRestControllerTest.groovy`, `checkout_total_div_100`, stale `fetchCart`, or `window.location.href` checkout success path. Checkout item rows now use `rowKey={(item) => item.id}`; Cart clamps quantities by stock; backend checkout verifies selected cart ownership, locks cart/product rows, reserves stock, and reprices from current product data.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Member checkout stock/session integrity | CURRENT_SOURCE_COVERED / ORDER E2E PENDING | Log in, select cart items, change quantity near/above available stock, navigate to checkout, then complete checkout. Verify unavailable/over-stock lines cannot submit, cart selections do not leak across account switches, and backend rejects stale stock if stock changes between cart and submit. |
| Guest checkout and address validation | CURRENT_SOURCE_COVERED / GUEST ORDER E2E PENDING | Run guest checkout with missing/invalid email, phone, region, postal code, and address, then with valid data. Verify validation blocks bad payloads, order creation sends no client line prices, and payment handoff still works. |
| Checkout responsive/empty states | CURRENT_SOURCE_COVERED / MOBILE VISUAL PENDING | At 360px, 390px, 430px, tablet, and desktop widths, inspect empty checkout, item list, payment methods, coupon card, and mobile pay bar. Confirm no horizontal overflow, stale `.checkout-container`/`.empty-cart` layout assumptions, or dropdown/modal z-index overlap. |
| Logout partial failure | SOURCE_FIXED / NAV E2E PENDING | Simulate `/auth/logout` failure while a refresh token exists. Verify the user sees the localized partial-logout warning, local auth state clears, and navigation lands on the login URL without a full-page reload or silent failure. |
| Checkout item list updates | SOURCE_FIXED / SMOKE OPTIONAL | With multiple checkout lines, remove/restore items or refresh selected cart ids and verify row identity, names, images, prices, and quantities remain matched to the correct cart item. |

## 2026-06-10 02:23 UTC QA F1075-F1077/F1082 BugManagement Backend Handoff

Source status:
- QA/TEST F1075 FIXED / SOURCE_FIXED / SINGLE_AGGREGATE_SUMMARY_QUERY / REGRESSION_GUARD_ADDED.
- QA/TEST F1076 FIXED / SOURCE_FIXED / LIGHTWEIGHT_LIST_WITH_LAZY_DETAIL_FETCH / REGRESSION_GUARD_ADDED.
- QA/TEST F1077 FIXED / SOURCE_FIXED / APPEND_ONLY_NOTE_HISTORY / REGRESSION_GUARD_ADDED.
- QA/TEST F1082 FIXED / SOURCE_FIXED / LEGACY_NOTE_FALLBACK_DOCUMENTED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `./mvnw -q -Dtest=AdminBugReportServiceTest test` passed.
- `CI=true npm test -- --runTestsByPath src/pages/BugManagement.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Current backend summary uses one aggregate query; `/admin/bugs` returns lightweight list rows; `/admin/bugs/{id}` returns full detail rows; BugManagement lazy-loads details when rows expand; scan/status notes append to existing history.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Bug summary widgets | SOURCE_FIXED / ADMIN E2E PENDING | Open BugManagement with mixed statuses/severities and verify summary cards match database counts after the single aggregate query change. Confirm scan interval/next scan still render normally. |
| Bug list and row expansion | SOURCE_FIXED / ADMIN E2E PENDING | Load list pages with filters/search/scan queue enabled, expand several rows, and verify the page first renders list fields quickly, then expanded description/repro/notes/environment fields load from `/admin/bugs/{id}` without losing pagination state. |
| Note history | SOURCE_FIXED / ADMIN E2E PENDING | Scan or update the same bug multiple times with scan, fix, and regression notes. Verify previous notes remain visible and new notes append in order instead of replacing history. |
| Legacy note fallback | SOURCE_FIXED / API COMPAT E2E OPTIONAL | Submit an older status/scan payload using only `note`; verify it appends to scan note only and does not populate fix/regression notes unless those explicit fields are present. |

## 2026-06-10 02:02 UTC QA F1080/F1081 BrowsingHistory Typography and Retry Handoff

Source status:
- QA/TEST F1080 FIXED / SOURCE_FIXED / BROWSING_HISTORY_TYPOGRAPHY_ALIGNED / REGRESSION_GUARD_ADDED.
- QA/TEST F1081 WONTFIX / CURRENT_SOURCE_COVERED / RETRY_ALERT_GUARDED.

Local verification already run:
- `CI=true npm test -- --runTestsByPath src/pages/BrowsingHistory.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Current BrowsingHistory uses Ant Design `Typography.Title`/`Typography.Paragraph` for page headings/body copy and renders a warning `Alert` with a retry button when history product lookup fails.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| BrowsingHistory typography | SOURCE_FIXED / VISUAL E2E PENDING | Open Browsing History with empty history, normal history, deal/low-stock history, and Spanish/Chinese locales. Verify hero, assistant, recovery, and next-action copy preserve the previous layout while using consistent typography styling. |
| Mobile layout stability | SOURCE_FIXED / MOBILE VISUAL PENDING | At phone widths and Android WebView, verify the fixed mobile action, hero copy, empty state, and product cards do not clip or overlap after the Typography selector change. |
| Product-load failure retry | CURRENT_SOURCE_COVERED / API FAILURE E2E PENDING | Simulate `productApi.getByIds` failure for an account/device with recent history. Verify the warning alert is visible, retry is reachable, retry refetches products, and successful retry restores the history grid. |

## 2026-06-10 01:52 UTC QA F1067-F1070/F1078 BugManagement Current-Source Handoff

Source status:
- QA/TEST F1067/F1068/F1069/F1070/F1078 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `CI=true npm test -- --runTestsByPath src/pages/BugManagement.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- Current BugManagement has localized priority labels (`priorityP0` through `priorityP3`) in English, Spanish, and Chinese locale files; separates initial permission loading from the no-permission alert with a visible skeleton; gives the scan queue switch an accessible name; and derives scan polling from `summary.scanIntervalMinutes` with a minimum one-minute fallback.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| BugManagement priority labels | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | In English, Spanish, and Chinese admin sessions, open BugManagement and verify P0-P3 labels render localized in table rows and the create/edit priority dropdown. |
| Permission loading and no-permission state | CURRENT_SOURCE_COVERED / ADMIN E2E PENDING | Load BugManagement with slow `/admin/me/permissions`; verify the skeleton appears during permission fetch and the no-permission alert appears only after permissions resolve without read access. |
| Scan queue accessibility | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | Inspect the scan queue switch with an accessibility tree or screen reader and verify it has the localized accessible name. Toggle it and confirm the queue filter applies normally. |
| Scan refresh interval | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | In an environment where bug summary exposes a non-default `scanIntervalMinutes`, verify the page refresh cadence follows the summary value and still falls back safely if the value is absent or invalid. |

## 2026-06-10 01:48 UTC QA F1059-F1065 AdminLayout Shell Handoff

Source status:
- QA/TEST F1061 FIXED / SOURCE_FIXED / ADMIN_SELECTED_MENU_CONTRAST_HARDENED / REGRESSION_GUARD_ADDED.
- QA/TEST F1063 FIXED / SOURCE_FIXED / ADMIN_HEADER_ERROR_BOUNDARY_ADDED / REGRESSION_GUARD_ADDED.
- QA/TEST F1065 FIXED / SOURCE_FIXED / ABORTABLE_ADMIN_AUTH_CHECKS / REGRESSION_GUARD_ADDED.
- QA/TEST F1059/F1060/F1062/F1064 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for nested route matching, failed-auth loading cleanup, tablet header/sider z-index ordering, and shared logout login-url redirects.

Local verification already run:
- `CI=true npm test -- --runTestsByPath src/components/AdminLayout.test.tsx src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Current AdminLayout selects nested admin routes via `pathname === key || pathname.startsWith(key + '/')`, aborts superseded profile/permission checks, keeps request-id stale-response guards, wraps desktop menu/mobile menu/header/content in error boundaries, and uses AA-safe selected menu colors.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Nested admin deep links | CURRENT_SOURCE_COVERED / ADMIN E2E PENDING | Open nested routes such as `/admin/orders/123`, `/admin/products/edit/1`, and `/admin/support/session/...` after login. Verify the matching parent menu remains selected and the shell does not redirect to the first admin menu item or stay on the loading spinner. |
| Admin auth failure and refresh race | SOURCE_FIXED / ADMIN E2E PENDING | Simulate an expired token or failed `/users/profile`/`/admin/me/permissions` response, then navigate rapidly between admin pages. Verify the UI leaves loading state, redirects consistently through the login URL builder, and stale permission responses do not overwrite the latest role/menu state. |
| Admin shell chrome | SOURCE_FIXED / VISUAL E2E PENDING | At desktop, 721-991px tablet, and phone widths, inspect the selected sidebar/drawer item contrast, sticky header layering, mobile drawer, logout button, and submit-bug action. Verify header/sidebar shadows do not overlap incorrectly and selected item text is readable. |
| Error-boundary coverage | SOURCE_FIXED / SMOKE ONLY | Keep normal admin navigation smoke coverage. If a route-level or chrome rendering error is intentionally injected in a test build, verify the admin shell shows the configured fallback instead of blanking the whole app. |

## 2026-06-10 01:27 UTC QA Performance Deep Audit Stale-Path Closure Handoff

Source status:
- QA PERF-001/PERF-002/PERF-004/PERF-005/PERF-006 WONTFIX / CURRENT_SOURCE_COVERED / STALE_ORDER_OR_REVIEW_IMPL_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-007 WONTFIX / CURRENT_SOURCE_COVERED / STALE_PAY_SERVICE_IMPL_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-008/PERF-009/PERF-011 WONTFIX / CURRENT_SOURCE_COVERED / STALE_USER_COUPON_SERVICE_IMPL_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-010 WONTFIX / CURRENT_SOURCE_COVERED / STALE_COUPON_CODE_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-012/PERF-013 WONTFIX / CURRENT_SOURCE_COVERED / STALE_INVENTORY_SERVICE_IMPL_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-014/PERF-015/PERF-016/PERF-017/PERF-018/PERF-019/PERF-020 WONTFIX / CURRENT_SOURCE_COVERED / STALE_RECOMMEND_SERVICE_AND_RULE_ENGINE_REPORT / REGRESSION_GUARD_ADDED.
- QA PERF-003 FIXED / SOURCE_FIXED / CURRENT_SOURCE_BATCHED_STOCK_RESERVATION / REGRESSION_GUARD_ADDED at 2026-06-10 01:36 UTC.

Local verification already run:
- `./mvnw -q -Dtest=CommerceLegacyIssueContractTest,OrderItemRepositoryContractTest,OrderStockReservationServiceTest,ProductSearchServiceTest,CouponServiceTest test` passed.
- `./mvnw -q -Dtest=OrderStockReservationServiceTest,PaymentFlowServiceTest,OrderInputNormalizationServiceTest,OrderItemRepositoryContractTest test` passed.
- Current source has no `OrderServiceImpl`, `PayServiceImpl`, `UserCouponServiceImpl`, `CouponServiceImpl`, `InventoryServiceImpl`, `RecommendServiceImpl`, or `ShopRuleEngine`.
- Current checkout item creation uses `OrderItemRepository.insertBatch(...)`; guest/member checkout stock reservation uses current locked product/cart paths and saves each distinct reserved product once after reservation; coupon wallet/available calls are bounded; recommendations use `ProductServiceImpl` bounded candidate windows and TTL/capped product search cache.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout item creation | CURRENT_SOURCE_COVERED / ORDER E2E OPTIONAL | Keep registered and guest checkout smoke coverage with multi-line carts. Verify order item rows and customer/admin order detail render normally after the batch-insert path. |
| Stock reservation batching | SOURCE_FIXED / ORDER E2E PENDING | Run member and guest checkout with simple products, variant products, and carts containing multiple lines for the same product. Verify stock decrements correctly, no oversell occurs, order items persist, and checkout still shows correct prices/images after reservation. |
| Coupon wallet and usage | CURRENT_SOURCE_COVERED / COUPON E2E OPTIONAL | Claim/grant/use/release coupons and verify wallet/available lists are bounded and `used_count` remains aligned with redeemed user-coupon rows. |
| Product recommendations | CURRENT_SOURCE_COVERED / STOREFRONT E2E OPTIONAL | Exercise related products and personalized recommendations. Verify results render from current ProductService paths and no legacy Redis/trending rule-engine flow is expected. |

## 2026-06-10 01:18 UTC QA Regression #41 Source-Contract Closure Handoff

Source status:
- QA F9316 WONTFIX / CURRENT_SOURCE_NON_ISSUE / BUSINESS_CONTRACT_GUARDED.
- QA F9317 WONTFIX / CURRENT_SOURCE_COVERED / STALE_CONFIG_REPORT / REGRESSION_GUARD_ADDED.
- QA F9321 WONTFIX / CURRENT_SOURCE_INTENTIONAL / VARIANT_SKU_CONTRACT_GUARDED.
- QA F9322 WONTFIX / CURRENT_SOURCE_COVERED / SCHEMA_FK_GUARDED.
- QA F9323 WONTFIX / CURRENT_SOURCE_COVERED / CATEGORY_FK_AND_BRAND_INTENT_GUARDED.
- QA F9324 WONTFIX / CURRENT_SOURCE_COVERED / STALE_OVERLAY_REPORT / REGRESSION_GUARD_ADDED.

Local verification already run:
- `./mvnw -q -Dtest=ApplicationProfileContractTest,CommerceSchemaContractTest,ProductVariantServiceTest,CouponServiceTest test` passed.
- `CI=true npm test -- --runTestsByPath src/pages/PetGallery.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- Current source has no `maxDiscountRate`, no points-redemption coupon path, no `application.yml` hardcoded Stripe secret, no top-level `products.sku`, no `brand_id` product FK, and no Pet Gallery `.overlay` / `rgba(0,0,0,0.6)` card overlay path.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon payable-percent contract | CURRENT_SOURCE_NON_ISSUE / COUPON E2E OPTIONAL | Quote and redeem a percentage coupon such as `discountPercent=80`; verify checkout presents and persists the intended payable-percent discount. No `maxDiscountRate` or points-redemption path exists to exercise. |
| Stripe secret configuration | CURRENT_SOURCE_COVERED / DEPLOYMENT INSPECTION PENDING | Inspect deployed config/secrets and application logs to confirm Stripe secret/webhook values come from environment or secret storage, not committed `application.yml` values. |
| Product variant SKU handling | CURRENT_SOURCE_INTENTIONAL / PRODUCT E2E PENDING | In admin product create/import/update, attempt duplicate variant SKUs within a product and across import rows; verify validation blocks duplicates while normal variant SKU selection works in product detail/list/checkout. |
| Commerce schema FKs | CURRENT_SOURCE_COVERED / DB E2E PENDING | On fresh and migrated MySQL-compatible databases, verify `orders.user_id` references `users(id)`, `products.category_id` references `categories(id)`, and `products.brand` remains denormalized display text without a strict `brand_id` FK. |
| Pet Gallery mobile overlay report | CURRENT_SOURCE_COVERED / MOBILE VISUAL PENDING | On phone widths, inspect Pet Gallery cards and verify owner labels remain readable on image cards. No stale `.overlay` selector should appear in the rendered card path. |

## 2026-06-10 01:11 UTC QA Regression #41 Stale/Current-Source Closure Handoff

Source status:
- QA F9318 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.
- QA F9319/F9320 WONTFIX / CURRENT_SOURCE_COVERED with checkout lifecycle/dependency guards.
- QA F9325/F9329/F9343 WONTFIX / CURRENT_SOURCE_COVERED / STALE_STOREFRONT_CONTEXT_REPORT / REGRESSION_GUARD_ADDED.
- QA F9327 WONTFIX / CURRENT_SOURCE_COVERED / STALE_MAPPER_STYLE_REPORT / REGRESSION_GUARD_ADDED.
- QA F9331 WONTFIX / CURRENT_SOURCE_COVERED / STALE_MEMOIZED_REF_REPORT / REGRESSION_GUARD_ADDED.
- QA F9336 WONTFIX / STYLE_INTENTIONAL.
- QA F9337 WONTFIX / CURRENT_SOURCE_COVERED / STALE_INDEX_NAME_REPORT / REGRESSION_GUARD_ADDED.
- QA F9344 WONTFIX / CURRENT_SOURCE_INTENTIONAL / DELETION_CONTRACT_GUARDED.
- QA F9347 WONTFIX / CURRENT_SOURCE_COVERED / TARGETED_JEST_PASS.

Local verification already run:
- `./mvnw -q -Dtest=CouponServiceTest,WishlistServiceTest,CommerceLegacyIssueContractTest,CommerceSchemaContractTest,GlobalApiExceptionHandlerTest test` passed.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts src/pages/Checkout.test.tsx src/pages/SupportManagement.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed 25/25 in 36.9s.
- Current source has no `StorefrontContext`, no `zustand` dependency/import, no `ReviewImageMapper.xml`, no `PetGalleryMapper.xml`, no `memoizedRef`, and no stale `brandidx`/`categoryidx` schema names.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout error messaging | CURRENT_SOURCE_COVERED / CHECKOUT E2E PENDING | Trigger readable business failures such as unavailable product/stock, missing payload, invalid guest email, and expired auth. Verify the UI/API shows safe specific messages rather than a generic order-create failure, while sensitive internal errors remain generic. |
| Checkout state persistence | CURRENT_SOURCE_COVERED / CHECKOUT E2E PENDING | In auth and guest checkout, change address, region, payment method, coupon, and guest fields. Verify cart/address bootstrap is not re-run unnecessarily, entered fields remain stable, and no stale async state appears after rapid navigation away/back. |
| Storefront personalization | CURRENT_SOURCE_COVERED / STOREFRONT E2E OPTIONAL | Open Home as guest and authenticated user, seed recent-view preferences, and verify personalized/recent sections render from current preference/API paths. No StorefrontContext/Zustand path exists to exercise. |
| Review image and pet gallery persistence | CURRENT_SOURCE_COVERED / SMOKE ONLY | Keep normal review image upload and pet gallery upload/like/delete smoke coverage. No stale MyBatis mapper XML path exists. |
| Support admin queue | CURRENT_SOURCE_COVERED / SUPPORT E2E PENDING | Exercise support admin queue filter/search/pagination, select a conversation on mobile width, receive a websocket/poll message, and verify queue/session state updates without losing selection. |
| Coupon and wishlist deletion semantics | CURRENT_SOURCE_INTENTIONAL / API E2E PENDING | Verify wishlist add/remove/re-add works as a hard-delete toggle. Verify deleting an unused coupon with unused assignments succeeds after cleanup, while deleting a used coupon fails and preserves order/coupon history. |
| CartCheckoutFlow flake report | CURRENT_SOURCE_COVERED / CI WATCH | Keep `CartCheckoutFlow.test.tsx` in the CI watch list. Current targeted Jest run passed; if timeouts recur, capture the specific test name and timer state before reopening. |

## 2026-06-10 00:55 UTC QA F9328 Favorites Response Stale-Report Handoff

Source status: QA F9328 WONTFIX / CURRENT_SOURCE_COVERED / STALE_RESULT_WRAPPER_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current `FavoritesController.addFavorite(...)` returns `Map<String,Object>` with `{ "wishlisted": boolean }`.
- Current `FavoritesController.removeFavorite(...)` returns a message payload.
- Current source does not contain the stale `Result<Boolean>` response shape.
- `./mvnw -q -Dtest=FavoritesControllerContractTest,WishlistServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Favorite add/remove response | CURRENT_SOURCE_COVERED / WISHLIST E2E OPTIONAL | Keep normal storefront favorite/wishlist add, remove, and toggle smoke coverage. Verify UI state follows the `wishlisted` boolean response and no frontend caller expects a `Result<Boolean>` wrapper. |

## 2026-06-10 00:53 UTC QA F9338/F9345 Stale Order Item/Image URL Schema Report Handoff

Source status: QA F9338 WONTFIX / CURRENT_SOURCE_COVERED / STALE_GENERATED_COLUMN_REPORT / REGRESSION_GUARD_ADDED; QA F9345 WONTFIX / CURRENT_SOURCE_COVERED / STALE_IMAGE_URL_WIDTH_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current `order_items` has explicit scalar snapshot columns `product_name_snapshot` and `image_url_snapshot`, plus stored item `price`; no generated `product_name`, `product_image`, or `product_price` columns exist.
- `OrderItemMapper.xml` joins live product data with snapshot fallbacks for order item display.
- Current product `image_url` storage is `TEXT`, and `Product.imageUrl` is a Java `String` backed by `@Column(columnDefinition = "TEXT")`.
- `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order item snapshot report | CURRENT_SOURCE_COVERED / NO DEDICATED E2E | Keep normal checkout, customer order detail, admin order detail, and shipping-label item display smoke coverage. No generated-column path exists to exercise. |
| Product image URL width report | CURRENT_SOURCE_COVERED / NO DEDICATED E2E | Keep normal product create/edit/import and public image rendering smoke coverage. No current `products.image_url VARCHAR(500)` mismatch exists. |

## 2026-06-10 00:51 UTC QA F9326/F9334/F9350 Order Pagination and Wishlist Timestamp Handoff

Source status: QA F9326 WONTFIX / CURRENT_SOURCE_COVERED / PAGINATION_GUARDED; QA F9334 WONTFIX / CURRENT_SOURCE_NON_ISSUE / TIMESTAMP_FALLBACK_INTENTIONAL; QA F9350 SOURCE_FIXED / WISHLIST_UPDATED_AT_ADDED / EXISTING_DB_MIGRATION_HARDENED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Customer order endpoints use paged service calls and expose `X-Order-Page`, `X-Order-Page-Size`, `X-Order-Total`, `X-Order-Total-Pages`, and `X-Order-Has-Next`.
- `OrderService.getOrdersByUserId(userId,page,size)` uses `findByUserIdPage(userId, offset, safeSize)` instead of unbounded customer-order loads.
- `WishlistService.addToWishlist(...)` sets both `createdAt` and `updatedAt`.
- Fresh schema/V1 add `wishlist.updated_at`; V7/startup hardening add/backfill it for existing databases.
- `./mvnw -q -Dtest=WishlistServiceTest,CommerceSchemaContractTest,OrderControllerCustomerPaginationTest,OrderStatsServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer order pagination | CURRENT_SOURCE_COVERED / ORDER E2E PENDING | In a user account with more orders than one page, request `/orders/me?page=0&size=20` and `/orders/me?page=1&size=20`; verify no duplicate first-page rows, headers are correct, and Profile/Support order consumers render normally. |
| Wishlist fresh schema | SOURCE_FIXED / DB E2E PENDING | Build a fresh MySQL-compatible schema and verify `wishlist.updated_at` exists with `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. |
| Wishlist existing database repair | SOURCE_FIXED / DB E2E PENDING | Run V7/startup hardening on an existing database without `wishlist.updated_at`; verify the column is added, existing rows are backfilled, and rerunning is idempotent. |
| Wishlist UI/API smoke | SOURCE_FIXED / WISHLIST E2E PENDING | Add/remove/re-add a product from favorites/wishlist and verify API responses and UI state remain unchanged while the persisted row has both created and updated timestamps. |

## 2026-06-10 00:45 UTC QA F9332/F9333/F9335 Stale Schema/Mapper Report Handoff

Source status: QA F9332 WONTFIX / CURRENT_SOURCE_INTENTIONAL / REGRESSION_GUARD_ADDED; QA F9333 WONTFIX / CURRENT_SOURCE_COVERED / STALE_REGION_REPORT / REGRESSION_GUARD_ADDED; QA F9335 WONTFIX / CURRENT_SOURCE_COVERED / STALE_BRAND_MAPPER_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Product descriptions remain `TEXT`, matching `Product.description` TEXT storage and application-level length validation for ordinary product copy.
- Current address storage uses `user_addresses` and does not contain a standalone `addresses` table or `region VARCHAR(255)` column.
- Brand persistence uses `BrandRepository extends JpaRepository<Brand, Long>`; no `BrandMapper.xml` or MyBatis `selectKey` path exists.
- `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product description storage report | CURRENT_SOURCE_INTENTIONAL / NO DEDICATED E2E | Keep normal admin product create/edit/import and public product-detail smoke coverage. No runtime change was made for this report. |
| Address region report | CURRENT_SOURCE_NON_ISSUE / NO DEDICATED E2E | Keep normal Profile address add/edit/default smoke coverage. No `addresses.region` field exists to exercise. |
| BrandMapper selectKey report | CURRENT_SOURCE_NON_ISSUE / NO DEDICATED E2E | Keep normal brand admin CRUD smoke coverage. No MyBatis BrandMapper route exists to exercise. |

## 2026-06-10 00:43 UTC QA F9351 Product Fulltext Index Handoff

Source status: QA F9351 SOURCE_FIXED / FULLTEXT_INDEX_ADDED / EXISTING_DB_MIGRATION_HARDENED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Fresh schema and Flyway baseline define `FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)`.
- V7/startup hardening add `idx_products_search_text` idempotently for existing databases.
- Current product search semantics were not rewritten in this pass; the fix adds the missing commercial schema/index contract for the existing keyword fields.
- `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Fresh database index | SOURCE_FIXED / DB E2E PENDING | Build a fresh MySQL-compatible schema and verify `SHOW INDEX FROM products WHERE Key_name='idx_products_search_text'` reports a fulltext index covering `name`, `description`, `brand`, and `tag`. |
| Existing database migration | SOURCE_FIXED / DB E2E PENDING | Run V7/startup hardening on an existing database without the index. Verify `idx_products_search_text` is created once and rerunning migration/startup is idempotent. |
| Product search smoke | SOURCE_FIXED / SEARCH E2E PENDING | Search public catalog terms that match product name, description, brand, and tag. Verify returned products and pagination remain correct after the schema/index change. Capture query-plan/index evidence if the E2E environment supports it. |

## 2026-06-10 00:40 UTC QA F9340 Coupon Usage Counter Handoff

Source status: QA F9340 SOURCE_FIXED / USAGE_COUNTER_ADDED / TRANSACTION_GUARD_HARDENED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Fresh schema and Flyway baseline add `coupons.used_count INT NOT NULL DEFAULT 0`.
- V7/startup hardening add `used_count` for existing databases and backfill it from `user_coupons.status='USED'`.
- `CouponService.useCoupon(...)` increments the coupon usage counter only after the `user_coupons` row changes from `UNUSED` to `USED`.
- `CouponService.releaseUsedCoupon(...)` decrements the counter only when a previously `USED` user coupon is released back to `UNUSED`.
- `./mvnw -q -Dtest=CouponServiceTest,CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Existing database counter repair | SOURCE_FIXED / DB E2E PENDING | In an upgraded MySQL-compatible database with mixed `USED` and `UNUSED` user-coupon rows, run V7/startup hardening and verify `coupons.used_count` equals the count of used rows per coupon. Re-run to verify idempotence. |
| Coupon redemption checkout | SOURCE_FIXED / CHECKOUT/API E2E PENDING | Claim or grant a coupon, use it during checkout, and verify the order records the coupon while `user_coupons.status` becomes `USED` and `coupons.used_count` increments once. Repeat the same user coupon and verify the counter does not double-increment. |
| Coupon release/cancellation | SOURCE_FIXED / CHECKOUT/API E2E PENDING | Exercise the order-cancel or payment-expiry path that releases a used coupon. Verify the user coupon returns to `UNUSED`, the order no longer holds the coupon where expected, and `coupons.used_count` decrements without going below zero. |

## 2026-06-10 00:34 UTC QA F9342 Review Status Stale-Report Handoff

Source status: QA F9342 WONTFIX / CURRENT_SOURCE_COVERED / STALE_NUMERIC_STATUS_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current fresh schema and Flyway baseline use `status VARCHAR(20) NOT NULL DEFAULT 'PENDING'` for reviews.
- Current review schema constrains statuses to `PENDING`, `APPROVED`, and `HIDDEN`.
- `ReviewServiceImpl.addReview(...)` explicitly sets new reviews to `PENDING`.
- `CommerceSchemaContractTest` and `ReviewServiceTest` now guard those contracts.
- `./mvnw -q -Dtest=CommerceSchemaContractTest,ReviewServiceTest,UserAddressServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public review creation | CURRENT_SOURCE_COVERED / REVIEW E2E OPTIONAL | Submit a valid product review for a completed order and verify the review is created as pending moderation, visible only where pending-current-user reviews are intentionally shown, and not counted as an approved public review until moderated. |
| Admin review moderation | CURRENT_SOURCE_COVERED / ADMIN REVIEW E2E OPTIONAL | Approve and hide a pending review in admin. Verify the status transitions remain `APPROVED`/`HIDDEN`, public review lists and counts update accordingly, and no numeric status values appear in API responses. |

## 2026-06-10 00:31 UTC QA F9341 Default Address Uniqueness Handoff

Source status: QA F9341 SOURCE_FIXED / DB_CONSTRAINT_ADDED / SERVICE_GUARD_HARDENED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Fresh schema and Flyway baseline add `default_user_id` as a generated column that is `user_id` only when `is_default=true`.
- Fresh schema and Flyway baseline add `UNIQUE KEY uk_user_addresses_one_default(default_user_id)`, allowing many non-default rows and only one default row per user.
- V7/startup hardening backfill `default_user_id`, normalize duplicate legacy defaults by keeping the highest id per user, and add the unique key idempotently.
- `UserAddressService.updateAddress(...)` clears existing defaults when an update marks an address as default.
- `./mvnw -q -Dtest=CommerceSchemaContractTest,UserAddressServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Upgraded duplicate defaults | SOURCE_FIXED / DB E2E PENDING | In an upgraded MySQL-compatible database with two `is_default=true` address rows for one user, run V7/startup hardening. Verify one row remains default, `uk_user_addresses_one_default` exists, and rerunning is idempotent. |
| Address default UI/API | SOURCE_FIXED / PROFILE/API E2E PENDING | Add multiple addresses, set each as default through Profile/API, update an address with `isDefault=true`, and verify exactly one default address remains visible and persisted for the user after reload. |
| Direct duplicate protection | SOURCE_FIXED / DB E2E OPTIONAL | Attempt to insert or update a second `is_default=true` row for the same user directly in a disposable database. Verify the unique key rejects the duplicate while additional non-default addresses still save. |

## 2026-06-10 00:26 UTC QA F9339 Order Total Decimal Stale-Report Handoff

Source status: QA F9339 WONTFIX / CURRENT_SOURCE_COVERED / STALE_TOTAL_PRICE_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current fresh schema and Flyway baseline use `total_amount DECIMAL(10,2) NOT NULL` for orders.
- Current order schema does not define `total_price`, and does not define `total_amount FLOAT`.
- `Order.totalAmount` is a `BigDecimal`.
- `CommerceSchemaContractTest` now guards those schema/entity contracts.
- `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout/order total smoke | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | Keep normal registered and guest checkout smoke coverage for cart subtotal, coupon discount, shipping fee, created order total, payment amount, and admin/customer order total display. No current `total_price FLOAT` column exists to exercise directly. |

## 2026-06-10 00:23 UTC QA F9346 Order Status Index Handoff

Source status: QA F9346 SOURCE_FIXED / EXISTING_DB_MIGRATION_HARDENED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Fresh schema and Flyway baseline already define `idx_orders_status_created(status, created_at)`.
- Startup hardening already adds `idx_orders_status_created(status, created_at)` when missing.
- V7 existing-database repair now also adds `idx_orders_status_created(status, created_at)` idempotently when missing.
- `CommerceSchemaContractTest` guards the index across `schema.sql`, `V1__init.sql`, `CommerceSchemaConfig`, and `V7__commercial_schema_contract.sql`.
- `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Existing database migration | SOURCE_FIXED / DB E2E PENDING | Run V7/startup hardening against an upgraded MySQL-compatible database that lacks `idx_orders_status_created`. Verify the index is created once on `(status, created_at)` and rerunning migration/startup is idempotent. |
| Admin status queue smoke | SOURCE_FIXED / ADMIN API/UI E2E PENDING | Seed orders across several statuses, open Admin Orders with status filters such as `PENDING_PAYMENT`, `PENDING_SHIPMENT`, and return statuses, and verify rows and pagination still load correctly. Capture query plan/index usage if the E2E environment supports it. |

## 2026-06-10 00:19 UTC QA F9330 OrderManagement itemsJson Stale-Report Handoff

Source status: QA F9330 WONTFIX / CURRENT_SOURCE_COVERED / STALE_ITEMSJSON_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current `OrderManagement.tsx` has no `itemsJson` reference and no `JSON.parse(...)` call.
- Admin order detail and shipping-label flows load typed `OrderItem[]` through `adminApi.getOrderItems(order.id)`.
- `OrderManagement.test.ts` now rejects the stale `itemsJson`/`JSON.parse(...)` path and requires the typed admin order-item API/detail-table contract.
- `CI=true npm test -- --runTestsByPath src/pages/OrderManagement.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (5/5).

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin order detail items | CURRENT_SOURCE_COVERED / ADMIN UI E2E OPTIONAL | Open Admin Orders, view an order with items, and verify the detail modal loads item rows from the admin order-item API without console errors. Include an order whose item API returns an empty array to verify the modal stays stable. |
| Shipping-label items | CURRENT_SOURCE_COVERED / ADMIN UI E2E OPTIONAL | Print a shipping label for an order with and without item rows. Verify the label renders item rows or the no-item fallback without relying on an inline `itemsJson` payload. |

## 2026-06-10 00:16 UTC QA F9352 Production TestController Stale-Report Handoff

Source status: QA F9352 WONTFIX / CURRENT_SOURCE_COVERED / STALE_CONTROLLER_REPORT / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Current production controller source has no `TestController.java` and no controller class ending in `TestController`.
- Current production controller source has no bare `/test` route mapping.
- `SecurityConfig` keeps the explicit public allow-list followed by `.anyRequest().authenticated()` for unlisted routes.
- `./mvnw -q -Dtest=ProductionControllerSurfaceContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Production test-controller report | CURRENT_SOURCE_NON_ISSUE / NO DEDICATED E2E | No reported `TestController` endpoint exists to exercise. Keep normal public/protected route smoke coverage and file a new issue if any production `/test` endpoint appears in deployment route inventory. |

## 2026-06-10 00:10 UTC QA F9349 Pet Gallery Mobile Owner Label Handoff

Source status: QA F9349 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- The report's `.overlay-title` selector is stale; current Pet Gallery image-card owner labels use `.pet-gallery-card__owner`.
- Added final mobile CSS so `.pet-gallery-card__owner` uses 14px text, a 32px minimum label height, centered inline-flex alignment, stronger dark-green overlay contrast, and stable line-height on phone widths.
- `PetGallery.test.ts` now guards the current owner-label markup and F9349 mobile CSS contract while rejecting the stale `.overlay-title` selector.
- `CI=true npm test -- --runTestsByPath src/pages/PetGallery.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (3/3).
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet Gallery phone cards | SOURCE_FIXED / MOBILE UI E2E PENDING | Open `/pet-gallery` at 320px, 360px, and 390px wide. Verify the owner badge on each photo card is readable, not clipped, and maintains enough contrast over bright and dark pet images. |
| Pet Gallery mobile WebView | SOURCE_FIXED / ANDROID WEBVIEW E2E OPTIONAL | In the Android/WebView app, open Pet Gallery and verify owner badges remain readable with mobile contrast guard styling and do not collide with like/delete controls. |

## 2026-06-09 23:56 UTC QA F3514 App Utility Chunking Handoff

Source status: QA F3514 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `App.tsx` no longer statically imports `./utils/mobileContrastGuard` or `./utils/androidUiFinalGuard`.
- `loadMobileContrastGuard` and `loadAndroidUiFinalGuard` dynamically import the native/mobile UI guard utilities outside the main App import list.
- Guard install/refresh effects preserve cleanup behavior, cancel route-change RAF/timers, and report non-blocking dynamic-import failures.
- `CI=true npm test -- --runTestsByPath src/App.test.tsx src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (18/18, existing React act deprecation warning only).
- `npx tsc --noEmit --pretty false` passed.
- Follow-up on 2026-06-10 removed the stale unused `sanitizeAttributes` helper that previously blocked CI-mode production builds.
- `CI=true npm test -- --runTestsByPath src/utils/sanitizeHtml.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (11/11).
- `BUILD_PATH=/tmp/shoptest-f3514-ci-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with the existing Browserslist freshness advisory and bundle-size advisory only.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Desktop storefront/admin initial load | SOURCE_FIXED / BROWSER E2E PENDING | Open Home and an admin route on desktop, verify route loading still resolves normally, support/cart overlays remain usable, and there is no visible delay or console error from the deferred guard modules. |
| Android WebView native guard install | SOURCE_FIXED / ANDROID WEBVIEW E2E PENDING | Launch the native Android/WebView app, verify mobile contrast and Android UI guard styling still applies after bootstrap, and confirm no blank screen or layout flash occurs while the guard chunks load. |
| Mobile route-change guard refresh | SOURCE_FIXED / ANDROID WEBVIEW E2E PENDING | Navigate between Home, Product List, Product Detail, Cart, Checkout, and Profile in the WebView app. Verify contrast fixes, bottom navigation, overlays, and safe-area layout refresh correctly after each route change. |

## 2026-06-09 23:51 UTC QA F3513 Active Announcement API Cache Handoff

Source status: QA F3513 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `announcementApi.getActive(...)` now uses the shared frontend API `cachedGet(...)` helper with a 15s TTL and a cache key based on normalized `limit`.
- Repeated active-announcement reads during storefront bootstrap/render reuse the cached response instead of issuing duplicate GETs.
- Admin announcement create/update/delete paths clear the active-announcement cache so CMS edits can refresh public banners.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (86/86).
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront active announcements repeat load | SOURCE_FIXED / STOREFRONT API E2E PENDING | Open the storefront Home page, trigger a route away/back or refresh behavior that re-reads active announcements within 15s, and verify the UI remains stable without duplicate visible banner flicker or duplicate network reads for the same limit. |
| Admin announcement edit invalidation | SOURCE_FIXED / ADMIN+STOREFRONT E2E PENDING | In Admin Announcements, update or create an active announcement, return to the storefront, and verify the active banner list can refresh after the mutation instead of staying pinned to the pre-edit response. |
| Announcement limit normalization | SOURCE_FIXED / API E2E OPTIONAL | Request active announcements through UI/API paths that use oversized limits and verify the public request remains capped at 10 while cached reads for the same normalized limit behave consistently. |

## 2026-06-09 23:45 UTC QA RACE-009/RACE-010 Visitor/User Report Stale-Report Handoff

Source status: QA RACE-009/RACE-010 WONTFIX / CURRENT_SOURCE_NON_ISSUE_OR_COVERED / STALE_IMPL_PATH / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current source has no `src/main/java/com/example/shop/service/impl/VisitorServiceImpl.java`, no `getConcurrentVisitors(...)`, no `UV_THRESHOLD_VISITORS` / `MAX_CONCURRENT_VISITORS`, and no Redis `visitors:{date}:...` key path.
- Current traffic control is handled by `RateLimitService`; local buckets update through `buckets.compute(...)`, Redis buckets use atomic `redis.opsForValue().increment(key)`, and request counters are `AtomicLong` telemetry.
- Current source has no `src/main/java/com/example/shop/service/impl/UserServiceImpl.java`, no `getReportSummary(...)`, and no `countUsersByDateRange(...)`.
- Current admin user summary calls one `UserMapper.adminSummary(...)` SQL select with `COUNT(*)` plus `SUM(CASE WHEN ...)` buckets.
- `./mvnw -q -Dtest=RateLimitServiceTest,UserServiceTest test` passed with the existing expected Redis-failure fallback warning in `RateLimitServiceTest`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public traffic burst telemetry | CURRENT_SOURCE_COVERED / TRAFFIC API E2E OPTIONAL | Send repeated requests to one normalized public path, verify rate limiting decisions are stable, and confirm `/admin/traffic-control/status` reports accepted/rejected counters and hot buckets without depending on visitor-date Redis keys. |
| Redis-backed rate limit smoke | CURRENT_SOURCE_COVERED / OPS/API E2E OPTIONAL | In a Redis-enabled disposable environment, send repeated requests for the same client/path and verify the limit is enforced through rate-limit keys rather than any `visitors:{date}:...` key. |
| Admin user summary refresh | CURRENT_SOURCE_COVERED / ADMIN API+UI E2E OPTIONAL | Load the admin users page with keyword/role/status filters, compare the summary cards with the table scope, and verify refreshes return a coherent single summary response while user records change. |

## 2026-06-09 23:42 UTC QA RACE-007/RACE-008 Review/Search Cache Stale-Report Handoff

Source status: QA RACE-007/RACE-008 WONTFIX / CURRENT_SOURCE_NON_ISSUE_OR_COVERED / STALE_IMPL_PATH / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current source has no `ReviewServiceImpl.updateProductReviewStats(...)`, no `updateProductScore(...)`, and no persisted product review-score writeback from review submission or moderation status changes.
- Product review display aggregates are transient `Product` fields (`positiveRate`, `averageRating`, `reviewCount`) populated by `ProductServiceImpl` from `reviewRepository.summarizeApprovedReviewsByProductIds(...)` during product reads.
- Current source has no `src/main/java/com/example/shop/service/impl/ProductSearchServiceImpl.java`, no `searchHot`, no `trending:hot`, and no startup cache warmup path.
- Product search caching uses `ProductServiceImpl.getCachedProducts(...)`, `product.search-cache-ttl-ms`, `productSearchCacheLock`, and bounded `product.search-cache-max-entries` eviction.
- `./mvnw -q -Dtest=ReviewServiceTest,ProductSearchServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Approved review aggregate display | CURRENT_SOURCE_COVERED / REVIEW UI E2E OPTIONAL | Create or seed two approved reviews for one product, refresh product list/detail, and verify visible rating/count reflect approved reviews only. Add a pending review and verify it does not change public aggregates until approved. |
| Review moderation refresh | CURRENT_SOURCE_COVERED / ADMIN+PUBLIC E2E OPTIONAL | In admin reviews, approve a pending review, then reload the affected public product surfaces and verify the displayed rating/count updates without requiring any product-score writeback job. |
| Search cache hot-key startup smoke | CURRENT_SOURCE_COVERED / OPS/API E2E OPTIONAL | Restart a disposable backend and issue repeated public product/search requests for the same query. Verify the app serves results normally and does not require or create a Redis `trending:hot` startup warmup key. |

## 2026-06-09 23:35 UTC QA RACE-005/RACE-006 Payment Callback/Expiry Stale-Report Handoff

Source status: QA RACE-005/RACE-006 WONTFIX / CURRENT_SOURCE_COVERED / STALE_IMPL_PATH / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Current source has no `src/main/java/com/example/shop/service/impl/PayServiceImpl.java`; payment completion and expiry are handled by `PaymentService` and `OrderService`.
- Generic callbacks and Stripe webhooks claim an order through `orderRepository.updateStatusIfCurrent(orderId, "PENDING_PAYMENT", "PENDING_SHIPMENT")`.
- `PaymentMapper.markPaidDetailed(...)` only marks payment rows still in `PENDING`.
- Payment expiry calls `OrderService.cancelOrderForPaymentExpiry(...)`, which CAS-updates the order from `PENDING_PAYMENT` to `CANCELLED` before stock restoration.
- The current expiry path does not delete paid orders, and a callback that already moved the order forward prevents expiry stock rollback.
- `./mvnw -q -Dtest=PaymentFlowServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Duplicate provider callback | CURRENT_SOURCE_COVERED / PAYMENT API E2E OPTIONAL | Send the same successful provider callback twice for one pending order. Verify one transition to paid/shipment state, one paid payment record state, and no duplicate customer notifications or cart/order side effects. |
| Stripe webhook replay | CURRENT_SOURCE_COVERED / PAYMENT API E2E OPTIONAL | Replay a valid `checkout.session.completed` webhook for the same payment. Verify replay is idempotent and does not create duplicate order/payment side effects. |
| Expiry versus payment race | CURRENT_SOURCE_COVERED / PAYMENT API E2E OPTIONAL | In a disposable environment, trigger payment expiry and successful callback close together. Verify the final order is either paid/shipment or cancelled, never deleted after payment, and stock rollback happens only when cancellation wins. |

## 2026-06-09 23:33 UTC QA RACE-003/RACE-004 Checkout Stock Race Stale-Report Handoff

Source status: QA RACE-003/RACE-004 WONTFIX / CURRENT_SOURCE_COVERED / STALE_IMPL_PATH / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Current source has no `src/main/java/com/example/shop/service/impl/OrderServiceImpl.java`; checkout stock reservation is handled by `src/main/java/com/example/shop/service/OrderService.java`.
- Registered checkout loads product rows for reservation and locks selected cart rows with `cartItemMapper.findByIdsForUpdate(...)` before stock mutation.
- Guest checkout loads product rows through `productRepository.findAllByIdForUpdate(productIds)` before stock mutation.
- `ProductRepository.findAllByIdForUpdate(...)` and `findByIdForUpdate(...)` use pessimistic write locks.
- Legacy `ProductMapper.decreaseStock(...)` still includes `WHERE id = #{productId} AND stock >= #{quantity}`.
- `./mvnw -q -Dtest=OrderStockReservationServiceTest,PaymentFlowServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Concurrent registered checkout for one low-stock SKU | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | In a disposable environment, create one product with stock 1, add it to two authenticated carts, submit checkout near-simultaneously, and verify only one order reserves stock while the other receives an insufficient-stock response. |
| Concurrent guest checkout for one low-stock SKU | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | Repeat the same low-stock race through guest checkout and verify stock never goes negative and only one order succeeds. |
| Variant stock checkout race | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | For a product with variant-only stock, race two checkouts against the same selected specs and verify variant stock does not go below zero. |

## 2026-06-09 23:30 UTC QA RACE-001/RACE-002 Cart Slice Stale-Report Handoff

Source status: QA RACE-001/RACE-002 WONTFIX / CURRENT_SOURCE_NON_ISSUE / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Current frontend source has no `src/store/slices/cartSlice.ts`, no Redux cart slice, no `mergeServerCart`, and no `syncQuantityToServer`.
- `Cart.tsx` and `CartDrawer.tsx` use the shared `useCartQuantitySync` hook for authenticated quantity updates.
- The shared hook debounces rapid edits per item, versions requests through `quantityRequestVersionRef`, ignores stale/unmounted continuations, and consumes background promise rejections.
- Existing focused tests cover rapid edits syncing only the final value and source contracts that Cart/CartDrawer use the shared hook.
- `CI=true npm test -- --runTestsByPath src/hooks/useCartQuantitySync.test.tsx src/utils/cartTimerCleanup.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (2 suites / 10 tests; existing React act deprecation warning only).

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Rapid authenticated cart quantity edits | CURRENT_SOURCE_COVERED / CART UI E2E OPTIONAL | As an authenticated shopper, quickly click `+`/`-` on one cart item several times. Verify the final visible quantity remains stable after sync, no older server response overwrites it, and checkout carries the final quantity. |
| Cart reload after quantity sync | CURRENT_SOURCE_COVERED / CART UI E2E OPTIONAL | Change a cart quantity, wait for sync, refresh the cart page, and verify the persisted server quantity matches the final visible value. |
| Guest cart quantity edits | CURRENT_SOURCE_COVERED / CART UI E2E OPTIONAL | Repeat rapid quantity edits as a guest shopper and verify local cart state stays normalized, within stock limits, and persists across page refresh. |

## 2026-06-09 23:25 UTC F9010 Admin Debug Logging Auto-Restore Handoff

Source status: TEST F9010 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Debug logging defaults now allow only `com.example.shop`; framework loggers are not toggled by default.
- `admin.logs.additional-debug-loggers` defaults to empty, so `org.mybatis`, `org.springframework.web`, and `org.springframework.security` are no longer fanned out unless explicitly configured.
- Enabling DEBUG schedules an automatic INFO restore after `admin.logs.debug-auto-restore-minutes`, default 15 minutes; disabling DEBUG cancels the pending restore.
- `PUT /admin/logs/debug` still requires `logs:debug`, and non-`com.example.shop` logger targets additionally require `ROLE_SUPER_ADMIN`.
- `./mvnw -q -Dtest=LogManagementServiceTest,AdminLogManagementControllerTest,ApplicationProfileContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Application logger debug toggle | SOURCE_FIXED / ADMIN API+UI E2E PENDING | As an admin with `logs:debug`, toggle DEBUG for `com.example.shop` or a `com.example.shop.*` logger. Verify it succeeds and only app logger scope changes. |
| Framework/system logger gate | SOURCE_FIXED / SECURITY API E2E PENDING | With a non-super admin holding `logs:debug`, attempt to toggle `org.mybatis`, `org.springframework.web`, or `org.springframework.security` when those loggers are explicitly configured. Verify 403. Repeat as super admin and verify it is allowed only when configuration explicitly allows the logger. |
| Auto-restore timeout | SOURCE_FIXED / OPS E2E PENDING | In a disposable environment with a short `ADMIN_LOGS_DEBUG_AUTO_RESTORE_MINUTES` override, enable DEBUG and verify the logger returns to INFO automatically after the configured interval. Verify manually disabling DEBUG cancels the pending restore. |
| Default fan-out absence | SOURCE_FIXED / OPS E2E OPTIONAL | In default config, toggle app DEBUG and inspect effective log levels. Verify framework/security/MyBatis loggers are not changed. |

## 2026-06-09 23:19 UTC F9009 Actuator Health Subpath Handoff

Source status: TEST F9009 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Public actuator access now permits exact `GET /actuator/health` and `/actuator/info` only.
- `/actuator/health/**` was removed from the anonymous security rule, so component health subpaths require authentication.
- Base config defaults `management.endpoint.health.show-details` to `never`; production profile pins it to `never`.
- `./mvnw -q -Dtest=SecurityConfigCorsTest,ApplicationProfileContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public root health | SOURCE_FIXED / OPS API E2E PENDING | Without authentication, call exact `GET /actuator/health`. Verify it remains reachable for load balancer/smoke checks and does not include component details. |
| Public health subpath rejection | SOURCE_FIXED / SECURITY API E2E PENDING | Without authentication, call `/actuator/health/db`, `/actuator/health/redis`, and another `/actuator/health/{component}` path. Verify they return 401/403 and do not expose component details. |
| Production health details | SOURCE_FIXED / OPS API E2E PENDING | In production profile, verify effective `management.endpoint.health.show-details=never` and root health returns aggregate health only. |

## 2026-06-09 23:17 UTC F9008 System Status Detail Reduction Handoff

Source status: TEST F9008 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `/admin/system/status` and `/admin/system/readiness` now require `ROLE_SUPER_ADMIN` plus the existing `system:status` permission.
- Public status/readiness payloads now expose only top-level health fields and component health flags for database, Redis, Nacos, and production config.
- Database URLs/drivers/errors, Redis host/port/db/ping/errors, Nacos address/namespace/group/dataId/warnings/errors, runtime/JVM/OS, disk path, memory, and production config issue/check details are omitted from the API response.
- `frontend/src/types.ts` accepts the reduced payload, and System Monitor keeps fallback rendering.
- `./mvnw -q -Dtest=AdminSystemControllerTest test` passed.
- `npm test -- --runTestsByPath src/pages/SystemMonitor.test.ts src/api/index.test.ts --watchAll=false --runInBand` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Non-super admin status access | SOURCE_FIXED / SECURITY API E2E PENDING | Log in as an admin role that has `system:status` but is not `SUPER_ADMIN`. Verify `/admin/system/status` and `/admin/system/readiness` return 403 and no status body. |
| Super admin reduced status payload | SOURCE_FIXED / SECURITY API E2E PENDING | Log in as super admin and call both endpoints. Verify response includes only status/healthy/ready/checkedAt plus component health flags; it must not include JDBC URLs, DB driver, Redis host/port/db/ping, Nacos address/namespace/group/dataId, runtime/JVM/OS, disk path, memory, errors, warnings, production config checks, or secret-like text. |
| Degraded dependency status | SOURCE_FIXED / OPS API E2E OPTIONAL | In a controlled environment with one dependency unavailable, verify the response still reports the affected component as DOWN/UNAVAILABLE and top-level readiness correctly, without exposing failure exception text or endpoint details. |
| System Monitor UI fallback | SOURCE_FIXED / ADMIN UI E2E OPTIONAL | Open System Monitor as super admin and verify the page remains readable with reduced detail fields shown as `-` while overall/component health tags are still visible. |

## 2026-06-09 23:10 UTC F9007 Strong Password Policy Handoff

Source status: TEST F9007 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Backend password creation/change paths now require 12-128 characters, reject common passwords, and require at least three of four character classes: lowercase, uppercase, numbers, and non-whitespace symbols.
- The backend service enforcement covers customer registration, admin bootstrap, forgot-password reset, and profile password change.
- Registration, forgot-password, and profile password form validation now use the shared frontend `passwordPolicy.ts` helper for the same common-password and 3-of-4 class checks.
- en/zh/es validation copy was updated for the stronger policy.
- `./mvnw -q -Dtest=UserServiceTest,AuthControllerRegisterTest,AuthControllerForgotPasswordTest,UserControllerAdminBootstrapTest test` passed.
- `npm test -- --runTestsByPath src/utils/passwordPolicy.test.ts src/pages/Register.test.tsx src/pages/ForgotPassword.test.ts src/pages/Profile.test.ts src/i18n.test.ts src/api/index.test.ts --watchAll=false --runInBand` passed with existing React/React Router warning noise only.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Registration weak password rejection | SOURCE_FIXED / AUTH UI+API E2E PENDING | On Register, try `Password1`, `lowercase1234`, and `Password1234`. Verify client-side copy blocks them where applicable and direct API calls reject them without creating an account. Then verify `StrongPass123` or `StrongPass123!` registers successfully when the rest of the payload is valid. |
| Forgot-password reset policy | SOURCE_FIXED / AUTH UI+API E2E PENDING | Complete the reset-code flow and verify weak/common new passwords are rejected while a 12+ character 3-class non-common password resets successfully. Confirm the user can log in afterward. |
| Profile password change policy | SOURCE_FIXED / ACCOUNT UI+API E2E PENDING | As an authenticated customer, open Change Password and verify weak/common new passwords are rejected before submission or by API, while a valid strong password succeeds and old-password mismatch behavior remains unchanged. |
| Admin bootstrap password policy | SOURCE_FIXED / ADMIN BOOTSTRAP E2E OPTIONAL | In a disposable empty-admin environment, verify admin bootstrap rejects weak/common admin passwords and accepts a non-common 12+ character 3-class password. |

## 2026-06-09 23:00 UTC F9006 Admin User Update DTO Handoff

Source status: TEST F9006 FIXED / DUPLICATE_COVERED_BY_F2812 / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- `PUT /admin/users/{id}` still accepts `@Valid AdminUserUpdateRequest`, not the raw `User` entity.
- `AdminUserUpdateRequest` exposes only `status` and `address`.
- Unsupported JSON fields are captured through `@JsonAnySetter` and rejected before the controller loads or persists the target user.
- The broader admin user-edit regression matrix remains documented under the F2812 handoff.
- `./mvnw -q -Dtest=SecurityConfigCorsTest,ApplicationProfileContractTest,AdminRequestValidationContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Crafted admin user update payload | SOURCE_FIXED / SECURITY API E2E PENDING | As an authenticated admin, send `PUT /admin/users/{id}` with unsupported identity/role fields such as `email`, `phone`, `role`, `roleCode`, `id`, password, or timestamps plus optional valid `address`/`status`. Verify the API returns controlled 400 and none of those unsupported fields mutate. |
| Allowed status/address update | SOURCE_FIXED / ADMIN API E2E PENDING | With the needed permissions, update only `address` and/or allowed `status` values. Verify the update still succeeds and the response contains only the intended mutation. |
| Admin user-edit UI | SOURCE_FIXED / ADMIN UI E2E PENDING | Open Admin User Management and verify username/email/phone/role identity fields are not submitted through the profile update form; address/status behavior should match the permitted API contract. |

## 2026-06-09 23:00 UTC F9005 CORS Private-LAN Defaults Handoff

Source status: TEST F9005 SOURCE_FIXED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Base and development CORS defaults exclude `10.*`, `172.*`, and `192.168.*` private-LAN wildcard origins.
- Non-production fallback in `CorsOriginProperties` is loopback-only unless an explicit env override is provided.
- Production filtering rejects wildcard, local, private, and non-HTTPS origins before registering them.
- `SecurityConfig` keeps credentialed CORS without enabling private-network CORS grants.
- `./mvnw -q -Dtest=SecurityConfigCorsTest,ApplicationProfileContractTest,AdminRequestValidationContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Private-LAN origin rejection | SOURCE_FIXED / SECURITY API E2E PENDING | In staging or production-like runtime without override, send credentialed preflight requests from `http://10.0.0.5:3000`, `http://172.16.0.5:3000`, and `http://192.168.1.55:3000`. Verify no credentialed allow-origin header and no private-network grant are returned. |
| Configured HTTPS origin allowlist | SOURCE_FIXED / SECURITY API E2E PENDING | Send credentialed preflight and a simple authenticated request from the configured HTTPS storefront/admin origins. Verify only those origins receive the expected CORS allow-origin, credential, and exposed request/rate-limit headers. |
| Explicit device-test override | SOURCE_FIXED / OPS E2E OPTIONAL | In a disposable dev environment, set `CORS_ALLOWED_ORIGIN_PATTERNS` to one concrete LAN origin and verify only that exact origin works; broad subnet wildcard defaults must remain absent. |

## 2026-06-09 22:52 UTC F9004 WebSocket JWT Subprotocol Handoff

Source status: TEST F9004 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Added `POST /support/websocket-ticket` for authenticated clients to exchange the bearer JWT for a short-lived, single-use opaque WebSocket ticket.
- Support WebSocket handshakes now accept `ticket.<opaque-ticket>` and no longer decode `auth.<base64url JWT>` from `Sec-WebSocket-Protocol`.
- The consumed ticket carries the access-token JTI onto the socket, preserving the existing active-socket token revocation close path.
- Customer and admin support clients now fetch a fresh ticket before each connect/reconnect and send only `support.v1` plus `ticket.<ticket>` as WebSocket subprotocols.
- `./mvnw -q -Dtest=SupportWebSocketTicketServiceTest,SupportWebSocketHandlerAuthenticationTest,SupportWebSocketHandlerAdminPayloadTest,SupportControllerAdminResponseTest,SecurityConfigCorsTest test` passed.
- `npm test -- --runTestsByPath src/api/index.test.ts src/hooks/useReconnectingWebSocket.test.tsx src/components/CustomerSupportWidget.test.tsx src/pages/SupportManagement.test.tsx --watchAll=false --runInBand` passed with existing React `act` warning noise only.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer support WebSocket connect | SOURCE_FIXED / BROWSER E2E PENDING | Log in as a customer, open the support widget, and inspect the WebSocket handshake. Verify `Sec-WebSocket-Protocol` contains `support.v1` and `ticket.<opaque>`, never `auth.<JWT>` or a bearer token. Confirm messages still send/receive. |
| Admin support WebSocket connect | SOURCE_FIXED / BROWSER E2E PENDING | Log in as an admin with support access, open Support Management, and verify the same ticket-only subprotocol behavior while live session updates still arrive. |
| Ticket replay and reconnect | SOURCE_FIXED / API/E2E PENDING | Attempt to reuse an already-consumed ticket for a second WebSocket connection and verify it is rejected. Then force a reconnect from the UI and verify the client obtains a fresh ticket before reconnecting. |
| Token revocation | SOURCE_FIXED / API/E2E OPTIONAL | Connect support WebSocket, revoke/logout the access token, and verify the active socket closes through the existing token-revocation path. |

## 2026-06-09 22:39 UTC F9003 Guest Credential Query-Param Handoff

Source status: TEST F9003 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Guest order reads now use `POST /orders/guest/{id}` and `POST /orders/guest/{id}/items` with body credentials, not query params.
- Guest payment reads now use `POST /payments/guest/order/{orderId}` and `POST /payments/guest/order/{orderId}/latest` with body credentials.
- Authenticated payment reads remain GET-only and no longer accept optional guest query credentials.
- Guest logistics tracking now uses `POST /logistics/track` body credentials; logistics GET no longer declares `guestEmail` or `orderNo` query params.
- Frontend API wrappers for guest order/payment/logistics reads send `guestEmail` and `orderNo` in request bodies instead of `params`.
- `./mvnw -q -Dtest=OrderControllerGuestAfterSaleAccessTest,PaymentControllerCustomerResponseTest,PaymentControllerSimulationAccessTest,GuestCredentialTransportContractTest,LogisticsControllerGuestTransportTest,LogisticsServiceTest test` passed.
- `npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest order detail and items | SOURCE_FIXED / API E2E PENDING | From a black-box client, request guest order detail and items with body credentials. Verify the URL has no `guestEmail` or `orderNo`, valid credentials return the expected customer-safe payload, and `GET /orders/guest/{id}?guestEmail=...&orderNo=...` does not grant access. |
| Guest payment reads | SOURCE_FIXED / API E2E PENDING | Request guest payment list/latest with body credentials. Verify the URL has no guest credential query params, valid credentials return customer-safe payment responses, and old guest GET query-param calls no longer grant access. |
| Authenticated payment reads | SOURCE_FIXED / API E2E OPTIONAL | While authenticated, call `/payments/order/{orderId}` and `/payments/order/{orderId}/latest` normally and confirm owner/admin access still works. Also confirm adding guest query params does not turn an unauthenticated request into guest access. |
| Guest logistics tracking | SOURCE_FIXED / API E2E PENDING | Track a guest order shipment through `POST /logistics/track` body credentials and verify successful response without credential query params. Recheck `GET /logistics/track?...&guestEmail=...&orderNo=...` does not use those credentials for access. |

## 2026-06-09 22:29 UTC F9002 Login Enumeration Handoff

Source status: TEST F9002 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Password login no longer returns a distinct public account-lock response for account-locked identifiers.
- Locked existing accounts and locked unknown-account keys now both return `400` with `Invalid username or password`, matching normal bad-credential responses.
- The lock branch still records internal login failure signals and runs authentication timing padding before returning.
- `./mvnw -q -Dtest=LoginControllerPasswordLoginTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Locked account versus unknown login | SOURCE_FIXED / AUTH API E2E PENDING | Create or simulate an account-lock condition, then compare password-login attempts for that locked account and an unknown login. Verify both return HTTP 400 with `Invalid username or password`, not an account-lock message or 429. |
| Bad credential regression | SOURCE_FIXED / AUTH API E2E OPTIONAL | Recheck ordinary wrong-password attempts for existing and unknown users. Verify responses remain generic and failure counters/rate limiting still operate internally. |

## 2026-06-09 22:26 UTC F9001 Registration Enumeration Handoff

Source status: TEST F9001 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `UserService` still throws field-specific duplicate-account exceptions internally, but public `/auth/register` responses mask duplicate username, email, and phone as the same account-details-unavailable message/code.
- Existing duplicate-email registration coverage was extended to duplicate username and duplicate phone.
- Non-enumerating validation errors, such as a missing phone number for a genuinely available account, remain specific for normal user recovery.
- `./mvnw -q -Dtest=AuthControllerRegisterTest test` passed. The verbose MockMvc/Hibernate Validator DEBUG output is test logging noise, not a failure.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Duplicate registration identifiers | CURRENT_SOURCE_COVERED / AUTH API E2E PENDING | Submit `/auth/register` with an existing username, existing email, and existing phone from a black-box client. Verify each returns the same public error message and `ACCOUNT_DETAILS_UNAVAILABLE`, without exposing which identifier matched an existing account. |
| Normal registration validation | CURRENT_SOURCE_COVERED / AUTH API E2E OPTIONAL | Submit a genuinely new account with a recoverable validation issue such as missing phone. Verify the response remains specific enough for user recovery and was not regressed to the duplicate-account generic message. |

## 2026-06-09 22:23 UTC F9315 Database Credential Handoff

Source status: TEST/QA F9315 WONTFIX / CURRENT_SOURCE_COVERED / ENVIRONMENT_ISSUE / REGRESSION_GUARD_ADDED / QA_DUPLICATE_CLOSED.

Local verification already run:
- Current repository defaults do not configure MySQL `root` credentials.
- Base and YAML datasource config use blank explicit `DB_URL`/`DB_PASSWORD` placeholders and `DB_USERNAME=shop`.
- Production profile still requires deployment-provided `DB_URL` and `DB_PASSWORD`.
- `deploy/backend.env.example` uses `DB_USERNAME=shop` and does not point at localhost or Docker bridge `172.18.*` database URLs.
- `deploy/docker-compose.backend.yml` does not inject `DB_USERNAME=root` or `MYSQL_ROOT_PASSWORD`.
- Added `ApplicationProfileContractTest.datasourceDefaultsDoNotUseRootOrDockerBridgeCredentials`.
- `./mvnw -q -Dtest=ApplicationProfileContractTest test` passed.
- QA duplicate closure retest on 2026-06-10: the same focused Maven slice passed again, and QA_ISSUES now marks F9315 as a current-source-covered deployment environment issue.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Backend deployment DB smoke | CURRENT_SOURCE_COVERED / DEPLOY SMOKE PENDING | In the real deployment environment, inspect the runtime `backend.env`/secret manager values for `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`. Confirm the backend connects with the intended non-root MySQL user and no longer logs `Access denied for user 'root'@'172.18.0.1'`. |
| Database grant check | ENVIRONMENT FOLLOW-UP | On the MySQL host, confirm the configured non-root app user has privileges from the actual backend source host/container network and that any stale root-based Docker bridge grants are not required for normal app startup. |

## 2026-06-09 22:20 UTC F9314 Shared Image Storage Handoff

Source status: TEST/QA F9314 SOURCE_FIXED / REGRESSION_GUARD_ADDED / QA_DUPLICATE_CLOSED.

Local verification already run:
- The old report named stale review methods, but current source still had real duplicated upload image processing between review uploads and pet gallery uploads.
- Added shared `ImageStorageService` and `LocalImageStorageService` for content-type validation, signature checks, dimension checks, ImageIO sanitization, safe local file writes, and stored-image metadata.
- `ReviewImageService` now delegates upload storage through review-specific config keys and preserves review upload messages.
- `PetGalleryService` now delegates only low-level image storage while keeping quota enforcement, metadata creation, gallery visibility, likes, and local delete behavior in the gallery service.
- `ImageStorageServiceTest`, `ImageStorageDelegationContractTest`, `ReviewImageServiceTest`, and the existing `PetGalleryServiceTest` cover the shared storage behavior and delegation contract.
- `./mvnw -q -Dtest=ImageStorageServiceTest,ImageStorageDelegationContractTest,ReviewImageServiceTest,PetGalleryServiceTest test` passed.
- `git diff --check` passed for touched tracked files and newly added files.
- QA duplicate closure retest on 2026-06-10: the same focused Maven slice passed again, and QA_ISSUES now marks F9314 fixed/current-source covered.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Review image upload | SOURCE_FIXED / API E2E PENDING | Upload JPG, PNG, and GIF review photos through the review image endpoint. Verify successful uploads return usable `/uploads/reviews/...` URLs, GIF input is served/stored as sanitized PNG, and invalid signature, oversized file, and oversized dimension cases return the existing review-specific error messages. |
| Pet gallery upload | SOURCE_FIXED / API E2E PENDING | Upload JPG, PNG, and GIF pet gallery photos as an authenticated customer. Verify quota behavior is unchanged, saved metadata has the sanitized content type/file size, returned image URLs render, and invalid/oversized uploads keep the existing gallery-specific error messages. |
| Gallery deletion/local cleanup | SOURCE_FIXED / API E2E OPTIONAL | Delete a user-uploaded local pet gallery photo and verify the row is marked deleted and the local upload file is removed or safely ignored if already missing. |

## 2026-06-09 22:09 UTC F9305 Manual API Error Shape Handoff

Source status: TEST F9305 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current source still has local controller `Map.of("error", ...)` returns, but `ManualApiErrorResponseAdvice` normalizes incomplete JSON error maps through `ApiErrorResponseFactory`.
- Normalized manual errors include `error`, `message`, `status`, `statusText`, `path`, `requestId`, and `timestamp`, while preserving extra fields such as `max`.
- Added `ManualApiErrorResponseAdviceTest` for manual map normalization, default `400` status correction, already-uniform payload pass-through, and non-JSON pass-through.
- `./mvnw -q -Dtest=ManualApiErrorResponseAdviceTest,GlobalApiExceptionHandlerTest,SecurityApiErrorHandlerTest test` passed. Existing log output is from tests intentionally exercising filtered unsafe details and 500 handling.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Manual controller bad-request payloads | CURRENT_SOURCE_COVERED / API E2E PENDING | Hit representative manual-error endpoints such as Cart add/remove validation, Brand create with missing payload, Coupon quote validation, and Logistics tracking validation. Verify each JSON response includes `error`, `message`, `status`, `statusText`, `path`, `requestId`, and `timestamp`. |
| Request-id propagation | CURRENT_SOURCE_COVERED / API E2E PENDING | Send an `X-Request-ID` header through a manual controller error and verify the response body and response header carry the same sanitized request id. |
| Existing uniform and security errors | CURRENT_SOURCE_COVERED / API E2E OPTIONAL | Recheck global exception handler, security 401/403, rate-limit, and IP-block responses to confirm their existing uniform payloads are unchanged. |

## 2026-06-09 22:07 UTC F9211 Skeleton Reduced-Motion Handoff

Source status: TEST F9211 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Shared skeleton visuals already render `aria-hidden="true"` and Home/Product List/Cart own the announced loading state through page containers.
- `SkeletonLoader.css` reduced-motion mode now sets `.shimmer { animation: none; }` instead of replacing shimmer with an infinite pulse animation.
- `sourceQuality.test.ts` guards the ARIA-hidden/page-status split and the no-animation reduced-motion contract.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- PostCSS parsed `src/components/SkeletonLoader.css` successfully.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Reduced-motion loading skeletons | SOURCE_FIXED / A11Y E2E PENDING | Enable `prefers-reduced-motion: reduce`, force slow loads on Home, Product List, and Cart, and verify skeleton placeholders are static with no shimmer/pulse animation. |
| Screen-reader loading announcements | SOURCE_FIXED / A11Y E2E PENDING | With a screen reader/a11y harness, force the same loading states and verify the page-level loading status is announced once while decorative skeleton visuals are ignored. |

## 2026-06-09 22:04 UTC F9210 CSS Layer Scale Handoff

Source status: TEST F9210 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `App.css` and `mobile-app.css` had 53 total `z-index` declarations, including many raw `!important` values from `850` through `9800`.
- `App.css` now defines a documented shared `--shop-z-*` layer scale for local content, sticky toolbars, app nav, support launchers, mobile popups/actions, coupon rails, critical mobile nav, and support-widget emergency layers.
- Every `z-index:` declaration in `App.css` and `mobile-app.css` now uses a named token, except explicit `z-index: auto` reset rules.
- `sourceQuality.test.ts` rejects raw numeric z-index declarations in these two files and verifies critical layer tokens are present.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- PostCSS parsed `src/App.css` and `src/mobile-app.css` successfully.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront overlays versus fixed rails | SOURCE_FIXED / LAYERING E2E PENDING | On desktop and mobile widths, open Select/Cascader/Picker dropdowns, image preview, cart drawer, checkout modal/form overlays, and verify they layer above page content while fixed nav/action rails remain usable where intended. |
| Native mobile bottom nav and action bars | SOURCE_FIXED / MOBILE LAYERING E2E PENDING | In Android WebView/mobile shell, exercise Product List conversion bar, Coupon quick nav/action bar, Cart summary, Checkout pay bar, and bottom nav. Verify tap targets are not hidden or blocked by the tokenized layer changes. |
| Support widget emergency layers | SOURCE_FIXED / SUPPORT LAYERING E2E PENDING | Open support launcher/widget with modals, drawers, dropdowns, and mobile bottom rails present. Verify backdrop, panel, and open button stack in the intended order and can be dismissed. |
| Admin overlays | SOURCE_FIXED / ADMIN LAYERING E2E OPTIONAL | In admin pages, open table filters, modals, drawers, dropdown menus, and notifications. Verify overlay ordering is unchanged after tokenization. |

## 2026-06-09 21:59 UTC F9209 Theme Color Dark-Mode Mismatch Handoff

Source status: TEST F9209 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `index.html` advertised a dark `theme-color` meta, but source had no implemented `prefers-color-scheme: dark` or `color-scheme: dark` CSS.
- The unsupported dark-only `theme-color` meta was removed. The light `theme-color` remains `#124734`, matching the manifest theme color.
- `sourceQuality.test.ts` now guards that dark browser chrome advertising is aligned with implemented dark CSS support.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Browser theme color in light OS mode | SOURCE_FIXED / THEME E2E OPTIONAL | Load the app/PWA in a browser or Android WebView and verify the browser/status bar uses the light `#124734` theme color. |
| Browser theme color in dark OS mode | SOURCE_FIXED / THEME E2E OPTIONAL | Switch the device/browser to dark OS mode and reload the app. Verify it no longer advertises the old unsupported `#0b2017` dark theme color while the UI remains in its existing light theme. |

## 2026-06-09 21:57 UTC F9208 Spanish Locale Translation Handoff

Source status: TEST F9208 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `es.json` still had the reported English strings: `pages.productList.materialNylon = "Nylon"`, `pages.registryAdmin.host = "Host"`, and `pages.bugAdmin.totalBugs = "{count} bugs"`.
- Spanish locale now uses `Nailon`, `Servidor`, and `{count} errores`.
- `i18n.test.ts` guards these known Spanish values against English fallback regressions.
- `CI=true npm test -- --runTestsByPath src/i18n.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Spanish Product List material filter | SOURCE_FIXED / LOCALE E2E PENDING | Switch to Spanish, open Product List filters, and verify the material option displays `Nailon` instead of `Nylon`. |
| Spanish Registry Management host label | SOURCE_FIXED / ADMIN LOCALE E2E PENDING | In a Spanish admin session, open Registry Management and verify the current-instance details table uses `Servidor` for the host column. |
| Spanish Bug Management total count | SOURCE_FIXED / ADMIN LOCALE E2E PENDING | In a Spanish admin session, open Bug Management with multiple records and verify pagination/count copy uses `{count} errores` wording rather than `{count} bugs`. |

## 2026-06-09 21:55 UTC F9207 Native Mobile Focus-Visible Handoff

Source status: TEST F9207 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `mobile-app.css` is still over 10k lines and had only one product-card `:focus-visible` rule plus one primary-button `:focus` color rule, so the native mobile focus gap was real.
- `mobile-app.css` now adds a native-app-wide focus indicator for links, buttons, role buttons, tabbable elements, form fields, AntD buttons/inputs/selects/cascaders/pickers/radio/checkbox/switch/segmented/tabs/pagination/dropdown items, and bottom/mega nav controls.
- The focus indicator uses a 3px coral outline, 3px offset, and a two-layer high-contrast halo without changing layout.
- AntD composite controls are covered through focused wrapper classes and `:has(input:focus-visible)` selectors.
- `sourceQuality.test.ts` guards the key mobile focus selectors and visual contract.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- PostCSS parsed `src/mobile-app.css` successfully.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Android WebView keyboard focus traversal | SOURCE_FIXED / MOBILE A11Y E2E PENDING | In the native Android WebView or equivalent mobile app shell, tab/focus through top nav actions, search, bottom nav, product cards, cart controls, checkout controls, auth forms, and profile forms. Verify every focused interactive element has a visible 3px coral outline/halo and no layout shift. |
| AntD composite controls | SOURCE_FIXED / MOBILE A11Y E2E PENDING | Focus mobile Select, Cascader, Date/Picker, Radio, Checkbox, Switch, Segmented, Tabs, and Pagination controls. Verify the visible wrapper receives the focus indicator, not only a hidden internal input. |
| Modal/drawer/dropdown focus | SOURCE_FIXED / MOBILE A11Y E2E PENDING | Open mobile drawers, modals, dropdowns, select menus, and support/admin overlays. Keyboard-focus close buttons, menu items, primary actions, and form controls. Verify focus indicators remain visible above overlay backgrounds. |
| Locale/responsive spot check | SOURCE_FIXED / MOBILE A11Y E2E OPTIONAL | Repeat a short focus traversal in English, Chinese, and Spanish at 360px, 390px, and tablet WebView widths. Verify focus rings do not collide with longer labels or clipped controls. |

## 2026-06-09 21:52 UTC F9206 Global Message Live Region Handoff

Source status: TEST F9206 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current source still has many direct AntD `message.success/error/warning/info/open` calls across storefront, components, and admin pages, so the broad announcement gap was real.
- `utils/accessibleMessage.ts` now patches AntD static message helpers and `message.open`, extracts readable text from message content/config/React children, and notifies subscribers once per toast.
- `App.tsx` renders a hidden global `app-message-live-region` with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, and localized `app.statusAnnouncementLabel`.
- Checkout keeps its page-local F9205 live region and suppresses the global announcer for `showCheckoutMessage(...)` so Checkout status updates are not announced twice.
- `en`, `zh`, and `es` locales include the app-level status live-region label.
- `accessibleMessage.test.tsx`, `App.test.tsx`, and `sourceQuality.test.ts` cover the global announcer, live-region subscription, locale keys, and source contract.
- `Checkout.test.tsx` still passes after the duplicate-announcement suppression wrapper.
- `rg -n "message\\.loading\\b|message\\.warn\\b" frontend/src --glob '!**/*.test.*'` found no current uncovered static message call shapes.
- `CI=true npm test -- --runTestsByPath src/utils/accessibleMessage.test.tsx src/App.test.tsx src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed with existing React act warning noise.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront AntD toast announcements | SOURCE_FIXED / GLOBAL A11Y E2E PENDING | In a screen-reader/a11y harness, force representative storefront toasts from Cart, Wishlist, Coupon Center, Product Detail/List, Login/Register/Forgot Password, Profile, Order Tracking, and support widget flows. Verify the visible toast text is announced through the global `App status updates` live region. |
| Admin AntD toast announcements | SOURCE_FIXED / GLOBAL A11Y E2E PENDING | Force representative admin success/error/warning toasts from product, order, coupon, user, support, alerts, logs, and traffic-control pages. Verify each toast text is mirrored into the global live region. |
| `message.open` rich-content announcements | SOURCE_FIXED / GLOBAL A11Y E2E PENDING | Trigger Wishlist or another `message.open({ content })` flow and verify the readable message content is announced once, including React-content text. |
| Checkout duplicate-announcement suppression | SOURCE_FIXED / CHECKOUT A11Y E2E PENDING | Trigger checkout status toasts covered by F9205 and verify they are announced through `Checkout status updates` only, without a duplicate announcement from the global app live region. |
| Locale coverage for app live-region labels | SOURCE_FIXED / GLOBAL A11Y E2E OPTIONAL | Repeat one storefront and one admin toast in English, Chinese, and Spanish sessions. Verify the global live-region label is localized and the announced message text matches the active locale. |

## 2026-06-09 21:37 UTC F9205 Checkout Status Live Region Handoff

Source status: TEST F9205 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Checkout now renders a hidden `checkout-page__statusLiveRegion` with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, and localized `pages.checkout.statusAnnouncementLabel`.
- Local checkout toast calls now go through `showCheckoutMessage(...)`, which mirrors the same status text into the live region.
- The status live region is present in loading, pending-payment result, payment result, empty checkout, and active form branches.
- The existing validation-error live region remains separate.
- `en`, `zh`, and `es` locales include the status live-region label.
- `Checkout.test.tsx` verifies validation live-region behavior and a failing order-create status announcement.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout status announcements | SOURCE_FIXED / CHECKOUT A11Y E2E PENDING | With a screen-reader/a11y test harness, force checkout load, coupon, order-create, payment-create, retry-payment, and payment-open failures. Verify the visible toast text is also announced through the `Checkout status updates` live region without duplicating validation-error announcements. |
| Checkout validation announcements | SOURCE_FIXED / CHECKOUT A11Y E2E PENDING | Submit an incomplete guest checkout and verify the existing validation live region announces the field summary while the status live region remains reserved for non-field status updates. |
| Locale coverage for checkout live-region labels | SOURCE_FIXED / CHECKOUT A11Y E2E OPTIONAL | Repeat a checkout status failure in English, Chinese, and Spanish sessions and verify the live-region labels and announced text are localized. |

## 2026-06-09 21:30 UTC F9201 Product Rich Detail Localized Defaults Handoff

Source status: TEST F9201 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `ProductRichDetail.tsx` no longer hardcodes default English `emptyText`, image alt, video title, open-video text, or unsupported-content text.
- Omitted or partial rich-detail labels now resolve through `useLanguage()` using existing `pages.productDetail.*` locale keys.
- Explicit caller-provided labels still override the component defaults.
- `ProductRichDetail.test.tsx` verifies Spanish fallback empty/image/video labels and guards against the old hardcoded English defaults.
- `CI=true npm test -- --runTestsByPath src/components/ProductRichDetail.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product rich-detail defaults in non-English locale | SOURCE_FIXED / PRODUCT DETAIL E2E PENDING | In Spanish and Chinese sessions, open a product/detail rendering path where `ProductRichDetail` receives no explicit labels or no rich content. Verify empty text, fallback image alt, video title, and open-video text are localized and no English fallback appears. |
| Product Detail explicit labels | SOURCE_FIXED / PRODUCT DETAIL E2E OPTIONAL | Open the normal Product Detail tab with rich images/videos and verify the existing explicit localized labels still render correctly in English, Spanish, and Chinese. |

## 2026-06-09 21:27 UTC F9112 Profile Pet Profile Load Failure Handoff

Source status: TEST F9112 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `Profile.tsx` still reports pet-profile load failures through `reportNonBlockingError('Profile.fetchPetProfiles', error)`.
- When the component is still mounted, the pet list is cleared and `message.error(t('pages.profile.fetchPetProfilesFailed'))` is shown instead of silently rendering an empty pets section.
- `en`, `zh`, and `es` locale files include `pages.profile.fetchPetProfilesFailed`.
- `Profile.test.ts` guards the catch block and locale keys.
- `CI=true npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile pet profile load failure | SOURCE_FIXED / PROFILE E2E PENDING | Log in, open Profile, force `/pet-profiles/mine` or the active pet-profile load endpoint to fail, and verify a localized pet-profile load error toast appears instead of silently showing only the empty pets state. Confirm user/orders/addresses still render normally if their APIs succeed. |
| Locale coverage for pet load failure | SOURCE_FIXED / PROFILE E2E OPTIONAL | Repeat the failed pet-profile load in English, Chinese, and Spanish sessions and verify the toast uses the localized `fetchPetProfilesFailed` copy. |

## 2026-06-09 21:24 UTC F9111 Checkout Idempotency Payment-Recovery Handoff

Source status: TEST F9111 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Checkout now keeps `checkoutIdempotencyKey` after order creation and persists `checkoutPendingOrder` with the created order, payment method, guest payment email, and timestamp before `paymentApi.create(...)`.
- Checkout hydrates a pending order from `checkoutPendingOrder` on refresh so the shopper lands on the payment-retry result instead of losing the created order reference.
- Recovery storage clears only after payment exists, retry payment creation succeeds, rollback/cancel succeeds, or order creation/auth recovery invalidates the checkout session.
- `CartCheckoutFlow.test.tsx` verifies payment-create failure keeps both recovery keys, refresh retry uses the stored order/email/method and clears recovery storage after payment creation, and normal guest success clears both keys.
- `CI=true npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest checkout payment-create failure refresh recovery | SOURCE_FIXED / CHECKOUT E2E PENDING | Force guest order creation to succeed and payment creation to fail. Verify `checkoutIdempotencyKey` and `checkoutPendingOrder` remain in session storage, refresh Checkout, confirm the payment-retry result shows the same order number/email, click Retry payment, and verify no second guest order is created. Confirm both recovery keys clear after payment creation succeeds. |
| Authenticated checkout payment-create failure refresh recovery | SOURCE_FIXED / CHECKOUT E2E PENDING | Repeat with a signed-in cart/order. Verify refresh recovers the same pending order and retry creates payment without issuing another checkout order. Confirm recovery keys clear after payment exists. |
| Successful checkout storage cleanup | SOURCE_FIXED / CHECKOUT E2E PENDING | Complete a normal guest and authenticated checkout through payment creation. Verify `checkoutIdempotencyKey` and `checkoutPendingOrder` are absent after success and a refresh does not reopen a stale pending-order screen. |
| Pending payment rollback cleanup | SOURCE_FIXED / CHECKOUT E2E PENDING | From the payment-create failure result, use Roll back payment. Verify the order is canceled/restored as expected, cart recovery works, and both checkout recovery storage keys are cleared. |

## 2026-06-09 21:11 UTC F9110 Product Detail Scroll Warmup Cleanup Handoff

Source status: TEST F9110 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production source change was needed in this pass.

Local verification already run:
- `nativeScroll.addAppScrollListener(...)` returns a remover that unregisters window and native-host scroll listeners.
- Product Detail’s IntersectionObserver fallback branch type-checks the scroll remover, calls `detachScrollWarmup()` after warmup, and calls it again during effect cleanup.
- Cleanup also clears the fallback timer and disconnects any observer reference.
- `ProductDetail.test.tsx` guards the source cleanup contract.
- `CI=true npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand --testTimeout=30000 -t "scroll warmup fallback"` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail without IntersectionObserver | CURRENT_SOURCE_COVERED / PRODUCT E2E OPTIONAL | Run Product Detail in a browser harness with `IntersectionObserver` disabled, scroll near the detail section, navigate away, and verify non-critical content warms once without lingering scroll listeners or console warnings. |

## 2026-06-09 21:09 UTC F9109 Wishlist Add-All Guard Handoff

Source status: TEST F9109 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Wishlist Add all to cart now uses `addingAllToCartRef` as a synchronous mutex plus `addingAllToCart` loading state.
- Duplicate clicks across the header, recovery, next-action, and mobile action Add all surfaces return before a second batch can start.
- Add all buttons show loading/disabled while a batch is pending and reset after the batch settles.
- `Wishlist.test.tsx` includes source guards and a runtime pending-request double-click test.
- `CI=true npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist Add all double-click | SOURCE_FIXED / WISHLIST E2E PENDING | Seed authenticated Wishlist with one or more direct-add ready items, delay cart add APIs, then double-click/tap Add all from desktop and mobile action surfaces. Verify only one batch of cart-add requests is sent and all Add all buttons are loading/disabled while pending. |
| Wishlist Add all retry after failure | SOURCE_FIXED / WISHLIST E2E PENDING | Force the first Add all batch to fail, verify the error state is visible, then click Add all again after settlement. Confirm one retry batch starts and the buttons are usable again. |

## 2026-06-09 21:06 UTC F9108 Checkout Coupon Auto-Select Triage Handoff

Source status: TEST F9108 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED via the existing F3370 source fix. No production source change was needed in this pass.

Local verification already run:
- `Checkout.tsx` uses `couponAutoSelectedQuoteRef` to remember the cart key and coupon id returned by a backend auto-selected quote.
- The immediate dependency re-run for that same cart/coupon pair clears the ref and returns before issuing another `couponApi.quote(...)`.
- Manual coupon changes and cart changes still clear/re-quote normally.
- `Checkout.test.tsx` guards the source contract.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=30000 -t "does not re-quote immediately after the backend auto-selects a coupon"` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout coupon quote auto-select | CURRENT_SOURCE_COVERED / PERFORMANCE E2E OPTIONAL | In authenticated checkout with a backend-selected/best available coupon, inspect network calls and verify the initial quote is not immediately duplicated only because `selectedUserCouponId` changed. |
| Manual coupon change after auto-select | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | After auto-select, manually choose or clear a coupon and verify a fresh quote is sent and totals update correctly. |

## 2026-06-09 21:05 UTC F9107 Cart Quantity Sync Triage Handoff

Source status: TEST F9107 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED. No production source change was needed in this pass.

Local verification already run:
- Current `Cart.tsx` no longer has the reported debounced quantity `.catch` rethrow path.
- Debounced authenticated quantity sync lives in `useCartQuantitySync`.
- The hook checks `isActive(...)` in `.then`, `.catch`, and `.finally` before cart events, error handling, or pending-state cleanup.
- Background quantity promises are terminated with `void Promise.resolve(onQuantitySyncError(error)).catch(() => undefined)` and `void syncPromise.catch(() => undefined)`.
- `Cart.tsx` `fetchCartItems()` checks `mountedRef.current` after `cartApi.getItems(...)`, before catch-side state updates, and before clearing loading.
- `CI=true npm test -- --runTestsByPath src/utils/cartTimerCleanup.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Debounced quantity failure | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Edit an authenticated cart item quantity, force the delayed `cartApi.updateQuantity` request to fail, and verify one localized quantity error appears, cart reload behavior is coherent, and no unhandled promise rejection appears in the browser console. |
| Quantity sync quick navigation | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Start a debounced authenticated quantity update, navigate away before the timer/API settles, and verify no late toast, cart event, loading-state mutation, or unmounted-state warning appears. |

## 2026-06-09 21:03 UTC F9106 Register Submit Mutex Handoff

Source status: TEST F9106 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `Register.tsx` now uses `registeringRef` as a synchronous mutex before setting `registering`.
- Same-render duplicate submits return before a second `userApi.register(...)` request can start.
- The ref resets in `finally` with `setRegistering(false)`, so normal retries after failure remain possible.
- The register submit button still uses `loading={registering}` and `disabled={registering}` while the request is pending.
- `Register.test.tsx` includes source guards for the ref contract and a runtime pending-request double-click test.
- `CI=true npm test -- --runTestsByPath src/pages/Register.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Register submit double-click | SOURCE_FIXED / AUTH E2E PENDING | Fill a valid registration form, delay `/auth/register`, then double-click/tap Register. Verify only one register request is sent, the submit button becomes disabled/loading, and navigation/session prefill happens once after success. |
| Register failure retry after mutex reset | SOURCE_FIXED / AUTH E2E PENDING | Force the first register request to fail with a visible localized error, then submit once more after the request settles. Verify exactly one retry request starts and the button is usable again. |
| Register email-code error path | SOURCE_FIXED / AUTH E2E PENDING | Force register to return an email-code-required/invalid-code response. Verify the mutex resets, the code field is focused/enabled as expected, and a later single submit sends exactly one request. |

## 2026-06-09 21:00 UTC F9105 Login Credential Cleanup Handoff

Source status: TEST F9105 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `Login.tsx` mount no longer clears full stored auth/client state; it only redirects away from `/login` when a token exists.
- Password login, email-code send, and email-code login now call `clearStoredAuthCredentials()` rather than `clearStoredAuthSession()`.
- `clearStoredAuthCredentials()` removes auth credential keys and clears user-scoped API caches without invoking `clearAuthClientState()`, so browsing history, compare products, stock alerts, saved-for-later, and checkout draft storage survive failed login attempts.
- Logout/session-expiry paths still use full `clearStoredAuthSession()` cleanup.
- `Login.test.tsx` guards the Login cleanup scope and mount behavior; `api/index.test.ts` guards credentials-only cleanup preserving local browsing state.
- `CI=true npm test -- --runTestsByPath src/pages/Login.test.tsx src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Login page visit with browsing state | SOURCE_FIXED / AUTH E2E PENDING | Seed product view history, compare products, stock alerts, saved-for-later, and checkout draft storage, then visit `/login` without an auth token. Verify none of those browser-storage entries are cleared on page load. |
| Failed password login preserves browsing state | SOURCE_FIXED / AUTH E2E PENDING | With the same seeded browsing state and stale auth credential keys, submit a wrong password. Verify stale auth credential keys are removed, the localized error appears, and browsing-state keys remain unchanged. |
| Email-code send/login failure preserves browsing state | SOURCE_FIXED / AUTH E2E PENDING | Trigger email-code send and email-code login failure paths with seeded browsing state. Verify auth credentials are cleared but compare, stock alerts, saved-for-later, view history, and checkout draft persist. |
| Logout/session expiry still clears account-scoped state | SOURCE_FIXED / AUTH E2E PENDING | From an authenticated session with account-scoped local state, perform logout or force refresh-token/session expiry. Verify full session cleanup still clears account-scoped client state and leaves guest cart behavior intact. |

## 2026-06-09 20:55 UTC F9104 Profile Continue Payment Mutex Handoff

Source status: TEST F9104 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Profile Continue Payment now uses `continuingPaymentRef` as a synchronous mutex before starting payment recovery.
- The mutex resets in `finally`, so retries after a settled success/failure remain possible.
- Continue Payment buttons are disabled while `payingOrderId !== null`, preventing a second pending order button from starting while the first request is active.
- `Profile.test.ts` guards the ref declaration, early return, order-id assignment, cleanup, and disabled button contract.
- `CI=true npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Same-order continue-payment double-click | SOURCE_FIXED / PROFILE PAYMENT E2E PENDING | With a pending-payment order and delayed payment APIs, double-click Continue Payment. Verify only one `getByOrder`/payment recovery request chain starts, the button is disabled/loading, and one payment modal opens. |
| Multiple pending orders concurrent click | SOURCE_FIXED / PROFILE PAYMENT E2E PENDING | Seed two pending-payment orders, delay the first Continue Payment request, then click Continue Payment on the second order. Verify the second click is ignored/disabled until the first request settles and no second payment is created. |
| Retry after failed continue-payment | SOURCE_FIXED / PROFILE PAYMENT E2E PENDING | Force the first Continue Payment attempt to fail, verify the localized error appears, then click again after failure. Confirm exactly one retry request starts and the mutex has reset. |

## 2026-06-09 20:52 UTC F9103 Profile Payment Return Channel Race Handoff

Source status: TEST F9103 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Profile payment-return synchronization now waits for `paymentChannelsLoaded` before consuming the payment-return URL state or setting `handledPaymentReturnRef`.
- `paymentApi.getChannels()` marks channel loading complete on success and failure, so the return flow can proceed deterministically after the channel request settles.
- `getPreferredPaymentChannel(...)` preserves an existing payment channel when the channel list is temporarily empty, preventing returned payments from rendering with an empty selected method.
- `Profile.test.ts` includes source guards for the loaded-channel gate, return-key ordering, channel loaded success/failure paths, dependency list, and preferred-channel fallback.
- `CI=true npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment return before channels load | SOURCE_FIXED / PROFILE PAYMENT E2E PENDING | Return to `/profile?payment=success&orderNo=<paid-order>` while delaying `/payments/channels` and allowing orders/payment sync to resolve first. Verify Profile waits for channel load before clearing return params, selected payment method is not empty, and the order/payment status renders as synced. |
| Payment channels request failure | SOURCE_FIXED / PROFILE PAYMENT E2E PENDING | Force `/payments/channels` to fail during payment return. Verify the return sync still proceeds after the failure settles, the existing payment channel remains displayed from the payment record, and no repeated return sync loop occurs. |
| Payment return retry after navigation | SOURCE_FIXED / PROFILE PAYMENT E2E OPTIONAL | Navigate away during delayed channel load, then return to the Profile payment-return URL. Verify no stale toast/state update happens after unmount and the fresh visit handles the return once. |

## 2026-06-09 20:48 UTC F9101/F9102 Login Double-Submit Guard Handoff

Source status: TEST F9101/F9102 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Password login now uses `passwordSubmittingRef` to block duplicate same-render submits before a second `userApi.login(...)` call can start.
- Email-code login now uses `emailSubmittingRef` to block duplicate same-render submits before a second `userApi.emailLogin(...)` call can start.
- Password submit button explicitly sets `disabled={loading}` while pending; email submit remains disabled while loading/code-sending/invalid-code.
- `Login.test.tsx` includes source guards for both refs plus runtime double-click checks for password and email-code login.
- `CI=true npm test -- --runTestsByPath src/pages/Login.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Password login double-click | SOURCE_FIXED / AUTH E2E PENDING | On the password-login tab, double-click/tap the submit button while the login API is delayed. Verify only one `/login` request is sent, the button becomes disabled/loading, guest-cart merge runs once, and successful navigation happens once. |
| Email-code login double-click | SOURCE_FIXED / AUTH E2E PENDING | On the email-code tab with a valid 6-digit code, double-click/tap submit while the email-login API is delayed. Verify only one email-login request is sent, retry/error states remain coherent, and successful navigation happens once. |
| Failed login retry after guard reset | SOURCE_FIXED / AUTH E2E PENDING | Force password and email-code login failures, verify the relevant error is shown, then submit once more after the request settles. Confirm the ref resets and one retry request is allowed. |

## 2026-06-09 20:44 UTC F950 / API-007 Free Shipping Policy Non-Issue Handoff

Source status: QA F950 / TEST API-007 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production behavior changed in this pass.

Local verification already run:
- Backend checkout/quote shipping policy treats `product.freeShipping=true` as item-level free shipping below the global `order.free-shipping-threshold`.
- Backend global threshold still waives shipping when selected subtotal reaches `order.free-shipping-threshold`.
- Frontend cart/checkout estimates use `deriveCartShippingSummary(...)`, which unlocks free shipping for global threshold or when every selected item qualifies by product shipping policy.
- Product Detail renders `Free shipping` directly for `product.freeShipping=true`.
- Added `PaymentFlowServiceTest.checkoutQuoteWaivesShippingForProductFreeShippingBelowGlobalThreshold()`.
- `./mvnw -q -Dtest=PaymentFlowServiceTest#checkoutQuoteWaivesShippingForProductFreeShippingBelowGlobalThreshold test` passed.
- `CI=true npm test -- --runTestsByPath src/utils/cartUi.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand --testTimeout=30000 -t "free shipping"` passed with existing React/Router warning noise.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product-level free shipping checkout | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | Add a below-`899.00` `freeShipping=true` product to guest and authenticated checkout. Verify cart, checkout estimate, backend quote/order shipping fee, payment amount, and order detail all show zero shipping. |
| Global threshold free shipping | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | Build a mixed cart with non-free-shipping products whose subtotal reaches the configured `order.free-shipping-threshold`; verify backend quote/order and frontend summary waive shipping only once the subtotal threshold is met. |
| Mixed qualifying/non-qualifying cart | CURRENT_SOURCE_COVERED / CHECKOUT E2E OPTIONAL | Add one `freeShipping=true` item plus one standard item below the global threshold. Verify shipping remains paid unless the standard item also qualifies by product threshold or the global subtotal threshold is reached. |

## 2026-06-09 20:38 UTC F948 / API-005 Public List Status Non-Issue Handoff

Source status: QA F948 / TEST API-005 WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED. No runtime behavior changed in this pass.

Local verification already run:
- Public `/products` and `/search` list responses use lightweight `ProductPublicListItemResponse`.
- Current controller tests assert public list/search items do not include `status`.
- Public product detail uses `ProductPublicResponse`, which maps `status`.
- Public list/search services filter non-public products before serialization.
- `./mvnw -q -Dtest=ProductControllerPaginationTest,SearchControllerTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public list/search payload shape | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Smoke `/products` and `/search?q=<term>` and confirm list-card fields render without relying on raw `status`; non-public products should not appear. |
| Product detail status availability | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Open a public product detail and verify detail payload/UI still functions with the rich detail DTO; status remains available to detail/API consumers if needed. |
| Admin status operations | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Verify admin product management still displays and edits product status through admin APIs, separate from public list payloads. |

## 2026-06-09 20:35 UTC F947 / API-004 Zero-Price Public Catalog Guard Handoff

Source status: QA F947 / TEST API-004 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Public product-page specification requires `price > 0`.
- `isPublicCatalogProduct(...)` rejects products whose price is null, zero, or negative.
- Public repository windows for featured products, related-category products, keyword candidates, and category public counts require `p.price > 0`.
- Admin product surfaces remain unchanged so bad data can still be located and corrected by operators.
- `ProductSearchServiceTest.zeroPriceProductsAreExcludedFromPublicCatalogSurfaces()` verifies public list, public detail, and public-by-ids filtering.
- `./mvnw -q -Dtest=ProductSearchServiceTest,ProductControllerPaginationTest,SearchControllerTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public catalog zero-price exclusion | SOURCE_FIXED / API E2E PENDING | Against staging/live data containing product `9219` or an equivalent zero-price fixture, call `/products?size=100`, `/search?q=<matching term>&size=100`, and `/products/by-ids?ids=<zeroPriceId>`. Verify the zero-price product is absent. |
| Public product detail zero-price exclusion | SOURCE_FIXED / API E2E PENDING | Call `/products/<zeroPriceId>` and verify the endpoint returns 404/not found instead of a sellable product detail payload. |
| Featured/related/category counts | SOURCE_FIXED / API/UI E2E PENDING | Verify featured rails, related products, keyword recommendations, and category product counts do not include zero-price products or show counts that imply hidden zero-price items. |
| Admin correction visibility | SOURCE_FIXED / ADMIN E2E PENDING | In admin product management, verify the zero-price product remains findable so an operator can update price/status or remove it. |

## 2026-06-09 20:30 UTC F946 / API-003 Category Scope Contract Handoff

Source status: QA F946 / TEST API-003 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `/products` and `/search` now accept `includeChildren`.
- Default/`includeChildren=true` preserves hierarchical parent-category filtering for storefront navigation.
- `includeChildren=false` switches to exact category matching.
- `ProductServiceImpl` includes `includeChildren` in the product-list cache key.
- Frontend `productApi.getAll(...)` and `productApi.getPage(...)` serialize `includeChildren`.
- Product List sends `includeChildren=true` when browsing a category.
- `./mvnw -q -Dtest=ProductControllerPaginationTest,SearchControllerTest,ProductSearchServiceTest test` passed.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/pages/ProductList.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public products hierarchical category | SOURCE_FIXED / API E2E PENDING | Call `/products?categoryId=<parent>&includeChildren=true&size=100` and `/products?categoryId=<parent>&size=100`; verify both include products from descendant categories and return paged metadata. |
| Public products exact category | SOURCE_FIXED / API E2E PENDING | Call `/products?categoryId=<parent>&includeChildren=false&size=100`; verify every returned product has exactly the requested `categoryId` and no child-category products leak in. |
| Search category scope | SOURCE_FIXED / API E2E PENDING | Repeat hierarchical and exact category checks through `/search?q=<term>&categoryId=<parent>` with `includeChildren=true/false`, including blank `q` plus category filter compatibility. |
| Product List category navigation | SOURCE_FIXED / UI E2E PENDING | Browse a parent category in the storefront and verify the product grid still shows child-category products, pagination/filter chips still work, and the request includes `includeChildren=true`. |

## 2026-06-09 19:24 UTC Frontend F981 Home Product Card Extraction Handoff

Source status: QA frontend F981 PARTIAL_SOURCE_FIXED / REGRESSION_GUARD_ADDED. F981 remains open for broader large-component decomposition. This product-card handoff is extended by the 2026-06-10 03:49 UTC Home Pet Gallery extraction handoff.

Local verification already run:
- `HomeProductCard` moved from `pages/Home.tsx` to `components/HomeProductCard.tsx`.
- Best sellers, personalized products, recently viewed, flash offers, and daily discovery rails still pass the same translation, money-formatting, product-prefetch, product-open, quick-add, wishlist, and wishlist-state props.
- Product-card image normalization, fallback image handling, responsive image URLs, discount/stock/rating model, quick actions, wishlist active state, and viewed-at label remain owned by the extracted component.
- `sourceQuality.test.ts` rejects reintroducing the inline card/model into `Home.tsx`.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Home product rails desktop/mobile smoke | PARTIAL_SOURCE_FIXED / E2E_PENDING | Load Home on desktop and mobile with populated best seller, personalized, recently viewed, flash offer, and daily discovery data; verify cards render names, images, prices, discounts, ratings, stock badges, and section-specific labels. |
| Home product card interactions | PARTIAL_SOURCE_FIXED / E2E_PENDING | Verify image/title links open product detail, quick view opens detail, quick add preserves option-selection/sold-out behavior, and wishlist toggles active state across all Home rails. |
| Home product image fallback/lazy loading | PARTIAL_SOURCE_FIXED / E2E_PENDING | Force broken primary image URLs and verify responsive fallback images render without broken cards or layout shift in compact and discovery card modes. |

## 2026-06-09 19:11 UTC Frontend F982 Home Progressive Discovery Rendering Handoff

Source status: QA frontend F982 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Home keeps `HOME_PRODUCT_PAGE_SIZE = 48` as a bounded fetch/cache size, not a full discovery render size.
- Daily discovery renders `visibleDiscoveryProducts = discoveryProducts.slice(0, visibleCount)`.
- `visibleCount` initializes/resets to `DISCOVERY_BATCH_SIZE = 12`.
- Passive app scroll metrics near the bottom increase discovery visibility by 12-card batches.
- The discovery section maps `visibleDiscoveryProducts`, not `discoveryProducts`.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Home first-load product count | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Load Home on desktop/mobile with at least 48 products and verify the daily discovery section initially shows one 12-card batch plus the loading sentinel, not all 48 cards. |
| Home scroll progressive loading | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Scroll near the bottom and verify discovery cards append in 12-card batches without layout jank, duplicate cards, or broken image lazy loading. |
| Home fallback catalog progressive loading | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Force live product API failure with a catalog snapshot/fallback and verify discovery still resets to 12 cards and progressively reveals more on scroll. |

## 2026-06-09 19:05 UTC Frontend F980 Notification Rich-Text Sanitizer Handoff

Source status: QA frontend F980 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- `stripUnsafeHtml(...)` is backed by DOMPurify and calls `DOMPurify.sanitize(...)`.
- `Notifications.tsx` sanitizes HTML notification messages before `dangerouslySetInnerHTML`.
- `NotificationManagement.tsx` sanitizes rich preview and HTML send payloads before preview rendering/API submission.
- `sanitizeHtml.test.ts` covers executable markup removal, event handler stripping, unsafe/protocol-relative/credentialed/backslash-obfuscated URLs, blank-target rel protection, unknown tag unwrapping, non-allowlisted attributes, SVG/script-content removal, and image attribute restrictions.
- `CI=true npm test -- --runTestsByPath src/utils/sanitizeHtml.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm ls dompurify --depth=0` resolves `dompurify@3.4.8`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer notification rich text | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | Create or seed an HTML notification with allowed formatting and unsafe script/event/URL payloads; verify customer Notifications renders safe formatting and strips unsafe content. |
| Admin notification preview/send | CURRENT_SOURCE_COVERED / E2E_OPTIONAL | In Notification Management, preview and send rich HTML with links/images plus unsafe payloads; verify preview and delivered notification match the sanitized contract. |

## 2026-06-09 19:00 UTC Frontend F979 Chinese Phone Placeholder Handoff

Source status: QA frontend F979 SOURCE_FIXED / NON_ISSUE_REMAINDERS_DOCUMENTED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `pages.auth.phonePlaceholder` in `zh.json` now reads `手机号示例：+86 138 0000 0000 / +52 55 1234 5678`.
- Remaining English-looking Chinese locale values are documented as accepted brand names, technical abbreviations, promo codes, URLs, and code/protocol literals.
- `i18n.test.ts` now guards that the Chinese phone placeholder includes Chinese explanatory text.
- `CI=true npm test -- --runTestsByPath src/i18n.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Chinese Register phone field | SOURCE_FIXED / E2E_OPTIONAL | Switch to Chinese, open Register, and verify the phone placeholder includes `手机号示例` and fits without clipping on desktop/mobile. |
| Chinese Profile phone fields | SOURCE_FIXED / E2E_OPTIONAL | Switch to Chinese, open Profile edit and address modal phone fields, and verify the placeholder remains readable and does not overlap validation text. |

## 2026-06-09 18:56 UTC Frontend F977 Admin Type-Safety Handoff

Source status: QA frontend F977 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `AdminLayout.tsx`, `ReviewManagement.tsx`, and `ProductManagement.tsx` contain no `as any` assertions.
- AdminLayout menu filtering uses typed `AdminMenuItem` entries and `isAdminMenuItem(...)` instead of `filter(Boolean) as any[]`.
- ReviewManagement reads optional nested `Review.product` and `Review.user` fields directly.
- ProductManagement import summary/preview/success translations use typed `productImportTranslationParams(...)`, and generated variant row merging keeps typed `ProductVariantFormRow` lookups.
- `CI=true npm test -- --runTestsByPath src/components/AdminLayout.test.tsx src/pages/ReviewManagement.test.ts src/pages/ProductManagement.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin menu permissions | SOURCE_FIXED / E2E_PENDING | Sign in as roles with different permission sets and verify the admin side menu, mobile drawer menu, default admin redirect, and selected route highlighting remain correct. |
| Admin review table nested product/user data | SOURCE_FIXED / E2E_PENDING | Load reviews with direct product fields and nested `product`/`user` payloads; verify product image/name/id and username cells render correctly and moderation actions still work. |
| Product CSV import preview/apply copy | SOURCE_FIXED / E2E_PENDING | Run blocked preview, ready preview, rejected apply, and successful apply flows; verify localized summary/preview/success counts render correctly in modals and button labels. |
| Product variant generation merge | SOURCE_FIXED / E2E_PENDING | Generate variants from option groups when existing variant rows are present; verify SKU, price, stock, and image values are preserved for matching option text. |

## 2026-06-09 18:46 UTC Frontend F962 API Product Normalization Handoff

Source status: QA frontend F962 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `frontend/src/api/index.ts` contains no production `any`, `as any`, `: any`, or `headers?: any` usage.
- Product normalization now narrows uncertain payloads with `unknown` plus `isRecord(...)`.
- Public/admin product page types include optional `totalElements`, and page normalizers preserve `totalElements` as `totalElements` while mapping it to `total`.
- `api/index.test.ts` covers public/admin product page `totalElements` payloads plus string-encoded images, specifications, detail content, variants, and option groups.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public product page metadata | SOURCE_FIXED / E2E_PENDING | Browser-smoke `/products` pagination and filters where the backend responds with `totalElements`; verify visible total/page count and next/previous behavior remain correct. |
| Search product page metadata | SOURCE_FIXED / E2E_PENDING | Browser-smoke `/search` result pagination with `totalElements`; verify no stale array-only assumptions in result counts or pagination controls. |
| Admin product pagination metadata | SOURCE_FIXED / E2E_PENDING | Admin-smoke product management pagination/filtering with `totalElements`; verify table total, page navigation, and page-size controls remain correct. |
| Rich product list payload variants | SOURCE_FIXED / E2E_PENDING | Smoke products whose images/specifications/detail content/variants/option groups arrive as string, array, and object payload variants; verify thumbnails, option selectors, quick-add, and admin list display still render. |

## 2026-06-09 18:36 UTC Frontend F961 Login Type Safety Closure Handoff

Source status: QA frontend F961 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED. No runtime behavior changed in this pass.

Local verification already run:
- Current `Login.tsx` contains no `any`, `as any`, `: any`, or `catch (...: any)` usage.
- Password/email login handlers use typed form value contracts and `unknown` error boundaries.
- Login completion uses `LoginSessionResponse`; API responses are narrowed through `LoginApiResponse`.
- Email-code input ref is `InputRef | null`.
- `Login.test.tsx` rejects any `\bany\b` token in `Login.tsx` and keeps the typed `completeLogin(...)` contract guard.
- `CI=true npm test -- --runTestsByPath src/pages/Login.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Password login smoke | CURRENT_SOURCE_COVERED / AUTH E2E OPTIONAL | Keep standard successful password-login, failed password-login, stale-auth cleanup, and guest-cart merge smoke coverage. No new runtime behavior changed for frontend F961. |
| Email-code login smoke | CURRENT_SOURCE_COVERED / AUTH E2E OPTIONAL | Keep standard send-code, successful email-code login, invalid-code, retry countdown, and localized error smoke coverage. No new runtime behavior changed for frontend F961. |

## 2026-06-09 18:32 UTC F973 Critical Silent Catch Observability Handoff

Source status: QA F973 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current `Navbar.tsx`, `CustomerSupportWidget.tsx`, and `useAuth.ts` contain no `.catch(() => ...)` or bare `catch {` patterns.
- Navbar reports native Android download handoff failures and admin-access refresh failures through `reportNonBlockingError(...)` while keeping existing fallback UI/state.
- useAuth reports stored-profile hydration failures and logout revoke failures while still clearing stale auth state or warning on partial logout.
- CustomerSupportWidget reports support unread/session/history/mark-read/order-context/order-detail/close/switch fallback failures while preserving existing messages and optimistic rollback behavior.
- `sourceQuality.test.ts` guards the target files against silent catch reintroduction and requires the F973 diagnostic contexts.
- `useAuth.test.tsx` asserts profile hydration failure records `useAuth.hydrateStoredProfile`.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts src/components/Navbar.test.tsx src/components/CustomerSupportWidget.test.tsx src/hooks/useAuth.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router / AntD z-index warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Navbar admin-access refresh fallback | SOURCE_FIXED / NAV E2E RECOMMENDED | Sign in as admin, force `/users/profile` or admin permissions refresh to fail, and verify nav falls back to stored role/default admin path without breaking navigation while diagnostics capture `Navbar.refreshAdminAccess`. |
| Navbar Android download failure | SOURCE_FIXED / APP E2E OPTIONAL | In Android/native or mobile harness, force APK download handoff failure and verify the existing download-failed message appears and diagnostics capture `Navbar.openNativeAndroidDownload`. |
| Auth hydration/logout revoke failures | SOURCE_FIXED / AUTH E2E RECOMMENDED | With a stale token, force profile hydration failure and verify stale auth is cleared, user state resets, and diagnostics capture `useAuth.hydrateStoredProfile`. Force logout token revoke failure and verify local logout still completes with partial-failure warning and diagnostics. |
| Support widget best-effort failures | SOURCE_FIXED / SUPPORT E2E RECOMMENDED | Force support unread/session-history/mark-read/order-detail/close-session/switch-session failures. Verify user-facing recovery remains intact, optimistic close rolls back on failure, and diagnostics capture the relevant `CustomerSupportWidget.*` contexts. |

## 2026-06-09 18:26 UTC F974 Auth Form Label Accessibility Handoff

Source status: QA F974 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Login password username/password `Form.Item` fields now have localized visible labels while preserving contextual input `aria-label`/`title` values.
- Login email-code email/code `Form.Item` fields now have localized visible labels while preserving send-code and field accessible names.
- Register username/password/confirm-password/email/conditional email-code/phone `Form.Item` fields now have localized visible labels.
- `Login.test.tsx` and `Register.test.tsx` source guards require the expected label props on those named auth fields.
- `CI=true npm test -- --runTestsByPath src/pages/Login.test.tsx src/pages/Register.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Login password form labels | SOURCE_FIXED / AUTH A11Y E2E RECOMMENDED | Open `/login` on desktop and mobile, verify username/password labels are visible, associated with the inputs, do not overlap placeholders or validation errors, and the contextual screen-reader names still include the login context. |
| Login email-code form labels | SOURCE_FIXED / AUTH A11Y E2E RECOMMENDED | Switch to email-code login, verify email/code labels render correctly, the send-code addon remains reachable, validation errors attach to the right fields, and mobile layout does not clip the code input/addon row. |
| Register form labels | SOURCE_FIXED / AUTH A11Y E2E RECOMMENDED | Open `/register` in normal and email-code-required states, verify all visible labels render for username, password, confirm password, email, verification code, and phone, with no mobile overlap against the sticky register card/header. |
| Locale label smoke | SOURCE_FIXED / I18N A11Y E2E OPTIONAL | Repeat Login/Register label checks in English, Chinese, and Spanish, confirming localized label text fits and remains associated with the correct fields. |

## 2026-06-09 18:20 UTC F975 Named Page Recoverable Error Diagnostics Handoff

Source status: QA F975 PARTIAL_SOURCE_FIXED / REGRESSION_GUARD_ADDED for the named page/app scope. This handoff is superseded by the 2026-06-10 03:40 UTC F975 closure, which completed broader non-target `catch {}` triage.

Local verification already run:
- `App.tsx`, `ProductCompare.tsx`, `Checkout.tsx`, and `Profile.tsx` no longer use bare `catch {}` in the F975 named recoverable failure paths.
- Those paths now call `reportNonBlockingError(...)` with stable contexts before preserving existing UI fallback behavior.
- `sourceQuality.test.ts` rejects bare catches in the named target files and requires the F975 diagnostic contexts.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/App.test.tsx src/pages/ProductCompare.test.ts src/pages/Checkout.test.tsx src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed with existing React act / React Router warning noise.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Mobile update download/copy failure | PARTIAL_SOURCE_FIXED / APP E2E RECOMMENDED | In a native/mobile or browser harness, force download handoff and clipboard write failures. Verify the existing failure UI/toast still appears, the app does not crash, and non-blocking diagnostics capture `App.mobileUpdateDownload` and `App.copyDownloadLink`. |
| Product compare recoverable failures | PARTIAL_SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Force compare product loading and add-to-cart/bulk-add API failures. Verify the existing load/add failure messages remain visible, cart state is not corrupted, and diagnostics capture the ProductCompare contexts. |
| Checkout malformed storage fallbacks | PARTIAL_SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Seed malformed selected specs, payment poll result, and guest draft storage values. Verify checkout continues with the same fallback behavior, invalid guest drafts are removed where expected, and diagnostics capture the Checkout parse/hydration contexts. |
| Profile load failures | PARTIAL_SOURCE_FIXED / PROFILE E2E RECOMMENDED | Force profile and order list API failures. Verify existing profile/order failure messages still appear without stale state updates, and diagnostics capture `Profile.fetchUserInfo` and `Profile.fetchOrders`. |

## 2026-06-09 18:13 UTC Customer Support WebSocket Retry Limit Handoff

Source status: QA F976 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- CustomerSupportWidget uses shared `useReconnectingWebSocket(...)` rather than component-local reconnect timers.
- `useReconnectingWebSocket(...)` defaults to `MAX_RECONNECT_ATTEMPTS = 10`, stops scheduling retries after exhaustion, and calls `onReconnectExhausted` once.
- CustomerSupportWidget shows the existing connection-failed warning and logs `CustomerSupportWidget.websocketReconnectExhausted` with the attempt count.
- `CI=true npm test -- --runTestsByPath src/hooks/useReconnectingWebSocket.test.tsx src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed, with existing React act deprecation warning only.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer support retry exhaustion | CURRENT_SOURCE_COVERED / SUPPORT E2E RECOMMENDED | Open CustomerSupportWidget, force the support WebSocket endpoint to fail continuously, and verify reconnect attempts stop after the configured cap, the user sees the connection-failed warning once, and no repeated timers or duplicate sockets continue afterward. |
| Customer support recovery before exhaustion | CURRENT_SOURCE_COVERED / SUPPORT E2E RECOMMENDED | Force one or more disconnects, restore the WebSocket endpoint before retry exhaustion, and verify the widget reconnects, resets attempt state, sends/receives messages, and does not duplicate incoming rows. |
| Navigation/unmount during reconnect | CURRENT_SOURCE_COVERED / TIMER CLEANUP E2E OPTIONAL | Trigger a reconnect delay, close the widget or navigate away before the timer fires, and verify no late reconnect, state update after unmount, console error, or extra socket remains. |

## 2026-06-09 16:56 UTC Product Option Type Safety Handoff

Source status: QA F978 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `productOptions.ts` now normalizes option groups and variants from `unknown` with `isRecord(...)` guards instead of `any`.
- Malformed object-valued variant option values are still dropped, negative stock still clamps to zero, and variant image URL normalization still rejects unsafe data URLs while preserving persistent upload paths.
- `productOptions.test.ts` includes a source guard rejecting `any` in the utility and requiring the normalization entry points to accept `unknown`.
- `CI=true npm test -- --runTestsByPath src/utils/productOptions.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail option selection | SOURCE_FIXED / PRODUCT UI E2E RECOMMENDED | Open products with direct `optionGroups`, JSON `variants`, and legacy `specifications.options.*` fields. Verify option chips render, incompatible combinations disable/reset correctly, variant price/stock/image behavior remains correct, and Add to cart still blocks missing required selections. |
| Product List quick-add options | SOURCE_FIXED / PRODUCT LIST E2E RECOMMENDED | On Product List cards with option groups/variants, verify quick-add option controls still derive from the current product payload, reject impossible combinations, and add the intended selected specs to the cart. |
| Malformed option payload tolerance | SOURCE_FIXED / API/UI E2E OPTIONAL | Seed a product with malformed variant rows or object-valued option values in a controlled fixture. Verify storefront pages do not crash and bad option values are omitted from selectable options. |

## 2026-06-09 16:50 UTC Bounded Product FindAll And Import Scan Handoff

Source status: F3284 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- `ProductServiceImpl.findAll()` uses a bounded pageable repository read with `product.legacy-list-max-rows` clamped by hard limit 500; no no-arg `productRepository.findAll()` call remains in `ProductServiceImpl`.
- Legacy public and discount list helpers route through bounded public paged product queries.
- CSV variant-SKU duplicate detection scans paged `(id, variants)` rows instead of loading full product entities.
- `./mvnw -q -Dtest=ProductSearchServiceTest,ProductImportServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Legacy product list bounded runtime | CURRENT_SOURCE_COVERED / PERFORMANCE E2E OPTIONAL | In a large-catalog fixture, exercise any admin/runtime path that still calls legacy `ProductService.findAll()` and verify at most the configured capped first page is loaded. Capture SQL logs showing `LIMIT`/pageable behavior if available. |
| Public legacy list and discount bounded runtime | CURRENT_SOURCE_COVERED / STOREFRONT E2E OPTIONAL | Exercise storefront/home discount and legacy public product consumers with more rows than the configured cap. Verify response sizes stay bounded and product ordering remains stable. |
| CSV variant SKU import scan | CURRENT_SOURCE_COVERED / ADMIN IMPORT E2E OPTIONAL | Run product CSV preview/import against a catalog larger than one import scan page and verify duplicate variant SKU detection still works across pages without loading full product entities. |

## 2026-06-09 16:47 UTC Lightweight Product/Search List Payload Handoff

Source status: F3303 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- `/products` page responses and `/search` responses now serialize items through `ProductPublicListItemResponse` instead of the full rich product DTO.
- Lightweight list items preserve list-card and conversion fields: pricing, stock, category/image/images, featured/brand/tag, limited-time/effective discount fields, free-shipping data, reviews, public specifications, variants, option groups, and bundle data.
- Lightweight list items omit detail-only fields: `status`, `specificationItems`, `i18n`, `detailContent`, `localizedContent`, `warranty`, and `shipping`.
- `/products/{id}` still returns the full `ProductPublicResponse` rich detail payload.
- Frontend product list/page caching no longer populates product-detail cache from lightweight list results, so Product Detail fetches rich data after list/search browsing.
- `./mvnw -q -Dtest=ProductControllerPaginationTest,SearchControllerTest test` passed.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| `/products` payload shape and size | SOURCE_FIXED / PERFORMANCE E2E RECOMMENDED | Load Product List with representative products and inspect the network response. Verify list items exclude `detailContent`, `localizedContent`, `specificationItems`, `i18n`, `warranty`, `shipping`, and `status`, while card rendering, filters, variants/options, quick-add, bundle UI, pricing, review summaries, and free-shipping signals still work. Capture before/after or budgeted payload-size evidence if available. |
| `/search` payload shape and list behavior | SOURCE_FIXED / SEARCH E2E RECOMMENDED | Search by keyword and filter combinations, inspect `/search` responses, and verify the same lightweight payload contract plus pagination metadata. Confirm search cards remain usable and quick-add/filter behavior does not regress. |
| Product Detail rich-data fetch after list/search browsing | SOURCE_FIXED / DETAIL E2E REQUIRED | Browse Product List and Search first, then open a product detail page from each path. Verify the browser makes a detail request for `/products/{id}` and the detail page renders rich content, localized/detail blocks, warranty/shipping sections, and specifications from the rich payload rather than a cached lightweight list item. |
| Network/cache regression watch | SOURCE_FIXED / PERFORMANCE E2E OPTIONAL | In a long browsing session, alternate between list/search/detail views and verify detail data is not stale or missing, list caches still reuse list/page responses, and detail cache entries are populated only by detail responses. |

## 2026-06-09 16:36 UTC Grouped Stock Restoration And Customer Order Pagination Handoff

Source status: F3282 SOURCE_FIXED / REGRESSION_GUARD_ADDED; F3301 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Cancellation, return-refund finalization, and refund restock paths now call grouped `restoreStock(items)` instead of per-item loops.
- Simple-product restocks are aggregated by `productId` and restored with one atomic `ProductRepository.increaseStock(productId, totalQuantity)` per product.
- Selected-spec/variant restocks are grouped by `productId`, lock the product once, apply all variant JSON increments, and save once while keeping missing-product warnings item-specific.
- Customer `/orders/me` is already bounded through controller page/size handling, `OrderService.getOrdersByUserId(userId, page, size)`, repository `findByUserIdPage(...)`, and mapper `LIMIT/OFFSET`; source guards reject the old unbounded mapper path.
- `./mvnw -q -Dtest=OrderStockReservationServiceTest test` passed.
- `./mvnw -q -Dtest=OrderStatsServiceTest,OrderControllerCustomerPaginationTest test` passed.
- `./mvnw -q -Dtest=OrderStockReservationServiceTest,PaymentFlowServiceTest,OrderInputNormalizationServiceTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cancel pending-payment simple stock grouping | SOURCE_FIXED / INVENTORY E2E RECOMMENDED | Create or seed a pending-payment order with multiple simple lines for the same product, cancel it, and verify final product stock increases by the summed quantity exactly once. Capture SQL/query-count evidence if available to confirm one product stock update rather than one update per line. |
| Refund/return variant stock grouping | SOURCE_FIXED / INVENTORY E2E RECOMMENDED | Use an order containing multiple selected-spec lines for the same variant product, complete a refund or return-restock flow, and verify variant JSON stock and aggregate product stock semantics match checkout reservation reversal without duplicate or lost increments. |
| Missing product observability | SOURCE_FIXED / OPS E2E OPTIONAL | In a controlled fixture, delete or hide a product referenced by an order item before cancellation/refund restock. Verify the user/admin flow does not silently misreport success without server logs containing `productId`, `orderItemId`, and `quantity` for the skipped stock restoration. |
| Customer order pagination runtime | CURRENT_SOURCE_COVERED / ORDER E2E OPTIONAL | Seed more than one page of customer orders and call `/orders/me?page=0&size=20` and `/orders/me?page=1&size=20`. Verify bounded distinct pages, pagination headers, and no full account-history load in query logs if available. |

## 2026-06-09 16:29 UTC Admin Batch Product Status Bulk Update Handoff

Source status: F3306 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Admin `/admin/products/batch-status` now normalizes the request once and delegates to `ProductService.updateStatusByIds(...)`; the controller no longer performs per-product `findById(...).save(...)` work.
- `ProductServiceImpl.updateStatusByIds(...)` validates status, dedupes positive IDs, performs one bulk `ProductRepository.updateStatusByIdIn(...)` JPQL update, and clears product/category caches after product status visibility changes.
- `./mvnw -q -Dtest=ProductSaveServiceTest,AdminControllerProductStatusBatchTest test` passed.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin batch status performance | SOURCE_FIXED / ADMIN PERFORMANCE E2E RECOMMENDED | Seed at least 100 products, select a large visible batch in Product Management, run Approve/Reject/Deactivate, and verify the request completes without per-product latency growth or timeout. Capture SQL/query-count evidence if available. |
| Batch status result accounting | SOURCE_FIXED / ADMIN API E2E RECOMMENDED | Send a crafted batch payload containing valid IDs, duplicate IDs, malformed IDs, and a missing product ID. Verify response `success`, `failed`, `requested`, and audit metadata match the updated/failed counts. |
| Product visibility/cache freshness | SOURCE_FIXED / STOREFRONT E2E RECOMMENDED | Batch change products from `ACTIVE` to `INACTIVE`/`REJECTED`, then immediately reload storefront product list/detail/featured or search views. Verify hidden products disappear without waiting for stale product caches. Change them back to `ACTIVE` and verify they reappear. |

## 2026-06-09 16:21 UTC Bounded Customer-Owned Reads Handoff

Source status: F3283 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Customer orders are already paginated through `OrderService.getOrdersByUserId(...)`, `OrderRepository.findByUserIdPage(...)`, and `OrderMapper.xml` `LIMIT #{limit} OFFSET #{offset}`, with `OrderStatsServiceTest` coverage rejecting the old unbounded order mapper path.
- Wishlist and pet-profile mapper contracts now require `(userId, limit)`, and both XML `findByUserId` statements apply `LIMIT #{limit}`.
- `WishlistService` passes the configured `wishlist.max-items-per-user` cap, `PetProfileService` passes the configured `pet-profile.max-per-user` cap, and personalized recommendations load only that capped pet-profile window.
- `./mvnw -q -Dtest=WishlistServiceTest,PetProfileServiceTest,CustomerOwnedMapperLimitContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist bounded account read | SOURCE_FIXED / PERFORMANCE E2E RECOMMENDED | Seed more wishlist rows for one user than the configured `wishlist.max-items-per-user` cap, load `/wishlist/me` and the storefront Wishlist page, and verify the response/UI stay bounded, ordered newest-first, and responsive without loading every historical row. |
| Pet-profile bounded account read | SOURCE_FIXED / PROFILE E2E RECOMMENDED | Set a low `pet-profile.max-per-user` runtime value in an E2E harness, seed extra legacy rows for a user, load `/pet-profiles` and Profile pet management, and verify only the capped newest profiles are returned while normal add/edit/delete behavior remains usable. |
| Personalized recommendation pet-profile cap | SOURCE_FIXED / RECOMMENDATION E2E OPTIONAL | Seed many pet profiles for one user, open the personalized assistant/recommendation endpoint, and verify recommendation latency and query volume stay bounded while current in-cap profiles still influence product picks. |
| Customer order pagination watch | CURRENT_SOURCE_COVERED / ORDER E2E OPTIONAL | Keep existing `/orders/me` pagination smoke coverage with a user that has more orders than one page, confirming page size/offset behavior and no full account-history load. |

## 2026-06-09 16:15 UTC Product Options Mobile Release Recommendation Cache Handoff

Source status: F3397 WONTFIX / CURRENT_SOURCE_NON_ISSUE; F3398 SOURCE_FIXED / TARGETED_JEST_PASS; F3399 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED.

Local verification already run:
- Current `productOptions.ts` is a pure current-payload derivation helper and has no persistent product-options localStorage cache or stale option-cache key.
- Current mobile update tests use `currentMobileRelease` for generated fallback expectations; old `10023` / `1.0.23` values remain only as explicit runtime override fixtures.
- Current backend has no `ProductRecommendationsService` / Caffeine recommendation cache. Frontend API caches use bounded TTL helpers, and Product Detail session recommendations have TTL pruning plus a 50-entry LRU cap.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product option freshness | CURRENT_SOURCE_NON_ISSUE / PRODUCT E2E OPTIONAL | Change a product's option groups/variants in admin/API fixtures, reload Product Detail, and verify rendered options come from the latest product payload rather than stale browser storage. |
| Mobile release manifest fallback | SOURCE_FIXED / MOBILE E2E OPTIONAL | Compare `/downloads/mobile-version.json`, generated release metadata, and Android update prompt behavior after a release bump. Verify runtime-config override still wins when present and generated fallback follows the manifest when runtime values are invalid. |
| Recommendation cache long browsing | CURRENT_SOURCE_COVERED / PERFORMANCE E2E OPTIONAL | Browse more than 50 product-detail pages in one session and verify recommendation UI remains responsive, stale entries expire, and network/memory behavior does not grow unbounded. |

## 2026-06-09 16:12 UTC Checkout Price Authority And Store Scope Triage Handoff

Source status: F3394 WONTFIX / CURRENT_SOURCE_NON_ISSUE; F3395 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current backend source has no `CheckoutController`, `AdminOrderController`, `AdminProductController`, `StoreMemberRepository`, `Cart` entity, or `storeId`/`store_id` field on active cart/checkout/order request DTOs/entities.
- Current cart APIs scope requested user IDs through `SecurityUtils.requireUser(...)` / `assertSelf(...)`; checkout rejects selected cart items that do not belong to the checkout user before product locking, stock reservation, quote calculation, and cart deletion.
- Current checkout payloads do not accept `unitPrice`; direct legacy order creation is disabled; authenticated and guest checkout overwrite line prices from authoritative current product/variant price resolution before totals/order-item insertion.
- `./mvnw -q -Dtest=PaymentFlowServiceTest#checkoutUsesAuthoritativeProductPriceInsteadOfCartSnapshotPrice test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated checkout price authority | CURRENT_SOURCE_COVERED / CHECKOUT E2E RECOMMENDED | Add a product to cart, change the product or selected variant price through admin/API fixtures before checkout, then submit checkout. Verify order subtotal, total, payment amount, and order item snapshot use the current authoritative price rather than the stale cart display/snapshot price. |
| Crafted checkout payload price field | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | Send authenticated and guest checkout requests with extra `unitPrice`, `price`, `totalAmount`, or `lineTotal` fields. Verify the backend ignores unknown price fields or rejects malformed payloads cleanly, and persisted order amounts remain server-calculated. |
| Cross-user cart item isolation | CURRENT_SOURCE_COVERED / SECURITY E2E RECOMMENDED | Login as user A and user B. Attempt checkout for user A using user B's cart item IDs and verify the request fails without stock mutation, order creation, or cart deletion. |
| Store scope report recheck | CURRENT_SOURCE_NON_ISSUE / WATCHLIST | If a future marketplace/store-membership feature reintroduces `storeId`, add tenant-isolation E2E before release. Current source has no active `storeId` API surface to exercise. |

## 2026-06-09 16:08 UTC Gift Threshold And Error Response Safety Handoff

Source status: F3371/F3375 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Gift-at-checkout thresholds are now configured for every supported shopper currency (`MXN`, `USD`, `CAD`, `EUR`, `GBP`) through `conversionConfig.giftAtCheckout.thresholdsByCurrency`.
- `getGiftThreshold()` enables gifts only for supported currency codes with a positive configured threshold; unsupported currency values still return `0`.
- API error responses now suppress 5xx `ResponseStatusException` reasons, filter unsafe 4xx/internal details to generic client messages, log filtered details server-side with path/requestId, and preserve safe business/validation messages.
- `CI=true npm test -- --runTestsByPath src/utils/cartBenefits.test.ts src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=45000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -q -Dtest=GlobalApiExceptionHandlerTest test` passed, with expected log output from filtering tests.
- `./mvnw -q -DskipTests compile` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Multi-currency checkout gift thresholds | SOURCE_FIXED / CHECKOUT E2E REQUIRED | Switch currency between MXN, USD, CAD, EUR, and GBP. Add cart totals below, near, and above the gift threshold. Verify Cart, CartDrawer, Checkout savings coach, gift progress, and gift-unlocked modal consistently show/format the gift incentive for each supported currency without `$0.00` or hidden enabled-state drift. |
| Unsupported currency guard | SOURCE_FIXED / CONFIG E2E OPTIONAL | In a runtime/config harness, force an unsupported currency value and verify gift UI stays hidden while checkout/cart still render without crashes. |
| API unsafe error filtering | SOURCE_FIXED / SECURITY E2E REQUIRED | Trigger or mock 4xx errors whose internal reason contains config/secret/database/Redis/JDBC/path/URL details and verify the client receives a generic safe message while server logs retain diagnostic context with requestId/path. |
| API safe validation messages | SOURCE_FIXED / UX E2E REQUIRED | Exercise normal business validation failures such as insufficient stock, incorrect current password, coupon minimum, missing required request fields, and invalid checkout payloads. Verify user-facing messages remain specific enough for recovery and do not regress to generic copy. |
| API 5xx reason suppression | SOURCE_FIXED / SECURITY E2E REQUIRED | Trigger or mock a 5xx `ResponseStatusException` with an internal reason. Verify the JSON body exposes only `Internal server error` and contains no internal path/provider/config details, while alert/log capture contains the server-side exception. |

## 2026-06-09 08:05 UTC Sanitizer Auth Security Handoff

Source status: F3377/F3380/F3381 SOURCE_FIXED / REGRESSION_GUARD_ADDED; F3378 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED; F3379 backend service/import boundary backfilled after test engineer audit. F3375 was closed in the 2026-06-09 16:08 UTC error-response safety handoff.

Local verification already run:
- Notification rich-text sanitization now uses DOMPurify plus the existing strict tag/attribute/URL policy, and rejects a return to a custom template-only sanitizer.
- Auth session persistence stores normalized `email` and `phone` from login/refresh responses, clears them with auth storage, and profile hydration keeps those fields synchronized.
- Security responses include a restrictive `Permissions-Policy` header for sensitive browser features.
- Product service direct save and CSV import now reject 2001-character product image URLs before persistence, matching the 2000-character entity limit.
- Current `RateLimitService` already has dedicated guest checkout, guest order lookup, and guest order mutation buckets; no production behavior changed for F3378.
- `CI=true npm test -- --runTestsByPath src/utils/sanitizeHtml.test.ts src/api/index.test.ts src/hooks/useAuth.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -Dtest=ProductSaveServiceTest,ProductImportServiceTest,SecurityConfigCorsTest test` passed.
- `./mvnw -Dtest=RateLimitServiceTest test` passed, with the expected Redis fallback warning from the fallback test.
- Test engineer sub-agent `Einstein` completed regression; its remaining product image URL backend-limit finding was fixed in this pass.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Notification rich-text sanitizer | SOURCE_FIXED / SECURITY E2E RECOMMENDED | In `/admin/notifications`, preview and save HTML with safe headings/lists/links/images and malicious payloads (`script`, `svg`, event handlers, `javascript:`, credentialed/protocol-relative URLs). Verify safe formatting remains, executable content is absent, and `/notifications` renders the same sanitized content. |
| Auth session contact persistence | SOURCE_FIXED / AUTH E2E OPTIONAL | Log in by password and email-code, refresh the session, then inspect app behavior that depends on stored auth state. Verify `email`/`phone` remain available after login/refresh and are removed after logout/session expiry. |
| Security response headers | SOURCE_FIXED / SECURITY E2E OPTIONAL | In a running backend, request representative public and authenticated endpoints and verify `Permissions-Policy` is present with camera/microphone/geolocation/sensor restrictions without breaking checkout/payment pages. |
| Guest order rate limiting | CURRENT_SOURCE_COVERED / SECURITY E2E RECOMMENDED | Burst guest order lookup and guest cancel/confirm/return endpoints from the same client and verify rate-limit headers/429 behavior. Confirm normal low-volume guest checkout/order tracking still works. |
| Product image URL direct/import boundary | SOURCE_FIXED / ADMIN E2E RECOMMENDED | Through admin product API/UI and CSV import, verify 2000-character image URLs are handled consistently and 2001-character URLs fail as controlled validation errors before persistence. |

## 2026-06-09 07:39 UTC Search Auth Image Contract Fix Handoff

Source status: F3374/F3376/F3379 SOURCE_FIXED / REGRESSION_GUARD_ADDED. F3371 was closed in the 2026-06-09 16:08 UTC multi-currency gift-threshold handoff. Test engineer sub-agent `Turing` completed a read-only audit and recommended wildcard search, password-boundary, and admin image URL boundary E2E coverage.

Local verification already run:
- Product and category keyword search now escapes `%`, `_`, and `!` before repository lookups and CriteriaBuilder predicates, with repository queries using `LIKE ... ESCAPE '!'`.
- Frontend auth API calls reject passwords over 128 characters before Axios for register, login, forgot-password, and password-update requests; backend password update also rejects overlong current passwords before password matching.
- Admin product `imageUrl` normalization is aligned to the backend 2000-character product entity limit.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `./mvnw -Dtest=ProductSearchServiceTest,UserServiceTest test` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product/category wildcard keyword search | SOURCE_FIXED / SEARCH E2E RECOMMENDED | Search product/category terms containing `%`, `_`, and `!`. Verify those characters are treated literally, do not match the whole catalog, and still find products/categories whose stored text actually contains those characters. |
| Auth password length boundary | SOURCE_FIXED / AUTH API/UI E2E RECOMMENDED | Attempt register/login/forgot-password/password-update with 129+ character passwords and verify the UI/API path fails before sending oversized auth requests or returns a controlled validation error. Repeat with 128 characters on valid flows to confirm the boundary remains usable. |
| Admin product image URL boundary | SOURCE_FIXED / ADMIN API E2E OPTIONAL | Through admin product create/edit, submit an image URL at 2000 characters and verify it is accepted. Submit 2001+ characters and verify the frontend normalization/server validation handles it cleanly without persistence errors. |
| Coupon/admin wildcard search follow-up | OPEN FOLLOW-UP / SEARCH E2E OPTIONAL | If admin coupon or other management searches still use LIKE queries, test `%`, `_`, and `!` search terms there too and file a separate issue for any unescaped wildcard expansion. |

## 2026-06-09 07:29 UTC Checkout Cart Admin Contract Fix Handoff

Source status: F3368/F3369/F3372/F3373 SOURCE_FIXED / REGRESSION_GUARD_ADDED. F3371 was closed in the 2026-06-09 16:08 UTC multi-currency gift-threshold handoff.

Local verification already run:
- Backend `CheckoutRequest` rejects recipient names over 120 characters and recipient phones over 60 characters through Bean Validation.
- Admin coupon create/update payloads are normalized to the `CouponUpsertRequest` field whitelist and no longer submit entity-only fields.
- Guest pending-payment rollback refreshes current product snapshots before restoring guest cart prices, with bundle/variant/current effective price resolution and snapshot fallback on refresh failure.
- Cart item availability now treats known stock below requested quantity as unavailable, matching checkout purchasability.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts src/pages/Checkout.test.tsx src/utils/cartUi.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- `./mvnw -Dtest=OrderInputNormalizationServiceTest test` passed.
- User-requested UI designer sub-agent `Harvey` and test engineer sub-agent `Popper` both failed with upstream `502 Bad Gateway`; no independent sub-agent reports were available.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout recipient field boundaries | SOURCE_FIXED / CHECKOUT API E2E OPTIONAL | Submit authenticated checkout at 120-character recipient name and 60-character phone and verify it is accepted. Submit over-limit crafted payloads and verify controlled validation errors before persistence. |
| Admin coupon create/update payload contract | SOURCE_FIXED / ADMIN API E2E OPTIONAL | Through admin coupon UI/API, create and update full-reduction and discount coupons. Confirm request payloads include only DTO fields and normal oversized/cased inputs are normalized or rejected cleanly. |
| Guest pending-payment rollback price freshness | SOURCE_FIXED / CHECKOUT E2E RECOMMENDED | Start guest checkout, change product/variant/bundle price in admin or fixture, cancel pending payment, and verify restored guest cart uses the current price rather than the stale checkout snapshot. |
| Cart insufficient-stock availability | SOURCE_FIXED / CART E2E RECOMMENDED | Create a cart line where quantity exceeds current stock. Verify Cart marks it unavailable/insufficient and Checkout does not allow it as purchasable. |

## 2026-06-09 07:15 UTC Frontend Backend Contract Fix Handoff

Source status: F3359/F3361/F3366/F3367/F3370 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Frontend API normalization now matches backend limits: review comment 1000, product status 20, selectedSpecs 1000, guest checkout items 80.
- ProductReview UI remains capped at 1000 with count and pre-submit warning.
- Checkout skips the immediate duplicate coupon quote when the backend quote already returned the auto-selected coupon for the same cart/coupon key; manual coupon changes still re-quote.
- `CI=true npm test -- --runTestsByPath src/api/index.test.ts src/pages/Checkout.test.tsx src/components/ProductReview.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/components/ProductReview.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed after adding module export.
- `npx tsc --noEmit --pretty false` passed.
- Test engineer sub-agent `Pauli` failed with upstream `502 Bad Gateway`; no independent sub-agent report was available.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product review comment limit | SOURCE_FIXED / UI E2E OPTIONAL | On Product Detail, submit a review with exactly 1000 characters and verify success. Try pasting more than 1000 characters and verify the UI count/limit prevents a backend validation failure. |
| Admin product status and description boundaries | SOURCE_FIXED / ADMIN API E2E OPTIONAL | Through admin UI/API, save standard product statuses and verify payloads remain accepted. Attempt malformed oversized status via API and confirm frontend normalization/server validation produce a controlled failure or safe truncation. |
| Cart selectedSpecs boundary | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Add a product with many selected options/long specs and verify cart add succeeds only within the 1000-character backend contract; overlong specs should be normalized before request or rejected cleanly. |
| Guest checkout item count boundary | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Attempt guest checkout with 80 items and verify it can submit; attempt 81+ and verify the UI/API path does not send more than 80 or shows a controlled limit response. |
| Checkout coupon quote auto-select | SOURCE_FIXED / PERFORMANCE E2E OPTIONAL | In authenticated checkout with an available best coupon, inspect network calls and verify the initial quote is not immediately duplicated solely because auto-select set `selectedUserCouponId`. Manually changing/clearing coupon should still issue a fresh quote. |

## 2026-06-09 07:06 UTC UI Designer Findings Fix Handoff

Source status: F3360/F3362/F9202-F9204 SOURCE_FIXED / REGRESSION_GUARD_ADDED. Checkout non-MXN gift incentive display guard also source-fixed from UI designer review.

Local verification already run:
- Admin product description editor enforces the backend 1000-character limit with `maxLength`, `showCount`, Form validation, localized max-length copy, and API payload normalization.
- Product Detail Add to cart is disabled while required options are missing or the selected variant is unavailable on desktop and mobile; mobile out-of-stock `Notify me` remains usable.
- Home, Product List, and Cart loading states expose polite status/busy semantics, while shared skeleton visuals are hidden from assistive technology.
- Checkout gift incentive renders only when the active currency has a positive gift threshold.
- `CI=true npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx src/pages/ProductManagement.test.tsx src/pages/Checkout.test.tsx src/api/index.test.ts src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.
- Test engineer sub-agent attempts failed three times with upstream `502 Bad Gateway`; no independent sub-agent report was available.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail required-options Add to cart | SOURCE_FIXED / UI E2E REQUIRED | Open a product with required options on desktop and mobile widths. Before valid options are selected, verify Add to cart and Buy now are disabled and cannot submit; after valid options are selected, verify both enable unless stock/loading blocks them. For an out-of-stock product, verify Notify me remains reachable. |
| Admin product description limit | SOURCE_FIXED / ADMIN UI/API E2E OPTIONAL | In `/admin/products`, create/edit a product and type/paste more than 1000 characters in Description. Verify the editor shows the character count, prevents or reports over-limit input, and saved payload/server response does not fail validation. |
| Core loading skeleton accessibility | SOURCE_FIXED / ACCESSIBILITY E2E OPTIONAL | Force slow Home, Product List, and Cart loads. Verify assistive tooling announces a polite loading status and does not expose individual skeleton bars/cards as meaningless content. |
| Checkout non-MXN gift incentive | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Run Checkout with USD/CAD/EUR/GBP market currency and confirm the gift progress/remaining module is hidden rather than showing `$0.00` or an unreachable gift. Repeat MXN checkout to confirm the configured gift threshold still appears. |

## 2026-06-09 06:52 UTC Storefront Accessibility Stale-Target Triage Handoff

Source status: F1090-F1093 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production behavior changed.

Local verification already run:
- Current source has no stale `CouponInput.tsx`, `MobileNavigation.tsx`, `ProductFilter.tsx`, or `OrderTimeline.tsx` component targets.
- Checkout coupon selection is exposed as a named `Coupon: Select coupon` combobox.
- Mobile bottom navigation uses current `Navbar` bottom items and visible `:focus-visible` outlines.
- Product List color filters are labelled checkboxes with visible color names; decorative swatches are `aria-hidden`.
- Public Order Tracking journey is a semantic step list with labelled items and `aria-current="step"`.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx src/components/Navbar.test.tsx src/pages/ProductList.test.tsx src/pages/OrderTracking.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout coupon selection accessible name | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | In authenticated checkout with coupon data loaded, verify screen-reader tooling announces the coupon selector as `Coupon: Select coupon`, supports keyboard open/select/clear, and does not rely on placeholder-only naming. |
| Mobile bottom navigation focus ring | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | On mobile web and Android WebView widths, Tab through the bottom nav and confirm a visible focus indicator appears for each bottom item without clipping under the safe area. |
| Product List color filter names | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | Open Product List filters on desktop and mobile drawer. Verify color filters announce color names and that the visual swatch is not the only accessible content. |
| Order Tracking journey semantics | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | Track a paid/preparing/shipped/delivered order and verify the journey is exposed as a list of labelled steps with the current step indicated to assistive tech. |

## 2026-06-09 06:41 UTC Modal And Checkout Validation Accessibility Handoff

Source status: F1094/F1099 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production behavior changed.

Local verification already run:
- Current source has no stale `ConfirmDialog.tsx` or `CheckoutForm.tsx` file.
- Modal surfaces use AntD `Modal`/`Drawer`; custom `role="dialog"` sources are guarded to include `aria-modal`.
- Checkout failed-submit validation has both a polite status live region and field-level `aria-describedby` links for failed fields.
- Runtime coverage proves Email, Recipient, and Postal code `aria-describedby` references resolve to the corresponding validation messages after submit.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx src/utils/sourceQuality.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Modal and drawer focus containment | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E REQUIRED | Open representative AntD modals and drawers from checkout/product/profile/admin flows. Use keyboard-only Tab/Shift+Tab to verify focus remains within the active dialog/drawer, Escape/close controls work where intended, and background content is not reachable while the overlay is open. |
| Customer support custom dialog semantics | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | Open the customer support panel on mobile and desktop. Verify the dialog is announced with the support title, close control is named, and mobile modal semantics do not block message entry or order-share overlays. |
| Checkout field validation association | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E REQUIRED | Submit guest checkout with required fields empty. Verify screen-reader tooling exposes the live validation summary and each focused invalid field announces its own error through `aria-describedby` without losing keyboard focus. |

## 2026-06-09 06:33 UTC Admin And Login Accessibility Handoff

Source status: F1088 SOURCE_FIXED / REGRESSION_GUARD_ADDED; F1087 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Desktop and mobile AdminLayout menus now sit inside explicit `nav` landmarks with localized `adminLayout.navigation` labels.
- Current Login source has no stale `data-testid="guest-login-btn"` / unlabeled guest-login button.
- Login guest-friendly actions (register, track order, support/help) expose contextual accessible names and titles.
- `CI=true npm test -- --runTestsByPath src/components/AdminLayout.test.tsx src/pages/Login.test.tsx src/i18n.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin desktop navigation landmark | SOURCE_FIXED / ACCESSIBILITY E2E REQUIRED | Log in as an admin on desktop. Use accessibility tooling or screen-reader landmark navigation to verify the side menu is exposed as a named admin navigation region and still reports the selected route correctly. |
| Admin mobile drawer navigation landmark | SOURCE_FIXED / ACCESSIBILITY E2E REQUIRED | On mobile/tablet width, open the admin drawer and verify its menu is also exposed as a named navigation region, closes after navigation, and remains keyboard reachable. |
| Login guest-friendly actions | CURRENT_SOURCE_COVERED / ACCESSIBILITY E2E OPTIONAL | On `/login`, verify there is no unlabeled guest-login button. Confirm Register, Track order, and Help actions have understandable accessible names and remain reachable by keyboard on mobile and desktop. |

## 2026-06-09 06:23 UTC Flash Sale Pricing And Countdown Accessibility Handoff

Source status: F1089 SOURCE_FIXED / REGRESSION_GUARD_ADDED; F1109/F1118 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Product Detail limited-time countdown now becomes a polite live region only while an active countdown is present (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`).
- Current source has no `PromotionService.java` or `FlashSaleTimer.tsx` legacy path.
- `Product.getEffectivePrice()` dynamically returns `limitedTimePrice` only while `isActiveLimitedTimeDiscount()` is true; otherwise it returns base `price`.
- `ProductPricingContractTest` proves active limited-time price does not stack stored discount again and expired limited-time price reverts to base price/discount.
- `CI=true npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx src/utils/limitedTimeCountdown.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `./mvnw -q -Dtest=ProductPricingContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail active countdown accessibility | SOURCE_FIXED / ACCESSIBILITY E2E REQUIRED | Open a product with an active limited-time price and future end time. Verify the countdown is visible, updates without layout shift, and exposes a polite status/live region to screen-reader tooling. Static free-shipping/authentic promo copy should not be announced as a constantly changing live region. |
| Active limited-time price contract | CURRENT_SOURCE_COVERED / BUSINESS E2E OPTIONAL | Seed a product with `originalPrice=100`, `price=80`, `discount=20`, and active `limitedTimePrice=70`. Verify API/product detail/cart quick-add use `70.00` and display `30%` savings, not a second-discounted `56.00`. |
| Expired limited-time price contract | CURRENT_SOURCE_COVERED / BUSINESS E2E OPTIONAL | Move the same product's `limitedTimeEndAt` into the past and reload product detail/list/cart entry points. Verify price returns to `80.00`, active-limited flag is false, and ordinary discount display returns to `20%`. |

## 2026-06-09 06:15 UTC Source Hygiene And Runtime Config Triage Handoff

Source status: F1056-F1058 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production behavior changed.

Local verification already run:
- Frontend `src` and `scripts` contain no `eslint-disable` directives, and `sourceQuality.test.ts` now rejects reintroduction.
- Current source has no `RecommendationService.java`; public recommendation endpoints in `ProductController` route through `ProductServiceImpl.findPersonalizedRecommendations(...)` and `findRelatedProducts(...)`.
- `runtimeConfig.ts` is directly imported by API base URL setup, support WebSocket URL resolution, API gateway dispatching, and mobile-update URL logic.
- `CI=true npm test -- --runTestsByPath src/utils/sourceQuality.test.ts src/utils/runtimeConfig.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- `./mvnw -q -Dtest=CommerceLegacyIssueContractTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product recommendation endpoints | CURRENT_SOURCE_COVERED / E2E OPTIONAL | With a seeded user/pet profile and public catalog products, call `/products/personalized-recommendations` and `/products/{id}/recommendations`; verify responses are bounded, public/sellable, and shown on Product Detail without client errors. |
| Runtime API base URL override | CURRENT_SOURCE_COVERED / CONFIG E2E OPTIONAL | In a disposable runtime, set `window.__SHOP_RUNTIME_CONFIG__.apiBaseUrl` or the deployed runtime config file and verify API calls use that base URL while unsafe URL shapes are ignored. |
| Runtime support WebSocket override | CURRENT_SOURCE_COVERED / SUPPORT E2E OPTIONAL | Configure `supportWebSocketUrl`, open customer support, and verify the WebSocket connects to the configured endpoint and still authenticates/reconnects normally. |
| Runtime gateway/mobile URL smoke | CURRENT_SOURCE_COVERED / CONFIG E2E OPTIONAL | Enable gateway prefix in runtime config and verify routed API paths use the gateway. On mobile update checks, verify manifest/download URL normalization still resolves against the configured API base. |

## 2026-06-09 06:06 UTC Legacy Commerce Targets Triage Handoff

Source status: F1049-F1055 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED. No production behavior changed for F1049-F1052/F1054/F1055; F1053 has a source guard confirming current unknown-carrier fallback behavior.

Local verification already run:
- Current source has no `OrderReturnService`, `CheckoutService`, `ExpressService`, `OrderQueryPage`, or `AdminPricingAuditTest`.
- Active returns are order-level through `OrderService.requestReturn(Long, Long, String)` and `completeReturn(Long)`, with no exposed `orderItemIds`, `ReturnItem`, or `ReturnProduct` request path.
- Checkout sellability validation lives in `OrderService` and uses the current `ACTIVE` product contract instead of the stale `product.getStatus() == "APPROVED"` comparison.
- Product discount validation still rejects values outside `0..100`.
- `SupportWebSocketHandler` already extends `TextWebSocketHandler`.
- `LogisticsService` returns `TRACKING_UNAVAILABLE` for unknown carriers outside production.
- `./mvnw -q -Dtest=CommerceLegacyIssueContractTest,LogisticsServiceTest,OrderInputNormalizationServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order-level return lifecycle | CURRENT_SOURCE_COVERED / BUSINESS E2E OPTIONAL | Create or seed a paid/completed order, request a return with only order-level reason input, then run the supported admin/customer return lifecycle. Verify no item-id payload is required or accepted by the public flow and stock/restock behavior matches the current order-level contract. |
| Checkout sellability and stock guard | CURRENT_SOURCE_COVERED / BUSINESS E2E OPTIONAL | Try checkout with an inactive product, insufficient simple stock, and unavailable variant stock. Verify checkout is rejected with clear messaging; repeat with an active/in-stock product and verify order creation succeeds. |
| Unknown carrier tracking fallback | CURRENT_SOURCE_COVERED / LOGISTICS E2E OPTIONAL | In a non-production runtime, query tracking for an unknown carrier/tracking code and verify the response shows unavailable tracking guidance instead of a server error. In production-like runtime, separately verify provider configuration failures are surfaced as ops/config errors. |
| Admin pricing validation | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | In admin product create/edit/import flows, submit discounts below 0 and above 100 and verify validation rejects them without persisting invalid pricing. |
| Support WebSocket smoke | CURRENT_SOURCE_COVERED / SUPPORT E2E OPTIONAL | Connect customer/admin support clients, exchange text messages, force a reconnect if possible, and verify the TextWebSocketHandler-backed support channel still handles messages and session cleanup normally. |

## 2026-06-09 05:55 UTC Cart Delete And Monetary Rounding Handoff

Source status: F1047 CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED; F1048 SOURCE_FIXED / REGRESSION_GUARD_ADDED.

Local verification already run:
- Current cart deletion has no active `variantId` or `variant_id` delete SQL; single delete is by cart item id, and batch delete validates ownership before deleting ids.
- Cart totals, coupon quote subtotals, checkout shipping threshold line amounts, order item price snapshots, and frontend Cart/CartDrawer/Checkout line displays now use line-level cent rounding.
- Regression guards cover two `10.005 x 1` lines totaling `20.02` and reject legacy variant delete paths.
- `./mvnw -q -Dtest=CartServiceTest,CouponServiceTest,OrderInputNormalizationServiceTest test` passed.
- `CI=true npm test -- --runTestsByPath src/utils/cartUi.test.ts --watchAll=false --runInBand` passed.
- `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed.
- `CI=true npm test -- --runTestsByPath src/components/CartDrawer.test.ts --watchAll=false --runInBand --testTimeout=30000` passed.
- Targeted `CartCheckoutFlow.test.tsx` cart metrics/free-shipping tests passed.
- `./mvnw -q -DskipTests compile`, `npx tsc --noEmit --pretty false`, and `BUILD_PATH=/tmp/shoptest-rounding-f1048-build-2 MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Fractional-line cart amount contract | SOURCE_FIXED / BUSINESS E2E REQUIRED | Seed or create two cart lines with half-cent-equivalent prices, e.g. `10.005 x 1` twice or a variant/bundle price that reproduces the case. Verify Cart, CartDrawer, Checkout subtotal, coupon quote subtotal, free-shipping gap, created order original amount, and order item displays agree on line-level cent rounding (`20.02` for the canonical case). |
| Coupon threshold with fractional lines | SOURCE_FIXED / BUSINESS E2E REQUIRED | Use a coupon threshold around the rounded subtotal boundary. Verify eligibility and displayed discount are based on the backend quote subtotal and match the checkout UI. |
| Free-shipping threshold with fractional lines | SOURCE_FIXED / BUSINESS E2E REQUIRED | Put the rounded subtotal near global and product-level shipping thresholds. Verify Cart/CartDrawer progress, Checkout shipping fee, and created order shipping fee agree. |
| Same product, different selected specs remove-by-id | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Add the same product twice with different `selectedSpecs`, plus one null-specs row if available. Delete one cart item and verify only that id is removed while the other rows remain. |

## 2026-06-09 05:42 UTC Coupon Payable-Percent Contract Triage

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA/TEST F1046. No production behavior changed.

Local verification already run:
- Current coupon contract stores `discountPercent` as payable percent: `80` means pay 80% and save 20%.
- Backend `CouponService.calculateDiscount(...)` and frontend coupon-center/checkout/admin displays are aligned to that payable-percent contract.
- Added backend guard for `useCoupon(...)`: an 80-payable-percent coupon on `100.00` returns a `20.00` discount and marks the user coupon used.
- `./mvnw -q -Dtest=CouponServiceTest test` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon quote and checkout smoke | CURRENT_SOURCE_COVERED / E2E OPTIONAL | Keep normal coupon smoke coverage: create or seed an 80-payable-percent DISCOUNT coupon, quote a `100.00` cart, and verify UI/backend show `20.00` savings with `80.00` subtotal payable before shipping. |
| Admin coupon wording | CURRENT_SOURCE_COVERED / E2E OPTIONAL | In admin coupon create/edit, verify the field help/placeholder communicates the payable-percent convention clearly enough for operators, and coupon center/checkout labels show savings percent to shoppers. |

## 2026-06-09 05:30 UTC UI Audit Must-Fix Storefront Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for the UI designer agent must-fix pass. Audit evidence is in `/tmp/shoptest-ui-audit-2026-06-09T05-17-26-132Z/`.

Local verification already run:
- Product Detail mobile Web buybar now has final CSS precedence after the older fixed purchase bar closure.
- The Product Detail Buy now action includes `purchaseSelectionBlocked` on mobile and desktop.
- Cart route hides the mobile bottom nav so sticky cart summary/actions keep their own bottom safe area.
- Targeted ProductDetail/Navbar Jest, TypeScript, temp production build, and targeted diff-check passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail mobile Web buybar | SOURCE_FIXED / UI E2E REQUIRED | On 360-390px mobile browser widths, open a purchasable product detail page and verify the bottom purchase rail is fixed, inside safe-area bounds, not distorted, and shows Add to cart / Buy now as two full reachable actions with readable price/status. |
| Product Detail required-options guard | SOURCE_FIXED / UI E2E REQUIRED | Open a product with required options. Before selecting valid options, verify Buy now is disabled on both mobile buybar and desktop purchase controls and cannot submit. Select valid options and verify Buy now enables unless stock/loading state blocks it. |
| Android WebView product detail | SOURCE_FIXED / APP WEBVIEW E2E REQUIRED | Repeat Product Detail buybar checks in Android WebView/native shell, including safe-area bottom spacing and no overlap with navigation chrome. |
| Cart mobile bottom actions | SOURCE_FIXED / UI E2E REQUIRED | On mobile Web and Android WebView, open Cart with items and verify the sticky summary, Checkout button, quantity controls, and remove/save actions are not covered by the bottom nav. Confirm the app bottom nav is hidden on the cart route. |

## 2026-06-09 05:20 UTC Cart/Checkout Free-Shipping Policy Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA/TEST F2816. The original cart selected-address shipping-fee report is stale against current source, but Cart/CartDrawer/Checkout now have a concrete policy-alignment change that needs runtime validation.

Local verification already run:
- Backend cart responses expose product `freeShipping` and `freeShippingThreshold`.
- Guest cart snapshots preserve product-level free-shipping policy.
- Cart, CartDrawer, and guest Checkout use `deriveCartShippingSummary(...)`.
- Authenticated Checkout continues to use backend quote `shippingFee` as authoritative when ready.
- Targeted Jest, TypeScript, backend compile, backend DTO test, and targeted diff-check passed. Full `CartCheckoutFlow.test.tsx` still has a separate existing quantity-control timeout.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest item-level free shipping | SOURCE_FIXED / BUSINESS E2E PENDING | Add only products flagged `freeShipping=true` with subtotal below global threshold. Verify Cart and CartDrawer show free shipping unlocked, no add-on prompt for shipping, Checkout submit/payable excludes default shipping, and created order has `shippingFee=0`. |
| Guest product threshold | SOURCE_FIXED / BUSINESS E2E PENDING | Add products with `freeShippingThreshold` and quantities that first miss, then meet the product threshold. Verify progress/gap changes and final order shipping fee match backend. |
| Registered backend quote authority | SOURCE_FIXED / BUSINESS E2E PENDING | With logged-in user, verify Checkout waits for coupon/shipping quote and displays backend `shippingFee`; address selection should not claim address-specific rates unless a future API adds them. |
| Global free-shipping threshold | SOURCE_FIXED / BUSINESS E2E PENDING | Add mixed non-free-shipping items below and above global threshold. Verify Cart/CartDrawer progress, add-on prompt, Checkout payable, and order shipping fee agree. |

## 2026-06-09 05:05 UTC CORS Private-LAN Defaults Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED for QA F2815. This overlaps existing F2794/F9312 CORS handoffs; keep one deployed runtime CORS matrix before archival.

Local verification already run:
- Non-production fallback in `CorsOriginProperties` is loopback-only.
- Base/dev/YAML defaults exclude `10.*`, `172.*`, and `192.168.*` private-LAN wildcard origins.
- Explicit device testing requires `CORS_ALLOWED_ORIGIN_PATTERNS`.
- Production filtering rejects wildcard/local/private/non-HTTPS origins.
- `SecurityConfig` does not call `allowPrivateNetwork(true)`.
- `SecurityConfigCorsTest` and `ApplicationProfileContractTest` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Private-LAN rejection | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | In staging/production-like runtime without override, preflight from `http://10.0.0.5:3000`, `http://172.16.0.5:3000`, and `http://192.168.1.55:3000`; verify no credentialed allow-origin and no private-network CORS grant. |
| Allowed deployed origins | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | Preflight from configured HTTPS storefront/admin origins and verify exact allow-origin plus expected headers. |
| Explicit device override | CURRENT_SOURCE_COVERED / OPS E2E OPTIONAL | In disposable dev mode with one concrete LAN origin in `CORS_ALLOWED_ORIGIN_PATTERNS`, verify only that concrete origin is allowed and subnet wildcards remain absent. |

## 2026-06-09 05:03 UTC Admin Action Permission Matrix Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F2811. The report is stale against current source, but permission-matrix runtime probes are useful because this is admin-security critical.

Local verification already run:
- Product create/update require `products:write`.
- Coupon create/update require `coupons:write`.
- User status/address mutations require `users:status` / `users:write`; role-code changes require super admin.
- Order status transitions require `orders:payment`, `orders:fulfillment`, `orders:refund`, or `orders:status` based on the transition.
- Missing action permissions are denied through `adminRoleService.hasPermission(...)` and `HttpStatus.FORBIDDEN`.
- Regression guard: `AdminActionPermissionContractTest` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product/coupon mutation matrix | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | With a custom admin role lacking `products:write` and/or `coupons:write`, call product and coupon create/update APIs and verify 403. Then grant the permission and verify the same mutation succeeds. |
| User mutation matrix | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | With roles lacking `users:status` or `users:write`, attempt status and address updates. Verify 403 and no mutation. Verify privileged-target and self-change safeguards still apply. |
| Order transition matrix | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | Probe payment confirmation, shipment, return approval/completion, and generic status transitions using roles that have only one of the `orders:*` action permissions. Verify only the matching transition succeeds. |
| Admin UI controls | CURRENT_SOURCE_COVERED / ADMIN UI E2E OPTIONAL | In Product/Coupon/User/Order admin pages, confirm buttons/menus are hidden or disabled when the current admin lacks the matching action permission and reappear after permission grant. |

## 2026-06-09 04:57 UTC Admin User Update Mass-Assignment Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F2812. Runtime confirmation is required because this changes the admin user-edit contract and role demotion path.

Local verification already run:
- `PUT /admin/users/{id}` now accepts `@Valid AdminUserUpdateRequest` instead of the `User` entity.
- The admin update DTO exposes only `status` and `address`; unsupported fields are captured and rejected before persistence.
- Direct email/phone/role/roleCode/id/password/timestamp mutation through `updateUser` is removed.
- Role changes, including demotion to `USER`, go through `/admin/users/{id}/role-code`.
- Admin User Management shows email/phone read-only in the profile modal and submits only address; status updates still use `updateUser`.
- Guards passed: `AdminRequestValidationContractTest`, `AdminRoleServiceTest`, frontend `api/index.test.ts`, TypeScript, temp frontend production build, and targeted `git diff --check`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Crafted update payload | SOURCE_FIXED / SECURITY E2E REQUIRED | As an authenticated admin, send `PUT /admin/users/{id}` with `email`, `phone`, `role`, `roleCode`, `id`, password/timestamp fields, and optional valid `address`/`status`. Verify unsupported fields return a controlled 400 and none of those account identity/role fields mutate. |
| Admin profile modal | SOURCE_FIXED / ADMIN UI E2E REQUIRED | Open `/admin/users`, edit a user, verify username/email/phone are read-only and only address is editable/submitted. Save an address change and verify list/detail response updates only address. |
| Status update boundaries | SOURCE_FIXED / ADMIN UI/API E2E REQUIRED | Verify ACTIVE/BANNED toggles still work for permitted operators, while self-status changes, guest status changes, and non-super-admin status changes on privileged operators remain blocked. |
| Role assignment and demotion | SOURCE_FIXED / SECURITY E2E REQUIRED | As super admin, assign an admin/custom role and demote back to `USER` from the role-code select. Verify `role_code` is cleared on demotion. Verify a standard admin and self-targeted request cannot change roles. |

## 2026-06-09 04:47 UTC Payment Callback Signature Contract Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F2813. The reported unsigned `X-Internal-Call` callback subroutes are stale against current source, but integrated callback replay is still useful because this is payment-integrity critical.

Local verification already run:
- Current source has no `/payments/callback/{code}/success`, `/notify`, or `/cancel` endpoints and no `X-Internal-Call` callback confirmation path.
- Generic provider callbacks require `PaymentCallbackRequest.signature` and are handled by `PaymentService.handleCallback(...)`.
- The service verifies callback HMAC, freshness, amount, and provider transaction/reference consistency before updating payment/order state.
- Added runtime guard proving forged generic callback signatures do not mark payments, create reconciliation, or move orders.
- Added source-contract guard rejecting unsigned callback provider subroutes or `X-Internal-Call` reintroduction.
- `PaymentControllerSimulationAccessTest` and `PaymentFlowServiceTest` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Valid generic callback | CURRENT_SOURCE_COVERED / E2E OPTIONAL | Create a pending generic-provider payment, compute a valid callback signature from `payment.callback-secret`, POST `/payments/callback`, and verify payment/order transition normally. |
| Forged generic callback | CURRENT_SOURCE_COVERED / SECURITY E2E RECOMMENDED | Replay the same callback with a bad/missing signature and with an `X-Internal-Call` header. Verify the API rejects it and payment/order state is unchanged. |
| Legacy subroute absence | CURRENT_SOURCE_COVERED / SECURITY E2E OPTIONAL | Probe `/payments/callback/{code}/success`, `/notify`, and `/cancel`; verify they do not confirm payment and are not exposed as accepted provider callbacks. |
| Stripe webhook separation | CURRENT_SOURCE_COVERED / E2E OPTIONAL | Replay invalid Stripe signature and valid Stripe fixture separately to confirm generic callback HMAC cannot authenticate Stripe webhook payloads. |

## 2026-06-09 04:40 UTC Notification Rich-Text Sanitizer Allowlist Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F2814. Runtime confirmation is recommended because this affects admin notification HTML preview/save and customer notification rendering.

Local verification already run:
- `stripUnsafeHtml(...)` now uses an explicit rich-text tag/attribute allowlist instead of a blocklist.
- Executable/container tags are removed with content; unknown non-executable elements are unwrapped after child sanitization.
- Anchor URLs are restricted to relative/http/https/mailto/tel; image URLs are restricted to relative/http/https media.
- Inline styles, event handlers, `srcdoc`, protocol-relative URLs, credentialed URLs, control-character/backslash-obfuscated URLs, and invalid numeric attributes are stripped.
- `sanitizeHtml.test.ts` passed 10/10, frontend TypeScript passed, and targeted `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin notification HTML preview | SOURCE_FIXED / E2E REQUIRED | In `/admin/notifications`, enter safe rich text with headings, lists, links, and an https image. Verify preview keeps allowed formatting and strips class/style/event attributes. |
| Admin notification save and user render | SOURCE_FIXED / E2E REQUIRED | Save/send an HTML notification, then open `/notifications`; verify the rendered message matches the sanitized preview and links/images remain safe. |
| Malicious notification payloads | SOURCE_FIXED / SECURITY E2E REQUIRED | Try payloads with `javascript:`/protocol-relative/credentialed links, `svg`/`script`/`iframe`, inline event handlers, `srcdoc`, and oversized image dimensions. Verify executable content is absent and no script runs. |

## 2026-06-09 03:17 UTC antd Tree-Shaking Import Policy Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED / BUILD_VERIFIED for QA F3512. No browser E2E is required; this is a frontend build/import-policy guard.

Local verification already run:
- Added `npm run test:antd-tree-shaking`, which verifies the installed `antd` package has an ESM `module` entry and CSS-only `sideEffects`.
- The guard rejects side-effect/default/namespace `antd` imports, `antd/dist`, runtime CommonJS `antd/lib`, runtime `antd/es` deep imports outside type-only usage, and CommonJS `require('antd')` patterns.
- Existing named `antd` imports, runtime `antd/locale/*`, and type-only `antd/es/*` imports remain allowed.
- `npm run test:antd-tree-shaking` passed; `npm run test:bundle-analyzer` passed.
- Temp production build passed at `/tmp/shoptest-f3512-build`; bundle analyzer report was generated at `/tmp/shoptest-f3512-report` with existing warn-status bundle budgets.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| CI/build policy | SOURCE_FIXED / BUILD CHECK OPTIONAL | Add `npm run test:antd-tree-shaking` beside bundle analyzer checks in CI if the pipeline wants the antd import policy enforced every run. |
| Runtime UI | SOURCE_FIXED / NO DEDICATED E2E | No runtime behavior changed. Keep normal smoke coverage for pages using Ant Design components. |

## 2026-06-09 03:13 UTC ProductList Memoized Card Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3511. Runtime confirmation is optional; primary fix is adding a memoized Product List card item boundary without intended UX changes.

Local verification already run:
- Product grid cards now render through `ProductListCard = React.memo(...)` with a display name.
- The previous large inline `paginatedProducts.map((product, index) => { ... })` card block and `renderPrimaryAction` helper are absent.
- Card-facing callbacks/render helpers are stabilized with `useCallback`; cards receive per-product primitive states for wishlist, stock-alert, and compare labels where practical.
- Regression guard: `ProductList.test.tsx` requires the memoized card contract and rejects the old inline rendering pattern.
- Frontend verification: targeted ProductList Jest passed, `npx tsc --noEmit --pretty false` passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product card navigation and media | SOURCE_FIXED / E2E OPTIONAL | Open `/products`, verify card images, badges, product title/detail links, hover/focus prefetch behavior where observable, and pagination still work. |
| Product card actions | SOURCE_FIXED / E2E OPTIONAL | Exercise quick preview, quick add with and without options, wishlist toggle, compare, and stock-alert actions for in-stock and sold-out products. |
| Mobile product list | SOURCE_FIXED / E2E OPTIONAL | On mobile web/App WebView, verify Product List cards, mobile conversion bar, quick-add modal, preview modal, and filter drawer still layer above rails and keep touch targets readable. |

## 2026-06-09 03:05 UTC useEffect No-Cleanup Return Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3510. Runtime confirmation is optional; primary fix is React effect cleanup style normalization with no intended behavior change.

Local verification already run:
- Frontend `useEffect` callbacks no longer explicitly return `undefined` for no-cleanup early exits.
- Real cleanup functions for timers, intervals, DOM listeners, native listeners, mobile contrast guards, and polling locks remain intact.
- Regression guard: `reactEffectReturn.test.ts` parses production TS/TSX with the TypeScript AST and rejects `return undefined` inside `useEffect`/`React.useEffect` callbacks.
- Frontend verification: targeted Jest passed for the new guard plus Checkout/Profile source guards, and `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Mobile/native app shell guards | SOURCE_FIXED / E2E OPTIONAL | In mobile web/App WebView, navigate route changes and verify native/mobile body classes, contrast guard refresh, Android UI final guard, and native back handling remain unchanged. |
| Checkout/Profile payment timers | SOURCE_FIXED / E2E OPTIONAL | Run checkout payment creation/refresh and Profile continue-payment modal polling. Verify pending payments still refresh and cleanup on navigation/close behaves normally. |
| Auth-code countdowns and search debounce | SOURCE_FIXED / E2E OPTIONAL | Verify Login/Register/Forgot Password/Profile email-code countdown timers decrement and stop; verify SearchBar debounce still skips initial mount and fires after user input. |
| Support/product-detail overlays | SOURCE_FIXED / E2E OPTIONAL | Open support on mobile and Product Detail mobile gallery. Verify scroll lock, Escape handling, and touchmove cleanup behave as before. |

## 2026-06-09 03:00 UTC Product Detail Recommendation Cache Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3509. Runtime confirmation is optional; primary triage is that the reported component-local unbounded cache is stale against current source.

Local verification already run:
- `ProductDetail.tsx` no longer declares `const productRecommendationsCache =`.
- Recommendation cache behavior lives in `productDetailHelpers.tsx` with a 2-minute TTL and `PRODUCT_RECOMMENDATIONS_CACHE_MAX_ENTRIES = 50`.
- The helper prunes expired entries, refreshes recency on cache hits, evicts oldest entries while over cap, and clears the map through `clearProductDetailSessionCaches()` on auth-session changes.
- Regression guard: `ProductDetail.test.tsx` requires the helper-bounded cache contract and rejects a component-local cache reintroduction.
- Frontend verification: targeted ProductDetail Jest passed, `npx tsc --noEmit --pretty false` passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product-detail browsing session | CURRENT_SOURCE_COVERED / E2E OPTIONAL | Navigate through more than 50 distinct product detail pages and back to earlier products. Verify recommendation requests/responses still render normally and no visible stale recommendation set persists. |
| Auth-session change | CURRENT_SOURCE_COVERED / E2E OPTIONAL | Populate product recommendations, log out/log in as another user in the same tab, then revisit product details. Verify recommendations reload cleanly after the session change. |
| Expired recommendation cache | CURRENT_SOURCE_COVERED / E2E OPTIONAL | With a shortened TTL test harness or controlled clock, verify stale recommendation entries are refreshed instead of reused after expiry. |

## 2026-06-09 02:56 UTC Mobile Contrast Guard Scoped State Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3508. Runtime confirmation is optional; primary fix is scoping mobile contrast scheduler state to the installed guard element instead of module-level mutable variables.

Local verification already run:
- `mobileContrastGuard.ts` no longer declares module-level `let contrastScanTimer`, `contrastScanFrame`, `contrastMarkedElements`, or `lastMobileInteractionAt`.
- Guard state now lives in `MobileContrastGuardState` attached to the installed `shop-mobile-contrast-guard` style element.
- `refreshMobileContrastGuard()` initializes state before scheduling scans; install/uninstall and scroll/touch listeners read/cancel through the scoped state.
- Regression guard: `mobileContrastGuard.test.ts` rejects the old module-level mutable state and requires the scoped-state contract.
- Frontend verification: targeted Jest passed, `npx tsc --noEmit --pretty false` passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Android WebView route transitions | SOURCE_FIXED / APP E2E OPTIONAL | In native/mobile shell, navigate across Home, Product List, Product Detail, Cart, Checkout, Profile, and admin overlays if available. Verify text contrast attributes update without stale markings after route changes. |
| Quick scroll/touch during content changes | SOURCE_FIXED / APP E2E OPTIONAL | While scrolling/touching a long mobile page, trigger lazy content or modal/drawer updates. Verify contrast scan delay still prevents jank and text remains readable after the quiet period. |
| Guard cleanup/remount | SOURCE_FIXED / APP E2E OPTIONAL | Mount/unmount or hot-reload the app shell in a harness, then remount. Verify old timers/frames do not continue and no stale contrast attributes remain on removed DOM nodes. |

## 2026-06-09 02:53 UTC Order Expiry Transaction Boundary Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3507. Runtime confirmation is optional; primary fix is replacing `@Lazy` self-injection with an explicit transaction-template boundary.

Local verification already run:
- `OrderService` no longer imports `org.springframework.context.annotation.Lazy` and no longer declares `private OrderService self`.
- Scheduled unpaid-order expiry now calls `cancelSingleExpiredOrderInNewTransaction(...)`.
- Per-row transaction boundary: `cancelSingleExpiredOrderInNewTransaction(...)` uses `TransactionTemplate` with `TransactionDefinition.PROPAGATION_REQUIRES_NEW` when a transaction manager is available.
- Regression guard: `OrderStatsServiceTest.expiredOrderScanUsesTransactionTemplateInsteadOfLazySelfInjection()` rejects self-injection reintroduction and requires the transaction-template path.
- Backend verification: targeted `OrderStatsServiceTest` passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Expired unpaid order cancellation | SOURCE_FIXED / ORDER EXPIRY E2E OPTIONAL | Seed a pending-payment order older than `order.unpaid-timeout-minutes` with no active pending payment. Trigger or wait for the scheduler and verify the order becomes `CANCELLED`, stock/coupon restoration remains correct, and the scan continues. |
| Active pending payment guard | SOURCE_FIXED / ORDER EXPIRY E2E OPTIONAL | Seed an old pending-payment order with an active non-expired payment. Verify the scheduler leaves it unchanged. |
| Per-row failure isolation | SOURCE_FIXED / ORDER EXPIRY E2E OPTIONAL | With multiple expired orders, force one row to fail cancellation and verify later rows are still processed and the warning log identifies the skipped order. |

## 2026-06-09 02:50 UTC Stripe Webhook Signature Cause Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3506. Runtime confirmation is optional; primary fix is preserved backend exception cause for diagnostics.

Local verification already run:
- Payment service: `handleStripeWebhook(...)` now throws `new IllegalArgumentException("Invalid Stripe webhook signature", e)` when Stripe `Webhook.constructEvent(...)` fails.
- Public response contract: the normalized message remains `Invalid Stripe webhook signature`; the original failure is now retained as the exception cause for logs/alerts.
- Regression guard: `PaymentFlowServiceTest.stripeWebhookCompletedSessionRequiresStripeSignatureNotInternalCallbackSignature` asserts the message, non-null cause, and no payment/order repository side effects.
- Backend verification: targeted PaymentFlowServiceTest method passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Invalid Stripe signature | SOURCE_FIXED / WEBHOOK E2E OPTIONAL | POST a Stripe checkout payload with an invalid or non-Stripe signature header. Verify the endpoint still returns the same 400 JSON message and records payment failure telemetry. |
| Valid Stripe checkout completed webhook | SOURCE_FIXED / WEBHOOK E2E OPTIONAL | Replay a valid signed `checkout.session.completed` fixture. Verify order/payment state transitions are unchanged. |
| Stripe webhook secret missing | SOURCE_FIXED / WEBHOOK E2E OPTIONAL | Run with missing webhook secret and verify the endpoint still returns provider-unavailable/server-misconfiguration behavior, not the invalid-signature 400 path. |

## 2026-06-09 02:47 UTC Product URL Import Catch Observability Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3505. Runtime confirmation is optional; primary fix is backend debug observability and source guard coverage.

Local verification already run:
- Current source has no literal `catch (... ignored)` in `ProductUrlImportService`.
- Fallback observability: invalid URL normalization, DNS resolution failure, malformed media URL blocking, unsafe media-host resolution fallback, relative URL resolution fallback, price parsing fallback, and URL decode fallback now log debug context while preserving tolerant preview extraction.
- Regression guard: `ProductUrlImportServiceTest.productUrlImportExceptionFallbacksRemainObservable()` scans the service source and rejects future ignored catches or non-`ResponseStatusException` catch blocks without `log.` context.
- Backend verification: targeted `ProductUrlImportServiceTest` passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Valid product URL import | SOURCE_FIXED / IMPORT E2E OPTIONAL | Import a reachable supplier/product page through the admin product URL import UI/API. Verify preview name, price, description, and image extraction still work. |
| Metadata-poor or malformed product page | SOURCE_FIXED / IMPORT E2E OPTIONAL | Import a page with malformed JSON-LD or sparse metadata. Verify the preview falls back gracefully and backend logs contain diagnostic context without user-facing stack traces. |
| Blocked private/local URL | SOURCE_FIXED / IMPORT E2E OPTIONAL | Attempt import from localhost/private IP/non-standard port. Verify the API returns the normalized bad-request response and records diagnostic context. |
| Unsafe or malformed image URL fallback | SOURCE_FIXED / IMPORT E2E OPTIONAL | Import a page containing private/malformed image candidates. Verify unsafe images are blocked, preview warnings remain user-safe, and the import does not fail solely because optional images are invalid. |

## 2026-06-09 02:43 UTC ProductManagement Save Payload Typing Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3502. Runtime confirmation is optional; primary fix is TypeScript coverage of admin product create/update payloads.

Local verification already run:
- Shared payload type: `types.ts` now exposes `ProductMutationPayload` so nullable product rich fields can be cleared without page-level casts.
- API contract: `adminApi.createProduct(...)`, `adminApi.updateProduct(...)`, and `normalizeProductPayload(...)` accept `ProductMutationPayload`.
- Admin form contract: `ProductManagement.tsx` defines `ProductFormValues`, uses `Form.useForm<ProductFormValues>()`, and submits `const payload: ProductMutationPayload = { ... }`.
- Regression guard: `ProductManagement.test.ts` rejects reintroduced `const payload: any = {` and guards the page/API/type contract.
- Frontend verification: targeted ProductManagement Jest passed (5/5), `npx tsc --noEmit --pretty false` passed, isolated production build passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin product create | SOURCE_FIXED / ADMIN PRODUCTS E2E OPTIONAL | Create a product with main image, gallery images, localized fields, specs, warranty/shipping, and an active status. Verify the saved product appears in the list/detail with the expected payload fields. |
| Admin product edit rich content | SOURCE_FIXED / ADMIN PRODUCTS E2E OPTIONAL | Edit an existing product's rich detail blocks, gallery images, brand/tag, free-shipping fields, and limited-time discount. Verify create/update payload normalization still preserves and clears fields as expected. |
| Admin product variants | SOURCE_FIXED / ADMIN PRODUCTS E2E OPTIONAL | Generate variants from option groups, sync stock from variants, save, reload, and verify variant options/prices/stock round-trip correctly. |
| Stale product update conflict | SOURCE_FIXED / ADMIN PRODUCTS E2E OPTIONAL | With two admin sessions editing the same product, save one session then submit the stale modal in the other. Verify the existing conflict/stale-update UX still triggers and list refresh remains safe. |

## 2026-06-09 02:36 UTC Login completeLogin Typing Triage

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3503. No new runtime behavior changed.

Local verification already run:
- Current `Login.tsx` defines `LoginSessionResponse` and `LoginApiResponse`.
- `completeLogin` is typed as `const completeLogin = async (responseData: LoginSessionResponse) => {`; the reported `responseData: any` signature is absent.
- Password and email login paths cast API responses to `LoginApiResponse` before passing `response.data` into `completeLogin(...)`.
- Regression guard: `Login.test.tsx` rejects reintroduced `completeLogin(...: any)` and guards the typed session response contract.
- Frontend verification: targeted Login Jest passed (8/8), and `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Password login smoke | CURRENT_SOURCE_COVERED / AUTH E2E OPTIONAL | Keep standard successful password-login and failed-login localization smoke coverage. No new behavior was changed for F3503. |
| Email-code login smoke | CURRENT_SOURCE_COVERED / AUTH E2E OPTIONAL | Keep standard successful email-code login and invalid-code smoke coverage. No new behavior was changed for F3503. |

## 2026-06-09 02:33 UTC Checkout Form Values Typing Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3504. Runtime confirmation is optional; primary fix is TypeScript coverage of checkout form submit values.

Local verification already run:
- Checkout form contract: `Checkout.tsx` now defines `CheckoutFormValues`, `CheckoutFormSnapshot`, and `CheckoutFormFieldName` for guest/contact/address/payment fields.
- AntD form typing: `CheckoutFormInstance` is `FormInstance<CheckoutFormValues>` and the page calls `Form.useForm<CheckoutFormValues>()`.
- Submit helpers: `buildAddress(...)`, `buildRecipientPayload(...)`, and `handleSubmit(...)` accept `CheckoutFormValues`, while field values remain `unknown` until existing checkout normalizers validate them.
- Regression guard: `Checkout.test.tsx` rejects reintroduced F3504 `values: any` submit signatures and broad checkout snapshot refs.
- Frontend verification: targeted Checkout Jest passed (17/17), `npx tsc --noEmit --pretty false` passed, isolated production build passed, targeted static search in `Checkout.tsx` passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest manual-address checkout | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | As a guest, submit checkout with email, recipient, phone, region, postal code, detail address, and an available payment method. Verify order creation, guest support context, and payment creation still work. |
| Authenticated saved-address checkout | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Sign in, select an existing saved address and an available payment method, then submit checkout. Verify the selected saved address payload and payment creation still work. |
| Authenticated new-address checkout | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Sign in, switch to `Use new address`, fill manual address fields, select payment, and submit. Verify normalized address/recipient fields reach the order API. |
| Checkout draft persistence | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | As a guest, type partial contact/address fields, reload checkout, complete the form, and submit. Verify persisted draft values hydrate and do not overwrite later user edits. |

## 2026-06-09 02:26 UTC Frontend Error Handling Consistency Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3501. Runtime confirmation is optional but recommended for affected user-facing error flows.

Local verification already run:
- Shared helper: `frontend/src/utils/apiError.ts` now exposes `getApiErrorDiagnosticText(...)` for classifier-only text extraction and an explicit `includeClientMessage` option for local `Error` messages.
- Logistics tracking: `SeventeenTrackWidget.tsx` classifies provider-configuration errors through the diagnostic helper, keeps the no-data fallback, and does not display raw provider setup text.
- Registration: `Register.tsx` uses the diagnostic helper for duplicate phone/email/username mapping and continues to show localized field errors.
- Profile payments: `Profile.tsx` uses shared `getApiErrorMessage(..., { includeClientMessage: true })` for local continue-payment validation errors instead of inline `err.message` branching.
- Regression guard: `apiError.test.ts` rejects direct `response.data.error`/`response.data.message` parsing and inline `message.error(err.message)`-style handling in the touched flows.
- Frontend verification: targeted Jest passed (19/19), `npx tsc --noEmit --pretty false` passed, isolated production build passed, targeted static search passed, and `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Logistics provider not configured | SOURCE_FIXED / TRACKING E2E OPTIONAL | Force `/logistics/track` to return a provider-configuration error. Verify the widget shows the clean no-data state, not raw backend/provider setup text, in each supported locale. |
| Registration duplicate fields | SOURCE_FIXED / AUTH E2E OPTIONAL | Try duplicate phone, email, and username registrations plus invalid/required email-code cases. Verify the correct form field receives the localized error and the toast matches the field message. |
| Profile continue-payment local validation | SOURCE_FIXED / PROFILE PAYMENT E2E OPTIONAL | Remove/disable usable payment channels for an unpaid order and trigger continue/refresh payment. Verify the user sees the localized payment-unavailable/continue-payment message without raw API parsing drift. |

## 2026-06-09 02:20 UTC Empty Catch Observability Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3526. Runtime confirmation is optional; primary fix is source observability and static guard coverage.

Local verification already run:
- Current source scan: parser-based scan over `frontend/src` and `src/main/java` reports `empty_or_comment_only_catch=0` for both `catch (...) {}` and TypeScript `catch {}` forms.
- Frontend observability: best-effort fallbacks in App native release listeners, runtime WebSocket URL resolution, auth cleanup/events, checkout cart session storage, mobile update manifest/download fallback, catalog snapshot, and product view preferences now call `reportNonBlockingError(...)` instead of silently swallowing failures.
- Backend observability: optional schema hardening, Nacos startup config fallback, logistics date parsing, wishlist/gallery idempotent duplicate actions, order expiry scan skips, product import transaction/malformed variant fallbacks, and gateway host validation now log context instead of empty catch bodies.
- Validation behavior: malformed admin bug attachment URLs now throw the same normalized validation error with the URI parse cause.
- Regression guard: `EmptyCatchBlockContractTest` scans Java and frontend production sources and rejects future empty/comment-only catch blocks.
- Backend verification: `./mvnw -q -Dtest=EmptyCatchBlockContractTest test`, targeted backend service tests, and `./mvnw -q -DskipTests compile` passed.
- Frontend verification: targeted Jest for runtime/storage/mobile/catalog preference utilities plus App passed (52/52), `npx tsc --noEmit --pretty false` passed, and isolated production build passed.
- Diff check: `git diff --check` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Restricted browser storage fallback | SOURCE_FIXED / FRONTEND E2E OPTIONAL | In a browser profile or harness that blocks local/session storage, exercise logout/session expiry, checkout cart selection, product list/detail browsing, and catalog continuity. Verify pages do not crash and non-blocking diagnostics are observable in console/log capture. |
| Mobile update fallback | SOURCE_FIXED / APP/BROWSER E2E OPTIONAL | Force mobile manifest fetch failure and external download handoff failure. Verify the app falls back cleanly without a blank screen and emits non-blocking diagnostics. |
| Backend startup schema hardening | SOURCE_FIXED / BACKEND E2E OPTIONAL | Start against a database where optional columns/indexes already exist or cannot be altered. Verify startup continues and debug diagnostics identify skipped optional schema hardening. |
| Idempotent duplicate actions | SOURCE_FIXED / API E2E OPTIONAL | Race duplicate wishlist adds and pet-gallery likes for the same user/viewer. Verify API behavior remains idempotent/user-visible success while diagnostics record the duplicate path. |

## 2026-06-09 02:09 UTC Checkout/Profile Phone Normalization Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3525. Runtime confirmation is optional but recommended for Checkout/Profile phone parity.

Local verification already run:
- Shared helper: `frontend/src/utils/phone.ts` owns phone control-character stripping, input-text normalization, likely-phone validation, final phone normalization, and configurable digit/input-length options.
- Updated Checkout: `Checkout.tsx` uses the shared helper for guest/saved-address phone normalization with the existing 6-20 digit Checkout/Profile policy.
- Updated Profile: `Profile.tsx` uses the shared helper for profile phone edits and saved-address phone edits; phone input max length now matches the shared 40-character limit.
- Source guard: `phone.test.ts` rejects reintroduced local Checkout/Profile phone regexes and control-character strippers; remaining page-local wrappers only delegate to the shared helper with page-specific options.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/utils/phone.test.ts src/pages/Checkout.test.tsx src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (27/27).
- TypeScript: `npx tsc --noEmit --pretty false` passed.
- Production build: `BUILD_PATH=/tmp/shoptest-f3525-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with existing Browserslist staleness and bundle-size advisory output only.
- Diff check: `git diff --check -- QA_ISSUES.md TEST_ISSUES.md E2E_TEST_ENGINEER_ISSUES.md frontend/src/utils/phone.ts frontend/src/utils/phone.test.ts frontend/src/pages/Checkout.tsx frontend/src/pages/Profile.tsx` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest checkout phone normalization | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | On `/checkout` as a guest with manual address entry, enter phones containing spaces, dashes, parentheses, a leading plus, and pasted control characters. Verify valid phones are saved normalized and invalid phones remain user-readable with validation feedback. |
| Saved-address checkout phone parity | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Select and edit a saved address during checkout, change only the phone format, and verify Checkout applies the same normalization/validation as the guest manual address flow. |
| Profile phone edit | SOURCE_FIXED / PROFILE E2E OPTIONAL | In `/profile`, edit the account phone with the same valid/invalid formatting cases and verify Profile stores/displays the same normalized value that Checkout would accept. |
| Profile address phone edit | SOURCE_FIXED / PROFILE E2E OPTIONAL | Edit a saved address phone in Profile with whitespace, punctuation, and leading-plus cases. Verify the saved address round-trips cleanly and later appears in Checkout without extra formatting drift. |

## 2026-06-09 02:02 UTC Cart Quantity Sync Hook Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3524. Runtime confirmation is optional but recommended for Cart/CartDrawer checkout parity.

Local verification already run:
- Shared hook: `frontend/src/hooks/useCartQuantitySync.ts` owns authenticated cart quantity debounce, per-item request versions, in-flight promise tracking, cancellation, timer cleanup, unmount cleanup, and checkout-before-navigation flush.
- Updated Cart page: `Cart.tsx` uses the shared hook and keeps its array-shaped `updatingItemIds` UI state.
- Updated CartDrawer: `CartDrawer.tsx` uses the shared hook and keeps its map-shaped `updatingQuantityIds` UI state.
- Source guard: `cartTimerCleanup.test.ts` rejects reintroduced component-local `quantityTimersRef`, `quantityRequestPromisesRef`, `quantityRequestVersionRef`, local `clearQuantityTimer`, and local flush implementations in Cart/CartDrawer.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/hooks/useCartQuantitySync.test.tsx src/utils/cartTimerCleanup.test.ts src/components/CartDrawer.test.ts src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (31/31).
- TypeScript: `npx tsc --noEmit --pretty false` passed.
- Production build: `BUILD_PATH=/tmp/shoptest-f3524-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with existing Browserslist staleness and bundle-size advisory output only.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart rapid authenticated quantity edits | SOURCE_FIXED / CART E2E OPTIONAL | On `/cart`, rapidly type/tap quantity changes for an authenticated cart item and verify only the final quantity persists, the syncing indicator clears, and no duplicate cart-updated effects occur. |
| CartDrawer rapid authenticated quantity edits | SOURCE_FIXED / CART DRAWER E2E OPTIONAL | In CartDrawer, rapidly change quantity and verify only the final value persists, drawer subtotal/line total stay consistent, and `View full cart` shows the same final quantity. |
| Pending quantity cancellation | SOURCE_FIXED / CART E2E OPTIONAL | Start a delayed quantity sync, then delete the item or Save for later before the debounce/API resolves. Verify no late quantity sync resurrects the item, no stale toast appears, and pending state clears. |
| Checkout quantity flush | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Start checkout immediately after a pending quantity edit from both `/cart` and CartDrawer. Verify navigation waits for the final quantity sync and checkout receives the final normalized item quantity. |

## 2026-06-09 01:54 UTC Support WebSocket Reconnect Hook Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3523. Runtime confirmation is optional but recommended for customer/admin support reconnect parity.

Local verification already run:
- Shared hook: `frontend/src/hooks/useReconnectingWebSocket.ts` owns WebSocket creation, exponential-backoff reconnect scheduling, retry exhaustion, timer cleanup, and socket close cleanup.
- Updated customer support: `CustomerSupportWidget.tsx` uses the shared hook and keeps its existing customer support payload handling in `onMessage`.
- Updated admin support: `SupportManagement.tsx` uses the shared hook and keeps its existing admin queue/message payload handling in `onMessage`.
- Source guard: `useReconnectingWebSocket.test.tsx` rejects reintroduced component-local reconnect timers/attempt refs/backoff imports in both support surfaces.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/hooks/useReconnectingWebSocket.test.tsx src/components/CustomerSupportWidget.test.tsx src/pages/SupportManagement.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (12/12).
- TypeScript: `npx tsc --noEmit --pretty false` passed.
- Production build: `BUILD_PATH=/tmp/shoptest-f3523-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with existing Browserslist staleness and bundle-size advisory output only.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer support WebSocket reconnect | SOURCE_FIXED / SUPPORT E2E OPTIONAL | Open the storefront support widget as an authenticated customer, force-close or fail the support WebSocket, and verify the widget shows reconnecting/offline state, reconnects after backoff, receives/sends messages after reconnect, and does not duplicate incoming messages. |
| Admin support WebSocket reconnect | SOURCE_FIXED / ADMIN SUPPORT E2E OPTIONAL | Open Support Management as an admin, force-close or fail the support WebSocket, and verify reconnect restores queue/message realtime updates without losing selected-session context or duplicating unread/message updates. |
| Support WebSocket quick navigation cleanup | SOURCE_FIXED / SUPPORT E2E OPTIONAL | Start a forced WebSocket reconnect delay, navigate away or close the support panel before the reconnect fires, and verify no late reconnect, no unmounted-state warning, and no socket remains open. |

## 2026-06-09 01:43 UTC Admin Keyword Debounce Hook Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3522. Runtime confirmation is optional but recommended for admin list search parity.

Local verification already run:
- Shared hook: `frontend/src/hooks/useDebounce.ts` owns the default 300ms debounce behavior and optional debounced callback.
- Updated pages: Announcement, Bug, Coupon, Order, Pet Gallery, Product, and Review management now use the shared hook instead of page-local `setDebounced...` timeout effects.
- Product search still resets to page 1 when the debounced search value publishes.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/hooks/useDebounce.test.tsx src/pages/AnnouncementManagement.test.ts src/pages/BugManagement.test.ts src/pages/CouponManagement.test.tsx src/pages/OrderManagement.test.ts src/pages/PetGalleryManagement.test.ts src/pages/ProductManagement.test.ts src/pages/ReviewManagement.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (22/22).
- TypeScript: `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin keyword debounce parity | SOURCE_FIXED / ADMIN E2E OPTIONAL | On Announcement, Bug, Coupon, Order, Pet Gallery, Product, and Review management pages, type multi-character keywords quickly and verify only the final trimmed keyword drives the API/search result after the debounce delay. |
| Admin search with filters and pagination | SOURCE_FIXED / ADMIN E2E OPTIONAL | Combine keyword search with status/category/source/filter controls and pagination on the affected pages. Verify filter changes still reset/load expected first-page results and Product search still resets to page 1 after the debounced keyword publishes. |

## 2026-06-09 01:37 UTC Cart Quantity Normalization Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3521. Runtime confirmation is optional but recommended for Cart/CartDrawer parity.

Local verification already run:
- Shared source: `cartUi.ts` owns `getCartQuantityLimit`, `getCartLineQuantity`, and `normalizeCartQuantity`.
- Cart parity: `Cart.tsx` and `CartDrawer.tsx` import shared quantity helpers; neither defines local `normalizeCartQuantity` anymore.
- Behavior change: CartDrawer unknown/invalid stock max now matches Cart page fallback max quantity 99.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/utils/cartUi.test.ts src/utils/cartTimerCleanup.test.ts src/components/CartDrawer.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (10/10).
- TypeScript: `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart and drawer stock-capped quantity edits | SOURCE_FIXED / CART E2E OPTIONAL | In authenticated and guest cart flows, edit quantities from both `/cart` and CartDrawer for stock `3`, stock `0`, unknown stock, and invalid-stock fixtures. Verify both surfaces clamp to the same values, unknown stock maxes at 99, and unavailable items remain non-checkoutable. |
| Cart and drawer rapid quantity edits | SOURCE_FIXED / CART E2E OPTIONAL | Rapidly type and tap quantity controls in Cart and CartDrawer, then checkout. Verify only the final normalized quantity is persisted and selected checkout rows use the same normalized quantity. |

## 2026-06-09 01:33 UTC Auth Expired Helper Duplication Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE / REGRESSION_GUARD_ADDED for QA F3520. No new runtime E2E scenario is required because no production behavior changed.

Local verification already run:
- Static source check: only `Checkout.tsx` defines `const isAuthExpiredError =`; `Profile.tsx` and `OrderTracking.tsx` do not define or call the helper.
- Source guard: `authRedirect.test.ts` now rejects duplicate `isAuthExpiredError` definitions across Checkout/Profile/OrderTracking.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/utils/authRedirect.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (4/4).
- TypeScript: `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Expired session redirects | CURRENT_SOURCE_NON_ISSUE / COVERED BY EXISTING AUTH E2E | Reuse the existing expired-token checkout/profile/order-tracking/login redirect regressions; no new scenario is needed for F3520 because the change only guards against duplicate helper definitions. |

## 2026-06-09 01:30 UTC Cart/AdminLayout Lifecycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3518/F3529. Runtime confirmation is optional.

Local verification already run:
- Static source check: `Cart.tsx` debounced authenticated quantity sync checks `mountedRef.current` and per-item request version in `.then(...)`, `.catch(...)`, and `.finally(...)` before cart events, error messages, cart reloads, or updating loading state.
- Static source check: `AdminLayout.tsx` support unread polling checks a local `disposed` flag before success/failure state writes, removes `visibilitychange`, and clears the 15s interval on cleanup.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/utils/cartTimerCleanup.test.ts src/components/AdminLayout.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (6/6).
- TypeScript: `npx tsc --noEmit --pretty false` passed.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart debounced quantity quick navigation | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Edit an authenticated cart item quantity, delay `cartApi.updateQuantity`, navigate away before the debounce/API resolves, and verify no late quantity toast, cart reload, loading-state update, or unmounted-state warning appears. |
| AdminLayout unread quick navigation | CURRENT_SOURCE_COVERED / ADMIN E2E OPTIONAL | Open an admin page with support access, delay `/admin/support/unread-count`, navigate away or log out before the response resolves, and verify no late unread badge update or unmounted-state warning appears. |

## 2026-06-09 01:27 UTC SupportManagement Polling Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED for QA F3517 SupportManagement polling report. Runtime confirmation is optional.

Local verification already run:
- Static source check: `SupportManagement.tsx` polling interval checks `disposed || polling`, passes `isActive: () => !disposed` into `loadSessions(...)`, checks `disposed` after session refresh and after message fetch before state setters, and cleanup clears the interval.
- Existing source guard: `SupportManagement.test.tsx` already asserts the polling cleanup/disposed contract.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/pages/SupportManagement.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (4/4).

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin support polling quick navigation | CURRENT_SOURCE_COVERED / SUPPORT E2E OPTIONAL | Open Support Management with delayed session/message APIs, navigate away while a poll is in flight, and verify no unmounted-state warning, no late message merge, and no continued polling after leaving. |

## 2026-06-09 01:26 UTC Profile Payment Timer Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3519/F3528 Profile payment timer reports. Runtime confirmation is optional.

Local verification already run:
- Static source check: `Profile.tsx` has no `window.location.href` / `location.href` payment redirect and no `setTimeout(... window.location ...)` delayed redirect pattern.
- Static source check: payment-modal polling uses `isActive()` backed by `disposed` and `mountedRef`, checks lifecycle state after the joined order/payment fetch before state setters, and cleanup clears the 5s interval.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand --testTimeout=30000` passed (5/5).

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile payment quick navigation | CURRENT_SOURCE_COVERED / PAYMENT E2E OPTIONAL | Open a pending-payment order in Profile, delay payment/order refresh responses, close the modal or navigate away before the next poll tick, and verify no late redirect, no unmounted-state warning, and no continued payment polling after leaving. |

## 2026-06-09 01:22 UTC Checkout Payment Timer Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3516/F3527 Checkout payment timer reports. Runtime confirmation is optional.

Local verification already run:
- Static source check: `Checkout.tsx` has no `window.location.href` / `location.href` payment redirect and no reported delayed 5000ms redirect timeout.
- Static source check: pending-payment refresh timeout has `disposed` plus `window.clearTimeout(timer)` cleanup; pending-payment polling clears interval/listener/locks and checks `disposed` after every awaited poll/order read before state setters.
- Targeted Jest: `CI=true npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand --testTimeout=30000` passed (16/16).

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout payment quick navigation | CURRENT_SOURCE_COVERED / PAYMENT E2E OPTIONAL | Start a pending-payment checkout, delay latest-payment/order responses, navigate away before the next refresh/poll tick, and verify no late redirect, no unmounted-state warning, and no duplicate payment polling after leaving. |

## 2026-06-09 01:18 UTC Frontend Bundle Analysis Tooling Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3485. CI/release adoption validation is still pending.

Local verification already run:
- Bundle analyzer script test: `npm run test:bundle-analyzer` passed
- Isolated production build: `BUILD_PATH=/tmp/shoptest-f3485-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with existing Browserslist/bundle-size advisories only
- Current build analysis: `BUILD_PATH=/tmp/shoptest-f3485-build BUNDLE_ANALYZE_OUTPUT_DIR=/tmp/shoptest-f3485-bundle-report npm run analyze:bundle` passed
- Generated reports: `/tmp/shoptest-f3485-bundle-report/bundle-size-report.json` and `/tmp/shoptest-f3485-bundle-report/bundle-size-report.md`
- Current report warnings: initial JS 1740.1 KB / 517.7 KB gzip, total JS 7797.1 KB, total CSS 1866.2 KB, largest asset 3423 KB (`region-china-town` lazy chunk)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Bundle report generation | SOURCE_FIXED / RELEASE E2E PENDING | Run `npm run build:analyze` on a clean release workspace and verify the build completes, then `bundle-size-report.json` and `.md` are generated in the build output. |
| Budget gate behavior | SOURCE_FIXED / CI E2E PENDING | Run `npm run check:bundle` against a build that exceeds default budgets and verify CI fails with readable budget findings. Re-run with temporary high budget env vars and verify it passes. |
| Release artifact review | SOURCE_FIXED / QA E2E PENDING | Attach or archive the generated Markdown/JSON report with the frontend release artifact so QA can track initial JS, total JS, total CSS, and largest lazy chunk changes between releases. |

## 2026-06-09 01:15 UTC Checkout Order Item Batch Insert Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3472. Runtime/database validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderItemRepositoryContractTest,OrderInputNormalizationServiceTest test` passed
- Unit/source coverage: `OrderItemRepositoryContractTest` guards the MyBatis `insertBatch` mapper and checkout source path; `OrderInputNormalizationServiceTest` guards that invalid guest checkout does not insert orders or order items.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Member checkout batch insert | SOURCE_FIXED / DB E2E PENDING | Checkout with multiple selected cart lines as an authenticated user. Verify one order is created, all order item rows are present with snapshots/specs, the selected cart rows are deleted, and SQL/query logs show one batch insert for order items rather than one insert per line. |
| Guest checkout batch insert | SOURCE_FIXED / DB E2E PENDING | Guest checkout with multiple lines. Verify all order item rows are created with guest order data and SQL/query logs show the batch insert path. |
| Checkout rollback behavior | SOURCE_FIXED / API E2E PENDING | Force order item batch insert failure after order insert in a test transaction and verify checkout rolls back the order, order items, coupon usage, and cart mutations consistently. |

## 2026-06-09 01:13 UTC Reference Data Spring Cache Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3470. Runtime cache validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReferenceDataCachingContractTest,BrandServiceTest,CategoryServiceImplTest,ProductSearchServiceTest test` passed
- Unit/source coverage: `ReferenceDataCachingContractTest` guards `@EnableCaching`, Category/Brand `@Cacheable`/`@CacheEvict`, and product-write category cache eviction.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public category cache hit | SOURCE_FIXED / API E2E PENDING | Call `/categories` or top-level/parent category endpoints twice with identical params. Verify the second request is served from Spring cache or does not repeat category/product-count DB queries. |
| Public brand cache hit | SOURCE_FIXED / API E2E PENDING | Call `/brands` twice with identical active-only/limit params. Verify the second request is served from Spring cache or avoids repeating the brand query. |
| Reference write eviction | SOURCE_FIXED / ADMIN E2E PENDING | Create/update/delete a category and a brand from admin APIs. Verify the next public/admin reference-data request reloads fresh data, then subsequent identical requests hit cache again. |
| Product count eviction | SOURCE_FIXED / ADMIN/API E2E PENDING | Warm category responses with product counts, update/delete/import products that affect category counts, and verify the next category response refreshes counts rather than serving stale cached counts. |

## 2026-06-09 01:10 UTC Product Search Cache Targeted Invalidation Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3469. API/load validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ProductSearchServiceTest test` passed
- Unit/source coverage: product save invalidates only matching cached entries, cache max-entry pressure evicts one oldest entry instead of clearing all entries, and same-key cache misses remain serialized.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product update cache invalidation | SOURCE_FIXED / API E2E PENDING | Warm multiple public product/search/featured/discount cache keys, update one product in admin, and verify only affected product-related keys miss/reload while unrelated warmed keys remain cache hits until TTL expiry. |
| Cache capacity pressure | SOURCE_FIXED / BACKEND E2E PENDING | Configure a small `product.search-cache-max-entries`, warm more distinct product cache keys than the limit, and verify metrics/logging show single-entry oldest eviction rather than a full cache clear. |
| Concurrent post-update traffic | SOURCE_FIXED / LOAD E2E PENDING | After a product update, issue concurrent requests for several product-list/search keys. Verify same-key misses are serialized and unrelated hot keys do not stampede the database. |
| Import invalidation | SOURCE_FIXED / ADMIN E2E PENDING | Run a product CSV import that updates several products, then verify affected catalog/search keys refresh while unrelated warmed keys remain available. |

## 2026-06-09 01:06 UTC Discount Product List Query Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_CONFIRMED for QA F3468. API/database runtime validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ProductSearchServiceTest test` passed
- Unit/source coverage: `ProductSearchServiceTest.discountProductListUsesBoundedPagedPublicQuery` verifies `findDiscountProducts()` uses a bounded pageable public query and does not call unbounded `productRepository.findAll()`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Discount product API query | CURRENT_SOURCE_COVERED / API E2E PENDING | Seed active, inactive, normal, percentage-discount, and active/expired limited-time products. Call the public discount-product/listing path and verify only active discounted products are returned, response size is capped, and ordering matches discount ranking. |
| Discount query plan | CURRENT_SOURCE_COVERED / DB E2E PENDING | Capture SQL or query metrics for the discount product path on representative data. Verify the request uses a bounded paged query with discount predicates rather than loading the full product table and filtering in memory. |
| Admin discount filter parity | CURRENT_SOURCE_COVERED / ADMIN E2E PENDING | In admin product management, use the discount filter and verify the result set is bounded/paginated and matches active discount semantics without a full catalog load. |

## 2026-06-09 01:05 UTC Customer Order Pagination Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3474 and TEST F2744. API/runtime validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderStatsServiceTest,OrderControllerCustomerPaginationTest,ReviewServiceTest test` passed
- Unit/source coverage: `OrderControllerCustomerPaginationTest` covers customer page headers/defaults/rejections; `OrderStatsServiceTest` covers zero-based service offsets and asserts the unbounded `findByUserId` mapper query is absent.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer `/orders/me` pagination | SOURCE_FIXED / API E2E PENDING | Seed more than 20 orders for one customer, call `/orders/me?page=0&size=20` and `/orders/me?page=1&size=20`, and verify each response is bounded, ordered by newest first, and includes `X-Order-Page`, `X-Order-Page-Size`, `X-Order-Total`, `X-Order-Total-Pages`, and `X-Order-Has-Next`. |
| Customer pagination validation | SOURCE_FIXED / API E2E PENDING | Call `/orders/me` with `page=-1`, `size=0`, and `size=101`. Verify the API rejects invalid values instead of silently loading an unbounded list. |
| User order lookup authorization | SOURCE_FIXED / API E2E PENDING | For `/orders/user/{userId}`, verify self access is paginated, non-admin cross-user access is forbidden, and authorized admin access still returns a bounded page. |
| Query-plan guard | SOURCE_FIXED / DB E2E PENDING | On representative data, capture the SQL/query plan for customer order listing and verify the bounded `LIMIT/OFFSET` mapper path is used, not an unbounded user-order query. |

## 2026-06-09 01:03 UTC Order Item and Cart Lookup Index Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3471 and F3473. Database/runtime validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` passed
- Backend compile: `./mvnw -q -DskipTests compile` passed
- Diff hygiene: targeted `git diff --check` passed for touched schema/migration/test/docs files
- Unit/source coverage: `CommerceSchemaContractTest` guards fresh schema, Flyway baseline, V7 migration, and startup hardening coverage for `idx_order_items_product_order`, `idx_order_items_order_product`, and cart lookup coverage through `uk_cart_user_product_specs(user_id, product_id, selected_specs_key)`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Fresh database index validation | SOURCE_FIXED / DB E2E PENDING | Apply the current fresh schema/Flyway baseline to an empty MySQL database. Verify `SHOW INDEX FROM order_items` includes `idx_order_items_product_order(product_id, order_id)` and `idx_order_items_order_product(order_id, product_id)`, and `SHOW INDEX FROM cart_items` includes `uk_cart_user_product_specs(user_id, product_id, selected_specs_key)` without a redundant `idx_cart_user_product_specs`. |
| Existing database migration validation | SOURCE_FIXED / DB E2E PENDING | Run V7/startup hardening against an upgraded database that lacks the order item composite indexes. Verify both order item indexes are added idempotently, rerunning migration/startup does not error, and the cart unique key remains intact. |
| Order detail lookup plan | SOURCE_FIXED / DB E2E PENDING | Seed representative `order_items` data and run `EXPLAIN` for the mapper query that loads items by `order_id`. Verify MySQL uses `idx_order_items_order_product` or an equivalent leading `order_id` access path. |
| Cart user lookup plan | CURRENT_SOURCE_COVERED / DB E2E PENDING | Seed representative `cart_items` data and run `EXPLAIN` for cart listing by `user_id`. Verify MySQL uses the left-prefix `uk_cart_user_product_specs` access path. |

## 2026-06-09 00:59 UTC AdminLayout Visibility-Gated Support Unread Poll Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3484. Browser runtime validation is still pending.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/AdminLayout.test.tsx src/api/index.test.ts src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` passed (78/78, existing React/Router/Suspense warning noise only)
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Frontend production build: `BUILD_PATH=/tmp/shoptest-adminlayout-build MOBILE_RELEASE_SKIP_GENERATION=true CI=true npm run build` passed with Browserslist/bundle-size warnings only
- Diff hygiene: `git diff --check` passed for touched AdminLayout/cache/ProductDetail files

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Hidden admin tab unread polling | SOURCE_FIXED / BROWSER E2E PENDING | Sign in as an admin with support access, open any `/admin/*` page, then hide/background the tab for at least one 15s polling interval. Verify no `/admin/support/unread-count` network request is made while `document.visibilityState` is hidden. |
| Restore visible tab refresh | SOURCE_FIXED / BROWSER E2E PENDING | After the hidden-tab interval, make the tab visible again and verify one unread-count refresh happens promptly and the support badge updates without waiting for another full interval. |
| Cleanup on navigation/logout | SOURCE_FIXED / BROWSER E2E PENDING | Navigate between admin pages and log out. Verify the unread interval and `visibilitychange` listener do not continue firing after unmount/logout. |

## 2026-06-09 00:55 UTC Commerce Index and Support Message Window Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3478-F3482. Database/runtime validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest,SupportServiceTest test` passed
- Backend compile: `./mvnw -q -DskipTests compile` passed
- Diff hygiene: `git diff --check` passed for touched schema/support files
- Unit/source coverage: `CommerceSchemaContractTest` guards fresh schema/Flyway/V7/startup index coverage and left-prefix wishlist/user-coupon coverage; `SupportServiceTest` guards default and cursor message reads through bounded mapper methods.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Database upgrade index validation | SOURCE_FIXED / DB E2E PENDING | Run migrations/startup hardening against an upgraded database and a fresh database. Verify `SHOW INDEX` includes `idx_user_addresses_user` where no leading `user_id` index already existed, includes `idx_payments_status_expires`, and does not create duplicate `user_id` leading indexes on `user_addresses`. |
| Expired pending payment sweep | SOURCE_FIXED / BACKEND E2E PENDING | Seed pending payments with expired, future, and null `expires_at` values. Run the payment expiry sweep and verify only `status='PENDING' AND expires_at <= NOW()` rows expire while active/future/null rows remain unchanged. |
| Support message history window | SOURCE_FIXED / API/UI E2E PENDING | Seed a support session with more than 120 messages. Verify customer, guest, and admin message-history APIs return bounded recent windows by default/limit, `afterId` returns only newer messages, and the UI can continue scrolling/polling without reloading the entire transcript. |
| Wishlist and coupon lookup plan | CURRENT_SOURCE_COVERED / DB E2E PENDING | On representative data, run `EXPLAIN` for wishlist by `user_id` and user-coupon by `user_id`/`status` lookups. Verify MySQL uses the left-prefix `uk_user_product`, `uk_user_coupon`, or `idx_user_coupons_user_status` indexes. |

## 2026-06-09 00:50 UTC Checkout/Profile Lazy Region Loading Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3477. Browser/App validation is still pending.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/regionData.test.ts src/pages/Checkout.test.tsx src/pages/Profile.test.ts --watchAll=false --runInBand` passed (21/21, existing React/Router/AntD warning noise only)
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Diff hygiene: `git diff --check` passed for touched F3477 files
- Build artifact inspection: `/tmp/shoptest-region-build/asset-manifest.json` lists separate `region-china-level`, `region-china-town`, and `region-mexico-municipalities` chunks.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout first-open region load | SOURCE_FIXED / CHECKOUT E2E PENDING | Open `/checkout` with checkout items, choose new address, and open the Region Cascader. Verify the first open loads options, China/Mexico paths can be selected, no stale loading placeholder remains, and the checkout readiness/payment controls still behave after selection. |
| Profile saved-address edit prefill | SOURCE_FIXED / PROFILE E2E PENDING | Sign in with at least one saved address, open `/profile`, edit the address, and verify the region Cascader plus detail-address field are prefilled after the lazy options load. Save without changing the region and confirm no address data is lost. |
| Lazy chunk failure path | SOURCE_FIXED / BROWSER E2E PENDING | Simulate a failed region chunk/network load for Checkout and Profile. Verify a localized readable `regionLoadFailed` message appears, the page remains usable, and retrying after the network/chunk is available loads the options. |
| Android address Cascader regression | SOURCE_FIXED / APP DEVICE E2E PENDING | In Android WebView/device viewports, repeat the Checkout/Profile region picker checks at `320x568`, `360x740`, and `390x844`; verify the lazy-loaded Cascader still respects the existing popup sizing/layering fixes and no body-mounted popup blocks payment/profile controls. |

## 2026-06-09 00:39 UTC Admin Shipping Carrier Lookup Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3476. Browser/API validation is still pending.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` passed
- Backend compile: `./mvnw -q -DskipTests compile` passed
- Unit/source coverage: `PaymentFlowServiceTest` verifies `OrderService.shipOrder(...)` uses `LogisticsCarrierService.findByTrackingCode(...)`, does not call `findAll(false)`, persists carrier code/name to `updateShipping(...)`, and keeps the shipment notification carrier label.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Single admin shipment with carrier | SOURCE_FIXED / ADMIN E2E PENDING | In the admin order detail/status flow, ship a `PENDING_SHIPMENT` order with a configured active carrier such as `DHL`. Verify the request succeeds, the order becomes `SHIPPED`, tracking number plus carrier code/name are stored, and the customer-visible shipment notification includes the carrier label. |
| Disabled or missing carrier | SOURCE_FIXED / ADMIN E2E PENDING | Attempt shipment with an inactive carrier and with an unknown tracking carrier code. Verify the UI/API returns a readable validation error and the order remains in its previous status. |
| Batch shipment carrier lookup | SOURCE_FIXED / ADMIN E2E PENDING | Batch-ship multiple orders using one configured carrier. Verify per-row success/failure reporting remains correct and backend logs/metrics do not show full carrier-list scans per order. |

## 2026-06-09 00:34 UTC Android Navbar and APK Update Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for Android UI A-07 and A-08. Device/Appium validation is still pending.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx src/utils/mobileUpdate.test.ts --watchAll=false --runInBand` passed (19/19, existing React/Router/AntD z-index/act warning noise only)
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `Navbar.test.tsx` verifies route navigation closes mobile dropdown menus and guards the `location.hash` / `location.pathname` / `location.search` reset effect; `mobileUpdate.test.ts` verifies generated release metadata matches `public/downloads/mobile-version.json`, `1.0.95` / `10095` remains signed, `minSupportedVersionCode` remains `0`, and the versioned APK exists with matching `sizeBytes`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Navbar dropdown route cleanup, A-07 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, open language, currency, More, and Pet/category dropdowns from the mobile navbar. Tap route-changing entries and verify each dropdown closes immediately after navigation, does not remain over the destination page, and no stale body-mounted AntD popup remains tappable. |
| Navbar dropdown route variants, A-07 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | Repeat the route-cleanup check for pathname changes, search changes, and hash changes. Include narrow (`320x568`) and normal (`390x844`) viewports, plus a back/forward navigation pass. |
| Old APK update path, A-08 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | Install an older release such as `1.0.24` or `1.0.35`, start the App, and verify the native update gate fetches `/downloads/mobile-version.json`, sees `1.0.95` / `10095`, and allows update download without forced blocking because `minSupportedVersionCode=0`. |
| APK artifact download, A-08 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | From the old App update prompt and from any visible Android download entry, verify the selected URL is `/downloads/shoptest-1.0.95.apk` or `/downloads/shoptest.apk?v=1.0.95`, the APK downloads successfully, and the downloaded size/hash match the manifest. |

## 2026-06-09 00:31 UTC Android Checkout Cascader Regression Handoff

Source status: SOURCE_FIXED / ANDROID_APP_WEBVIEW_SCRIPT_PASS for Android UI A-05 and A-06. Device/Appium validation is still pending.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` passed (15/15, existing React/Router/AntD act warning noise only)
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Android checkout-flow audit: `node audit-mobile-app-checkout-flow-ui.js` passed with viewportCount 2, issueCount 0, issueTypes `[]`
- Unit/source coverage: `Checkout.test.tsx` verifies App Cascader popup sizing uses `--shop-address-cascader-available-height` / `--shop-address-cascader-level-height` and rejects `56dvh`/`66dvh` regressions.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout address Cascader levels, A-05 | SOURCE_FIXED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, open `/checkout`, start a new address, and open the region Cascader at `320x568`, `360x740`, and `390x844`. Verify 3-level and 5-level region paths stay inside the phone frame, each level remains scrollable, and no level is clipped by the viewport or safe-area bottom. |
| Checkout Cascader height cleanup, A-06 | SOURCE_FIXED / APP DEVICE E2E PENDING | Inspect the open Cascader geometry under normal portrait and short/landscape device sizes. Verify popup max-height tracks the viewport/safe-area formula rather than old 56dvh/66dvh caps, and that scrolling the checkout form or tapping payment fields closes/removes stale Cascader portals. |
| Checkout flow regression | SOURCE_FIXED / APP DEVICE E2E PENDING | Complete the checkout readiness path after opening/closing the Cascader: select address/region, choose payment, trigger validation errors, and confirm payment card/mobile pay bar remain readable with no leftover `.ant-cascader-dropdown` overlay. |

## 2026-06-09 00:26 UTC Android Support Widget Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for Android UI A-03. Device/Appium validation is still pending.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand` passed (4/4)
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `CustomerSupportWidget.test.tsx` verifies the session-loading status region, `Spin`, `t('common.loading')`, empty welcome card, and quick replies remain present.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Support widget slow session initialization, A-03 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, throttle support session creation/message loading with Slow 3G or an API delay, open the support widget as a logged-in customer, and verify a visible loading status appears before messages load. It should not look like the panel failed to open. |
| Support widget empty conversation, A-03 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | With a new account/session that has no support messages, open the widget at `320x568`, `360x740`, and `390x844`. Verify the welcome `Empty` state and quick reply buttons are visible, readable, and not blocked by the composer or App bottom rail. |
| Guest support empty conversation, A-03 | CURRENT_SOURCE_COVERED / APP DEVICE E2E PENDING | Open support from guest order tracking context and repeat the slow-load/empty checks. Verify the guest session shows loading/empty states and still allows typing after the session initializes. |

## 2026-06-09 00:23 UTC Android Storefront App UI Regression Handoff

Source status: SOURCE_FIXED / ANDROID_APP_WEBVIEW_SCRIPT_PASS for Android UI A-01 and A-04. Device/Appium validation is still pending.

Local verification already run:
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Frontend focused Jest: `npm test -- --runTestsByPath src/App.test.tsx src/pages/ProductList.test.tsx --watchAll=false --runInBand` passed (20/20; existing React/Router/act warning noise only)
- Android storefront audit: `node audit-mobile-app-storefront-ui.js` passed with generatedAt `2026-06-09T00:22:32.435Z`, 69 route states, issueStateCount 0, issueCounts `{}`, network failures 0, route errors 0
- Evidence report: `app-ui-audit-20260608T-mobile-storefront-codex/report.json`

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product-list App badge readability, A-01 | SOURCE_FIXED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, open `/products`, `/products?keyword=bed`, and a category-filtered product list at `320x568`, `360x740`, and `390x844`. Inspect `.product-list__badges .ant-tag`: computed `font-size` should be at least `12px`, `min-height` at least `22px`, and New/Hot/Limited labels should be readable without clipping or horizontal page overflow. |
| Startup localized loading, A-04 | SOURCE_FIXED / APP DEVICE E2E PENDING | Set app language to zh, en, and es, keep a stored token, throttle profile loading with Slow 3G or an API delay, then cold-start the Android App. Verify the startup spinner shows `App 加载中…`, `Loading app…`, or `Cargando app…` with `role=status` semantics before the shell appears. |
| Startup expired-token silence, A-04 | SOURCE_FIXED / APP DEVICE E2E PENDING | Start with an invalid/expired token and force `/users/profile` to fail. Verify the stored session is cleared and the logged-out storefront renders without a modal, toast, full-page redirect flash, or stuck loading state. |
| Cross-locale startup regression | SOURCE_FIXED / APP DEVICE E2E PENDING | Repeat cold startup after switching languages from the nav/settings path and after app process restart. Verify the chosen language persists, the loading text does not fall back to raw `app.loading`, and normal routes still lazy-load under the same fallback. |

## 2026-06-09 00:13 UTC Android Storefront App UI Regression Handoff

Source status: SOURCE_FIXED / ANDROID_APP_WEBVIEW_SCRIPT_PASS for Android UI A-09, A-10, A-11, A-12, A-13, and A-14. Device/Appium validation is still pending.

Local verification already run:
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` passed
- Android storefront audit: `node audit-mobile-app-storefront-ui.js` passed with 69 route states, issueStateCount 0, issueCounts `{}`, network failures 0, route errors 0, `useFormWarningCount` 0
- Evidence report: `app-ui-audit-20260608T-mobile-storefront-codex/report.json`
- A-14 smoke: `node app-e2e-smoke-20260608T-auth-order-codex/mobile-app-e2e-smoke.js` passed `add to cart opens drawer and full cart entry`; full smoke is 6/7 because checkout readiness still needs A-15 script follow-up for region selection

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront bottom navigation clearance, A-09 | SOURCE_FIXED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, open `/`, `/products`, `/cart`, and `/pet-finder` at `320x568`, `360x740`, and `390x844`. Scroll top/mid/bottom and verify final product/card/CTA hit tests land on page controls, not `.shop-nav__bottomBar`, with at least 12px visible clearance when the rail remains visible. |
| Coupon center App rails, A-10 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/coupons`, scroll to search/sort/claim sections, and verify search, Recommended select, `Claim all`, `Use at cart`, and claim actions are readable and tappable without competing fixed rails or bottom-nav overlap. |
| Wishlist primary actions, A-11 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/wishlist` with at least one mocked item, check top state and best-pick/next-action areas, and verify `Add all to cart` plus item actions remain above the App bottom rail and hit tests do not route to nav items. |
| Product list title link touch target, A-12 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/products?keyword=bed&discount=true`, inspect long product cards at all phone widths, and verify `.product-list__titleLink` has at least 44px tappable height while long titles wrap naturally without clipping. |
| Checkout console/Form lifecycle, A-13 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/checkout` from cart and by direct URL. Confirm no `Instance created by useForm is not connected to any Form element` warning appears in WebView console/logcat, payment methods still render, and checkout validation/submission behavior remains unchanged. |
| Cart drawer full-cart CTA, A-14 | SOURCE_FIXED / APP DEVICE E2E PENDING | From `/products`, tap first `Quick add`, confirm add to cart, and inspect the mini cart drawer at `390x844` and `360x740`. Verify `Checkout` and `View full cart` are fully visible/tappable, `View full cart` bottom is above the App bottom rail or the rail is hidden, and tapping it reaches `/cart`. |
| Cross-route rail reset | SOURCE_FIXED / APP DEVICE E2E PENDING | After coupons, wishlist, cart drawer, and checkout, navigate back to home/products/profile. Verify the App bottom rail returns only on normal routes and does not remain hidden or conflict-marked after overlays close. |

## 2026-06-08 23:35 UTC Android App UI Regression Handoff

Source status: SOURCE_FIXED / ANDROID_APP_WEBVIEW_SCRIPT_PASS for Android UI A-15, A-16, A-17, A-18, A-19, A-20, and A-22; A-21 remains PASS from the earlier Stock Alerts bottom-action regression. Device/Appium validation is still pending.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/api/index.test.ts src/pages/Checkout.test.tsx src/components/CustomerSupportWidget.test.tsx src/pages/OrderTracking.test.tsx src/pages/StockAlerts.test.ts src/pages/BrowsingHistory.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Android App WebView audits: `node audit-mobile-app-checkout-flow-ui.js`, `node audit-mobile-app-profile-support-ui.js`, `node audit-mobile-app-auth-order-ui.js`, and `node audit-mobile-app-account-utilities-ui.js` passed with issueCount/issues 0
- Evidence reports: `app-ui-audit-20260608T-checkout-flow-codex/report.json`, `app-ui-audit-20260608T-profile-support-app-codex/report.json`, `app-ui-audit-20260608T-auth-order-codex/report.json`, and `app-ui-audit-20260608T-account-utilities-app-codex/report.json`

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout payment methods, A-15 | SOURCE_FIXED / APP DEVICE E2E PENDING | In Android App WebView or a real device build, open `/checkout` at `320x568` and `390x844` with payment channels available. Verify STRIPE/PAYPAL or configured channels render as selectable `.checkout-page__paymentMethod` radios, the unavailable-payment alert is gone, and the mobile pay CTA becomes enabled only after required address/payment selections. |
| Checkout address Cascader, A-16 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open the checkout address region Cascader, scroll to the payment card, touch other fields, submit with validation errors, rotate/resize if available, and press Back/Escape where supported. Verify stale `.ant-cascader-dropdown` nodes do not remain fixed over the order summary/payment area and hit tests land on visible checkout controls. |
| Order tracking actions/modal/steps, A-17/A-18/A-19 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/track-order`, perform a successful lookup for a shipped/returnable order at `320x568` and `390x844`, and verify Confirm receipt, Request return, Contact support, return-modal footer buttons, and journey steps remain readable/tappable with no bottom-nav overlap. Journey labels should be at least 12px and not clipped in a hidden horizontal rail. |
| Customer support order overlays, A-20 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open the support widget with authenticated customer orders, use Send order and View order at `320x568`, `360x740`, `390x844`, and short landscape. Verify order Select options and the order detail modal render above the support panel, with modal content and close hit-tests landing on modal elements rather than chat bubbles, composer, panel header, or backdrop. |
| Account utility labels and Stock Alerts action, A-21/A-22 | SOURCE_FIXED / APP DEVICE E2E PENDING | Open `/stock-alerts` and `/history` in Android App WebView/device at `320x568` and `390x844`. Verify Stock Alerts mobile action remains clear of the bottom nav, and Ready now/Low-stock ready/Still watching/Recently viewed/All viewed/Viewed today/Deals watched/Low stock/Next browsing action labels compute to at least 12px with no clipping or horizontal overflow. |
| Cross-flow Android regression | SOURCE_FIXED / APP DEVICE E2E PENDING | Re-run the existing Android smoke suite across checkout, order tracking, support widget, stock alerts, browsing history, notifications, payment instructions, and bottom navigation. Confirm the new focused-flow bottom-nav hiding on `/track-order` does not leak to normal storefront routes after navigation. |

## 2026-06-08 21:11 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2716 Payment Instructions step text rendered as tiny circular badges.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/PaymentInstructions.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `PaymentInstructions.test.ts` verifies the numeric marker uses `payment-instructions-page__stepNumber`, the broad `.payment-instructions-page__step > span` badge selector is absent, and instruction `Typography.Text` fills the text column with normal wrapping instead of inheriting 28px badge dimensions.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment instructions desktop | SOURCE_FIXED / BROWSER E2E PENDING | Open `/payment/TESTORDER123` at `1366x900`; verify each `Next steps` row shows a small circular number marker followed by full readable instruction text, with no instruction text rendered inside a circle. |
| Payment instructions phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat at `390x844` and `360x740`; verify the three instruction strings wrap in the text column, payment details remain readable, and `Track Order` / `Contact Support` buttons remain tappable. |
| Payment instructions tablet/landscape | SOURCE_FIXED / BROWSER E2E PENDING | Recheck `768x1024` and `740x360`; verify the step grid, status panel, amount, expiry, and support actions have no clipped circular text badges or horizontal overflow. |

## 2026-06-08 21:09 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2717 System Monitor mobile status tags collapsing into vertical pills.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/SystemMonitor.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `SystemMonitor.test.ts` verifies the long diagnostic `Descriptions` fields, the final F3533 stacked-row override, and the final F2717 tag guard that keeps dependency readiness/status tags as horizontal `inline-flex` pills after mobile stacking.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| System Monitor status tags on phone | SOURCE_FIXED / BROWSER E2E PENDING | Mock a SUPER_ADMIN profile with `system` and `system:status`, plus blocked backend/production/database states and ready Redis/Nacos states. Open `/admin/system` at `390x844`; verify `Blocked`, `Ready`, `UP`, `DOWN`, and related readiness tags render as readable horizontal pills, not single-character vertical text. |
| Compact/narrow System Monitor | SOURCE_FIXED / BROWSER E2E PENDING | Repeat at `360x740` and `320x568`; verify the runtime environment, production config, database, Redis, and Nacos `Descriptions` stack into label/value rows with whole status tags and no clipped 16px content column. |
| Tablet/landscape System Monitor regression | SOURCE_FIXED / BROWSER E2E PENDING | Recheck `/admin/system` at `740x360`, `768x1024`, and desktop `1366x900`; verify the F2717 tag guard does not introduce horizontal page overflow, oversized tags, or desktop status-title regressions. |

## 2026-06-08 21:06 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2719 Notifications mobile primary CTA overlapped by the fixed bottom navigation.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Notifications.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `Notifications.test.ts` verifies the action plan renders before the notification list, the `Review unread` translation key remains wired, and the final F2719 CSS block appears after earlier mobile notification closure rules with bottom-nav-aware page/action/CTA/first-card clearance.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Notifications authenticated phone | SOURCE_FIXED / BROWSER E2E PENDING | Log in and open `/notifications` at `390x844`; verify the `Review unread` CTA finishes above the fixed bottom navigation, the first notification card is not hidden under the nav, and hit tests on the CTA land on the CTA rather than the nav. |
| Notifications compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat `/notifications` at `360x740`; verify the action plan has visible clearance from the bottom nav, the first notification card remains reachable/readable after a short scroll, and the nav does not cover notification content. |
| Notifications narrow phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat `/notifications` at `320x568`; verify the action plan wraps without clipping, the primary CTA remains at least 44px tall and tappable, and scrolling can place the CTA and first notification above the safe-area bottom. |

## 2026-06-08 21:01 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2720 Product Detail mobile buy bar covering first-viewport title and price context.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` passed with existing React/Router/Suspense warning noise
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `ProductDetail.test.tsx` verifies the buy bar source order after the price panel, final F2720 normal-web CSS after the App WebView restore, static/in-flow positioning, and no `body.shop-mobile-app` targeting in the normal-web guard.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product Detail phone summary | SOURCE_FIXED / BROWSER E2E PENDING | Open `/products/1` at `390x844`; verify title, price, discount, delivery promise, favorite/compare context, and shipping badges are readable on the first product summary viewport with the buy bar in normal summary flow rather than fixed over the price panel. |
| Product Detail compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat at `360x740`; verify the buy bar does not cover `.product-title-block` or `.product-price-panel`, all buy-bar controls remain visible/tappable in flow, and the global bottom navigation does not cover the summary controls. |
| Product Detail App WebView regression | SOURCE_FIXED / APP WEBVIEW E2E PENDING | In the App WebView shell, reopen `/products/1` at `360x740` and `390x844`; verify the scoped `body.shop-mobile-app` fixed buy bar still appears at the safe-area bottom and is not changed by the normal-mobile-web flow rule. |

## 2026-06-08 20:56 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2723 mobile checkout empty-state trust label mid-word break.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` passed with existing React/Router/act warning noise
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `Checkout.test.tsx` verifies the empty trust-signal source markup, final F2723 CSS cascade position, one-column trust-chip layout, and normal word-breaking contract.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Empty checkout trust chips | SOURCE_FIXED / BROWSER E2E PENDING | Open `/checkout` with no selected cart items at `390x844`; verify `Secure payment`, free-shipping/truck, and support trust chips render as readable full-row labels with no mid-word break or clipped final character. |
| Adjacent phone widths | SOURCE_FIXED / BROWSER E2E PENDING | Repeat the empty checkout state at `375x812` and `360x740`; verify the trust chips remain readable, the empty actions stay tappable, and the bottom nav does not cover the empty-state controls. |
| Empty checkout recovery actions | SOURCE_FIXED / BROWSER E2E PENDING | From the same empty checkout state, tap `Back to cart`, `Browse products`, `Coupons`, and `History`; verify routing works and the normal checkout empty state is restored when navigating back. |

## 2026-06-08 20:54 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2722 short mobile 404 page primary CTA covered by bottom navigation.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/NotFound.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `NotFound.test.ts` verifies the 404 recovery actions, mobile bottom-nav clearance, full-width 44px action grid, and short-viewport spacing contract.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Compact 404 recovery | SOURCE_FIXED / BROWSER E2E PENDING | Open `/definitely-not-a-route` at `360x740`; verify `Back to Home` and `Search Products` are fully visible above the fixed bottom navigation without needing to scroll, and hit tests on both buttons land on the buttons rather than the nav. |
| Narrow 404 recovery | SOURCE_FIXED / BROWSER E2E PENDING | Repeat at `320x568`; verify the compressed 404 icon/title/subtitle layout still leaves both recovery buttons readable, full width, and clear of the bottom nav. |
| Recovery navigation | SOURCE_FIXED / BROWSER E2E PENDING | From the same 404 route at `360x740` and `390x844`, tap `Back to Home` and `Search Products`; verify routing succeeds and the normal bottom navigation remains usable after leaving the 404 page. |

## 2026-06-08 20:50 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2721 mobile coupon sticky rails overlapping each other and the bottom navigation.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/CouponCenter.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `CouponCenter.test.ts` verifies the quick nav/mobile action markup, the final F2721 CSS flow guard, and absence of later sticky/fixed coupon rail overrides.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon rails on phone | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/coupons` at `390x844`; verify the quick nav and mobile action bar stack in normal page flow with no visual overlap, and that claim/login/shop actions and the bottom navigation are simultaneously readable and tappable. |
| Coupon rails on compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat `/coupons` at `360x740`; verify the mobile action bar is not hidden behind the global bottom navigation, the quick nav does not cover it, and lower-page hit tests land on coupon controls or bottom-nav items according to their visible bounds. |
| Coupon rails on narrow phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat `/coupons` at `320x568`; verify the two coupon rails remain readable after wrapping/stacking, no clipped horizontal rail is required to reach core coupon actions, and the bottom nav remains usable without covering the coupon action area. |

## 2026-06-08 20:46 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2756 empty Cart Drawer trust strip collapse and bottom-nav overlay.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/components/CartDrawer.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `CartDrawer.test.ts` verifies the scoped `cart-drawer__root`, drawer mask/content z-index above mobile rails, and compact trust-row full-width stacking/wrapping contract.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Empty cart drawer compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/` at `360x740` with an empty cart, open the cart drawer, and verify `Secure payment`, shipping, and returns trust labels render as readable horizontal text rows with no letter-by-letter collapse. |
| Cart drawer overlay vs bottom nav | SOURCE_FIXED / BROWSER E2E PENDING | At `360x740` and `390x844`, verify the drawer mask/content sit above the global bottom navigation and hit tests in the lower drawer land on drawer content, not nav items. |
| Empty cart browse action | SOURCE_FIXED / BROWSER E2E PENDING | From the empty drawer at both widths, tap `Browse products`; verify the drawer closes, navigation proceeds to products, and normal bottom navigation returns after the drawer is dismissed. |

## 2026-06-08 20:44 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2755 Product mobile filter drawer covered by product conversion and bottom-nav rails.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/ProductList.test.tsx --watchAll=false --runInBand` passed with existing React/Router act/future warning noise
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `ProductList.test.tsx` verifies the `product-list--filterDrawerOpen` state, scoped `product-list__filterDrawerRoot`, hidden conversion rail while the drawer is open, and drawer mask/content z-index above mobile rails.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product filter drawer on phone | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/products?q=feeder&sort=price_desc` at `390x844`, tap `Filters`, and verify the product conversion rail and global bottom navigation do not cover or visually compete with the drawer footer. `Reset filters` and `Apply filters` must be fully visible and tappable. |
| Product filter drawer on compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Repeat at `360x740`; verify the drawer footer remains above the visible safe-area bottom, the drawer content scrolls independently, and hit tests at the bottom buttons land on drawer controls rather than navigation or product conversion actions. |
| Filter apply/reset workflow | SOURCE_FIXED / BROWSER E2E PENDING | In the drawer at both widths, select a category/filter, use Apply, reopen, then Reset; verify the drawer opens/closes cleanly and page rails return only after the drawer closes. |

## 2026-06-08 20:40 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2754 Product quick-preview modal leaking fixed mobile rails.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/ProductList.test.tsx --watchAll=false --runInBand` passed with existing React/Router act/future warning noise
- Unit/source coverage: `ProductList.test.tsx` verifies the `product-list--previewOpen` state, scoped `product-list__previewModalRoot`, hidden conversion rail while preview is open, and preview mask/wrap z-index above mobile rails.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product quick preview on phone | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/products?q=feeder&sort=price_desc` at `390x844`, click `Quick preview`, and verify the bottom navigation and product-list mobile conversion bar are not visibly interactive-looking behind the modal; hit tests should land on the modal mask/content, not app rails. |
| Product quick preview on compact phone | SOURCE_FIXED / BROWSER E2E PENDING | Reopen the same product-list state at `360x740`, click `Quick preview`, and verify preview actions do not sit directly over fixed app rails and that only modal content is tappable. |
| Preview-to-quick-add transition | SOURCE_FIXED / BROWSER E2E PENDING | From quick preview at both widths, tap the primary add/choose-options action; verify preview closes, quick-add opens above rails, and the conversion bar remains suppressed while the purchase modal is active. |

## 2026-06-08 20:37 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2759 Forgot Password reset-guide labels clipped at 320px.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/ForgotPassword.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `ForgotPassword.test.ts` verifies reset-guide source labels and the final F2759 CSS contract that removes label clamping, allows reset chips to grow, and stacks the guide below `380px`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Forgot Password reset guide at 320px | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/forgot-password` at `320x568`; verify `Match account email`, `Protect your account`, and `Log in securely` render in full with no ellipsis, clipped descenders, hidden vertical overflow, or letter-by-letter wrapping. |
| Forgot Password reset guide at standard phone widths | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/forgot-password` at `360x740` and `390x844`; verify all three reset-guide labels remain fully readable and the first username/email field starts below the guide without being covered by viewport chrome. |
| Forgot Password validation state | SOURCE_FIXED / BROWSER E2E PENDING | Submit the empty reset form at `320x568`, `360x740`, and `390x844`; verify the reset guide still stays readable above the validation errors and that the form can scroll to each required field. |

## 2026-06-08 20:33 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2758 Pet Finder budget controls covered by fixed bottom navigation.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/PetFinder.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `PetFinder.test.ts` verifies first form card and budget-control source classes, budget slider handles, F2758 page/finder-card/budget-control bottom-nav clearance, slider spacing, and fixed bottom-nav safe-area bounds.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet Finder small-phone budget slider | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/pet-finder` at `320x568` and `360x740`; verify the budget slider handles and budget range text are fully visible above the fixed bottom nav and can be dragged/tapped without triggering nav items. |
| Pet Finder landscape first form | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/pet-finder` at `740x360` and `844x390`; verify the first form card can scroll clear of the fixed nav, the intro/search area transition is not covered, and the budget slider remains reachable. |
| Finder preference persistence | SOURCE_FIXED / BROWSER E2E PENDING | Adjust pet type, need, budget, and priority at the same breakpoints; refresh the page and verify preferences still persist while the fixed bottom-nav clearance remains intact. |

## 2026-06-08 20:30 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2757 Pet Gallery landscape social-proof copy collapsing vertically.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/PetGallery.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `PetGallery.test.ts` verifies the insight/action/conversion sections and the F2757 short-landscape CSS contract for one-column stacking, readable copy widths, horizontal writing mode, unmasked signal cards, and stable action grids.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet Gallery phone landscape social proof | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/pet-gallery` at `740x360` and `844x390`; verify `Social proof path`, `Shop what real pet parents make believable`, and supporting copy render horizontally as readable text with no 14px/18px vertical columns. |
| Pet Gallery action cards | SOURCE_FIXED / BROWSER E2E PENDING | At the same landscape viewports, verify upload/shop action cards stack cleanly, buttons remain visible and tappable, and there is no large blank gap before the gallery grid. |
| Pet Gallery signals and CTA actions | SOURCE_FIXED / BROWSER E2E PENDING | Verify insight/signal cards and conversion CTAs stay readable without hidden masks or clipped controls, then open a top pet preview and shop-inspired action to confirm interactions still work. |

## 2026-06-08 20:28 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2763 Bug Management mobile filters and generated table-card labels.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/BugManagement.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `BugManagement.test.ts` verifies compact mobile filter Selects, mobile `data-label` table-card source labels, grid-based label/value CSS, visible pseudo labels, and the very-narrow stacked-label override.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Bug filter controls on phones | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/bugs` at `390x844` and `360x740`; verify status, severity, and module filters render as normal compact 44px Select rows with centered values/chevrons and no tall blank boxes. |
| Bug mobile card labels | SOURCE_FIXED / BROWSER E2E PENDING | At the same viewports, verify mobile bug cards show readable `Bug`, `Severity`, `Status`, `Owner`, `Scan / update`, and `Actions` labels without clipping or 24px/26px label columns. |
| Bug row actions after label layout change | SOURCE_FIXED / BROWSER E2E PENDING | Exercise Edit, Scan, and Status actions from a mobile bug card and verify buttons remain reachable, modal popups still open inside the viewport, and pagination remains usable. |

## 2026-06-08 20:26 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2762 Alert Center table titles collapsing into vertical text.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/AlertManagement.test.ts --watchAll=false --runInBand` passed
- Adjacent frontend guards: `npm test -- --runTestsByPath src/pages/AdminInfrastructureResponsive.test.ts src/pages/AdminSummaryRailsResponsive.test.ts --watchAll=false --runInBand` passed
- TypeScript: `npx tsc --noEmit --pretty false` passed
- Unit/source coverage: `AlertManagement.test.ts` verifies the alert title column width/class, scoped alert table class, `scroll={{ x: 1180 }}`, and F2762 CSS that prevents global `overflow-wrap: anywhere` from collapsing primary alert titles.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Alert Center mobile table readability | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/alerts` at `390x844` and `360x740`; verify alert titles such as `JVM memory usage is high` and messages such as `IOException detected` wrap as readable words in the first data column, not letter-by-letter vertical text. |
| Alert Center landscape/tablet table | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/alerts` at `740x360` and `768x1024`; verify the title/message column remains readable before severity/status/category/count/date/actions and that horizontal scroll is available only for the detailed columns. |
| Alert actions after table width change | SOURCE_FIXED / BROWSER E2E PENDING | On `/admin/alerts`, select rows and exercise acknowledge/resolve/purge controls at the same breakpoints; verify action buttons, popconfirms, and table selection remain reachable after the widened scroll contract. |

## 2026-06-08 20:21 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2761 admin summary/status rails hiding critical operational state by default.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/AdminSummaryRailsResponsive.test.ts --watchAll=false --runInBand` passed
- Frontend adjacent guard: `npm test -- --runTestsByPath src/pages/AdminInfrastructureResponsive.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `AdminSummaryRailsResponsive.test.ts` verifies Orders, Products, Support, Users, Alerts, and Admin Dashboard all have F2761 `max-width: 900px` / `max-height: 640px` wrapping metric-grid overrides with no hidden rail mask/scroll-snap behavior.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin order/product summary metrics | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/orders` and `/admin/products` at `390x844`, `360x740`, `740x360`, and `768x1024`; verify all order status/return/refund cards and all product listing-quality metrics are visible by default without hidden horizontal panning. |
| Support/users/alerts operational state | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/support`, `/admin/users`, and `/admin/alerts` at the same viewports; verify stale-response/score/closed support tags, Missing phones, Resolved alerts, and Critical/Error alert counts remain visible in the default summary area. |
| Admin dashboard readiness/action rails | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/dashboard` or the admin landing dashboard at the same viewports; verify readiness, action-center, payment/return, and SLA risk cards wrap into visible grids with no hidden scrollbar/fade-mask rail and no tablet/landscape clipping. |

## 2026-06-08 20:16 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI/Responsive F2760 admin infrastructure mobile landscape/tablet clipping.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/AdminInfrastructureResponsive.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `AdminInfrastructureResponsive.test.ts` verifies Logs, Traffic Control, Alerts, IP Blacklist, and Service Registry all have F2760 containment blocks for `max-width: 900px` / `max-height: 640px`, visible stats grids, action grids, and table-wrapper-contained overflow.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin Logs responsive controls | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/logs` at `390x844`, `740x360`, and `768x1024`; verify the hero, `Download logs` action, range picker trigger, stats, and metadata stay inside the visible admin content with no clipped primary controls. |
| Traffic/Alerts/IP operations | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/traffic-control`, `/admin/alerts`, and `/admin/ip-blacklist` at the same viewports; verify refresh/self-check/manual-block/reset actions are visible, focusable, and not offscreen, and stats/filters do not require hidden horizontal panning. |
| Registry diagnostics | SOURCE_FIXED / BROWSER E2E PENDING | Reopen `/admin/registry` at the same viewports; verify hero, status cards, gateway diagnostics, descriptions, and service tables stay within the content column, with any necessary overflow limited to the table/description wrapper. |

## 2026-06-08 20:12 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE / REGRESSION_GUARD_ADDED for TEST Data Integrity F2809 stale user last-login field report.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=UserMapperContractTest test` passed
- Unit/source coverage: `UserMapperContractTest` verifies current `User.java`, `UserMapper.xml`, `schema.sql`, and `V1__init.sql` do not define stale `lastLoginAt`/`lastLoginIp` fields or `last_login_at`/`last_login_ip` columns.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin user detail/list fields | SOURCE_NON_ISSUE / ADMIN E2E PENDING | Open Admin User Management after a user login and verify the UI does not claim to show last-login timestamp/IP fields unless a separate product requirement adds those columns end to end. |
| Login success regression | SOURCE_NON_ISSUE / AUTH E2E PENDING | Perform password and email-code login flows and verify successful login still issues access/refresh tokens, clears failure counters, and records login audit events. |
| Future last-login feature gate | SOURCE_NON_ISSUE / CONTRACT E2E PENDING | If last-login visibility becomes a product requirement, verify schema, mapper, backend update path, API response, and admin UI are added together rather than relying on nonexistent legacy fields. |

## 2026-06-08 20:10 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE / REGRESSION_GUARD_ADDED for TEST Performance F2808 stale RefreshToken eager JPA fetch report.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=TokenBlacklistServiceTest test` passed with existing intentional Redis-failure warning noise
- Unit/source coverage: `TokenBlacklistServiceTest` verifies refresh tokens store and consume only a username string in Redis and that the old `RefreshToken.java` entity and `RefreshTokenService.java` files are absent.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Refresh token rotation | SOURCE_NON_ISSUE / API E2E PENDING | Login, call `POST /auth/refresh`, and verify the old refresh token is consumed once, a new refresh token is issued, and the response still includes the current user profile fields. |
| Consumed token rejection | SOURCE_NON_ISSUE / API E2E PENDING | Reuse the consumed refresh token and verify it returns HTTP 401 without issuing a replacement access/refresh token. |
| Refresh under SQL observation | SOURCE_NON_ISSUE / PERFORMANCE E2E PENDING | In staging with SQL logging/metrics enabled, run a small refresh-token burst and verify there is no `RefreshToken` entity query or eager user join; only the required current-user lookup should occur after Redis token consume. |

## 2026-06-08 20:06 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2807 SecurityAuditLogManagement audit message/description localization.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/SecurityAuditLogManagement.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `SecurityAuditLogManagement.test.ts` verifies the stale `'Description: by Admin'` literal is absent and the page still renders audit message values through localized `messageLabel(...)` backed by `auditMessageLabels`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Audit message English locale | SOURCE_COVERED / I18N E2E PENDING | Open Security Audit Log Management in English, inspect audit log rows/details with admin-created events, and verify descriptions/messages use localized English labels with no stale `'Description: by Admin'` text. |
| Audit message Chinese locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Chinese and verify common audit actions/messages, including user/order/payment/admin events, render Chinese localized labels instead of hardcoded English or raw source strings. |
| Audit message Spanish locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Spanish and verify localized audit action/resource/message text appears in the table and detail view while query/filter option values remain stable for backend requests. |

## 2026-06-08 20:05 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2806 customer return-request modal localization.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/OrderTracking.test.tsx --watchAll=false --runInBand` passed with existing React/Router deprecation warning noise
- Unit/source coverage: `OrderTracking.test.tsx` verifies the stale `ReturnManagement` component and `"Return request for order"` literal are absent, and both active return request modals in Profile and Order Tracking use localized `pages.profile.returnOrder` and `pages.profile.returnReasonPlaceholder` keys.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile return request English locale | SOURCE_COVERED / I18N E2E PENDING | From Profile order history, open a returnable order's return request modal in English and verify title, reason prompt, review hint, confirm/cancel buttons, and success message are localized with no stale `"Return request for order"` text. |
| OrderTracking guest return request | SOURCE_COVERED / I18N E2E PENDING | Track a guest returnable order, open the return request modal, and verify localized copy and accessible names in English/Chinese/Spanish while submitting a reason still calls the guest return endpoint. |
| Return shipment follow-up | SOURCE_COVERED / RETURN E2E PENDING | For a `RETURN_APPROVED` order, open submit-return-tracking from Profile and Order Tracking and verify the tracking modal copy is localized and the tracking number submission still succeeds. |

## 2026-06-08 20:03 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2805 Profile address-management add-address localization.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `Profile.test.ts` verifies the stale `AddressManager`, `data-testid="add-address-button"`, and hardcoded `"添加新地址"` literals are absent; current Profile address add/modal labels use locale keys present in English, Chinese, and Spanish.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile address English locale | SOURCE_COVERED / I18N E2E PENDING | Open Profile > Addresses in English and verify the add-address button, empty state, modal title, save/cancel buttons, and address actions render English locale copy with no Chinese literals or raw keys. |
| Profile address Chinese locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Chinese and verify add/edit/delete/default address controls render Chinese locale copy from the active Profile page, not a stale AddressManager route. |
| Profile address Spanish locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Spanish and verify add-address and modal copy localize correctly while create/edit/delete/default workflows still work. |

## 2026-06-08 20:01 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2804 ErrorBoundary localized fallback copy.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/components/ErrorBoundary.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `ErrorBoundary.test.ts` verifies the fallback copy is sourced from `errorBoundary.*` locale keys, the stale `data-testid="error-fallback"` hook is absent, hardcoded visible `"Error"` fallback text is absent, and English/Chinese/Spanish locale keys exist.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| English error fallback | SOURCE_COVERED / I18N E2E PENDING | Force a disposable page/component error with English selected and verify the fallback title, subtitle, retry button, and back-home button show localized English copy with no raw keys or generic hardcoded `Error` heading. |
| Chinese error fallback | SOURCE_COVERED / I18N E2E PENDING | Repeat with Chinese selected and verify the same fallback controls render Chinese locale copy and that retry recovers when the component can render again. |
| Spanish error fallback | SOURCE_COVERED / I18N E2E PENDING | Repeat with Spanish selected and verify fallback copy and button accessible names are localized, including any custom `homeLabel` override used by routed pages. |

## 2026-06-08 19:59 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2803 SystemMonitor runtime metric translation keys.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/SystemMonitor.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `SystemMonitor.test.ts` verifies stale `t('common.loading')`, `t('system.cpu')`, and `t('system.memory')` calls are absent, and that current page-scoped CPU/memory metric keys exist in English, Chinese, and Spanish locale files.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| SystemMonitor English locale | SOURCE_COVERED / I18N E2E PENDING | Open System Monitor in English and verify CPU cores, JVM memory, used/free memory, disk, dependency status, and operations tips render localized text rather than raw translation keys. |
| SystemMonitor Chinese locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Chinese and verify the same runtime metric labels and status values render localized Chinese copy without raw `pages.systemMonitor.*`, `system.*`, or `common.*` key text. |
| SystemMonitor Spanish locale | SOURCE_COVERED / I18N E2E PENDING | Switch to Spanish and verify CPU/memory/disk/status labels are translated and no fallback raw keys appear after refreshing system status. |

## 2026-06-08 19:57 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Accessibility F2802 ProductManagement row action button labels.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/ProductManagement.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `ProductManagement.test.ts` verifies the product row feature, edit, duplicate, approve, reject, review, and delete action buttons keep product-specific `aria-label`/`title` values.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product row keyboard navigation | SOURCE_COVERED / ACCESSIBILITY E2E PENDING | In Product Management, tab through a populated product row and verify each action receives a visible focus state in logical order without skipping icon-only buttons. |
| Screen-reader action names | SOURCE_COVERED / ACCESSIBILITY E2E PENDING | With a screen reader or accessibility tree inspection, verify feature/unfeature, edit, duplicate, approve, reject, review, and delete row actions announce localized action text plus the target product name. |
| Confirmation dialog labels | SOURCE_COVERED / ACCESSIBILITY E2E PENDING | Trigger feature/status/delete confirmations and verify confirm/cancel controls have localized accessible names tied to the product-specific action. |

## 2026-06-08 19:56 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Internationalization F2801 SecurityAuditLogManagement stale hardcoded audit-trace headings.

Local verification already run:
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/SecurityAuditLogManagement.test.ts --watchAll=false --runInBand` passed
- Unit/source coverage: `SecurityAuditLogManagement.test.ts` verifies the page source does not contain stale `"Full link trace"`, `"Top 10 slow requests"`, `"完整链路追踪"`, or `"前 10 个慢请求"` headings, while existing tests keep audit value localization coverage.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Security audit log English locale | SOURCE_COVERED / I18N E2E PENDING | Open the admin Security Audit Log Management page with English selected and verify visible headings, table labels, filters, enum labels, and detail modal content are localized English copy rather than raw keys or mixed Chinese text. |
| Security audit log Chinese locale | SOURCE_COVERED / I18N E2E PENDING | Switch the same page to Chinese and verify the audit log labels and detail content render through locale resources, with no stale hardcoded trace headings or untranslated raw keys. |
| Locale switching without reload | SOURCE_COVERED / I18N E2E PENDING | Toggle language while the audit log table and a detail view are loaded; verify the page updates labels consistently without dropping query filters, pagination, or selected audit log state. |

## 2026-06-08 19:53 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST UX/API F2800 business exception messages.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=GlobalApiExceptionHandlerTest test` passed
- Unit/source coverage: `GlobalApiExceptionHandlerTest` verifies business `IllegalStateException` messages return as HTTP 400 payload errors and the stale generic runtime handler/text are absent; existing tests keep unexpected exceptions masked.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Business validation messages | SOURCE_COVERED / API E2E PENDING | Trigger representative business errors such as insufficient stock, expired/invalid coupon, duplicate registration email, and current-password mismatch. Verify HTTP status is 400 where appropriate and the response `error`/`message` contains the client-safe business reason. |
| Unexpected error masking | SOURCE_COVERED / API E2E PENDING | In a disposable environment, force a non-business server exception and verify the response stays generic (`Internal server error`), with no stack trace, exception class, database detail, or secret value exposed. |
| Error envelope consistency | SOURCE_COVERED / API E2E PENDING | Verify 400/403/404/429/500 responses include the normalized error envelope fields (`status`, `statusText`, `path`, `requestId`, `timestamp`) and preserve request correlation headers. |

## 2026-06-08 19:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST Data Integrity/Concurrency F2799 stock restoration atomicity.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=OrderStockReservationServiceTest test` passed
- Unit/source coverage: simple-product restocks use the atomic `ProductRepository.increaseStock(...)` SQL path; variant JSON restocks remain on the locked entity path; zero-row atomic updates are logged.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Concurrent simple-product cancellations | SOURCE_FIXED / CONCURRENCY E2E PENDING | Create two pending-payment orders for the same simple-stock product, then cancel or expire both concurrently. Verify final product stock increases by the sum of both quantities with no lost update. |
| Concurrent refunds/restock | SOURCE_FIXED / CONCURRENCY E2E PENDING | For paid orders on the same simple-stock product, trigger two admin refund-with-restock operations concurrently and verify stock increments by both quantities exactly once. |
| Variant restock serialization | SOURCE_FIXED / CONCURRENCY E2E PENDING | Repeat cancellation/refund restock against a variant SKU and verify the variant JSON stock is correct after concurrent operations, with no lost update or malformed variant payload. |

## 2026-06-08 19:47 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST Security F2798 public app-config runtime/build leakage.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=AppConfigControllerTest test` passed
- Frontend type check: `npx tsc --noEmit --pretty false` passed
- Frontend focused Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx src/api/index.test.ts --watchAll=false --runInBand` passed with existing React/AntD warning noise
- Unit/source coverage: `AppConfigControllerTest` verifies anonymous app config includes only safe storefront fields and excludes `runtimeMode`, `paymentSimulationEnabled`, `buildTime`, mobile version fields, and `appId`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Anonymous app config response | SOURCE_FIXED / SECURITY API E2E PENDING | Request `GET /app/config` without auth in staging and verify the JSON contains only storefront-safe fields such as email-code availability and shipping fee/threshold, and does not contain runtime mode, payment simulation state, build timestamps, app IDs, or mobile version metadata. |
| Stale config route probe | SOURCE_FIXED / SECURITY API E2E PENDING | Probe stale `GET /config`; verify it is not a working anonymous config endpoint and does not expose runtime/build/payment simulation metadata. |
| Storefront regression | SOURCE_FIXED / STOREFRONT E2E PENDING | Open login/register/forgot-password/profile email-code flows, cart/checkout shipping messaging, and checkout payment recovery; verify email-code availability and shipping fee/threshold UI still load, while simulation-payment controls are not exposed from anonymous app config. |

## 2026-06-08 19:41 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE / REGRESSION_GUARD_ADDED for TEST Security F2797 CSRF-disabled stateless bearer-auth contract.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=SecurityConfigCorsTest test` passed
- Unit/source coverage: `SecurityConfigCorsTest` verifies CSRF disablement remains paired with `SessionCreationPolicy.STATELESS`, source documentation for no browser session cookies, bearer-only JWT extraction, no cookie-based JWT extraction, and a frontend client that uses Authorization headers without `withCredentials`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cross-site form submission without bearer token | SOURCE_NON_ISSUE / SECURITY API E2E PENDING | From an untrusted origin, submit simple form POSTs to representative protected mutation endpoints such as `/products`, `/admin/config-center/apply`, `/orders/checkout/me`, and `/users/profile/email-code`; verify no ambient cookie/session authenticates the request and no state mutation occurs. |
| Authorized bearer-token mutation | SOURCE_NON_ISSUE / SECURITY API E2E PENDING | From the configured storefront/admin origin, perform the same representative mutations with explicit `Authorization: Bearer ...`; verify legitimate authenticated workflows still succeed without CSRF tokens. |
| Cookie/session regression guard | SOURCE_NON_ISSUE / SECURITY API E2E PENDING | Inspect login, refresh, logout, and authenticated API responses in browser/devtools; verify no `Set-Cookie`/`JSESSIONID` authenticated session is issued and frontend requests do not use `withCredentials` for auth state. |

## 2026-06-08 19:39 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Security/Availability F2796 guest checkout rate limiting.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=RateLimitServiceTest test` passed
- Unit/source coverage: `RateLimitServiceTest` verifies `POST /orders/checkout/guest` uses the dedicated per-client hourly `checkout:guest` bucket, rejects the first request over the configured limit, and exposes hot-bucket telemetry.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest checkout burst throttling | SOURCE_COVERED / SECURITY API E2E PENDING | In staging with `TRAFFIC_RATE_LIMIT_GUEST_CHECKOUT_PER_HOUR` temporarily set low, submit repeated valid `POST /orders/checkout/guest` requests from the same client. Verify responses include rate-limit headers, requests up to the limit proceed normally, and the next request returns HTTP 429 with `Retry-After` and no order/payment/stock mutation. |
| Per-client isolation | SOURCE_COVERED / SECURITY API E2E PENDING | Repeat the burst from two distinct client IP identities or trusted proxy headers; verify one client's exhausted `checkout:guest` bucket does not block the other client before its own limit is reached. |
| Stale route probe | SOURCE_COVERED / SECURITY API E2E PENDING | Probe the stale `POST /guest/orders` route and verify it is not a working anonymous order-creation endpoint and cannot create guest users, reserve stock, or insert orders. |

## 2026-06-08 19:36 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Security F2795 password-login timing/account enumeration.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=LoginControllerPasswordLoginTest,CustomUserDetailsServiceTest test` passed
- Unit/source coverage: `LoginControllerPasswordLoginTest` verifies syntactically valid unknown password logins still delegate to `AuthenticationManager` and return the generic invalid-credentials path; `CustomUserDetailsServiceTest` verifies Spring Security `DaoAuthenticationProvider` performs the missing-user dummy password hash comparison.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Unknown vs registered bad-password timing | SOURCE_COVERED / SECURITY API E2E PENDING | In staging with production-like BCrypt cost, run repeated `POST /auth/login` attempts for a registered email with a wrong password and an unknown email with the same password from a controlled client. Verify both return the same generic invalid-credentials body/status and no reliably exploitable timing gap remains after warming caches. |
| Username, email, and phone identifiers | SOURCE_COVERED / SECURITY API E2E PENDING | Repeat timing/status checks for username, email, and phone login identifiers, including case/whitespace normalization, and verify unknown identifiers still hit the generic authentication failure path without revealing account existence. |
| Rate-limit and lockout boundaries | SOURCE_COVERED / SECURITY API E2E PENDING | Exercise failed-login bursts up to and beyond configured IP/account thresholds; verify rate-limit/lockout responses trigger only at expected thresholds, do not disclose whether an arbitrary email exists before those thresholds, and audit/rate-limit telemetry is recorded. |

## 2026-06-08 19:33 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Security F2794 CORS private-LAN/private-network defaults.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=SecurityConfigCorsTest,ApplicationProfileContractTest test` passed
- Unit/source coverage: production filters unsafe origins, base/dev defaults exclude private-LAN wildcards, non-production loopback fallback remains, explicit device-origin opt-in remains outside production, and `SecurityConfig` does not contain `allowPrivateNetwork(true)`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Production/staging allowed origin | SOURCE_COVERED / SECURITY API E2E PENDING | Send authenticated CORS preflight and request from the configured HTTPS storefront/admin origins; verify `Access-Control-Allow-Origin` matches the configured origin, credentials are allowed, and exposed rate-limit/request headers remain present. |
| Private-LAN and wildcard rejection | SOURCE_COVERED / SECURITY API E2E PENDING | Preflight from `http://192.168.1.55:3000`, `http://10.0.0.5:3000`, `http://localhost:3000`, and `https://*.example.test` against a production-mode backend; verify no credentialed CORS allow response and no `Access-Control-Allow-Private-Network` grant. |
| Non-production explicit device opt-in | SOURCE_COVERED / SECURITY API E2E PENDING | In a disposable dev-mode environment with an explicit concrete LAN origin in `CORS_ALLOWED_ORIGIN_PATTERNS`, verify that exact origin works while broad private-LAN wildcards remain absent by default. |

## 2026-06-08 19:31 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Performance F2793 order-list N+1 user lookup.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=OrderStatsServiceTest,AdminControllerOrderPageTest,OrderControllerCustomerPaginationTest test` passed
- Unit/source coverage: `OrderStatsServiceTest` guards paged customer/admin order list calls, joined customer fields from `OrderMapper`, `LIMIT/OFFSET`, and absence of `userMapper.selectById(...)` enrichment loops.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin order page query shape | SOURCE_COVERED / PERFORMANCE E2E PENDING | With a dataset containing registered and guest orders, open `/admin/orders?page=1&size=20` and `/admin/orders/page`; verify one bounded page of items, customer display fields populated, and SQL/log instrumentation shows no per-row user lookup loop. |
| Customer order page query shape | SOURCE_COVERED / PERFORMANCE E2E PENDING | Open `/orders/me?page=0&size=20` and `/orders/user/{id}?page=0&size=20`; verify page headers/items are bounded and no extra per-order user queries occur. |
| Large dataset guard | SOURCE_COVERED / PERFORMANCE E2E PENDING | Against a staging dataset with thousands of orders, verify admin/customer order pages remain bounded by configured `size`, direct `/admin/orders` compatibility returns the page object, and response time does not grow linearly with total order count due to user enrichment. |

## 2026-06-08 19:29 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Data Integrity F2792 checkout stock reservation oversell.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=OrderStockReservationServiceTest test` passed
- Unit/source coverage: guest checkout reservation now has a direct guard proving the lock path uses `findAllByIdForUpdate(...)`, avoids unlocked `findAllById(...)`, and persists decremented stock.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Concurrent registered checkout low stock | SOURCE_COVERED / CONCURRENCY E2E PENDING | With a product stock of 1 and two authenticated carts for that product, submit checkout concurrently; verify only one order reserves stock and the other receives insufficient-stock failure, with final product stock never below 0. |
| Concurrent guest checkout low stock | SOURCE_COVERED / CONCURRENCY E2E PENDING | Repeat with two guest checkout requests for the same stock-1 product and same/valid payment channel; verify only one pending order is created and final stock is 0, not negative. |
| Variant stock concurrency | SOURCE_COVERED / CONCURRENCY E2E PENDING | For a variant-only SKU stock of 1, race two registered or guest checkouts selecting the same variant; verify one succeeds, one fails, and variant JSON stock remains consistent. |
| Rollback regression | SOURCE_COVERED / CONCURRENCY E2E PENDING | Force an order-write failure after stock reservation in a disposable environment and verify product/variant stock rolls back with no cart/order partial state. |

## 2026-06-08 19:27 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST Security F2791 JWT signing secret runtime fallback.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=JwtServiceTest,ConfigCenterServiceTest test` passed
- Unit/source coverage: `JwtServiceTest` guards that token signing/parsing uses the construction-time `${app.jwtSecret}` value and does not fetch `app.jwtSecret` through `RuntimeConfigService`; `ConfigCenterServiceTest` guards rejection of `app.jwtSecret` and `security.jwt.*` keys.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| JWT secret runtime-change resistance | SOURCE_FIXED / SECURITY API E2E PENDING | In staging, sign in with a known deployment `JWT_SECRET`, then attempt to change `app.jwtSecret` or `security.jwt.secret` through Config Center/runtime admin paths; verify the change is rejected and existing/new tokens continue using the startup secret until restart. |
| Weak/default JWT secret rejection | SOURCE_FIXED / SECURITY API E2E PENDING | In a disposable environment with blank, placeholder, short, or `admin123456` JWT secret values, verify login/token parsing fails safely and no forged token signed with those values is accepted. |
| Restart-required rotation path | SOURCE_FIXED / SECURITY API E2E PENDING | Rotate `JWT_SECRET` via deployment environment and restart the backend; verify old tokens fail after restart, new logins succeed with the new secret, and readiness/system checks report the configured secret without exposing its value. |

## 2026-06-08 19:24 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Security F2790 guest order mutation access.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=OrderControllerGuestAfterSaleAccessTest,PaymentControllerSimulationAccessTest,OrderInputNormalizationServiceTest,RateLimitServiceTest test` passed
- Unit/source coverage: guest mutations require matching `guestEmail` plus `orderNo`, registered orders reject guest access, anonymous payment creation follows the same contract, and guest mutation rate limiting uses the shared `orders:guest-mutation` bucket across order IDs.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Stale guestToken route probes | SOURCE_COVERED / SECURITY API E2E PENDING | Probe stale `/guest/orders/{guestToken}/cancel`, `/pay`, `/payment-method`, and `/shipping` paths in staging; they should return not-found or unauthorized and must not mutate orders, create payments, or create guest users. |
| Current guest mutation negative cases | SOURCE_COVERED / SECURITY API E2E PENDING | For `PUT /orders/guest/{id}/cancel`, `/confirm`, `/return`, `/return-shipment`, and `POST /payments`, omit or mismatch `guestEmail` and `orderNo`; verify HTTP 403/validation failure, no order/payment mutation, and failed guest-attempt recording/rate-limit telemetry. |
| Current guest mutation positive cases | SOURCE_COVERED / SECURITY API E2E PENDING | With a real guest order and matching email plus order number, verify legitimate guest cancel, confirm receipt, return request, return shipment, and payment creation flows still succeed. |
| Guest mutation throttling | SOURCE_COVERED / SECURITY API E2E PENDING | Burst guest mutation attempts across multiple order IDs from the same client and verify the dedicated guest-mutation rate limit eventually rejects further attempts without consuming or exposing other users' orders. |

## 2026-06-08 19:17 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST Security F2789 Config Center protected runtime keys.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=ConfigCenterServiceTest,GlobalApiExceptionHandlerTest test` ✅
- Unit/source coverage: `ConfigCenterServiceTest` guards rejection of `app.jwtSecret`, `app.cors.allowed-origin-patterns`, `app.websocket.allowed-origin-patterns`, `security.jwt.secret`, `security.cors.allowed-origins`, and `security.session.timeout-seconds`, even when allowed prefixes are overridden.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Config Center protected-key apply | SOURCE_FIXED / SECURITY API E2E PENDING | As an admin with Config Center apply permission, submit `/admin/config-center/apply` content containing protected JWT, CORS/WebSocket origin, and session keys plus one safe order key; verify the response contains validation errors, `runtimeApplied=false`, and none of the keys are applied. |
| Config Center protected-key publish | SOURCE_FIXED / SECURITY API E2E PENDING | Repeat through `/admin/config-center/publish` with `applyRuntime=true`; verify protected keys block publish/apply, audit records failure, and the response does not expose raw secret values. |
| Config Center safe-key regression | SOURCE_FIXED / SECURITY API E2E PENDING | Verify ordinary allowed business keys such as `order.default-shipping-fee`, `payment.simulation-enabled`, and `support.websocket.max-connections` still publish/apply as expected, while `app.cors.*`, `app.websocket.*`, `app.jwt*`, `security.jwt.*`, `security.cors.*`, and `security.session.*` remain rejected. |

## 2026-06-08 19:15 UTC Maintainer Cycle Regression Handoff

Source status: CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for TEST Security F2788 admin bootstrap exposure.

Local verification already run:
- Backend focused tests: `./mvnw -q -Dtest=SecurityConfigCorsTest,UserControllerAdminBootstrapTest,UserServiceTest test` ✅
- Unit/source coverage: `SecurityConfigCorsTest` guards that `/admin/bootstrap/first-super-admin` is absent and `/users/create-admin` remains narrow/controller-gated; `UserControllerAdminBootstrapTest` guards missing-token, not-configured, and already-completed rejection paths.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Stale bootstrap route probe | SOURCE_COVERED / SECURITY API E2E PENDING | In staging, unauthenticated `POST /admin/bootstrap/first-super-admin` should return not-found or unauthorized and must not create or mutate any admin user. |
| Real bootstrap route negative cases | SOURCE_COVERED / SECURITY API E2E PENDING | Unauthenticated `POST /users/create-admin` with no `X-Bootstrap-Token`, wrong token, and blank runtime `admin.bootstrap-token` should return forbidden and leave user/admin counts unchanged. |
| Real bootstrap route controlled positive/completed cases | SOURCE_COVERED / SECURITY API E2E PENDING | In a disposable fresh database with an explicit temporary bootstrap token, verify exactly one first admin can be created, then repeat the request and verify it is rejected as already completed; in normal staging/prod-like data verify existing-admin rejection and production readiness with no lingering bootstrap token. |

## 2026-06-08 19:12 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F2810 mobile Admin Dashboard hero/readiness clipping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/AdminDashboard.test.tsx --watchAll=false --runInBand` ✅ with existing React/React Router warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `AdminDashboard.test.tsx` guards the F2810 mobile CSS override that removes sticky hero clipping, restores auto height/visible overflow, disables the clipped decoration, and separates the readiness section.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin dashboard mobile first viewport | SOURCE_FIXED / ADMIN DASHBOARD E2E PENDING | Sign in as `SUPER_ADMIN`, open `/admin/dashboard` at `390x844`, `360x740`, and `430x932`; verify the hero heading, both hero metric cards, the full `92` readiness score, readiness label, and Commercial readiness copy are visible without clipping or overlap. |
| Mobile dashboard scroll transition | SOURCE_FIXED / ADMIN DASHBOARD E2E PENDING | At the same widths, scroll through the readiness/action sections; verify the former sticky hero no longer covers the readiness cards, the horizontal metric/readiness rails remain scrollable, and no dashboard controls disappear under mobile chrome. |
| Admin dashboard regression | SOURCE_FIXED / ADMIN DASHBOARD E2E PENDING | Recheck tablet `768x1024`, desktop `1366x900`, Spanish locale, dashboard charts, action center navigation, payment/return operations, SLA cards, recent orders, and low-stock panels so the mobile hero override does not regress non-mobile layouts. |

## 2026-06-08 19:09 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F2855 storefront short-landscape first viewport.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx --watchAll=false --runInBand` ✅ with existing React Router/AntD/act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Navbar.test.tsx` guards the `max-width: 780px` / `max-height: 430px` compact navbar mode, hidden stacked chrome/bottom nav, compact `brand search actions` grid, 44px search control, and nowrap scrollable actions.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront short-landscape first viewport | SOURCE_FIXED / NAVBAR E2E PENDING | Open `/`, `/products?q=feeder&sort=price_desc`, `/products/1`, and `/coupons` at `740x360`; verify meaningful first-screen content is visible and the bottom nav does not cover the first viewport. |
| Adjacent tablet landscape regression | SOURCE_FIXED / NAVBAR E2E PENDING | Open the same routes plus the More menu at `844x390`; verify the F3358 compact tablet nav remains correct, visible controls stay reachable, and the F2855 short-height mode does not reintroduce oversized stacked navigation. |
| Navigation regression | SOURCE_FIXED / NAVBAR E2E PENDING | Recheck portrait mobile `390x844`, `360x740`, `320x568`, desktop `1366x900`, search, category access, More, cart/account/action controls, authenticated and guest states, and bottom-nav route changes. |

## 2026-06-08 19:04 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F2857 Wishlist duplicate login-required toast.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand` ✅ with existing React/React Router warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Wishlist.test.tsx` guards the stable AntD message key and rejects the old unkeyed login-required warning call.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Unauthenticated Wishlist redirect | SOURCE_FIXED / WISHLIST E2E PENDING | Open `/wishlist` while logged out at `390x844`, `360x740`, and desktop `1366x900`; verify the app redirects to `/login` and exactly one login-required AntD message is visible. |
| Mobile message placement | SOURCE_FIXED / WISHLIST E2E PENDING | At mobile widths, verify the single warning does not stack over itself, does not obscure the login form controls, and clears normally. |
| Wishlist regression | SOURCE_FIXED / WISHLIST E2E PENDING | Recheck authenticated Wishlist load, remove, add-to-cart, Add all ready, mobile conversion action, and bottom-nav routing to confirm the keyed redirect warning does not affect signed-in workflows. |

## 2026-06-08 19:02 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F2858 Pet Gallery toolbar vs mobile bottom navigation.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/PetGallery.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `PetGallery.test.ts` guards the toolbar source actions, bottom-nav-aware sticky offset, two-column mobile action grid, page scroll padding, and Gallery momentum scroll margin.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pet Gallery mobile toolbar | SOURCE_FIXED / PET GALLERY E2E PENDING | Open `/pet-gallery` unauthenticated at `390x844`, `360x740`, and `430x932`; verify `Latest community moments`, `Log in to upload`, and `Refresh` stay above the fixed bottom nav, are readable, and receive pointer hit-tests on their own controls rather than `.shop-nav__bottomBar`. |
| Gallery momentum transition | SOURCE_FIXED / PET GALLERY E2E PENDING | At the same widths, scroll through the toolbar into the `Gallery momentum` section; verify the section heading/start is readable and not hidden under either the toolbar or bottom navigation. |
| Pet Gallery regression | SOURCE_FIXED / PET GALLERY E2E PENDING | Recheck authenticated upload entry, refresh, gallery card likes/delete/camera controls, preview modal, desktop `1366x900`, tablet `768x1024`, and bottom-nav route changes so the toolbar offset does not regress adjacent gallery workflows. |

## 2026-06-08 18:58 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F2859 customer support panel mobile-landscape layout.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CustomerSupportWidget.test.tsx` guards the `<=780px` and `900x430` compact viewport detection, body-lock/mobile state reuse, safe-area compact support sheet, scrollable messages/composer rows, and short-landscape triage/quick-reply trim.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Unauthenticated support open in landscape | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Open support via `shop:open-support` at `740x360` and `844x390`; verify the panel becomes a compact viewport-bounded sheet, the backdrop is visible, the messages area has meaningful height, and the order selector, message field, Close conversation, and Login/Send controls are visible or clearly reachable without clipped overflow. |
| Portrait/mobile support open | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Repeat at `390x844`, `360x740`, and `320x568`; verify the existing mobile sheet still scrolls normally, body/background scroll is locked while open, the bottom navigation does not cover support controls, and all action targets remain tappable. |
| Support workflow regression | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Recheck authenticated customer support with orders, order Select, View order modal from F3540, quick replies, close conversation, send message, support open/close, desktop `1366x900`, tablet `768x1024`, and storefront bottom-nav interactions after closing the panel. |

## 2026-06-08 18:53 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3357 short-landscape storefront More menu clipping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx --watchAll=false --runInBand` ✅ with existing React Router/AntD/act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Navbar.test.tsx` guards the body-mounted More dropdown popup class, document-body portal target, short-height fixed safe-area placement, scrollable menu max-height, and mobile-landscape bottom-nav height subtraction.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Short-landscape More menu | SOURCE_FIXED / NAVBAR E2E PENDING | Open the unauthenticated storefront at `740x360` and `844x390`, then open the More menu; verify all utility actions are visible or clearly scrollable/tappable, the menu stays inside the viewport, and History/Stock alerts are no longer clipped below the bottom edge. |
| Mobile portrait More menu | SOURCE_FIXED / NAVBAR E2E PENDING | Repeat at `390x844` and `320x568`; verify the More menu still exposes login/register, seller/products, pet finder/gallery, deals, track order, coupons, Android app, support, compare, history, and stock alerts without regressing portrait spacing or tap targets. |
| Navigation regression | SOURCE_FIXED / NAVBAR E2E PENDING | Recheck More-menu action routing, locale/currency dropdowns, the F3358 compact tablet mode, desktop `1366x900`, authenticated account state, category chips, search, cart, and bottom-nav overlap so the short-height constraint does not regress adjacent navigation surfaces. |

## 2026-06-08 18:49 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3358 tablet-landscape storefront utility navigation.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx --watchAll=false --runInBand` ✅ with existing React Router/AntD/act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Navbar.test.tsx` guards the More-menu utility entries, `781px-1024px` compact utility CSS, hidden dense top row, 44px compact controls, and non-wrapping category chips.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Tablet-landscape compact utility nav | SOURCE_FIXED / NAVBAR E2E PENDING | Open the unauthenticated storefront at `844x390`, `900x390`, and `1024x600`; verify the dense desktop top row is absent, visible header actions remain single-line or icon-only with 44px targets, login/register/account/cart/locale/More controls are reachable, and the header no longer consumes most of the first viewport. |
| More menu utility access | SOURCE_FIXED / NAVBAR E2E PENDING | At the same widths, open the More menu and verify seller/products, pet finder, pet gallery, deals, track order, coupons, Android app, support, compare, history, and stock alerts are reachable through the compact utility surface. |
| Navigation regression | SOURCE_FIXED / NAVBAR E2E PENDING | Recheck portrait mobile `390x844`, `320x568`, desktop `1366x900`, authenticated account state, locale/currency switching, category chips, search, cart, and Android app/download entry so the tablet compact mode does not regress mobile or full desktop navigation. |

## 2026-06-08 18:42 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3393 Spanish mobile bottom navigation label clipping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx --watchAll=false --runInBand` ✅ with existing React Router/AntD/act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Navbar.test.tsx` guards the language-specific bottom bar class, the Spanish `341px-380px` Products-label refinement, and the existing `max-width: 340px` icon-only fallback.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Spanish bottom nav labels | SOURCE_FIXED / NAVBAR E2E PENDING | Set `shop-language=es` and `currency=MXN`, open public storefront routes at `360x740`, `375x812`, `390x844`, and `320x568`; verify `Productos` is fully readable without ellipsis at 360/375, all other labels remain readable, and 320px still uses the deliberate icon-only hidden-label fallback. |
| Cross-locale bottom nav | SOURCE_FIXED / NAVBAR E2E PENDING | Repeat the same widths in English and Chinese; verify Home/Products/Coupons/Cart/App/Account labels do not newly truncate, the active state remains aligned, and native-app five-tab mode is unchanged. |
| Storefront navigation regression | SOURCE_FIXED / NAVBAR E2E PENDING | Recheck bottom-nav taps, badge positioning, Android app/download tab, account/login routing, desktop `1366x900`, and mobile header/search/category chips so the Spanish-only column rebalance does not affect broader navigation layout. |

## 2026-06-08 18:37 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3540 customer support order dropdown/detail modal stacking.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CustomerSupportWidget.test.tsx` guards the dedicated `support-order-select-popup` layer, explicit Select popup z-index style, top-left placement, raised `customer-support-widget__orderModalRoot`, modal `zIndex`, and CSS that keeps both overlays above the open support panel.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Support order Select | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Mock a signed-in customer with support sessions, chat messages, two customer orders, order detail, and order-item APIs. Open support via `shop:open-support`, open `Send order` at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and `1366x900`; verify first-option hit-tests land on `.ant-select-item-option-content`, not the textarea, Close conversation, Send, support panel, or composer. |
| Support order detail modal | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | From an order card, open `View order` at the same widths; verify modal content and close-button hit-tests land on the modal body/close button, not chat bubbles, composer fields, support header close, order-context tags, or the panel wrapper. |
| Support workflow regression | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Recheck open/close support, send message, quick replies, share latest order, order workflow chips, session switching, guest order context, desktop `1366x900`, and mobile/landscape panel scrolling so the raised support-order overlays do not strand stale overlays above a closed panel. |

## 2026-06-08 18:32 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3539 Profile address/pet modal popups.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Profile.test.ts` guards the scoped `profile-modal-popup` class on the address region Cascader, pet type Select, pet birthday DatePicker, and pet size Select, plus CSS that raises Profile editor popups above modal chrome and keeps them inside the mobile/tablet viewport.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Address region Cascader | SOURCE_FIXED / PROFILE E2E PENDING | Mock an authenticated customer profile with saved addresses, pet profiles, pending/shipped orders, payment channels, and account-page APIs. Open `/profile`, open the address editor, then open the Region Cascader at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and desktop; verify menu-item hit-tests land on `.ant-cascader-menu-item-content`, not the detail-address label, modal body, sticky footer, or modal wrapper. |
| Pet editor popups | SOURCE_FIXED / PROFILE E2E PENDING | Open the pet editor at the same widths, then open pet type Select, birthday DatePicker, and pet size Select; verify option/date-cell hit-tests land on `.ant-select-item-option-content` or `.ant-picker-cell-inner`, not form labels, modal content, modal wrap, header, or footer. |
| Profile workflow regression | SOURCE_FIXED / PROFILE E2E PENDING | Recheck address save, pet save, modal scroll/footer behavior, order/payment modals, desktop `1366x900`, and adjacent Profile account/order actions so the scoped popup fix does not regress unrelated Profile workflows. |

## 2026-06-08 18:25 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3538 Product Management editor modal popups.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ProductManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ProductManagement.test.ts` guards the scoped `product-management-page__editorPopup` class on editor Select/TreeSelect/RangePicker controls and rich block type Selects, plus CSS that raises editor popups above modal chrome and pins the RangePicker inside the visible viewport.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product editor Select/TreeSelect popups | SOURCE_FIXED / PRODUCT MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `products:write`, `products:delete`, `products:status`, and `products:import`, plus active categories/brands/tags and default Add product state. Open `/admin/products`, open Add product, then at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and desktop open category, status, vendor/brand, tags, and rich block type controls; verify option hit-tests land on `.ant-select-item-option-content` or tree item content, not Shopify cards, textareas, block action buttons, modal body, or footer. |
| Limited-time RangePicker | SOURCE_FIXED / PRODUCT MANAGEMENT E2E PENDING | At the same widths, open the limited-time RangePicker and verify the date grid, time columns, and OK/footer controls are visible inside the viewport with pointer events, including `320x568`, `360x740`, and `740x360` where the previous popup opened above the viewport. |
| Product editor regression | SOURCE_FIXED / PRODUCT MANAGEMENT E2E PENDING | Recheck modal scrolling, sticky footer actions, media rows, rich-content add/delete/move actions, preview, desktop `1366x900`, and non-editor product filters so the scoped editor popup fix does not regress adjacent product-management workflows. |

## 2026-06-08 18:19 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3537 Order Management fulfillment carrier dropdown stacking.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/OrderManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `OrderManagement.test.ts` guards the scoped `order-management-page__carrierPopup` class, full-width shipping/batch carrier Select classes, `placement="bottomLeft"`, and F3537 CSS that raises the carrier dropdown above modal chrome while constraining and wrapping options.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Single-order shipping carrier Select | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `orders`, `orders:export`, `orders:status`, `orders:fulfillment`, `orders:payment`, and `orders:refund`, plus active carriers with long names/codes and a `PENDING_SHIPMENT` order. Open `/admin/orders`, choose the `SHIPPED` transition, then open the carrier Select at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and desktop; verify the first option hit-test lands on `.ant-select-item-option-content`, all visible options are readable/clickable, and the selected carrier label remains inspectable before Enter tracking number. |
| Batch shipping carrier Select | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Select multiple shippable orders, open Batch ship orders, then open the batch carrier Select at the same widths; verify the dropdown is above the modal body/header/footer, not behind Cancel/Batch ship, and long carrier labels wrap inside the visible safe-area popup. |
| Order fulfillment regression | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Recheck shipping tracking input, auto-print checkbox, batch prefix input, footer actions, status transition dropdowns, desktop `1366x900`, and the F3536 detail/refund evidence modals so the scoped carrier popup fix does not regress adjacent order workflows or unrelated Select popups. |

## 2026-06-08 18:13 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3536 Order Management modal evidence layout.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/OrderManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `OrderManagement.test.ts` guards the typed `data-label` cell helper, the refund/detail modal evidence table wrappers, and the F3536 container-query card layout that exposes each modal table cell as a labeled row.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Refund modal payment evidence | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `orders`, `orders:export`, `orders:status`, `orders:fulfillment`, `orders:payment`, and `orders:refund`, plus paid, pending, reconcile-required, refunding, and refunded payment rows with long order/payment references. Open `/admin/orders`, open Refund now at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and desktop; verify payment method, status, amount, refund reference, and sync action are visible as labeled evidence before the destructive Refund now footer action. |
| Detail modal order/payment evidence | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Open Order items/detail for long order numbers, long product names/specs, and mixed payment states at the same widths; verify product id/name/specs, quantity, amount, subtotal, payment method, status, refund reference, created time, and sync action all wrap inside the modal without hidden horizontal columns. |
| Workflow regression | SOURCE_FIXED / ORDER MANAGEMENT E2E PENDING | Recheck modal open/close, status changes, shipping/batch/tracking modals, payment sync Popconfirm, refund reason/reference/restock controls, and desktop `1366x900`; confirm the evidence-card CSS is scoped to refund/detail modal evidence tables and does not break the main orders table. |

## 2026-06-08 18:04 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3535 Support Management mobile Popconfirm identity wrapping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/SupportManagement.test.tsx --watchAll=false --runInBand` ✅ with existing React/AntD act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `SupportManagement.test.tsx` guards the scoped `support-management__popconfirm` mobile popup class on the shared Popconfirm helper, assign/reopen/reissue/close Popconfirm title/description usage, and CSS that bounds the popup to phone safe-area edges while wrapping long title/description text and buttons.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Long close confirmation identity | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `support`, `support:reply`, `support:assign`, `support:close`, `support:reopen`, `support:read-state`, `orders`, and `coupons:birthday-reissue`, plus a selected support session whose username/session label is longer than the phone viewport. Open `/admin/support`, open Close conversation at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and desktop; verify the full customer/session identity wraps inside the visible Popconfirm before confirming and the Cancel/Confirm buttons remain visible and tappable. |
| Assign/reopen/reissue confirmations | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | At the same mobile/tablet/desktop widths, open assign-to-me, reopen conversation, and birthday reissue Popconfirms for long usernames/session labels and return-requested order context; verify titles and descriptions do not clip horizontally, remain readable inside safe-area bounds, and preserve the full identity before the operator confirms account-affecting actions. |
| Support workflow regression | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | Recheck queue selection handoff, reply composer, quick replies, order workflow, message polling, desktop `1366x900` side-by-side layout, and adjacent Popconfirm/button interactions to confirm the scoped popup CSS does not regress desktop placement or leave stale overlays above closed dialogs. |

## 2026-06-08 17:57 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3534 Support Management mobile queue-to-conversation handoff.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/SupportManagement.test.tsx --watchAll=false --runInBand` ✅ with existing React/AntD act warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `SupportManagement.test.tsx` guards the conversation pane ref, mobile-only `matchMedia('(max-width: 900px)')` handoff, `scrollIntoView`, focus transfer, focusable conversation pane, and mobile scroll-margin/focus CSS.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Queue click handoff | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `support`, `support:reply`, `support:assign`, `support:close`, `support:reopen`, `support:read-state`, `orders`, and `coupons:birthday-reissue`, plus unread/open/closed sessions and return-requested order context. Open `/admin/support`, click an urgent queue item at `320x568`, `360x740`, `390x844`, `740x360`, and `768x1024`; verify the viewport moves to the selected conversation and shows the conversation header plus latest message/order card or composer/action affordance. |
| Keyboard activation handoff | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | At the same mobile/tablet widths, focus a queue item and activate with Enter and Space; verify focus transfers to the conversation pane, the selected state is visible, and the operator is not left on the queue. |
| Desktop and workflow regression | SOURCE_FIXED / SUPPORT MANAGEMENT E2E PENDING | Recheck desktop `1366x900` side-by-side layout, queue pagination/search/filter, reply composer, quick replies, order workflow, assign/reopen/reissue/close controls, and message polling; verify the mobile handoff does not introduce unwanted desktop scroll jumps. |

## 2026-06-08 17:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3533 System Monitor mobile diagnostic value stacking.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/SystemMonitor.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `SystemMonitor.test.ts` guards the long diagnostic `Descriptions` fields and final mobile CSS that turns Ant Design table markup into full-width stacked rows with `table-layout: auto !important`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Long diagnostic values on phones | SOURCE_FIXED / SYSTEM MONITOR E2E PENDING | Mock a SUPER_ADMIN profile with `system` and `system:status`, degraded production config, long disk path, long blockers/warnings, long JDBC URL, database error, Redis hostname, Nacos namespace/group/data id, warnings, and errors. Open `/admin/system` at `320x568`, `360x740`, and `390x844`; verify Path, Blockers, Warnings, URL, Error, Address, Namespace, and Group values use the full card width, wrap normally, and do not collapse into 16px vertical text columns. |
| Tablet/landscape diagnostics | SOURCE_FIXED / SYSTEM MONITOR E2E PENDING | Recheck `740x360`, `768x1024`, and desktop `1366x900`; verify the stacked mobile override does not create horizontal page overflow, huge blank vertical gaps, clipped `Descriptions`, or desktop regressions. |
| System monitor workflow smoke | SOURCE_FIXED / SYSTEM MONITOR E2E PENDING | Recheck refresh, status cards, memory/disk dashboards, dependency status tags, production config messages, and ops tips after the CSS change; confirm the document height stays proportional to actual content instead of ballooning to tens of thousands of pixels. |

## 2026-06-08 17:46 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3532 Log Management RangePicker viewport placement.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/LogManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `LogManagement.test.ts` guards the scoped body-mounted log export RangePicker popup layer, `placement="bottomLeft"`, and the F3532 CSS that removes the 492px mobile picker minimum while pinning the picker dropdown inside safe-area viewport bounds.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Time range download picker | SOURCE_FIXED / LOG MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `logs`, `logs:debug`, and `logs:download`, plus long logger/log-path/status data. Open `/admin/logs`, open Time range download at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and `1366x900`; verify the RangePicker popup is visible inside the viewport, not above it, and month cells, time controls, and OK receive pointer events. |
| Log download control regression | SOURCE_FIXED / LOG MANAGEMENT E2E PENDING | At the same mobile/tablet widths, verify the range input stays inside the download card without horizontal page overflow, level Select and keyword input remain usable, and Download selected range still triggers the mocked download path. |
| Adjacent log controls | SOURCE_FIXED / LOG MANAGEMENT E2E PENDING | Recheck debug Popconfirm, logger reload, level Select popup, and desktop `1366x900` range picker placement so the scoped popup fix does not regress adjacent log-management controls or desktop picker behavior. |

## 2026-06-08 17:41 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3531 Bug Management modal footer clearance.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/BugManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `BugManagement.test.ts` guards the BUG create/edit/status modal shell, modal field coverage, mobile popup class usage, and the F3531 CSS contract for viewport-bounded modal content, body footer clearance, scroll padding, form-item scroll margins, compact non-wide grids, and sticky footer styling.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Create/Edit BUG modal fields | SOURCE_FIXED / BUG MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `bugs`, `bugs:read`, `bugs:write`, `bugs:scan`, and `bugs:status`, plus open/fixing BUG rows. Open `/admin/bugs`, click Create bug, then edit an existing BUG at `320x568`, `360x740`, `390x844`, `740x360`, and `768x1024`; verify Title, Module, Severity, Priority, Assigned to, Description, Page URL, Environment, Reproduction steps, Expected result, Actual result, and Attachment URLs are readable and receive pointer events after normal scrolling instead of hit tests returning `.ant-modal-footer`. |
| Scan/Update status modals | SOURCE_FIXED / BUG MANAGEMENT E2E PENDING | Open Scan bug and Update status at the same viewports; verify Status, Assigned to, Scan note, Fix summary, and Regression note controls scroll clear of the sticky footer and that Cancel/OK remain visible and tappable without covering visible fields. |
| BUG modal popup/regression smoke | SOURCE_FIXED / BUG MANAGEMENT E2E PENDING | Open Module, Severity, Priority, and Status Select dropdowns in the BUG modals, verify options remain inside the viewport and above modal chrome, then recheck desktop `1366x900` to confirm the compact mobile modal CSS does not regress desktop create/edit/status workflows. |

## 2026-06-08 17:32 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3530 Coupon editor/grant modal popup stacking.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/CouponManagement.test.tsx --watchAll=false --runInBand` ✅ with existing React act deprecation warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CouponManagement.test.tsx` guards the coupon editor/grant modal popup controls and the shared `.shop-mobile-popup-layer` `z-index: 2100 !important` mobile popup rule.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Coupon editor modal popups | SOURCE_FIXED / COUPON MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `coupons`, `coupons:write`, `coupons:delete`, `coupons:grant`, `coupons:birthday-run`, and `coupons:birthday-config`; open `/admin/coupons`, click Create coupon, and at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and `820x1180` open coupon type, scope, status, and valid-time RangePicker. Verify options/calendar/time/OK controls render above the modal and receive pointer events. |
| Grant modal user selector | SOURCE_FIXED / COUPON MANAGEMENT E2E PENDING | Open Grant coupon with mocked target users, open the grant-user multi-select at the same mobile/tablet widths, and verify user options render above the modal footer/body, are readable, and are selectable. |
| Shared popup layer regression | SOURCE_FIXED / POPUP LAYER E2E PENDING | Recheck birthday coupon type Select, toolbar filters, desktop coupon editor/grant flows, and one unrelated mobile page using `shop-mobile-popup-layer`; verify the important z-index fix does not leave stale popups above closed modals or unrelated overlays. |

## 2026-06-08 17:26 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3527 Category parent TreeSelect modal stacking.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/CategoryManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CategoryManagement.test.ts` guards the body-mounted parent TreeSelect popup and the shared `.shop-mobile-popup-layer` `z-index: 2100 !important` mobile popup rule.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Add root/child category parent selector | SOURCE_FIXED / CATEGORY TREESELECT E2E PENDING | Mock a SUPER_ADMIN profile with `categories`, `categories:write`, and `categories:delete`, plus a multi-level tree with long labels. Open `/admin/categories`, click Add root category/Add child category, open Parent category at `320x568`, `360x740`, `390x844`, `740x360`, `768x1024`, and `820x1180`; verify tree options render above the modal, are readable, and receive pointer events/hit tests instead of modal labels/inputs. |
| Edit/move category parent selector | SOURCE_FIXED / CATEGORY TREESELECT E2E PENDING | Edit an existing nested category, open Parent category, and verify current-parent/blocked-descendant behavior remains correct while the popup stays above the modal and within the viewport. |
| Shared popup layer regression | SOURCE_FIXED / POPUP LAYER E2E PENDING | Recheck desktop and adjacent category editor Select-like popups, plus at least one non-category mobile Select using `shop-mobile-popup-layer`; verify the new important z-index does not place popups above unrelated blocking overlays after they close. |

## 2026-06-08 17:22 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3526 Category Management readiness panel tablet/landscape containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/CategoryManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CategoryManagement.test.ts` guards all four category readiness metrics and the final F3526 CSS contract that collapses the health panel before tablet/landscape clipping and keeps metrics as a visible 2x2 grid.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Category readiness metrics at clipping breakpoints | SOURCE_FIXED / CATEGORY MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `categories`, `categories:write`, and `categories:delete`, plus a multi-level category tree with long taxonomy labels, missing images, missing English/Spanish names, weak descriptions, root categories, and leaf categories. Open `/admin/categories` at `740x360`, `768x1024`, and `820x1180`; verify Root categories, Shop-ready leaves, Missing images, and i18n gaps/localization gaps are all visible before the table without horizontal panning or clipping. |
| Portrait phone readiness grid | SOURCE_FIXED / CATEGORY MANAGEMENT E2E PENDING | Recheck `390x844`, `360x740`, and `320x568`; verify the readiness metrics stay visible, labels wrap inside the cards, and the tree table below retains its own horizontal scroll where needed. |
| Category workflow regression | SOURCE_FIXED / CATEGORY MANAGEMENT E2E PENDING | Recheck desktop (`1366x900` or wider), Add root category/Edit category modal, localization tabs, image preview, delete confirmation, search, and tree table actions; verify the F3526 CSS does not regress existing category-management interactions. |

## 2026-06-08 17:18 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3525 Brand Management health panel tablet/landscape containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/BrandManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `BrandManagement.test.ts` guards all four brand trust metrics and the final F3525 CSS contract that collapses the health panel before tablet/landscape clipping and keeps metrics as a visible 2x2 grid.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Brand trust metrics at clipping breakpoints | SOURCE_FIXED / BRAND MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `brands`, `brands:write`, and `brands:delete`, plus brand rows with missing logos, missing websites, weak descriptions, duplicate sort orders, inactive brands, unknown status, and long names/URLs. Open `/admin/brands` at `740x360`, `768x1024`, and `820x1180`; verify Active brands, Missing logo, Missing website, and Weak description are all visible before the table without horizontal panning or clipping. |
| Portrait phone health grid | SOURCE_FIXED / BRAND MANAGEMENT E2E PENDING | Recheck `390x844`, `360x740`, and `320x568`; verify the trust metrics stay visible, labels wrap inside the cards, and the table below retains its own horizontal scroll. |
| Brand workflow regression | SOURCE_FIXED / BRAND MANAGEMENT E2E PENDING | Recheck desktop (`1366x900` or wider), New/Edit brand modal, status Select, delete confirmation, search/status filters, and table actions; verify the F3525 CSS does not regress existing brand-management interactions. |

## 2026-06-08 17:13 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3524 Review Management mobile health metrics visibility.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ReviewManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ReviewManagement.test.ts` guards all four review health metrics and the final F3524 CSS that makes the metrics a visible 2x2 grid without hidden horizontal rail/mask/snap behavior.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Portrait review health metrics | SOURCE_FIXED / REVIEW MANAGEMENT E2E PENDING | Mock a SUPER_ADMIN profile with `reviews`, `reviews:moderate`, `reviews:reply`, and `reviews:delete`, plus pending/approved/hidden/unknown rows with low ratings, high `NEEDS_REPLY`, high `APPROVED`, review images, and long product/customer names. Open `/admin/reviews` at `320x568`, `360x740`, `390x844`, and `430x932`; verify average rating, low rating, need reply, and approved are all visible before the table without horizontal panning or hidden scrollbars. |
| Landscape/tablet regression | SOURCE_FIXED / REVIEW MANAGEMENT E2E PENDING | Recheck `740x360` and `768x1024`; verify the health metrics remain contained, the sticky toolbar does not obscure the metrics, and table horizontal scroll remains available only for the table. |
| Review workflow smoke | SOURCE_FIXED / REVIEW MANAGEMENT E2E PENDING | Exercise approve, hide, reply modal, delete confirmation, status filter, search, pagination, and review image thumbnails; verify the visible metrics fix does not regress moderation actions or popup layering. |

## 2026-06-08 17:09 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3523 Pet Gallery delete Popconfirm viewport containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/PetGalleryManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `PetGalleryManagement.test.ts` guards the scoped body-mounted delete Popconfirm, left placement, and the final F3523 CSS that constrains/wraps the confirmation popup and action buttons inside the viewport.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Long filename delete confirmation | SOURCE_FIXED / PET GALLERY E2E PENDING | Mock a SUPER_ADMIN profile with `pet-gallery` and `pet-gallery:delete`, plus gallery rows containing long original filenames, long usernames, active/deleted/user-upload/seed rows, large files, and IPv4/IPv6 metadata. Open `/admin/pet-gallery`, scroll to the action column, click Remove on a long-filename row at `740x360`, `768x1024`, and `820x1180`; verify the Popconfirm stays inside the visible viewport and Cancel/Delete are visible and tappable without horizontal page scroll. |
| Portrait phone and localization | SOURCE_FIXED / PET GALLERY E2E PENDING | Recheck `390x844`, `360x740`, and `320x568`, including Spanish and Chinese labels if available; verify the long filename/owner copy wraps cleanly, buttons wrap if needed, and the popup remains above admin chrome. |
| Desktop and adjacent actions | SOURCE_FIXED / PET GALLERY E2E PENDING | Recheck desktop (`1366x900` or wider), status/source filters, table horizontal scroll, image preview, and delete confirm/cancel flows; verify the page-specific Popconfirm class does not regress desktop placement or non-delete popups. |

## 2026-06-08 17:03 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3522 Logistics Carrier readiness panel tablet/landscape containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/LogisticsCarrierManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `LogisticsCarrierManagement.test.ts` guards all four readiness metrics and the final F3522 CSS contract that collapses the health panel before the tablet/landscape clipping range and keeps the metrics as a visible 2x2 grid without hidden rail/mask/snap behavior.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Logistics readiness warnings at clipping breakpoints | SOURCE_FIXED / LOGISTICS E2E PENDING | Mock a SUPER_ADMIN profile with `logistics-carriers`, `logistics-carriers:write`, and `logistics-carriers:delete`, plus active/inactive carrier rows with one missing tracking code, duplicate tracking codes, duplicate sort orders, and long names. Open `/admin/logistics-carriers` at `740x360`, `768x1024`, and `820x1180`; verify Active carriers, Missing codes, Duplicate codes, and Sort conflicts are all visible before the table without horizontal panning or clipping. |
| Portrait phone readiness grid | SOURCE_FIXED / LOGISTICS E2E PENDING | Recheck `390x844`, `360x740`, and `320x568`; verify the readiness metrics stay in a visible 2x2 grid, labels wrap inside the cards, and the admin table horizontal scroll remains available only for the table below. |
| Desktop and carrier workflow regression | SOURCE_FIXED / LOGISTICS E2E PENDING | Recheck desktop (`1366x900` or wider), New carrier/Edit carrier modal, status Select, delete confirmation, and table sorting/filtering; verify the desktop health layout remains usable and the F3522 CSS does not regress existing carrier-management interactions. |

## 2026-06-08 16:58 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3521 Announcement editor mobile date-picker viewport containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/AnnouncementManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `AnnouncementManagement.test.ts` guards both Starts at / Ends at DatePickers, scoped `announcement-management-page__datePopup` body popups, `placement="bottomLeft"`, and the final mobile CSS that fixes the picker inside the viewport.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| New announcement start/end pickers | SOURCE_FIXED / ANNOUNCEMENT E2E PENDING | Mock a SUPER_ADMIN profile with announcement write/delete permissions; open `/admin/announcements`, click New announcement, and at `320x568`, `360x740`, `390x844`, and `430x932` open both Starts at and Ends at pickers. Verify the month header, day grid, time controls, and OK/action controls remain inside the viewport and above the modal. |
| Edit announcement and scrolled modal body | SOURCE_FIXED / ANNOUNCEMENT E2E PENDING | Edit an existing scheduled announcement, scroll the modal body before opening each picker, and verify the picker still opens in the fixed viewport-safe layer instead of above or behind the modal. |
| Landscape/tablet/desktop regression | SOURCE_FIXED / ANNOUNCEMENT E2E PENDING | Recheck `740x360`, `768x1024`, and desktop; verify picker placement remains usable, modal footer stays reachable, and status Select / delete Popconfirm behavior is not regressed. |

## 2026-06-08 16:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3520 Config Center mobile properties editor clipping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ConfigCenter.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ConfigCenter.test.ts` guards the Config Center editor markup and the final mobile CSS contract that constrains `.config-center__grid`, `.config-center__editorCard`, `.config-center__contentItem`, control wrappers, and `textarea.config-center__editor` to the visible width.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Config Center mobile editor fit | SOURCE_FIXED / CONFIG CENTER E2E PENDING | Mock a SUPER_ADMIN profile with `config-center`, `config-center:apply`, and `config-center:publish`, plus a populated Nacos snapshot with long property keys and masked sensitive values; open `/admin/config-center` at `320x568`, `360x740`, `390x844`, and `430x932`; verify the Properties content card and textarea fit the visible admin content width without right-edge clipping. |
| Editor content and confirmation flows | SOURCE_FIXED / CONFIG CENTER E2E PENDING | Focus/edit long runtime property lines, open Apply runtime and Publish & Sync confirmations, and verify text remains readable/recoverable inside the editor while confirmation popups, masked-secret warnings, and action buttons stay reachable. |
| Tablet, landscape, and parsed tables | SOURCE_FIXED / CONFIG CENTER E2E PENDING | Recheck `740x360`, `768x1024`, and desktop with parsed/effective property tables visible; verify the editor remains contained, table horizontal scroll still works where needed, and no existing hero/action containment regresses. |

## 2026-06-08 16:43 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3519 Notification Broadcast mobile readiness checklist visibility.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/NotificationManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `NotificationManagement.test.ts` guards all four readiness signal labels and the final phone CSS contract that makes `.notification-readiness__checks` a visible grid with no hidden horizontal rail.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Broadcast readiness checks on phones | SOURCE_FIXED / NOTIFICATION E2E PENDING | Mock a SUPER_ADMIN profile with `notifications:broadcast`; open `/admin/notifications` at `320x568`, `360x740`, `390x844`, and `430x932`; verify Clear title, Useful content, Next-step link, and Conversion hook are all visible without horizontal scrolling in the empty composer state. |
| Template and send confirmation readiness | SOURCE_FIXED / NOTIFICATION E2E PENDING | Insert the promotion template, verify all four readiness tags stay visible and update their colors/count correctly, then open the send confirmation Popconfirm and verify the readiness grid is not obscured by admin chrome or the popup layer. |
| Localization and breakpoint regression | SOURCE_FIXED / NOTIFICATION E2E PENDING | Recheck Spanish labels plus `740x360`, `768x1024`, and desktop; verify readiness tags wrap without clipping, no hidden scrollbar/rail is required, and the composer/preview layout still fits. |

## 2026-06-08 16:38 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3518 Permission Management role editor footer containment.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/PermissionManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `PermissionManagement.test.ts` guards the role editor modal/checklist markup and the desktop/tablet CSS contract that caps `.permission-management-page__modal .ant-modal-content`, scrolls `.ant-modal-body`, and keeps `.ant-modal-footer` visible.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| New role editor desktop containment | SOURCE_FIXED / PERMISSIONS E2E PENDING | Mock a SUPER_ADMIN profile and full permission list; open `/admin/permissions`, click `New role`, and verify at `1366x900` and `1024x768` that the modal stays inside the viewport, the permission checklist scrolls inside the modal body, and Save/Cancel remain visible and clickable. |
| Edit role and long permission list | SOURCE_FIXED / PERMISSIONS E2E PENDING | Open an editable custom role with many selected permissions; verify body scrolling, keyboard focus traversal, validation errors, Save, and Cancel do not land below the viewport or behind the modal footer. |
| Tablet, mobile, and short landscape regression | SOURCE_FIXED / PERMISSIONS E2E PENDING | Recheck `768x1024`, `740x360`, `390x844`, `360x740`, and `320x568`; verify existing mobile sticky-footer behavior remains intact, footer buttons wrap cleanly, and no permission checkbox row is hidden behind the footer. |

## 2026-06-08 16:27 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3517 Security Audit Logs mobile sticky filter/header collision.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/SecurityAuditLogManagement.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `SecurityAuditLogManagement.test.ts` guards the audit toolbar markup, the final F3517 mobile CSS contract that makes `.audit-log-page__toolbar` non-sticky, and the page-specific `audit-log-page__rangePopup` body-mounted RangePicker layer.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin audit filters at table scroll position | SOURCE_FIXED / AUDIT LOG E2E PENDING | Mock a SUPER_ADMIN profile with populated audit logs and summary data; open `/admin/audit-logs` at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; scroll to the audit table and verify Action, Result, Resource, operator, date range, search, and export controls are not hidden behind the wrapped admin header. |
| Audit RangePicker popup visibility | SOURCE_FIXED / AUDIT LOG E2E PENDING | At the same phone/tablet widths, open the date range picker from the filter toolbar after scrolling; verify the calendar/time popup renders within the viewport, is above the admin chrome, and both range panels/time controls are reachable. |
| Short landscape and filter interactions | SOURCE_FIXED / AUDIT LOG E2E PENDING | Recheck `740x360` short landscape plus Spanish labels; apply action/result/resource/date/operator filters, search, clear/filter again, and export when permitted, verifying the non-sticky toolbar remains readable and the table horizontal scroll still works. |

## 2026-06-08 16:24 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3516 Profile mobile hidden account action, section, and order-filter rails.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Profile.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Profile.test.ts` guards the after-sale/pet/order-filter markup and the phone-width CSS contract that turns `.profile-action-center__cards`, `.profile-mobile-entry`, and `.profile-orders__tabs` into visible grids with no hidden overflow/masks.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile action center and section entries | SOURCE_FIXED / PROFILE E2E PENDING | Mock an authenticated profile with pending payment, shipped, after-sale, addresses, and pets; open `/profile?tab=orders` at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; verify Pending payment, In transit, After-sales, Pet profile ready, Orders, Addresses, Personal information, and Pets are all visible and tappable without horizontal scrolling. |
| Profile order-status filters | SOURCE_FIXED / PROFILE E2E PENDING | In the Orders tab, verify All, Pending payment, Pending shipment, Shipped, Completed, Returnable, After-sales, and Cancelled filters wrap visibly and each filter applies correctly for pending-payment, shipped, completed-returnable, return-approved, and empty-order states. |
| Profile localization and short landscape | SOURCE_FIXED / PROFILE E2E PENDING | Recheck Spanish labels and `740x360` short landscape; verify labels wrap without clipping, no high-value control is hidden behind a suppressed scrollbar, and existing address/info/pet workflows remain reachable. |

## 2026-06-08 16:19 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3515 Order Tracking shipped/returnable mobile action visibility.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/OrderTracking.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router act/deprecation warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `OrderTracking.test.tsx` guards the shipped return/support action markup and the phone-width CSS contract that turns `.order-tracking-page__nextActionButtons` into a visible grid with no hidden overflow mask.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Shipped returnable order actions | SOURCE_FIXED / ORDER TRACKING E2E PENDING | Mock a guest shipped order with `returnable=true` and open `/track-order` at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; verify `Confirm receipt`, `Return order`, and `Contact support` are all visible, readable, and tappable without horizontal scrolling. |
| Adjacent order states | SOURCE_FIXED / ORDER TRACKING E2E PENDING | Recheck shipped not-returnable, pending payment, return-approved, completed, restricted-login/account-order, and support-only states; verify every available next action remains visible and the assurance action rail is not regressed. |
| Short landscape | SOURCE_FIXED / ORDER TRACKING E2E PENDING | At `740x360`, verify the next-action panel stays compact and all available buttons remain visible or naturally stacked without clipping the order summary. |

## 2026-06-08 16:15 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3443 Wishlist mobile conversion action bottom-nav collision.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router act/deprecation warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Wishlist.test.tsx` guards the loaded-state `wishlist-page--withMobileAction` marker, bottom-nav offset variable, matching page padding, fixed mobile action bottom offset, Android WebView z-index, and short-landscape static fallback.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist ready-to-cart action | SOURCE_FIXED / WISHLIST E2E PENDING | Mock authenticated wishlist data with direct-add ready favorites and open `/wishlist` at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; verify `Add all to cart` sits above the global bottom nav, remains readable/tappable, and the nav remains readable/tappable below it. |
| Wishlist option-required and unavailable states | SOURCE_FIXED / WISHLIST E2E PENDING | Recheck mixed option-required, unavailable-only, low-stock, and normal saved items; verify the mobile action label/CTA changes correctly and never overlaps the bottom nav or item action buttons. |
| Wishlist empty, unauthenticated, and short landscape | SOURCE_FIXED / WISHLIST E2E PENDING | Verify empty wishlist and unauthenticated redirect states do not inherit the fixed mobile action spacing; at `740x360`, verify the action is in-flow/static rather than covering the viewport. |

## 2026-06-08 16:11 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3442 Stock Alerts mobile action bar bottom-nav collision.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/StockAlerts.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `StockAlerts.test.ts` guards the `stock-alerts-page` route class, bottom-nav offset variable, matching page padding, fixed mobile action bottom offset, Android WebView z-index, and short-landscape static fallback.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Stock Alerts ready-items action | SOURCE_FIXED / STOCK ALERTS E2E PENDING | Preload `shop-stock-alerts` with direct-add ready products and open `/stock-alerts` at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; verify `Add ready items` sits above the global bottom nav, remains readable/tappable, and the nav is still readable/tappable below it. |
| Stock Alerts options and waiting states | SOURCE_FIXED / STOCK ALERTS E2E PENDING | Recheck mixed option-required, waiting-only, and sold-out alert data; verify the mobile action label changes correctly and never overlaps the bottom nav or item action buttons. |
| Stock Alerts short landscape and empty state | SOURCE_FIXED / STOCK ALERTS E2E PENDING | At `740x360` and similar short landscape heights, verify the mobile action is in-flow/static rather than covering the viewport; with no alerts, verify no empty fixed action surface appears and bottom nav spacing remains normal. |

## 2026-06-08 15:58 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3415 Product List quick-add option modal rail layering.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ProductList.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router act/deprecation warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ProductList.test.tsx` guards the `product-list--quickAddOpen` state, quick-add modal root class, mobile conversion rail suppression, quick-add mask/wrap z-index contract, and body-mounted Select popup z-index.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product-list option-required quick add | SOURCE_FIXED / PRODUCT LIST E2E PENDING | Open `/products?q=feeder&sort=quick-add-desc`, trigger an option-required product-card `Choose` quick-add at `320x568`, `360x740`, `390x844`, `430x932`, and `768x1024`; verify the background conversion bar and bottom nav are fully dimmed/obscured by the mask and no second `Add to cart` rail appears under the modal. |
| Quick-add Select popup layering | SOURCE_FIXED / PRODUCT LIST E2E PENDING | With the option-required quick-add modal open, open Size/Color Select dropdowns at the same mobile widths; verify dropdown options render above the modal content/mask, remain tappable, and do not fall behind the bottom nav or conversion rail. |
| No-option quick add regression | SOURCE_FIXED / PRODUCT LIST E2E PENDING | Open a no-option quick-add modal and verify the same blocking modal layering while preserving the direct add-to-cart path, close/native-back behavior, and no regressions to quick preview (F2754) or filter drawer (F2755). |

## 2026-06-08 15:42 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3414 Product Detail size-guide modal short-landscape clipping.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ProductDetailSizeGuide.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ProductDetailSizeGuide.test.ts` guards the modal class, short-height media query, non-sticky footer, scrollable body, two-column guide grid, and full-width Back-length card.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product size guide short landscape | SOURCE_FIXED / PRODUCT DETAIL E2E PENDING | Open `/products/1`, click `Size guide`, and verify at `740x360` and `844x390` that Neck, Chest, Back length, close, and `Got it` are all visible or clearly scrollable without footer overlap. |
| Product size guide portrait/tablet regression | SOURCE_FIXED / PRODUCT DETAIL E2E PENDING | Recheck `320x568`, `360x740`, `390x844`, and `768x1024`; verify the modal remains readable, centered, and does not obscure or conflict with the product buy bar behind the mask. |
| Size guide entry points | SOURCE_FIXED / PRODUCT DETAIL E2E OPTIONAL | Open the guide from both the option header and the size-calculator disclosure; verify both paths share the fixed modal layout and close cleanly with native back/escape/`Got it`. |

## 2026-06-08 15:21 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3413 Register empty-submit validation scroll.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Register.test.tsx --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Register.test.tsx` guards the failed-submit handler, first-error selector, 176px mobile chrome offset, `preventScroll` focus, and mobile `scroll-padding`/`scroll-margin` CSS.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Register empty-submit on narrow phones | SOURCE_FIXED / REGISTER E2E PENDING | Open `/register` unauthenticated at `320x568`, submit the empty form, and verify the first invalid username/login field, password field, and their error messages land visibly below the sticky storefront header instead of above the viewport. |
| Register validation at common mobile widths | SOURCE_FIXED / REGISTER E2E PENDING | Repeat empty-submit at `360x740` and `390x844`; verify the first invalid field remains visible and the form does not over-scroll or hide lower fields. |
| Partial invalid register and short landscape | SOURCE_FIXED / REGISTER E2E PENDING | Submit partially filled invalid register forms plus empty-submit at `740x360`; verify focus/scroll still moves to the first invalid field, the submit button remains reachable, and the fix does not recreate broader landscape header overlap. |

## 2026-06-08 15:12 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3411/F3412 checkout mobile payment rail.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router/Ant Design warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Checkout.test.tsx` guards the narrow-phone one-column full-width pay CTA and the Android WebView checkout-flow pay-bar bottom rule without `--shop-mobile-bottom-nav-height`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Browser checkout mobile pay bar | SOURCE_FIXED / CHECKOUT E2E PENDING | Load guest and signed-in `/checkout` with selected items at `320x568`, `360x740`, `390x844`, `430x932`, and `560px`; verify the payable amount and full `Create order and pay ...` CTA are readable, the CTA wraps without clipping, and the fixed rail does not cover the final review content. |
| Long labels, currencies, and translations | SOURCE_FIXED / I18N CHECKOUT E2E PENDING | Recheck English, Spanish, and Chinese checkout with longer payable amounts and unavailable/selected payment states; verify the fixed mobile pay CTA stays full width/readable and the hidden main submit action is not the only usable submit path. |
| Android WebView checkout rail placement | SOURCE_FIXED / ANDROID WEBVIEW E2E PENDING | In the Capacitor Android WebView shell, open `/checkout` at `320x568`, `360x740`, and `390x844` with no payment selected and with a selected payment method; verify the bottom nav remains hidden and `.checkout-page__mobilePayBar` is pinned to the safe-area/floating-action bottom instead of floating above hidden nav space. |

## 2026-06-08 15:03 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for TEST UI F3410 product-comparison decision metrics rail.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ProductCompare.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `ProductCompare.css` keeps mobile decision metrics in a two-by-two grid and excludes `.product-compare__decisionGrid` from hidden-scrollbar, mask, pan-x, horizontal-overflow, fixed flex-basis, and scroll-snap rail behavior.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Compare decision metrics on phones | SOURCE_FIXED / COMPARE E2E PENDING | Load `/compare` with `shop-product-compare=[1,2,3]` at `320x568`, `360x740`, `390x844`, and `430x932`; verify `Ready to buy`, `Best value`, `Top rated`, and `Low stock` are all visible in the decision helper without horizontal panning, clipping, hidden scrollbar affordance, or bottom-nav overlap. |
| Compare tablet/desktop regression | SOURCE_FIXED / COMPARE E2E PENDING | Recheck `768x1024` and `1024x768`; verify all four metrics remain visible, the decision helper card stays aligned with the recommendation/table content, and unrelated compare rails/table horizontal scrolling still work. |
| Android WebView compare shell | SOURCE_FIXED / ANDROID WEBVIEW E2E OPTIONAL | In the Capacitor/Android WebView shell, open loaded compare at `320x568`, `360x740`, and `390x844`; verify the metrics are readable by default and do not regress the existing compare page bottom-nav spacing. |

## 2026-06-08 14:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3405-F3409.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/utils/cartTimerCleanup.test.ts src/utils/apiError.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Backend targeted Maven: `./mvnw -q -Dtest=OrderInputNormalizationServiceTest,OrderMapperSlaConsistencyTest test` ✅
- Unit/source coverage: Cart/CartDrawer async mutation guards, no debounced quantity catch rethrow, no Cart fetch `language`/`t` dependency, `apiError.ts` fallback-free language lookup, escaped guest order email LIKE mapper contract.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart async mutation unmount | SOURCE_FIXED / CART E2E PENDING | In authenticated Cart and CartDrawer, start save-for-later, move saved item(s), remove selected items, clear blocked/unavailable items, and navigate away before delayed APIs resolve; verify no stale toast, unmounted-state warning, or late cart UI update appears. |
| Debounced quantity failure | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Force debounced quantity update failure, verify the cart shows one localized quantity error/reload path and no unhandled promise rejection; verify checkout-flush failures still block navigation and show the checkout sync warning. |
| Cart language toggle | SOURCE_FIXED / I18N E2E PENDING | Load authenticated and guest carts, switch English/Spanish/Chinese, and verify visible labels localize without refetching cart contents or flickering the cart loading state. |
| Guest order tracking wildcard email | SOURCE_FIXED / ORDER SECURITY E2E PENDING | Track guest/legacy guest orders using emails containing `_`, `%`, `!`, and backslash characters; verify only exact order-email matches succeed and wildcard-like input cannot match another order. |
| API error localization | SOURCE_FIXED / I18N E2E OPTIONAL | Trigger network, timeout, 429, and English server-message errors in non-English storefront/admin flows; verify localized fallbacks still render correctly. |

## 2026-06-08 14:38 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for QA code-review F3411-F3416 stale-path reports.

Local verification already run:
- Static source check: `frontend/src/pages/UserProfile.tsx`, `PaySuccess.tsx`, `PetDetail.tsx`, and `AppInitializer.tsx` are absent.
- Static source check: `performUpdate`, `enhancedSubmit`, `countdownInterval`, `catch(() => {})`, `document.cookie`, `X-CSRF`, and `XSRF` are absent from current frontend/API source.
- Static source check: current `Profile.tsx` profile/address/pet/password handlers show localized `message.error(...)` failures; Checkout/Profile/OrderTracking payment-return intervals clear on effect cleanup; anonymous cart persistence uses `localStorage` key `shop-guest-cart`; backend `SecurityConfig` is stateless JWT with CSRF disabled by design.
- No production source code changed for this stale-report batch.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile edit/profile utilities | CURRENT_SOURCE_NON_ISSUE / PROFILE E2E OPTIONAL | Exercise profile email/phone update, wrong email code, password change failure, address save failure, and pet save failure; verify the user sees localized errors and no success is shown for failed API responses. |
| Payment return/polling navigation | CURRENT_SOURCE_COVERED / PAYMENT E2E OPTIONAL | Start checkout/Profile/track-order payment polling or payment-return refresh, navigate away before the next interval, and verify no late UI update, duplicate poll, or unmounted-state warning appears. |
| Guest cart cross-tab state | CURRENT_SOURCE_COVERED / CART E2E OPTIONAL | Add anonymous cart items in one tab, open another tab, update/remove guest cart lines, and verify `shop-guest-cart` storage events keep cart counts and selected checkout rows in sync. |
| CSRF cookie parser stale report | CURRENT_SOURCE_NON_ISSUE / SECURITY E2E OPTIONAL | Keep normal JWT/API auth smoke coverage; no frontend CSRF cookie parsing path exists in current source. |

## 2026-06-08 14:34 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for QA F3410 `OrderHistory.tsx` mutable `isCancelled` report.

Local verification already run:
- Static source check: `frontend/src/pages/OrderHistory.tsx` is absent.
- Static source check: current `Profile.tsx` order history uses `ordersRequestSeqRef`, increments it on unmount, and checks `mountedRef.current` plus the captured request sequence before order-list, order-item-preview, or failure-message updates.
- No source or test code changed for this stale report.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Profile order history rapid navigation | CURRENT_SOURCE_NON_ISSUE / PROFILE E2E OPTIONAL | On `/profile?tab=orders`, trigger slow order and order-item preview APIs, navigate away before completion, and verify no stale order UI update or unmounted-state warning appears. |
| Profile payment-return order refresh | CURRENT_SOURCE_COVERED / PAYMENT RETURN E2E OPTIONAL | Return from a successful payment while order refreshes overlap and verify the latest Profile order state remains authoritative. |

## 2026-06-08 14:28 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3441 Checkout Jest parser failure.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/Checkout.test.tsx --watchAll=false --runInBand` ✅ (8/8, with existing React/Router/Ant Design warning noise)
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `Checkout.test.tsx` guards that no optional-parameter markers remain in the test file.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Checkout Jest parser gate | SOURCE_FIXED / TEST PIPELINE REGRESSION PENDING | Rerun the normal frontend Jest pipeline that previously failed on `Checkout.test.tsx` and verify the suite parses and executes instead of failing during Babel transform. |
| Frontend production type/build gate | SOURCE_FIXED / BUILD REGRESSION PENDING | Rerun the non-root frontend build/type gate and verify no TypeScript/Babel parser errors are emitted from `Checkout.test.tsx` or its mock factories. |
| Checkout smoke after parser fix | SOURCE_FIXED / CHECKOUT E2E OPTIONAL | Run a basic checkout smoke with payment channels available/unavailable and coupon quote failure; verify no user-facing checkout behavior changed from the test-only syntax adjustment. |

## 2026-06-08 14:25 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3440 API interceptor SPA login redirect on unrecoverable 401.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `api/index.test.ts` verifies failed refresh clears auth/client state, updates `/login?redirect=...` via SPA history, dispatches `popstate` and `shop:auth-redirect`, and does not use `window.location.href`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Storefront expired session redirect | SOURCE_FIXED / AUTH E2E PENDING | From product/cart/profile pages with an expired token and failed refresh, trigger a protected API call and verify navigation to login happens without a full document reload while preserving the original route in `redirect`. |
| Admin expired session redirect | SOURCE_FIXED / ADMIN AUTH E2E PENDING | From an admin route with an expired token and failed refresh, verify the app transitions to login without white flash/reload and does not leave stale admin chrome or permissions visible. |
| Checkout/session recovery after login | SOURCE_FIXED / CHECKOUT AUTH E2E PENDING | Trigger an unrecoverable 401 during checkout or coupon/cart API use, log in from the SPA login page, and verify the post-login redirect returns to the original checkout/cart route with expected client state cleanup. |

## 2026-06-08 14:22 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3439 `useAuth` profile race protection.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/hooks/useAuth.test.tsx --watchAll=false --runInBand` ✅ with existing ReactDOMTestUtils act deprecation warning
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit coverage: `useAuth.test.tsx` verifies profile hydration after unmount is ignored, failed refresh clears auth state while mounted, storage-cleared events drop the user, and stale profile responses cannot overwrite a newer auth refresh.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Auth profile refresh ordering | SOURCE_FIXED / AUTH E2E PENDING | Simulate two overlapping `/users/profile` responses during login/session refresh and verify the later auth session remains authoritative in navbar, profile, admin routing, and local storage. |
| Cross-tab auth storage changes | SOURCE_FIXED / MULTI-TAB E2E PENDING | Log out or clear auth storage in a second tab and verify the first tab drops user state without stale user badge, profile data, or admin access flash. |
| Startup token validation | SOURCE_FIXED / STARTUP E2E PENDING | Cold-start with valid, expired, revoked, and tampered stored tokens; verify only valid tokens hydrate user state and invalid tokens clear session state without stale authenticated UI. |

## 2026-06-08 14:20 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3438 CustomerSupportWidget WebSocket reconnect timer cleanup.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/components/CustomerSupportWidget.test.tsx --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Unit/source coverage: `CustomerSupportWidget.test.tsx` guards capped reconnect backoff, reconnect timeout cleanup, cleanup-side `shouldReconnect = false`, socket close/nulling, and absence of `setTimeout(connect, 2500)`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer support WebSocket outage | SOURCE_FIXED / SUPPORT WIDGET E2E PENDING | Open the signed-in customer support widget, force the support WebSocket endpoint to fail, and verify reconnect attempts back off/cap, show the connection-failure warning once after exhaustion, and do not create repeated timers or console errors. |
| Support widget unmount during reconnect | SOURCE_FIXED / TIMER CLEANUP E2E PENDING | Open the widget, trigger a reconnect delay, then navigate away/close the app shell before the timer fires; verify no late reconnect, state update after unmount, unhandled rejection, or extra WebSocket appears. |
| WebSocket recovery after outage | SOURCE_FIXED / SUPPORT RECOVERY E2E PENDING | Restore the support WebSocket endpoint before retry exhaustion and verify the widget reconnects, resets attempt state, receives messages, and still falls back to polling without duplicate message rows. |

## 2026-06-08 14:17 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / TARGETED_REFACTOR for QA F3436/F3437 oversized frontend files.

Local verification already run:
- Frontend combined targeted Jest: `npm test -- --runTestsByPath src/api/index.test.ts src/pages/ProductDetail.test.tsx src/utils/cartTimerCleanup.test.ts src/pages/SupportManagement.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router/Ant Design warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Scoped diff hygiene: `git diff --check -- ...` ✅
- Line counts after extraction: `api/index.ts` 2817 lines, `api/cache.ts` 75 lines, `ProductDetail.tsx` 2295 lines, `productDetailHelpers.tsx` 183 lines.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| API client cache behavior after helper extraction | SOURCE_FIXED / API CLIENT E2E PENDING | Browse product detail, personalized recommendations, admin order detail/list, order tracking, and repeated request-dedupe flows; verify cached responses, TTL refresh, auth-session boundaries, and pending-request cleanup still behave as before. |
| ProductDetail render and recommendations | SOURCE_FIXED / PRODUCT UI E2E PENDING | Visit ProductDetail for normal, out-of-stock, optioned, and recommendation-heavy products; verify recommendation ranking/cache behavior, add-to-cart/buy-now readiness, trust icons, and localized labels are unchanged. |
| ProductDetail gallery fallback/touch/zoom | SOURCE_FIXED / MOBILE PRODUCT E2E PENDING | On desktop and mobile/WebView, exercise image fallback, thumbnail selection, keyboard navigation, pinch zoom, drag/swipe, modal preview, and touch resume behavior; verify no blank images, stale transform origin, or console errors. |

## 2026-06-08 14:10 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / REGRESSION_GUARD_ADDED for QA F3434/F3435 frontend timer cleanup.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/utils/cartTimerCleanup.test.ts --watchAll=false --runInBand` ✅
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/SupportManagement.test.tsx --watchAll=false --runInBand` ✅ with existing React/Ant Design act/portal warning noise
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Known residual test harness issue: full `CartCheckoutFlow.test.tsx` still times out after 5 seconds on `shows product-specific quantity controls...`; the new timer cleanup guard passes independently.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart quantity debounce then navigate away | SOURCE_FIXED / CART UI E2E PENDING | In Cart and CartDrawer, edit authenticated item quantities and navigate away/close drawer before debounce fires; verify no late toast, unhandled rejection, stale spinner, or console unmounted-state warning appears. |
| Cart quantity debounce failure recovery | SOURCE_FIXED / CART UI E2E PENDING | Force authenticated quantity update failure after debounce in Cart and CartDrawer; verify the visible error/reload path occurs once and no unhandled promise rejection is logged. |
| Admin support polling cleanup | SOURCE_FIXED / SUPPORT ADMIN E2E PENDING | Open admin SupportManagement with delayed session/message APIs, navigate away while a poll is in flight, and verify no stale session/message update, duplicate poll, or console unmounted-state warning occurs. |

## 2026-06-08 14:00 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3432/F3433 frontend cache expiration and bounds.

Local verification already run:
- Frontend targeted Jest: `npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand` ✅
- Frontend targeted Jest: `npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` ✅ with existing React/Router/Suspense warning noise
- Unit/source coverage: `api/index.test.ts` guards TTL/capped API caches and pending-request cleanup; `ProductDetail.test.tsx` guards ProductDetail recommendation cache expiry and LRU eviction behavior.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Long SPA API browsing session | SOURCE_FIXED / API CLIENT E2E PENDING | Navigate across product detail, recommendation, order tracking, reviews, questions, notifications, pet profile, and gallery flows with many unique keys; verify repeated API cache entries expire and browser heap does not grow linearly. |
| ProductDetail recommendation refresh | SOURCE_FIXED / PRODUCT UI E2E PENDING | Visit a product detail page, revisit within two minutes to verify fast cached recommendations, then advance/wait past the TTL and verify recommendations refresh from the API instead of staying session-stale. |
| Auth-session cache boundary | SOURCE_FIXED / AUTH PRODUCT E2E PENDING | Switch users or log out/in during a product-detail session and verify ProductDetail recommendations and user-scoped API cache responses are not reused across auth sessions. |

## 2026-06-08 13:54 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / TARGETED_SCOPE for QA F3431 read-only transaction boundaries on order reads.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderInputNormalizationServiceTest,OrderControllerCustomerPaginationTest,OrderControllerGuestAfterSaleAccessTest test` ✅
- Unit/source coverage: `OrderInputNormalizationServiceTest.customerAndAdminOrderReadEntryPointsAreReadOnlyTransactions` reflects over the pure order read entrypoints and verifies `@Transactional(readOnly = true)`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin order dashboard/list reads | SOURCE_FIXED / ADMIN E2E PENDING | Exercise admin dashboard stats, order search, counts, and summaries under normal traffic and verify response contracts remain unchanged. |
| Customer and guest order reads | SOURCE_FIXED / ORDER E2E PENDING | Exercise customer order pagination plus guest order tracking/items with correct and incorrect credentials; verify no write-side effects occur during read-only requests. |
| Payment reads with provider sync | DOCUMENTED INTENTIONAL WRITE TX / PAYMENT E2E OPTIONAL | Keep existing payment latest/sync behavior under observation; provider-sync and expiry-capable reads intentionally remain write transactions. |

## 2026-06-08 13:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED / REGRESSION_GUARD_ADDED for QA F3430 SecurityConfig guest access.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=SecurityConfigCorsTest,PaymentControllerSimulationAccessTest,OrderControllerGuestAfterSaleAccessTest,UserControllerAdminBootstrapTest test` ✅
- Source guard: `SecurityConfigCorsTest.anonymousAccessRulesStayNarrowAndControllerGated` verifies no broad anonymous `/orders/**`, `/users/**`, or `/payments/**` route rules and verifies public guest/payment/bootstrap routes remain controller-gated.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Anonymous registered-account resources | CURRENT_SOURCE_COVERED / SECURITY E2E PENDING | Without a token, call registered order, profile, reviewable-order, admin, and non-public mutation endpoints and verify 401/403 responses. |
| Guest order and payment credentials | CURRENT_SOURCE_COVERED / GUEST E2E PENDING | For guest routes that are intentionally public, verify correct order number + email succeeds, while mismatched email/order number fails and records the expected failure handling. |
| Admin bootstrap exposure | CURRENT_SOURCE_COVERED / BOOTSTRAP E2E PENDING | Verify `/users/create-admin` fails when `admin.bootstrap-token` is blank, fails with an invalid token, and cannot create another admin after bootstrap is completed. |

## 2026-06-08 13:49 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for QA F3429 JwtService JJWT API migration.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=JwtServiceTest test` ✅
- Backend adjacent auth slice: `./mvnw -q -Dtest=JwtServiceTest,LoginControllerPasswordLoginTest,LoginControllerRefreshTest,LoginControllerLogoutTest test` ✅
- Unit/source coverage: `JwtServiceTest` signs/parses tokens with the new JJWT 0.13 APIs and guards against old `SignatureAlgorithm`, `setSigningKey(...)`, `parseClaimsJws(...)`, and monolithic `jjwt` dependency usage.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Password login token issuance | SOURCE_FIXED / AUTH E2E PENDING | Login with a normal user and admin account, verify access tokens authenticate protected API calls, and confirm token payload still exposes expected username/userId/email claims where clients rely on them. |
| Refresh and logout lifecycle | SOURCE_FIXED / AUTH E2E PENDING | Refresh a valid token, use the refreshed token successfully, then logout and verify the logged-out access token is rejected according to the existing blacklist/expiry behavior. |
| Password-change invalidation | SOURCE_FIXED / AUTH E2E PENDING | Change a user's password and verify tokens issued before the change no longer authorize API/WebSocket flows, while a new login token succeeds. |

## 2026-06-08 13:44 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for QA F3428 checkout order-number collision handling.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderInputNormalizationServiceTest,OrderStockReservationServiceTest test` ✅
- Unit coverage: `OrderInputNormalizationServiceTest` verifies checkout order insert retries after an `orders.order_no` unique collision and does not retry unrelated integrity failures.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Concurrent registered checkout | SOURCE_FIXED / CHECKOUT E2E PENDING | Run a high-concurrency registered checkout burst and verify each successful order receives a unique `SO...` order number, no customer-visible checkout fails with duplicate order-number errors, and cart cleanup remains correct. |
| Concurrent guest checkout | SOURCE_FIXED / CHECKOUT E2E PENDING | Run a high-concurrency guest checkout burst with the same guest email/product and verify order numbers are unique, guest tracking by order number/email works, and stock decrements once per order. |
| Database collision injection | SOURCE_FIXED / FAULT-INJECTION E2E OPTIONAL | In a controlled environment, force the first order insert to hit `uk_orders_order_no` and verify the checkout retry succeeds while unrelated FK/validation database failures still surface as errors. |

## 2026-06-08 13:38 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for QA F3427 RateLimitService Redis `KEYS` reset.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=RateLimitServiceTest test` ✅
- Unit coverage: `RateLimitServiceTest.clearRedisBucketsUsesScanAndDeleteInsteadOfKeys` executes the Redis callback with a mocked scan cursor, verifies discovered keys are deleted, and verifies `StringRedisTemplate.keys(...)` is never called.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Traffic-control rate-limit reset on large Redis keyspace | SOURCE_FIXED / REDIS E2E PENDING | Seed many `shop:rate-limit:*` keys plus unrelated Redis keys, trigger the admin/reset flow that calls `RateLimitService.clear()`, and verify only matching rate-limit keys are removed while unrelated keys remain. |
| Redis command behavior during reset | SOURCE_FIXED / OBSERVABILITY E2E PENDING | Capture Redis `MONITOR`, slowlog, or provider command metrics during reset and verify `SCAN`/bounded `DEL` calls are used with no `KEYS` command. |
| Tuned scan count | SOURCE_FIXED / CONFIG E2E OPTIONAL | Run reset with a small non-production `TRAFFIC_RATE_LIMIT_REDIS_CLEAR_SCAN_COUNT` and verify the operation still completes without request timeout or Redis command spikes. |

## 2026-06-08 13:29 UTC Maintainer Cycle Triage Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED for QA F3426 OrderService stock-reservation rollback report.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderInputNormalizationServiceTest,OrderStockReservationServiceTest test` ✅
- Static source inspection: direct `createOrder(Order)` is disabled; registered and guest checkout reserve stock within public `@Transactional` checkout entrypoints.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Direct order create path | CURRENT_SOURCE_COVERED / API E2E OPTIONAL | Confirm any legacy/direct create-order endpoint remains rejected and cannot persist client-supplied order totals or stock changes. |
| Checkout failure after stock reservation | SOURCE_FIXED / CHECKOUT E2E PENDING | Force a registered and guest checkout failure after stock reservation, such as order-item insert failure in a controlled test environment, and verify product/variant stock rolls back with the transaction. |
| Successful checkout stock reservation | SOURCE_FIXED / CHECKOUT E2E PENDING | Place registered and guest checkout orders and verify stock decrements exactly once, cart cleanup still happens for registered checkout, and order items keep correct product/variant snapshots. |

## 2026-06-08 13:24 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for QA F3425 PaymentService simulation `RestTemplate` reuse report.

Local verification already run:
- Static source inspection: `simulatePaid(...)` and `simulateCallback(...)` do not use `RestTemplate`; they route through local signed callback handling.
- Backend adjacent slice: `./mvnw -q -Dtest=PaymentFlowServiceTest,AdminControllerProductImportAuditTest,AdminControllerOrderBatchShipTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment simulation smoke | CURRENT_SOURCE_NON_ISSUE / PAYMENT E2E OPTIONAL | Keep normal admin-gated simulate-paid/simulate-callback smoke coverage; no RestTemplate concurrency path exists in current simulation code. |
| Generic gateway payment create | CURRENT_SOURCE_COVERED / PAYMENT E2E PENDING | Exercise a configured generic API payment channel under concurrent checkout attempts and verify idempotency keys, timeout behavior, and circuit-breaker behavior remain stable. |

## 2026-06-08 13:20 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED for QA F3424 silent exception swallowing in payment/import/admin-order paths.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` ✅
- Backend adjacent slice: `./mvnw -q -Dtest=PaymentFlowServiceTest,AdminControllerProductImportAuditTest,AdminControllerOrderBatchShipTest test` ✅
- Unit coverage: `PaymentFlowServiceTest` captures logs for payment expiry row failures and order-state races.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment expiry row failure | SOURCE_FIXED / OBSERVABILITY E2E PENDING | Force one expired pending payment row to fail during expiry while another row succeeds; verify the scheduler continues and logs paymentId/orderId/orderNo plus stack context for the failed row. |
| Payment expiry order-state race | SOURCE_FIXED / OBSERVABILITY E2E PENDING | Move an order out of pending-payment state while payment expiry is processing; verify the payment remains unexpired as before and logs the skipped order-cancellation reason. |
| Product import/admin order observability | CURRENT_SOURCE_COVERED / ADMIN E2E PENDING | Run failing product URL/CSV import and partial admin batch-ship scenarios; verify audit history/per-row failure details are visible and no failure disappears without trace. |

## 2026-06-08 13:14 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for QA F3423 email-code send endpoint servlet-thread blocking.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=LoginControllerPasswordLoginTest,EmailLoginServiceTest test` ✅
- Backend adjacent slice: `./mvnw -q -Dtest=LoginControllerPasswordLoginTest,EmailLoginServiceTest,AuthControllerForgotPasswordTest,UserControllerUpdateProfileTest test` ✅
- Unit coverage: `LoginControllerPasswordLoginTest` verifies `/auth/email-code` defers `EmailLoginService.sendLoginCode(...)` until the MVC async `Callable` executes and `/auth/password-reset-code` preserves rate-limit response mapping.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Login email-code async request | SOURCE_FIXED / API E2E PENDING | Call `/auth/email-code` for a normal account and an unknown account under delayed SMTP/padding conditions; verify the response body/status contract stays unchanged and servlet request threads are not held for the padding duration. |
| Password-reset email-code async request | SOURCE_FIXED / API E2E PENDING | Call `/auth/password-reset-code` under rate-limit and unknown-account conditions; verify `RATE_LIMITED`/retry-after and generic success/failure responses remain unchanged. |
| Async executor saturation smoke | SOURCE_FIXED / LOAD E2E PENDING | Send a controlled burst of email-code requests above normal traffic and verify the bounded `app.web.async.*` executor queues/rejects predictably without exhausting Tomcat request threads. |

## 2026-06-08 13:06 UTC Maintainer Cycle Triage Handoff

Source status: TRACKER_DUPLICATE_CLOSED / CURRENT_SOURCE_COVERED for TEST F3416 and TEST/QA F3418/F3425.

Local verification already run:
- Wishlist targeted Jest: `npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand` ✅
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Backend targeted Maven: `./mvnw -q -Dtest=CartServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist duplicate lifecycle report | SOURCE_FIXED / COVERED BY 13:02 HANDOFF | Reuse the 13:02 Wishlist slow-load/action navigation scenarios; verify no late toast, stale UI update, or unmounted-state warning occurs. |
| Cart monetary duplicate reports | SOURCE_FIXED / COVERED BY 07:04 HANDOFF | Reuse the 07:04 cart decimal subtotal, coupon threshold, and half-up rounding scenarios; verify displayed/API totals stay cent-rounded. |

## 2026-06-08 13:02 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for TEST/QA F3423 Wishlist async lifecycle guards.

Local verification already run:
- Targeted Wishlist Jest: `npm test -- --runTestsByPath src/pages/Wishlist.test.tsx --watchAll=false --runInBand` ✅ (existing React act / React Router warning noise only)
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Static source check: `frontend/src/pages/OrderHistory.tsx` is absent; current active scope is Wishlist.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Wishlist navigation during slow load | SOURCE_FIXED / WISHLIST UI E2E PENDING | Throttle wishlist API, navigate away before the request resolves/rejects, and verify no late error toast or unmounted-state warning occurs. |
| Wishlist remove/add-all/clear-unavailable during navigation | SOURCE_FIXED / WISHLIST UI E2E PENDING | Start each wishlist async action, navigate away before completion, and verify no stale wishlist UI state, duplicate toast, or console unmounted-state warning appears. |

## 2026-06-08 12:56 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for TEST/QA F3405 ShoppingGuide/Cart environment-storage inconsistency report.

Local verification already run:
- Static source check: `frontend/src/pages/ShoppingGuide.tsx` is absent.
- Static source check: `rg -n "process\\.env|window\\.localStorage|localStorage\\." frontend/src/pages/Cart.tsx` returned no matches.
- Source inspection: Cart uses `getLocalStorageItem` and `removeSessionStorageItem` from `../utils/safeStorage`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart storage behavior | CURRENT_SOURCE_NON_ISSUE / CART E2E OPTIONAL | Continue normal guest/auth cart smoke coverage, especially guest-cart storage events and checkout payment-method cleanup; no direct Cart localStorage path exists in current source. |

## 2026-06-08 12:54 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for TEST/QA F3404 Maven `javax.annotation.meta.When.MAYBE` warning report.

Local verification already run:
- Clean targeted Maven compile/test: `./mvnw -Dtest=GlobalApiExceptionHandlerTest clean test` ✅
- The clean compile rebuilt 273 main source files and 95 test source files without the reported `unknown enum constant javax.annotation.meta.When.MAYBE` warning. Remaining compiler note is an unrelated existing unchecked/unsafe operations note in `AdminControllerCouponPageTest`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Backend build warning audit | CURRENT_SOURCE_NON_ISSUE / BUILD E2E OPTIONAL | Run the normal backend CI Maven command and confirm the `javax.annotation.meta.When.MAYBE` warning does not return; track the separate unchecked test-source note only if QA wants a lint-clean build gate. |

## 2026-06-08 12:50 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for TEST/QA F3402 MUI duplicate keyframes build claim; SOURCE_FIXED / CURRENT_SOURCE_COVERED for TEST/QA F3403 `@adobe/css-tools` Jest setup failure.

Local verification already run:
- Non-root frontend production build: `runuser -u guhao -- npm run build` ✅ (`Compiled successfully`; existing Browserslist stale-data and bundle-size advisories only)
- Representative Jest: `npm test -- --runTestsByPath src/components/SearchBar.test.tsx --watchAll=false --runInBand` ✅ (existing React act deprecation warning only)
- Static source check: current `frontend/package.json` has no `@mui/*` dependencies, pins `@adobe/css-tools`, and has Jest transform exceptions for `@adobe/css-tools` / `@testing-library`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Frontend production build pipeline | CURRENT_SOURCE_NON_ISSUE / BUILD E2E PENDING | Run the normal CI/deploy frontend build and verify no MUI `Duplicate local keyframes are not supported: animation1` diagnostic returns. |
| Frontend Jest pipeline startup | SOURCE_FIXED / TEST PIPELINE E2E PENDING | Run the frontend Jest pipeline or a broad smoke subset and verify setup no longer fails in `@adobe/css-tools` before tests execute. |

## 2026-06-08 12:44 UTC Maintainer Cycle Triage Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for TEST/QA F3396 unused `EntityManager` / redundant `flush()` report.

Local verification already run:
- Static source search: `rg -n "EntityManager|entityManager|flush\\(" src/main/java/com/example/shop/service/OrderService.java src/test/java/com/example/shop/service` returned no matches.
- Source inspection: direct `OrderService.createOrder(Order)` rejects direct order creation; active checkout persistence uses insert/update flows.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order creation persistence sanity | CURRENT_SOURCE_NON_ISSUE / CHECKOUT E2E OPTIONAL | Continue normal registered and guest checkout smoke coverage to verify order creation still succeeds through the supported checkout flows; no direct `EntityManager`/flush regression path exists in current source. |

## 2026-06-08 12:42 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for TEST/QA F3401 request-id fallback in API error payloads and handler logs.

Local verification already run:
- Targeted backend Maven: `./mvnw -q -Dtest=GlobalApiExceptionHandlerTest test` ✅
- Test log observation: handled unexpected exceptions now log `requestId=unavailable` when no request correlation id is available.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| API error without request correlation | SOURCE_FIXED / API E2E PENDING | Trigger a controlled backend 500 path without `X-Request-Id`/correlation headers and verify the JSON payload includes non-empty `requestId` fallback `unavailable` and logs do not emit `requestId=` with an empty value. |
| API error with caller request id | SOURCE_FIXED / API E2E PENDING | Trigger a controlled 4xx/5xx path with a safe `X-Request-Id` header and verify the response payload/header/log context still preserve that caller id. |

## 2026-06-08 12:35 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for TEST F3389-F3392 accessibility fixes in Cart, ProductDetail, Checkout, and Coupon Center. WONTFIX / CURRENT_SOURCE_NON_ISSUE for stale TEST/QA F3400 coupon hero external image claim.

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted ProductDetail Jest: `npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/Suspense warning noise only)
- Targeted Cart/Checkout Jest: `npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/fake-timer warning noise only)
- Static source check: Cart header checkbox has explicit `aria-label`; ProductDetail desktop thumbnail images no longer carry button role in the carousel block; Checkout address radios receive structured labels; Coupon Center claim/wallet filter containers both have `role="group"`.
- F3400 static source check: `frontend/src/pages/Coupons.tsx` is absent; current `CouponCenter.tsx` hero uses structured content and `CouponCenter.css` gradients, with no match for the reported `photo-1607082349566-187342175e2f` URL or remote coupon hero image usage.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart table selection accessibility | SOURCE_FIXED / CART UI E2E PENDING | Open an authenticated cart with purchasable and unavailable items, inspect the table header checkbox with browser accessibility tooling, and verify it is announced as `Select all` while item checkboxes keep product-specific labels. |
| ProductDetail desktop gallery thumbnails | SOURCE_FIXED / PRODUCT UI E2E PENDING | On desktop/tablet ProductDetail with multiple images, tab through thumbnail controls and verify they are native buttons, arrow-key gallery navigation still works, active state is visible, and thumbnail image fallback still renders. |
| Checkout saved-address radio labels | SOURCE_FIXED / CHECKOUT UI E2E PENDING | In authenticated checkout with default and non-default saved addresses, verify each radio announces recipient, phone, address, and default marker where applicable; also verify `Use new address` remains selectable. |
| Coupon Center filter grouping | SOURCE_FIXED / COUPON UI E2E PENDING | Open Coupon Center claim and wallet sections and confirm filter buttons are exposed as named groups in the accessibility tree while filtering behavior remains unchanged. |
| Coupon hero external image claim | CURRENT_SOURCE_NON_ISSUE / COUPON UI E2E OPTIONAL | Load Coupon Center with network image requests blocked and verify the hero still renders without broken image placeholders or third-party coupon hero requests. |

## 2026-06-08 12:24 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for ProductDetail bounded recommendation cache (TEST F3388/F3399) and WONTFIX / CURRENT_SOURCE_NON_ISSUE for stale backend cache claim (TEST F3429). Duplicate tracker correction also closed TEST F3397 under the earlier product-options current-source non-issue handoff and TEST F3398 under the mobile update test-drift handoff.

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted ProductDetail Jest: `npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/Suspense warning noise only)
- Backend source inspection: `ProductServiceImpl` uses bounded TTL `productSearchCache` for recommendation/search paths; no `productRecommendationsCache` or `categoryRecommendationsCache` exists in current source.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Long product-detail browsing session | SOURCE_FIXED / PRODUCT UI E2E PENDING | Browse more than 50 unique product detail pages in one SPA session and verify recommendation widgets still load while browser heap does not grow linearly from cached recommendation entries. |
| Recommendation cache hit behavior | SOURCE_FIXED / PRODUCT UI E2E PENDING | Revisit a recently viewed product detail within the cache TTL and verify recommendations render quickly without forcing a stale item to be evicted before older entries. |
| Backend recommendation cache sanity | CURRENT_SOURCE_NON_ISSUE / API E2E OPTIONAL | Exercise related/personalized/add-on/finder recommendation endpoints with diverse keys and verify backend memory/cache metrics remain bounded by the shared search cache configuration. |

## 2026-06-08 12:16 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for non-root frontend production build ownership blocker (TEST F3443).

Local verification already run:
- Ownership repair: `frontend/public/assets`, `frontend/public/downloads`, and regenerated `frontend/build` are owned by `guhao:guhao`.
- Root-owned generated file check: `find frontend/build frontend/public/assets -maxdepth 3 \( -user root -o -group root \)` returned no files.
- Non-root production build: `runuser -u guhao -- npm run build` ✅ (compiled successfully; existing Browserslist-staleness and bundle-size advisories only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Non-root frontend build | SOURCE_FIXED / BUILD E2E PENDING | Run the CI/deploy frontend build as the non-root app user and verify cleanup of `frontend/build/assets` and `frontend/build/downloads` succeeds. |
| Generated mobile artifacts | SOURCE_FIXED / MOBILE ARTIFACT E2E PENDING | Verify the generated `public/downloads/mobile-version.json`, versioned APK, and copied `build/downloads` artifacts are owned by the deploy user and match the active release metadata. |
| Static build serving | SOURCE_FIXED / DEPLOY E2E PENDING | Serve the regenerated `frontend/build` output and smoke the storefront/admin shell plus static placeholder assets. |

## 2026-06-08 12:05 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED for frontend API test TypeScript timer mock blocker (TEST F3442).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted API Jest: `npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false --runInBand` ✅ (65 tests passed)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Frontend type gate | SOURCE_FIXED / BUILD PIPELINE E2E PENDING | Run the normal frontend type-check/build pipeline and verify no TS2345 setTimeout mock signature diagnostic returns. |
| Auth refresh retry behavior | SOURCE_FIXED / API CLIENT E2E PENDING | Simulate one transient refresh-token network failure followed by success and verify the original request is retried once with refreshed auth. |
| Auth refresh rejection cleanup | SOURCE_FIXED / API CLIENT E2E PENDING | Simulate rejected refresh and verify auth storage is cleared and the app routes/handles expiry as expected. |

## 2026-06-08 12:03 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED / CURRENT_SOURCE_COVERED for mobile update generated-version test drift (TEST F3428).

Local verification already run:
- Targeted mobile update Jest: `npm test -- --runTestsByPath src/utils/mobileUpdate.test.ts --watchAll=false --runInBand` ✅
- Static source check: fallback assertions use `currentMobileRelease.versionCode` and `currentMobileRelease.versionName`; current generated release is `10083` / `1.0.83`.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Generated Android manifest smoke | SOURCE_FIXED / MOBILE E2E PENDING | Load the current mobile version manifest and verify the generated `versionCode`/`versionName` match the deployed Android artifact metadata. |
| Runtime config override | SOURCE_FIXED / MOBILE E2E PENDING | In a controlled native-shell/runtime-config build, set mobile current version metadata and verify update comparisons use the runtime override. |
| Invalid runtime metadata fallback | SOURCE_FIXED / MOBILE E2E PENDING | Provide blank/invalid runtime mobile metadata and verify the app falls back to the generated current release without hardcoded version assumptions. |

## 2026-06-08 12:01 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for ProductDetail product-options localStorage TTL claim (TEST F3427).

Local verification already run:
- Static source inspection: `productOptions.ts` derives options from product payload fields and does not read/write storage.
- Static search: `rg -n "product-options|setLocalStorageItem\\(.*option|getLocalStorageItem\\(.*option" frontend/src` found no persistent product-options cache.
- Current product API caches are in-memory with `expiresAt`, 30-second product detail/list TTLs, and bounded map eviction.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin option edit to storefront detail | CURRENT_SOURCE_NON_ISSUE / PRODUCT UI E2E PENDING | Edit a product option group/variant in admin, open the storefront product detail after normal API cache expiry or cache bypass, and verify the new options render without clearing browser localStorage. |
| Removed option not selectable | CURRENT_SOURCE_NON_ISSUE / PRODUCT UI E2E PENDING | Remove or rename an option value in admin, revisit product detail, and verify the stale removed value is not offered after the product payload refreshes. |
| Product list option quick-select | CURRENT_SOURCE_NON_ISSUE / PRODUCT UI E2E PENDING | If product-list quick option controls are enabled, verify they derive from the refreshed product payload and do not reuse a stale localStorage option set. |

## 2026-06-08 11:55 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / CURRENT_SOURCE_NON_ISSUE for Checkout guest draft hydration race claim (TEST F9337).

Local verification already run:
- Source inspection: `Checkout.tsx` initializes `initialCheckoutDraftRef`, `checkoutFormSnapshot`, and `checkoutFormSnapshotRef` synchronously from `readCheckoutGuestDraftFields()` before form render, then rehydrates from `CHECKOUT_GUEST_DRAFT_KEY` in guest checkout effects.
- Frontend type check context: `npx tsc --noEmit --pretty false` ✅ from the same maintainer pass.

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest checkout draft reload | CURRENT_SOURCE_NON_ISSUE / CHECKOUT E2E PENDING | Fill guest email/name/phone/region/address/postal code, reload checkout with cart items, and verify the saved draft appears immediately and remains editable. |
| Early edit after checkout mount | CURRENT_SOURCE_NON_ISSUE / CHECKOUT E2E PENDING | Start guest checkout with a saved draft and immediately edit one field after render; verify the edit is not overwritten by later draft rehydration. |
| Authenticated checkout cleanup | CURRENT_SOURCE_NON_ISSUE / CHECKOUT E2E PENDING | Sign in and open checkout with an existing guest draft; verify the guest draft is cleared and saved-address hydration works normally. |

## 2026-06-08 11:53 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for OrderTracking return/refund auto-refresh gating (TEST F9336).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted OrderTracking Jest: `npm test -- --runTestsByPath src/pages/OrderTracking.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router warning noise only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| RETURN_REFUNDING tracked order idle | SOURCE_FIXED / ORDER TRACKING E2E PENDING | Open `/track-order` for a guest or signed-in order in `RETURN_REFUNDING`, wait longer than `ORDER_TRACKING_AUTO_REFRESH_MS`, and verify no repeated tracking API request fires. |
| REFUNDED/RETURNED terminal tracking | SOURCE_FIXED / ORDER TRACKING E2E PENDING | Repeat the idle tracking-page check for `REFUNDED` and `RETURNED` orders and verify terminal detail UI remains visible without polling. |
| Active order polling still works | SOURCE_FIXED / ORDER TRACKING E2E PENDING | Open a `PENDING_PAYMENT` or `SHIPPED` tracked order and verify the periodic bypass-cache refresh still occurs and updates status/tracking details. |

## 2026-06-08 11:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for Navbar announcement fetch failure observability (TEST F9335).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted Navbar Jest: `npm test -- --runTestsByPath src/components/Navbar.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/AntD warning noise plus a non-failing act warning from the rejected announcement effect)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Announcement API network failure | SOURCE_FIXED / NAV E2E PENDING | Force `/announcements/active` or equivalent public announcement request to fail and verify the navbar still renders primary links such as Track Order, Cart, and Account. |
| Announcement API failure observability | SOURCE_FIXED / OBSERVABILITY E2E PENDING | Verify the failure is captured by the non-blocking error reporting path with label `Navbar.fetchAnnouncements` and the original error metadata. |
| Announcement recovery | SOURCE_FIXED / NAV E2E PENDING | After a failed announcement load, reload or retry with a successful response and verify commercial announcements render normally without stale empty state. |

## 2026-06-08 11:45 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for AdminDashboard chart memoization and stable chart props (TEST F9334).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted AdminDashboard Jest: `npm test -- --runTestsByPath src/pages/AdminDashboard.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router deprecation warnings only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin dashboard chart smoke | SOURCE_FIXED / ADMIN UI E2E PENDING | Load `/admin/dashboard` with dashboard data and verify order-status donut and sales-trend chart render with accessible labels. |
| Trend chart interaction | SOURCE_FIXED / ADMIN UI E2E PENDING | Hover/focus sales trend data points and verify tooltip/crosshair behavior still works after memoization. |
| Deferred panel transition | SOURCE_FIXED / ADMIN UI E2E PENDING | Verify the deferred 17TRACK panel placeholder swaps to the widget without disturbing the order-status or sales-trend chart layout. |
| Dashboard profiler spot-check | SOURCE_FIXED / PERF E2E OPTIONAL | If using React Profiler, trigger unrelated dashboard state changes and confirm chart components avoid unnecessary commits unless their data/labels change. |

## 2026-06-08 11:33 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for Cart checkout feedback when pending quantity synchronization fails (TEST F9333).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted Cart/Checkout Jest: `npm test -- --runTestsByPath src/pages/CartCheckoutFlow.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/fake-timer warnings only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated cart checkout with quantity update 409 | SOURCE_FIXED / CART E2E PENDING | Edit an authenticated cart item quantity, make the checkout-time quantity persistence fail, and verify checkout does not navigate while both the quantity error and checkout-blocked warning are visible. |
| Authenticated cart checkout with quantity update network failure | SOURCE_FIXED / CART E2E PENDING | Simulate a network failure on the pending quantity flush and verify the user receives visible feedback and remains on Cart with checkout re-enabled after failure. |
| Successful retry after sync failure | SOURCE_FIXED / CART E2E PENDING | After a failed checkout-time quantity sync, retry with a successful quantity update and verify selected cart ids sync and navigation to `/checkout` proceeds. |
| Locale coverage | SOURCE_FIXED / CART E2E PENDING | Repeat the blocked-checkout warning path in English, Spanish, and Chinese to verify the new `pages.cart.checkoutSyncFailed` string renders instead of a raw key. |

## 2026-06-08 11:27 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for preserving authenticated sessions on direct Login page visits (TEST F9332).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted Login Jest: `npm test -- --runTestsByPath src/pages/Login.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router deprecation warnings only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated direct `/login` visit | SOURCE_FIXED / AUTH E2E PENDING | Log in, navigate directly to `/login`, and verify the session remains in storage and the app redirects to the safe post-login target instead of showing login or logging out. |
| Authenticated `/login?redirect=/profile` visit | SOURCE_FIXED / AUTH E2E PENDING | With a valid token, open `/login?redirect=%2Fprofile` and verify the user lands on `/profile` without auth storage being cleared. |
| Explicit navbar logout | SOURCE_FIXED / AUTH E2E PENDING | Use the normal logout action and verify it still revokes/clears auth storage and routes to login as intended. |
| Failed new login cleanup | SOURCE_FIXED / AUTH E2E PENDING | Starting from stale auth storage or manually seeded tokens, submit a failed password/email login and verify stale credentials are cleared before the failed attempt handling. |

## 2026-06-08 11:21 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for ProductList fetch cancellation on rapid parameter changes (TEST F9331).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted ProductList Jest: `npm test -- --runTestsByPath src/pages/ProductList.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/act warning noise only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Rapid product search changes | SOURCE_FIXED / PRODUCT UI E2E PENDING | Throttle `/products`, type/submit two different searches quickly, and verify the first request is canceled/ignored while only the newest results render. |
| Rapid filter changes | SOURCE_FIXED / PRODUCT UI E2E PENDING | With delayed product-list responses, change price/size/material/color filters in quick succession and verify stale requests do not overwrite the latest filter result. |
| Pagination during slow product fetch | SOURCE_FIXED / PRODUCT UI E2E PENDING | Delay page 1, navigate to page 2 before page 1 resolves, and verify the page 1 request is canceled/ignored and page 2 remains selected/rendered. |
| ProductList unmount during fetch | SOURCE_FIXED / PRODUCT UI E2E PENDING | Start a slow ProductList request, navigate away, and verify the request is aborted or ignored without fallback toast/error noise on the next route. |

## 2026-06-08 11:09 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for ProductDetail lazy rich-detail/review fallbacks (TEST F9330), with ProductDetail touch listener follow-up coverage from TEST F9325.

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted ProductDetail Jest: `npm test -- --runTestsByPath src/pages/ProductDetail.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router/Suspense act warnings only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product detail slow rich-detail chunk | SOURCE_FIXED / PRODUCT UI E2E PENDING | Throttle or delay the `ProductRichDetail` chunk on product detail and verify the Details tab shows a structured skeleton that reserves the card area until rich content arrives. |
| Product detail slow review chunk | SOURCE_FIXED / PRODUCT UI E2E PENDING | Throttle or delay the `ProductReview` chunk and verify the review card keeps stable composer/list placeholder space with no tiny centered spinner or layout jump. |
| Product detail chunk failure recovery | SOURCE_FIXED / PRODUCT UI E2E PENDING | If the harness can fail one lazy chunk, verify the surrounding product detail page remains navigable and reports the failure through the existing boundary behavior. |
| Mobile gallery pinch after load | SOURCE_FIXED / MOBILE UI E2E PENDING | On a touch-capable browser/device, open product detail from a cold load and verify pinch zoom works after the initial skeleton is replaced by the gallery, confirming the non-passive `touchmove` listener attaches after load. |

## 2026-06-08 11:02 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for Login auth-path TypeScript hardening (TEST F9329).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted Login Jest: `npm test -- --runTestsByPath src/pages/Login.test.tsx --watchAll=false --runInBand` ✅ (existing React/React Router deprecation warnings only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Password login success | SOURCE_FIXED / AUTH E2E PENDING | Log in with username/email/phone password credentials and verify auth storage, guest cart merge, and post-login redirect still work. |
| Password login failure localization | SOURCE_FIXED / AUTH E2E PENDING | Trigger invalid, rate-limited, locked, or unavailable password-login responses and verify the same localized field/message behavior remains. |
| Email-code login success | SOURCE_FIXED / AUTH E2E PENDING | Request an email login code, verify the code field focuses, submit a valid code, and confirm auth persistence plus redirect behavior. |
| Email-code retry failures | SOURCE_FIXED / AUTH E2E PENDING | Trigger `RATE_LIMITED`, `TOO_MANY_ATTEMPTS`, and `INVALID_CODE` responses and verify countdowns and field errors still render correctly. |

## 2026-06-08 10:56 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for per-admin-page route error boundaries (TEST F9328).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅
- Targeted App Jest: `npm test -- --runTestsByPath src/App.test.tsx --watchAll=false --runInBand` ✅ (existing React act deprecation warning only)

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin page render failure isolation | SOURCE_FIXED / ADMIN UI E2E PENDING | Inject or simulate a render failure on one concrete admin page, such as `/admin/products`, and verify the route shows the error boundary without collapsing the whole app shell. |
| Admin recovery navigation | SOURCE_FIXED / ADMIN UI E2E PENDING | From the per-page boundary, use the recovery/home action and verify it routes to `/admin/dashboard`, not the storefront home page. |
| Cross-admin navigation after failure | SOURCE_FIXED / ADMIN UI E2E PENDING | After one admin page fails, navigate directly to another admin page such as `/admin/orders` or `/admin/support` and verify it renders normally with its own boundary state. |
| Lazy chunk failure probe | SOURCE_FIXED / ADMIN UI E2E PENDING | If the E2E harness can block one admin lazy chunk, verify the failed route is isolated and retry behavior does not require a full app reset. |

## 2026-06-08 10:46 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for ProductDetail mobile gallery touch listener churn (TEST F9325).

Local verification already run:
- Frontend type check: `npx tsc --noEmit --pretty false` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Mobile gallery pinch zoom | SOURCE_FIXED / MOBILE UI E2E PENDING | On a touch-capable browser or device, open product detail, pinch the mobile image gallery, and verify zoom origin/scale follow the gesture without page scroll during the pinch. |
| Listener stability during rerenders | SOURCE_FIXED / MOBILE UI E2E PENDING | While on product detail, change quantity/options/wishlist/compare state repeatedly, then pinch the gallery again and verify touch behavior still works without duplicate handlers or lag. |
| Carousel interaction regression | SOURCE_FIXED / MOBILE UI E2E PENDING | Verify normal image swipe, image auto-rotation pause/resume, and pinch reset still behave correctly after the handler memoization. |

## 2026-06-08 10:43 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for customer order pagination base consistency (TEST F9323).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderControllerCustomerPaginationTest,OrderStatsServiceTest,ProductControllerPaginationTest,ReviewControllerPaginationTest,SearchControllerTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Customer orders first page | SOURCE_FIXED / API E2E PENDING | Call `/orders/me?page=0&size=20` as an authenticated customer and verify it returns the first page, `X-Order-Page: 0`, correct totals, and `X-Order-Has-Next` when more pages exist. |
| Customer orders second page | SOURCE_FIXED / API E2E PENDING | Seed more than one page of orders, call `/orders/me?page=1&size=20`, and verify it returns the next distinct page rather than duplicating page 0. |
| Default and invalid page probes | SOURCE_FIXED / API E2E PENDING | Call `/orders/me` with no page and verify it defaults to page 0. Call `/orders/me?page=-1` and verify a 400 response with the page >= 0 validation message. |
| Frontend order consumers | SOURCE_FIXED / UI E2E PENDING | Open Profile orders and the customer support order picker; verify their no-param `/orders/me` calls still show the first order page after the backend default changed to 0-based. |

## 2026-06-08 10:36 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for users.email entity/schema nullability mismatch (TEST F9340; current-source QA F3281 coverage).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| JPA schema validation startup | SOURCE_FIXED / BACKEND E2E PENDING | Start the backend with `spring.jpa.hibernate.ddl-auto=validate` against a schema where `users.email` is nullable unique and verify startup no longer fails on entity nullability mismatch. |
| Registered user email required | SOURCE_FIXED / API E2E PENDING | Submit registration with missing/blank email and verify service/controller validation still rejects it before insert. Submit a valid registration and verify email persists lowercased. |
| Admin bootstrap email required | SOURCE_FIXED / ADMIN/API E2E PENDING | Attempt admin bootstrap/create-admin without email and verify it still fails with the explicit admin email validation; valid admin bootstrap should still persist email. |
| Guest checkout/user rows | SOURCE_FIXED / CHECKOUT E2E PENDING | Run guest checkout and verify guest user/order persistence remains compatible with nullable unique `users.email` plus order `contact_email`, without schema validation or Bean Validation failures. |

## 2026-06-08 10:28 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for critical commerce status CHECK constraints (TEST F9351).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Fresh MySQL schema checks | SOURCE_FIXED / DB E2E PENDING | Bootstrap a MySQL 8.0.16+ compatible database and verify CHECK constraints exist for products, coupons, orders, checkout idempotency keys, payments, reviews, and user coupons. |
| Existing DB cleanup | SOURCE_FIXED / DB E2E PENDING | Seed invalid direct-SQL statuses in an isolated pre-migration DB, run V7/startup hardening, and verify unknown values fail closed (`INACTIVE`, `CANCELLED`, `FAILED`, `HIDDEN`, or `USED`) before CHECK constraints are added. |
| Invalid direct SQL rejection | SOURCE_FIXED / DB E2E PENDING | Attempt direct inserts/updates with invalid statuses for each constrained table and verify MySQL rejects them with the named CHECK constraint. |
| Normal commerce flows | SOURCE_FIXED / API/UI E2E PENDING | Run product publish/unpublish, coupon activate/deactivate, checkout/payment, order transitions, review moderation, and coupon-use flows to verify all valid service-written statuses still persist. |

## 2026-06-08 10:06 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for birthday coupon grant FK cascade (TEST F9350).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Existing DB FK repair | SOURCE_FIXED / DB E2E PENDING | Run V7 or startup hardening against a MySQL-compatible database whose `pet_birthday_coupon_grants.pet_id` and `user_id` FKs are the old non-cascade constraints with generated names; verify metadata now reports `DELETE_RULE=CASCADE` for both. |
| Pet profile deletion | SOURCE_FIXED / API/DB E2E PENDING | Seed a pet birthday grant, delete the owning pet profile through the profile API, and verify the grant row is removed and the delete is not blocked by FK constraints. |
| User deletion cleanup | SOURCE_FIXED / ADMIN/DB E2E PENDING | Seed a user with pet profiles and birthday grants, delete the user through the admin/user deletion flow or isolated DB operation, and verify dependent grant rows are removed without blocking deletion. |
| Coupon cascade unchanged | SOURCE_FIXED / DB E2E PENDING | Delete a birthday coupon and confirm existing `coupon_id ON DELETE CASCADE` behavior still removes grant rows after the pet/user FK repair. |

## 2026-06-08 10:01 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for entity/schema length alignment (TEST F9348/F9349).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Notification long metadata | SOURCE_FIXED / API E2E PENDING | Create or seed notifications with 31-40 char `type` and 101-160 char `title`; verify API/admin notification reads persist full values without truncation. |
| Support long message | SOURCE_FIXED / SUPPORT E2E PENDING | Send a support message above 1000 chars but within the 4000-char service/entity limit and verify storage, admin queue preview, and transcript rendering remain intact. |
| Security audit long context | SOURCE_FIXED / ADMIN E2E PENDING | Trigger audit events with long actor/resource/IP fields near the widened limits and verify audit log search/export persists and displays them without DB errors. |
| Admin/system config widths | SOURCE_FIXED / DB/API E2E PENDING | Save admin role descriptions up to 500 chars and generate system alerts with 80-char source/category plus 4000-char messages; verify persistence and UI rendering. |
| Validation boundary probe | SOURCE_FIXED / API E2E PENDING | Submit above-limit values for the same fields and verify Bean Validation/service errors are returned before DB writes. |

## 2026-06-08 09:47 UTC Maintainer Cycle Regression Handoff

Source status: WONTFIX / DOCUMENTED_INTENTIONAL for product brand FK claim (TEST F9347/F1742; QA F1742) plus SOURCE_FIXED for `products.brand` width alignment.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product create/edit brand | DOCUMENTED_INTENTIONAL / ADMIN E2E PENDING | In Product Management, create and edit products using managed brand option names and verify saved rows still expose the same `brand` string in admin table/detail responses. |
| CSV/URL import brand labels | DOCUMENTED_INTENTIONAL / IMPORT E2E PENDING | Import or preview products with external supplier/vendor brand labels and verify labels are preserved as product display text without requiring pre-created `brands` rows. |
| Storefront brand display/search | DOCUMENTED_INTENTIONAL / PUBLIC UI E2E PENDING | Open product list/detail/search with branded products and verify brand text still renders and contributes to keyword search/personalization behavior. |
| 120-character brand width | SOURCE_FIXED / DB/API E2E PENDING | Against a MySQL-compatible database with migrations/startup hardening applied, save a product brand between 101 and 120 characters and verify it persists without truncation. |

## 2026-06-08 09:37 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for unbounded user mapper access (TEST F9346; QA F3475).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=UserMapperContractTest,UserServiceTest,NotificationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin user pagination | SOURCE_FIXED / ADMIN E2E PENDING | Open `/admin/users` with page/size/filter changes on a seeded large user table and verify responses stay on the bounded page object contract with `items`, `total`, `page`, `size`, and `totalPages`. |
| User export cap | SOURCE_FIXED / API E2E PENDING | Probe `/admin/users/export` above and below `admin.users.export-max-rows`; verify oversized exports return the capped rejection and allowed exports fetch only the configured bounded window. |
| Coupon/user lookup | SOURCE_FIXED / ADMIN E2E PENDING | Open coupon grant or any user picker that searches users and confirm it uses bounded remote lookup/page behavior rather than loading every user into the browser. |
| Full-user mapper regression probe | SOURCE_FIXED / STATIC/RUNTIME E2E PENDING | Inspect running mapper bindings or SQL logs during admin user smoke and confirm no `UserMapper.findAll` or unbounded `UserMapper.search` mapped statement exists or is invoked; `searchPage` should include `LIMIT/OFFSET`. |

## 2026-06-08 09:30 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for admin role permission FK ownership (TEST F9345).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Custom role save | SOURCE_FIXED / ADMIN E2E PENDING | In `/admin/roles` or the permissions UI, create/update a custom role with a narrow permission set and verify `admin_role_permissions.role_code` rows are written only for the saved `admin_roles.code`. |
| Role assignment permissions | SOURCE_FIXED / ADMIN E2E PENDING | Assign the custom role to a non-super-admin user, sign in as that user, and verify allowed admin pages work while ungranted pages/actions remain denied. |
| FK rejection probe | SOURCE_FIXED / DB E2E PENDING | Against the running MySQL-compatible database, attempt to insert an `admin_role_permissions` row for a non-existent `role_code` and verify it fails with the FK constraint. |
| Cascade cleanup probe | SOURCE_FIXED / DB E2E PENDING | In an isolated seeded database, delete a custom `admin_roles` row and verify matching `admin_role_permissions` rows are removed by `ON DELETE CASCADE` without affecting other roles. |

## 2026-06-08 09:14 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for order-item full-table mapper access (TEST F9344/F2522; QA F3483).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderItemRepositoryContractTest,OrderItemServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Order detail items | SOURCE_FIXED / API/UI E2E PENDING | Open customer and admin order detail pages with multiple items and verify item names, snapshots, images, quantities, prices, and selected specs still render through scoped `findByOrderId` reads. |
| Batch order list item enrichment | SOURCE_FIXED / API E2E PENDING | Load paged order lists that enrich items for multiple orders and verify batched `findByOrderIds` behavior still populates item summaries without full-table order-item scans. |
| Dashboard/top products | SOURCE_FIXED / ANALYTICS E2E PENDING | Verify any dashboard/top-products metric still works through the capped `findTopProductsByOrderStatuses(..., limit)` aggregate after removing only the no-arg full-table mapper statement. |
| Full-table mapper regression probe | SOURCE_FIXED / STATIC/RUNTIME E2E PENDING | Capture mapper bindings or SQL logs during order smoke and confirm no `OrderItemRepository.findAll` mapped statement exists or is invoked. |

## 2026-06-08 09:08 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for product-question answered-list fetch joins (TEST F9342; product-question/review portions of TEST F2178/F2523).

Local verification already run:
- Backend clean targeted Maven: `./mvnw -q -Dtest=ProductQuestionRepositoryContractTest,ProductQuestionRepositoryFetchJoinTest,ProductQuestionServiceTest clean test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public product Q&A list | SOURCE_FIXED / API E2E PENDING | Seed a product with multiple answered questions from different users, call the public product Q&A endpoint, and verify response shape/order/limit remain correct. Capture SQL/query logs showing product/user associations are not loaded once per question row. |
| Product detail Q&A rendering | SOURCE_FIXED / UI E2E PENDING | Open product detail with answered Q&A rows and verify question text, answer text, dates, and no customer identifiers are exposed in the public UI. |
| Admin question queue regression | SOURCE_FIXED / ADMIN E2E PENDING | Open `/admin/questions` with unanswered/answered/all filters and keyword search. Verify existing admin queue rows still include product/user context and action controls after the public repository query change. |

## 2026-06-08 09:00 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for MyBatis `ProductMapper.findAll()` full-catalog query (TEST F9343; QA duplicate F1005).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ProductMapperContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Product detail legacy mapper smoke | SOURCE_FIXED / API E2E PENDING | If any route still reaches MyBatis `ProductMapper.findById`, open/call it for active, inactive, and missing products and verify behavior is unchanged except that no all-products mapper query is available. |
| Category legacy mapper smoke | SOURCE_FIXED / API E2E PENDING | If any route still reaches MyBatis `ProductMapper.findByCategory`, verify category product reads still return expected rows after removing only the no-arg `findAll` statement. |
| Full-catalog mapper regression probe | SOURCE_FIXED / STATIC/RUNTIME E2E PENDING | Inspect running mapper bindings or logs during product/admin smoke and confirm no `ProductMapper.findAll` mapped statement exists or is invoked. |

## 2026-06-08 08:51 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for `ProductServiceImpl` unbounded product repository loads (TEST F9304; duplicate TEST/QA F890/F851/F3426). Separate MyBatis `ProductMapper.findAll()` tracker F9343 was fixed later at 2026-06-08 09:00 UTC.

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ProductSearchServiceTest,ProductImportServiceTest,ProductControllerPaginationTest,SearchControllerTest,ProductSaveServiceTest,ApplicationProfileContractTest,AdminControllerCouponPageTest,CouponServiceTest test` ✅
- Static source check: `rg -n "productRepository\\.findAll\\(\\)" src/main/java/com/example/shop/service/impl/ProductServiceImpl.java` ✅ no matches

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public product list initial load | SOURCE_FIXED / UI E2E PENDING | Seed more than 100 active products, open the storefront product list with no filters, and verify the page renders a bounded first page with stable pagination/scroll behavior rather than a full-catalog payload. |
| Discount product list | SOURCE_FIXED / API/UI E2E PENDING | Seed more than 100 discounted active products, open the discount/sale product surface or direct API flow, and verify results are sorted by discount, capped to the configured limit/page size, and still page/filter correctly. |
| Legacy product list API consumers | SOURCE_FIXED / API E2E PENDING | Probe any still-supported legacy all-products/public-products API consumers and confirm they receive at most the configured capped rows (`product.legacy-list-max-rows`, `product.public-legacy-list-max-rows`, `product.discount-list-max-rows`) instead of the full catalog. |
| Import duplicate variant SKU | SOURCE_FIXED / ADMIN E2E PENDING | Run admin CSV import where an incoming variant SKU already exists on an older product. Verify duplicate detection still blocks the import even though owner lookup now scans paged `(id, variants)` projection rows. |
| Large-catalog query/memory behavior | SOURCE_FIXED / PERFORMANCE E2E PENDING | With more than 500 products and more than 5000 variant rows if feasible, capture DB/query logs or memory metrics and confirm legacy list/import scans are paged/capped, not a single full `products` entity-table load. |

## 2026-06-08 08:34 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for admin coupon oversized page request cap (TEST/QA F2445).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminControllerCouponPageTest,CouponServiceTest,AdminControllerReviewPageTest,AdminControllerOrderPageTest,ApplicationProfileContractTest test` ✅
- Frontend targeted Jest: `npm test -- --runTestsByPath src/api/index.test.ts --watchAll=false` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Direct oversized API probe | SOURCE_FIXED / API E2E PENDING | As an admin, request `/admin/coupons?page=1&size=5000`. Verify the response remains paged and reports `size=100` or the configured lower `admin.coupons.page-max-size`, never 5000. |
| Coupon table page-size controls | SOURCE_FIXED / UI E2E PENDING | Open `/admin/coupons`, use the table page-size selector through 10/20/50/100, and verify requests never exceed 100 and rows render without truncation artifacts. |
| Large coupon dataset pagination | SOURCE_FIXED / PERFORMANCE E2E PENDING | Seed more than 100 coupons, page through the admin table, and verify older coupons remain reachable through pagination without requesting a single 5000-row payload. |
| Runtime config override | SOURCE_FIXED / CONFIG E2E PENDING | If staging exposes config center/runtime overrides, set `admin.coupons.page-max-size` below 100, reload the admin coupon page, and verify the API honors the lower configured cap. |

## 2026-06-08 08:23 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for admin coupons unified paged response shape (TEST F9308).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminControllerCouponPageTest,CouponServiceTest,AdminControllerReviewPageTest,AdminControllerOrderPageTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin coupons initial load | SOURCE_FIXED / UI E2E PENDING | Open `/admin/coupons` with no keyword/status/scope/page params. Verify the API returns an object with `items`, `total`, `page=1`, `size=50`, `totalPages`, and `summary`, and the page renders rows plus summary cards without flat-array assumptions. |
| Admin coupon filters | SOURCE_FIXED / API/UI E2E PENDING | Apply keyword, status, and scope filters. Verify filtered rows and summary cards are query-scoped and use the same response shape as the initial load. |
| Coupon pagination | SOURCE_FIXED / UI E2E PENDING | Seed more than 50 coupons, page forward/back, and verify the table can reach older coupons without client-side filtering of a truncated flat list. |
| Existing coupon actions | SOURCE_FIXED / REGRESSION E2E PENDING | After the list contract change, verify create/update/delete/grant/birthday-coupon actions still refresh the paged list and summary correctly. |

## 2026-06-08 08:16 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for HikariCP production pool tuning (TEST F9307; duplicate TEST F985/F2635 and QA F3451).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ApplicationProfileContractTest,SecurityConfigCorsTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Effective production pool config | SOURCE_FIXED / OPS E2E PENDING | Start the backend with production or staging profile and inspect effective Hikari settings through logs, actuator/env if safely available, or a controlled diagnostic. Verify max pool size 20, min idle 5, 10s connection timeout, 5m idle timeout, and 30m max lifetime unless env overrides are deliberately set. |
| Env override behavior | SOURCE_FIXED / OPS E2E PENDING | Set `DB_HIKARI_MAXIMUM_POOL_SIZE`, `DB_HIKARI_MINIMUM_IDLE`, and timeout env vars in staging. Restart and verify the effective pool uses the override values without changing source config. |
| Concurrent DB smoke | SOURCE_FIXED / PERFORMANCE E2E PENDING | Run a short concurrent smoke across product list/search, checkout quote/order creation, admin order list, and review list. Verify no connection acquisition timeouts occur and the pool does not saturate under expected staging load. |
| Alternate YAML config safety | SOURCE_FIXED / CONFIG E2E PENDING | If any deployment path still reads `application.yml`, verify it also uses the Hikari settings and does not expose private-LAN CORS wildcard defaults. |

## 2026-06-08 08:09 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for legacy review repository fetch-join coverage (TEST F9306; duplicate TEST F9341).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=ReviewRepositoryContractTest,ReviewRepositoryFetchJoinTest,ReviewControllerPaginationTest,ReviewServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Anonymous product reviews | SOURCE_FIXED / API E2E PENDING | Seed a product with many approved reviews from different users, call `/reviews/product/{id}` and `/products/{id}/reviews`, and verify response shape, usernames, product ids, ordering, pagination metadata, and average rating. Capture SQL/query logs showing product/user associations are not loaded once per review row. |
| Signed-in pending review visibility | SOURCE_FIXED / API E2E PENDING | As a signed-in user with one pending review plus other approved reviews, call both public review aliases. Verify the current user's pending review appears with correct editability/username behavior and no N+1 user/product lazy-load pattern appears in logs. |
| Inactive product guard | SOURCE_FIXED / API E2E PENDING | Mark the product inactive and verify review endpoints return the expected empty/guarded response without extra review association queries. |

## 2026-06-08 07:58 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for public payment endpoint rate-limit coverage (TEST F9309; duplicate checkout/payment rate-limit reports TEST F1538, QA F1495/F1538).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=RateLimitServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Payment create burst | SOURCE_FIXED / API E2E PENDING | Configure a low `traffic.rate-limit.checkout-payment-per-minute`, then burst `POST /payment` and `POST /payments` from the same client. Verify allowed calls return normal payment responses, the over-limit call returns 429 with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`, and no duplicate payment/order/stock side effects are created. |
| Payment sync burst | SOURCE_FIXED / API E2E PENDING | Configure a low `traffic.rate-limit.payment-sync-per-minute`, then burst `/payment/{id}/sync`, `/payments/{id}/sync`, and order-number sync aliases. Verify the shared sync bucket rejects over-limit calls with 429 while one normal sync still works. |
| Payment callback/webhook burst | SOURCE_FIXED / PROVIDER E2E PENDING | Configure a low `traffic.rate-limit.payment-callback-per-minute`, then burst callback and Stripe webhook aliases with valid and invalid callback payloads as appropriate. Verify over-limit calls receive 429 before provider/order mutation and signed single callbacks still follow the expected payment flow. |
| Cross-client isolation | SOURCE_FIXED / SECURITY E2E PENDING | Repeat payment bursts from two distinct client IP identities or authenticated users. Verify one client's exhausted payment bucket does not block the other client's allowed request budget. |

## 2026-06-08 07:50 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for cart clear response body contract (TEST F9310).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CartControllerClearResponseTest,CartServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Authenticated clear current cart | SOURCE_FIXED / API/UI E2E PENDING | With items in the signed-in user's cart, call the frontend clear-cart flow and direct `DELETE /cart/me/clear`. Verify response JSON is `{ "message": "Cart cleared" }`, cart list refreshes empty, and checkout selection state remains cleared. |
| Legacy clear route with userId | SOURCE_FIXED / API E2E PENDING | Call `DELETE /cart/clear` with no `userId` and with the authenticated user's `userId`. Verify both return the message body and clear only that user's cart. |
| Cross-user safety | SOURCE_FIXED / SECURITY E2E PENDING | Attempt `DELETE /cart/clear?userId=<otherUser>` as a normal user. Verify it is rejected and the other user's cart remains intact. |

## 2026-06-08 07:44 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for notification index coverage (TEST F9313 and notification-index portion of F1481).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=CommerceSchemaContractTest,SecurityConfigCorsTest,ApplicationProfileContractTest,AdminRequestValidationContractTest,OrderControllerLegacyAdminAuditTest,PaymentFlowServiceTest,OrderStockReservationServiceTest,OrderInputNormalizationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Existing DB migration | SOURCE_FIXED / DB E2E PENDING | Run Flyway/startup migration against an existing database with `notifications`. Verify `idx_notifications_created_at` and `idx_notifications_user_created` are created without duplicate-index errors. |
| Fresh schema bootstrap | SOURCE_FIXED / DB E2E PENDING | Bootstrap a fresh schema and confirm `notifications` contains `idx_notifications_user_read`, `idx_notifications_user_created`, and `idx_notifications_created_at`. |
| Notification list/count runtime | SOURCE_FIXED / API E2E PENDING | Seed many notifications for one user, call paged notification list and unread-count endpoints, and verify correct results. Capture `EXPLAIN` or DB metadata showing the new indexes are eligible/used. |
| Cleanup/recent scans | SOURCE_FIXED / OPS E2E PENDING | Run any notification cleanup or recent-notification maintenance job/query in staging and verify it can use `idx_notifications_created_at` instead of a full table scan. |

## 2026-06-08 07:39 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for private-LAN CORS defaults and non-production fallback (TEST F9312; duplicate default/fallback reports F9005/F1755/F2473/F2444/F2103/F2147).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=SecurityConfigCorsTest,ApplicationProfileContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Production/staging CORS allowlist | SOURCE_FIXED / DEPLOY E2E PENDING | In production/staging profiles, send credentialed preflight and simple requests from the configured HTTPS storefront/admin origins. Verify allowed origin headers are present only for those origins. |
| Private-LAN origin rejection | SOURCE_FIXED / SECURITY E2E PENDING | Send preflight requests with `Origin: http://10.0.0.5:3000`, `http://172.16.0.5:3000`, and `http://192.168.1.55:3000` without explicit env override. Verify no CORS allow-origin header is returned. |
| Local dev loopback support | SOURCE_FIXED / DEV E2E PENDING | In dev profile, verify `http://localhost:<port>` and `http://127.0.0.1:<port>` still work for frontend/API development with credentials. |
| Explicit device-test override | SOURCE_FIXED / OPS E2E PENDING | Set `CORS_ALLOWED_ORIGIN_PATTERNS` to one controlled device origin in a non-production environment and verify only that exact device-test origin is allowed, without restoring subnet wildcards. |

## 2026-06-08 07:32 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for admin brand/category/coupon request validation (TEST F9311; duplicate current-surface reports F2439/F2574).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=AdminRequestValidationContractTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=AdminRequestValidationContractTest,OrderControllerLegacyAdminAuditTest,PaymentFlowServiceTest,OrderStockReservationServiceTest,OrderInputNormalizationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin brand invalid create/update | SOURCE_FIXED / API/UI E2E PENDING | Submit blank/oversized brand name, description, and status through admin UI and direct API. Verify HTTP 400/shared validation response, readable UI error, and no brand row is created or updated. |
| Admin category invalid create/update | SOURCE_FIXED / API/UI E2E PENDING | Submit blank category name, invalid level, and oversized image URL through create and update. Verify backend validation rejects before service mutation and existing category data remains unchanged. |
| Admin coupon invalid create/update | SOURCE_FIXED / API/UI E2E PENDING | Submit blank coupon name/type and any representative invalid bounded coupon fields. Verify create/update reject consistently, audit/service mutation does not run, and a valid coupon still saves normally. |
| Admin catalog happy path regression | SOURCE_FIXED / UI E2E PENDING | Create and update valid brand/category/coupon records after the validation change. Verify normal admin workflows, list refresh, and edit forms still work. |

## 2026-06-08 07:28 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for shipment audit metadata masking (TEST F9324/F9352).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderControllerLegacyAdminAuditTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=OrderControllerLegacyAdminAuditTest,PaymentFlowServiceTest,OrderStockReservationServiceTest,OrderInputNormalizationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Admin ship success audit | SOURCE_FIXED / AUDIT E2E PENDING | Ship an order with a real-looking tracking number and carrier code. Verify the order stores/displays tracking normally where required, but audit metadata shows only a masked tracking suffix and no raw carrier code. |
| Admin ship failure audit | SOURCE_FIXED / AUDIT E2E PENDING | Force a shipment failure after submitting tracking details. Verify failure audit metadata is also masked and does not expose the raw tracking number or carrier code. |
| Security audit UI/export | SOURCE_FIXED / UI/EXPORT E2E PENDING | Open and export security/audit logs containing shipment events. Verify raw tracking numbers and carrier codes are not visible in table rows, detail panels, downloads, or copied metadata. |

## 2026-06-08 07:25 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for refund stock restoration defaults/audit trail (TEST F9321).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest,OrderStockReservationServiceTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=PaymentFlowServiceTest,OrderStockReservationServiceTest,OrderInputNormalizationServiceTest,OrderControllerLegacyAdminAuditTest test` ✅
- Frontend TypeScript: `npx tsc --noEmit --pretty false` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Completed-order refund restock | SOURCE_FIXED / DB E2E PENDING | Refund a `COMPLETED` order through admin with the UI restock control checked/disabled. Verify inventory is restored, audit metadata records `restock=true`, and no operator action can accidentally skip restock. |
| Return-state refund restock | SOURCE_FIXED / DB/UI E2E PENDING | Refund orders in `RETURN_REQUESTED`, `RETURN_APPROVED`, and `RETURN_SHIPPED` states. Verify the refund modal forces restock and backend stock restoration matches the order quantities/variants. |
| Shipped no-restock audit | SOURCE_FIXED / OPS E2E PENDING | Refund a `SHIPPED` order with restock intentionally unchecked. Verify inventory is not restored, the backend warning includes order id/order number/status/requested flag, and admin audit metadata records `restock=false`. |
| API parity | SOURCE_FIXED / API E2E PENDING | Call the admin refund API directly with `restock=false` for completed/return-state orders and verify the backend still restocks by default and records the effective restock decision. |

## 2026-06-08 07:15 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for stock-restoration missing-product logging and product-row lock coverage (TEST F9320; duplicate restore-stock locking reports F2127/F2539/F3417/F3424).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=OrderStockReservationServiceTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=PaymentFlowServiceTest,OrderInputNormalizationServiceTest,OrderStockReservationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Pending-payment cancellation stock restore | SOURCE_FIXED / DB E2E PENDING | Create a pending-payment order, cancel it, and verify aggregate product stock and selected variant stock are restored exactly once while SQL/log evidence shows the product row is locked for restoration. |
| Refund/return stock restore | SOURCE_FIXED / DB E2E PENDING | Refund a paid `PENDING_SHIPMENT` order and complete a return flow. Verify stock restoration is correct for base-stock and variant-stock products and no unlocked product read-modify-write path appears in SQL logs. |
| Missing/deleted product observability | SOURCE_FIXED / OPS E2E PENDING | In a staging database, delete or hide the product row for an order item before cancellation/restock in a controlled fixture. Verify the operation emits a warning with product id/order item id/quantity so ops can investigate missing restoration. |
| Concurrent restock pressure | SOURCE_FIXED / CONCURRENCY E2E PENDING | Run concurrent cancellation/refund attempts for different orders containing the same product. Verify no lost update occurs and final stock equals initial stock plus all eligible restored quantities. |

## 2026-06-08 07:11 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for checkout product reload after stock-reservation product loading (TEST F9319).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=PaymentFlowServiceTest,OrderInputNormalizationServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Guest checkout product lock reuse | SOURCE_FIXED / API E2E PENDING | Place a guest checkout order with one or more non-free-shipping products while observing SQL/repository logs. Verify product loading for checkout reservation uses the locking path and shipping-fee calculation does not issue a second plain product reload for the same product ids. |
| Registered checkout shipping fee | SOURCE_FIXED / API E2E PENDING | Place a registered-user checkout order from cart items with default shipping. Verify totals remain correct and the shipping-fee path reuses the product snapshot loaded during checkout item preparation. |
| Free-shipping behavior | SOURCE_FIXED / BUSINESS E2E PENDING | Exercise product-level free shipping and threshold-based free shipping for guest and registered checkout. Verify shipping remains `0.00` only when expected and no stock-reservation behavior regresses. |

## 2026-06-08 07:04 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for cart monetary precision (TEST F9318).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=CartServiceTest test` ✅
- Backend combined slice: `./mvnw -q -Dtest=CartServiceTest,SearchControllerTest,ProductControllerPaginationTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Cart decimal subtotal precision | SOURCE_FIXED / API/UI E2E PENDING | Seed or add three cart lines priced `33.33` with quantity `1` each. Verify cart subtotal, drawer subtotal, checkout subtotal, and any cart total API consumer show exactly `99.99`, not `99.989999...` or `100.00`. |
| Coupon threshold comparisons | SOURCE_FIXED / BUSINESS E2E PENDING | With repeated decimal-price items near a coupon/free-shipping threshold, verify eligibility/gap copy uses cent-rounded totals consistently and does not incorrectly reject or accept because of floating-point drift. |
| Monetary rounding edge case | SOURCE_FIXED / API E2E PENDING | Exercise a cart line or fixture with a value requiring half-up cent rounding, such as `10.005`, and confirm backend total calculation rounds to `10.01` before downstream comparison/display. |

## 2026-06-08 06:58 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for public `/search` pagination metadata and page/size validation (F9301/F9322, older duplicate F3302).

Local verification already run:
- Backend targeted Maven: `./mvnw -q -Dtest=SearchControllerTest,ProductControllerPaginationTest test` ✅
- Static diff hygiene: `git diff --check -- src/main/java/com/example/shop/controller/SearchController.java src/test/java/com/example/shop/controller/SearchControllerTest.java` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Public search paged response | SOURCE_FIXED / API E2E PENDING | Call `/search?q=bowl&page=0&size=24` and `/search?q=bowl&page=2&size=12` against a running backend. Verify JSON contains `items`, `total`, `page`, `size`, `totalPages`, `hasNext`, and `hasPrevious`, and the item count never exceeds requested `size`. |
| Search bounds validation | SOURCE_FIXED / API E2E PENDING | Call `/search?q=bowl&page=-1`, `/search?q=bowl&size=0`, and `/search?q=bowl&size=101`. Verify each returns 400 with the shared API error format and does not execute a product page query. |
| Blank search compatibility | SOURCE_FIXED / API E2E PENDING | Verify `/search?q=` still returns 400 when no filter is present, while `/search?q=&categoryId=<valid>` returns a paged response with blank keyword and scoped category filtering. |
| Frontend/search contract smoke | SOURCE_FIXED / UI E2E PENDING | Smoke any frontend entry point that still calls `/search` directly or through browser address/search integrations. Verify it handles the paged response contract, no stale flat-array assumption breaks rendering, and `/products` remains unchanged. |

## 2026-06-08 06:44 UTC Maintainer Cycle Regression Handoff

Source status: SOURCE_FIXED for OrderTracking Jest compile blocker, product schema width mismatch, and Stripe provider-message passthrough. CURRENT_SOURCE_NON_ISSUE for latest top-list hardcoded Stripe key, coupon maxDiscountRate, top-level product SKU column, existing order/category FK, and stale PetGallery overlay reports as noted in `QA_ISSUES.md`.

Local verification already run:
- Frontend targeted Jest: `CI=true npm test -- --runTestsByPath src/pages/OrderTracking.test.tsx --watchAll=false --runInBand --testTimeout=30000` ✅ (1 suite, 2 tests)
- Backend targeted Maven: `./mvnw -q -Dtest=CommerceSchemaContractTest,StripeProviderErrorContractTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| OrderTracking Jest/full regression | SOURCE_FIXED / E2E PENDING | Run full frontend Jest and at least one browser `/track-order` lookup flow. Verify no compile error, active orders still auto-refresh, terminal orders do not poll, and lookup abort behavior still matches prior F2083/F2073 expectations. |
| Admin product long name/tag persistence | SOURCE_FIXED / DB/UI E2E PENDING | In a migrated environment, create and edit a product with a 101-200 character name and a 21-80 character tag through admin UI/import. Verify save succeeds, values round-trip through list/detail/admin edit, and no DB truncation/500 occurs. |
| Stripe provider failure message safety | SOURCE_FIXED / PAYMENT E2E PENDING | Force Stripe checkout creation, refresh, refund, and checkout-session lookup failures using a provider error whose message contains `sk_test_`/`sk_live_`-like text. Verify API JSON, toasts, audit-visible messages, and customer UI show only generic provider-unavailable text and never expose Stripe SDK raw messages. |
| Latest non-issue retest audit | TRIAGED / OPTIONAL | Confirm current source still has no committed `application.yml` Stripe key, variant SKU uniqueness remains enforced by `ProductVariantService`/import preflight, `orders.user_id` and `products.category_id` FKs exist after migration, and PetGallery cards have no stale `.overlay`/`rgba(0,0,0,0.6)` contrast issue. |

## 2026-06-06 21:42 UTC Implementation Cycle #503 Regression Handoff

Source status: CURRENT_SOURCE_COVERED / NON_ISSUE for F2087.

Local verification already run:
- Static source check: only `Stripe.API_VERSION` is present for Stripe webhook test payload API version; no `Stripe.apiVersion = ...`, `"2025-06-30"`, or `"basil"` hardcoded version remains
- Backend targeted Maven: `./mvnw -q -Dtest=PaymentFlowServiceTest test` ✅

| Flow | Current result | Required E2E follow-up |
|---|---|---|
| Stripe webhook fixture compatibility | CURRENT_SOURCE_COVERED / E2E PENDING | No dedicated browser flow required for the stale hardcoded-version report. Keep normal Stripe checkout/webhook regression coverage and verify webhook fixtures continue to parse after Stripe SDK upgrades. |

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

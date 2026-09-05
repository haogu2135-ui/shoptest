# Shop Optimization Round: 130 Completed Items

This round covers storefront data access, shared controls, admin workflows,
and asynchronous lifecycle safety. Each item is represented in the current
frontend source and is covered by the focused or full regression suite where
the behavior is testable.

## Shared Caching And Controls

1. Prevent cache-bypass GETs from replacing a shared pending request.
2. Keep typed cache-bypass requests out of the request registry.
3. Normalize non-finite and negative response-cache TTL values.
4. Remove only the request that owns a cache key when it settles.
5. Emit one change event when a search field is cleared.
6. Allow search clear controls to expose localized accessible labels.
7. Bound SearchBar debounce delays to avoid accidental long or invalid timers.
8. Close an image preview when its source or fallback changes.
9. Decode normal images asynchronously to reduce main-thread blocking.
10. Expose localized preview close labels through ShopImage.
11. Load an opened preview image eagerly for predictable dialog rendering.
12. Add titleAriaLabel for ShopModal complex or visually hidden titles.
13. Add titleAriaLabel for ShopDrawer complex or visually hidden titles.
14. Compute enabled tab keys once per render instead of once per tab.
15. Start uncontrolled tabs on the first enabled tab when the default is disabled.
16. Stabilize ShopTabs selection callbacks with useCallback.
17. Memoize normalized ShopCheckboxGroup values.
18. Stabilize ShopCheckboxGroup toggle callbacks.
19. Give unlabeled standalone checkboxes a usable accessible name fallback.
20. Clamp invalid ShopRate counts before creating the star array.
21. Bound useDebounce delays and provide a finite fallback.
22. Ignore disabled preferred focus targets in focus traps.
23. Restore focus only when the original trigger is still connected.
24. Restrict Unsplash resizing detection to the exact trusted host.
25. Sanitize, deduplicate, sort, and bound responsive image widths.
26. Ignore stale WebSocket close events from replaced connections.
27. Render non-finite controlled number values as empty instead of `NaN`.
28. Bound number-input precision to prevent infinite or unusable factors.
29. Give icon-only ShopSwitch controls a fallback accessible name.
30. Normalize invalid ShopTabs gutter values to stable non-negative CSS.
31. Localize ShopAlert close-button labels and titles.
32. Reset ShopAvatar failure state when its image source changes.
33. Clamp ShopBadge overflow counts to finite non-negative values.
34. Expose the ShopBadge count as an accessible label.
35. Supply a fallback accessible label for icon-only ShopButton controls.
36. Deduplicate nested ShopCascader option values.
37. Stabilize ShopCascader positioning updates around the active path.
38. Clamp ShopCascader popup width and horizontal position to the viewport.
39. Normalize invalid ShopCascader popup z-index values.
40. Focus the first enabled ShopCascader option when its popup opens.
41. Add keyboard navigation and activation to ShopCascader options.
42. Deduplicate ShopCheckbox option values before rendering.
43. Synchronize ShopCheckbox indeterminate state through its input ref.
44. Localize ShopDatePicker clear-button labels and titles.
45. Clamp ShopDescriptions responsive column counts to the supported range.
46. Clamp ShopDescriptions item spans before creating grid declarations.
47. Focus the first enabled ShopDropdown item and restore trigger focus on close.
48. Add Escape, arrow, Home, and End navigation to ShopDropdown menus.
49. Normalize invalid ShopDropdown popup z-index values.
50. Keep ShopInput controlled and uncontrolled values on one stable render path.
51. Localize ShopInput clear-button labels and titles.
52. Add optional clear behavior and labels to ShopTextArea.
53. Make clickable ShopList items keyboard-activatable.
54. Generate stable duplicate-safe keys for ShopList rows.
55. Normalize invalid ShopList pagination values and page bounds.
56. Mark the ShopList page status as a polite live region.
57. Deduplicate ShopMultiSelect options before filtering and selection.
58. Preserve an active ShopMultiSelect option across filtered renders.
59. Clamp ShopMultiSelect popup width, height, and horizontal position.
60. Normalize ShopMultiSelect maxCount before enforcing selection limits.
61. Add keyboard navigation and active-option semantics to ShopMultiSelect.
62. Localize ShopMultiSelect clear-button labels and titles.
63. Normalize ShopPagination total, page size, and current page inputs.
64. Add a focus trap and lifecycle cleanup to ShopPopconfirm.
65. Guard asynchronous ShopPopconfirm confirmation against duplicate submits.
66. Localize ShopPopconfirm dismiss-button labels and titles.
67. Connect ShopPopconfirm descriptions through aria-describedby.
68. Enforce a usable minimum circle size in ShopProgress.
69. Localize ShopRangePicker clear-button labels and titles.
70. Normalize ShopRangeSlider finite bounds, values, and step snapping.
71. Add keyboard navigation and focus movement to interactive ShopRate stars.
72. Deduplicate ShopSegmented options and honor disabled options.
73. Add arrow, Home, and End keyboard selection to ShopSegmented.
74. Scope ShopTabs tab and panel IDs per component instance.
75. Localize ShopTag close-button labels and titles.
76. Normalize ShopTooltip enter and leave delays.
77. Cancel ShopTooltip timers and ignore internal focus transitions.
78. Clamp ShopTreeSelect popup dimensions and z-index values.
79. Add active-option semantics and keyboard selection to ShopTreeSelect.
80. Normalize ShopTypography ellipsis styles before merging caller styles.
81. Cancel ShopTypography copy-feedback timers on replacement and unmount.
82. Add default `noopener noreferrer` protection to external typography links.

## API Contracts And Data Access

83. Make recursive array-response normalization cycle-safe.
84. Normalize nested count responses through a typed `withCountData` helper.
85. Centralize admin page metadata normalization for totals and page bounds.
86. Preserve supported response metadata while supplying safe pagination defaults.
87. Normalize review array and object responses through the shared metadata path.
88. Normalize coupon array and object responses through the shared metadata path.
89. Normalize pet-gallery array and object responses with safe summary metadata.
90. Normalize user array and object responses with safe pagination metadata.
91. Normalize announcement array and object responses with navigation metadata.
92. Normalize support-session rows while preserving context-key data.
93. Reject negative, fractional, non-finite, and malformed page metadata.
94. Fall back to valid defaults for pagination sizes below one.
95. Derive `hasNext` and `hasPrevious` only when the server omits them.
96. Keep cache cleanup from deleting a newer request for the same cache key.
97. Prevent bypass-cache product lists from repopulating list caches.
98. Prevent bypass-cache detail and recommendation calls from repopulating caches.
99. Avoid sharing pending requests when a caller supplies a signal or bypasses cache.
100. Add a shared API abort-controller factory for lifecycle-bound requests.
101. Merge abort signals and request options without dropping existing query config.
102. Add cancellable options to admin traffic-control and bug reads.
103. Add cancellable admin user page and summary reads.
104. Add cancellable admin order page, item, payment, and carrier reads.
105. Add cancellable admin product, inventory, category, and brand reads.
106. Add cancellable admin review and coupon reads.
107. Add cancellable admin announcement and birthday-config reads.
108. Propagate signals through admin support summary, session, and message reads.
109. Propagate signals through storefront seckill, cart, and order reads and writes.
110. Propagate signals through payment, address, wishlist, notification, and pet APIs.

## Request Lifecycle And Workflow Safety

111. Cancel stale CartDrawer loads before destructive cart mutations.
112. Block duplicate CartDrawer remove, save-for-later, and suggestion actions.
113. Guard CartDrawer checkout and unavailable-item clearing with synchronous refs.
114. Cancel checkout payment-channel loading on unmount.
115. Sequence checkout region loads so stale locale responses cannot overwrite state.
116. Remove the checkout region scroll animation loop that ran continuously.
117. Sequence profile address-region loads and guard their loading state.
118. Cancel profile payment refresh, channel, continue-pay, and sync requests.
119. Guard profile payment polling and return synchronization by active request.
120. Cancel profile user, order, address, and pet-session requests on unmount.
121. Preserve profile order-item preview failure state without hiding the order.
122. Cancel UserManagement list and summary requests on superseding filters.
123. Preserve UserManagement page size while resetting filtered results to page one.
124. Cancel Wishlist loads and reject stale responses after unmount or mutation.
125. Block duplicate Wishlist item, add-all, and unavailable-item actions.
126. Guard BugManagement summaries and per-bug detail loads by request identity.
127. Guard CouponManagement coupon, summary, user, and birthday-config loads.
128. Guard announcement, brand, category, carrier, review, and inventory loads.
129. Guard order, tracking, payment-instructions, gallery, product, seckill, stock-alert, support, and traffic-control workflows.
130. Add regression coverage for cancellation, stale responses, malformed pagination, and signal propagation.

## Post-Round Lifecycle Follow-Ups

The following follow-ups were identified during the final lifecycle audit and
are kept in addition to the original 130-item record:

131. Cancel Home wishlist, catalog, personalized, and recently-viewed loaders.
132. Cancel ProductList category, wishlist, and personalized session reads.
133. Cancel Navbar announcement, admin-access, and account-badge refreshes.
134. Cancel CouponCenter data loads when filters or auth state supersede them.
135. Cancel Payment channel and payment-creation requests on retry or unmount.
136. Cancel CustomerSupportWidget session, guest, polling, detail, and switch reads.
137. Propagate lifecycle cancellation through the member order refresh in PaymentInstructions.
138. Cancel admin permission refreshes and related profile/category reads on unmount.
139. Cancel ProductDetail primary and deferred content reads across route and auth changes.
140. Add abort-aware options to storefront review, question, and reviewable-order reads.
141. Sequence BugManagement permission refreshes so superseded events cannot update state.
142. Cancel BrowsingHistory product loads when history, locale, or route state changes.
143. Cancel PetFinder candidate and fallback catalog loads when filters or reloads supersede them.
144. Cancel authenticated cart snapshot loads when refreshes, mutations, or unmount supersede them.
145. Cancel recently-viewed cart product loads on preference changes and unmount.
146. Cancel Home pet-gallery refresh requests when idle work is superseded or the page unmounts.
147. Allow authenticated cart-drawer snapshots to receive lifecycle signals and suppress stale fallback opens.
148. Cancel checkout action-scoped cart, payment-reconcile, and guest-restore product reads on unmount or supersession.
149. Scope product-detail purchase, recommendation, favorite, and cart-recovery
    action feedback to the active route and component lifecycle.
150. Guard Profile order mutation feedback, refreshes, and loading cleanup after
     unmount while latching duplicate submits and completing reorder mutations.
151. Guard checkout cart-quantity flushes and handoffs after unmount so stale
     writes, callbacks, errors, and navigation cannot continue from dead UI.
152. Guard Profile address, pet, and account mutations after unmount while
    latching duplicate saves, deletes, defaults, verification codes, and
    password changes.
153. Guard Home and ProductList product actions after unmount while latching
    duplicate adds, wishlist toggles, and cart snapshot handoffs.
154. Guard StockAlerts cart actions after unmount while latching duplicate item
    adds and bulk recovery actions, including feedback and loading cleanup.
155. Guard ProductCompare cart actions after unmount while latching duplicate
    item and bulk adds and reserving product IDs across concurrent actions.
156. Guard PetGallery upload, like, and delete actions after unmount while
    latching duplicate submissions and suppressing stale feedback and refreshes.
157. Guard AlertManagement self-check, per-alert, batch, and purge mutations
    after unmount while sharing a synchronous active-action latch.
158. Guard ConfigCenter publish and runtime-apply mutations after unmount while
    latching duplicate actions before asynchronous form validation.
159. Guard notification read, mark-all, and delete mutations after unmount while
    sharing synchronous per-action latches and disabling stale-snapshot actions.
160. Guard PermissionManagement role saves after unmount while latching duplicate
    validation and write submissions and awaiting the refreshed role snapshot.
161. Guard SeckillManagement campaign saves after unmount while blocking overlap
    with status writes and suppressing stale feedback and loading cleanup.
162. Guard SeckillManagement campaign status writes after unmount while latching
    duplicate transitions and preventing overlapping campaign mutations.
163. Guard Notifications mutation feedback and state after unmount while latching
    overlapping read, mark-all, and delete actions.
164. Guard Login password, email-code, and email-login flows after unmount while
    suppressing stale form feedback, focus, announcements, and loading cleanup.
165. Guard ForgotPassword code-send and reset flows after unmount while preserving
    synchronous duplicate latches and suppressing stale feedback and loading cleanup.
166. Guard Register code-send and registration flows after unmount while suppressing
    stale focus, form feedback, navigation, announcements, and loading cleanup.
167. Stop SeckillManagement from validating or starting data refresh work after
    the page has already unmounted.
168. Stop ProductQuestionManagement from starting a superseded question list read
    after the summary request is no longer current.
169. Guard ProductQuestionManagement answer and delete mutations after unmount
    while latching overlapping actions and suppressing stale loading cleanup.
170. Guard LogManagement debug toggles and log downloads after unmount while
    latching overlapping actions and suppressing stale feedback and download DOM work.
171. Guard AnnouncementManagement save, status, and delete mutations after
    unmount while latching overlapping writes and suppressing stale feedback and refreshes.
172. Guard BrandManagement save and delete mutations after unmount while
    latching overlapping writes and suppressing stale feedback and refreshes.
173. Guard InventoryManagement stock adjustments after unmount while latching
    duplicate validations and writes and suppressing stale feedback and refreshes.
174. Guard CategoryManagement save and delete mutations after unmount while
    latching overlapping writes and suppressing stale feedback and refreshes.
175. Guard LogisticsCarrierManagement save and delete mutations after unmount
    while latching overlapping writes and suppressing stale feedback and refreshes.
176. Guard NotificationManagement broadcasts after unmount while latching
    duplicate form submissions and suppressing stale feedback and DOM events.
177. Guard ReviewManagement delete, reply, and status mutations after unmount
    while latching overlapping writes and suppressing stale feedback and refreshes.
178. Guard TrafficControl circuit and rate-limit mutations after unmount while
     latching overlapping actions and disabling stale refresh and confirmation controls.
179. Guard IpBlacklistManagement block and release mutations after unmount while
     sharing a synchronous latch, aborting writes, and disabling conflicting actions.
180. Guard ProductReview image uploads and submissions after unmount while latching
     overlapping actions, aborting requests, and suppressing stale feedback and state.
181. Guard SeventeenTrackWidget tracking queries on supersession and unmount while
    aborting old requests, suppressing stale results, and clearing removed tracking state.
182. Guard SupportManagement reply, close, assign, reopen, birthday-coupon, and
    order-detail actions after unmount while latching overlapping operations and
    propagating request cancellation through polling and read-state updates.
183. Guard CustomerSupportWidget message, order-share, and close-session actions
    after unmount while latching overlapping mutations and cancelling polling and
    read-state requests.
184. Serialize featured product collections with the lightweight list-item DTO.
185. Serialize personalized recommendation collections with the lightweight
     list-item DTO.
186. Serialize add-on candidate collections with the lightweight list-item DTO.
187. Serialize pet-finder candidate collections with the lightweight list-item
     DTO.
188. Serialize batch product lookups with the lightweight list-item DTO.
189. Serialize related-product collections with the lightweight list-item DTO.
190. Serialize the legacy home product collection with the lightweight list-item
     DTO.
191. Remove the now-unused full-product collection mapper from ProductController.
192. Batch-load all seckill items for a campaign collection in one repository
     query to remove per-campaign item reads.
193. Hydrate seckill campaign products through the existing bounded product-ID
     batch path, chunking larger campaigns at 40 IDs instead of reading each
     product individually.
194. Compute one timestamp per seckill collection response so campaign states
     are consistent across the same payload.
195. Reuse the bounded product-ID batch loader for seckill campaign write
     validation instead of reading every referenced product independently.
196. Cache repeated category keyword expansions within one product search so a
     phrase reused as a token does not issue duplicate category queries or tree
     walks.
197. Bound public seckill campaign collection reads with a configurable,
     hard-capped page before hydrating campaign items and products.
198. Bound admin seckill campaign collection reads with a separate configurable
     hard cap while preserving the existing start-time ordering.
199. Reuse joined order customer-type metadata so registered order list rows do
     not issue a per-order user lookup while computing guest visibility.
200. Bound cart-item reads by the configured per-user line cap and apply stable
     ID ordering before refreshing product snapshots.
201. Bound user-address list and post-delete default-selection reads by the
     configured per-user address cap at the Mapper query boundary.
202. Batch product-search category expansion by depth across all matched roots,
     preserving de-duplication and the hard tree-depth guard.
203. Process startup announcement placeholder scans in fixed ID-keyset batches
     so status updates do not create an unbounded read or offset-pagination gaps.
204. Batch category-management descendant validation by breadth level while
     retaining cycle protection and the existing descendant ID order contract.
205. Batch category-move maximum-child-depth validation by breadth level and
     stop revisiting category IDs when legacy data contains a cycle.
206. Refresh moved-category descendants with batched parent queries while
     propagating paths and levels through each breadth frontier.
207. Load product-import category lookup data through bounded, stably ordered
     pages instead of the unbounded category repository `findAll()` query.
208. Route the legacy category reference-data lookup through the bounded sorted
     page path and clamp explicit category list sizes to a hard maximum.
209. Route legacy brand reference-data lookups through bounded pages and clamp
     explicit brand list sizes to a hard maximum.
210. Route legacy logistics-carrier reference-data lookups through bounded pages
     and clamp explicit carrier list sizes to a hard maximum.
211. Combine admin review status, low-rating, reply-needed, and average-rating
     signals into one filtered aggregate query instead of multiple count queries.
212. Remove unused unbounded brand and logistics-carrier repository overloads
     after routing their legacy service entry points through bounded pages.
213. Bound the legacy featured-product repository path with the existing
     configurable product-list limit while preserving its service interface.
214. Remove unused unbounded user-coupon list methods and XML queries after all
     coupon flows moved to bounded mapper paths.
215. Process birthday-coupon grants through ordered `id` keyset batches with a
     configurable hard-capped scan size, preserving complete daily coverage.
216. Remove unused unbounded coupon status/scope and claimable finder overloads
     after all service call sites moved to bounded repository queries.
217. Add runtime regression coverage for birthday-coupon keyset batching and its
     ordered, limited MyBatis query contract.
218. Bound public category parent, level, and top-level lookups with stable
     database ordering and a 500-row response window.
219. Remove the unused unbounded admin-role `findAll()` overload after all
     production callers moved to the bounded controller-driven lookup.
220. Remove the unused per-campaign seckill-item repository lookup after
     campaign collections moved to the batched campaign-ID query.
221. Bound birthday-coupon reissue pet loading by the configured per-user pet
     limit, hard-capped at 50, directly in the MyBatis query.
222. Remove the unused unbounded cart-item-by-user mapper method and XML query
     after all cart reads moved to bounded paths.
223. Remove the unused unbounded product-by-category mapper method and XML
     query after related-product and recommendation flows moved to batch paths.
224. Remove the unused unbounded product repository category lookup after
     category expansion callers moved to the bounded batch query.
225. Remove the unused unbounded product name search repository method after
     recommendation and import duplicate checks moved to bounded query paths.
226. Remove the unused legacy review-by-product fetch-join method and its
     dedicated contract coverage after all production callers used paged review
     queries.
227. Remove the unused unbounded seckill-campaign status overload after public
     campaign reads moved to the bounded `Pageable` query.
228. Remove the unused unbounded product category batch finder after all
     category-based product flows moved to bounded candidate queries.
229. Remove unused non-locking cart-item lookup overloads and their MyBatis
     queries after cart writes standardized on the locking lookup.
230. Remove unused legacy coupon status, scope, expiry, and inventory counters
     after admin and claim flows moved to current query paths.
231. Remove the unused payment status counter and legacy payment transition
     update after all payment flows use the detailed transition query.
232. Remove unused legacy pet-gallery viewer existence methods after likes use
     the unified viewer-key lookup.
233. Remove the unused product category/status count helper after category
     counts moved to the current aggregate path.
234. Remove unused review eligibility and admin metric overloads after bounded
     order and combined aggregate queries became the only production paths.
235. Remove unused site-announcement scalar counter queries after the admin
     summary and active paged query paths became authoritative.
236. Remove unused case-insensitive and existence helpers from the legacy JPA
     user repository after user flows standardized on the mapper and direct
     identity lookups.
237. Decode percent-encoded request paths before applying rate-limit endpoint
     buckets so encoded authentication paths cannot bypass dedicated limits.
238. Publish local rate-limit bucket counts with volatile visibility for
     concurrent status and cleanup readers.
239. Schedule expiration cleanup for local access-token and refresh-token
     revocation fallbacks so low-write instances do not retain stale entries.
240. Publish local guest-access rate-limit bucket counts with volatile
     visibility so concurrent status and cleanup readers observe increments.
241. Escape `%`, `_`, and `!` in product-question keyword searches and declare
     the JPQL escape character so wildcard input is matched literally.
242. Escape `%`, `_`, and `!` in review keyword searches and declare the JPQL
     escape character so wildcard input is matched literally.
243. Escape `%`, `_`, and `!` in coupon keyword searches and declare the JPQL
     escape character so wildcard input is matched literally.
244. Escape `%`, `_`, and `!` in site-announcement keyword searches and declare
     the JPQL escape character so wildcard input is matched literally.
245. Escape `%`, `_`, and `!` in pet-gallery keyword searches and declare the
     JPQL escape character, preserving wildcard characters as literal input.
246. Use session-scoped unread count subqueries for regular support-session
     lookups, retaining the shared aggregate only for admin sorting and summary
     paths; add a covering session/read-state index for the scoped counts.
247. Combine product-question admin total, answered, unanswered, and stale
     counts into one filtered aggregate query.
248. Combine site-announcement admin status, schedule, inactive, and linked
     counts into one filtered aggregate query.
249. Combine coupon admin status, visibility, expiry, and inventory counts into
     one filtered aggregate query.
250. Combine security-audit total, success, and failure counts into one
     filtered aggregate query while preserving result-filter semantics.
251. Combine system-alert status totals and open severity totals into one
     status/severity aggregate query.
252. Combine pet-gallery admin visibility, source, recency, and file-size
     counts into one filtered aggregate query.
253. Batch-load current viewer pet-gallery likes for public photo lists with
     one photo-id query instead of one existence query per photo.
254. Reuse one category descendant traversal for move cycle validation and
     maximum-depth validation during category saves.
255. Batch birthday-grant counts by user and year per scan page, keeping the
     user/year index and in-memory reservations aligned with the per-user cap.
256. Batch coupon-grant ownership checks by coupon and user IDs, retaining
     duplicate-race compensation and adding the coupon/user lookup index.
257. Batch admin-role permission replacement and missing-permission seeding,
     using one existing-permission lookup per role while preserving unique-key
     conflict propagation and transaction rollback semantics.
258. Batch startup product variant-image repairs after JSON normalization so
     large repair runs do not issue one product update per row.
259. Normalize users mapped to active admin roles with one joined update after
     preserving the dedicated `SUPER_ADMIN` synchronization path.
260. Batch-load existing pet-gallery seed image URLs during startup so fixed
     seed reconciliation does not issue one existence query per seed.
261. Combine IP-blacklist status totals into one conditional aggregate query,
     while retaining local legacy-login snapshot additions.
262. Reconcile all active admin-role permissions with one permission-table read
     and one batch insert instead of one existing-permission read per role.
263. Reconcile fixed public coupon seed rows with one JDBC batch while keeping
     each row's `NOT EXISTS` idempotency guard.
264. Load coupon schema columns once and combine legacy coupon default backfills
     into one conditional update during startup.
265. Reuse the existing admin-order summary's `MISSING_TRACKING` aggregate in
     order pages instead of issuing a second filtered count query.
266. Batch-lock variant products during multi-product order stock restoration
     in stable ID order, retaining the single-product fallback and missing-row
     diagnostics.
267. Reuse the dashboard order aggregate's refunding-payment count in the admin
     dashboard instead of issuing a second unfiltered order-summary query, with
     typed `TIMESTAMPADD` thresholds for H2/MySQL-compatible SLA execution.
268. Push public-product status filtering into the joined Review list, count,
     and average-rating queries so public review reads avoid a separate product
     existence query while preserving inactive-product invisibility.
269. Batch-preload existing product IDs for CSV imports with one repository
     lookup, while retaining per-row validation, duplicate checks, and import
     rollback behavior.
270. Reuse the already-loaded parent category while building category paths,
     avoiding repeated parent lookups during category saves and moves while
     retaining ancestor-path fallback behavior.
271. Return the wishlist add/toggle operation's final state directly, avoiding
     repeated existence reads in nested service calls and Controller responses
     while retaining unique-key idempotency.
272. Return the normalized, generated-key address entity from address creation,
     avoiding a redundant post-insert lookup in the Controller.
273. Return the normalized pet profile entity after insert/update, relying on
     generated-key backfill and avoiding a redundant post-write lookup.
274. Keep abort handling at the caller Promise boundary for shared cached reads,
     so one component can cancel its own wait without aborting a deduplicated
     network request used by other callers.
275. Make generic cached reads skip cached responses and in-flight coalescing
     when `bypassCache` is explicitly requested.
276. Make typed cached reads follow the same bypass contract and avoid retaining
     forced-refresh promises in the shared request map.
277. Prevent forced-refresh responses from repopulating generic or typed caches
     after the caller opted out of caching.
278. Remove only the request currently owned by a cache key during completion,
     preserving a newer replacement request that may have taken its place.
279. Add cache generations so an older response cannot repopulate a map after a
     catalog, order, profile, or user-scoped cache has been invalidated.
280. Sanitize cache expiration values and enforce bounded cache/request map sizes,
     with periodic removal of expired timed entries in browser sessions.
281. Guard positive-integer list normalization against non-array inputs and
     malformed or negative limits before constructing batch request payloads.
282. Normalize non-negative numeric maxima and fallbacks so invalid boundary
     arguments cannot produce negative or non-finite query values.
283. Normalize bounded positive-integer fallbacks and maxima before applying
     pagination, retention, quota, or batch-size limits.
284. Normalize product price ranges through one helper and swap reversed bounds
     before sending public or admin product queries.
285. Validate text length arguments for single-line and multiline normalization,
     keeping phone-number preprocessing within a safe configured bound.
286. Ignore malformed non-array guest checkout item payloads instead of throwing
     while mapping product IDs, quantities, and selected specifications.
287. Make address, category, brand, announcement, and other write payload
     normalizers null-safe when optional form data is absent.
288. Make bug, role, carrier, user, and pet payload normalization tolerate nullish
     fields while preserving existing defaults and enum filtering.
289. Sanitize string-list and image-list limits and element lengths before
     de-duplicating user-provided product metadata.
290. Tolerate a missing product mutation object by normalizing it to an empty
     payload before reading product fields.
291. Reuse the shared price-range normalizer in storefront and admin product
     filters so equivalent requests receive equivalent bounds.
292. Keep order-tracking forced refreshes out of the tracking cache and prevent
     stale completion handlers from deleting a newer tracking request.
293. Avoid review cache sharing for authenticated or explicitly bypassed reads,
     preventing personalized data from entering the public review cache.
294. Route product-question reads through the bounded shared cache helper so
     expiry, request cleanup, bypass behavior, and response-array normalization
     remain consistent.
295. Propagate request options through question writes and clear question cache
     state after the mutation completes.
296. Add cancellation-aware category child/detail reads and request options to
     category lifecycle mutations.
297. Include the explicit `activeOnly` value in public brand request parameters
     and cache keys, while preserving caller-level cancellation behavior.
298. Normalize admin list responses from array, `items`, `records`, and nested
     `data` envelopes before returning data to table consumers.
299. Bound admin category, brand, alert, and IP-blacklist list requests and
     normalize status/source filters, including explicit `false` flags.
300. Thread optional request options through admin mutations, exports, uploads,
     downloads, and operational actions for lifecycle cancellation.
301. Keep forced admin-permission refreshes from overwriting the shared
     permissions cache while allowing ordinary reads to retain their TTL.
302. Bound avatar dimensions, declare intrinsic image size, and use lazy async
     decoding to reduce layout shifts and unnecessary image work.
303. Clamp shared input rows, numeric bounds, and steps and ignore invalid native
     length attributes so malformed form props cannot create unstable controls.

## Optimization Round 304-333

304. Add abort-aware options to storefront product creation requests.
305. Add abort-aware options to storefront product update requests.
306. Add abort-aware options to storefront product deletion requests.
307. Add abort-aware options to logistics-carrier creation requests.
308. Add abort-aware options to logistics-carrier update requests.
309. Add abort-aware options to logistics-carrier deletion requests.
310. Remove the separate public product existence read from product-question
     loading and use the fetch-joined question query as the single read path.
311. Push active-product visibility into the public answered-question query so
     inactive products cannot be serialized by the optimized path.
312. Avoid rereading an address after the owner row is locked during updates;
     retain the owner-scoped update row-count check for concurrent deletion.
313. Avoid rereading an address after the owner row is locked during deletion and
     make an already-removed address an idempotent delete result.
314. Avoid rereading an address after the owner row is locked during default
     selection and use the owner-scoped update result for disappearance checks.
315. Make notification list request cleanup identity-aware so a settled request
     cannot delete a newer request for the same cache key.
316. Centralize short countdown ticks in a one-shot timeout hook with invalid and
     expired-value guards.
317. Route login email-code countdown updates through the bounded timeout hook.
318. Route login verification-retry countdown updates through the bounded timeout
     hook.
319. Route forgot-password code countdown updates through the bounded timeout
     hook.
320. Route registration code countdown updates through the bounded timeout hook.
321. Route profile email-code countdown updates through the bounded timeout hook.
322. Add a shared document-visibility hook for lifecycle-aware browser work.
323. Pause social-proof rotation while the document is hidden.
324. Pause product-detail limited-time ticker work while the document is hidden.
325. Pause seckill countdown work while the document is hidden or has no campaigns.
326. Pause payment-instructions status polling while the document is hidden.
327. Skip customer-support polling ticks while the document is hidden.
328. Skip checkout payment polling ticks while the document is hidden.
329. Abort superseded and disposed admin support-unread requests in addition to
     sequence-checking their responses.
330. Clear pending product-gallery resume timers when the document becomes hidden.
331. Replace order-tracking background intervals with visible-page timeout
     scheduling that waits for each refresh to settle.
332. Replace social-proof rotation intervals with one-shot lifecycle-bound
     timeouts.
333. Replace product-detail and seckill countdown intervals with one-shot
     timeouts, reducing persistent timer wakeups and stale hidden-page work.

## Optimization Round 334-363

334. Add a shared visible-page polling hook that serializes async runs and
     schedules one timeout after each request completes.
335. Route profile payment-state refreshes through visible-page polling.
336. Route payment-instructions status refreshes through visible-page polling.
337. Route admin support-message fallback refreshes through visible-page polling.
338. Route bug-management refreshes through visible-page polling.
339. Route admin support-unread refreshes through visible-page polling.
340. Route customer-support fallback refreshes through visible-page polling.
341. Route product-detail gallery stock-alert refreshes through visible-page
     polling.
342. Replace checkout payment polling intervals with lifecycle-bound visible
     timeout scheduling while retaining cross-tab and Web Lock coordination.
343. Pause reconnecting WebSocket activity when its owning document is hidden.
344. Schedule API cache cleanup at the next expiry instead of waking on a fixed
     cleanup interval.
345. Add a shared animation-frame scheduler that coalesces same-frame callbacks.
346. Coalesce ShopSelect popup positioning work to one animation frame.
347. Coalesce ShopMultiSelect popup positioning work to one animation frame.
348. Coalesce ShopTreeSelect popup positioning work to one animation frame.
349. Coalesce ShopCascader popup positioning work to one animation frame.
350. Coalesce ShopDropdown popup positioning work to one animation frame.
351. Combine pet-gallery user and IP quota reads into one filtered aggregate.
352. Collapse security-audit summary array scans into one reduction.
353. Collapse support summary array scans into one reduction.
354. Collapse brand summary array scans into one reduction.
355. Collapse logistics-carrier summary array scans into one reduction.
356. Collapse IP-blacklist summary array scans into one reduction.
357. Collapse pet-finder summary array scans into one reduction.
358. Collapse product-compare summary array scans into one reduction.
359. Collapse admin-dashboard summary array scans into one reduction.
360. Clear the product-detail gallery fallback refresh timeout after observer
     or scroll preheating has taken over.
361. Consolidate product-list session storage refresh handling into one event
     listener path.
362. Consolidate cart saved-item and guest-cart storage/custom-event refreshes
     into one state handler, including same-tab guest-cart updates.
363. Avoid rewriting the guest checkout draft when its serialized contents are
     unchanged.

## Verification

The final verification record is maintained here after the post-change checks:

- Focused regression: 3 affected suites and 17 tests passed for the Home
  pet-gallery and cart-drawer cancellation batch.
- Focused Checkout regression: 2 suites and 103 tests passed.
- Focused product-detail/cart action lifecycle regression: 2 suites and 83
  tests passed.
- Focused profile-order/cart quantity lifecycle regression: 4 suites and 87
  tests passed.
- Focused profile address, pet, and account lifecycle regression: 3 suites and
  7 tests passed.
- Focused Home and ProductList action lifecycle regression: 2 suites and 5
  tests passed.
- Focused StockAlerts and ProductCompare action lifecycle regression: 2 suites
  and 15 tests passed.
- Focused PetGallery, AlertManagement, and ConfigCenter action lifecycle
    regression: 3 suites and 20 tests passed.
- Focused LogManagement, AnnouncementManagement, and BrandManagement lifecycle
    regression: 3 suites and 13 tests passed.
- Focused InventoryManagement, CategoryManagement, and LogisticsCarrierManagement
    lifecycle regression: 3 suites and 10 tests passed.
- Focused NotificationManagement, ReviewManagement, and TrafficControl lifecycle
    regression: 3 suites and 16 tests passed.
- Focused SupportManagement and CustomerSupportWidget lifecycle regression: 2
  suites and 25 tests passed.
- Focused support API signal regression: 1 suite and 1 test passed.
- Focused public product collection DTO regression: 4 suites and 18 tests passed.
- Focused seckill response assembly regression: 1 suite and 10 tests passed.
- Focused product search/category lookup regression: 1 suite and 19 tests passed.
- Focused cart read/precision and order regression: 3 suites and 30 tests passed.
- Focused address, category-expansion, and announcement-batching regression: 6
  suites and 55 tests passed.
- Focused product-import and bounded reference-data regression: 5 suites and 95
  tests passed.
- Focused admin-review aggregate regression: 2 suites and 15 tests passed.
- Focused legacy featured-product bounded-query regression: 2 suites and 3
  tests passed.
- Focused bounded coupon repository and mapper cleanup regression: 4 suites and
  26 tests passed.
- Focused birthday-coupon keyset batching regression: 2 suites and 3 tests
  passed.
- Focused public category bounded-query regression: 3 suites and 34 tests
  passed.
- Focused admin-role bounded API cleanup regression: 2 suites and 5 tests
  passed.
- Focused seckill repository cleanup regression: 1 suite and 11 tests passed.
- Focused birthday-coupon reissue bounded-query regression: 2 suites and 4
  tests passed.
- Focused dead-repository-query cleanup regression: 7 suites and 108 tests
  passed.
- Focused seckill/review repository cleanup regression: 2 suites and 12 tests
  passed.
- Focused product category repository cleanup regression: 5 suites and 20
  tests passed.
- Focused legacy repository helper cleanup regression: 9 suites and 56 tests
  passed.
- Focused rate-limit path normalization and local token revocation cleanup
  regression: 2 suites and 36 tests passed.
- Focused service-layer regression: 6 suites and 70 tests passed across guest
  access rate limiting, product questions, reviews, coupons, site announcements,
  and pet gallery search.
- Focused H2 repository integration regression: 4 suites and 5 tests passed,
  covering the escaped JPQL search queries.
- Focused support-session mapper and service regression: 9 suites and 49 tests
  passed, including H2/MyBatis execution of session-scoped unread counts.
- Focused admin-summary aggregate regression: 15 suites and 92 tests passed,
  covering product questions, site announcements, coupons, security audit logs,
  system alerts, and pet-gallery summaries, including H2 execution of the new
  pet-gallery aggregate query.
- Focused pet-gallery viewer-like batching regression: 2 suites and 17 tests
  passed, covering both public list overloads and H2 execution of the batch
  photo-id query.
- Focused category hierarchy validation regression: 1 suite and 15 tests
  passed, including the single-traversal save path.
- Focused birthday-grant batching regression: 4 suites and 11 tests passed,
  covering per-user cap accounting, mapper execution, and schema/index
  contracts.
- Focused coupon-grant ownership batching regression: 5 suites and 33 tests
  passed, covering grant race behavior, mapper execution, and schema/index
  contracts.
- Focused admin-role regression: 1 suite and 4 tests passed, covering bounded
  role lookup, permission seeding, joined role normalization, and user demotion.
- Focused product data-quality batching regression: 1 suite and 1 test passed,
  covering the startup variant-image repair write path.
- Focused pet-gallery seed batching regression: 2 suites and 2 tests passed,
  covering service reconciliation and H2 image-URL lookup execution.
- Focused IP-blacklist status regression: 1 suite and 1 test passed, covering
  one aggregate count query and case-insensitive result aliases.
- Focused admin-role permission reconciliation regression: the AdminRole suite
  passed with 4 tests, covering bounded lookup, per-role and all-role batch
  seeding, joined role normalization, and user demotion.
- Focused order-summary and stock-restoration regression: 4 suites and 18 tests
  passed, covering reuse of the existing missing-tracking aggregate and
  multi-product variant stock restoration with one lock query.
- Focused coupon-seed startup contract regression: 1 suite and 1 test passed,
  covering batch seed insertion and one schema-column metadata read.
- Focused dashboard aggregate/controller regression: 4 suites and 25 tests
  passed, covering the refunding-payment aggregate field, dashboard response,
  redundant-summary-query removal, H2 execution, and mapper SLA contracts.
- Focused public-review visibility regression: 2 suites and 17 tests passed,
  covering service query delegation and H2 execution for active/inactive
  products.
- Focused product-import batching regression: 1 suite and 64 tests passed,
  covering batched existing-product lookup alongside the complete row-level
  validation and save workflow.
- Focused category-path lookup regression: 1 suite and 15 tests passed,
  covering parent reuse during save and existing hierarchy validation.
- Focused wishlist/address write regression: 5 suites and 25 tests passed,
  covering direct mutation-state responses, duplicate wishlist protection, and
  generated-key address responses without post-insert reads.
- Additional full backend check: 1,230 tests ran with 25 existing failures and
  no errors in unrelated dirty-worktree frontend, contract, and coverage
  expectations; the five suites above remained green.
- Full frontend Jest: 249 suites and 1811/1811 tests passed.
- TypeScript: `NODE_OPTIONS=--max-old-space-size=768 npx tsc --noEmit --pretty false --skipLibCheck` passed.
- Production: bounded production build passed (`npm run build`, exit code 0).
- Focused frontend cache, API, and shared-input regression: 5 suites and 141
  tests passed after the 274-303 changes.
- TypeScript: bounded `tsc --project frontend/tsconfig.json --noEmit
  --pretty false --skipLibCheck` passed with the build's 768 MB Node heap mode.
- Production: bounded final production build passed (`npm run build`, exit code
  0) after the type-safety fixes.
- Final focused frontend lifecycle regression: 5 suites and 75 tests passed for
  Checkout, AdminLayout, SocialProofToast, countdown, and document visibility.
- TypeScript: bounded frontend `npx tsc --noEmit --pretty false --skipLibCheck`
  passed with `NODE_OPTIONS=--max-old-space-size=768`.
- Production: bounded frontend `npm run build` passed (exit code 0) after the
  final Checkout contract assertion update.
- Final focused frontend lifecycle regression: 26 suites and 332 tests passed
  across the visible polling, timeout scheduling, WebSocket lifecycle, cache,
  animation-frame, aggregate-scan, gallery, cart, and checkout changes.
- PetGallery H2 repository and service regression passed.
- TypeScript: bounded `env NODE_OPTIONS=--max-old-space-size=768 npx tsc
  --noEmit --pretty false --skipLibCheck` passed.
- Production: bounded frontend `npm run build` passed (exit code 0).
- `git diff --check` passed, with no Jest, build, or bounded-runner processes
  left behind.

All tests and builds are run through `scripts/run-bounded-task.sh` in
accordance with the repository resource-safety instructions.

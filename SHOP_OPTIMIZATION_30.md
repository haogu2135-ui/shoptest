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

## Verification

The final verification record is maintained here after the post-change checks:

- Focused regression: 4 affected suites and 205 tests passed after the final
  request-option assertion updates.
- Full frontend Jest: 242 suites and 1739/1739 tests passed.
- TypeScript: `NODE_OPTIONS=--max-old-space-size=768 npx tsc --noEmit --pretty false --skipLibCheck` passed.
- Production: bounded production build passed (`npm run build`, exit code 0).

All tests and builds are run through `scripts/run-bounded-task.sh` in
accordance with the repository resource-safety instructions.

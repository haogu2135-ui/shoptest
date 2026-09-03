# Shop Optimization Round: 30 Completed Items

This round focuses on storefront and shared UI infrastructure. Each item has
an implementation change and a regression guard in the same area.

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

## Verification

Verification completed at three levels:

- Focused regression: 14 suites and 61 tests passed, followed by a final
  Tabs/Checkbox/cache pass of 3 suites and 12 tests.
- Full frontend Jest: 242 suites and 1695 of 1696 tests passed before the
  final two small Tabs assertions were added; the stale cache source assertion
  was then updated and `src/api/index.test.ts` passed 103/103 independently.
- TypeScript: `tsc --noEmit --pretty false --skipLibCheck` passed.
- Production: `safe-commercial-build.sh` compiled successfully in low-memory
  mode and cleaned its staging directory.

The focused regression command was:

```text
CI=true node node_modules/react-scripts/bin/react-scripts.js test --runInBand
```

It was run from `frontend/` through `scripts/run-bounded-task.sh` with the
focused test-path pattern covering cache, controls, image previews, focus
traps, debounce, media utilities, and reconnecting WebSockets.

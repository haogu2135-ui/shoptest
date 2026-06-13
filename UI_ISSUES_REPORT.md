# UI Issues Report

## 2026-05-29 21:35 UTC - Local Fix Pass

Context: the original `UI_ISSUES_REPORT.md` was not present after session migration, so this file records the recovered issue list and the fixes applied in this pass. Per instruction, no commit was made and no test/build/compile run was executed.

### Fixed

- `BUG-01` Customer support TS event narrowing: tightened support open event detection in `CustomerSupportWidget.tsx` so plain request objects and browser `CustomEvent` payloads are handled separately without unsafe union property access.
- `BUG-02` Pet Finder duplicate top error toasts: replaced initial recommendation load toast with an inline warning alert.
- `BUG-03` Pet Gallery top error toast: replaced initial gallery load toast with an inline warning alert.
- `BUG-04` Coupons top error toast: replaced initial coupon load toast with an inline warning alert.
- `BUG-05` Mobile category navigation truncation: mobile category chips now stay horizontally scrollable instead of being forced into clipped labels.
- `BUG-06` Login mobile subtitle/badge truncation: mobile auth copy now wraps naturally instead of using clipped two-line truncation in the reported areas.
- `BUG-07` Register desktop hero/form overlap: desktop registration grid now uses stable column sizing, gap, and panel bounds.
- `BUG-08` Mobile products fallback banner compression: product-list hero and mobile next-step banners now collapse to one column with full-width actions on narrow screens.
- `BUG-09` Cart tablet empty-state excessive whitespace: tablet/mobile empty cart padding and hero height were reduced.
- `BUG-10` Forgot-password toast/inline warning spacing: reset-page warning/sent-code blocks now have consistent vertical spacing.
- `BUG-11` Forgot-password desktop vertical centering: reset page now uses a centered desktop layout with constrained card width.
- `BUG-12` Track-order desktop too narrow/empty: tracking page width increased on desktop and key sections use wider two-column tracks.
- `BUG-13` Pet Finder mobile price slider label overflow: budget value labels can wrap and slider spacing has mobile breathing room.
- `BUG-14` Floating support button overlaps mobile bottom nav: launcher/widget button now sits above the bottom nav and page CTAs using the shared mobile bottom-nav clearance.
- `BUG-15` Coupons mobile content too dense: mobile coupons page spacing, sticky action bar clearance, rails, and card padding were loosened.

### Verification

- Ran `git diff --check` on touched files: passed.
- Did not run Playwright, unit tests, dev server, build, or compile per instruction.

### External Issue Files

- `TEST_ISSUES.md`, `E2E_TEST_REPORT.md`, and `QA_ISSUES.md` were not present in this migrated workspace at the time of this pass, so there was no new external tester entry to classify.

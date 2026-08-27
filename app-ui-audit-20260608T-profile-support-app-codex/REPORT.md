# Mobile App Profile and Support UI Audit

Date: 2026-08-27T07:21:15.740Z
Base URL: `http://127.0.0.1:4200`
Mode: Playwright, mocked APIs, Android App WebView simulation.

## Coverage

- Viewports: `320x568`, `390x844`.
- States: profile address modal/cascader, profile pet modal/type select/birthday picker/size select, support widget open, support order select, support order detail modal.
- Mock scope: authenticated customer profile, addresses, pets, orders, support sessions/messages, order detail, nav counters.
- Evidence: `report.json` plus viewport screenshots in this directory.
- Console warnings/errors: 0; network failures: 0; run errors: 1.

## Automated Findings

- No new profile/support App UI findings were promoted by the hit-test checks.

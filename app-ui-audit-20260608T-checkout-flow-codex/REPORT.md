# Mobile App Checkout Flow UI Audit

Date: 2026-06-12T18:11:52.670Z
Base URL: `http://127.0.0.1:4200`
Mode: Playwright, mocked APIs, Android App WebView simulation.

## Coverage

- Viewports: `320x568`, `390x844`.
- States: guest checkout loaded, address card, address cascader open, filled payment section, submit-ready trial, validation errors.
- Evidence: `report.json` plus viewport screenshots in this directory.
- Console warnings/errors: 92; network failures: 0.

## Automated Findings

- No new checkout flow UI findings were promoted by the geometry checks.

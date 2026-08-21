# Mobile App Auth and Order Tracking UI Audit

Date: 2026-08-21T09:15:16.433Z
Base URL: `http://127.0.0.1:4200`
Mode: Playwright, mocked APIs, Android App WebView simulation.

## Coverage

- Viewports: `320x568`, `390x844`.
- States: login password initial/validation/server error, login email initial/validation/code sent, register initial/validation/email-code-required, forgot password initial/validation/code sent, order tracking initial/validation/result/next action/return modal/logistics widget.
- Mock scope: app config, auth endpoints, password reset endpoints, order tracking, logistics tracking, nav count endpoints.
- Evidence: `report.json` plus viewport screenshots in this directory.
- Console warnings/errors: 2; network failures: 0; run errors: 0.

## Automated Findings

- No new auth/order UI findings were promoted by the geometry checks.

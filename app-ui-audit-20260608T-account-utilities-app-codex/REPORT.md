# Mobile App Account Utilities UI Audit

Date: 2026-08-27T07:03:50.340Z
Base URL: `http://127.0.0.1:4200`
Mode: Playwright, mocked APIs/local storage, Android App WebView simulation.

## Coverage

- Viewports: 320x568 and 390x844.
- Pages: `/notifications`, `/stock-alerts`, `/history`, `/payment/:orderNo`.
- States: page top, destructive Popconfirm where present, page bottom, payment verified pending state.

## Summary

- Snapshots: 11
- Issues: 0
- Console warnings/errors: 0
- Network failures: 0
- Run errors: 0

## Issue Groups

- None.

## Screenshots

### phone-390-app (390x844)
- notifications-top: `phone-390-app-notifications-top.png`
- notifications-delete-popconfirm: `phone-390-app-notifications-delete-popconfirm.png`
- notifications-bottom: `phone-390-app-notifications-bottom.png`
- stock-alerts-top: `phone-390-app-stock-alerts-top.png`
- stock-alerts-remove-popconfirm: `phone-390-app-stock-alerts-remove-popconfirm.png`
- stock-alerts-bottom: `phone-390-app-stock-alerts-bottom.png`
- history-top: `phone-390-app-history-top.png`
- history-remove-popconfirm: `phone-390-app-history-remove-popconfirm.png`
- history-bottom: `phone-390-app-history-bottom.png`
- payment-instructions-top: `phone-390-app-payment-instructions-top.png`
- payment-instructions-bottom: `phone-390-app-payment-instructions-bottom.png`


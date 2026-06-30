# ShopMX Appium UI Tests

Automated UI tests for the ShopMX Android app using Appium + WebDriverIO.

## Prerequisites

- Node.js 18+
- Android SDK (installed at `/opt/android-sdk`)
- ADB available in PATH
- Android emulator running OR physical device connected

## Setup

```bash
cd /home/guhao/shoptest/mobile-tests/appium
npm install
npx appium driver install uiautomator2
```

## Running Tests

### With emulator running:
```bash
export ANDROID_HOME=/opt/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
export APPIUM_WEBVIEW_BASE_URL=https://pet.686888666.xyz
export APPIUM_TEST_EMAIL=seeded-customer@example.com
export APPIUM_TEST_PASSWORD='seeded-password'
export APPIUM_TRACK_ORDER_NO=ORDER-NUMBER-FOR-SEEDED-CUSTOMER
export APPIUM_TRACK_ORDER_EMAIL=$APPIUM_TEST_EMAIL
npm test
```

### With connected physical device:
```bash
export APPIUM_DEVICE_NAME="Your Device Name"
export APPIUM_WEBVIEW_BASE_URL=https://pet.686888666.xyz
export APPIUM_TEST_EMAIL=seeded-customer@example.com
export APPIUM_TEST_PASSWORD='seeded-password'
export APPIUM_TRACK_ORDER_NO=ORDER-NUMBER-FOR-SEEDED-CUSTOMER
export APPIUM_TRACK_ORDER_EMAIL=$APPIUM_TEST_EMAIL
npm test
```

The critical customer-flow suite can run a storefront smoke without seeded data, but authenticated login, latest-order support sharing, and guest order tracking are skipped unless the matching variables above are set. Use an account with order history when validating customer support order attachment.

## Test Structure

- `test/specs/app-launch.test.js` - App launch and initialization
- `test/specs/webview.test.js` - WebView content loading
- `test/specs/navigation.test.js` - Page navigation
- `test/specs/mobile-critical-flows.test.js` - WebView storefront, login recovery, cart/checkout entry, order tracking, support composer, keyboard viewport, and authenticated latest-order support coverage

## Configuration

Edit `config/wdio.conf.js` to change:
- Device name
- APK path
- Timeouts
- Appium server settings

Useful environment overrides:
- `APPIUM_APK_PATH`: install a specific APK; otherwise the versioned APK in `frontend/public/downloads/mobile-version.json` is used and checked against the manifest `sizeBytes` and `sha256` before Appium starts.
- `APPIUM_WEBVIEW_BASE_URL`: WebView origin for navigation tests; use a device-reachable staging/production URL.
- `APPIUM_NO_RESET=true`: opt into preserving app data. The default is a clean session.
- `APPIUM_TEST_EMAIL` / `APPIUM_TEST_PASSWORD`: seeded customer credentials for authenticated WebView flows.
- `APPIUM_TRACK_ORDER_NO` / `APPIUM_TRACK_ORDER_EMAIL`: seeded guest order lookup data for `/track-order`; email falls back to `APPIUM_TEST_EMAIL` when omitted.

The launch suite also checks the version installed on the device with `dumpsys package com.shoptest.mobile` and compares `versionName` / `versionCode` with `frontend/public/downloads/mobile-version.json`. This requires the Appium service `relaxedSecurity` setting kept in `config/wdio.conf.js`; a mismatch means the tested APK is not the public download build declared by the manifest.

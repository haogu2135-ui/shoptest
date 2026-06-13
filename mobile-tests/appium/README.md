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
npm test
```

### With connected physical device:
```bash
export APPIUM_DEVICE_NAME="Your Device Name"
npm test
```

## Test Structure

- `test/specs/app-launch.test.js` - App launch and initialization
- `test/specs/webview.test.js` - WebView content loading
- `test/specs/navigation.test.js` - Page navigation

## Configuration

Edit `config/wdio.conf.js` to change:
- Device name
- APK path
- Timeouts
- Appium server settings

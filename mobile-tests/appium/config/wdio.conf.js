const path = require('path');

const DEFAULT_ANDROID_SDK_ROOT = '/opt/android-sdk';
const androidSdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || DEFAULT_ANDROID_SDK_ROOT;
process.env.ANDROID_SDK_ROOT = androidSdkRoot;
process.env.ANDROID_HOME = process.env.ANDROID_HOME || androidSdkRoot;
process.env.PATH = [
  path.join(androidSdkRoot, 'platform-tools'),
  path.join(androidSdkRoot, 'cmdline-tools/latest/bin'),
  path.join(androidSdkRoot, 'emulator'),
  process.env.PATH || '',
].filter(Boolean).join(path.delimiter);

const APK_PATH = path.resolve(
  __dirname,
  '../../../frontend/public/downloads/shoptest.apk'
);

exports.config = {
  // Appium connection
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',

  // Test config
  specs: [path.resolve(__dirname, '../test/specs/**/*.js')],
  maxInstances: 1,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': process.env.APPIUM_AUTOMATION_NAME || 'UiAutomator2',
      'appium:deviceName': process.env.APPIUM_DEVICE_NAME || 'Android Emulator',
      'appium:app': APK_PATH,
      'appium:appPackage': 'com.shoptest.mobile',
      'appium:appActivity': 'com.shoptest.mobile.MainActivity',
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
      'appium:autoGrantPermissions': true,
    },
  ],

  // Framework
  framework: 'mocha',
  reporters: ['spec'],

  // Appium service - auto-start Appium server
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          relaxedSecurity: true,
          log: './logs/appium.log',
        },
      },
    ],
  ],

  // Mocha config
  mochaOpts: {
    timeout: 60000,
  },

  // Hooks
  before: async function () {
    // Set implicit wait
    await browser.setTimeout({ implicit: 10000 });
  },

  onComplete: function () {
    console.log('Appium tests completed.');
  },
};

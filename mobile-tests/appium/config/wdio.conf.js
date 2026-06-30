const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

const downloadsDir = path.resolve(__dirname, '../../../frontend/public/downloads');
const versionManifestPath = path.join(downloadsDir, 'mobile-version.json');
const readVersionManifest = () => {
  try {
    return JSON.parse(fs.readFileSync(versionManifestPath, 'utf8'));
  } catch (error) {
    return null;
  }
};
const getVersionedApkPath = (manifest) => {
  const fileName = path.basename(String(manifest && (manifest.fileName || manifest.apkUrl) || ''));
  return fileName ? path.join(downloadsDir, fileName) : null;
};
const sha256File = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const resolveApkPath = () => {
  if (process.env.APPIUM_APK_PATH) {
    const overridePath = path.resolve(process.env.APPIUM_APK_PATH);
    if (!fs.existsSync(overridePath)) {
      throw new Error(`APPIUM_APK_PATH does not exist: ${overridePath}`);
    }
    return overridePath;
  }

  const manifest = readVersionManifest();
  const apkPath = path.resolve(getVersionedApkPath(manifest) || path.join(downloadsDir, 'shoptest.apk'));
  if (!fs.existsSync(apkPath)) {
    throw new Error(`Manifest APK does not exist: ${apkPath}`);
  }

  if (manifest && Number.isFinite(Number(manifest.sizeBytes))) {
    const actualSize = fs.statSync(apkPath).size;
    if (actualSize !== Number(manifest.sizeBytes)) {
      throw new Error(`Manifest APK size mismatch for ${apkPath}: expected ${manifest.sizeBytes}, got ${actualSize}`);
    }
  }

  if (manifest && manifest.sha256) {
    const actualSha = sha256File(apkPath);
    if (actualSha.toLowerCase() !== String(manifest.sha256).toLowerCase()) {
      throw new Error(`Manifest APK sha256 mismatch for ${apkPath}: expected ${manifest.sha256}, got ${actualSha}`);
    }
  }

  return apkPath;
};
const APK_PATH = resolveApkPath();
const NO_RESET = String(process.env.APPIUM_NO_RESET || 'false').toLowerCase() === 'true';

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
      'appium:noReset': NO_RESET,
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

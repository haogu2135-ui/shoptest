const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const APP_PACKAGE = 'com.shoptest.mobile';
const VERSION_MANIFEST_PATH = path.resolve(__dirname, '../../../../frontend/public/downloads/mobile-version.json');

const readVersionManifest = () => JSON.parse(fs.readFileSync(VERSION_MANIFEST_PATH, 'utf8'));
const parsePackageInfo = (output) => {
  const text = String(output || '');
  const versionName = text.match(/\bversionName=([^\s]+)/)?.[1];
  const versionCode = text.match(/\bversionCode=(\d+)/)?.[1];
  return {
    versionName,
    versionCode: versionCode ? Number(versionCode) : undefined,
  };
};

describe('ShopMX App Launch', () => {
  it('should launch the app successfully', async () => {
    // Wait for the WebView to load
    const contexts = await browser.getContexts();
    console.log('Available contexts:', contexts);

    // The app should have at least one context (native)
    expect(contexts).to.be.an('array');
    expect(contexts.length).to.be.greaterThan(0);
  });

  it('should display the app package name', async () => {
    const appPackage = await browser.getCurrentPackage();
    expect(appPackage).to.equal(APP_PACKAGE);
  });

  it('should have the main activity visible', async () => {
    const activity = await browser.getCurrentActivity();
    expect(activity).to.include('MainActivity');
  });

  it('should install the version declared by the public mobile manifest', async () => {
    const manifest = readVersionManifest();
    expect(manifest.appId).to.equal(APP_PACKAGE);
    expect(manifest.versionName).to.be.a('string').and.not.equal('');
    expect(Number(manifest.versionCode)).to.be.greaterThan(0);

    const packageDump = await browser.execute('mobile: shell', {
      command: 'dumpsys',
      args: ['package', APP_PACKAGE],
      includeStderr: true,
      timeout: 10000,
    });
    const packageInfo = parsePackageInfo(packageDump.stdout || packageDump);

    expect(packageInfo.versionName).to.equal(manifest.versionName);
    expect(packageInfo.versionCode).to.equal(Number(manifest.versionCode));
  });
});

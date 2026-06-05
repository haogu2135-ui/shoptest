import {
  currentNativeMobilePlatform,
  currentMobileVersionCode,
  currentMobileVersionName,
  isNativeAndroidApp,
  isNativeMobileApp,
  isMobileReleaseDownloadAllowed,
  resolveMobileManifestUrl,
  resolveMobileAssetUrl,
  resolveMobileReleaseDownloadUrl,
} from './mobileUpdate';

describe('mobileUpdate release download gate', () => {
  afterEach(() => {
    delete window.__SHOP_RUNTIME_CONFIG__;
    delete window.Capacitor;
  });

  const signedRelease = {
    platform: 'android',
    appId: 'com.shoptest.mobile',
    versionCode: 10024,
    apkUrl: '/downloads/shoptest-1.0.24.apk',
    releaseSigned: true,
    certificateSha256: 'B'.repeat(64),
    fileName: 'shoptest-1.0.24.apk',
    sizeBytes: 123456,
    sha256: 'a'.repeat(64),
    manifestUrl: 'https://pet.686888666.xyz/downloads/mobile-version.json',
  };

  it('does not fall back to the stable public APK path for empty asset URLs', () => {
    expect(resolveMobileAssetUrl('')).toBe('');
    expect(resolveMobileAssetUrl(null)).toBe('');
  });

  it('blocks unsigned releases even when stale APK URLs remain in a manifest', () => {
    const unsignedRelease = {
      ...signedRelease,
      releaseSigned: false,
      certificateSha256: '',
    };

    expect(isMobileReleaseDownloadAllowed(unsignedRelease)).toBe(false);
    expect(resolveMobileReleaseDownloadUrl(unsignedRelease)).toBe('');
  });

  it('resolves release downloads only when signing and artifact metadata are explicit', () => {
    expect(isMobileReleaseDownloadAllowed(signedRelease)).toBe(true);
    expect(resolveMobileReleaseDownloadUrl(signedRelease)).toBe(
      'https://pet.686888666.xyz/downloads/shoptest-1.0.24.apk',
    );
  });

  it('uses normalized runtime version metadata for native update comparisons', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      mobileCurrentVersionName: '1.0.23',
      mobileCurrentVersionCode: 10023,
    };

    expect(currentMobileVersionCode()).toBe(10023);
    expect(currentMobileVersionName()).toBe('1.0.23');

    window.__SHOP_RUNTIME_CONFIG__ = {
      mobileCurrentVersionName: '',
      mobileCurrentVersionCode: -1,
    };

    expect(currentMobileVersionCode()).toBe(10023);
    expect(currentMobileVersionName()).toBe('1.0.23');
  });

  it('resolves Android native update checks through the configured API origin', () => {
    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
    };
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'https://pet.686888666.xyz/api',
      mobileVersionManifestUrl: '/downloads/mobile-version.json',
    };

    expect(resolveMobileManifestUrl()).toBe('https://pet.686888666.xyz/downloads/mobile-version.json');
  });

  it('keeps Android APK update handling out of iOS native shells', () => {
    window.Capacitor = {
      getPlatform: () => 'ios',
      isNativePlatform: () => true,
    };

    expect(isNativeMobileApp()).toBe(true);
    expect(currentNativeMobilePlatform()).toBe('ios');
    expect(isNativeAndroidApp()).toBe(false);

    window.Capacitor = {
      getPlatform: () => 'android',
      isNativePlatform: () => true,
    };

    expect(isNativeMobileApp()).toBe(true);
    expect(currentNativeMobilePlatform()).toBe('android');
    expect(isNativeAndroidApp()).toBe(true);
  });
});

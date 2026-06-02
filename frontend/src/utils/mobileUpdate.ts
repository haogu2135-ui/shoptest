import { CURRENT_MOBILE_RELEASE } from '../generated/mobileRelease';
import { resolveApiBaseUrl } from './runtimeConfig';

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
      Plugins?: {
        App?: {
          addListener?: (
            eventName: 'backButton',
            listener: (event?: { canGoBack?: boolean }) => void,
          ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
          minimizeApp?: () => Promise<void>;
          exitApp?: () => Promise<void>;
        };
        Browser?: {
          open?: (options: { url: string }) => Promise<void>;
        };
      };
    };
  }
}

export type MobileReleaseManifest = {
  platform?: string;
  appId?: string;
  appName?: string;
  versionName?: string;
  versionCode?: number;
  minSupportedVersionCode?: number;
  mandatory?: boolean;
  apkUrl?: string;
  legacyApkUrl?: string;
  releaseSigned?: boolean;
  certificateSha256?: string;
  fileName?: string;
  sizeBytes?: number;
  sha256?: string;
  releaseNotes?: readonly string[];
  generatedAt?: string;
  manifestUrl?: string;
};

const DEFAULT_ANDROID_APK_URL = '/downloads/shoptest.apk';
const DEFAULT_MOBILE_VERSION_MANIFEST_URL = '/downloads/mobile-version.json';
const DEFAULT_MOBILE_APP_ID = 'com.shoptest.mobile';
const EXPECTED_MOBILE_PLATFORM = 'android';
const MOBILE_VERSION_FETCH_TIMEOUT_MS = 7000;
const ANDROID_DEBUG_CERT_SHA256 = 'A59C1DF808784AF870705AC1FB13B0A12E5099AB3D140A26052A885AD66687F1';
const LOCAL_HTTP_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const isBrowser = () => typeof window !== 'undefined';

const cleanString = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return Array.from(String(value), (char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : char;
  }).join('').trim();
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const hasUnsafeUrlCharacter = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

const normalizeMobileUrlValue = (value: unknown) => {
  const rawValue = String(value ?? '');
  if (hasUnsafeUrlCharacter(rawValue)) return null;
  const cleanValue = cleanString(rawValue);
  const normalizedValue = cleanValue.toLowerCase();
  if (
    cleanValue.startsWith('//')
    || cleanValue.includes('\\')
    || normalizedValue.includes('%00')
    || normalizedValue.includes('%5c')
  ) {
    return null;
  }
  return cleanValue;
};

const isLocalHttpHostname = (hostname: string) =>
  LOCAL_HTTP_HOSTNAMES.has(hostname.toLowerCase()) || hostname.toLowerCase().endsWith('.localhost');

const parseSafeMobileHttpUrl = (value: unknown, base?: string) => {
  const cleanValue = normalizeMobileUrlValue(value);
  if (!cleanValue) return null;

  try {
    const parsed = base ? new URL(cleanValue, base) : new URL(cleanValue);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === 'https:') return parsed;
    if (parsed.protocol === 'http:' && isLocalHttpHostname(parsed.hostname)) return parsed;
    return null;
  } catch {
    return null;
  }
};

const normalizeSafeMobileHttpUrl = (value: unknown, base?: string) =>
  parseSafeMobileHttpUrl(value, base)?.toString() || '';

const hasSafeMobileAssetUrlShape = (value: unknown) => {
  const normalizedValue = normalizeMobileUrlValue(value);
  if (!normalizedValue) return false;
  if (isHttpUrl(normalizedValue)) return Boolean(normalizeSafeMobileHttpUrl(normalizedValue));
  if (normalizedValue.startsWith('/') && !normalizedValue.startsWith('//')) return true;
  return !normalizedValue.includes(':') && /^[A-Za-z0-9._~/?=&%-]+$/.test(normalizedValue);
};

const withAndroidApkCacheBust = (apkUrl: string, version: unknown) => {
  const cleanVersion = cleanString(version);
  if (!cleanVersion || apkUrl.includes('?')) return apkUrl;
  return `${apkUrl}?v=${encodeURIComponent(cleanVersion)}`;
};

const httpOriginFrom = (value: string) => parseSafeMobileHttpUrl(
  value,
  isBrowser() && window.location.protocol.startsWith('http') ? window.location.origin : undefined,
)?.origin || '';

const normalizeVersionCode = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizePositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeApkFileName = (value: unknown) => {
  const fileName = cleanString(value);
  if (!/^[A-Za-z0-9._-]+\.apk$/.test(fileName) || fileName.includes('..')) return '';
  return fileName;
};

const normalizeApkSha256 = (value: unknown) =>
  cleanString(value).replace(/[^a-f0-9]/gi, '').toLowerCase();

const normalizeCertificateFingerprint = (value: unknown) =>
  cleanString(value).replace(/[^a-f0-9]/gi, '').toUpperCase();

const isValidReleaseCertificateFingerprint = (value: unknown) => {
  const certificateSha256 = normalizeCertificateFingerprint(value);
  return /^[A-F0-9]{64}$/.test(certificateSha256) && certificateSha256 !== ANDROID_DEBUG_CERT_SHA256;
};

const hasExplicitReleaseArtifactMetadata = (release: MobileReleaseManifest) => (
  hasSafeMobileAssetUrlShape(release.apkUrl)
  && Boolean(normalizeApkFileName(release.fileName))
  && normalizePositiveInteger(release.sizeBytes) !== null
  && /^[a-f0-9]{64}$/.test(normalizeApkSha256(release.sha256))
);

export const currentMobileRelease = CURRENT_MOBILE_RELEASE;

export const currentMobileVersionCode = () => {
  const runtimeVersionCode = isBrowser()
    ? normalizeVersionCode(window.__SHOP_RUNTIME_CONFIG__?.mobileCurrentVersionCode)
    : null;
  return runtimeVersionCode || CURRENT_MOBILE_RELEASE.versionCode;
};

export const currentMobileVersionName = () => {
  const runtimeVersionName = isBrowser()
    ? cleanString(window.__SHOP_RUNTIME_CONFIG__?.mobileCurrentVersionName)
    : '';
  return runtimeVersionName || CURRENT_MOBILE_RELEASE.versionName || String(currentMobileVersionCode());
};

export const isNativeMobileApp = () => {
  if (!isBrowser()) return false;
  const capacitor = window.Capacitor;
  const platform = capacitor?.getPlatform?.();
  return capacitor?.isNativePlatform?.() === true
    || platform === 'android'
    || platform === 'ios'
    || window.location.protocol === 'capacitor:';
};

export const resolveMobileManifestUrl = () => {
  const configured = normalizeMobileUrlValue(
    isBrowser() ? window.__SHOP_RUNTIME_CONFIG__?.mobileVersionManifestUrl : '',
  ) || '';
  if (configured) {
    if (isHttpUrl(configured)) {
      const safeConfiguredUrl = normalizeSafeMobileHttpUrl(configured);
      if (safeConfiguredUrl) return safeConfiguredUrl;
    }
    if (configured.startsWith('/') && !configured.startsWith('//')) {
      if (isNativeMobileApp()) {
        const apiOrigin = httpOriginFrom(resolveApiBaseUrl());
        return apiOrigin ? `${apiOrigin}${configured}` : configured;
      }
      return configured;
    }
  }

  if (isNativeMobileApp()) {
    const apiOrigin = httpOriginFrom(resolveApiBaseUrl());
    if (apiOrigin) return `${apiOrigin}${DEFAULT_MOBILE_VERSION_MANIFEST_URL}`;
  }
  return DEFAULT_MOBILE_VERSION_MANIFEST_URL;
};

export const resolveMobileAssetUrl = (assetUrl: unknown, manifestUrl = resolveMobileManifestUrl()) => {
  const normalizedAssetUrl = normalizeMobileUrlValue(assetUrl);
  if (normalizedAssetUrl === null) return '';
  const value = normalizedAssetUrl || DEFAULT_ANDROID_APK_URL;
  if (isHttpUrl(value)) return normalizeSafeMobileHttpUrl(value);

  if (value.startsWith('/') && !value.startsWith('//')) {
    const manifestOrigin = httpOriginFrom(manifestUrl);
    if (manifestOrigin) return `${manifestOrigin}${value}`;
    const browserOrigin = isBrowser() && window.location.protocol.startsWith('http')
      ? httpOriginFrom(window.location.origin)
      : '';
    if (browserOrigin) return `${browserOrigin}${value}`;
    const apiOrigin = httpOriginFrom(resolveApiBaseUrl());
    return apiOrigin ? `${apiOrigin}${value}` : value;
  }

  const manifestRelativeUrl = normalizeSafeMobileHttpUrl(value, manifestUrl);
  if (manifestRelativeUrl) return manifestRelativeUrl;
  if (isBrowser() && window.location.protocol.startsWith('http')) {
    const browserRelativeUrl = normalizeSafeMobileHttpUrl(value, window.location.origin);
    if (browserRelativeUrl) return browserRelativeUrl;
  }
  return normalizeSafeMobileHttpUrl(value, resolveApiBaseUrl());
};

export const isMobileReleaseDownloadAllowed = (release?: MobileReleaseManifest | null) => {
  if (!release) return false;
  return release.releaseSigned === true
    && isValidReleaseCertificateFingerprint(release.certificateSha256)
    && hasExplicitReleaseArtifactMetadata(release);
};

export const resolveMobileReleaseDownloadUrl = (release?: MobileReleaseManifest | null) => {
  if (!isMobileReleaseDownloadAllowed(release)) return '';
  const apkUrl = cleanString(release?.apkUrl);
  return apkUrl ? resolveMobileAssetUrl(apkUrl, release?.manifestUrl) : '';
};

const normalizeReleaseManifest = (value: unknown, manifestUrl: string): MobileReleaseManifest | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const versionCode = normalizeVersionCode(source.versionCode);
  if (!versionCode) return null;
  const platform = (cleanString(source.platform) || EXPECTED_MOBILE_PLATFORM).toLowerCase();
  if (platform !== EXPECTED_MOBILE_PLATFORM) return null;
  const appId = cleanString(source.appId);
  const expectedAppId = cleanString(CURRENT_MOBILE_RELEASE.appId) || DEFAULT_MOBILE_APP_ID;
  if (appId !== expectedAppId) return null;
  const versionName = cleanString(source.versionName);
  const versionIdentity = versionName || versionCode;
  const legacyApkUrl = cleanString(source.legacyApkUrl)
    ? withAndroidApkCacheBust(cleanString(source.legacyApkUrl), versionIdentity)
    : '';
  const apkUrl = cleanString(source.apkUrl);
  const fileName = normalizeApkFileName(source.fileName);
  const sizeBytes = normalizePositiveInteger(source.sizeBytes);
  const sha256 = normalizeApkSha256(source.sha256);
  return {
    platform,
    appId,
    appName: cleanString(source.appName),
    versionName,
    versionCode,
    minSupportedVersionCode: normalizeVersionCode(source.minSupportedVersionCode) || 0,
    mandatory: source.mandatory === true,
    apkUrl,
    legacyApkUrl,
    releaseSigned: source.releaseSigned === true,
    certificateSha256: cleanString(source.certificateSha256),
    fileName,
    sizeBytes: sizeBytes || undefined,
    sha256,
    releaseNotes: Array.isArray(source.releaseNotes)
      ? source.releaseNotes.map(cleanString).filter(Boolean).slice(0, 6)
      : [],
    generatedAt: cleanString(source.generatedAt),
    manifestUrl,
  };
};

export const fetchLatestMobileRelease = async () => {
  const manifestUrl = resolveMobileManifestUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), MOBILE_VERSION_FETCH_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    return normalizeReleaseManifest(await response.json(), manifestUrl);
  } catch {
    return null;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const openMobileReleaseDownloadFallback = (url: string) => {
  if (!isBrowser()) return false;
  try {
    const opened = window.open(url, '_system', 'noopener,noreferrer');
    if (opened) return true;
  } catch {
    // Continue to the same-window fallback if the external handoff fails.
  }
  try {
    window.location.assign(url);
    return true;
  } catch {
    return false;
  }
};

export const openMobileReleaseDownload = async (release: MobileReleaseManifest) => {
  const url = resolveMobileReleaseDownloadUrl(release);
  if (!url) return false;
  const browserPlugin = isBrowser() ? window.Capacitor?.Plugins?.Browser : undefined;
  if (browserPlugin && typeof browserPlugin.open === 'function') {
    try {
      await browserPlugin.open({ url });
      return true;
    } catch {
      return openMobileReleaseDownloadFallback(url);
    }
  }
  return openMobileReleaseDownloadFallback(url);
};

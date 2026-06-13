const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'public', 'downloads');
const generatedDir = path.join(rootDir, 'src', 'generated');
const manifestPath = path.join(downloadsDir, 'mobile-version.json');
const generatedTsPath = path.join(generatedDir, 'mobileRelease.ts');
const runtimeConfigPath = path.join(rootDir, 'public', 'runtime-config.js');
const manifestOutputPath = process.env.MOBILE_VERSION_MANIFEST_OUTPUT_PATH
  ? path.resolve(rootDir, process.env.MOBILE_VERSION_MANIFEST_OUTPUT_PATH)
  : manifestPath;
const generatedTsOutputPath = process.env.MOBILE_RELEASE_TS_OUTPUT_PATH
  ? path.resolve(rootDir, process.env.MOBILE_RELEASE_TS_OUTPUT_PATH)
  : generatedTsPath;
const explicitApkPath = process.env.MOBILE_APK_PATH
  ? path.resolve(rootDir, process.env.MOBILE_APK_PATH)
  : '';
const explicitApkFileName = process.env.MOBILE_APK_FILE_NAME || (explicitApkPath ? path.basename(explicitApkPath) : '');
const shouldUpdateRuntimeConfig = process.env.MOBILE_RELEASE_UPDATE_RUNTIME_CONFIG !== 'false';
const allowEmptyApkBootstrap = process.env.MOBILE_RELEASE_ALLOW_EMPTY_APK === 'true';
const skipGeneration = process.env.MOBILE_RELEASE_SKIP_GENERATION === 'true';
const releaseSigned = process.env.MOBILE_RELEASE_SIGNED === 'true';
const forceUnsignedRelease = process.env.MOBILE_RELEASE_FORCE_UNSIGNED === 'true';
const ignoreExistingApks = process.env.MOBILE_RELEASE_IGNORE_EXISTING_APKS === 'true';

const apkPattern = /^shoptest-(\d+)\.(\d+)\.(\d+)\.apk$/;
const ANDROID_DEBUG_CERT_SHA256 = 'A59C1DF808784AF870705AC1FB13B0A12E5099AB3D140A26052A885AD66687F1';

if (skipGeneration) {
  console.log('Skipped mobile release generation because MOBILE_RELEASE_SKIP_GENERATION=true');
  process.exit(0);
}

const toVersionCode = (version) => {
  const [major, minor, patch] = version.split('.').map((part) => Number(part));
  return major * 10000 + minor * 100 + patch;
};

const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isNonNegativeSafeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

const validateVersionMetadata = (versionName, versionCode, latestApk) => {
  if (versionName !== latestApk.versionName) {
    throw new Error(`MOBILE_VERSION_NAME (${versionName}) must match the selected APK version (${latestApk.versionName})`);
  }
  if (!isPositiveSafeInteger(versionCode)) {
    throw new Error('MOBILE_VERSION_CODE must be a positive safe integer');
  }
  const expectedVersionCode = toVersionCode(versionName);
  if (versionCode !== expectedVersionCode) {
    throw new Error(`MOBILE_VERSION_CODE (${versionCode}) must match ${versionName} (${expectedVersionCode})`);
  }
};

const validateUpdatePolicyMetadata = (minSupportedVersionCode, versionCode) => {
  if (!isNonNegativeSafeInteger(minSupportedVersionCode)) {
    throw new Error('MOBILE_MIN_SUPPORTED_VERSION_CODE must be a non-negative safe integer');
  }
  if (minSupportedVersionCode > versionCode) {
    throw new Error('MOBILE_MIN_SUPPORTED_VERSION_CODE cannot be greater than MOBILE_VERSION_CODE');
  }
};

const compareVersion = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] !== right.parts[index]) {
      return left.parts[index] - right.parts[index];
    }
  }
  return 0;
};

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const normalizeCertificateFingerprint = (value) => String(value || '').replace(/[^a-f0-9]/gi, '').toUpperCase();
const cleanString = (value) => String(value || '').trim();

const isPublishableSignedManifest = (manifest) => Boolean(
  manifest
    && manifest.releaseSigned === true
    && cleanString(manifest.apkUrl)
    && cleanString(manifest.legacyApkUrl)
    && /^[A-F0-9]{64}$/.test(normalizeCertificateFingerprint(manifest.certificateSha256))
    && normalizeCertificateFingerprint(manifest.certificateSha256) !== ANDROID_DEBUG_CERT_SHA256
    && cleanString(manifest.fileName)
    && isPositiveSafeInteger(Number(manifest.sizeBytes))
    && /^[a-f0-9]{64}$/i.test(cleanString(manifest.sha256)),
);

const signedManifestFileExists = (manifest) => Boolean(
  manifest
    && cleanString(manifest.fileName)
    && fs.existsSync(path.join(downloadsDir, manifest.fileName)),
);

const isSignedManifestForApk = (manifest, apkMetadata) => {
  if (!isPublishableSignedManifest(manifest) || !apkMetadata || !fs.existsSync(apkMetadata.filePath)) {
    return false;
  }
  const stat = fs.statSync(apkMetadata.filePath);
  return manifest.fileName === apkMetadata.fileName
    && manifest.versionName === apkMetadata.versionName
    && Number(manifest.versionCode) === toVersionCode(apkMetadata.versionName)
    && Number(manifest.sizeBytes) === stat.size
    && cleanString(manifest.sha256).toLowerCase() === sha256(apkMetadata.filePath).toLowerCase();
};

const compareVersionPartsDesc = (left, right) => {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const diff = (rightParts[index] || 0) - (leftParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

const findAndroidBuildTool = (toolName) => {
  const androidSdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const buildToolsDir = androidSdkRoot ? path.join(androidSdkRoot, 'build-tools') : '';
  if (!buildToolsDir || !fs.existsSync(buildToolsDir)) return toolName;
  const executableName = process.platform === 'win32' ? `${toolName}.bat` : toolName;
  const candidates = fs.readdirSync(buildToolsDir)
    .sort(compareVersionPartsDesc)
    .map((version) => path.join(buildToolsDir, version, executableName))
    .filter((candidate) => fs.existsSync(candidate));
  return candidates[0] || toolName;
};

const extractCertificateSha256 = (output) => {
  const text = String(output || '');
  const labeledMatch = text.match(/(?:SHA-256 digest|SHA256)\s*:\s*([A-Fa-f0-9: ]{64,95})/);
  if (labeledMatch) {
    const normalized = normalizeCertificateFingerprint(labeledMatch[1]);
    if (/^[A-F0-9]{64}$/.test(normalized)) return normalized;
  }
  const anyMatch = text.match(/\b([A-Fa-f0-9]{2}(?::[A-Fa-f0-9]{2}){31}|[A-Fa-f0-9]{64})\b/);
  return anyMatch ? normalizeCertificateFingerprint(anyMatch[1]) : '';
};

const runForOutput = (command, args) => {
  const javaHome = process.env.JAVA_HOME || '';
  const pathValue = javaHome
    ? `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`
    : process.env.PATH;
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...(pathValue ? { PATH: pathValue } : {}),
    },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}\n${result.stderr || ''}`,
    status: result.status === null ? 1 : result.status,
  };
};

const readApkCertificateSha256 = (apkPath) => {
  const apksigner = findAndroidBuildTool('apksigner');
  const apksignerResult = runForOutput(apksigner, ['verify', '--print-certs', apkPath]);
  const apksignerFingerprint = extractCertificateSha256(apksignerResult.output);
  if (apksignerResult.ok && apksignerFingerprint) {
    return apksignerFingerprint;
  }

  const javaHome = process.env.JAVA_HOME || '';
  const keytool = javaHome
    ? path.join(javaHome, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
    : 'keytool';
  const keytoolResult = runForOutput(keytool, ['-printcert', '-jarfile', apkPath]);
  const keytoolFingerprint = extractCertificateSha256(keytoolResult.output);
  if (keytoolResult.ok && keytoolFingerprint) {
    return keytoolFingerprint;
  }

  throw new Error(
    [
      `Unable to read APK signing certificate SHA-256 for ${apkPath}.`,
      `apksigner status=${apksignerResult.status}; keytool status=${keytoolResult.status}.`,
    ].join(' '),
  );
};

const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const releaseNotes = () => (process.env.MOBILE_RELEASE_NOTES || 'Performance and storefront stability improvements.')
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean);

const writeMobileReleaseOutputs = (manifest) => {
  fs.mkdirSync(path.dirname(manifestOutputPath), { recursive: true });
  fs.writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);

  fs.mkdirSync(path.dirname(generatedTsOutputPath), { recursive: true });
  fs.writeFileSync(
    generatedTsOutputPath,
    [
      '/* This file is generated by scripts/generate-mobile-version.js. */',
      `export const CURRENT_MOBILE_RELEASE = ${JSON.stringify(manifest, null, 2)} as const;`,
      '',
      'export type CurrentMobileRelease = typeof CURRENT_MOBILE_RELEASE;',
      '',
    ].join('\n'),
  );

  if (shouldUpdateRuntimeConfig && fs.existsSync(runtimeConfigPath)) {
    const runtimeConfig = fs.readFileSync(runtimeConfigPath, 'utf8')
      .replace(/mobileCurrentVersionName:\s*"[^"]*"/, `mobileCurrentVersionName: "${manifest.versionName}"`)
      .replace(/mobileCurrentVersionCode:\s*\d+/, `mobileCurrentVersionCode: ${manifest.versionCode}`);
    fs.writeFileSync(runtimeConfigPath, runtimeConfig);
  }

  console.log(`Generated ${path.relative(rootDir, manifestOutputPath)} for ${manifest.versionName} (${manifest.versionCode})`);
};

const validateReleaseSigningMetadata = (releaseSigned, certificateSha256, apkPath) => {
  if (!releaseSigned) return;
  if (!certificateSha256) {
    throw new Error('MOBILE_RELEASE_CERTIFICATE_SHA256 is required when MOBILE_RELEASE_SIGNED=true');
  }
  if (!/^[A-F0-9]{64}$/.test(certificateSha256)) {
    throw new Error('MOBILE_RELEASE_CERTIFICATE_SHA256 must be a 64-character SHA-256 fingerprint');
  }
  if (certificateSha256 === ANDROID_DEBUG_CERT_SHA256) {
    throw new Error('Refusing to mark an Android Debug certificate as release-signed');
  }
  const actualCertificateSha256 = readApkCertificateSha256(apkPath);
  if (actualCertificateSha256 === ANDROID_DEBUG_CERT_SHA256) {
    throw new Error('Refusing to mark an APK signed by the Android Debug certificate as release-signed');
  }
  if (actualCertificateSha256 !== certificateSha256) {
    throw new Error(
      [
        'MOBILE_RELEASE_CERTIFICATE_SHA256 does not match the selected APK signing certificate.',
        `expected=${certificateSha256}`,
        `actual=${actualCertificateSha256}`,
      ].join(' '),
    );
  }
};

const toApkMetadata = (fileName, filePath) => {
  const match = fileName.match(apkPattern);
  if (!match) return null;
  return {
    fileName,
    versionName: `${match[1]}.${match[2]}.${match[3]}`,
    parts: [Number(match[1]), Number(match[2]), Number(match[3])],
    filePath,
  };
};

const explicitApk = explicitApkPath ? toApkMetadata(explicitApkFileName, explicitApkPath) : null;
if (explicitApkPath && !fs.existsSync(explicitApkPath)) {
  throw new Error(`MOBILE_APK_PATH does not exist: ${explicitApkPath}`);
}
if (explicitApkPath && !explicitApk) {
  throw new Error(`MOBILE_APK_FILE_NAME must match ${apkPattern}: ${explicitApkFileName}`);
}

const apkFiles = explicitApk ? [explicitApk] : (!ignoreExistingApks && fs.existsSync(downloadsDir)
  ? fs.readdirSync(downloadsDir)
      .map((fileName) => toApkMetadata(fileName, path.join(downloadsDir, fileName)))
      .filter(Boolean)
  : []);

const latestApk = apkFiles.sort(compareVersion).pop();
if (!latestApk) {
  const existingManifest = readJsonFile(manifestPath) || {};
  if (!releaseSigned && !forceUnsignedRelease && isPublishableSignedManifest(existingManifest) && signedManifestFileExists(existingManifest)) {
    writeMobileReleaseOutputs(existingManifest);
    console.log('Preserved existing signed mobile release metadata because no replacement APK was provided');
    process.exit(0);
  }
  if (!allowEmptyApkBootstrap && releaseSigned) {
    throw new Error(`No release APK matching ${apkPattern} found in ${downloadsDir}`);
  }
  const versionName = cleanString(
    process.env.MOBILE_VERSION_NAME
      || process.env.SHOPTEST_MOBILE_ANDROID_VERSION_NAME
      || existingManifest.versionName,
  );
  const versionCode = Number(
    process.env.MOBILE_VERSION_CODE
      || (versionName ? toVersionCode(versionName) : existingManifest.versionCode),
  );
  const minSupportedVersionCode = Number(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE || 0);

  if (!versionName) {
    throw new Error('MOBILE_VERSION_NAME or SHOPTEST_MOBILE_ANDROID_VERSION_NAME is required when bootstrapping without an APK');
  }
  if (!isPositiveSafeInteger(versionCode)) {
    throw new Error('A positive MOBILE_VERSION_CODE is required when bootstrapping without an APK');
  }
  validateUpdatePolicyMetadata(minSupportedVersionCode, versionCode);

  writeMobileReleaseOutputs({
    platform: 'android',
    appId: process.env.MOBILE_APP_ID || 'com.shoptest.mobile',
    appName: process.env.MOBILE_APP_NAME || 'ShopMX',
    versionName,
    versionCode,
    minSupportedVersionCode,
    mandatory: false,
    apkUrl: '',
    legacyApkUrl: '',
    releaseSigned: false,
    certificateSha256: '',
    fileName: '',
    sizeBytes: 0,
    sha256: '',
    releaseNotes: releaseNotes(),
    generatedAt: new Date().toISOString(),
  });
  console.log(
    allowEmptyApkBootstrap
      ? 'Bootstrapped mobile release metadata without an APK because MOBILE_RELEASE_ALLOW_EMPTY_APK=true'
      : 'Bootstrapped unsigned mobile release metadata without a public APK',
  );
  process.exit(0);
}

const existingManifest = readJsonFile(manifestPath) || {};
if (!releaseSigned && !forceUnsignedRelease && isSignedManifestForApk(existingManifest, latestApk)) {
  writeMobileReleaseOutputs(existingManifest);
  console.log('Preserved existing signed mobile release metadata because MOBILE_RELEASE_SIGNED was not set');
  process.exit(0);
}

const stat = fs.statSync(latestApk.filePath);
const versionName = process.env.MOBILE_VERSION_NAME || latestApk.versionName;
const versionCode = Number(process.env.MOBILE_VERSION_CODE || toVersionCode(versionName));
const generatedAt = new Date().toISOString();
const certificateSha256 = normalizeCertificateFingerprint(process.env.MOBILE_RELEASE_CERTIFICATE_SHA256);
const minSupportedVersionCode = Number(process.env.MOBILE_MIN_SUPPORTED_VERSION_CODE || 0);
const apkUrl = releaseSigned ? `/downloads/${latestApk.fileName}` : '';
const legacyApkUrl = releaseSigned ? `/downloads/shoptest.apk?v=${encodeURIComponent(versionName)}` : '';

validateReleaseSigningMetadata(releaseSigned, certificateSha256, latestApk.filePath);
validateVersionMetadata(versionName, versionCode, latestApk);
validateUpdatePolicyMetadata(minSupportedVersionCode, versionCode);

const manifest = {
  platform: 'android',
  appId: process.env.MOBILE_APP_ID || 'com.shoptest.mobile',
  appName: process.env.MOBILE_APP_NAME || 'ShopMX',
  versionName,
  versionCode,
  minSupportedVersionCode,
  mandatory: process.env.MOBILE_UPDATE_MANDATORY === 'true',
  apkUrl,
  legacyApkUrl,
  releaseSigned,
  certificateSha256,
  fileName: latestApk.fileName,
  sizeBytes: stat.size,
  sha256: sha256(latestApk.filePath),
  releaseNotes: releaseNotes(),
  generatedAt,
};

writeMobileReleaseOutputs(manifest);

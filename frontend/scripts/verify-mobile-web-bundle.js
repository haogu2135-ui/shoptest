#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const readJson = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath} (${error.message})`);
  }
};

const readApkAssetManifest = (apkPath) => {
  const result = spawnSync('unzip', ['-p', apkPath, 'assets/public/asset-manifest.json'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    const detail = result.error?.message || String(result.stderr || '').trim() || `exit ${result.status}`;
    throw new Error(`APK does not contain assets/public/asset-manifest.json: ${detail}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`APK asset-manifest.json is not valid JSON: ${error.message}`);
  }
};

const sortedObject = (value) => Object.fromEntries(
  Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)),
);

const compareManifest = (webManifest, apkManifest) => {
  const expectedFiles = sortedObject(webManifest.files);
  const actualFiles = sortedObject(apkManifest.files);
  const missing = Object.keys(expectedFiles).filter((key) => !(key in actualFiles));
  const unexpected = Object.keys(actualFiles).filter((key) => !(key in expectedFiles));
  const mismatched = Object.keys(expectedFiles).filter((key) => (
    key in actualFiles && expectedFiles[key] !== actualFiles[key]
  ));
  const expectedEntrypoints = Array.isArray(webManifest.entrypoints) ? [...webManifest.entrypoints].sort() : [];
  const actualEntrypoints = Array.isArray(apkManifest.entrypoints) ? [...apkManifest.entrypoints].sort() : [];
  const entrypointsMatch = JSON.stringify(expectedEntrypoints) === JSON.stringify(actualEntrypoints);

  return {
    ok: missing.length === 0 && unexpected.length === 0 && mismatched.length === 0 && entrypointsMatch,
    missing,
    unexpected,
    mismatched,
    entrypointsMatch,
    expectedMain: expectedFiles['main.js'] || '',
    actualMain: actualFiles['main.js'] || '',
  };
};

const verifyMobileWebBundle = (webBuildDir, apkPath) => {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }
  const webManifest = readJson(path.join(webBuildDir, 'asset-manifest.json'), 'current web asset manifest');
  const apkManifest = readApkAssetManifest(apkPath);
  const comparison = compareManifest(webManifest, apkManifest);
  if (!comparison.ok) {
    const details = [
      `main.js expected=${comparison.expectedMain || '<missing>'} actual=${comparison.actualMain || '<missing>'}`,
      comparison.missing.length ? `missing=${comparison.missing.slice(0, 8).join(',')}` : '',
      comparison.unexpected.length ? `unexpected=${comparison.unexpected.slice(0, 8).join(',')}` : '',
      comparison.mismatched.length ? `mismatched=${comparison.mismatched.slice(0, 8).join(',')}` : '',
      comparison.entrypointsMatch ? '' : 'entrypoints differ',
    ].filter(Boolean).join('; ');
    throw new Error(`APK WebView bundle is stale or incomplete; rebuild it from the current web build. ${details}`);
  }
  return {
    fileCount: Object.keys(webManifest.files || {}).length,
    main: comparison.expectedMain,
  };
};

if (require.main === module) {
  const [, , webBuildDir, apkPath] = process.argv;
  if (!webBuildDir || !apkPath) {
    process.stderr.write('Usage: verify-mobile-web-bundle.js <web-build-dir> <apk-path>\n');
    process.exit(64);
  }
  try {
    const result = verifyMobileWebBundle(path.resolve(webBuildDir), path.resolve(apkPath));
    process.stdout.write(`Verified APK WebView bundle (${result.fileCount} assets, ${result.main})\n`);
  } catch (error) {
    process.stderr.write(`verify-mobile-web-bundle: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { compareManifest, verifyMobileWebBundle };

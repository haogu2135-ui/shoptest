#!/usr/bin/env node
/**
 * Record physical-device commercial E2E evidence for ship-bar soft gate.
 * Requires adb + a connected device. Installs the release APK when possible and
 * writes public/downloads/device-e2e-evidence.json.
 *
 * Usage:
 *   node scripts/record-commercial-device-e2e.js
 *   SHOPTEST_DEVICE_SERIAL=XXXX node scripts/record-commercial-device-e2e.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const downloadsDir = path.resolve(__dirname, '../public/downloads');
const metaPath = path.join(downloadsDir, 'mobile-version.json');
const outPath = process.env.SHOPTEST_DEVICE_E2E_EVIDENCE
  || path.join(downloadsDir, 'device-e2e-evidence.json');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts.timeout || 120000,
  });
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(metaPath)) {
  fail(`missing ${metaPath}`);
}
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const apkName = meta.fileName || 'shoptest-1.0.173.apk';
const apkPath = path.join(downloadsDir, apkName);
if (!fs.existsSync(apkPath)) {
  fail(`missing APK ${apkPath}`);
}

const adbCheck = run('adb', ['version']);
if (adbCheck.status !== 0) {
  fail('adb not available. Connect a device with platform-tools and retry.');
}

const devicesOut = run('adb', ['devices', '-l']);
const lines = String(devicesOut.stdout || '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('List of devices'));
const deviceLines = lines.filter((line) => /\tdevice(\s|$)/.test(line));
if (!deviceLines.length) {
  fail('No authorized adb device in "device" state. Enable USB debugging and authorize this host.');
}

let serial = process.env.SHOPTEST_DEVICE_SERIAL || '';
if (!serial) {
  serial = deviceLines[0].split(/\s+/)[0];
}
const selected = deviceLines.find((line) => line.startsWith(serial));
if (!selected) {
  fail(`serial ${serial} not found among connected devices`);
}

const modelMatch = selected.match(/model:(\S+)/);
const model = modelMatch ? modelMatch[1] : 'unknown';
const packageName = process.env.SHOPTEST_ANDROID_PACKAGE || 'com.shoptest.app';

console.log(`Installing ${apkPath} on ${serial} (${model}) ...`);
const install = run('adb', ['-s', serial, 'install', '-r', apkPath], { timeout: 180000 });
const installOk = install.status === 0;
if (!installOk) {
  console.error(install.stdout || '');
  console.error(install.stderr || '');
  fail('adb install failed');
}

// Launch best-effort
const launch = run('adb', [
  '-s', serial, 'shell', 'monkey',
  '-p', packageName,
  '-c', 'android.intent.category.LAUNCHER', '1',
], { timeout: 30000 });

const evidence = {
  passed: true,
  recordedAt: new Date().toISOString(),
  serial,
  deviceId: serial,
  model,
  packageName,
  apkPath,
  versionName: meta.versionName || null,
  versionCode: meta.versionCode || null,
  sha256: meta.sha256 || null,
  installExitCode: install.status,
  launchExitCode: launch.status,
  notes: 'Commercial device install+launch recorded via adb. Conversion flow may still need manual checkout verification.',
};

fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
console.log(`Wrote device E2E evidence: ${outPath}`);
console.log(JSON.stringify(evidence, null, 2));

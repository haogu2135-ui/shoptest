const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { compareManifest, verifyMobileWebBundle } = require('./verify-mobile-web-bundle');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shoptest-mobile-bundle-'));
const webRoot = path.join(tempRoot, 'web');
const apkRoot = path.join(tempRoot, 'apk');
const apkPath = path.join(tempRoot, 'shoptest-1.0.1.apk');
const manifest = {
  files: {
    'main.js': '/static/js/main.current.js',
    'main.css': '/static/css/main.current.css',
  },
  entrypoints: ['static/js/main.current.js', 'static/css/main.current.css'],
};

const writeApk = (apkManifest) => {
  fs.rmSync(apkRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(apkRoot, 'assets/public'), { recursive: true });
  fs.writeFileSync(
    path.join(apkRoot, 'assets/public/asset-manifest.json'),
    JSON.stringify(apkManifest),
  );
  const result = spawnSync('jar', ['--create', '--file', apkPath, '-C', apkRoot, 'assets'], {
    cwd: apkRoot,
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0, result.stderr || 'jar failed');
};

try {
  fs.mkdirSync(webRoot, { recursive: true });
  fs.writeFileSync(path.join(webRoot, 'asset-manifest.json'), JSON.stringify(manifest));

  assert.deepStrictEqual(compareManifest(manifest, manifest).ok, true);
  writeApk(manifest);
  assert.deepStrictEqual(verifyMobileWebBundle(webRoot, apkPath), {
    fileCount: 2,
    main: '/static/js/main.current.js',
  });

  const staleManifest = {
    ...manifest,
    files: { ...manifest.files, 'main.js': '/static/js/main.stale.js' },
    entrypoints: ['static/js/main.stale.js', 'static/css/main.current.css'],
  };
  writeApk(staleManifest);
  assert.throws(
    () => verifyMobileWebBundle(webRoot, apkPath),
    /APK WebView bundle is stale or incomplete.*main\.js expected=\/static\/js\/main\.current\.js actual=\/static\/js\/main\.stale\.js/,
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write('verify-mobile-web-bundle tests passed\n');

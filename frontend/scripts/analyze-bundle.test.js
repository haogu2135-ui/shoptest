const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { analyzeBundle, writeReports } = require('./analyze-bundle');

function writeFile(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shoptest-bundle-analyze-'));
try {
  writeFile(path.join(tempRoot, 'static/js/main.js'), 'a'.repeat(2048));
  writeFile(path.join(tempRoot, 'static/js/lazy.js'), 'b'.repeat(512));
  writeFile(path.join(tempRoot, 'static/css/main.css'), 'body{color:#123456}'.repeat(20));
  writeFile(path.join(tempRoot, 'asset-manifest.json'), JSON.stringify({
    files: {
      'main.js': '/static/js/main.js',
      'lazy.js': '/static/js/lazy.js',
      'main.css': '/static/css/main.css',
      'main.js.map': '/static/js/main.js.map',
    },
    entrypoints: [
      'static/js/main.js',
      'static/css/main.css',
    ],
  }, null, 2));

  const report = analyzeBundle({
    buildPath: tempRoot,
    enforce: false,
    budgets: {
      maxInitialJsBytes: 1024,
      maxInitialJsGzipBytes: 1024,
      maxTotalJsBytes: 4096,
      maxTotalCssBytes: 4096,
      maxLargestAssetBytes: 4096,
    },
  });

  assert.strictEqual(report.status, 'warn');
  assert.strictEqual(report.assets.length, 3);
  assert.strictEqual(report.totals.initialJsBytes, 2048);
  assert.strictEqual(report.totals.totalJsBytes, 2560);
  assert.ok(report.violations.some((violation) => violation.label === 'initial JS'));
  assert.ok(report.assets.every((asset) => !asset.path.endsWith('.map')));

  const outputDir = path.join(tempRoot, 'reports');
  const paths = writeReports(report, outputDir);
  assert.ok(fs.existsSync(paths.jsonPath));
  assert.ok(fs.existsSync(paths.markdownPath));
  assert.ok(fs.readFileSync(paths.markdownPath, 'utf8').includes('Bundle Size Report'));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('analyze-bundle tests passed');

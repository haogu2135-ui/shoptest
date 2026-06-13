const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const frontendRoot = path.resolve(__dirname, '..');
const DEFAULT_BUDGETS = {
  maxInitialJsBytes: 700 * 1024,
  maxInitialJsGzipBytes: 220 * 1024,
  maxTotalJsBytes: 1200 * 1024,
  maxTotalCssBytes: 220 * 1024,
  maxLargestAssetBytes: 900 * 1024,
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const [rawKey, inlineValue] = item.slice(2).split('=');
    const nextValue = inlineValue === undefined ? argv[index + 1] : inlineValue;
    if (inlineValue === undefined && nextValue && !nextValue.startsWith('--')) {
      index += 1;
      args[rawKey] = nextValue;
    } else {
      args[rawKey] = inlineValue === undefined ? true : inlineValue;
    }
  }
  return args;
}

function envKb(name, fallbackBytes) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallbackBytes;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackBytes;
  return Math.round(parsed * 1024);
}

function readBudgets() {
  return {
    maxInitialJsBytes: envKb('BUNDLE_ANALYZE_MAX_INITIAL_JS_KB', DEFAULT_BUDGETS.maxInitialJsBytes),
    maxInitialJsGzipBytes: envKb('BUNDLE_ANALYZE_MAX_INITIAL_JS_GZIP_KB', DEFAULT_BUDGETS.maxInitialJsGzipBytes),
    maxTotalJsBytes: envKb('BUNDLE_ANALYZE_MAX_TOTAL_JS_KB', DEFAULT_BUDGETS.maxTotalJsBytes),
    maxTotalCssBytes: envKb('BUNDLE_ANALYZE_MAX_TOTAL_CSS_KB', DEFAULT_BUDGETS.maxTotalCssBytes),
    maxLargestAssetBytes: envKb('BUNDLE_ANALYZE_MAX_LARGEST_ASSET_KB', DEFAULT_BUDGETS.maxLargestAssetBytes),
  };
}

function resolveBuildPath(args = {}) {
  return path.resolve(
    frontendRoot,
    args['build-path'] || process.env.BUNDLE_ANALYZE_BUILD_PATH || process.env.BUILD_PATH || 'build',
  );
}

function resolveOutputDir(args = {}, buildPath) {
  return path.resolve(
    frontendRoot,
    args['output-dir'] || process.env.BUNDLE_ANALYZE_OUTPUT_DIR || buildPath,
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeManifestPath(value) {
  const text = String(value || '').trim();
  if (!text || /^https?:\/\//i.test(text)) return '';
  return text.replace(/^\/+/, '');
}

function assetKind(assetPath) {
  if (/\.js$/i.test(assetPath)) return 'js';
  if (/\.css$/i.test(assetPath)) return 'css';
  if (/\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(assetPath)) return 'image';
  if (/\.(woff2?|ttf|otf|eot)$/i.test(assetPath)) return 'font';
  return 'other';
}

function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function collectManifestAssets(manifest) {
  const assets = new Set();
  Object.values(manifest.files || {}).forEach((value) => {
    const normalized = normalizeManifestPath(value);
    if (normalized && !normalized.endsWith('.map')) assets.add(normalized);
  });
  (manifest.entrypoints || []).forEach((value) => {
    const normalized = normalizeManifestPath(value);
    if (normalized && !normalized.endsWith('.map')) assets.add(normalized);
  });
  return Array.from(assets);
}

function bytesToKb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function addTotals(totals, kind, sizeBytes, gzipBytes, initial) {
  totals.totalBytes += sizeBytes;
  totals.totalGzipBytes += gzipBytes;
  if (kind === 'js') {
    totals.totalJsBytes += sizeBytes;
    totals.totalJsGzipBytes += gzipBytes;
    if (initial) {
      totals.initialJsBytes += sizeBytes;
      totals.initialJsGzipBytes += gzipBytes;
    }
  }
  if (kind === 'css') {
    totals.totalCssBytes += sizeBytes;
    totals.totalCssGzipBytes += gzipBytes;
    if (initial) {
      totals.initialCssBytes += sizeBytes;
      totals.initialCssGzipBytes += gzipBytes;
    }
  }
}

function budgetViolation(label, actualBytes, budgetBytes) {
  if (actualBytes <= budgetBytes) return null;
  return {
    label,
    actualBytes,
    budgetBytes,
    actualKb: bytesToKb(actualBytes),
    budgetKb: bytesToKb(budgetBytes),
  };
}

function budgetViolations(totals, assets, budgets) {
  return [
    budgetViolation('initial JS', totals.initialJsBytes, budgets.maxInitialJsBytes),
    budgetViolation('initial JS gzip', totals.initialJsGzipBytes, budgets.maxInitialJsGzipBytes),
    budgetViolation('total JS', totals.totalJsBytes, budgets.maxTotalJsBytes),
    budgetViolation('total CSS', totals.totalCssBytes, budgets.maxTotalCssBytes),
    budgetViolation('largest asset', assets[0] ? assets[0].sizeBytes : 0, budgets.maxLargestAssetBytes),
  ].filter(Boolean);
}

function analyzeBundle(options = {}) {
  const buildPath = path.resolve(options.buildPath || resolveBuildPath());
  const manifestPath = path.join(buildPath, 'asset-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`asset-manifest.json not found in ${buildPath}. Run npm run build first or pass --build-path.`);
  }
  const manifest = readJson(manifestPath);
  const entrypoints = new Set((manifest.entrypoints || []).map(normalizeManifestPath));
  const assets = collectManifestAssets(manifest)
    .map((assetPath) => {
      const filePath = path.join(buildPath, assetPath);
      if (!filePath.startsWith(buildPath) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      return {
        path: assetPath,
        kind: assetKind(assetPath),
        initial: entrypoints.has(assetPath),
        sizeBytes: buffer.length,
        gzipBytes: gzipSize(buffer),
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.sizeBytes - left.sizeBytes || left.path.localeCompare(right.path));

  const totals = {
    totalBytes: 0,
    totalGzipBytes: 0,
    totalJsBytes: 0,
    totalJsGzipBytes: 0,
    initialJsBytes: 0,
    initialJsGzipBytes: 0,
    totalCssBytes: 0,
    totalCssGzipBytes: 0,
    initialCssBytes: 0,
    initialCssGzipBytes: 0,
  };
  assets.forEach((asset) => addTotals(totals, asset.kind, asset.sizeBytes, asset.gzipBytes, asset.initial));
  const budgets = options.budgets || readBudgets();
  const violations = budgetViolations(totals, assets, budgets);
  const enforce = Boolean(options.enforce);
  return {
    generatedAt: new Date().toISOString(),
    buildPath,
    enforce,
    status: violations.length === 0 ? 'pass' : enforce ? 'fail' : 'warn',
    budgets,
    totals,
    violations,
    assets,
  };
}

function markdownReport(report) {
  const lines = [
    '# Bundle Size Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Build path: ${report.buildPath}`,
    `Status: ${report.status}`,
    '',
    '| Metric | Size | Gzip |',
    '|---|---:|---:|',
    `| Initial JS | ${bytesToKb(report.totals.initialJsBytes)} KB | ${bytesToKb(report.totals.initialJsGzipBytes)} KB |`,
    `| Total JS | ${bytesToKb(report.totals.totalJsBytes)} KB | ${bytesToKb(report.totals.totalJsGzipBytes)} KB |`,
    `| Total CSS | ${bytesToKb(report.totals.totalCssBytes)} KB | ${bytesToKb(report.totals.totalCssGzipBytes)} KB |`,
    `| All assets | ${bytesToKb(report.totals.totalBytes)} KB | ${bytesToKb(report.totals.totalGzipBytes)} KB |`,
    '',
  ];
  if (report.violations.length > 0) {
    lines.push('## Budget Findings', '');
    report.violations.forEach((violation) => {
      lines.push(`- ${violation.label}: ${violation.actualKb} KB over budget ${violation.budgetKb} KB`);
    });
    lines.push('');
  }
  lines.push('## Largest Assets', '', '| Asset | Kind | Initial | Size | Gzip |', '|---|---|---:|---:|---:|');
  report.assets.slice(0, 30).forEach((asset) => {
    lines.push(`| ${asset.path} | ${asset.kind} | ${asset.initial ? 'yes' : 'no'} | ${bytesToKb(asset.sizeBytes)} KB | ${bytesToKb(asset.gzipBytes)} KB |`);
  });
  lines.push('');
  return lines.join('\n');
}

function writeReports(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'bundle-size-report.json');
  const markdownPath = path.join(outputDir, 'bundle-size-report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdownReport(report));
  return { jsonPath, markdownPath };
}

function printSummary(report, paths) {
  const summary = [
    `Bundle analysis ${report.status}: initial JS ${bytesToKb(report.totals.initialJsBytes)} KB `
      + `(${bytesToKb(report.totals.initialJsGzipBytes)} KB gzip), total JS ${bytesToKb(report.totals.totalJsBytes)} KB.`,
    `Reports: ${paths.jsonPath}, ${paths.markdownPath}`,
  ];
  if (report.violations.length > 0) {
    summary.push(`Budget findings: ${report.violations.map((item) => `${item.label} ${item.actualKb}/${item.budgetKb} KB`).join('; ')}`);
  }
  console.log(summary.join('\n'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const buildPath = resolveBuildPath(args);
  const outputDir = resolveOutputDir(args, buildPath);
  const enforce = args.enforce === true || process.env.BUNDLE_ANALYZE_ENFORCE === 'true';
  const report = analyzeBundle({ buildPath, enforce });
  const paths = writeReports(report, outputDir);
  printSummary(report, paths);
  if (report.status === 'fail') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundle,
  bytesToKb,
  markdownReport,
  parseArgs,
  writeReports,
};

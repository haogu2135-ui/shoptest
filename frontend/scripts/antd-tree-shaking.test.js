const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const frontendRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(frontendRoot, 'src');

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) return [];
    return [fullPath];
  });
}

function importText(sourceFile, node) {
  return node.getText(sourceFile).replace(/\s+/g, ' ');
}

function scanImportPolicy(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations = [];

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      const importClause = node.importClause;
      const relativePath = path.relative(frontendRoot, filePath);
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const label = `${relativePath}:${line}: ${importText(sourceFile, node)}`;

      if (moduleName === 'antd') {
        if (!importClause) violations.push(`${label} uses side-effect antd import`);
        if (importClause?.name) violations.push(`${label} uses default antd import`);
        if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
          violations.push(`${label} uses namespace antd import`);
        }
      }

      if (moduleName.startsWith('antd/dist')) {
        violations.push(`${label} imports antd dist output`);
      }

      if (moduleName.startsWith('antd/lib')) {
        violations.push(`${label} imports antd CommonJS lib output`);
      }

      if (moduleName.startsWith('antd/es') && !importClause?.isTypeOnly) {
        violations.push(`${label} imports antd/es at runtime instead of using named ESM imports or antd/locale`);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const requirePattern = /require\(\s*['"]antd(?:\/(?:dist|lib))?['"]\s*\)/;
  if (requirePattern.test(source)) {
    violations.push(`${path.relative(frontendRoot, filePath)} uses CommonJS antd require`);
  }

  return violations;
}

const antdPackage = require(path.join(frontendRoot, 'node_modules/antd/package.json'));

assert.ok(
  typeof antdPackage.module === 'string' && antdPackage.module.startsWith('es/'),
  `antd package should expose an ESM module entry, got ${antdPackage.module}`,
);
assert.deepStrictEqual(
  antdPackage.sideEffects,
  ['*.css'],
  `antd sideEffects should stay CSS-only for tree-shaking, got ${JSON.stringify(antdPackage.sideEffects)}`,
);

const violations = collectSourceFiles(sourceRoot).flatMap(scanImportPolicy);
assert.deepStrictEqual(violations, []);

console.log('antd tree-shaking import policy tests passed');

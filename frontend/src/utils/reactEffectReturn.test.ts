import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';

const SRC_ROOT = path.resolve(__dirname, '..');

const collectSourceFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    if (
      !/\.(ts|tsx)$/.test(entry.name)
      || /\.d\.ts$/.test(entry.name)
      || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)
    ) {
      return [];
    }
    return [fullPath];
  });
};

const isUseEffectCall = (node: ts.CallExpression): boolean => {
  const expression = node.expression;
  return (
    (ts.isIdentifier(expression) && expression.text === 'useEffect')
    || (ts.isPropertyAccessExpression(expression) && expression.name.text === 'useEffect')
  );
};

const isUndefinedIdentifier = (node: ts.Node): boolean => (
  ts.isIdentifier(node) && node.text === 'undefined'
);

const isFunctionScope = (node: ts.Node): boolean => (
  ts.isFunctionDeclaration(node)
  || ts.isFunctionExpression(node)
  || ts.isArrowFunction(node)
  || ts.isMethodDeclaration(node)
  || ts.isGetAccessorDeclaration(node)
  || ts.isSetAccessorDeclaration(node)
  || ts.isConstructorDeclaration(node)
);

const scanUseEffectReturnUndefined = (filePath: string): string[] => {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  const lineFor = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  const scanEffectCallback = (callback: ts.Node) => {
    const visitCallbackNode = (node: ts.Node) => {
      if (node !== callback && isFunctionScope(node)) return;
      if (
        ts.isReturnStatement(node)
        && node.expression
        && isUndefinedIdentifier(node.expression)
      ) {
        violations.push(`${path.relative(SRC_ROOT, filePath)}:${lineFor(node)}`);
      }
      ts.forEachChild(node, visitCallbackNode);
    };
    visitCallbackNode(callback);
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isUseEffectCall(node)) {
      const callback = node.arguments[0];
      if (callback) scanEffectCallback(callback);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

describe('F3510 useEffect return contract', () => {
  it('does not explicitly return undefined from useEffect callbacks', () => {
    const violations = collectSourceFiles(SRC_ROOT).flatMap(scanUseEffectReturnUndefined);

    expect(violations).toEqual([]);
  });
});

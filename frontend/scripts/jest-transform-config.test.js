const assert = require('assert');
const path = require('path');

const packageJson = require(path.resolve(__dirname, '..', 'package.json'));

assert.strictEqual(
  packageJson.engines?.node,
  '>=18',
  'frontend test runtime must require Node >=18 because @testing-library/dom@10 requires it',
);

assert.strictEqual(
  packageJson.scripts?.test,
  'react-scripts test --watchAll=false',
  'Jest should run without path-level exclusions that hide SupportManagement',
);

assert.ok(
  packageJson.scripts?.test && !packageJson.scripts.test.includes('testPathIgnorePatterns'),
  'Jest test script must not skip suites with testPathIgnorePatterns',
);

const transformIgnorePatterns = packageJson.jest?.transformIgnorePatterns;
assert.ok(Array.isArray(transformIgnorePatterns), 'jest.transformIgnorePatterns must be configured');

function isIgnoredByJest(modulePath) {
  return transformIgnorePatterns.some((pattern) => new RegExp(pattern).test(modulePath));
}

[
  'node_modules/@testing-library/dom/dist/config.js',
  'node_modules/@testing-library/dom/dist/pretty-dom.js',
  'node_modules/@adobe/css-tools/dist/index.cjs',
].forEach((modulePath) => {
  assert.strictEqual(
    isIgnoredByJest(modulePath),
    false,
    `${modulePath} must be transformed so optional chaining is compiled for Jest`,
  );
});

assert.strictEqual(
  isIgnoredByJest('node_modules/lodash/lodash.js'),
  true,
  'unrelated node_modules should still be ignored by Jest transforms',
);

console.log('Jest transform config guard passed');

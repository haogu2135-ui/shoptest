'use strict';

// Host-safe commercial builds: the forked TypeScript checker alone can exceed the
// default 1G bounded-task budget on this two-core live host. Disable only the
// webpack fork checker; source correctness still comes from focused Jest/transpile.
const Module = require('module');
const originalRequire = Module.prototype.require;

function createNoopPlugin() {
  class NoopForkTsCheckerWebpackPlugin {
    constructor() {}
    apply() {}
  }

  NoopForkTsCheckerWebpackPlugin.getCompilerHooks = () => ({
    start: { tap() {}, tapAsync() {}, tapPromise() {} },
    waiting: { tap() {}, tapAsync() {}, tapPromise() {} },
    canceled: { tap() {}, tapAsync() {}, tapPromise() {} },
    error: { tap() {}, tapAsync() {}, tapPromise() {} },
    close: { tap() {}, tapAsync() {}, tapPromise() {} },
    issues: { tap() {}, tapAsync() {}, tapPromise() {} },
  });

  return NoopForkTsCheckerWebpackPlugin;
}

Module.prototype.require = function patchedRequire(id) {
  if (
    id === 'fork-ts-checker-webpack-plugin'
    || id === 'react-dev-utils/ForkTsCheckerWebpackPlugin'
    || id === 'react-dev-utils/ForkTsCheckerWarningWebpackPlugin'
  ) {
    return createNoopPlugin();
  }
  return originalRequire.apply(this, arguments);
};

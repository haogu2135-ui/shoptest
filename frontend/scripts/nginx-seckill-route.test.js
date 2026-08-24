#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const configPaths = [
  path.join(repoRoot, 'deploy/nginx/shoptest-static.conf'),
  path.join(repoRoot, 'deploy/nginx/shoptest-edge.conf.template'),
];

for (const configPath of configPaths) {
  const source = fs.readFileSync(configPath, 'utf8');
  const publicRoutes = source.split('\n').filter((line) => line.includes('location ~ ^/(?:'));
  const adminRoutes = source.split('\n').filter((line) => line.includes('location ~ ^/admin(?:'));

  assert(publicRoutes.length > 0, `${configPath}: public SPA route is missing`);
  assert(adminRoutes.length > 0, `${configPath}: admin SPA route is missing`);
  assert(publicRoutes.every((line) => /\|seckill\)/.test(line)), `${configPath}: public /seckill route is missing`);
  assert(
    publicRoutes.every((line) => /\|orders\|/.test(line) && /\|privacy\|/.test(line) && /\|terms\|/.test(line)),
    `${configPath}: public order/legal routes are missing`,
  );
  assert(adminRoutes.every((line) => /\|seckill\)/.test(line)), `${configPath}: admin /seckill route is missing`);
  assert(source.includes('location /api/'), `${configPath}: API proxy route is missing`);
}

process.stdout.write(`PASS nginx seckill route coverage (${configPaths.length} configs)\n`);

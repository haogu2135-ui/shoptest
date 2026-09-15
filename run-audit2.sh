#!/usr/bin/env bash
cd /home/guhao/shoptest
export SHOPTEST_UI_BASE=http://127.0.0.1:4200
export SHOPTEST_PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chrome-x/chrome-linux/chrome
node tmp-audit-order.js

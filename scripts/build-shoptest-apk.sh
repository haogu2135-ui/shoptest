#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${SHOPTEST_PROJECT_DIR:-/home/guhao/shoptest}"
FRONTEND_DIR="${PROJECT_DIR}/frontend"
MOBILE_PROJECT_DIR="${SHOPTEST_MOBILE_PROJECT_DIR:-/home/guhao/shoptest-mobile}"
MIN_RELEASE_APK_BYTES="${SHOPTEST_MIN_RELEASE_APK_BYTES:-1048576}"

fail() {
  echo "build-shoptest-apk: $*" >&2
  exit 1
}

[[ -d "$PROJECT_DIR" ]] || fail "project directory not found: $PROJECT_DIR"
[[ -d "$FRONTEND_DIR" ]] || fail "frontend directory not found: $FRONTEND_DIR"
[[ -d "$MOBILE_PROJECT_DIR" ]] || fail "mobile project directory not found: $MOBILE_PROJECT_DIR"
[[ -f "${MOBILE_PROJECT_DIR}/package.json" ]] || fail "mobile package.json not found"

(
  cd "$MOBILE_PROJECT_DIR"
  npm run build:apk
)

node -e '
const fs = require("fs");
const path = require("path");

const frontendDir = process.argv[1];
const minBytes = Number(process.argv[2]) || 1048576;
const manifestPath = path.join(frontendDir, "public/downloads/mobile-version.json");
if (!fs.existsSync(manifestPath)) {
  throw new Error(`mobile release manifest not found: ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const apkPath = path.join(frontendDir, "public/downloads", manifest.fileName || "");
if (manifest.releaseSigned !== true) {
  throw new Error("mobile release manifest is not marked releaseSigned=true");
}
if (!/^[A-F0-9]{64}$/.test(String(manifest.certificateSha256 || "").replace(/[^A-F0-9]/gi, "").toUpperCase())) {
  throw new Error("mobile release manifest has an invalid certificate fingerprint");
}
if (!fs.existsSync(apkPath)) {
  throw new Error(`versioned APK not found: ${apkPath}`);
}

const size = fs.statSync(apkPath).size;
if (size < minBytes) {
  throw new Error(`versioned APK is too small for a release build: ${size} bytes`);
}

console.log(`Verified ShopTest APK ${manifest.fileName} (${size} bytes)`);
' "$FRONTEND_DIR" "$MIN_RELEASE_APK_BYTES"

// This file is copied to the production build as-is.
// Change these values on the deployed server to switch backend routing without rebuilding the frontend.
window.__SHOP_RUNTIME_CONFIG__ = window.__SHOP_RUNTIME_CONFIG__ || {
  // The production domain proxies /api and /ws to the backend edge.
  apiBaseUrl: "/api",
  supportWebSocketUrl: "/ws/support",
  apiGatewayEnabled: false,
  apiGatewayPrefix: "/gateway",
  mobileVersionManifestUrl: "/downloads/mobile-version.json",
  mobileCurrentVersionName: "1.0.134",
  mobileCurrentVersionCode: 10134,
};

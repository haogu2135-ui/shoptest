describe('runtimeConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete window.__SHOP_RUNTIME_CONFIG__;
    delete window.__SHOP_API_BASE_URL__;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers runtime API base URL over build-time env and trims trailing slashes', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: ' https://api.example.com/v1/// ' };
    process.env.REACT_APP_API_BASE_URL = 'https://build.example.com';

    const { resolveApiBaseUrl } = require('./runtimeConfig');

    expect(resolveApiBaseUrl()).toBe('https://api.example.com/v1');
  });

  it('keeps legacy runtime API base URL compatibility', () => {
    window.__SHOP_API_BASE_URL__ = 'https://legacy-api.example.com/';

    const { resolveApiBaseUrl } = require('./runtimeConfig');

    expect(resolveApiBaseUrl()).toBe('https://legacy-api.example.com');
  });

  it('rejects unsafe API base URL values and falls back to build-time env', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: 'https://user:pass@api.example.com?token=secret' };
    process.env.REACT_APP_API_BASE_URL = 'https://build.example.com/root/';

    const { normalizeApiBaseUrl, resolveApiBaseUrl } = require('./runtimeConfig');

    expect(normalizeApiBaseUrl('//evil.example.com')).toBeNull();
    expect(normalizeApiBaseUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeApiBaseUrl('https:\\\\api.example.com\\root')).toBeNull();
    expect(normalizeApiBaseUrl('https://api.example.com/%5cadmin')).toBeNull();
    expect(normalizeApiBaseUrl('https://api.example.com/root%00')).toBeNull();
    expect(resolveApiBaseUrl()).toBe('https://build.example.com/root');
  });

  it('supports same-origin relative API base URLs', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: '/backend/api/' };

    const { resolveApiBaseUrl } = require('./runtimeConfig');

    expect(resolveApiBaseUrl()).toBe('/backend/api');
  });

  it('normalizes support websocket URLs and rejects unsafe values', () => {
    const { normalizeSupportWebSocketUrl } = require('./runtimeConfig');

    expect(normalizeSupportWebSocketUrl(' wss://support.example.com/ws/support/// ')).toBe('wss://support.example.com/ws/support');
    expect(normalizeSupportWebSocketUrl('/ws/support/')).toBe('/ws/support');
    expect(normalizeSupportWebSocketUrl('//evil.example.com/ws/support')).toBeNull();
    expect(normalizeSupportWebSocketUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSupportWebSocketUrl('wss://user:pass@support.example.com/ws')).toBeNull();
    expect(normalizeSupportWebSocketUrl('wss://support.example.com/ws?token=secret')).toBeNull();
    expect(normalizeSupportWebSocketUrl('wss:\\\\support.example.com\\ws')).toBeNull();
    expect(normalizeSupportWebSocketUrl('wss://support.example.com/%5cws')).toBeNull();
    expect(normalizeSupportWebSocketUrl('wss://support.example.com/ws%00')).toBeNull();
  });

  it('derives support websocket endpoint from API origin without inheriting api proxy path', () => {
    window.__SHOP_RUNTIME_CONFIG__ = { apiBaseUrl: '/api' };

    const { resolveSupportWebSocketUrl } = require('./runtimeConfig');

    expect(resolveSupportWebSocketUrl()).toBe('http://localhost/ws/support');
  });

  it('prefers explicit runtime support websocket endpoint over API base URL', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'https://api.example.com/base',
      supportWebSocketUrl: 'wss://support.example.com/ws/support/',
    };

    const { resolveSupportWebSocketUrl } = require('./runtimeConfig');

    expect(resolveSupportWebSocketUrl()).toBe('wss://support.example.com/ws/support');
  });

  it('resolves runtime gateway prefix and enabled flag', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiGatewayEnabled: 'off',
      apiGatewayPrefix: ' edge-gateway// ',
    };

    const { resolveApiGatewayEnabled, resolveApiGatewayPrefix } = require('./runtimeConfig');

    expect(resolveApiGatewayEnabled()).toBe(false);
    expect(resolveApiGatewayPrefix()).toBe('/edge-gateway');
  });

  it('uses runtime gateway settings when apiDispatcher is loaded', () => {
    window.__SHOP_RUNTIME_CONFIG__ = {
      apiGatewayEnabled: true,
      apiGatewayPrefix: '/edge',
    };

    const { apiGatewayEnabled, apiGatewayPrefix, resolveApiDispatcherUrl } = require('./apiDispatcher');

    expect(apiGatewayEnabled).toBe(true);
    expect(apiGatewayPrefix).toBe('/edge');
    expect(resolveApiDispatcherUrl('/payments/channels')).toBe('/edge/payment/payments/channels');
  });

  it('stays wired into API, websocket, gateway, and mobile runtime entry points', () => {
    const fs = require('fs');
    const path = require('path');
    const sourceRoot = path.resolve(__dirname, '..');
    const apiSource = fs.readFileSync(path.join(sourceRoot, 'api/index.ts'), 'utf8');
    const apiDispatcherSource = fs.readFileSync(path.join(sourceRoot, 'utils/apiDispatcher.ts'), 'utf8');
    const mobileUpdateSource = fs.readFileSync(path.join(sourceRoot, 'utils/mobileUpdate.ts'), 'utf8');

    expect(apiSource).toContain("import { resolveApiBaseUrl, resolveSupportWebSocketUrl } from '../utils/runtimeConfig'");
    expect(apiSource).toContain('baseURL: resolveApiBaseUrl()');
    expect(apiSource).toContain('resolveSupportWebSocketUrl()');
    expect(apiDispatcherSource).toContain("import { resolveApiGatewayEnabled, resolveApiGatewayPrefix } from './runtimeConfig'");
    expect(mobileUpdateSource).toContain("import { resolveApiBaseUrl } from './runtimeConfig'");
    expect(mobileUpdateSource).toContain('resolveApiBaseUrl()');
  });
});

export {};

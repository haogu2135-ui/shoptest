import { useEffect, useState } from 'react';
import { appConfigApi } from '../api';
import type { AppConfig } from '../types';

const envFallbackConfig: AppConfig = {
  emailCodeEnabled: process.env.REACT_APP_EMAIL_CODE_ENABLED === 'true',
};

let cachedConfig: AppConfig | null = null;
let cachedUntil = 0;
let cachedError = false;
let pendingConfig: Promise<AppConfig> | null = null;
const listeners = new Set<() => void>();
const APP_CONFIG_REFRESH_MS = 5_000;

const notify = () => listeners.forEach((listener) => listener());

const loadAppConfig = () => {
  if ((cachedConfig || cachedError) && cachedUntil > Date.now()) {
    return Promise.resolve(cachedConfig || envFallbackConfig);
  }
  if (!pendingConfig) {
    pendingConfig = appConfigApi.get()
      .then((response) => {
        cachedConfig = response.data;
        cachedUntil = Date.now() + APP_CONFIG_REFRESH_MS;
        cachedError = false;
        notify();
        return response.data;
      })
      .catch(() => {
        cachedConfig = envFallbackConfig;
        cachedUntil = Date.now() + APP_CONFIG_REFRESH_MS;
        cachedError = true;
        notify();
        return envFallbackConfig;
      })
      .finally(() => {
        pendingConfig = null;
      });
  }
  return pendingConfig;
};

export const useAppConfig = () => {
  const [config, setConfig] = useState<AppConfig>(() => cachedConfig || envFallbackConfig);
  const [loading, setLoading] = useState(() => !cachedConfig && !cachedError);

  useEffect(() => {
    const sync = () => {
      setConfig(cachedConfig || envFallbackConfig);
      setLoading(Boolean(pendingConfig));
    };
    listeners.add(sync);
    loadAppConfig().finally(() => {
      sync();
    });
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return { config, loading };
};

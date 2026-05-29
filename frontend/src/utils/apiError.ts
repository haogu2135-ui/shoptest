import type { Language } from '../i18n';

type ApiErrorLike = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      code?: string;
      error?: string;
      message?: string;
    };
  };
};

const hasChineseText = (value: string) => /[\u3400-\u9fff]/.test(value);
const hasSpanishSignal = (value: string) =>
  /[áéíóúñü¿¡]/i.test(value) || /\b(el|la|los|las|un|una|pedido|pago|usuario|correo|contraseña|direccion|dirección|envio|envío|reembolso)\b/i.test(value);

export const getApiErrorMessage = (error: unknown, fallback: string, language: Language = 'en') => {
  const errorLike = error as ApiErrorLike;
  const errorText = String(errorLike.message || '');
  const localMessages = {
    en: {
      network: 'Network connection failed. Please check the storefront API proxy and try again.',
      timeout: 'The request timed out. Please try again.',
      serviceUnavailable: 'The service is temporarily unavailable. Please try again later.',
    },
    zh: {
      network: '网络连接失败，请检查前台 API 代理后重试。',
      timeout: '请求超时，请稍后重试。',
      serviceUnavailable: '服务暂不可用，请稍后重试。',
    },
    es: {
      network: 'Falló la conexión de red. Verifica el proxy API de la tienda e inténtalo de nuevo.',
      timeout: 'La solicitud agotó el tiempo. Inténtalo de nuevo.',
      serviceUnavailable: 'El servicio no está disponible temporalmente. Inténtalo más tarde.',
    },
  }[language] || undefined;
  if (!errorLike.response) {
    if (errorLike.code === 'ECONNABORTED' || /timeout/i.test(errorText)) {
      return localMessages?.timeout || fallback;
    }
    if (/network error|failed to fetch|load failed/i.test(errorText)) {
      return localMessages?.network || fallback;
    }
    return fallback;
  }
  const responseMessage = errorLike.response?.data;
  const responseCode = String(responseMessage?.code || '').trim();
  const status = Number(errorLike.response?.status);
  if (responseCode === 'LOGIN_SERVICE_UNAVAILABLE' || status === 503) {
    return localMessages?.serviceUnavailable || fallback;
  }
  const serverMessage = String(responseMessage?.error || responseMessage?.message || '').trim();

  if (!serverMessage) return fallback;
  if (language === 'en') return serverMessage;
  if (language === 'zh') return hasChineseText(serverMessage) ? serverMessage : fallback;
  if (language === 'es') return hasSpanishSignal(serverMessage) ? serverMessage : fallback;
  return fallback;
};

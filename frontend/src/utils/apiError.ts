import type { Language } from '../i18n';

type ApiErrorLike = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
};

const hasChineseText = (value: string) => /[\u3400-\u9fff]/.test(value);
const hasSpanishSignal = (value: string) =>
  /[áéíóúñü¿¡]/i.test(value) || /\b(el|la|los|las|un|una|pedido|pago|usuario|correo|contraseña|direccion|dirección|envio|envío|reembolso)\b/i.test(value);

export const getApiErrorMessage = (error: unknown, fallback: string, language: Language = 'en') => {
  const responseMessage = (error as ApiErrorLike).response?.data;
  const serverMessage = String(responseMessage?.error || responseMessage?.message || '').trim();

  if (!serverMessage) return fallback;
  if (language === 'en') return serverMessage;
  if (language === 'zh') return hasChineseText(serverMessage) ? serverMessage : fallback;
  if (language === 'es') return hasSpanishSignal(serverMessage) ? serverMessage : fallback;
  return fallback;
};

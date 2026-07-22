import React from 'react';

export type AccessibleMessageAnnouncement = {
  id: number;
  text: string;
  type?: string;
  /** When true, shell renders a lightweight visual toast (no antd message). */
  shellToast?: boolean;
};

type AccessibleMessageListener = (announcement: AccessibleMessageAnnouncement) => void;
type MessageMethodName = 'success' | 'error' | 'warning' | 'info';

const messageMethods: MessageMethodName[] = ['success', 'error', 'warning', 'info'];
const listeners = new Set<AccessibleMessageListener>();
let installed = false;
let installPromise: Promise<void> | null = null;
let announcementId = 0;
let suppressDepth = 0;
let nestedStaticMethodDepth = 0;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const extractAccessibleMessageText = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return normalizeWhitespace(String(value));
  if (Array.isArray(value)) {
    return normalizeWhitespace(value.map(extractAccessibleMessageText).filter(Boolean).join(' '));
  }
  if (React.isValidElement(value)) {
    return extractAccessibleMessageText((value.props as { children?: unknown }).children);
  }
  if (typeof value === 'object') {
    const record = value as { content?: unknown; children?: unknown; props?: { children?: unknown } };
    return extractAccessibleMessageText(record.content ?? record.children ?? record.props?.children);
  }
  return '';
};

const notifyAccessibleMessage = (content: unknown, type?: string, shellToast = false) => {
  if (suppressDepth > 0) return;
  const text = extractAccessibleMessageText(content);
  if (!text) return;
  announcementId += 1;
  const announcement = { id: announcementId, text, type, shellToast };
  listeners.forEach((listener) => listener(announcement));
};

/** Shell-safe toast/status announcement without pulling antd message into callers. */
export const announceAccessibleMessage = (content: unknown, type?: string) => {
  notifyAccessibleMessage(content, type, true);
};

/**
 * Lazy-patch antd static message helpers for a11y live regions.
 * Deferred so the App shell / useAuth path does not statically import antd.
 */
export const installAccessibleMessageAnnouncer = (): Promise<void> => {
  if (installed) return Promise.resolve();
  if (installPromise) return installPromise;

  installPromise = import(/* webpackChunkName: "antd-message" */ 'antd/es/message')
    .then((module) => {
      if (installed) return;
      const message = module.default;
      messageMethods.forEach((methodName) => {
        const originalMethod = message[methodName];
        if (typeof originalMethod !== 'function') return;
        (message as unknown as Record<MessageMethodName, (...args: unknown[]) => unknown>)[methodName] = (...args: unknown[]) => {
          notifyAccessibleMessage(args[0], methodName);
          nestedStaticMethodDepth += 1;
          try {
            return (originalMethod as (...methodArgs: unknown[]) => unknown)(...args);
          } finally {
            nestedStaticMethodDepth -= 1;
          }
        };
      });

      const originalOpen = message.open;
      if (typeof originalOpen === 'function') {
        message.open = ((config: Parameters<typeof originalOpen>[0]) => {
          if (nestedStaticMethodDepth === 0) {
            const configRecord = config as { content?: unknown; type?: string };
            notifyAccessibleMessage(configRecord?.content ?? config, configRecord?.type);
          }
          return originalOpen(config);
        }) as typeof message.open;
      }
      installed = true;
    })
    .catch(() => {
      // Keep shell usable if antd chunk fails; page-level toasts may still work unpatched.
      installPromise = null;
    });

  return installPromise;
};

export const subscribeAccessibleMessages = (listener: AccessibleMessageListener) => {
  listeners.add(listener);
  void installAccessibleMessageAnnouncer();
  return () => {
    listeners.delete(listener);
  };
};

export const runWithoutAccessibleMessageAnnouncement = <T,>(callback: () => T): T => {
  suppressDepth += 1;
  try {
    return callback();
  } finally {
    suppressDepth -= 1;
  }
};

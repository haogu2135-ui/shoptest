import { announceAccessibleMessage } from '../utils/accessibleMessage';

export type ShopMessageContent = unknown;

export type ShopMessageOpenConfig = {
  content?: ShopMessageContent;
  type?: string;
  duration?: number;
  onClose?: () => void;
  key?: string | number;
};

type MessageCloser = () => void;

const emit = (type: string, content: ShopMessageContent): MessageCloser => {
  announceAccessibleMessage(content, type);
  return () => undefined;
};

/**
 * Drop-in replacement for antd static `message` helpers.
 * Routes through shell-safe announceAccessibleMessage (visual shell toast + a11y).
 * Call sites keep `message.success/error/...` ergonomics without importing antd.
 */
const ShopMessage = {
  success: (content: ShopMessageContent, _duration?: number, _onClose?: () => void): MessageCloser =>
    emit('success', content),
  error: (content: ShopMessageContent, _duration?: number, _onClose?: () => void): MessageCloser =>
    emit('error', content),
  warning: (content: ShopMessageContent, _duration?: number, _onClose?: () => void): MessageCloser =>
    emit('warning', content),
  info: (content: ShopMessageContent, _duration?: number, _onClose?: () => void): MessageCloser =>
    emit('info', content),
  loading: (content: ShopMessageContent, _duration?: number, _onClose?: () => void): MessageCloser =>
    emit('info', content),
  open: (config: ShopMessageOpenConfig): MessageCloser =>
    emit(String(config?.type || 'info'), config?.content ?? config),
  destroy: (_key?: string | number): void => undefined,
  config: (_options?: unknown): void => undefined,
};

export default ShopMessage;

import { act, render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { useReconnectingWebSocket } from './useReconnectingWebSocket';

class FakeSocket {
  static instances: FakeSocket[] = [];

  readyState = WebSocket.CONNECTING;
  close = jest.fn(() => {
    this.readyState = WebSocket.CLOSED;
  });
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor() {
    FakeSocket.instances.push(this);
  }

  emitOpen() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new Event('close') as CloseEvent);
  }

  emitError() {
    this.onerror?.(new Event('error'));
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const SocketProbe = ({
  enabled = true,
  connectionKey = 'support-token',
  maxAttempts,
  createSocket,
  onOpen,
  onClose,
  onError,
  onMessage,
  onReconnectExhausted,
}: {
  enabled?: boolean;
  connectionKey?: string;
  maxAttempts?: number;
  createSocket?: () => WebSocket | Promise<WebSocket>;
  onOpen?: jest.Mock;
  onClose?: jest.Mock;
  onError?: jest.Mock;
  onMessage?: jest.Mock;
  onReconnectExhausted?: jest.Mock;
}) => {
  useReconnectingWebSocket({
    enabled,
    connectionKey,
    maxAttempts,
    createSocket: createSocket || (() => new FakeSocket() as unknown as WebSocket),
    onOpen: (_socket, event) => onOpen?.(event.type),
    onClose: (event) => onClose?.(event.type),
    onError: (event) => onError?.(event.type),
    onMessage: (event) => onMessage?.(event.data),
    onReconnectExhausted,
  });
  return null;
};

describe('useReconnectingWebSocket', () => {
  let randomSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    FakeSocket.instances = [];
    jest.useFakeTimers();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    randomSpy.mockRestore();
  });

  it('reconnects with the shared backoff after a close event', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    render(<SocketProbe onOpen={onOpen} onClose={onClose} />);

    expect(FakeSocket.instances).toHaveLength(1);
    act(() => {
      FakeSocket.instances[0].emitOpen();
    });
    expect(onOpen).toHaveBeenCalledWith('open');

    act(() => {
      FakeSocket.instances[0].emitClose();
    });
    expect(onClose).toHaveBeenCalledWith('close');

    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(FakeSocket.instances).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('clears pending reconnect timers and closes the active socket on unmount', () => {
    const { unmount } = render(<SocketProbe />);
    const firstSocket = FakeSocket.instances[0];

    act(() => {
      firstSocket.emitClose();
    });
    unmount();
    expect(firstSocket.close).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('reports reconnect exhaustion once the retry limit is reached', () => {
    const onReconnectExhausted = jest.fn();
    render(<SocketProbe maxAttempts={1} onReconnectExhausted={onReconnectExhausted} />);

    act(() => {
      FakeSocket.instances[0].emitClose();
      jest.advanceTimersByTime(2000);
    });
    expect(FakeSocket.instances).toHaveLength(2);

    act(() => {
      FakeSocket.instances[1].emitClose();
      jest.advanceTimersByTime(30000);
    });
    expect(onReconnectExhausted).toHaveBeenCalledTimes(1);
    expect(onReconnectExhausted).toHaveBeenCalledWith(1);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('supports async socket factories for one-time websocket tickets', async () => {
    const onOpen = jest.fn();
    const createSocket = jest.fn(async () => new FakeSocket() as unknown as WebSocket);

    render(<SocketProbe createSocket={createSocket} onOpen={onOpen} />);

    await act(async () => undefined);
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(1);

    act(() => {
      FakeSocket.instances[0].emitOpen();
    });
    expect(onOpen).toHaveBeenCalledWith('open');
  });

  it('keeps support websocket reconnect state shared between customer and admin surfaces', () => {
    const componentFiles = [
      path.resolve(__dirname, '../components/CustomerSupportWidget.tsx'),
      path.resolve(__dirname, '../pages/SupportManagement.tsx'),
    ];

    componentFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).toContain("from '../hooks/useReconnectingWebSocket'");
      expect(source).toContain('useReconnectingWebSocket({');
      expect(source).not.toContain("from '../utils/reconnectBackoff'");
      expect(source).not.toContain('reconnectTimerRef');
      expect(source).not.toContain('reconnectAttemptRef');
      expect(source).not.toContain('const scheduleReconnect');
      expect(source).not.toContain('getReconnectDelayMs');
    });
  });
});

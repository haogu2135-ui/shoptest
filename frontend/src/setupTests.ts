import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

if (typeof MessageChannel === 'undefined') {
  class TestMessagePort {
    onmessage: ((event: MessageEvent) => void) | null = null;

    postMessage(data: unknown) {
      setTimeout(() => {
        this.onmessage?.({ data } as MessageEvent);
      }, 0);
    }

    start() {}

    close() {}
  }

  Object.defineProperty(globalThis, 'MessageChannel', {
    writable: true,
    value: class TestMessageChannel {
      port1 = new TestMessagePort();

      port2 = new TestMessagePort();

      constructor() {
        this.port1.postMessage = (data: unknown) => {
          setTimeout(() => {
            this.port2.onmessage?.({ data } as MessageEvent);
          }, 0);
        };
        this.port2.postMessage = (data: unknown) => {
          setTimeout(() => {
            this.port1.onmessage?.({ data } as MessageEvent);
          }, 0);
        };
      }
    },
  });
}

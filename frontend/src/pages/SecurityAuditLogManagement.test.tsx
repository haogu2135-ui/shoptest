import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { SecurityAuditLog } from '../types';

jest.mock('../api/admin', () => ({
  adminApi: {
    getAuditLogs: jest.fn(),
    getAuditLogSummary: jest.fn(),
    getMyPermissions: jest.fn(),
    exportAuditLogs: jest.fn(),
    purgeAuditLogs: jest.fn(),
  },
}));

jest.mock('../api', () => ({
  createApiAbortController: () => new AbortController(),
}));

jest.mock('../i18n', () => {
  const t = (key: string, params?: Record<string, string | number>) => {
    let label = key;
    Object.entries(params || {}).forEach(([name, value]) => {
      label = label.replace(`{${name}}`, String(value));
    });
    return label;
  };
  return {
    useLanguage: () => ({ language: 'en', t }),
  };
});

const SecurityAuditLogManagement = require('./SecurityAuditLogManagement').default as
  typeof import('./SecurityAuditLogManagement').default;
const { adminApi: mockAdminApi } = require('../api/admin');

// The page debounces filter edits by 180ms before fetching; wait past it so the
// queued fetch actually fires.
const AUDIT_FILTER_DEBOUNCE_WAIT_MS = 260;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  let reject: Deferred<T>['reject'] = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const buildLog = (id: number, actorUsername: string): SecurityAuditLog => ({
  id,
  action: 'LOGIN',
  result: 'SUCCESS',
  resourceType: 'USER',
  actorUsername,
  actorUserId: id,
  ipAddress: '10.0.0.1',
  createdAt: '2026-08-22T00:00:00',
} as SecurityAuditLog);

const logsResponse = (logs: SecurityAuditLog[]) => ({ data: logs });
const summaryResponse = { data: { totalCount: 0, failureCount: 0, topActors: [], topActions: [] } };

beforeAll(() => {
  class ResizeObserverMock {
    observe() { /* no-op */ }

    unobserve() { /* no-op */ }

    disconnect() { /* no-op */ }
  }
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  (mockAdminApi.getMyPermissions as jest.Mock).mockResolvedValue({
    data: { role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN', permissions: [] },
  });
  (mockAdminApi.getAuditLogSummary as jest.Mock).mockResolvedValue(summaryResponse);
});

const renderPage = () => render(
  <MemoryRouter>
    <SecurityAuditLogManagement />
  </MemoryRouter>,
);

const flushMicrotasks = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('SecurityAuditLogManagement actor filter', () => {
  it('keeps the newest audit rows when a superseded filter fetch resolves last', async () => {
    // Each call parks its resolver so two fetches can be held in flight at once
    // and completed out of order.
    const deferreds: Array<Deferred<ReturnType<typeof logsResponse>>> = [];
    (mockAdminApi.getAuditLogs as jest.Mock).mockImplementation(() => {
      const deferred = createDeferred<ReturnType<typeof logsResponse>>();
      deferreds.push(deferred);
      return deferred.promise;
    });

    renderPage();
    await waitFor(() => {
      expect(deferreds.length).toBeGreaterThan(0);
    });

    // Settle the initial load so the filter row is on screen.
    deferreds[0].resolve(logsResponse([buildLog(1, 'initial-actor')]));
    await flushMicrotasks();

    const actorInput = await screen.findByLabelText(/^pages\.auditLogs\.actor:/);

    // Park the stale fetch, then let a newer one overtake it.
    fireEvent.change(actorInput, { target: { value: 'ana' } });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, AUDIT_FILTER_DEBOUNCE_WAIT_MS); });
    });
    await waitFor(() => {
      expect(deferreds.length).toBe(2);
    });

    fireEvent.change(actorInput, { target: { value: 'bruno' } });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, AUDIT_FILTER_DEBOUNCE_WAIT_MS); });
    });
    await waitFor(() => {
      expect(deferreds.length).toBe(3);
    });

    // The newer fetch answers first; the superseded one then answers with stale
    // rows that must not replace it.
    deferreds[2].resolve(logsResponse([buildLog(3, 'bruno-current')]));
    await flushMicrotasks();
    deferreds[1].resolve(logsResponse([buildLog(2, 'ana-superseded')]));
    await flushMicrotasks();

    expect(screen.getByText('bruno-current')).toBeInTheDocument();
    expect(screen.queryByText('ana-superseded')).not.toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../api/admin', () => ({
  adminApi: {
    getUsersPage: jest.fn(),
    getUserSummary: jest.fn(),
    getRoles: jest.fn(),
    getMyPermissions: jest.fn(),
    exportUsers: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    assignUserRole: jest.fn(),
  },
}));

jest.mock('../api', () => ({
  userApi: {
    getProfile: jest.fn(),
  },
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

jest.mock('../utils/safeStorage', () => ({
  hasStoredValue: () => true,
  getLocalStorageItem: () => null,
  setLocalStorageItem: () => undefined,
}));

const UserManagement = require('./UserManagement').default as typeof import('./UserManagement').default;
const { adminApi: mockAdminApi } = require('../api/admin');
const { userApi: mockUserApi } = require('../api');

// The page debounces keyword input by 300ms before it refetches; waiting past
// that is what lets a queued search actually reach the API mock.
const KEYWORD_DEBOUNCE_WAIT_MS = 400;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: Deferred<T>['resolve'] = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const buildUser = (id: number, username: string) => ({
  id,
  username,
  email: `${username}@example.com`,
  phone: '5550000000',
  role: 'USER',
  roleCode: 'USER',
  status: 'ACTIVE',
});

const usersPage = (users: Array<ReturnType<typeof buildUser>>) => ({
  data: { items: users, page: 1, size: 10, total: users.length },
});

const usersPageWithSize = (users: Array<ReturnType<typeof buildUser>>, size: number) => ({
  data: { items: users, page: 1, size, total: 500 },
});

const summaryResponse = { data: { total: 0, active: 0, disabled: 0, admins: 0, missingEmail: 0, missingPhone: 0 } };

beforeAll(() => {
  class ResizeObserverMock {
    observe() { return undefined; }

    unobserve() { return undefined; }

    disconnect() { return undefined; }
  }
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverMock;
  if (!window.matchMedia) {
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
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  (mockUserApi.getProfile as jest.Mock).mockResolvedValue({ data: { id: 1, role: 'SUPER_ADMIN', roleCode: 'SUPER_ADMIN' } });
  (mockAdminApi.getRoles as jest.Mock).mockResolvedValue({ data: [] });
  (mockAdminApi.getMyPermissions as jest.Mock).mockResolvedValue({ data: [] });
  (mockAdminApi.getUserSummary as jest.Mock).mockResolvedValue(summaryResponse);
});

const renderPage = () => render(
  <MemoryRouter>
    <UserManagement />
  </MemoryRouter>,
);

const flushMicrotasks = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  });
};

describe('UserManagement admin search', () => {
  it('keeps the newest result set when a superseded search resolves last', async () => {
    // Each call parks its resolver so two searches can be in flight at once and
    // completed out of order.
    const deferreds: Array<Deferred<ReturnType<typeof usersPage>>> = [];
    (mockAdminApi.getUsersPage as jest.Mock).mockImplementation(() => {
      const deferred = createDeferred<ReturnType<typeof usersPage>>();
      deferreds.push(deferred);
      return deferred.promise;
    });

    renderPage();
    await waitFor(() => {
      expect(deferreds.length).toBeGreaterThan(0);
    });

    // Resolve the initial load so the table is on screen and the search input
    // is rendered.
    deferreds[0].resolve(usersPage([buildUser(1, 'initial-user')]));
    await flushMicrotasks();

    const searchInput = await screen.findByLabelText(/searchPlaceholder/i);

    // Type the stale keyword, let the debounce fire, and leave that request
    // parked so the later one can overtake it.
    fireEvent.change(searchInput, { target: { value: 'ana' } });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, KEYWORD_DEBOUNCE_WAIT_MS); });
    });
    await waitFor(() => {
      expect(deferreds.length).toBe(2);
    });
    const supersededIndex = 1;

    fireEvent.change(searchInput, { target: { value: 'bruno' } });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, KEYWORD_DEBOUNCE_WAIT_MS); });
    });
    await waitFor(() => {
      expect(deferreds.length).toBe(3);
    });
    const currentIndex = 2;

    // The newer search answers first; the superseded one then answers with a
    // stale page that must not replace it.
    deferreds[currentIndex].resolve(usersPage([buildUser(3, 'bruno-current')]));
    await flushMicrotasks();
    deferreds[supersededIndex].resolve(usersPage([buildUser(2, 'ana-superseded')]));
    await flushMicrotasks();

    expect(screen.getByText('bruno-current')).toBeInTheDocument();
    expect(screen.queryByText('ana-superseded')).not.toBeInTheDocument();
  });

  it('debounces keyword typing into a single request per settled keyword', async () => {
    (mockAdminApi.getUsersPage as jest.Mock).mockResolvedValue(usersPage([buildUser(1, 'initial-user')]));

    renderPage();
    await waitFor(() => {
      expect(mockAdminApi.getUsersPage).toHaveBeenCalledTimes(1);
    });

    const searchInput = await screen.findByLabelText(/searchPlaceholder/i);
    // Five keystrokes inside one debounce window must collapse into one fetch
    // rather than one request per character.
    ['a', 'an', 'ana', 'anab', 'anabel'].forEach((value) => {
      fireEvent.change(searchInput, { target: { value } });
    });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, KEYWORD_DEBOUNCE_WAIT_MS); });
    });

    await waitFor(() => {
      expect(mockAdminApi.getUsersPage).toHaveBeenCalledTimes(2);
    });
    expect(mockAdminApi.getUsersPage).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'anabel' }));
  });

  it('keeps the operator page size when a filter change refetches', async () => {
    // The server echoes back the size the operator selected (50). A later filter
    // edit must reuse it instead of snapping back to the 20-row default.
    (mockAdminApi.getUsersPage as jest.Mock).mockResolvedValue(
      usersPageWithSize([buildUser(1, 'initial-user')], 50),
    );

    renderPage();
    await waitFor(() => {
      expect(mockAdminApi.getUsersPage).toHaveBeenCalledTimes(1);
    });

    const searchInput = await screen.findByLabelText(/searchPlaceholder/i);
    fireEvent.change(searchInput, { target: { value: 'ana' } });
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, KEYWORD_DEBOUNCE_WAIT_MS); });
    });

    await waitFor(() => {
      expect(mockAdminApi.getUsersPage).toHaveBeenCalledTimes(2);
    });
    expect(mockAdminApi.getUsersPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'ana', size: 50 }),
    );
  });
});

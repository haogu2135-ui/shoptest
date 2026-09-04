import { cartApi } from '../api';
import { openCartDrawerWithSnapshot } from './cartDrawer';
import { dispatchDomEvent } from './domEvents';
import { reportNonBlockingError } from './nonBlockingError';

jest.mock('../api', () => ({
  cartApi: { getItems: jest.fn() },
}));

jest.mock('./domEvents', () => ({
  dispatchDomEvent: jest.fn(() => true),
}));

jest.mock('./guestCart', () => ({
  getGuestCartItems: jest.fn(() => []),
}));

jest.mock('./nonBlockingError', () => ({
  reportNonBlockingError: jest.fn(),
}));

jest.mock('./safeStorage', () => ({
  hasStoredValue: jest.fn(() => true),
}));

const mockGetItems = cartApi.getItems as jest.Mock;
const mockDispatchDomEvent = dispatchDomEvent as jest.Mock;
const mockReportNonBlockingError = reportNonBlockingError as jest.Mock;

describe('openCartDrawerWithSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes a lifecycle signal to authenticated cart snapshots', async () => {
    const controller = new AbortController();
    mockGetItems.mockResolvedValueOnce({ data: [] });

    await openCartDrawerWithSnapshot({ authenticated: true, signal: controller.signal });

    expect(mockGetItems).toHaveBeenCalledWith(0, { signal: controller.signal });
    expect(mockDispatchDomEvent).toHaveBeenCalledWith('shop:open-cart', { items: [] });
  });

  it('does not open a stale fallback when the snapshot is aborted', async () => {
    const controller = new AbortController();
    let resolveRequest: (response: { data: [] }) => void = () => undefined;
    mockGetItems.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const snapshotRequest = openCartDrawerWithSnapshot({ authenticated: true, signal: controller.signal });
    controller.abort();
    resolveRequest({ data: [] });

    await expect(snapshotRequest).resolves.toBe(false);
    expect(mockDispatchDomEvent).not.toHaveBeenCalled();
    expect(mockReportNonBlockingError).not.toHaveBeenCalled();
  });
});

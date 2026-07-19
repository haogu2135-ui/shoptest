import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SeventeenTrackWidget from './SeventeenTrackWidget';
import { logisticsApi } from '../api';
import { dispatchDomEvent } from '../utils/domEvents';

jest.mock('../api', () => ({
  logisticsApi: {
    track: jest.fn(),
  },
}));

jest.mock('../utils/domEvents', () => ({
  dispatchDomEvent: jest.fn(),
}));

const translate = (key: string) => {
  const labels: Record<string, string> = {
    'common.loading': 'Loading...',
    'common.status': 'Status',
    'pages.adminOrders.noTrackingNumber': 'No tracking number',
    'pages.adminOrders.track': 'Track',
    'pages.orderTracking.noTrackingData': 'No tracking data',
    'pages.orderTracking.trackingUnavailable': 'Live carrier tracking is not configured yet',
    'pages.orderTracking.trackingFailed': 'Failed to query logistics',
    'pages.orderTracking.trackingNumber': 'Tracking number',
    'pages.orderTracking.trackShipment': 'Track shipment',
    'pages.orderTracking.logistics': 'Logistics',
    'pages.orderTracking.title': 'Order tracking',
    'pages.orderTracking.copyTrackingNumber': 'Copy tracking number',
    'pages.orderTracking.trackingNumberCopied': 'Tracking number copied',
    'pages.orderTracking.copyTrackingFailed': 'Could not copy tracking number',
    'pages.orderTracking.emptyRecoveryHint': 'No live events yet. Copy the number, retry tracking, or contact support.',
    'pages.orderTracking.retryTracking': 'Retry tracking',
    'pages.profile.contactSupport': 'Contact support',
  };
  return labels[key] || key;
};

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    language: 'en',
    t: translate,
  }),
}));

describe('SeventeenTrackWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('keeps the empty state local and does not load the 17TRACK script on mount', () => {
    render(<SeventeenTrackWidget />);

    expect(logisticsApi.track).not.toHaveBeenCalled();
    expect(document.getElementById('seventeen-track-external-call')).toBeNull();
    expect(document.querySelector('script[src*="17track.net"]')).toBeNull();
    expect(screen.getByText('No tracking data')).toBeInTheDocument();
    expect(screen.getByText(/Copy the number, retry tracking/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contact support/i })).toBeInTheDocument();
  });

  it('queries the backend logistics API when the user searches', async () => {
    (logisticsApi.track as jest.Mock).mockResolvedValue({
      data: {
        trackingNumber: '1Z999',
        carrier: 'UPS',
        status: 'IN_TRANSIT',
        summary: 'Shipment is moving',
        events: [{
          time: '2026-05-27T08:00:00',
          location: 'Sorting center',
          description: 'Departed facility',
        }],
      },
    });

    render(<SeventeenTrackWidget carrierCode="UPS" />);

    fireEvent.change(screen.getByPlaceholderText('Tracking number'), { target: { value: ' 1Z999 ' } });
    fireEvent.click(screen.getByRole('button', { name: /Track shipment/i }));

    await waitFor(() => expect(logisticsApi.track).toHaveBeenCalledWith('1Z999', 'UPS', undefined, undefined, undefined));
    expect(await screen.findByText('Departed facility')).toBeInTheDocument();
    expect(screen.getByText('Shipment is moving')).toBeInTheDocument();
  });

  it('shows a clean no-data state when production logistics provider is not configured', async () => {
    (logisticsApi.track as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Production logistics tracking provider is not configured' } },
    });

    render(<SeventeenTrackWidget trackingNumber="NO_PROVIDER" />);

    await waitFor(() => expect(logisticsApi.track).toHaveBeenCalledWith('NO_PROVIDER', undefined, undefined, undefined, undefined));
    expect(await screen.findByText('EXTERNAL_EMPTY')).toBeInTheDocument();
    expect(screen.getAllByText('No tracking data').length).toBeGreaterThan(0);
    expect(screen.queryByText('Production logistics tracking provider is not configured')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy tracking number/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry tracking/i })).toBeInTheDocument();
  });

  it('explains transparent backend no-provider responses without fake events', async () => {
    (logisticsApi.track as jest.Mock).mockResolvedValue({
      data: {
        trackingNumber: 'NO_PROVIDER',
        carrier: 'STANDARD',
        status: 'TRACKING_UNAVAILABLE',
        summary: 'Real-time logistics tracking is not configured yet.',
        events: [],
      },
    });

    render(<SeventeenTrackWidget trackingNumber="NO_PROVIDER" />);

    await waitFor(() => expect(logisticsApi.track).toHaveBeenCalledWith('NO_PROVIDER', undefined, undefined, undefined, undefined));
    expect(await screen.findByText('TRACKING_UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('Live carrier tracking is not configured yet')).toBeInTheDocument();
    expect(screen.getAllByText('Real-time logistics tracking is not configured yet.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy tracking number/i })).toBeInTheDocument();
  });

  it('copies tracking number and opens support from empty recovery actions', async () => {
    render(<SeventeenTrackWidget trackingNumber="TRACK-42" />);

    fireEvent.click(await screen.findByRole('button', { name: /copy tracking number/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TRACK-42'));

    fireEvent.click(screen.getByRole('button', { name: /contact support/i }));
    expect(dispatchDomEvent).toHaveBeenCalledWith('shop:open-support', expect.objectContaining({
      clearGuestContext: false,
    }));
  });
});

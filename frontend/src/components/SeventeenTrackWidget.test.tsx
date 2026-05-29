import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SeventeenTrackWidget from './SeventeenTrackWidget';
import { logisticsApi } from '../api';

jest.mock('../api', () => ({
  logisticsApi: {
    track: jest.fn(),
  },
}));

const translate = (key: string) => {
  const labels: Record<string, string> = {
    'common.loading': 'Loading...',
    'common.status': 'Status',
    'pages.adminOrders.noTrackingNumber': 'No tracking number',
    'pages.adminOrders.rawTrackingData': 'Provider returned raw tracking data.',
    'pages.adminOrders.track': 'Track',
    'pages.orderTracking.noTrackingData': 'No tracking data',
    'pages.orderTracking.trackingFailed': 'Failed to query logistics',
    'pages.orderTracking.trackingNumber': 'Tracking number',
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
  });

  it('keeps the empty state local and does not load the 17TRACK script on mount', () => {
    render(<SeventeenTrackWidget />);

    expect(logisticsApi.track).not.toHaveBeenCalled();
    expect(document.getElementById('seventeen-track-external-call')).toBeNull();
    expect(document.querySelector('script[src*="17track.net"]')).toBeNull();
    expect(screen.getByText('No tracking data')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /track/i }));

    await waitFor(() => expect(logisticsApi.track).toHaveBeenCalledWith('1Z999', 'UPS'));
    expect(await screen.findByText('Departed facility')).toBeInTheDocument();
    expect(screen.getByText('Shipment is moving')).toBeInTheDocument();
  });

  it('shows a clean no-data state when production logistics provider is not configured', async () => {
    (logisticsApi.track as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Production logistics tracking provider is not configured' } },
    });

    render(<SeventeenTrackWidget trackingNumber="NO_PROVIDER" />);

    await waitFor(() => expect(logisticsApi.track).toHaveBeenCalledWith('NO_PROVIDER', undefined));
    expect(await screen.findByText('EXTERNAL_EMPTY')).toBeInTheDocument();
    expect(screen.getAllByText('No tracking data').length).toBeGreaterThan(0);
    expect(screen.queryByText('Production logistics tracking provider is not configured')).not.toBeInTheDocument();
  });
});

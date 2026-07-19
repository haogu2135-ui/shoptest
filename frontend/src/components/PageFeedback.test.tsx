import { fireEvent, render, screen } from '@testing-library/react';
import PageEmpty from './PageEmpty';
import PageError from './PageError';

describe('PageFeedback components', () => {
  it('renders a recoverable page error with accessible actions', () => {
    const onRetry = jest.fn();
    const onHome = jest.fn();

    render(
      <PageError
        title="Failed to Load"
        description="Unable to load data. Please check your connection and try again."
        retryLabel="Retry"
        onRetry={onRetry}
        homeLabel="Home"
        onHome={onHome}
      />,
    );

    expect(screen.getByRole('alert')).toHaveClass('page-feedback--error');
    expect(screen.getByText('Failed to Load')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('renders an empty state with guided actions', () => {
    const onBrowse = jest.fn();

    render(
      <PageEmpty
        description="No products found"
        primaryAction={{
          key: 'browse',
          label: 'Browse products',
          onClick: onBrowse,
        }}
      />,
    );

    expect(screen.getByRole('status')).toHaveClass('page-feedback--empty');
    fireEvent.click(screen.getByRole('button', { name: 'Browse products' }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

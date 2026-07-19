import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShopBreadcrumb from './ShopBreadcrumb';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ShopBreadcrumb', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders commercial breadcrumb trail and navigates parent crumbs', () => {
    render(
      <MemoryRouter>
        <ShopBreadcrumb
          ariaLabel="Checkout path"
          items={[
            { key: 'home', label: 'Home', path: '/' },
            { key: 'cart', label: 'Cart', path: '/cart' },
            { key: 'checkout', label: 'Confirm order' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Checkout path')).toBeInTheDocument();
    expect(screen.getByText('Confirm order')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Cart' }));
    expect(mockNavigate).toHaveBeenCalledWith('/cart');
  });
});

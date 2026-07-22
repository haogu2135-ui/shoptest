import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopPopconfirm from './ShopPopconfirm';

describe('ShopPopconfirm', () => {
  it('opens commercial confirm chrome and runs onConfirm', () => {
    const onConfirm = jest.fn();
    render(
      <ShopPopconfirm
        title="Remove item?"
        okText="Confirm delete"
        cancelText="Cancel"
        okDanger
        onConfirm={onConfirm}
      >
        <button type="button">Delete trigger</button>
      </ShopPopconfirm>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete trigger' }));
    expect(screen.getByRole('alertdialog')).toHaveClass('shop-popconfirm__panel');
    expect(screen.getByText('Remove item?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onConfirm).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('closes from cancel without confirming', () => {
    const onConfirm = jest.fn();
    render(
      <ShopPopconfirm title="Clear blocked?" okText="Clear" cancelText="Cancel" onConfirm={onConfirm}>
        <button type="button">Open</button>
      </ShopPopconfirm>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShopPopconfirm from './ShopPopconfirm';

describe('ShopPopconfirm', () => {
  it('keeps trigger cloning typed without broad any casts', () => {
    const source = require('fs').readFileSync(require('path').resolve(__dirname, 'ShopPopconfirm.tsx'), 'utf8') as string;

    expect(source).toContain('type ShopPopconfirmTriggerProps = {');
    expect(source).not.toContain('React.ReactElement<any>');
    expect(source).not.toContain('children as React.ReactElement<any>');
  });

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

  it('allows long confirmation identities to wrap in the mobile panel', () => {
    const css = require('fs').readFileSync(require('path').resolve(__dirname, 'ShopPopconfirm.css'), 'utf8') as string;

    expect(css).toMatch(/\.shop-popconfirm__panel\s*\{[\s\S]*?min-width:\s*0;/);
    expect(css).toMatch(/\.shop-popconfirm__title,[\s\S]*?\.shop-popconfirm__description\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/);
  });

  it('traps focus, labels the dismiss mask, and waits for async confirmation', async () => {
    jest.useFakeTimers();
    const onConfirm = jest.fn(() => Promise.resolve());
    const { container } = render(
      <ShopPopconfirm title="Confirm" dismissLabel="Close confirmation" onConfirm={onConfirm}>
        <button type="button">Open</button>
      </ShopPopconfirm>,
    );
    const trigger = container.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);
    jest.runOnlyPendingTimers();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close confirmation' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByRole('button', { name: 'OK' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    jest.useRealTimers();
  });

  it('keeps the confirmation open when async confirmation fails', async () => {
    const onConfirm = jest.fn(() => Promise.reject(new Error('failed')));
    render(
      <ShopPopconfirm title="Confirm" onConfirm={onConfirm}>
        <button type="button">Open failure case</button>
      </ShopPopconfirm>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open failure case' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopModal from './ShopModal';

describe('ShopModal', () => {
  it('renders commercial modal chrome and closes from close control', () => {
    const onClose = jest.fn();
    const onOk = jest.fn();
    const { rerender } = render(
      <ShopModal
        open
        onClose={onClose}
        onOk={onOk}
        title="Quick add"
        okText="Add"
        cancelText="Cancel"
        ariaLabel="Quick add product"
        closeLabel="Close modal"
      >
        <div>Modal body</div>
      </ShopModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Quick add product' })).toHaveClass('shop-modal__panel');
    expect(screen.getByText('Modal body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onOk).toHaveBeenCalled();

    const closeButtons = screen.getAllByRole('button', { name: 'Close modal' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ShopModal open={false} onClose={onClose} title="Quick add">
        hidden
      </ShopModal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports footer-less preview chrome', () => {
    const onClose = jest.fn();
    render(
      <ShopModal open onClose={onClose} title={null} footer={null} width={860} closeLabel="Close preview">
        <div>Preview body</div>
      </ShopModal>,
    );

    expect(screen.getByText('Preview body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Close preview' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('wires confirmLoading onto the primary action', () => {
    const onClose = jest.fn();
    const onOk = jest.fn();
    render(
      <ShopModal
        open
        onClose={onClose}
        onOk={onOk}
        title="Saving"
        okText="Save"
        cancelText="Cancel"
        confirmLoading
        closeLabel="Close modal"
      >
        <div>Busy body</div>
      </ShopModal>,
    );

    const okButton = screen.getByRole('button', { name: 'Save' });
    expect(okButton.className).toMatch(/ant-btn-loading/);
  });

  it('hides close control when closable is false', () => {
    const onClose = jest.fn();
    render(
      <ShopModal
        open
        onClose={onClose}
        closable={false}
        maskClosable={false}
        title="Required update"
        footer={null}
        closeLabel="Close modal"
      >
        <div>Force update body</div>
      </ShopModal>,
    );

    expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

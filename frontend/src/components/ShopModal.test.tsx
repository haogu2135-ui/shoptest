import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopModal from './ShopModal';

const readShopModalCss = () => fs.readFileSync(path.resolve(__dirname, 'ShopModal.css'), 'utf8');

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

  it('keeps non-text titles accessible when no explicit label is supplied', () => {
    render(
      <ShopModal open onClose={jest.fn()} title={<span aria-hidden="true">Rich title</span>} titleAriaLabel="Rich preview" footer={null} closeLabel="Close preview">
        Preview body
      </ShopModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Rich preview' })).toBeInTheDocument();
  });

  it('mounts an open dialog directly in the document body', () => {
    const onClose = jest.fn();
    const { container } = render(
      <div className="page-shell">
        <ShopModal open onClose={onClose} title="Top-level dialog">
          <div>Dialog body</div>
        </ShopModal>
      </div>,
    );

    const modalRoot = document.querySelector('.shop-modal');
    expect(modalRoot).not.toBeNull();
    expect(modalRoot?.parentElement).toBe(document.body);
    expect(container.contains(modalRoot)).toBe(false);
  });

  it('keeps ordinary dialogs above the native bottom navigation layer', () => {
    expect(readShopModalCss()).toMatch(/\.shop-modal\s*\{[\s\S]*?z-index:\s*var\(--shop-z-modal\);/);
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

  it('traps keyboard focus inside the dialog and restores trigger focus on close', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open modal';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <ShopModal
        open
        onClose={onClose}
        onOk={() => undefined}
        title="Focus trap"
        okText="Confirm"
        cancelText="Cancel"
        closeLabel="Close modal"
      >
        <button type="button">Body action</button>
      </ShopModal>,
    );

    jest.runOnlyPendingTimers();
    const closeControl = document.querySelector('.shop-modal__close') as HTMLButtonElement;
    expect(closeControl).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeControl).toHaveFocus();

    rerender(
      <ShopModal open={false} onClose={onClose} title="Focus trap">
        hidden
      </ShopModal>,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
    jest.useRealTimers();
  });
});

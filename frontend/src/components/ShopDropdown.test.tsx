import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopDropdown from './ShopDropdown';

describe('ShopDropdown', () => {
  it('opens menu and runs item onClick', () => {
    const onOpenChange = jest.fn();
    const onClick = jest.fn();
    render(
      <ShopDropdown
        open
        onOpenChange={onOpenChange}
        items={[
          { key: 'a', label: 'Track order', onClick },
          { key: 'b', label: 'Help', onClick: jest.fn() },
        ]}
      >
        <button type="button">More</button>
      </ShopDropdown>,
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Track order' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('supports controlled open toggle from trigger', () => {
    const onOpenChange = jest.fn();
    render(
      <ShopDropdown
        open={false}
        onOpenChange={onOpenChange}
        items={[{ key: 'a', label: 'Login', onClick: jest.fn() }]}
      >
        <button type="button">Account</button>
      </ShopDropdown>,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('expands nested submenu items', () => {
    const onLanguage = jest.fn();
    render(
      <ShopDropdown
        open
        items={[
          {
            key: 'locale',
            label: 'Language / Currency',
            children: [
              { key: 'language-title', label: 'Language', disabled: true },
              { key: 'lang-es', label: 'Español', onClick: onLanguage },
            ],
          },
        ]}
      >
        <button type="button">More</button>
      </ShopDropdown>,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /Language \/ Currency/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Español' }));
    expect(onLanguage).toHaveBeenCalledTimes(1);
  });

  it('renders dividers and disabled section titles', () => {
    render(
      <ShopDropdown
        open
        items={[
          { key: 'title', label: 'Currency', disabled: true },
          { key: 'div', type: 'divider' },
          { key: 'mxn', label: 'MXN', onClick: jest.fn() },
        ]}
      >
        <button type="button">Locale</button>
      </ShopDropdown>,
    );
    expect(screen.getByRole('menuitem', { name: 'Currency' })).toBeDisabled();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});

import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ShopTabs from './ShopTabs';

const cssSource = fs.readFileSync(path.resolve(__dirname, 'ShopTabs.css'), 'utf8');

describe('ShopTabs', () => {
  it('switches panels and keeps dual ant-tabs classes', () => {
    const { container } = render(
      <ShopTabs
        items={[
          { key: 'a', label: 'Alpha', children: <div>Panel A</div> },
          { key: 'b', label: 'Beta', children: <div>Panel B</div> },
        ]}
      />,
    );
    expect(container.querySelector('.shop-tabs')).toHaveClass('ant-tabs');
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });

  it('keeps tab triggers on a commercial touch target', () => {
    expect(cssSource).toMatch(/\.shop-tabs__tab\s*\{[^}]*min-height:\s*44px/);
    expect(cssSource).not.toMatch(/\.shop-tabs__tab\s*\{[^}]*min-height:\s*(?:3[0-9]|4[0-3])px/);
  });
});

  it('moves focus and activation with arrow keys', () => {
    jest.useFakeTimers();
    render(
      <ShopTabs
        items={[
          { key: 'a', label: 'Alpha', children: <div>Panel A</div> },
          { key: 'b', label: 'Beta', children: <div>Panel B</div> },
        ]}
      />,
    );
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    expect(screen.getByText('Panel B')).toBeInTheDocument();
    jest.runOnlyPendingTimers();
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('tabIndex', '0');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    jest.useRealTimers();
  });

  it('starts on the first enabled tab when the default tab is disabled', () => {
    render(
      <ShopTabs
        defaultActiveKey="disabled"
        items={[
          { key: 'disabled', label: 'Disabled', disabled: true, children: <div>Disabled panel</div> },
          { key: 'enabled', label: 'Enabled', children: <div>Enabled panel</div> },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Enabled' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Enabled panel')).toBeInTheDocument();
  });

  it('normalizes an invalid tab gutter to a stable non-negative value', () => {
    render(<ShopTabs tabBarGutter={Number.NaN} items={[{ key: 'a', label: 'Alpha' }]} />);
    expect(screen.getByRole('tab', { name: 'Alpha' }).parentElement).toHaveStyle({ gap: '16px' });
  });

  it('keeps arrow navigation anchored to the enabled fallback tab', () => {
    jest.useFakeTimers();
    render(
      <ShopTabs
        defaultActiveKey="disabled"
        items={[
          { key: 'disabled', label: 'Disabled', disabled: true },
          { key: 'enabled', label: 'Enabled' },
          { key: 'last', label: 'Last' },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Enabled' }), { key: 'ArrowRight' });
    jest.runOnlyPendingTimers();
    expect(screen.getByRole('tab', { name: 'Last' })).toHaveAttribute('aria-selected', 'true');
    jest.useRealTimers();
  });

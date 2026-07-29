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

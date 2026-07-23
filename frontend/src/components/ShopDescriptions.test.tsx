import React from 'react';
import { render, screen } from '@testing-library/react';
import ShopDescriptions from './ShopDescriptions';

describe('ShopDescriptions', () => {
  it('renders dual ant-descriptions classes with items', () => {
    const { container } = render(
      <ShopDescriptions column={1} size="small" bordered>
        <ShopDescriptions.Item label="Path">/var/log</ShopDescriptions.Item>
        <ShopDescriptions.Item label="Level">INFO</ShopDescriptions.Item>
      </ShopDescriptions>,
    );
    expect(container.querySelector('.shop-descriptions.ant-descriptions.ant-descriptions-bordered')).toBeTruthy();
    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('/var/log')).toBeInTheDocument();
    expect(screen.getByText('INFO')).toBeInTheDocument();
  });
});

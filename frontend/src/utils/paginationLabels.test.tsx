import React from 'react';
import { buildPaginationItemRender } from './paginationLabels';

describe('pagination label helpers', () => {
  it('labels AntD previous, next, and jump pagination controls', () => {
    const itemRender = buildPaginationItemRender(
      'Previous page: Audit logs',
      'Next page: Audit logs',
      'Previous pages: Audit logs',
      'Next pages: Audit logs',
    );

    const previous = itemRender(1, 'prev', <button type="button" />);
    const next = itemRender(1, 'next', <button type="button" />);
    const jumpPrevious = itemRender(1, 'jump-prev', <a href="#previous">...</a>);
    const jumpNext = itemRender(1, 'jump-next', <a href="#next">...</a>);

    expect(React.isValidElement(previous) ? previous.props['aria-label'] : undefined).toBe('Previous page: Audit logs');
    expect(React.isValidElement(next) ? next.props.title : undefined).toBe('Next page: Audit logs');
    expect(React.isValidElement(jumpPrevious) ? jumpPrevious.props['aria-label'] : undefined).toBe('Previous pages: Audit logs');
    expect(React.isValidElement(jumpNext) ? jumpNext.props.title : undefined).toBe('Next pages: Audit logs');
  });
});

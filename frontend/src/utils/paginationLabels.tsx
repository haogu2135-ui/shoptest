import React from 'react';

export const labelPaginationControl = (element: React.ReactNode, label: string) => {
  if (!React.isValidElement(element)) return element;
  return React.cloneElement(element as React.ReactElement<Record<string, unknown>>, {
    'aria-label': label,
    title: label,
  });
};

export const buildPaginationItemRender = (previousPageLabel: string, nextPageLabel: string) =>
  (_page: number, type: string, element: React.ReactNode) => {
    if (type === 'prev') return labelPaginationControl(element, previousPageLabel);
    if (type === 'next') return labelPaginationControl(element, nextPageLabel);
    return element;
  };

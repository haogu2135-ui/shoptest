import React from 'react';

export const labelTableSelectionCheckbox = (checkboxNode: React.ReactNode, label: string) => {
  if (!React.isValidElement(checkboxNode)) return checkboxNode;
  return React.cloneElement(checkboxNode as React.ReactElement<Record<string, unknown>>, {
    'aria-label': label,
    title: label,
  });
};

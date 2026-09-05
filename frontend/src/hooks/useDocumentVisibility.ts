import { useEffect, useState } from 'react';

export const getDocumentVisibility = () => (
  typeof document === 'undefined' || document.visibilityState !== 'hidden'
);

export const useDocumentVisibility = () => {
  const [visible, setVisible] = useState(getDocumentVisibility);

  useEffect(() => {
    const syncVisibility = () => setVisible(getDocumentVisibility());
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  return visible;
};

export default useDocumentVisibility;

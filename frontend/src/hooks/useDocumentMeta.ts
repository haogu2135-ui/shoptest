import { useEffect, useMemo } from 'react';
import {
  applyDocumentMeta,
  applyJsonLd,
  captureDocumentMeta,
  removeJsonLd,
  restoreDocumentMeta,
  type DocumentMetaInput,
} from '../utils/documentMeta';

export type UseDocumentMetaOptions = DocumentMetaInput & {
  jsonLdId?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  enabled?: boolean;
};

/**
 * Applies commercial storefront document meta (description, Open Graph, Twitter,
 * canonical, robots) and optional JSON-LD for the active route. Restores the
 * previous snapshot on unmount so SPA navigations do not leak product SEO.
 */
export const useDocumentMeta = (options: UseDocumentMetaOptions) => {
  const {
    description,
    imageUrl,
    path,
    type,
    noIndex,
    siteName,
    title,
    jsonLdId,
    jsonLd,
    enabled = true,
  } = options;

  const jsonLdSignature = useMemo(
    () => (jsonLd ? JSON.stringify(jsonLd) : ''),
    [jsonLd],
  );

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return undefined;
    }

    const snapshot = captureDocumentMeta();
    applyDocumentMeta({
      description,
      imageUrl,
      path,
      type,
      noIndex,
      siteName,
      title,
    });

    if (jsonLdId) {
      const parsedJsonLd = jsonLdSignature
        ? JSON.parse(jsonLdSignature) as Record<string, unknown> | Array<Record<string, unknown>>
        : null;
      applyJsonLd(jsonLdId, parsedJsonLd);
    }

    return () => {
      if (jsonLdId) {
        removeJsonLd(jsonLdId);
      }
      restoreDocumentMeta(snapshot);
    };
  }, [
    description,
    enabled,
    imageUrl,
    jsonLdId,
    jsonLdSignature,
    noIndex,
    path,
    siteName,
    title,
    type,
  ]);
};

export default useDocumentMeta;

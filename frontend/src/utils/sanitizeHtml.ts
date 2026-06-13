import DOMPurify from 'dompurify';
import type { Config as DOMPurifyConfig } from 'dompurify';

const removeWithContentTags = [
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'frameset',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'textarea',
] as const;

const allowedRichTextTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
] as const;

const globalAllowedAttributes = new Set(['aria-label', 'dir', 'lang', 'title']);
const tagAllowedAttributes = new Map<string, Set<string>>([
  ['a', new Set(['href', 'target'])],
  ['img', new Set(['alt', 'height', 'src', 'width'])],
  ['ol', new Set(['start', 'type'])],
  ['td', new Set(['colspan', 'rowspan'])],
  ['th', new Set(['colspan', 'rowspan'])],
]);

const allowedAnchorTargets = new Set(['_blank', '_self', '_parent', '_top']);
const anchorProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const mediaProtocols = new Set(['http:', 'https:']);
const allowedRichTextTagSet = new Set<string>(allowedRichTextTags);
const domPurifyConfig: DOMPurifyConfig = {
  ALLOWED_TAGS: [...allowedRichTextTags],
  ALLOWED_ATTR: Array.from(new Set([
    ...Array.from(globalAllowedAttributes),
    ...Array.from(tagAllowedAttributes.values()).flatMap((attributes) => Array.from(attributes)),
    'rel',
  ])),
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_TAGS: [...removeWithContentTags],
  FORBID_CONTENTS: [...removeWithContentTags],
};

const hasUnsafeControlCharacter = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });

const isAllowedUrl = (value: string, allowedProtocols: Set<string>) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return true;
  const normalized = trimmed.toLowerCase();
  if (hasUnsafeControlCharacter(trimmed) || trimmed.includes('\\') || normalized.includes('%00') || normalized.includes('%5c')) {
    return false;
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
    const url = new URL(trimmed, baseUrl);
    if (url.username || url.password) return false;
    return allowedProtocols.has(url.protocol);
  } catch (_error) {
    return false;
  }
};

const isAllowedAttribute = (tagName: string, attributeName: string) =>
  globalAllowedAttributes.has(attributeName)
  || tagAllowedAttributes.get(tagName)?.has(attributeName) === true;

const normalizePlainAttribute = (value: string) =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, 500);

const normalizePositiveIntegerAttribute = (value: string, max: number) => {
  const normalized = value.trim();
  if (!/^\d{1,4}$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null;
  return String(parsed);
};

const sanitizeAllowedAttribute = (
  node: Element,
  tagName: string,
  attributeName: string,
  originalName: string,
  value: string
) => {
  if (attributeName === 'href') {
    if (!isAllowedUrl(value, anchorProtocols)) {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'src') {
    if (tagName !== 'img' || !isAllowedUrl(value, mediaProtocols)) {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'target') {
    const normalizedTarget = value.toLowerCase();
    if (!allowedAnchorTargets.has(normalizedTarget)) {
      node.removeAttribute(originalName);
      return;
    }
    if (normalizedTarget !== value) {
      node.setAttribute(originalName, normalizedTarget);
    }
    return;
  }

  if (attributeName === 'width' || attributeName === 'height') {
    const normalized = normalizePositiveIntegerAttribute(value, 2000);
    if (normalized) {
      node.setAttribute(originalName, normalized);
    } else {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'colspan' || attributeName === 'rowspan') {
    const normalized = normalizePositiveIntegerAttribute(value, 20);
    if (normalized) {
      node.setAttribute(originalName, normalized);
    } else {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'start') {
    const normalized = normalizePositiveIntegerAttribute(value, 9999);
    if (normalized) {
      node.setAttribute(originalName, normalized);
    } else {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'type') {
    if (!/^[1aAiI]$/.test(value.trim())) {
      node.removeAttribute(originalName);
    }
    return;
  }

  if (attributeName === 'dir') {
    const normalized = value.toLowerCase().trim();
    if (!['auto', 'ltr', 'rtl'].includes(normalized)) {
      node.removeAttribute(originalName);
    } else {
      node.setAttribute(originalName, normalized);
    }
    return;
  }

  if (attributeName === 'lang' && !/^[a-zA-Z0-9-]{1,20}$/.test(value.trim())) {
    node.removeAttribute(originalName);
    return;
  }

  const normalizedText = normalizePlainAttribute(value);
  if (normalizedText) {
    node.setAttribute(originalName, normalizedText);
  } else {
    node.removeAttribute(originalName);
  }
};

DOMPurify.addHook('uponSanitizeAttribute', (node, hookEvent) => {
  const tagName = node.tagName.toLowerCase();
  const attributeName = hookEvent.attrName.toLowerCase();
  if (!allowedRichTextTagSet.has(tagName)
      || attributeName.startsWith('on')
      || attributeName === 'srcdoc'
      || attributeName === 'style'
      || !isAllowedAttribute(tagName, attributeName)) {
    hookEvent.keepAttr = false;
    return;
  }
  sanitizeAllowedAttribute(node, tagName, attributeName, hookEvent.attrName, hookEvent.attrValue);
  hookEvent.attrValue = node.getAttribute(hookEvent.attrName) || hookEvent.attrValue;
  hookEvent.keepAttr = node.hasAttribute(hookEvent.attrName);
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName.toLowerCase() === 'a' && node.getAttribute('target')?.toLowerCase() === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const stripUnsafeHtml = (html: string) => {
  return DOMPurify.sanitize(String(html || ''), domPurifyConfig) as string;
};

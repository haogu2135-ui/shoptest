const blockedTags = 'script, iframe, object, embed, link, meta, style, form, input, button, svg, math, frame, frameset, base';
const urlAttributes = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);
const allowedAnchorTargets = new Set(['_blank', '_self', '_parent', '_top']);

const isAllowedUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const url = new URL(trimmed, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export const stripUnsafeHtml = (html: string) => {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll(blockedTags).forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
        node.removeAttribute(attr.name);
        return;
      }
      if (urlAttributes.has(name) && !isAllowedUrl(value)) {
        node.removeAttribute(attr.name);
      }
    });
    if (node.tagName.toLowerCase() === 'a') {
      const target = node.getAttribute('target');
      if (target && !allowedAnchorTargets.has(target.toLowerCase())) {
        node.removeAttribute('target');
      }
      if (node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
  return template.innerHTML;
};

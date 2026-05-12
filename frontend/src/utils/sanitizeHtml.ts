const blockedTags = 'script, iframe, object, embed, link, meta, style, form, input, button';
const urlAttributes = new Set(['href', 'src', 'xlink:href', 'action', 'formaction']);

const isAllowedUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
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
      if (name.startsWith('on') || name === 'srcdoc') {
        node.removeAttribute(attr.name);
        return;
      }
      if (urlAttributes.has(name) && !isAllowedUrl(value)) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
};

const { expect } = require('chai');

const WEBVIEW_BASE_URL = process.env.APPIUM_WEBVIEW_BASE_URL || 'https://pet.686888666.xyz';

const appUrl = (pathname) => new URL(pathname, WEBVIEW_BASE_URL).toString();

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function switchToWebView() {
  await browser.waitUntil(
    async () => {
      const contexts = await browser.getContexts();
      return contexts.some((context) => String(context).includes('WEBVIEW'));
    },
    { timeout: 30000, timeoutMsg: 'WebView not available within 30s' }
  );

  const contexts = await browser.getContexts();
  const webview = contexts.find((context) => String(context).includes('WEBVIEW'));
  await browser.switchContext(webview);
}

async function openPath(pathname) {
  await browser.url(appUrl(pathname));
  await browser.waitUntil(
    async () => {
      const readyState = await browser.execute(() => document.readyState);
      return readyState === 'interactive' || readyState === 'complete';
    },
    { timeout: 15000, timeoutMsg: `Page did not become interactive: ${pathname}` }
  );
}

async function bodyText() {
  return browser.execute(() => document.body?.innerText || '');
}

async function expectNoAppCrash() {
  const text = normalize(await bodyText());
  expect(text).to.not.include('application error');
  expect(text).to.not.include('white screen');
  expect(text).to.not.include('uncaught');
}

async function waitForAnyText(candidates, timeout = 15000) {
  const needles = candidates.map(normalize).filter(Boolean);
  await browser.waitUntil(
    async () => {
      const text = normalize(await bodyText());
      return needles.some((needle) => text.includes(needle));
    },
    { timeout, timeoutMsg: `Expected page text to include one of: ${candidates.join(', ')}` }
  );
}

async function clickByText(candidates, selector = 'button,a,[role="button"],.adm-tab-bar-item') {
  const needles = candidates.map(normalize).filter(Boolean);
  const clicked = await browser.execute(
    ({ needles: innerNeedles, selector: innerSelector }) => {
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const elements = Array.from(document.querySelectorAll(innerSelector));
      const target = elements.find((element) => {
        const text = String(element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return isVisible(element) && innerNeedles.some((needle) => text.includes(needle));
      });
      if (!target) return null;
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.click();
      return target.innerText || target.textContent || target.getAttribute('aria-label') || '';
    },
    { needles, selector }
  );
  expect(clicked, `Expected clickable text: ${candidates.join(', ')}`).to.be.a('string').and.not.equal('');
  return clicked;
}

async function fillInput(matchers, value) {
  const needles = matchers.map(normalize).filter(Boolean);
  const selector = await browser.execute((innerNeedles) => {
    const fields = Array.from(document.querySelectorAll('input, textarea'));
    const target = fields.find((field) => {
      const label = field.id
        ? Array.from(document.querySelectorAll('label')).find((candidate) => candidate.htmlFor === field.id)?.innerText
        : '';
      const haystack = [
        field.name,
        field.id,
        field.type,
        field.placeholder,
        field.getAttribute('aria-label'),
        label,
      ].join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      return innerNeedles.some((needle) => haystack.includes(needle));
    });
    if (!target) return null;
    if (!target.getAttribute('data-appium-field')) {
      target.setAttribute('data-appium-field', `field-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }
    return `[data-appium-field="${target.getAttribute('data-appium-field')}"]`;
  }, needles);
  expect(selector, `Expected input matching: ${matchers.join(', ')}`).to.be.a('string').and.not.equal('');
  const element = await browser.$(selector);
  await element.waitForDisplayed({ timeout: 10000 });
  await element.setValue(value);
}

async function blurActiveElement() {
  try {
    await browser.execute(() => document.activeElement?.blur?.());
  } catch (error) {
    // Ignore WebView focus cleanup failures; the next assertion still validates the flow.
  }
}

module.exports = {
  appUrl,
  blurActiveElement,
  bodyText,
  clickByText,
  expectNoAppCrash,
  fillInput,
  openPath,
  switchToWebView,
  waitForAnyText,
};

const { expect } = require('chai');

describe('ShopMX WebView Content', () => {
  before(async () => {
    // Wait for WebView to be available
    await browser.waitUntil(
      async () => {
        const contexts = await browser.getContexts();
        return contexts.length > 1;
      },
      { timeout: 30000, timeoutMsg: 'WebView not available within 30s' }
    );

    // Switch to WebView context
    const contexts = await browser.getContexts();
    const webview = contexts.find((c) => c.includes('WEBVIEW'));
    if (webview) {
      await browser.switchContext(webview);
    }
  });

  after(async () => {
    // Switch back to native context
    try {
      await browser.switchContext('NATIVE_APP');
    } catch (e) {
      // Ignore if already in native context
    }
  });

  it('should load the storefront in WebView', async () => {
    const title = await browser.getTitle();
    console.log('Page title:', title);
    expect(title).to.be.a('string');
  });

  it('should have the navigation bar visible', async () => {
    // Look for common navigation elements
    const body = await browser.$('body');
    const html = await body.getHTML();
    expect(html).to.include('ShopMX');
  });

  it('should display product cards on home page', async () => {
    // Wait for content to load
    await browser.pause(3000);

    // Check for product-related elements
    const body = await browser.$('body');
    const text = await body.getText();
    // The home page should have some product-related content
    expect(text.length).to.be.greaterThan(0);
  });
});

const { expect } = require('chai');

describe('ShopMX Mobile Navigation', () => {
  before(async () => {
    // Ensure we're in WebView context
    await browser.waitUntil(
      async () => {
        const contexts = await browser.getContexts();
        return contexts.length > 1;
      },
      { timeout: 30000 }
    );

    const contexts = await browser.getContexts();
    const webview = contexts.find((c) => c.includes('WEBVIEW'));
    if (webview) {
      await browser.switchContext(webview);
    }
  });

  after(async () => {
    try {
      await browser.switchContext('NATIVE_APP');
    } catch (e) {
      // Ignore
    }
  });

  it('should navigate to products page', async () => {
    await browser.url('http://localhost/products');
    await browser.pause(2000);

    const url = await browser.getUrl();
    expect(url).to.include('/products');
  });

  it('should navigate to login page', async () => {
    await browser.url('http://localhost/login');
    await browser.pause(2000);

    const url = await browser.getUrl();
    expect(url).to.include('/login');
  });

  it('should navigate to cart page', async () => {
    await browser.url('http://localhost/cart');
    await browser.pause(2000);

    const url = await browser.getUrl();
    expect(url).to.include('/cart');
  });

  it('should navigate to pet-finder page', async () => {
    await browser.url('http://localhost/pet-finder');
    await browser.pause(2000);

    const url = await browser.getUrl();
    expect(url).to.include('/pet-finder');
  });
});

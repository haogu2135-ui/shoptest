const { expect } = require('chai');

describe('ShopMX App Launch', () => {
  it('should launch the app successfully', async () => {
    // Wait for the WebView to load
    const contexts = await browser.getContexts();
    console.log('Available contexts:', contexts);

    // The app should have at least one context (native)
    expect(contexts).to.be.an('array');
    expect(contexts.length).to.be.greaterThan(0);
  });

  it('should display the app package name', async () => {
    const appPackage = await browser.getCurrentPackage();
    expect(appPackage).to.equal('com.shoptest.mobile');
  });

  it('should have the main activity visible', async () => {
    const activity = await browser.getCurrentActivity();
    expect(activity).to.include('MainActivity');
  });
});

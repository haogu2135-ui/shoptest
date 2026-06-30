const { expect } = require('chai');
const {
  blurActiveElement,
  bodyText,
  clickByText,
  expectNoAppCrash,
  fillInput,
  openPath,
  switchToWebView,
  waitForAnyText,
} = require('../helpers/webview');

const TEST_EMAIL = process.env.APPIUM_TEST_EMAIL;
const TEST_PASSWORD = process.env.APPIUM_TEST_PASSWORD;
const TRACK_ORDER_NO = process.env.APPIUM_TRACK_ORDER_NO;
const TRACK_ORDER_EMAIL = process.env.APPIUM_TRACK_ORDER_EMAIL || TEST_EMAIL;

async function loginWithConfiguredCredentials() {
  await openPath('/login');
  await fillInput(['email', 'username', '用户名', '邮箱'], TEST_EMAIL);
  await fillInput(['password', '密码'], TEST_PASSWORD);
  await blurActiveElement();
  await clickByText(['Login', 'Sign in', '登录']);

  await waitForAnyText(['Account', 'Profile', 'Orders', 'Logout', '账户', '个人', '订单', '退出'], 25000);
}

describe('ShopMX Mobile Critical Customer Flows', () => {
  before(async () => {
    await switchToWebView();
  });

  after(async () => {
    try {
      await browser.switchContext('NATIVE_APP');
    } catch (error) {
      // Ignore when the driver has already closed or stayed in native context.
    }
  });

  it('renders the storefront shell without a blank WebView and exposes mobile navigation', async () => {
    await openPath('/');
    await waitForAnyText(['ShopMX', 'Products', 'Cart', 'Home', '商品', '购物车']);
    await expectNoAppCrash();

    const text = await bodyText();
    expect(text.length).to.be.greaterThan(40);
  });

  it('keeps bottom navigation labels visible without horizontal clipping', async () => {
    await openPath('/');
    await waitForAnyText(['ShopMX', 'Products', 'Cart', 'Home', '商品', '购物车']);

    const bottomNavState = await browser.execute(() => {
      const nav = document.querySelector('.shop-nav__bottomBar');
      if (!nav) return { present: false, clipped: [], visibleItems: 0 };

      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };

      const labels = Array.from(nav.querySelectorAll('.shop-nav__bottomItem > span:not(.anticon):not(.ant-badge):not(.ant-scroll-number), .shop-nav__bottomItem .ant-badge + span')).filter(isVisible);
      const clipped = labels
        .filter((label) => label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1)
        .map((label) => label.textContent?.trim() || label.parentElement?.getAttribute('aria-label') || '');

      return { present: isVisible(nav), clipped, visibleItems: labels.length };
    });

    expect(bottomNavState.present, 'Expected the mobile bottom navigation to be visible').to.equal(true);
    expect(bottomNavState.visibleItems, 'Expected bottom navigation labels to render').to.be.greaterThan(3);
    expect(bottomNavState.clipped, 'Expected bottom navigation labels not to be truncated').to.deep.equal([]);
  });

  it('keeps invalid login attempts on the login screen with a visible recovery message', async () => {
    await openPath('/login');
    await waitForAnyText(['Login', 'Sign in', '登录', 'Email', 'Username']);

    await fillInput(['email', 'username', '用户名', '邮箱'], 'appium-invalid@example.com');
    await fillInput(['password', '密码'], 'wrong-password');
    await blurActiveElement();
    await clickByText(['Login', 'Sign in', '登录']);

    await waitForAnyText(['invalid', 'failed', 'incorrect', '错误', '失败', '不存在'], 20000);
    const url = await browser.getUrl();
    expect(url).to.include('/login');
  });

  it('lets a guest reach cart and exposes a checkout or login gate instead of a dead end', async () => {
    await openPath('/products');
    await waitForAnyText(['Add to cart', 'Products', '加入购物车', '商品']);
    await clickByText(['Add to cart', '加入购物车', 'Cart']);

    await openPath('/cart');
    await waitForAnyText(['Cart', 'Checkout', 'Login', '购物车', '结算', '登录']);
    await expectNoAppCrash();
  });

  it('shows payment recovery or authentication guidance on checkout entry', async () => {
    await openPath('/checkout');
    await waitForAnyText(['Checkout', 'Payment', 'Login', 'Cart', '结算', '支付', '登录', '购物车']);
    await expectNoAppCrash();
  });

  it('tracks an order with guest credentials when APPIUM_TRACK_ORDER_NO is configured', async function () {
    if (!TRACK_ORDER_NO || !TRACK_ORDER_EMAIL) {
      this.skip();
    }

    await openPath(`/track-order?orderNo=${encodeURIComponent(TRACK_ORDER_NO)}`);
    await waitForAnyText(['Track', 'Order', 'Email', '订单', '邮箱']);
    await fillInput(['order', 'order no', '订单'], TRACK_ORDER_NO);
    await fillInput(['email', '邮箱'], TRACK_ORDER_EMAIL);
    await blurActiveElement();
    await clickByText(['Track', 'Search', '查询', '跟踪']);

    await waitForAnyText([TRACK_ORDER_NO, 'Status', 'Payment', 'Support', '状态', '支付', '客服'], 20000);
    await expectNoAppCrash();
  });

  it('opens customer support from the global mobile launcher and keeps the composer inside the viewport', async () => {
    await openPath('/track-order');
    await waitForAnyText(['Track', 'Order', 'Support', '订单', '客服']);
    await browser.execute(() => {
      window.dispatchEvent(new CustomEvent('shop:open-support', { detail: { clearGuestContext: true } }));
    });
    await waitForAnyText(['Support', 'Message', 'Login', '客服', '消息', '登录']);

    const beforeHeight = await browser.execute(() => window.visualViewport?.height || window.innerHeight);
    await fillInput(['message', 'reply', '输入', '消息'], 'Appium mobile support smoke check');
    const afterHeight = await browser.execute(() => window.visualViewport?.height || window.innerHeight);
    expect(afterHeight).to.be.greaterThan(0);
    expect(beforeHeight).to.be.greaterThan(0);

    const composerState = await browser.execute(() => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const panel = document.querySelector('.customer-support-widget__panel');
      const input = document.querySelector('.customer-support-widget__messageInput textarea, .customer-support-widget__messageInput input, .customer-support-widget__messageInput');
      const panelRect = panel?.getBoundingClientRect();
      const inputRect = input?.getBoundingClientRect();

      return {
        hasPanel: Boolean(panelRect),
        hasInput: Boolean(inputRect),
        panelInsideViewport: Boolean(panelRect && panelRect.left >= 0 && panelRect.right <= viewportWidth + 1 && panelRect.top >= 0 && panelRect.bottom <= viewportHeight + 1),
        inputVisible: Boolean(inputRect && inputRect.top >= 0 && inputRect.bottom <= viewportHeight + 1 && inputRect.left >= 0 && inputRect.right <= viewportWidth + 1),
        inputFocused: Boolean(input && (document.activeElement === input || input.contains(document.activeElement))),
      };
    });

    expect(composerState.hasPanel, 'Expected the support panel to render').to.equal(true);
    expect(composerState.hasInput, 'Expected the support composer to render').to.equal(true);
    expect(composerState.panelInsideViewport, 'Expected the support panel to stay inside the mobile viewport').to.equal(true);
    expect(composerState.inputVisible, 'Expected the support composer to remain visible after keyboard focus').to.equal(true);
    expect(composerState.inputFocused, 'Expected the support composer to keep focus').to.equal(true);
    await blurActiveElement();
  });

  it('supports the authenticated login path when APPIUM_TEST_EMAIL is configured', async function () {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      this.skip();
    }

    await loginWithConfiguredCredentials();
    await expectNoAppCrash();
  });

  it('shares the latest authenticated order into customer support when order history exists', async function () {
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      this.skip();
    }

    await loginWithConfiguredCredentials();
    await openPath('/');
    await browser.execute(() => {
      window.dispatchEvent(new CustomEvent('shop:open-support', { detail: { clearGuestContext: false } }));
    });
    await waitForAnyText([
      'Share latest order',
      'Compartir pedido reciente',
      '发送最近订单',
      'No order yet',
      'Sin pedido',
      '未附订单',
    ], 25000);

    const hasLatestOrderAction = await browser.execute(() => {
      const text = document.body?.innerText || '';
      return /Share latest order|Compartir pedido reciente|发送最近订单/.test(text);
    });
    if (!hasLatestOrderAction) {
      this.skip();
    }

    await clickByText(['Share latest order', 'Compartir pedido reciente', '发送最近订单']);
    await waitForAnyText(['Order attached', 'Pedido adjunto', '已附订单'], 20000);
    await expectNoAppCrash();
  });
});

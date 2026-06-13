import fs from 'fs';
import path from 'path';

const readWidgetSource = () => fs.readFileSync(path.resolve(__dirname, 'CustomerSupportWidget.tsx'), 'utf8');
const readWidgetCss = () => fs.readFileSync(path.resolve(__dirname, 'CustomerSupportWidget.css'), 'utf8');

describe('CustomerSupportWidget reconnect cleanup source contracts', () => {
  it('keeps a visible loading and empty state while support sessions initialize', () => {
    const source = readWidgetSource();
    const css = readWidgetCss();
    const loadingCss = css.slice(css.indexOf('.customer-support-widget__loading'));

    expect(source).toContain('const [sessionLoading, setSessionLoading] = useState(false);');
    expect(source).toContain('setSessionLoading(true);');
    expect(source).toContain('setSessionLoading(false);');
    expect(source).toContain('<div className="customer-support-widget__loading" role="status" aria-live="polite">');
    expect(source).toContain('<Spin size="small" />');
    expect(source).toContain("<Text>{t('common.loading')}</Text>");
    expect(source).toContain('className="customer-support-widget__emptyState"');
    expect(source).toContain('<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(\'pages.support.welcome\')} />');
    expect(source).toContain('className="customer-support-widget__welcomeQuickReplies"');

    expect(loadingCss).toMatch(/\.customer-support-widget__loading\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*8px;[\s\S]*?font-size:\s*12px;/);
  });

  it('keeps order share dropdown and order detail modal above the open support panel', () => {
    const source = readWidgetSource();
    const css = readWidgetCss();
    const f3540Css = css.slice(css.indexOf('/* F3540'));

    expect(source).toContain('const SUPPORT_ORDER_OVERLAY_Z_INDEX = 10020;');
    expect(source).toContain("const supportOrderSelectPopupClassNames = { popup: { root: 'shop-mobile-popup-layer support-order-select-popup' } };");
    expect(source).toContain('const supportOrderSelectPopupStyles = { popup: { root: { zIndex: SUPPORT_ORDER_OVERLAY_Z_INDEX + 1 } } };');
    expect(source).toContain('classNames={supportOrderSelectPopupClassNames}');
    expect(source).toContain('styles={supportOrderSelectPopupStyles}');
    expect(source).toContain('placement="topLeft"');
    expect(source).toContain('rootClassName="customer-support-widget__orderModalRoot"');
    expect(source).toContain('zIndex={SUPPORT_ORDER_OVERLAY_Z_INDEX}');

    expect(f3540Css).toMatch(/body \.support-order-select-popup\.shop-mobile-popup-layer,[\s\S]*?body \.support-order-select-popup\.ant-select-dropdown\s*\{[\s\S]*?z-index:\s*10021\s*!important;[\s\S]*?pointer-events:\s*auto\s*!important;/);
    expect(f3540Css).toMatch(/body \.support-order-select-popup\.ant-select-dropdown\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?max-height:\s*min\(360px,\s*calc\(100dvh - 24px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\)\s*!important;/);
    expect(f3540Css).toMatch(/body \.customer-support-widget__orderModalRoot,[\s\S]*?body \.customer-support-widget__orderModalRoot \.ant-modal-mask\s*\{[\s\S]*?z-index:\s*10020\s*!important;/);
    expect(f3540Css).toMatch(/body \.customer-support-widget__orderModalRoot \.ant-modal-wrap\s*\{[\s\S]*?z-index:\s*10021\s*!important;/);
    expect(f3540Css).toMatch(/body \.customer-support-widget__orderModalRoot \.customer-support-widget__orderModal\.ant-modal\s*\{[\s\S]*?z-index:\s*10022\s*!important;/);
  });

  it('keeps the mobile support dialog focus trapped without fighting nested overlays', () => {
    const source = readWidgetSource();

    expect(source).toContain('const SUPPORT_FOCUSABLE_SELECTOR = [');
    expect(source).toContain('const getFocusableSupportElements = (container: HTMLElement) =>');
    expect(source).toContain('const supportButtonRef = useRef<HTMLButtonElement | null>(null);');
    expect(source).toContain('const panelRef = useRef<HTMLDivElement | null>(null);');
    expect(source).toContain('const orderSelectOpenRef = useRef(false);');
    expect(source).toContain('const orderDetailOpenRef = useRef(false);');
    expect(source).toContain('if (!open || !isMobileViewport) return;');
    expect(source).toContain('document.addEventListener(\'focusin\', handleFocusIn);');
    expect(source).toContain('if (event.key !== \'Tab\' || orderDetailOpenRef.current || orderSelectOpenRef.current) return;');
    expect(source).toContain('supportButtonRef.current?.focus({ preventScroll: true });');
    expect(source).toContain('aria-modal={isMobileViewport ? true : undefined}');
    expect(source).toContain('tabIndex={-1}');
  });

  it('uses the compact support sheet for mobile-nav and short landscape viewports', () => {
    const source = readWidgetSource();
    const css = readWidgetCss();
    const f2859Css = css.slice(css.indexOf('/* F2859'));

    expect(source).toContain('const SUPPORT_MOBILE_VIEWPORT_MAX_WIDTH = 780;');
    expect(source).toContain('const SUPPORT_SHORT_LANDSCAPE_MAX_WIDTH = 900;');
    expect(source).toContain('const SUPPORT_SHORT_LANDSCAPE_MAX_HEIGHT = 430;');
    expect(source).toContain('window.innerWidth <= SUPPORT_MOBILE_VIEWPORT_MAX_WIDTH');
    expect(source).toContain('window.innerWidth <= SUPPORT_SHORT_LANDSCAPE_MAX_WIDTH && window.innerHeight <= SUPPORT_SHORT_LANDSCAPE_MAX_HEIGHT');
    expect(source).toContain('const [isMobileViewport, setIsMobileViewport] = useState(isSupportMobileViewport);');
    expect(source).toContain('setIsMobileViewport(isSupportMobileViewport());');

    expect(f2859Css).toMatch(/@media \(max-width:\s*780px\), \(max-width:\s*900px\) and \(max-height:\s*430px\)\s*\{/);
    expect(f2859Css).toMatch(/\.customer-support-widget__backdrop\s*\{[\s\S]*?z-index:\s*2580\s*!important;[\s\S]*?display:\s*block;/);
    expect(f2859Css).toMatch(/\.customer-support-widget__panel\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(88px,\s*1fr\) minmax\(0,\s*auto\)\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
    expect(f2859Css).toMatch(/@supports \(height:\s*100dvh\)\s*\{[\s\S]*?height:\s*calc\(100dvh - 12px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f2859Css).toMatch(/\.customer-support-widget__messages\s*\{[\s\S]*?min-height:\s*88px\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important;/);
    expect(f2859Css).toMatch(/\.customer-support-widget__composer\s*\{[\s\S]*?max-height:\s*min\(48vh,\s*220px\);[\s\S]*?overflow-y:\s*auto\s*!important;/);
    expect(f2859Css).toMatch(/@media \(max-width:\s*900px\) and \(max-height:\s*430px\)\s*\{[\s\S]*?\.customer-support-widget__triage,[\s\S]*?\.customer-support-widget__quickReplies\s*\{[\s\S]*?display:\s*none\s*!important;/);
  });

  it('keeps websocket reconnect timers bounded and cleaned up on effect disposal', () => {
    const source = readWidgetSource();

    expect(source).toContain("import { useReconnectingWebSocket } from '../hooks/useReconnectingWebSocket';");
    expect(source).toContain('const socketRef = useReconnectingWebSocket({');
    expect(source).toContain('enabled: Boolean(open && token),');
    expect(source).toContain('connectionKey: token || \'\',');
    expect(source).toContain('createSocket: async () => {');
    expect(source).toContain('const ticketResponse = await supportApi.createWebSocketTicket();');
    expect(source).toContain('new WebSocket(supportWebSocketUrl(), supportWebSocketProtocols(ticketResponse.data.ticket))');
    expect(source).toContain('onReconnectExhausted: (attempts) => {');
    expect(source).toContain("message.warning(t('pages.support.connectFailed'));");
    expect(source).toContain("reportNonBlockingError('CustomerSupportWidget.websocketReconnectExhausted', { attempts });");
    expect(source).not.toContain('supportWebSocketProtocols(token');
    expect(source).not.toContain('reconnectTimerRef');
    expect(source).not.toContain('reconnectAttemptRef');
    expect(source).not.toContain('const scheduleReconnect');
    expect(source).not.toContain('setTimeout(connect, 2500)');
  });

  it('keeps HTTP polling as a fallback after websocket reconnect exhaustion', () => {
    const source = readWidgetSource();
    const socketStart = source.indexOf('const socketRef = useReconnectingWebSocket({');
    const pollingEffectStart = source.indexOf('const timer = window.setInterval(async () => {', socketStart);
    const pollingEffectEnd = source.indexOf('}, [activeGuestContext, connected, open, activeSessionId, sortSupportSessions]);', pollingEffectStart);
    const pollingEffect = source.slice(pollingEffectStart, pollingEffectEnd);

    expect(socketStart).toBeGreaterThan(-1);
    expect(pollingEffectStart).toBeGreaterThan(socketStart);
    expect(pollingEffectEnd).toBeGreaterThan(pollingEffectStart);
    expect(pollingEffect).toContain('const pollSessionId = sessionRef.current?.id;');
    expect(pollingEffect).toContain('supportApi.getMessages(pollSessionId, { afterId, limit: SUPPORT_MESSAGE_WINDOW })');
    expect(pollingEffect).toContain('supportApi.getGuestMessages(pollSessionId, guestContextForPoll.orderNo, guestContextForPoll.email');
    expect(pollingEffect).toContain("reportNonBlockingError('CustomerSupportWidget.pollMessages', error);");
  });

  it('keeps guest message polling bound to the latest guest context', () => {
    const source = readWidgetSource();
    const pollingEffectStart = source.indexOf('const timer = window.setInterval(async () => {');
    const pollingEffectEnd = source.indexOf('}, [activeGuestContext, connected, open, activeSessionId, sortSupportSessions]);', pollingEffectStart);
    const pollingEffect = source.slice(pollingEffectStart, pollingEffectEnd);

    expect(source).toContain('const activeGuestContextRef = useRef<GuestSupportContext | null>(null);');
    expect(source).toContain('activeGuestContextRef.current = activeGuestContext;');
    expect(pollingEffectStart).toBeGreaterThan(-1);
    expect(pollingEffectEnd).toBeGreaterThan(pollingEffectStart);
    expect(pollingEffect).toContain('const guestContextForPoll = activeGuestContextRef.current;');
    expect(pollingEffect).toContain('supportApi.getGuestMessages(pollSessionId, guestContextForPoll.orderNo, guestContextForPoll.email');
    expect(pollingEffect).toContain('activeGuestContextRef.current?.orderNo !== guestContextForPoll.orderNo');
    expect(pollingEffect).toContain('activeGuestContextRef.current?.email !== guestContextForPoll.email');
    expect(pollingEffect).toContain('supportApi.markGuestRead(pollSessionId, guestContextForPoll.orderNo, guestContextForPoll.email)');
    expect(pollingEffect).toContain('sessionRef.current?.id !== pollSessionId');
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import { LanguageProvider } from '../i18n';

const mockGetSessions = jest.fn();
const mockGetSummary = jest.fn();
const mockGetMessages = jest.fn();
const mockMarkRead = jest.fn();
const mockGetAppConfig = jest.fn();
const mockCreateWebSocketTicket = jest.fn();

jest.mock('../api/admin', () => ({
  adminApi: {
    getMyPermissions: jest.fn(),
    getOrder: jest.fn(),
    getOrderItems: jest.fn(),
  },
  adminSupportApi: {
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    markRead: (...args: unknown[]) => mockMarkRead(...args),
    sendMessage: jest.fn(),
    closeSession: jest.fn(),
    assignSession: jest.fn(),
    reopenSession: jest.fn(),
    reissueBirthdayCoupons: jest.fn(),
  },
}));

jest.mock('../api', () => ({
  appConfigApi: {
    get: (...args: unknown[]) => mockGetAppConfig(...args),
  },
  supportApi: {
    createWebSocketTicket: (...args: unknown[]) => mockCreateWebSocketTicket(...args),
  },
  supportWebSocketProtocols: jest.fn(),
  supportWebSocketUrl: jest.fn(),
  userApi: {
    getProfile: jest.fn(),
  },
}));

const SupportManagement = require('./SupportManagement').default as typeof import('./SupportManagement').default;

describe('SupportManagement', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    mockGetSessions.mockResolvedValue({
      data: {
        items: [
          {
            id: 42,
            userId: 7,
            username: 'Customer A',
            status: 'OPEN',
            assignedAdminName: '',
            lastMessage: 'Need help',
            updatedAt: '2026-06-06T07:00:00Z',
            unreadByAdmin: 1,
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        totalPages: 1,
      },
    });
    mockGetSummary.mockResolvedValue({
      data: {
        totalSessions: 1,
        openSessions: 1,
        closedSessions: 0,
        unreadSessions: 1,
        unreadMessages: 1,
        unassignedOpenSessions: 1,
        myOpenSessions: 0,
        staleOpenSessions: 0,
        staleMinutes: 30,
        responseScore: 100,
      },
    });
    mockGetMessages.mockResolvedValue({
      data: [
        {
          id: 100,
          sessionId: 42,
          senderRole: 'USER',
          senderName: 'Customer A',
          content: 'Need help',
          createdAt: '2026-06-06T07:00:00Z',
          isReadByAdmin: false,
        },
      ],
    });
    mockMarkRead.mockResolvedValue({ data: {} });
    mockGetAppConfig.mockResolvedValue({ data: { runtimeMode: 'production' } });
    mockCreateWebSocketTicket.mockResolvedValue({ data: { ticket: 'ws-ticket-1', expiresInMillis: 60000 } });
  });

  it('keeps the reply input visible after an admin selects a conversation without loaded reply permissions', async () => {
    render(
      <LanguageProvider>
        <SupportManagement />
      </LanguageProvider>
    );

    await waitFor(() => expect(mockGetSessions).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: /Customer A/i }, { timeout: 6000 }));

    const replyInput = await screen.findByRole('textbox', { name: /Write a reply/i }, { timeout: 6000 });
    expect(replyInput).toBeInTheDocument();
    expect(replyInput).toBeDisabled();
    expect(screen.getAllByText('No admin permission').length).toBeGreaterThan(0);

    await waitFor(() => expect(mockGetMessages).toHaveBeenCalledWith(42, { limit: 80 }));
  });

  it('keeps polling interval callbacks gated after cleanup', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');

    expect(source).toContain("if (process.env.NODE_ENV === 'test') return;");
    expect(source).toContain('let disposed = false;');
    expect(source).toContain('const SUPPORT_POLL_INTERVAL_MS = 10 * 1000;');
    expect(source).toContain('if (disposed || polling) return;');
    expect(source).toContain('await loadSessions({ isActive: () => !disposed });');
    expect(source).toContain('if (disposed || selectedSessionRef.current?.id !== activeSession.id) return;');
    expect(source).toContain('}, SUPPORT_POLL_INTERVAL_MS);');
    expect(source).toContain('disposed = true;');
    expect(source).toContain('window.clearInterval(timer);');
  });

  it('keeps reconnect exhaustion visible while HTTP polling continues', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');
    const socketStart = source.indexOf('const socketRef = useReconnectingWebSocket({');
    const pollingEffectStart = source.indexOf('const timer = window.setInterval(async () => {', socketStart);
    const pollingEffectEnd = source.indexOf('}, [canUpdateSupportReadState, loadSessions]);', pollingEffectStart);
    const pollingEffect = source.slice(pollingEffectStart, pollingEffectEnd);

    expect(socketStart).toBeGreaterThan(-1);
    expect(source).toContain('onReconnectExhausted: (attempts) => {');
    expect(source).toContain("message.warning(t('pages.support.connectFailed'));");
    expect(source).toContain("reportNonBlockingError('SupportManagement.websocketReconnectExhausted', { attempts });");
    expect(pollingEffectStart).toBeGreaterThan(socketStart);
    expect(pollingEffect).toContain('await loadSessions({ isActive: () => !disposed });');
    expect(pollingEffect).toContain('adminSupportApi.getMessages(activeSession.id, { afterId, limit: SUPPORT_MESSAGE_WINDOW })');
    expect(pollingEffect).toContain("reportNonBlockingError('SupportManagement.pollMessages', error);");
  });

  it('routes websocket payloads through the guarded support parser', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');
    const socketStart = source.indexOf('const socketRef = useReconnectingWebSocket({');
    const messageHandlerStart = source.indexOf('onMessage: (event) => {', socketStart);
    const messageHandlerEnd = source.indexOf('    },', messageHandlerStart);
    const messageHandler = source.slice(messageHandlerStart, messageHandlerEnd);

    expect(source).toContain("import { parseSupportSocketPayload, supportChatConfig } from '../utils/supportChatConfig';");
    expect(messageHandlerStart).toBeGreaterThan(socketStart);
    expect(messageHandler).toContain('const payload = parseSupportSocketPayload(event.data);');
    expect(messageHandler).toContain("if (payload.type === 'ERROR') {");
    expect(messageHandler).toContain("message.warning(payload.message || t('pages.support.messageRejected'));");
    expect(messageHandler).toContain("if (payload.type === 'MESSAGE') {");
    expect(source).not.toContain('JSON.parse(event.data)');
    expect(source).not.toContain('ws.onmessage');
  });

  it('keeps support admin error handling typed without broad any usage', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');

    expect(source).toContain('type LegacyAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };');
    expect(source).toContain('const audioWindow = window as LegacyAudioWindow;');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toContain('window as any');
    expect(source).not.toContain('catch (err: any)');
  });

  it('gates reply actions while the selected conversation is loading or failed', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');

    expect(source).toContain('const conversationUnavailable = Boolean(messageLoading || messageError);');
    expect(source).toContain("messageLoading\n    ? t('common.loading')");
    expect(source).toContain('const replyReady = Boolean(canReplySupport && selectedSession && selectedSession.status === \'OPEN\' && replyText && !replyTooLong && !conversationUnavailable);');
    expect(source).toContain('disabled={!canReplySupport || selectedSession.status !== \'OPEN\' || conversationUnavailable}');
    expect(source).toContain('disabled={!canReplySupport || selectedSession.status !== \'OPEN\' || sending || conversationUnavailable}');
    expect(source).toContain('disabled={!replyReady}');
    expect(source).toContain('replyText && !replyTooLong && !conversationUnavailable');
  });

  it('closes the notification audio context on unmount', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8').replace(/\r\n?/g, '\n');
    const cleanupStart = source.indexOf('useEffect(() => {\n    return () => {\n      const context = audioContextRef.current;');
    const cleanupEnd = source.indexOf('  const playTone = () => {', cleanupStart);
    const cleanupSource = source.slice(cleanupStart, cleanupEnd);

    expect(cleanupStart).toBeGreaterThan(-1);
    expect(cleanupEnd).toBeGreaterThan(cleanupStart);
    expect(cleanupSource).toContain('audioContextRef.current = null;');
    expect(cleanupSource).toContain("if (context && context.state !== 'closed') {");
    expect(cleanupSource).toContain('void context.close()');
    expect(cleanupSource).toContain("reportNonBlockingError('SupportManagement.closeAudioContext', error)");
    expect(cleanupSource).toContain('  }, []);');
  });

  it('keeps queue merge callbacks on current refs without stale memoizedRef dependencies', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');
    const mergeStart = source.indexOf('const mergeSessionIntoCurrentQueue = useCallback');
    const mergeSource = source.slice(mergeStart, source.indexOf('const loadSessions = useCallback', mergeStart));

    expect(source).not.toContain('memoizedRef');
    expect(mergeStart).toBeGreaterThan(-1);
    expect(mergeSource).toContain('supportSessionMatchesQueue(session, queueFilterRef.current, queueSearchRef.current)');
    expect(mergeSource).toContain('const currentItems = sessionsRef.current;');
    expect(mergeSource).toContain('queueTotalRef.current');
    expect(mergeSource).toContain('}, []);');
  });

  it('hands mobile queue selection off to the selected conversation pane', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');
    const css = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.css'), 'utf8');

    expect(source).toContain('const conversationPaneRef = useRef<HTMLDivElement | null>(null);');
    expect(source).toContain('const handoffConversationOnMobile = useCallback(() => {');
    expect(source).toContain("window.matchMedia?.('(max-width: 900px)').matches");
    expect(source).toContain('pane.scrollIntoView?.({ block: \'start\', behavior: \'smooth\' });');
    expect(source).toContain('pane.focus({ preventScroll: true });');
    expect(source).toContain('setSelectedSession(session);');
    expect(source).toContain('handoffConversationOnMobile();');
    expect(source).toContain('<div ref={conversationPaneRef} className="support-management__conversationPane" tabIndex={-1}>');
    expect(css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.support-management__conversationPane\s*\{[\s\S]*?scroll-margin-top:\s*calc\(14px \+ env\(safe-area-inset-top,\s*0px\)\);/);
    expect(css).toMatch(/\.support-management__conversationPane:focus\s*\{[\s\S]*?outline:\s*2px solid rgba\(18,\s*71,\s*52,\s*0\.18\);[\s\S]*?outline-offset:\s*3px;/);
  });

  it('wraps long support confirmation identities inside mobile Popconfirms', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.tsx'), 'utf8');
    const css = fs.readFileSync(path.resolve(__dirname, 'SupportManagement.css'), 'utf8');

    expect(source).toContain("const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer support-management__popconfirm' };");
    expect(source).toContain('title={assignSessionLabel}');
    expect(source).toContain('title={reopenSessionLabel}');
    expect(source).toContain('title={reissueBirthdayCouponLabel}');
    expect(source).toContain('title={closeSessionLabel}');
    expect(source.match(/description=\{selectedSessionLabel\}/g)?.length).toBeGreaterThanOrEqual(4);

    const f3535Start = css.indexOf('/* F3535');
    const f3535Css = css.slice(f3535Start);

    expect(f3535Start).toBeGreaterThanOrEqual(0);
    expect(f3535Css).toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?body \.support-management__popconfirm\.shop-mobile-popup-layer\s*\{[\s\S]*?left:\s*max\(8px,\s*env\(safe-area-inset-left,\s*0px\)\)\s*!important;[\s\S]*?right:\s*max\(8px,\s*env\(safe-area-inset-right,\s*0px\)\)\s*!important;[\s\S]*?max-width:\s*calc\(100vw - 16px\)\s*!important;/);
    expect(f3535Css).toMatch(/body \.support-management__popconfirm\.shop-mobile-popup-layer \.ant-popover-content,[\s\S]*?body \.support-management__popconfirm\.shop-mobile-popup-layer \.ant-popconfirm-message-text\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/);
    expect(f3535Css).toMatch(/body \.support-management__popconfirm\.shop-mobile-popup-layer \.ant-popconfirm-title,[\s\S]*?body \.support-management__popconfirm\.shop-mobile-popup-layer \.ant-popconfirm-description\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/);
    expect(f3535Css).toMatch(/body \.support-management__popconfirm\.shop-mobile-popup-layer \.ant-popconfirm-buttons\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?gap:\s*8px;/);
  });
});

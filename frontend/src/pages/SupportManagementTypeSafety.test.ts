const readSupportManagementSource = (): string => (
  require('fs').readFileSync(require('path').resolve(__dirname, 'SupportManagement.tsx'), 'utf8')
);

export {};

describe('SupportManagement type-safety guard', () => {
  it('keeps admin support failures and legacy audio access typed without broad any escapes', () => {
    const source = readSupportManagementSource();

    expect(source).not.toMatch(/catch \([^)]*: any\)|\.catch\(\([^)]*: any\)|\b[A-Za-z_$][\w$]*\??: any\b|as any\b|window as any\b|any\[\]/);
    expect(source).toContain('type LegacyAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };');
    expect(source).toContain('const audioWindow = window as LegacyAudioWindow;');
    expect(source).toContain('const AudioCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;');
    expect(source).toContain('} catch (err: unknown) {');
    expect(source).toContain("getApiErrorMessage(err, t('pages.adminSupport.loadFailed'), language)");
    expect(source).toContain("getApiErrorMessage(err, t('pages.adminSupport.reissueBirthdayCouponFailed'), language)");
  });

  it('keeps the admin support WebSocket connection keyed only by the admin token', () => {
    const source = readSupportManagementSource();
    const hasHookBackedSocket = /useReconnectingWebSocket\(\{[\s\S]*enabled: Boolean\(adminSupportToken\) && process\.env\.NODE_ENV !== 'test',[\s\S]*connectionKey: adminSupportToken/.test(source);
    const hasRefBackedSocket = source.includes('const adminSupportToken = readAdminSupportToken();')
      && source.includes('const canUpdateSupportReadStateRef = useRef(canUpdateSupportReadState);')
      && source.includes('const supportTranslationRef = useRef(t);')
      && source.includes('const mergeSessionIntoCurrentQueueRef = useRef<(session: SupportSession, options?: { countNewMatch?: boolean }) => void>(() => undefined);')
      && source.includes('mergeSessionIntoCurrentQueueRef.current = mergeSessionIntoCurrentQueue;')
      && source.includes('mergeSessionIntoCurrentQueueRef.current(payload.session, { countNewMatch: true });')
      && source.includes('if (canUpdateSupportReadStateRef.current) {')
      && source.includes('}, [adminSupportToken]);');

    expect(hasHookBackedSocket || hasRefBackedSocket).toBe(true);
    expect(source).not.toMatch(/new WebSocket[\s\S]{0,2500}\}, \[canUpdateSupportReadState, mergeSessionIntoCurrentQueue, t\]\);/);
  });
});

import fs from 'fs';
import path from 'path';

const readNotificationsSource = () => fs.readFileSync(path.resolve(__dirname, 'Notifications.tsx'), 'utf8');
const readNotificationsCss = () => fs.readFileSync(path.resolve(__dirname, 'Notifications.css'), 'utf8');

describe('Notifications mobile bottom-nav clearance contract', () => {
  it('renders the action plan before the notification list', () => {
    const source = readNotificationsSource();

    expect(source).toContain('className="notifications-page"');
    expect(source).toContain('className="notifications-page__actionPlan"');
    expect(source).toContain('className="notifications-page__actionSignals"');
    expect(source).toContain("t('pages.notifications.actionReviewUnread')");
    expect(source.indexOf('className="notifications-page__actionPlan"')).toBeGreaterThan(-1);
    expect(source.indexOf('<List')).toBeGreaterThan(source.indexOf('className="notifications-page__actionPlan"'));
  });

  it('guards notification fetches against stale responses and unmount updates', () => {
    const source = readNotificationsSource();
    const fetchStart = source.indexOf('const fetchNotifications = useCallback');
    const fetchSource = source.slice(fetchStart, source.indexOf('useEffect(() => {', fetchStart));

    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('const notificationFetchSeqRef = useRef(0);');
    expect(source).toContain('notificationFetchSeqRef.current += 1;');
    expect(fetchSource).toContain('const requestSeq = notificationFetchSeqRef.current + 1;');
    expect(fetchSource).toContain('notificationFetchSeqRef.current = requestSeq;');
    expect(fetchSource).toContain('const isCurrentRequest = () => mountedRef.current && notificationFetchSeqRef.current === requestSeq;');
    expect(fetchSource).toContain('if (!isCurrentRequest()) return;');
    expect(fetchSource).toContain('setNotifications((current) => append ? mergeNotificationPages(current, nextNotifications) : nextNotifications);');
    expect(fetchSource).toContain('setLoadingMore(false);');
    expect(fetchSource).toContain('setLoading(false);');
  });

  it('keeps paged notification loading available beyond the first page', () => {
    const source = readNotificationsSource();
    const fetchStart = source.indexOf('const fetchNotifications = useCallback');
    const fetchSource = source.slice(fetchStart, source.indexOf('useEffect(() => {', fetchStart));

    expect(source).toContain('const NOTIFICATION_PAGE_SIZE = 50;');
    expect(fetchSource).toContain('notificationApi.getByUser(0, false, nextPage, NOTIFICATION_PAGE_SIZE)');
    expect(fetchSource).toContain('setHasMoreNotifications(nextNotifications.length === NOTIFICATION_PAGE_SIZE);');
    expect(source).toContain('const [notificationPage, setNotificationPage] = useState(1);');
    expect(source).toContain('const [hasMoreNotifications, setHasMoreNotifications] = useState(false);');
    expect(source).toContain('footer={hasMoreNotifications ? (');
    expect(source).toContain('onClick={() => fetchNotifications(notificationPage + 1, true)}');
    expect(source).toContain("t('pages.notifications.loadMore')");
    expect(source).not.toContain('notificationApi.getNotifications(1, 100)');
  });

  it('keeps stale notification snapshots read-only after refresh failures', () => {
    const source = readNotificationsSource();

    expect(source).toContain('const notificationActionsDisabled = Boolean(fetchError);');
    expect(source).toContain("description={t('pages.notifications.staleDataWarning')}");
    expect(source).toContain("action={<Button size=\"small\" onClick={() => fetchNotifications()}>{t('common.retry')}</Button>}");
    expect(source).toContain('disabled={notificationActionsDisabled}');
  });

  it('reserves bottom-navigation clearance for the mobile action plan and first card', () => {
    const css = readNotificationsCss();
    const f2719Start = css.indexOf('F2719:');
    const f2719Css = css.slice(f2719Start);

    expect(f2719Start).toBeGreaterThan(css.indexOf('2026-06-07 mobile notification action closure'));
    expect(f2719Css).toContain('@media (max-width: 640px)');
    expect(f2719Css).toMatch(/\.notifications-page\s*\{[^}]*padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*96px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[^}]*scroll-padding-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*112px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f2719Css).toMatch(/\.notifications-page__actionPlan\s*\{[^}]*gap:\s*8px\s*!important;[^}]*margin-bottom:\s*calc\(var\(--shop-mobile-bottom-nav-height,\s*76px\)\s*\+\s*16px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[^}]*scroll-margin-bottom:/);
    expect(f2719Css).toMatch(/\.notifications-page__actionPlan > \.ant-btn\s*\{[^}]*min-height:\s*44px\s*!important;[^}]*scroll-margin-bottom:/);
    expect(f2719Css).toMatch(/\.notifications-page__item:first-child,[\s\S]*?\.notifications-page \.ant-list > \.ant-spin-nested-loading:first-child\s*\{[^}]*scroll-margin-bottom:/);
  });

  it('deep-links order and delivery notifications to the right commercial destinations', () => {
    const source = readNotificationsSource();
    expect(source).toContain('const extractOrderNoFromNotification');
    expect(source).toContain('const openRelatedNotification = useCallback');
    expect(source).toContain('navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}`);');
    expect(source).toContain('navigate(`/profile?tab=orders&orderNo=${encodeURIComponent(orderNo)}`);');
    expect(source).toContain("t('pages.notifications.actionTrackOrder')");
    expect(source).toContain("t('pages.notifications.actionOpenOrders')");
    expect(source).toContain('notifications-page__titleButton');
    expect(source).toContain('notificationLooksLikeShipment');
    expect(source).toContain('notificationLooksLikeReturnFlow');
    expect(source).toContain('navigate(`/track-order?orderNo=${encodeURIComponent(orderNo)}`);');
    expect(source).toContain('(SO\\d{6,})');

  });


  it('keeps a commercial multi-path guest auth gate instead of hard-redirect-only login', () => {
    const source = readNotificationsSource();
    const css = readNotificationsCss();
    expect(source).toContain('notifications-page__authGate');
    expect(source).toContain('pages.notifications.authGateTitle');
    expect(source).toContain("buildLoginUrl('/notifications')");
    expect(source).toContain("navigate('/register?redirect=%2Fnotifications')");
    expect(source).toContain("navigate('/track-order')");
    expect(source).not.toContain('buildLoginUrlFromWindow');
    expect(source).not.toContain("message.warning(t('messages.loginRequired'))");
    expect(css).toContain('Commercial guest notifications auth gate multi-path conversion');
    expect(css).toMatch(/\.notifications-page__authGate \.page-feedback__actions \.ant-btn[\s\S]*?min-height:\s*44px/);
  });

});

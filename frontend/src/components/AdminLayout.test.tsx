const readAdminLayoutSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'AdminLayout.tsx'), 'utf8') as string;
const readAdminLayoutCssSource = () => require('fs').readFileSync(require('path').resolve(__dirname, 'AdminLayout.css'), 'utf8') as string;

export {};

describe('AdminLayout visibility-aware polling', () => {
  it('keeps admin menu filtering typed without broad assertions', () => {
    const source = readAdminLayoutSource();

    expect(source).not.toMatch(/\bas any\b/);
    expect(source).toContain('type AdminMenuItem = {');
    expect(source).toContain('const isAdminMenuItem = (item: AdminMenuItem | null): item is AdminMenuItem => item !== null;');
    expect(source).toContain('const menuItems = useMemo<AdminMenuItem[]>(() => {');
    expect(source).toContain('return items.filter(isAdminMenuItem);');
  });

  it('wraps desktop and mobile admin menus in navigation landmarks', () => {
    const source = readAdminLayoutSource();

    expect(source).toContain('<nav className="admin-layout__navigation" aria-label={t(\'adminLayout.navigation\')}>');
    expect(source).toContain('<nav className="admin-layout__mobileNavigation" aria-label={t(\'adminLayout.navigation\')}>');
    expect(source.indexOf('className="admin-layout__navigation"')).toBeLessThan(source.indexOf('className="admin-layout__menu"'));
    expect(source.indexOf('className="admin-layout__mobileNavigation"')).toBeLessThan(source.indexOf('className="admin-layout__drawerMenu"'));
  });

  it('keeps nested admin routes selected without strict equality-only matching', () => {
    const source = readAdminLayoutSource();

    expect(source).toContain('const isAdminMenuRouteMatch = (pathname: string, menuKey?: string) => (');
    expect(source).toContain('pathname === menuKey || pathname.startsWith(`${menuKey}/`)');
    expect(source).toContain('const currentAdminRouteAllowed = location.pathname === \'/admin\' || Boolean(selectedAdminPath);');
    expect(source).not.toContain('item.key === location.pathname');
  });

  it('guards admin auth checks against stale responses and aborted navigation', () => {
    const source = readAdminLayoutSource();
    const checkAdminStart = source.indexOf('const checkAdmin = useCallback(async (initial = false) => {');
    const permissionsEffectStart = source.indexOf('useEffect(() => {', source.indexOf('void checkAdmin(initial);'));
    const checkAdminSource = source.slice(checkAdminStart, permissionsEffectStart);

    expect(checkAdminStart).toBeGreaterThan(-1);
    expect(source).toContain('const adminCheckAbortRef = useRef<AbortController | null>(null);');
    expect(checkAdminSource).toContain('adminCheckAbortRef.current?.abort();');
    expect(checkAdminSource).toContain('const controller = new AbortController();');
    expect(checkAdminSource).toContain('userApi.getProfile({ signal: controller.signal })');
    expect(checkAdminSource).toContain('adminApi.getMyPermissions({ bypassCache: true, signal: controller.signal })');
    expect(checkAdminSource).toContain('if (controller.signal.aborted || requestId !== adminCheckRequestRef.current) return;');
    expect(checkAdminSource).toContain('setChecking(false);');
    expect(source).toContain('adminCheckRequestRef.current += 1;');
  });

  it('uses the same login redirect builder for admin logout and failed auth checks', () => {
    const source = readAdminLayoutSource();
    const logoutStart = source.indexOf('const handleLogout = () => {');
    const renderStart = source.indexOf('if (checking) {');
    const logoutSource = source.slice(logoutStart, renderStart);

    expect(logoutStart).toBeGreaterThan(-1);
    expect(logoutSource).toContain('navigate(buildLoginUrlFromWindow(), { replace: true });');
    expect(logoutSource).not.toContain("navigate('/login'");
  });

  it('keeps admin shell chrome covered by error boundaries', () => {
    const source = readAdminLayoutSource();

    expect(source.indexOf('<ErrorBoundary homePath="/admin/dashboard" homeLabel={t(\'adminLayout.dashboard\')}>')).toBeLessThan(
      source.indexOf('<nav className="admin-layout__navigation"'),
    );
    expect(source.lastIndexOf('<ErrorBoundary homePath="/admin/dashboard" homeLabel={t(\'adminLayout.dashboard\')}>', source.indexOf('<Header className="admin-layout__header">'))).toBeGreaterThan(-1);
    expect(source).toContain('<ErrorBoundary key={location.pathname} homePath="/admin/dashboard" homeLabel={t(\'adminLayout.dashboard\')}>');
  });

  it('keeps selected menu contrast and tablet z-index ordering guarded', () => {
    const css = readAdminLayoutCssSource();
    const selectedBlocks = Array.from(css.matchAll(/\.admin-layout__menu\.ant-menu-dark \.ant-menu-item-selected \{[^}]+}/g)).map((match) => match[0]);

    expect(selectedBlocks.join('\n')).toContain('#c2410c');
    expect(selectedBlocks.join('\n')).toContain('#9a3412');
    expect(selectedBlocks.join('\n')).not.toContain('#ee4d2d');
    expect(selectedBlocks.join('\n')).not.toContain('#d9481e');
    expect(css).toContain('.admin-layout__header.ant-layout-header {\n  position: sticky;\n  top: 0;\n  z-index: 60;');
    expect(css).toContain('@media (max-width: 991px) {\n  .admin-layout__sider.ant-layout-sider {\n    position: sticky;\n    top: 0;\n    height: 100vh;\n    z-index: 40;');
  });

  it('does not poll support unread counts while the admin tab is hidden', () => {
    const source = readAdminLayoutSource();

    expect(source).toContain("const adminDocumentIsVisible = () => document.visibilityState !== 'hidden';");
    expect(source).toContain('if (!adminDocumentIsVisible()) return;');
    expect(source).toContain('const refreshUnreadWhenVisible = () => {');
    expect(source).toContain("document.addEventListener('visibilitychange', refreshUnreadWhenVisible);");
    expect(source).toContain("document.removeEventListener('visibilitychange', refreshUnreadWhenVisible);");
    expect(source).toContain('const timer = window.setInterval(loadUnread, 15000);');
  });

  it('guards in-flight support unread responses after cleanup', () => {
    const source = readAdminLayoutSource();
    const unreadEffectStart = source.indexOf('if (checking || !canSeeSupport) {');
    const logoutStart = source.indexOf('const handleLogout = () => {');
    const unreadEffectSource = source.slice(unreadEffectStart, logoutStart);

    expect(unreadEffectStart).toBeGreaterThan(-1);
    expect(logoutStart).toBeGreaterThan(unreadEffectStart);
    expect(unreadEffectSource).toContain('let disposed = false;');
    expect(unreadEffectSource).toContain('if (!disposed) setSupportUnread(res.data.count);');
    expect(unreadEffectSource).toContain('if (!disposed) setSupportUnread(0);');
    expect(unreadEffectSource).toContain('disposed = true;');
    expect(unreadEffectSource).toContain('window.clearInterval(timer);');
  });
});

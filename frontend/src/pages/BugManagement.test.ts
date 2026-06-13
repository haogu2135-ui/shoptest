import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'BugManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'BugManagement.css'), 'utf8');
const apiSource = fs.readFileSync(path.resolve(__dirname, '../api/index.ts'), 'utf8');
const localesRoot = path.resolve(__dirname, '../locales');
const englishLocaleSource = fs.readFileSync(path.join(localesRoot, 'en.json'), 'utf8');
const spanishLocaleSource = fs.readFileSync(path.join(localesRoot, 'es.json'), 'utf8');
const chineseLocaleSource = fs.readFileSync(path.join(localesRoot, 'zh.json'), 'utf8');

describe('BugManagement mobile modal guards', () => {
  it('keeps create/edit and status modals on the mobile-safe BUG modal shell', () => {
    expect(pageSource).toContain('className="profile-mobile-safe-modal bug-management__modal"');
    expect(pageSource).toContain('className="profile-mobile-safe-modal bug-management__modal bug-management__statusModal"');
    expect(pageSource).toContain("tx('createBug', 'Create bug')");
    expect(pageSource).toContain("tx('editBug', 'Edit bug')");
    expect(pageSource).toContain("tx('scanBug', 'Scan bug')");
    expect(pageSource).toContain("tx('updateStatus', 'Update status')");
    expect(pageSource).toContain('name="module"');
    expect(pageSource).toContain('name="severity"');
    expect(pageSource).toContain('name="priority"');
    expect(pageSource).toContain('name="status"');
    expect(pageSource.match(/classNames=\{mobilePopupClassNames\}/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('reserves scroll clearance so BUG modal fields cannot sit under the sticky footer', () => {
    const f3531Start = cssSource.indexOf('/* F3531');
    const f3531Css = cssSource.slice(f3531Start);

    expect(f3531Start).toBeGreaterThanOrEqual(0);
    expect(f3531Css).toMatch(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.bug-management__modal\.ant-modal\s*\{[\s\S]*?width:\s*calc\(100vw - 16px\)\s*!important;/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-content\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 18px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-body\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?flex:\s*1 1 auto\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important;[\s\S]*?padding-bottom:\s*calc\(156px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;[\s\S]*?scroll-padding-bottom:\s*calc\(172px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important;/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-form-item\s*\{[\s\S]*?scroll-margin-bottom:\s*calc\(172px \+ env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.bug-management__formGrid:not\(\.bug-management__formGrid--wide\)\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-footer\s*\{[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?bottom:\s*0\s*!important;[\s\S]*?z-index:\s*5\s*!important;[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\)\s*!important;/);
  });

  it('keeps mobile BUG filters compact and generated table-card labels readable', () => {
    expect(pageSource.match(/className="bug-management__filter"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(pageSource).toContain("onCell: () => ({ 'data-label': tx('severity', 'Severity') } as React.HTMLAttributes<HTMLElement>)");
    expect(pageSource).toContain("onCell: () => ({ 'data-label': tx('status', 'Status') } as React.HTMLAttributes<HTMLElement>)");
    expect(pageSource).toContain("onCell: () => ({ 'data-label': tx('scanAndUpdate', 'Scan / update') } as React.HTMLAttributes<HTMLElement>)");
    expect(pageSource).toContain("onCell: () => ({ 'data-label': tx('actions', 'Actions') } as React.HTMLAttributes<HTMLElement>)");

    const f2763Start = cssSource.indexOf('/* F2763');
    const f2763Css = cssSource.slice(f2763Start);

    expect(f2763Start).toBeGreaterThanOrEqual(0);
    expect(f2763Css).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.bug-management__toolbar\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(f2763Css).toMatch(/\.bug-management__toolbar \.ant-select,[\s\S]*?\.bug-management__toolbar \.ant-select-selector\s*\{[\s\S]*?height:\s*44px\s*!important;[\s\S]*?min-height:\s*44px\s*!important;[\s\S]*?max-height:\s*44px\s*!important;/);
    expect(f2763Css).toMatch(/\.bug-management__toolbar \.ant-select-selection-search,[\s\S]*?\.bug-management__toolbar \.ant-select-selection-placeholder\s*\{[\s\S]*?height:\s*42px\s*!important;[\s\S]*?line-height:\s*42px\s*!important;/);
    expect(f2763Css).toMatch(/td\[data-label\]\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(104px,\s*34%\) minmax\(0,\s*1fr\);[\s\S]*?padding:\s*10px 12px\s*!important;/);
    expect(f2763Css).toMatch(/td\[data-label\]::before\s*\{[\s\S]*?position:\s*static;[\s\S]*?width:\s*auto;[\s\S]*?overflow:\s*visible;[\s\S]*?white-space:\s*normal;/);
    expect(f2763Css).toMatch(/@media \(max-width:\s*380px\)\s*\{[\s\S]*?td\[data-label\]\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?gap:\s*4px;/);
  });

  it('keeps BUG priority labels localized in filters, forms, and table rows', () => {
    expect(pageSource).toContain('const priorityLabels = useMemo<Record<string, string>>(() => ({');
    expect(pageSource).toContain("P0: tx('priorityP0', 'P0 urgent')");
    expect(pageSource).toContain("P1: tx('priorityP1', 'P1 high')");
    expect(pageSource).toContain("P2: tx('priorityP2', 'P2 normal')");
    expect(pageSource).toContain("P3: tx('priorityP3', 'P3 low')");
    expect(pageSource).toContain('<Text type="secondary">{priorityLabels[bug.priority] || bug.priority}</Text>');
    expect(pageSource).toContain("priorityOptions.map((priority) => ({ value: priority, label: priorityLabels[priority] || priority }))");

    for (const localeSource of [englishLocaleSource, spanishLocaleSource, chineseLocaleSource]) {
      expect(localeSource).toContain('"priorityP0"');
      expect(localeSource).toContain('"priorityP1"');
      expect(localeSource).toContain('"priorityP2"');
      expect(localeSource).toContain('"priorityP3"');
    }
  });

  it('keeps permission loading separate from the no-permission state with a visible skeleton', () => {
    const permissionEffectStart = pageSource.indexOf('useEffect(() => {\n    if (!permissionsLoaded) return;');
    const permissionLoadStart = pageSource.indexOf('const loadPermissions = useCallback(async () => {');
    const permissionLoadSource = pageSource.slice(permissionLoadStart, pageSource.indexOf('useEffect(() => {', permissionLoadStart));

    expect(pageSource).toContain('const [permissionsLoaded, setPermissionsLoaded] = useState(false);');
    expect(permissionLoadSource).toContain('setPermissionsLoaded(true);');
    expect(permissionEffectStart).toBeGreaterThan(-1);
    expect(pageSource).toContain('{!permissionsLoaded ? (');
    expect(pageSource).toContain('<div className="bug-management__skeleton" aria-busy="true">');
    expect(pageSource).toContain('<Skeleton active paragraph={{ rows: 8 }} />');
    expect(pageSource).toContain('{!canReadBugs ? (');
    expect(pageSource.indexOf('{!permissionsLoaded ? (')).toBeLessThan(pageSource.indexOf('{!canReadBugs ? ('));
  });

  it('keeps the scan queue switch accessible by name', () => {
    expect(pageSource).toContain("const bugSearchLabel = `${bugPageLabel}: ${tx('searchPlaceholder', 'Search title, URL, description or notes')}`;");
    expect(pageSource).toContain("aria-label={bugSearchLabel}");
    expect(pageSource).toContain("<Switch checked={scanQueueOnly} onChange={setScanQueueOnly} aria-label={tx('scanQueueOnly', 'Scan queue')} disabled={!canReadBugs} />");
    expect(pageSource).toContain("<Text>{tx('scanQueueOnly', 'Scan queue')}</Text>");

    for (const localeSource of [englishLocaleSource, spanishLocaleSource, chineseLocaleSource]) {
      expect(localeSource).toContain('"scanQueueOnly"');
    }
  });

  it('keeps BUG admin buttons and filters accessible by contextual names', () => {
    expect(pageSource).toContain("const bugStatusFilterLabel = `${bugPageLabel}: ${tx('status', 'Status')}`;");
    expect(pageSource).toContain("const bugSeverityFilterLabel = `${bugPageLabel}: ${tx('severity', 'Severity')}`;");
    expect(pageSource).toContain("const bugModuleFilterLabel = `${bugPageLabel}: ${tx('module', 'Module')}`;");
    expect(pageSource).toContain("const bugRefreshActionLabel = `${bugPageLabel}: ${tx('refresh', 'Refresh')}`;");
    expect(pageSource).toContain("const newBugActionLabel = `${bugPageLabel}: ${tx('newBug', 'New bug')}`;");
    expect(pageSource).toContain("const editActionLabel = `${tx('edit', 'Edit')}: ${bugLabel}`;");
    expect(pageSource).toContain("const scanActionLabel = `${tx('scan', 'Scan')}: ${bugLabel}`;");
    expect(pageSource).toContain("const statusActionLabel = `${tx('statusAction', 'Status')}: ${bugLabel}`;");
    expect(pageSource).toContain('aria-label={editActionLabel} title={editActionLabel}');
    expect(pageSource).toContain('aria-label={scanActionLabel} title={scanActionLabel}');
    expect(pageSource).toContain('aria-label={statusActionLabel} title={statusActionLabel}');
    expect(pageSource).toContain('aria-label={bugRefreshActionLabel} title={bugRefreshActionLabel}');
    expect(pageSource).toContain('aria-label={newBugActionLabel} title={newBugActionLabel}');
    expect(pageSource).toContain('aria-label={bugStatusFilterLabel}');
    expect(pageSource).toContain('aria-label={bugSeverityFilterLabel}');
    expect(pageSource).toContain('aria-label={bugModuleFilterLabel}');
    expect(pageSource).toContain("okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugActionLabel, title: saveBugActionLabel }}");
    expect(pageSource).toContain("cancelButtonProps={{ 'aria-label': cancelBugActionLabel, title: cancelBugActionLabel }}");
    expect(pageSource).toContain("okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugStatusActionLabel, title: saveBugStatusActionLabel }}");
    expect(pageSource).toContain("cancelButtonProps={{ 'aria-label': cancelBugStatusActionLabel, title: cancelBugStatusActionLabel }}");
  });

  it('keeps BUG row cards and actions responsive at tablet and short-landscape widths', () => {
    expect(pageSource).toContain('<Space wrap className="bug-management__rowActions">');

    const f2718ResidualStart = cssSource.indexOf('/* F2718/F2320 residual');
    const f2718ResidualCss = cssSource.slice(f2718ResidualStart);

    expect(f2718ResidualStart).toBeGreaterThanOrEqual(0);
    expect(f2718ResidualCss).toMatch(/@media \(max-width:\s*900px\),\s*\(max-height:\s*640px\)\s*\{/);
    expect(f2718ResidualCss).toMatch(/\.bug-management__table \.ant-table-content > table\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%\s*!important;[\s\S]*?min-width:\s*0\s*!important;/);
    expect(f2718ResidualCss).toMatch(/\.bug-management__table \.ant-table-thead\s*\{[\s\S]*?display:\s*none;/);
    expect(f2718ResidualCss).toMatch(/td\[data-label\]\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*minmax\(104px,\s*34%\) minmax\(0,\s*1fr\);/);
    expect(f2718ResidualCss).toContain('.bug-management__table .bug-management__rowActions');
    expect(f2718ResidualCss).toContain('grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));');
    expect(f2718ResidualCss).toContain('min-height: 44px;');
    expect(f2718ResidualCss).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('uses the server-provided scan interval with a bounded fallback instead of a fixed poll cadence', () => {
    const scanRefreshStart = pageSource.indexOf('const scanRefreshMs = useMemo(() => {');
    const scanRefreshSource = pageSource.slice(scanRefreshStart, pageSource.indexOf('const noPermissionLabel', scanRefreshStart));
    const intervalEffectStart = pageSource.indexOf('useEffect(() => {\n    if (!permissionsLoaded || !canReadBugs) return;');
    const intervalEffectSource = pageSource.slice(intervalEffectStart, pageSource.indexOf('const openEditor', intervalEffectStart));

    expect(pageSource).toContain('const DEFAULT_SCAN_REFRESH_MS = 10 * 60 * 1000;');
    expect(scanRefreshStart).toBeGreaterThan(-1);
    expect(scanRefreshSource).toContain('const intervalMinutes = Number(summary?.scanIntervalMinutes);');
    expect(scanRefreshSource).toContain('return DEFAULT_SCAN_REFRESH_MS;');
    expect(scanRefreshSource).toContain('return Math.max(60 * 1000, intervalMinutes * 60 * 1000);');
    expect(scanRefreshSource).toContain('}, [summary?.scanIntervalMinutes]);');
    expect(intervalEffectSource).toContain('}, scanRefreshMs);');
    expect(intervalEffectSource).toContain('}, [canReadBugs, permissionsLoaded, reload, scanRefreshMs]);');
  });

  it('keeps BUG list rows light and lazy-loads full details only on expansion', () => {
    expect(apiSource).toContain('getBug: (id: number) => api.get<AdminBugReport>(`/admin/bugs/${toPathId(id)}`)');
    expect(pageSource).toContain('const [bugDetails, setBugDetails] = useState<Record<number, AdminBugReport>>({});');
    expect(pageSource).toContain('const [loadingDetailIds, setLoadingDetailIds] = useState<Set<number>>(() => new Set());');
    expect(pageSource).toContain('const loadBugDetail = useCallback(async (bugId: number) => {');
    expect(pageSource).toContain('const response = await adminApi.getBug(bugId);');
    expect(pageSource).toContain('setBugDetails((current) => ({ ...current, [bugId]: response.data }));');
    expect(pageSource).toContain('const detail = bugDetails[bug.id] || bug;');
    expect(pageSource).toContain('<Spin spinning={loadingDetailIds.has(bug.id)}>');
    expect(pageSource).toContain('onExpand: (expanded, bug) => {');
    expect(pageSource).toContain('void loadBugDetail(bug.id);');
    expect(pageSource).toContain('<Paragraph>{detail.description || \'-\'}</Paragraph>');
    expect(pageSource).toContain('<Paragraph>{detail.scanNote || \'-\'}</Paragraph>');
  });

  it('keeps BUG API pagination zero-based while translating Ant table pages at the UI boundary', () => {
    expect(pageSource).toContain('const DEFAULT_PAGE_INDEX = 0;');
    expect(pageSource).toContain('const toBugApiPage = (tablePage: number) => Math.max(DEFAULT_PAGE_INDEX, tablePage - 1);');
    expect(pageSource).toContain('const toBugTablePage = (apiPage: number) => apiPage + 1;');
    expect(pageSource).toContain('page: DEFAULT_PAGE_INDEX,');
    expect(pageSource).toContain('const currentPageRef = useRef(DEFAULT_PAGE_INDEX);');
    expect(pageSource).toContain('const resolvedPage = response.data.page ?? nextPage;');
    expect(pageSource).toContain('current: toBugTablePage(pageState.page),');
    expect(pageSource).toContain('onChange: (page, size) => loadBugs(toBugApiPage(page), size || pageState.size),');
    expect(apiSource).toContain('page: normalizeNonNegativeIntParam(params?.page, 0, 1_000_000)');
  });
});

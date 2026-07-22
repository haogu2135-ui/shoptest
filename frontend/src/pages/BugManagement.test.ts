import fs from 'fs';
import path from 'path';

const pageSource = fs.readFileSync(path.join(__dirname, 'BugManagement.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, 'BugManagement.css'), 'utf8');
const apiSource = [
  fs.readFileSync(path.resolve(__dirname, '../api/admin.ts'), 'utf8'),
  fs.readFileSync(path.resolve(__dirname, '../api/core.ts'), 'utf8'),
].join('\n');
const typesSource = fs.readFileSync(path.resolve(__dirname, '../types.ts'), 'utf8');
const localesRoot = path.resolve(__dirname, '../locales');
const englishLocaleSource = fs.readFileSync(path.join(localesRoot, 'en.json'), 'utf8');
const spanishLocaleSource = fs.readFileSync(path.join(localesRoot, 'es-admin-pages.json'), 'utf8');
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
    expect(pageSource).toContain('ShopSelect');
    expect(pageSource.match(/popupClassName="shop-mobile-popup-layer"/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('reserves scroll clearance so BUG modal fields cannot sit under the sticky footer', () => {
    const f3531Start = cssSource.indexOf('/* F3531');
    const f3531Css = cssSource.slice(f3531Start);

    expect(f3531Start).toBeGreaterThanOrEqual(0);
    expect(f3531Css).toMatch(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.bug-management__modal\.ant-modal(?:,[\s\S]*?)?\s*\{[\s\S]*?width:\s*calc\(100vw - 16px\)\s*!important;/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-content(?:,[\s\S]*?)?\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 18px - env\(safe-area-inset-top,\s*0px\) - env\(safe-area-inset-bottom,\s*0px\)\);[\s\S]*?display:\s*flex\s*!important;[\s\S]*?flex-direction:\s*column\s*!important;[\s\S]*?overflow:\s*hidden\s*!important;/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-body(?:,[\s\S]*?)?\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?flex:\s*1 1 auto\s*!important;[\s\S]*?overflow-y:\s*auto\s*!important;/);
    expect(f3531Css).toContain('.shop-modal__content');
    expect(f3531Css).toContain('.shop-modal__body');
    expect(f3531Css).toContain('.shop-modal__footer');
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-form-item\s*\{[\s\S]*?scroll-margin-bottom:\s*calc\(172px \+ env\(safe-area-inset-bottom,\s*0px\)\);/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.bug-management__formGrid:not\(\.bug-management__formGrid--wide\)\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(f3531Css).toMatch(/\.bug-management__modal \.ant-modal-footer(?:,[\s\S]*?)?\s*\{[\s\S]*?position:\s*sticky\s*!important;[\s\S]*?bottom:\s*0\s*!important;[\s\S]*?z-index:\s*5\s*!important;[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\)\s*!important;/);
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
    const permissionSkeletonStart = pageSource.indexOf('className="bug-management__skeleton"');
    const bugListSkeletonStart = pageSource.indexOf('className="bug-management__skeleton bug-management__loadingState"');
    const bugListSkeletonEnd = pageSource.indexOf('{canRenderBugStats ? (', bugListSkeletonStart);

    expect(pageSource).toContain('const [permissionsLoaded, setPermissionsLoaded] = useState(false);');
    expect(permissionLoadSource).toContain('setPermissionsLoaded(true);');
    expect(permissionEffectStart).toBeGreaterThan(-1);
    expect(pageSource).toContain('{!permissionsLoaded ? (');
    expect(permissionSkeletonStart).toBeGreaterThan(-1);
    expect(bugListSkeletonStart).toBeGreaterThan(permissionSkeletonStart);
    expect(bugListSkeletonEnd).toBeGreaterThan(bugListSkeletonStart);
    [pageSource.slice(permissionSkeletonStart, bugListSkeletonStart), pageSource.slice(bugListSkeletonStart, bugListSkeletonEnd)].forEach((loadingSource) => {
      expect(loadingSource).toContain('role="status"');
      expect(loadingSource).toContain('aria-live="polite"');
      expect(loadingSource).toContain('aria-busy="true"');
      expect(loadingSource).toContain("aria-label={`${bugPageLabel}: ${t('common.loading')}`}");
      expect(loadingSource).toContain('<Skeleton active paragraph={{ rows: 8 }} />');
    });
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
    expect(pageSource).toContain('ariaLabel={bugStatusFilterLabel}');
    expect(pageSource).toContain('ariaLabel={bugSeverityFilterLabel}');
    expect(pageSource).toContain('ariaLabel={bugModuleFilterLabel}');
    expect(pageSource).toContain("okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugActionLabel, title: saveBugActionLabel }}");
    expect(pageSource).toContain("cancelButtonProps={{ 'aria-label': cancelBugActionLabel, title: cancelBugActionLabel }}");
    expect(pageSource).toContain("okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugStatusActionLabel, title: saveBugStatusActionLabel }}");
    expect(pageSource).toContain("cancelButtonProps={{ 'aria-label': cancelBugStatusActionLabel, title: cancelBugStatusActionLabel }}");
  });

  it('keeps BUG table columns memoized across unrelated admin page rerenders', () => {
    const statusEditorStart = pageSource.indexOf("const openStatusEditor = useCallback((bug: AdminBugReport, mode: 'scan' | 'status', nextStatus?: string) => {");
    const statusEditorEnd = pageSource.indexOf('const handleStatusSave = async () => {', statusEditorStart);
    const statusEditorSource = pageSource.slice(statusEditorStart, statusEditorEnd);
    const columnsStart = pageSource.indexOf('const columns = useMemo<ColumnsType<AdminBugReport>>(() => [');
    const columnsEnd = pageSource.indexOf('const showInitialBugLoading', columnsStart);
    const columnsSource = pageSource.slice(columnsStart, columnsEnd);

    expect(statusEditorStart).toBeGreaterThan(-1);
    expect(statusEditorEnd).toBeGreaterThan(statusEditorStart);
    expect(statusEditorSource).toContain('setStatusOpen(true);');
    expect(statusEditorSource).toContain('}, [bugActionUnavailableMessage, bugMutationDisabled, canScanBugs, canUpdateBugStatus, statusForm, t]);');
    expect(columnsStart).toBeGreaterThan(-1);
    expect(columnsEnd).toBeGreaterThan(columnsStart);
    expect(pageSource).not.toContain('const columns: ColumnsType<AdminBugReport> = [');
    expect(columnsSource).toContain("title: tx('bug', 'Bug')");
    expect(columnsSource).toContain('<Space wrap className="bug-management__rowActions">');
    expect(columnsSource).toContain("openStatusEditor(bug, 'scan')");
    expect(columnsSource).toContain('withPermissionTooltip(');
    expect(columnsSource).toContain('], [');
    expect(columnsSource).toContain('openEditor,');
    expect(columnsSource).toContain('openStatusEditor,');
    expect(columnsSource).toContain('withPermissionTooltip,');
    expect(pageSource).toContain('columns={columns}');
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
    const intervalEffectStart = pageSource.indexOf('useEffect(() => {\n    if (!permissionsLoaded || !canReadBugs || bugModalOpen || loading) return;');
    const intervalEffectSource = pageSource.slice(intervalEffectStart, pageSource.indexOf('const openEditor', intervalEffectStart));

    expect(pageSource).toContain('const DEFAULT_SCAN_REFRESH_MS = 10 * 60 * 1000;');
    expect(pageSource).toContain('const bugModalOpen = editorOpen || statusOpen;');
    expect(scanRefreshStart).toBeGreaterThan(-1);
    expect(scanRefreshSource).toContain('const intervalMinutes = Number(summary?.scanIntervalMinutes);');
    expect(scanRefreshSource).toContain('return DEFAULT_SCAN_REFRESH_MS;');
    expect(scanRefreshSource).toContain('return Math.max(60 * 1000, intervalMinutes * 60 * 1000);');
    expect(scanRefreshSource).toContain('}, [summary?.scanIntervalMinutes]);');
    expect(intervalEffectSource).toContain('if (!permissionsLoaded || !canReadBugs || bugModalOpen || loading) return;');
    expect(intervalEffectSource).toContain('}, scanRefreshMs);');
    expect(intervalEffectSource).toContain('}, [bugModalOpen, canReadBugs, loading, permissionsLoaded, reload, scanRefreshMs]);');
  });

  it('aborts stale BUG list requests before applying list state', () => {
    const loadBugsStart = pageSource.indexOf('const loadBugs = useCallback(async (');
    const loadBugsEnd = pageSource.indexOf('const loadBugDetail = useCallback(async', loadBugsStart);
    const loadBugsSource = pageSource.slice(loadBugsStart, loadBugsEnd);

    expect(pageSource).toContain('const bugListAbortRef = useRef<AbortController | null>(null);');
    expect(apiSource).toContain('getBugs: (params?: { page?: number; size?: number; status?: string; severity?: string; module?: string; keyword?: string; scanQueueOnly?: boolean }, signal?: AbortSignal) =>');
    expect(apiSource).toContain('...(signal ? { signal } : {})');
    expect(loadBugsSource).toContain('bugListAbortRef.current?.abort();');
    expect(loadBugsSource).toContain('const controller = new AbortController();');
    expect(loadBugsSource).toContain('bugListAbortRef.current = controller;');
    expect(loadBugsSource).toContain('}, controller.signal);');
    expect(loadBugsSource).toContain('if (controller.signal.aborted) return;');
    expect(loadBugsSource).toContain('if (bugListAbortRef.current === controller) {');
    expect(pageSource).toContain('bugListAbortRef.current?.abort();\n  }, []);');
  });

  it('rechecks BUG status permissions before saving status modal actions', () => {
    const saveStart = pageSource.indexOf('const handleStatusSave = async () => {');
    const saveEnd = pageSource.indexOf('const summaryCards = [', saveStart);
    const saveSource = pageSource.slice(saveStart, saveEnd);

    expect(saveSource).toContain("const canSaveCurrentStatusMode = statusMode === 'scan' ? canScanBugs : canUpdateBugStatus;");
    expect(saveSource).toContain('if (!canSaveCurrentStatusMode) {');
    expect(saveSource).toContain("message.error(t('adminLayout.noPermission'));");
    expect(saveSource.indexOf('if (!canSaveCurrentStatusMode) {')).toBeLessThan(saveSource.indexOf('const values = await statusForm.validateFields();'));
    expect(saveSource.indexOf('if (!canSaveCurrentStatusMode) {')).toBeLessThan(saveSource.indexOf('adminApi.markBugScanned'));
    expect(saveSource.indexOf('if (!canSaveCurrentStatusMode) {')).toBeLessThan(saveSource.indexOf('adminApi.updateBugStatus'));
  });

  it('keeps BUG list rows light and lazy-loads full details only on expansion', () => {
    expect(apiSource).toContain('getBug: (id: number) => api.get<AdminBugReport>(`/admin/bugs/${toPathId(id)}`)');
    expect(pageSource).toContain('const [bugDetails, setBugDetails] = useState<Record<number, AdminBugReport>>({});');
    expect(pageSource).toContain('const [loadingDetailIds, setLoadingDetailIds] = useState<Set<number>>(() => new Set());');
    expect(pageSource).toContain('const loadBugDetail = useCallback(async (bugId: number) => {');
    expect(pageSource).toContain('const response = await adminApi.getBug(bugId);');
    expect(pageSource).toContain('setBugDetails((current) => ({ ...current, [bugId]: response.data }));');
    expect(pageSource).toContain('const detail = bugDetails[bug.id] || bug;');
    expect(pageSource).toContain('const detailLoading = loadingDetailIds.has(bug.id);');
    expect(pageSource).toContain("const detailLoadingLabel = `${tx('bug', 'Bug')}: ${bugDisplayLabel(bug)} ${t('common.loading')}`;");
    expect(pageSource).toContain('spinning={detailLoading}');
    expect(pageSource).toContain('aria-busy={detailLoading}');
    expect(pageSource).toContain('aria-label={detailLoading ? detailLoadingLabel : undefined}');
    expect(pageSource).toContain('onExpand: (expanded, bug) => {');
    expect(pageSource).toContain('void loadBugDetail(bug.id);');
    expect(pageSource).toContain('<Paragraph>{detail.description || \'-\'}</Paragraph>');
    expect(pageSource).toContain('<Paragraph>{detail.scanNote || \'-\'}</Paragraph>');
  });

  it('renders BUG page and attachment URLs as safe clickable references', () => {
    expect(pageSource).toContain('const { Link: TextLink, Paragraph, Text, Title } = Typography;');
    expect(pageSource).toContain('const resolveBugReferenceHref = (value?: string) => {');
    expect(pageSource).toContain("normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.includes('\\\\')");
    expect(pageSource).toContain("parsed.origin === browserOrigin");
    expect(pageSource).toContain('<TextLink href={href} target="_blank" rel="noopener noreferrer" className={className}>');
    expect(pageSource).toContain('const isBugAttachmentHref = (value?: string) => {');
    expect(pageSource).toContain('const renderBugAttachmentLink = (value: string, onOpen: (value: string) => void) => {');
    expect(pageSource).toContain('const openBugAttachment = useCallback(async (value: string) => {');
    expect(pageSource).toContain('const response = await adminApi.downloadBugAttachment(value);');
    expect(pageSource).toContain("window.open(objectUrl, '_blank', 'noopener,noreferrer');");
    expect(pageSource).toContain('const parseBugReferenceLines = (value?: string) => (');
    expect(pageSource).toContain("renderBugReferenceLink(bug.pageUrl, 'bug-management__pageUrl')");
    expect(pageSource).toContain('const attachmentUrls = parseBugReferenceLines(detail.attachmentUrls);');
    expect(pageSource).toContain('attachmentUrls.map((url, index) => (');
    expect(pageSource).toContain('{renderBugAttachmentLink(url, openBugAttachment)}');
    expect(pageSource).not.toContain('<Text type="secondary" className="bug-management__pageUrl">{bug.pageUrl}</Text>');
    expect(pageSource).not.toContain('<Paragraph>{detail.attachmentUrls || \'-\'}</Paragraph>');
  });

  it('supports admin bug screenshot uploads by appending protected attachment URLs to the form', () => {
    expect(apiSource).toContain('uploadBugAttachment: (file: File) => {');
    expect(apiSource).toContain("return api.post<AdminBugAttachmentUploadResponse>('/admin/bugs/attachments', formData);");
    expect(apiSource).toContain('const normalizeBugAttachmentApiPath = (value: unknown) => {');
    expect(apiSource).toContain("pathFromUrl.startsWith('/api/admin/bugs/attachments/')");
    expect(apiSource).toContain('downloadBugAttachment: (attachmentUrl: string) => api.get<Blob>(normalizeBugAttachmentApiPath(attachmentUrl), {');
    expect(pageSource).toContain("const MAX_BUG_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;");
    expect(pageSource).toContain('const MAX_BUG_ATTACHMENT_URL_COUNT = 20;');
    expect(pageSource).toContain("const BUG_ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];");
    expect(pageSource).toContain('const validateAttachmentUrls = useCallback((_: unknown, value?: string) => {');
    expect(pageSource).toContain('const handleAttachmentUpload = async (file: File) => {');
    expect(pageSource).toContain('const response = await adminApi.uploadBugAttachment(file);');
    expect(pageSource).toContain("const attachmentUrl = String(response.data.attachmentUrl || '').trim();");
    expect(pageSource).toContain("const currentValue = String(form.getFieldValue('attachmentUrls') || '').trim();");
    expect(pageSource).toContain("const nextCount = nextValue.split('\\n').map((item) => item.trim()).filter(Boolean).length;");
    expect(pageSource).toContain('form.setFieldsValue({ attachmentUrls: nextValue });');
    expect(pageSource).toContain('rules={[{ validator: validateAttachmentUrls }]}');
    expect(pageSource).toContain('beforeUpload={handleAttachmentUpload}');
    expect(pageSource).toContain('<UploadOutlined />');
  });

  it('keeps admin bug response types free of backend-only workflow fields', () => {
    const typeStart = typesSource.indexOf('export interface AdminBugReport {');
    const typeEnd = typesSource.indexOf('export interface AdminBugAttachmentUploadResponse', typeStart);
    const bugType = typesSource.slice(typeStart, typeEnd);

    expect(typeStart).toBeGreaterThan(-1);
    expect(typeEnd).toBeGreaterThan(typeStart);
    expect(bugType).toContain('reporterName?: string;');
    expect(bugType).not.toContain('reporterId');
    expect(bugType).not.toContain('fixedBy');
    expect(bugType).not.toContain('regressionBy');
    expect(bugType).not.toContain('version');
  });

  it('keeps admin bug status severity and priority as strict unions', () => {
    const typeStart = typesSource.indexOf('export interface AdminBugReport {');
    const typeEnd = typesSource.indexOf('export interface AdminBugAttachmentUploadResponse', typeStart);
    const bugType = typesSource.slice(typeStart, typeEnd);

    expect(typesSource).toContain("export type AdminBugReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';");
    expect(typesSource).toContain("export type AdminBugReportPriority = 'P0' | 'P1' | 'P2' | 'P3';");
    expect(typesSource).toContain("export type AdminBugReportStatus = 'OPEN' | 'FIXING' | 'FIXED_PENDING_REGRESSION' | 'REGRESSION_PASSED' | 'REGRESSION_FAILED' | 'CLOSED' | 'NON_ISSUE';");
    expect(bugType).toContain('severity: AdminBugReportSeverity;');
    expect(bugType).toContain('priority: AdminBugReportPriority;');
    expect(bugType).toContain('status: AdminBugReportStatus;');
    expect(bugType).not.toContain("'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string");
    expect(bugType).not.toContain("'P0' | 'P1' | 'P2' | 'P3' | string");
    expect(bugType).not.toContain("'OPEN' | 'FIXING'");
    expect(pageSource).toContain('const isBugStatus = (status?: string): status is AdminBugReportStatus => (');
    expect(pageSource).toContain("const openStatusEditor = useCallback((bug: AdminBugReport, mode: 'scan' | 'status', nextStatus?: AdminBugReportStatus) => {");
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

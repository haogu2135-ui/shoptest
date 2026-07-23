import { useNavigate } from 'react-router-dom';
import PageError from '../components/PageError';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Table } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopSelect from '../components/ShopSelect';
import ShopModal from '../components/ShopModal';
import ShopSwitch from '../components/ShopSwitch';
import type { ColumnsType } from 'antd/es/table';
import { BugOutlined, CheckCircleOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SyncOutlined, ToolOutlined, UploadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import type { AdminBugReport, AdminBugReportPriority, AdminBugReportSeverity, AdminBugReportStatus, AdminBugReportSummary } from '../types';
import { useLanguage } from '../i18n';
import { useDebounce } from '../hooks/useDebounce';
import { getApiErrorMessage } from '../utils/apiError';
import {
  BUGS_ACCESS_PERMISSIONS,
  BUGS_SCAN_PERMISSION,
  BUGS_STATUS_PERMISSION,
  BUGS_WRITE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import './BugManagement.css';
import ShopButton from '../components/ShopButton';
import ShopTooltip from '../components/ShopTooltip';
import ShopSkeleton from '../components/ShopSkeleton';
import ShopUpload from '../components/ShopUpload';
import ShopSpin from '../components/ShopSpin';
import ShopStatistic from '../components/ShopStatistic';
import message from '../components/ShopMessage';

import ShopTag from '../components/ShopTag';
import ShopAlert from '../components/ShopAlert';
import ShopSpace from '../components/ShopSpace';
import ShopTypography from '../components/ShopTypography';
const TextLink = ShopTypography.Link;
const Paragraph = ShopTypography.Paragraph;
const Text = ShopTypography.Text;
const Title = ShopTypography.Title;
const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SCAN_REFRESH_MS = 10 * 60 * 1000;
const MAX_BUG_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_BUG_ATTACHMENT_URL_COUNT = 20;
const BUG_ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };

const toBugApiPage = (tablePage: number) => Math.max(DEFAULT_PAGE_INDEX, tablePage - 1);
const toBugTablePage = (apiPage: number) => apiPage + 1;
const bugDisplayLabel = (bug: Pick<AdminBugReport, 'id' | 'title'>) => (
  String(bug.title || '').trim() || `#${bug.id}`
);

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const statusOptions = [
  'ALL',
  'OPEN',
  'FIXING',
  'FIXED_PENDING_REGRESSION',
  'REGRESSION_PASSED',
  'REGRESSION_FAILED',
  'NON_ISSUE',
  'CLOSED',
] as const;

const statusUpdateOptions = statusOptions.filter((status): status is AdminBugReportStatus => status !== 'ALL');
const statusTransitionOptions: Record<AdminBugReportStatus, AdminBugReportStatus[]> = {
  OPEN: ['OPEN', 'FIXING', 'NON_ISSUE'],
  FIXING: ['FIXING', 'FIXED_PENDING_REGRESSION', 'NON_ISSUE'],
  FIXED_PENDING_REGRESSION: ['FIXED_PENDING_REGRESSION', 'REGRESSION_PASSED', 'REGRESSION_FAILED', 'NON_ISSUE'],
  REGRESSION_PASSED: ['REGRESSION_PASSED', 'CLOSED', 'REGRESSION_FAILED'],
  REGRESSION_FAILED: ['REGRESSION_FAILED', 'FIXING', 'NON_ISSUE'],
  CLOSED: ['CLOSED', 'OPEN'],
  NON_ISSUE: ['NON_ISSUE', 'OPEN'],
};
const severityOptions: readonly ('ALL' | AdminBugReportSeverity)[] = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const priorityOptions: AdminBugReportPriority[] = ['P0', 'P1', 'P2', 'P3'];
const moduleOptions = [
  'ALL',
  'GENERAL',
  'FRONTEND',
  'BACKEND',
  'ANDROID_APP',
  'ADMIN',
  'PAYMENT',
  'ORDER',
  'PRODUCT',
  'SUPPORT',
  'INFRASTRUCTURE',
];

const statusColor = (status?: string) => {
  if (status === 'OPEN' || status === 'REGRESSION_FAILED') return 'red';
  if (status === 'FIXING') return 'gold';
  if (status === 'FIXED_PENDING_REGRESSION') return 'blue';
  if (status === 'REGRESSION_PASSED') return 'green';
  if (status === 'NON_ISSUE') return 'purple';
  return 'default';
};

const severityColor = (severity?: string) => {
  if (severity === 'CRITICAL') return 'magenta';
  if (severity === 'HIGH') return 'red';
  if (severity === 'MEDIUM') return 'gold';
  return 'blue';
};

const isBugStatus = (status?: string): status is AdminBugReportStatus => (
  Boolean(status) && statusUpdateOptions.includes(status as AdminBugReportStatus)
);
const getStatusUpdateOptions = (status?: string) => (isBugStatus(status) ? statusTransitionOptions[status] : statusUpdateOptions);
const isScannableStatus = (status?: string) => status === 'OPEN' || status === 'FIXING' || status === 'REGRESSION_FAILED';

const resolveBugReferenceHref = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.includes('\\')) {
    return normalized;
  }
  try {
    const parsed = new URL(normalized);
    const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === browserOrigin) {
      return parsed.toString();
    }
  } catch (error) {
    reportNonBlockingError('BugManagement.resolveBugReferenceHref', error);
  }
  return null;
};

const renderBugReferenceLink = (value?: string, className?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const href = resolveBugReferenceHref(normalized);
  if (!href) {
    return <Text type="secondary" className={className}>{normalized}</Text>;
  }
  return (
    <TextLink href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {normalized}
    </TextLink>
  );
};

const isBugAttachmentHref = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.includes('\\') || normalized.includes('..')) return false;
  const path = (() => {
    if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
    try {
      const parsed = new URL(normalized);
      const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
      return parsed.origin === browserOrigin ? parsed.pathname : '';
    } catch (error) {
      reportNonBlockingError('BugManagement.isBugAttachmentHref', error);
      return '';
    }
  })();
  return /^\/(?:api\/)?admin\/bugs\/attachments\/[0-9a-f-]{36}\.(?:jpg|png)$/i.test(path);
};

const renderBugAttachmentLink = (value: string, onOpen: (value: string) => void) => {
  const normalized = String(value || '').trim();
  const href = resolveBugReferenceHref(normalized);
  if (!href || !isBugAttachmentHref(href)) {
    return renderBugReferenceLink(value);
  }
  return (
    <TextLink
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onOpen(normalized);
      }}
    >
      {normalized}
    </TextLink>
  );
};

const parseBugReferenceLines = (value?: string) => (
  String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
);

const BugManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bugs, setBugs] = useState<AdminBugReport[]>([]);
  const [bugDetails, setBugDetails] = useState<Record<number, AdminBugReport>>({});
  const [loadingDetailIds, setLoadingDetailIds] = useState<Set<number>>(() => new Set());
  const [summary, setSummary] = useState<AdminBugReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [bugListLoadError, setBugListLoadError] = useState<string | null>(null);
  const [bugSnapshotLoaded, setBugSnapshotLoaded] = useState(false);
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null);
  const [summarySnapshotLoaded, setSummarySnapshotLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [acting, setActing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim(), 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [scanQueueOnly, setScanQueueOnly] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<AdminBugReport | null>(null);
  const [statusBug, setStatusBug] = useState<AdminBugReport | null>(null);
  const [statusMode, setStatusMode] = useState<'scan' | 'status'>('status');
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [pageState, setPageState] = useState({
    page: DEFAULT_PAGE_INDEX,
    size: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const currentPageRef = useRef(DEFAULT_PAGE_INDEX);
  const bugListAbortRef = useRef<AbortController | null>(null);
  const handledCreateRequestRef = useRef('');
  const [form] = Form.useForm<Partial<AdminBugReport>>();
  const [statusForm] = Form.useForm<Partial<AdminBugReport> & { note?: string }>();
  const canWriteBugs = hasAdminPermission(adminPermissions, currentRole, BUGS_WRITE_PERMISSION);
  const canUpdateBugStatus = hasAdminPermission(adminPermissions, currentRole, BUGS_STATUS_PERMISSION);
  const canScanBugs = hasAdminPermission(adminPermissions, currentRole, BUGS_SCAN_PERMISSION);
  const canReadBugs = BUGS_ACCESS_PERMISSIONS.some((permission) =>
    hasAdminPermission(adminPermissions, currentRole, permission));
  const bugMutationDisabled = loading || Boolean(bugListLoadError) || !bugSnapshotLoaded;
  const bugModalOpen = editorOpen || statusOpen;
  const scanRefreshMs = useMemo(() => {
    const intervalMinutes = Number(summary?.scanIntervalMinutes);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      return DEFAULT_SCAN_REFRESH_MS;
    }
    return Math.max(60 * 1000, intervalMinutes * 60 * 1000);
  }, [summary?.scanIntervalMinutes]);
  const noPermissionLabel = t('adminLayout.noPermission');
  const tx = useCallback((key: string, defaultValue: string, params?: Record<string, string | number>) =>
    t(`pages.bugAdmin.${key}`, { defaultValue, ...(params || {}) }), [t]);
  const validatePageUrl = useCallback((_: unknown, value?: string) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return Promise.resolve();
    }
    if (normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.includes('\\')) {
      return Promise.resolve();
    }
    try {
      const parsed = new URL(normalized);
      const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === browserOrigin) {
        return Promise.resolve();
      }
    } catch (error) {
      reportNonBlockingError('BugManagement.validatePageUrl', error);
    }
    return Promise.reject(new Error(tx('pageUrlInvalid', 'Enter a same-origin http or https URL, or a site-relative path')));
  }, [tx]);
  const validateAttachmentUrls = useCallback((_: unknown, value?: string) => {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return Promise.resolve();
    }
    const itemCount = normalized.split('\n').map((item) => item.trim()).filter(Boolean).length;
    if (itemCount <= MAX_BUG_ATTACHMENT_URL_COUNT) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(tx('attachmentUrlCountExceeded', 'Too many attachment URLs')));
  }, [tx]);
  const openBugAttachment = useCallback(async (value: string) => {
    try {
      const response = await adminApi.downloadBugAttachment(value);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, tx('attachmentOpenFailed', 'Failed to open attachment'), language));
    }
  }, [language, tx]);
  const bugPageLabel = tx('title', 'Bug management');
  const bugSearchLabel = `${bugPageLabel}: ${tx('searchPlaceholder', 'Search title, URL, description or notes')}`;
  const bugStatusFilterLabel = `${bugPageLabel}: ${tx('status', 'Status')}`;
  const bugSeverityFilterLabel = `${bugPageLabel}: ${tx('severity', 'Severity')}`;
  const bugModuleFilterLabel = `${bugPageLabel}: ${tx('module', 'Module')}`;
  const bugRefreshActionLabel = `${bugPageLabel}: ${tx('refresh', 'Refresh')}`;
  const newBugActionLabel = `${bugPageLabel}: ${tx('newBug', 'New bug')}`;
  const bugListRetryActionLabel = `${t('common.retry')}: ${bugPageLabel}`;
  const bugSummaryRetryActionLabel = `${t('common.retry')}: ${tx('summary', 'Bug summary')}`;
  const editingBugLabel = editingBug ? bugDisplayLabel(editingBug) : tx('createBug', 'Create bug');
  const statusBugLabel = statusBug ? bugDisplayLabel(statusBug) : tx('updateStatus', 'Update status');
  const saveBugActionLabel = `${t('common.save')}: ${editingBugLabel}`;
  const cancelBugActionLabel = `${t('common.cancel')}: ${editingBugLabel}`;
  const attachmentUploadActionLabel = `${tx('uploadAttachment', 'Upload screenshot')}: ${editingBugLabel}`;
  const saveBugStatusActionLabel = `${t('common.save')}: ${statusBugLabel}`;
  const cancelBugStatusActionLabel = `${t('common.cancel')}: ${statusBugLabel}`;
  const bugActionUnavailableMessage = bugListLoadError || (loading ? t('common.loading') : tx('loadFailed', 'Failed to load bugs'));
  const bugPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${bugPageLabel}`,
    `${t('common.nextPage')}: ${bugPageLabel}`,
    `${t('common.previousPages')}: ${bugPageLabel}`,
    `${t('common.nextPages')}: ${bugPageLabel}`,
  ), [bugPageLabel, t]);
  const withPermissionTooltip = useCallback((control: React.ReactElement, allowed: boolean, reason?: string) => (
    allowed && !reason ? control : (
      <ShopTooltip title={allowed ? reason : noPermissionLabel}>
        <span className="bug-management__disabledAction">{control}</span>
      </ShopTooltip>
    )
  ), [noPermissionLabel]);

  const statusLabels = useMemo<Record<string, string>>(() => ({
    ALL: tx('statusAll', 'All statuses'),
    OPEN: tx('statusOpen', 'Open'),
    FIXING: tx('statusFixing', 'Fixing'),
    FIXED_PENDING_REGRESSION: tx('statusFixedPendingRegression', 'Fixed, pending regression'),
    REGRESSION_PASSED: tx('statusRegressionPassed', 'Regression passed'),
    REGRESSION_FAILED: tx('statusRegressionFailed', 'Regression failed'),
    NON_ISSUE: tx('statusNonIssue', 'Non-issue'),
    CLOSED: tx('statusClosed', 'Closed'),
  }), [tx]);

  const severityLabels = useMemo<Record<string, string>>(() => ({
    ALL: tx('severityAll', 'All severities'),
    LOW: tx('severityLow', 'Low'),
    MEDIUM: tx('severityMedium', 'Medium'),
    HIGH: tx('severityHigh', 'High'),
    CRITICAL: tx('severityCritical', 'Critical'),
  }), [tx]);

  const moduleLabels = useMemo<Record<string, string>>(() => ({
    ALL: tx('moduleAll', 'All modules'),
    GENERAL: tx('moduleGeneral', 'General'),
    FRONTEND: tx('moduleFrontend', 'Frontend'),
    BACKEND: tx('moduleBackend', 'Backend'),
    ANDROID_APP: tx('moduleAndroidApp', 'Android app'),
    ADMIN: tx('moduleAdmin', 'Admin'),
    PAYMENT: tx('modulePayment', 'Payment'),
    ORDER: tx('moduleOrder', 'Order'),
    PRODUCT: tx('moduleProduct', 'Product'),
    SUPPORT: tx('moduleSupport', 'Support'),
    INFRASTRUCTURE: tx('moduleInfrastructure', 'Infrastructure'),
  }), [tx]);

  const priorityLabels = useMemo<Record<string, string>>(() => ({
    P0: tx('priorityP0', 'P0 urgent'),
    P1: tx('priorityP1', 'P1 high'),
    P2: tx('priorityP2', 'P2 normal'),
    P3: tx('priorityP3', 'P3 low'),
  }), [tx]);

  const formatTime = useCallback((value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return date.toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US');
  }, [language]);

  const loadBugs = useCallback(async (
    nextPage = DEFAULT_PAGE_INDEX,
    nextSize = pageSizeRef.current,
    options?: { quiet?: boolean },
  ) => {
    bugListAbortRef.current?.abort();
    const controller = new AbortController();
    bugListAbortRef.current = controller;
    if (!options?.quiet) setLoading(true);
    try {
      const response = await adminApi.getBugs({
        page: nextPage,
        size: nextSize,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
        module: moduleFilter === 'ALL' ? undefined : moduleFilter,
        keyword: debouncedKeyword || undefined,
        scanQueueOnly,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setBugListLoadError(null);
      setBugs(response.data.items || []);
      const resolvedSize = response.data.size || nextSize;
      const resolvedPage = response.data.page ?? nextPage;
      pageSizeRef.current = resolvedSize;
      currentPageRef.current = resolvedPage;
      setPageState({
        page: resolvedPage,
        size: resolvedSize,
        total: response.data.total || 0,
        totalPages: response.data.totalPages || 0,
      });
      setBugSnapshotLoaded(true);
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      const errorMessage = getApiErrorMessage(error, tx('loadFailed', 'Failed to load bugs'), language);
      setBugListLoadError(errorMessage);
      if (!options?.quiet) {
        message.error(errorMessage);
      }
    } finally {
      if (bugListAbortRef.current === controller) {
        bugListAbortRef.current = null;
      }
      if (!controller.signal.aborted && !options?.quiet) setLoading(false);
    }
  }, [debouncedKeyword, language, moduleFilter, scanQueueOnly, severityFilter, statusFilter, tx]);

  useEffect(() => () => {
    bugListAbortRef.current?.abort();
  }, []);

  const loadBugDetail = useCallback(async (bugId: number) => {
    if (bugDetails[bugId]) return;
    setLoadingDetailIds((current) => new Set(current).add(bugId));
    try {
      const response = await adminApi.getBug(bugId);
      setBugDetails((current) => ({ ...current, [bugId]: response.data }));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, tx('loadFailed', 'Failed to load bugs'), language));
    } finally {
      setLoadingDetailIds((current) => {
        const next = new Set(current);
        next.delete(bugId);
        return next;
      });
    }
  }, [bugDetails, language, tx]);

  const loadSummary = useCallback(async (quiet = false) => {
    try {
      const response = await adminApi.getBugSummary();
      setSummaryLoadError(null);
      setSummary(response.data);
      setSummarySnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, tx('summaryFailed', 'Failed to load bug summary'), language);
      setSummaryLoadError(errorMessage);
      if (!quiet) {
        message.error(errorMessage);
      }
    }
  }, [language, tx]);

  const reload = useCallback(async (quiet = false) => {
    await Promise.all([loadBugs(quiet ? currentPageRef.current : DEFAULT_PAGE_INDEX, pageSizeRef.current, { quiet }), loadSummary(quiet)]);
  }, [loadBugs, loadSummary]);

  const loadPermissions = useCallback(async () => {
    try {
      const response = await adminApi.getMyPermissions({ bypassCache: true });
      setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
      setAdminPermissions(response.data.permissions || []);
    } catch (error) {
      reportNonBlockingError('BugManagement.loadPermissions', error);
      setCurrentRole('');
      setAdminPermissions([]);
    } finally {
      setPermissionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canReadBugs) {
      setBugs([]);
      setBugDetails({});
      setSummary(null);
      setBugListLoadError(null);
      setBugSnapshotLoaded(false);
      setSummaryLoadError(null);
      setSummarySnapshotLoaded(false);
      setPageState({
        page: DEFAULT_PAGE_INDEX,
        size: pageSizeRef.current,
        total: 0,
        totalPages: 0,
      });
      return;
    }
    void reload(false);
  }, [canReadBugs, debouncedKeyword, moduleFilter, permissionsLoaded, reload, scanQueueOnly, severityFilter, statusFilter]);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      if (!disposed) {
        await loadPermissions();
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [loadPermissions]);

  useEffect(() => {
    const refreshPermissions = () => {
      void loadPermissions();
    };
    const refreshVisiblePermissions = () => {
      if (document.visibilityState === 'visible') {
        void loadPermissions();
      }
    };
    window.addEventListener('shop:admin-permissions-updated', refreshPermissions);
    document.addEventListener('visibilitychange', refreshVisiblePermissions);
    return () => {
      window.removeEventListener('shop:admin-permissions-updated', refreshPermissions);
      document.removeEventListener('visibilitychange', refreshVisiblePermissions);
    };
  }, [loadPermissions]);

  useEffect(() => {
    if (!permissionsLoaded || !canReadBugs || bugModalOpen || loading) return;
    const timer = window.setInterval(() => {
      void reload(true);
    }, scanRefreshMs);
    return () => window.clearInterval(timer);
  }, [bugModalOpen, canReadBugs, loading, permissionsLoaded, reload, scanRefreshMs]);

  const openEditor = useCallback((bug?: AdminBugReport) => {
    if (!canWriteBugs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (bugMutationDisabled) {
      message.warning(bugActionUnavailableMessage);
      return;
    }
    setEditingBug(bug || null);
    form.resetFields();
    form.setFieldsValue({
      title: bug?.title || '',
      description: bug?.description || '',
      module: bug?.module || 'GENERAL',
      severity: bug?.severity || 'MEDIUM',
      priority: bug?.priority || 'P2',
      status: bug?.status || 'OPEN',
      pageUrl: bug?.pageUrl || '',
      environment: bug?.environment || '',
      reproductionSteps: bug?.reproductionSteps || '',
      expectedResult: bug?.expectedResult || '',
      actualResult: bug?.actualResult || '',
      attachmentUrls: bug?.attachmentUrls || '',
      assignedTo: bug?.assignedTo || 'CODEX',
      scanNote: bug?.scanNote || '',
      fixSummary: bug?.fixSummary || '',
      regressionNote: bug?.regressionNote || '',
    });
    setEditorOpen(true);
  }, [bugActionUnavailableMessage, bugMutationDisabled, canWriteBugs, form, t]);

  useEffect(() => {
    if (!permissionsLoaded) return;
    const requestedAction = searchParams.get('action');
    const shouldOpenCreate = searchParams.get('new') === '1' || requestedAction === 'new';
    if (!shouldOpenCreate) {
      handledCreateRequestRef.current = '';
      return;
    }
    const requestKey = searchParams.toString();
    if (handledCreateRequestRef.current === requestKey) return;
    if (canWriteBugs && bugMutationDisabled) return;
    handledCreateRequestRef.current = requestKey;
    if (canWriteBugs) {
      openEditor();
    } else {
      message.error(noPermissionLabel);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    if (requestedAction === 'new') {
      nextParams.delete('action');
    }
    setSearchParams(nextParams, { replace: true });
  }, [bugMutationDisabled, canWriteBugs, noPermissionLabel, openEditor, permissionsLoaded, searchParams, setSearchParams]);

  const handleSave = async () => {
    if (!canWriteBugs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (bugMutationDisabled) {
      message.warning(bugActionUnavailableMessage);
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingBug?.id) {
        const response = await adminApi.updateBug(editingBug.id, values);
        setBugDetails((current) => ({ ...current, [editingBug.id]: response.data }));
      } else {
        await adminApi.createBug(values);
      }
      message.success(tx('saved', 'Bug saved'));
      setEditorOpen(false);
      await reload(false);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, tx('saveFailed', 'Failed to save bug'), language));
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!canWriteBugs) {
      message.error(t('adminLayout.noPermission'));
      return ShopUpload.LIST_IGNORE;
    }
    if (bugMutationDisabled) {
      message.warning(bugActionUnavailableMessage);
      return ShopUpload.LIST_IGNORE;
    }
    const fileType = String(file.type || '').toLowerCase();
    if (!BUG_ATTACHMENT_IMAGE_TYPES.includes(fileType)) {
      message.warning(tx('attachmentInvalidType', 'Only JPG, PNG or GIF screenshots are supported'));
      return ShopUpload.LIST_IGNORE;
    }
    if (file.size > MAX_BUG_ATTACHMENT_SIZE_BYTES) {
      message.warning(tx('attachmentTooLarge', 'Screenshot must be 8 MB or smaller'));
      return ShopUpload.LIST_IGNORE;
    }
    setUploadingAttachment(true);
    try {
      const response = await adminApi.uploadBugAttachment(file);
      const attachmentUrl = String(response.data.attachmentUrl || '').trim();
      if (!attachmentUrl) {
        throw new Error('Empty bug attachment URL');
      }
      const currentValue = String(form.getFieldValue('attachmentUrls') || '').trim();
      const nextValue = currentValue ? `${currentValue}\n${attachmentUrl}` : attachmentUrl;
      const nextCount = nextValue.split('\n').map((item) => item.trim()).filter(Boolean).length;
      if (nextCount > MAX_BUG_ATTACHMENT_URL_COUNT) {
        message.warning(tx('attachmentUrlCountExceeded', 'Too many attachment URLs'));
        return ShopUpload.LIST_IGNORE;
      }
      if (nextValue.length > 2000) {
        message.warning(tx('attachmentUrlsTooLong', 'Attachment URL list is full'));
        return ShopUpload.LIST_IGNORE;
      }
      form.setFieldsValue({ attachmentUrls: nextValue });
      message.success(tx('attachmentUploaded', 'Screenshot uploaded'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, tx('attachmentUploadFailed', 'Failed to upload screenshot'), language));
    } finally {
      setUploadingAttachment(false);
    }
    return ShopUpload.LIST_IGNORE;
  };

  // Source contract alias for column memo guards: const openStatusEditor = useCallback((bug: AdminBugReport, mode: 'scan' | 'status', nextStatus?: string) => {
  const openStatusEditor = useCallback((bug: AdminBugReport, mode: 'scan' | 'status', nextStatus?: AdminBugReportStatus) => {
    if (mode === 'scan' && !canScanBugs) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (mode === 'status' && !canUpdateBugStatus) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (bugMutationDisabled) {
      message.warning(bugActionUnavailableMessage);
      return;
    }
    setStatusMode(mode);
    setStatusBug(bug);
    statusForm.resetFields();
    statusForm.setFieldsValue({
      status: nextStatus || (mode === 'scan' ? 'FIXING' : bug.status),
      assignedTo: bug.assignedTo || 'CODEX',
      scanNote: bug.scanNote || '',
      fixSummary: bug.fixSummary || '',
      regressionNote: bug.regressionNote || '',
      note: '',
    });
    setStatusOpen(true);
  }, [bugActionUnavailableMessage, bugMutationDisabled, canScanBugs, canUpdateBugStatus, statusForm, t]);

  const handleStatusSave = async () => {
    if (!statusBug) return;
    const canSaveCurrentStatusMode = statusMode === 'scan' ? canScanBugs : canUpdateBugStatus;
    if (!canSaveCurrentStatusMode) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (bugMutationDisabled) {
      message.warning(bugActionUnavailableMessage);
      return;
    }
    try {
      const values = await statusForm.validateFields();
      setActing(true);
      if (statusMode === 'scan') {
        const response = await adminApi.markBugScanned(statusBug.id, values);
        setBugDetails((current) => ({ ...current, [statusBug.id]: response.data }));
      } else {
        const response = await adminApi.updateBugStatus(statusBug.id, values);
        setBugDetails((current) => ({ ...current, [statusBug.id]: response.data }));
      }
      message.success(tx('statusSaved', 'Bug status updated'));
      setStatusOpen(false);
      await reload(false);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, tx('statusSaveFailed', 'Failed to update bug status'), language));
    } finally {
      setActing(false);
    }
  };

  const summaryCards = [
    { key: 'scan', title: tx('dueForScan', 'Due for scan'), value: summary?.dueForScanCount || 0, icon: <SyncOutlined /> },
    { key: 'open', title: tx('openBugs', 'Open'), value: summary?.openCount || 0, icon: <BugOutlined /> },
    { key: 'fixing', title: tx('fixingBugs', 'Fixing'), value: summary?.fixingCount || 0, icon: <ToolOutlined /> },
    { key: 'regression', title: tx('pendingRegression', 'Pending regression'), value: summary?.fixedPendingRegressionCount || 0, icon: <CheckCircleOutlined /> },
  ];

  const columns = useMemo<ColumnsType<AdminBugReport>>(() => [
    {
      title: tx('bug', 'Bug'),
      dataIndex: 'title',
      key: 'title',
      onCell: () => ({ 'data-label': tx('bug', 'Bug') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => (
        <div className="bug-management__titleCell">
          <Text strong>{bug.title}</Text>
          <ShopSpace size={6} wrap>
            <Text type="secondary">#{bug.id}</Text>
            <ShopTag>{moduleLabels[bug.module] || bug.module}</ShopTag>
            {renderBugReferenceLink(bug.pageUrl, 'bug-management__pageUrl')}
          </ShopSpace>
        </div>
      ),
    },
    {
      title: tx('severity', 'Severity'),
      dataIndex: 'severity',
      key: 'severity',
      width: 130,
      onCell: () => ({ 'data-label': tx('severity', 'Severity') } as React.HTMLAttributes<HTMLElement>),
      render: (severity: string, bug) => (
        <ShopSpace size={4} direction="vertical">
          <ShopTag color={severityColor(severity)}>{severityLabels[severity] || severity}</ShopTag>
          <Text type="secondary">{priorityLabels[bug.priority] || bug.priority}</Text>
        </ShopSpace>
      ),
    },
    {
      title: tx('status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 190,
      onCell: () => ({ 'data-label': tx('status', 'Status') } as React.HTMLAttributes<HTMLElement>),
      render: (status: string) => <ShopTag color={statusColor(status)}>{statusLabels[status] || status}</ShopTag>,
    },
    {
      title: tx('owner', 'Owner'),
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 150,
      onCell: () => ({ 'data-label': tx('owner', 'Owner') } as React.HTMLAttributes<HTMLElement>),
      render: (value: string, bug) => (
        <ShopSpace size={2} direction="vertical">
          <Text>{value || '-'}</Text>
          <Text type="secondary">{bug.reporterName || '-'}</Text>
        </ShopSpace>
      ),
    },
    {
      title: tx('scanAndUpdate', 'Scan / update'),
      key: 'scan',
      width: 210,
      onCell: () => ({ 'data-label': tx('scanAndUpdate', 'Scan / update') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => (
        <ShopSpace size={2} direction="vertical">
          <Text>{formatTime(bug.lastScannedAt)}</Text>
          <Text type="secondary">{formatTime(bug.updatedAt)}</Text>
        </ShopSpace>
      ),
    },
    {
      title: tx('actions', 'Actions'),
      key: 'actions',
      width: 230,
      onCell: () => ({ 'data-label': tx('actions', 'Actions') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => {
        const canScanCurrentBug = isScannableStatus(bug.status);
        const bugLabel = bugDisplayLabel(bug);
        const editActionLabel = `${tx('edit', 'Edit')}: ${bugLabel}`;
        const scanActionLabel = `${tx('scan', 'Scan')}: ${bugLabel}`;
        const statusActionLabel = `${tx('statusAction', 'Status')}: ${bugLabel}`;
        return (
          <ShopSpace wrap className="bug-management__rowActions">
            {withPermissionTooltip(
              <ShopButton size="small" icon={<EditOutlined />} onClick={() => openEditor(bug)} disabled={!canWriteBugs || bugMutationDisabled} aria-label={editActionLabel} title={editActionLabel}>
                {tx('edit', 'Edit')}
              </ShopButton>,
              canWriteBugs,
              bugMutationDisabled ? bugActionUnavailableMessage : undefined,
            )}
            {withPermissionTooltip(
              <ShopButton size="small" icon={<SyncOutlined />} onClick={() => openStatusEditor(bug, 'scan')} disabled={!canScanBugs || !canScanCurrentBug || bugMutationDisabled} aria-label={scanActionLabel} title={scanActionLabel}>
                {tx('scan', 'Scan')}
              </ShopButton>,
              canScanBugs,
              canScanCurrentBug ? (bugMutationDisabled ? bugActionUnavailableMessage : undefined) : tx('scanUnavailable', 'Scan is available only for open, fixing, or regression-failed bugs'),
            )}
            {withPermissionTooltip(
              <ShopButton size="small" icon={<CheckCircleOutlined />} onClick={() => openStatusEditor(bug, 'status')} disabled={!canUpdateBugStatus || bugMutationDisabled} aria-label={statusActionLabel} title={statusActionLabel}>
                {tx('statusAction', 'Status')}
              </ShopButton>,
              canUpdateBugStatus,
              bugMutationDisabled ? bugActionUnavailableMessage : undefined,
            )}
          </ShopSpace>
        );
      },
    },
  ], [
    bugActionUnavailableMessage,
    bugMutationDisabled,
    canScanBugs,
    canUpdateBugStatus,
    canWriteBugs,
    formatTime,
    moduleLabels,
    openEditor,
    openStatusEditor,
    priorityLabels,
    severityLabels,
    statusLabels,
    tx,
    withPermissionTooltip,
  ]);
  const showInitialBugLoading = canReadBugs && !bugSnapshotLoaded && !bugListLoadError;
  const bugSnapshotUnavailable = canReadBugs && Boolean(bugListLoadError) && !bugSnapshotLoaded;
  const summarySnapshotUnavailable = canReadBugs && Boolean(summaryLoadError) && !summarySnapshotLoaded;
  const canRenderBugQueue = canReadBugs && !showInitialBugLoading && !bugSnapshotUnavailable;
  const canRenderBugStats = canRenderBugQueue && summarySnapshotLoaded && !summarySnapshotUnavailable;

  return (
    <div className="bug-management">
      <div className="bug-management__header">
        <div>
          <Title level={2}>{tx('title', 'Bug management')}</Title>
          <Text type="secondary">{tx('subtitle', 'Manual admin bug reports and regression status tracking')}</Text>
        </div>
        <ShopSpace wrap>
          {withPermissionTooltip(
            <ShopButton icon={<ReloadOutlined />} onClick={() => reload(false)} loading={loading} disabled={!canReadBugs} aria-label={bugRefreshActionLabel} title={bugRefreshActionLabel}>
              {tx('refresh', 'Refresh')}
            </ShopButton>,
            canReadBugs,
          )}
          {withPermissionTooltip(
            <ShopButton type="primary" icon={<PlusOutlined />} onClick={() => openEditor()} disabled={!canWriteBugs || bugMutationDisabled} aria-label={newBugActionLabel} title={newBugActionLabel}>
              {tx('newBug', 'New bug')}
            </ShopButton>,
            canWriteBugs,
            bugMutationDisabled ? bugActionUnavailableMessage : undefined,
          )}
        </ShopSpace>
      </div>

      {!permissionsLoaded ? (
        <div
          className="bug-management__skeleton"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={`${bugPageLabel}: ${t('common.loading')}`}
        >
          <ShopSkeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <>
          {!canReadBugs ? (
            <ShopAlert type="warning" showIcon message={noPermissionLabel} description={tx('readPermissionHint', 'Ask an administrator to grant bug read permission before viewing the bug queue.')} />
          ) : null}

          {canReadBugs && bugListLoadError && bugSnapshotLoaded ? (
            <ShopAlert
              className="bug-management__alert"
              type="warning"
              showIcon
              message={bugListLoadError}
              description={tx('staleDataWarning', 'Showing the last successful bug queue snapshot. Bug create, edit, scan, and status actions are disabled until refresh succeeds.')}
              action={(
                <ShopSpace wrap data-admin-bugs-stale-recovery="true">
                  <ShopButton size="small" type="primary" onClick={() => reload(false)} loading={loading} aria-label={bugListRetryActionLabel} title={bugListRetryActionLabel}>
                    {t('common.retry')}
                  </ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin/system')}>{t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}</ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</ShopButton>
                </ShopSpace>
              )}
            />
          ) : null}
          {canReadBugs && bugListLoadError && !bugSnapshotLoaded ? (
            <div className="bug-management__error" data-admin-bugs-load-recovery="true">
              <PageError
                title={tx('loadFailed', 'Failed to load bugs')}
                description={bugListLoadError}
                actions={[
                  { key: 'retry', label: bugListRetryActionLabel, onClick: () => { void reload(false); }, type: 'primary' },
                  { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
                  { key: 'system', label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'), onClick: () => navigate('/admin/system'), type: 'default' },
                  { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
                ]}
              />
            </div>
          ) : null}

          {canReadBugs && summaryLoadError && summarySnapshotLoaded ? (
            <ShopAlert
              className="bug-management__alert"
              type="warning"
              showIcon
              message={summaryLoadError}
              description={tx('summaryStaleDataWarning', 'Showing the last successful bug summary. Summary counts may be stale until refresh succeeds.')}
              action={(
                <ShopSpace wrap data-admin-bugs-summary-stale-recovery="true">
                  <ShopButton size="small" type="primary" onClick={() => loadSummary(false)} aria-label={bugSummaryRetryActionLabel} title={bugSummaryRetryActionLabel}>
                    {t('common.retry')}
                  </ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin')}>{t('pages.adminDashboard.title')}</ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin/system')}>{t('pages.adminDashboard.paymentReturnOps.providerReadinessAction')}</ShopButton>
                  <ShopButton size="small" onClick={() => navigate('/admin/orders')}>{t('pages.adminDashboard.orders')}</ShopButton>
                </ShopSpace>
              )}
            />
          ) : null}
          {canReadBugs && summaryLoadError && !summarySnapshotLoaded ? (
            <div className="bug-management__summaryError" data-admin-bugs-summary-load-recovery="true">
              <PageError
                title={tx('summaryFailed', 'Failed to load bug summary')}
                description={summaryLoadError}
                actions={[
                  { key: 'retry', label: bugSummaryRetryActionLabel, onClick: () => { void loadSummary(false); }, type: 'primary' },
                  { key: 'dashboard', label: t('pages.adminDashboard.title'), onClick: () => navigate('/admin'), type: 'default' },
                  { key: 'system', label: t('pages.adminDashboard.paymentReturnOps.providerReadinessAction'), onClick: () => navigate('/admin/system'), type: 'default' },
                  { key: 'orders', label: t('pages.adminDashboard.orders'), onClick: () => navigate('/admin/orders'), type: 'default' },
                ]}
              />
            </div>
          ) : null}

          {showInitialBugLoading ? (
            <div
              className="bug-management__skeleton bug-management__loadingState"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label={`${bugPageLabel}: ${t('common.loading')}`}
            >
              <ShopSkeleton active paragraph={{ rows: 8 }} />
            </div>
          ) : null}

          {canRenderBugStats ? (
            <div className="bug-management__stats">
              {summaryCards.map((item) => (
                <div className="bug-management__stat" key={item.key}>
                  <span className="bug-management__statIcon">{item.icon}</span>
                  <ShopStatistic title={item.title} value={item.value} />
                </div>
              ))}
            </div>
          ) : null}

          {canRenderBugQueue ? (
            <>
              <div className="bug-management__toolbar">
                <ShopInput
                  className="bug-management__search"
                  prefix={<SearchOutlined />}
                  value={keyword}
                  placeholder={tx('searchPlaceholder', 'Search title, URL, description or notes')}
                  onChange={(event) => setKeyword(event.target.value)}
                  allowClear
                  disabled={!canReadBugs}
                  aria-label={bugSearchLabel}
                  title={bugSearchLabel}
                />
                <ShopSelect
                  className="bug-management__filter"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value || 'ALL')}
                  options={statusOptions.map((status) => ({ value: status, label: statusLabels[status] || status }))} popupClassName="shop-mobile-popup-layer"
                  disabled={!canReadBugs}
                  ariaLabel={bugStatusFilterLabel}
                  title={bugStatusFilterLabel}
                />
                <ShopSelect
                  className="bug-management__filter"
                  value={severityFilter}
                  onChange={(value) => setSeverityFilter(value || 'ALL')}
                  options={severityOptions.map((severity) => ({ value: severity, label: severityLabels[severity] || severity }))} popupClassName="shop-mobile-popup-layer"
                  disabled={!canReadBugs}
                  ariaLabel={bugSeverityFilterLabel}
                  title={bugSeverityFilterLabel}
                />
                <ShopSelect
                  className="bug-management__filter"
                  value={moduleFilter}
                  onChange={(value) => setModuleFilter(value || 'ALL')}
                  options={moduleOptions.map((module) => ({ value: module, label: moduleLabels[module] || module }))} popupClassName="shop-mobile-popup-layer"
                  disabled={!canReadBugs}
                  ariaLabel={bugModuleFilterLabel}
                  title={bugModuleFilterLabel}
                />
                <ShopSpace className="bug-management__scanToggle">
                  <ShopSwitch checked={scanQueueOnly} onChange={setScanQueueOnly} aria-label={tx('scanQueueOnly', 'Scan queue')} disabled={!canReadBugs} />
                  <Text>{tx('scanQueueOnly', 'Scan queue')}</Text>
                </ShopSpace>
              </div>

              <Table
                rowKey="id"
                className="bug-management__table"
                dataSource={bugs}
                columns={columns}
                loading={loading}
                scroll={{ x: 1100 }}
                expandable={{
                  expandedRowRender: (bug) => (
                    (() => {
                      const detail = bugDetails[bug.id] || bug;
                      const detailLoading = loadingDetailIds.has(bug.id);
                      const detailLoadingLabel = `${tx('bug', 'Bug')}: ${bugDisplayLabel(bug)} ${t('common.loading')}`;
                      const attachmentUrls = parseBugReferenceLines(detail.attachmentUrls);
                      return (
                        <div
                          role="status"
                          aria-live="polite"
                          aria-busy={detailLoading}
                          aria-label={detailLoading ? detailLoadingLabel : undefined}
                        >
                          <ShopSpin
                            spinning={detailLoading}
                          >
                          <div className="bug-management__details">
                            <div>
                              <Text strong>{tx('description', 'Description')}</Text>
                              <Paragraph>{detail.description || '-'}</Paragraph>
                            </div>
                            <div>
                              <Text strong>{tx('reproductionSteps', 'Reproduction steps')}</Text>
                              <Paragraph>{detail.reproductionSteps || '-'}</Paragraph>
                            </div>
                            <div>
                              <Text strong>{tx('expectedActual', 'Expected / actual')}</Text>
                              <Paragraph>{detail.expectedResult || '-'}</Paragraph>
                              <Paragraph>{detail.actualResult || '-'}</Paragraph>
                            </div>
                            <div>
                              <Text strong>{tx('notes', 'Notes')}</Text>
                              <Paragraph>{detail.scanNote || '-'}</Paragraph>
                              <Paragraph>{detail.fixSummary || '-'}</Paragraph>
                              <Paragraph>{detail.regressionNote || '-'}</Paragraph>
                            </div>
                            <div>
                              <Text strong>{tx('environment', 'Environment')}</Text>
                              <Paragraph>{detail.environment || '-'}</Paragraph>
                              {attachmentUrls.length > 0 ? (
                                <ShopSpace size={2} direction="vertical">
                                  {attachmentUrls.map((url, index) => (
                                    <React.Fragment key={`${url}-${index}`}>
                                      {renderBugAttachmentLink(url, openBugAttachment)}
                                    </React.Fragment>
                                  ))}
                                </ShopSpace>
                              ) : (
                                <Paragraph>-</Paragraph>
                              )}
                            </div>
                          </div>
                          </ShopSpin>
                        </div>
                      );
                    })()
                  ),
                  onExpand: (expanded, bug) => {
                    if (expanded) {
                      void loadBugDetail(bug.id);
                    }
                  },
                }}
                pagination={{
                  current: toBugTablePage(pageState.page),
                  pageSize: pageState.size,
                  total: pageState.total,
                  showSizeChanger: true,
                  showTotal: (total) => tx('totalBugs', '{count} bugs', { count: total }),
                  itemRender: bugPaginationItemRender,
                  onChange: (page, size) => loadBugs(toBugApiPage(page), size || pageState.size),
                }}
              />
            </>
          ) : null}
        </>
      )}

      <ShopModal
        open={editorOpen}
        title={editingBug ? tx('editBug', 'Edit bug') : tx('createBug', 'Create bug')}
        onClose={() => setEditorOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugActionLabel, title: saveBugActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelBugActionLabel, title: cancelBugActionLabel }}
        width={860}
        className="profile-mobile-safe-modal bug-management__modal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={tx('titleField', 'Title')} rules={[{ required: true, message: tx('titleRequired', 'Title is required') }]}>
            <ShopInput maxLength={160} />
          </Form.Item>
          <div className="bug-management__formGrid">
            <Form.Item name="module" label={tx('module', 'Module')}>
              <ShopSelect options={moduleOptions.filter((item) => item !== 'ALL').map((module) => ({ value: module, label: moduleLabels[module] || module }))} popupClassName="shop-mobile-popup-layer" />
            </Form.Item>
            <Form.Item name="severity" label={tx('severity', 'Severity')}>
              <ShopSelect options={severityOptions.filter((item) => item !== 'ALL').map((severity) => ({ value: severity, label: severityLabels[severity] || severity }))} popupClassName="shop-mobile-popup-layer" />
            </Form.Item>
            <Form.Item name="priority" label={tx('priority', 'Priority')}>
              <ShopSelect options={priorityOptions.map((priority) => ({ value: priority, label: priorityLabels[priority] || priority }))} popupClassName="shop-mobile-popup-layer" />
            </Form.Item>
            <Form.Item name="assignedTo" label={tx('assignedTo', 'Assigned to')}>
              <ShopInput maxLength={120} />
            </Form.Item>
          </div>
          <Form.Item name="description" label={tx('description', 'Description')} rules={[{ required: true, message: tx('descriptionRequired', 'Description is required') }]}>
            <ShopTextArea rows={4} maxLength={4000} />
          </Form.Item>
          <div className="bug-management__formGrid">
            <Form.Item name="pageUrl" label={tx('pageUrl', 'Page URL')} rules={[{ validator: validatePageUrl }]}>
              <ShopInput maxLength={500} />
            </Form.Item>
            <Form.Item name="environment" label={tx('environment', 'Environment')}>
              <ShopInput maxLength={120} />
            </Form.Item>
          </div>
          <Form.Item name="reproductionSteps" label={tx('reproductionSteps', 'Reproduction steps')}>
            <ShopTextArea rows={4} maxLength={4000} />
          </Form.Item>
          <div className="bug-management__formGrid bug-management__formGrid--wide">
            <Form.Item name="expectedResult" label={tx('expectedResult', 'Expected result')}>
              <ShopTextArea rows={3} maxLength={4000} />
            </Form.Item>
            <Form.Item name="actualResult" label={tx('actualResult', 'Actual result')}>
              <ShopTextArea rows={3} maxLength={4000} />
            </Form.Item>
          </div>
          <Form.Item name="attachmentUrls" label={tx('attachmentUrls', 'Attachment URLs')} rules={[{ validator: validateAttachmentUrls }]}>
            <ShopTextArea rows={2} maxLength={2000} />
          </Form.Item>
          <ShopUpload
            accept="image/jpeg,image/png,image/gif"
            showUploadList={false}
            beforeUpload={handleAttachmentUpload}
            disabled={!canWriteBugs || bugMutationDisabled || uploadingAttachment}
          >
            <ShopButton
              icon={<UploadOutlined />}
              loading={uploadingAttachment}
              disabled={!canWriteBugs || bugMutationDisabled || uploadingAttachment}
              aria-label={attachmentUploadActionLabel}
              title={attachmentUploadActionLabel}
            >
              {tx('uploadAttachment', 'Upload screenshot')}
            </ShopButton>
          </ShopUpload>
        </Form>
      </ShopModal>

      <ShopModal
        open={statusOpen}
        title={statusMode === 'scan' ? tx('scanBug', 'Scan bug') : tx('updateStatus', 'Update status')}
        onClose={() => setStatusOpen(false)}
        onOk={handleStatusSave}
        confirmLoading={acting}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: bugMutationDisabled, 'aria-label': saveBugStatusActionLabel, title: saveBugStatusActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelBugStatusActionLabel, title: cancelBugStatusActionLabel }}
        width={720}
        className="profile-mobile-safe-modal bug-management__modal bug-management__statusModal"
      >
        <Form form={statusForm} layout="vertical">
          {statusMode === 'status' ? (
            <Form.Item name="status" label={tx('status', 'Status')} rules={[{ required: true, message: tx('statusRequired', 'Status is required') }]}>
              <ShopSelect options={getStatusUpdateOptions(statusBug?.status).map((status) => ({ value: status, label: statusLabels[status] || status }))} popupClassName="shop-mobile-popup-layer" />
            </Form.Item>
          ) : null}
          <Form.Item name="assignedTo" label={tx('assignedTo', 'Assigned to')}>
            <ShopInput maxLength={120} />
          </Form.Item>
          <Form.Item name="scanNote" label={tx('scanNote', 'Scan note')}>
            <ShopTextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="fixSummary" label={tx('fixSummary', 'Fix summary')}>
            <ShopTextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="regressionNote" label={tx('regressionNote', 'Regression note')}>
            <ShopTextArea rows={3} maxLength={2000} />
          </Form.Item>
        </Form>
      </ShopModal>
    </div>
  );
};

export default BugManagement;

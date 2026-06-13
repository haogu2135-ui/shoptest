import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Skeleton, Space, Spin, Statistic, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BugOutlined, CheckCircleOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SyncOutlined, ToolOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api';
import type { AdminBugReport, AdminBugReportSummary } from '../types';
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

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const DEFAULT_PAGE_INDEX = 0;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SCAN_REFRESH_MS = 10 * 60 * 1000;
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };

const toBugApiPage = (tablePage: number) => Math.max(DEFAULT_PAGE_INDEX, tablePage - 1);
const toBugTablePage = (apiPage: number) => apiPage + 1;

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
];

const statusUpdateOptions = statusOptions.filter((status) => status !== 'ALL');
const statusTransitionOptions: Record<string, string[]> = {
  OPEN: ['OPEN', 'FIXING', 'NON_ISSUE'],
  FIXING: ['FIXING', 'FIXED_PENDING_REGRESSION', 'NON_ISSUE'],
  FIXED_PENDING_REGRESSION: ['FIXED_PENDING_REGRESSION', 'REGRESSION_PASSED', 'REGRESSION_FAILED', 'NON_ISSUE'],
  REGRESSION_PASSED: ['REGRESSION_PASSED', 'CLOSED', 'REGRESSION_FAILED'],
  REGRESSION_FAILED: ['REGRESSION_FAILED', 'FIXING', 'NON_ISSUE'],
  CLOSED: ['CLOSED', 'OPEN'],
  NON_ISSUE: ['NON_ISSUE', 'OPEN'],
};
const severityOptions = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const priorityOptions = ['P0', 'P1', 'P2', 'P3'];
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

const getStatusUpdateOptions = (status?: string) => statusTransitionOptions[status || ''] || statusUpdateOptions;
const isScannableStatus = (status?: string) => status === 'OPEN' || status === 'FIXING' || status === 'REGRESSION_FAILED';

const BugManagement: React.FC = () => {
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
  const handledCreateRequestRef = useRef('');
  const [form] = Form.useForm<Partial<AdminBugReport>>();
  const [statusForm] = Form.useForm<Partial<AdminBugReport> & { note?: string }>();
  const canWriteBugs = hasAdminPermission(adminPermissions, currentRole, BUGS_WRITE_PERMISSION);
  const canUpdateBugStatus = hasAdminPermission(adminPermissions, currentRole, BUGS_STATUS_PERMISSION);
  const canScanBugs = hasAdminPermission(adminPermissions, currentRole, BUGS_SCAN_PERMISSION);
  const canReadBugs = BUGS_ACCESS_PERMISSIONS.some((permission) =>
    hasAdminPermission(adminPermissions, currentRole, permission));
  const bugMutationDisabled = loading || Boolean(bugListLoadError) || !bugSnapshotLoaded;
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
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return Promise.resolve();
      }
    } catch (error) {
      reportNonBlockingError('BugManagement.validatePageUrl', error);
    }
    return Promise.reject(new Error(tx('pageUrlInvalid', 'Enter a valid http or https URL')));
  }, [tx]);
  const bugPageLabel = tx('title', 'Bug management');
  const bugSearchLabel = `${bugPageLabel}: ${tx('searchPlaceholder', 'Search title, URL, description or notes')}`;
  const bugActionUnavailableMessage = bugListLoadError || (loading ? t('common.loading') : tx('loadFailed', 'Failed to load bugs'));
  const bugPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${bugPageLabel}`,
    `${t('common.nextPage')}: ${bugPageLabel}`,
    `${t('common.previousPages')}: ${bugPageLabel}`,
    `${t('common.nextPages')}: ${bugPageLabel}`,
  ), [bugPageLabel, t]);
  const withPermissionTooltip = useCallback((control: React.ReactElement, allowed: boolean, reason?: string) => (
    allowed && !reason ? control : (
      <Tooltip title={allowed ? reason : noPermissionLabel}>
        <span className="bug-management__disabledAction">{control}</span>
      </Tooltip>
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
      });
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
      const errorMessage = getApiErrorMessage(error, tx('loadFailed', 'Failed to load bugs'), language);
      setBugListLoadError(errorMessage);
      if (!options?.quiet) {
        message.error(errorMessage);
      }
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }, [debouncedKeyword, language, moduleFilter, scanQueueOnly, severityFilter, statusFilter, tx]);

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
    if (!permissionsLoaded || !canReadBugs) return;
    const timer = window.setInterval(() => {
      void reload(true);
    }, scanRefreshMs);
    return () => window.clearInterval(timer);
  }, [canReadBugs, permissionsLoaded, reload, scanRefreshMs]);

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

  const openStatusEditor = (bug: AdminBugReport, mode: 'scan' | 'status', nextStatus?: string) => {
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
  };

  const handleStatusSave = async () => {
    if (!statusBug) return;
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

  const columns: ColumnsType<AdminBugReport> = [
    {
      title: tx('bug', 'Bug'),
      dataIndex: 'title',
      key: 'title',
      onCell: () => ({ 'data-label': tx('bug', 'Bug') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => (
        <div className="bug-management__titleCell">
          <Text strong>{bug.title}</Text>
          <Space size={6} wrap>
            <Text type="secondary">#{bug.id}</Text>
            <Tag>{moduleLabels[bug.module] || bug.module}</Tag>
            {bug.pageUrl ? <Text type="secondary" className="bug-management__pageUrl">{bug.pageUrl}</Text> : null}
          </Space>
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
        <Space size={4} direction="vertical">
          <Tag color={severityColor(severity)}>{severityLabels[severity] || severity}</Tag>
          <Text type="secondary">{priorityLabels[bug.priority] || bug.priority}</Text>
        </Space>
      ),
    },
    {
      title: tx('status', 'Status'),
      dataIndex: 'status',
      key: 'status',
      width: 190,
      onCell: () => ({ 'data-label': tx('status', 'Status') } as React.HTMLAttributes<HTMLElement>),
      render: (status: string) => <Tag color={statusColor(status)}>{statusLabels[status] || status}</Tag>,
    },
    {
      title: tx('owner', 'Owner'),
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 150,
      onCell: () => ({ 'data-label': tx('owner', 'Owner') } as React.HTMLAttributes<HTMLElement>),
      render: (value: string, bug) => (
        <Space size={2} direction="vertical">
          <Text>{value || '-'}</Text>
          <Text type="secondary">{bug.reporterName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: tx('scanAndUpdate', 'Scan / update'),
      key: 'scan',
      width: 210,
      onCell: () => ({ 'data-label': tx('scanAndUpdate', 'Scan / update') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => (
        <Space size={2} direction="vertical">
          <Text>{formatTime(bug.lastScannedAt)}</Text>
          <Text type="secondary">{formatTime(bug.updatedAt)}</Text>
        </Space>
      ),
    },
    {
      title: tx('actions', 'Actions'),
      key: 'actions',
      width: 230,
      onCell: () => ({ 'data-label': tx('actions', 'Actions') } as React.HTMLAttributes<HTMLElement>),
      render: (_, bug) => {
        const canScanCurrentBug = isScannableStatus(bug.status);
        return (
          <Space wrap>
            {withPermissionTooltip(
              <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(bug)} disabled={!canWriteBugs || bugMutationDisabled}>
                {tx('edit', 'Edit')}
              </Button>,
              canWriteBugs,
              bugMutationDisabled ? bugActionUnavailableMessage : undefined,
            )}
            {withPermissionTooltip(
              <Button size="small" icon={<SyncOutlined />} onClick={() => openStatusEditor(bug, 'scan')} disabled={!canScanBugs || !canScanCurrentBug || bugMutationDisabled}>
                {tx('scan', 'Scan')}
              </Button>,
              canScanBugs,
              canScanCurrentBug ? (bugMutationDisabled ? bugActionUnavailableMessage : undefined) : tx('scanUnavailable', 'Scan is available only for open, fixing, or regression-failed bugs'),
            )}
            {withPermissionTooltip(
              <Button size="small" icon={<CheckCircleOutlined />} onClick={() => openStatusEditor(bug, 'status')} disabled={!canUpdateBugStatus || bugMutationDisabled}>
                {tx('statusAction', 'Status')}
              </Button>,
              canUpdateBugStatus,
              bugMutationDisabled ? bugActionUnavailableMessage : undefined,
            )}
          </Space>
        );
      },
    },
  ];
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
        <Space wrap>
          {withPermissionTooltip(
            <Button icon={<ReloadOutlined />} onClick={() => reload(false)} loading={loading} disabled={!canReadBugs}>
              {tx('refresh', 'Refresh')}
            </Button>,
            canReadBugs,
          )}
          {withPermissionTooltip(
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()} disabled={!canWriteBugs || bugMutationDisabled}>
              {tx('newBug', 'New bug')}
            </Button>,
            canWriteBugs,
            bugMutationDisabled ? bugActionUnavailableMessage : undefined,
          )}
        </Space>
      </div>

      {!permissionsLoaded ? (
        <div className="bug-management__skeleton" aria-busy="true">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <>
          {!canReadBugs ? (
            <Alert type="warning" showIcon message={noPermissionLabel} description={tx('readPermissionHint', 'Ask an administrator to grant bug read permission before viewing the bug queue.')} />
          ) : null}

          {canReadBugs && bugListLoadError ? (
            <Alert
              className="bug-management__alert"
              type="warning"
              showIcon
              message={bugListLoadError}
              description={bugSnapshotLoaded ? tx('staleDataWarning', 'Showing the last successful bug queue snapshot. Bug create, edit, scan, and status actions are disabled until refresh succeeds.') : undefined}
              action={(
                <Button size="small" onClick={() => reload(false)} loading={loading}>
                  {t('common.retry')}
                </Button>
              )}
            />
          ) : null}

          {canReadBugs && summaryLoadError ? (
            <Alert
              className="bug-management__alert"
              type="warning"
              showIcon
              message={summaryLoadError}
              description={summarySnapshotLoaded ? tx('summaryStaleDataWarning', 'Showing the last successful bug summary. Summary counts may be stale until refresh succeeds.') : undefined}
              action={(
                <Button size="small" onClick={() => loadSummary(false)}>
                  {t('common.retry')}
                </Button>
              )}
            />
          ) : null}

          {showInitialBugLoading ? (
            <div className="bug-management__skeleton bug-management__loadingState" aria-busy="true">
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          ) : null}

          {canRenderBugStats ? (
            <div className="bug-management__stats">
              {summaryCards.map((item) => (
                <div className="bug-management__stat" key={item.key}>
                  <span className="bug-management__statIcon">{item.icon}</span>
                  <Statistic title={item.title} value={item.value} />
                </div>
              ))}
            </div>
          ) : null}

          {canRenderBugQueue ? (
            <>
              <div className="bug-management__toolbar">
                <Input
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
                <Select
                  className="bug-management__filter"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions.map((status) => ({ value: status, label: statusLabels[status] || status }))}
                  classNames={mobilePopupClassNames}
                  disabled={!canReadBugs}
                />
                <Select
                  className="bug-management__filter"
                  value={severityFilter}
                  onChange={setSeverityFilter}
                  options={severityOptions.map((severity) => ({ value: severity, label: severityLabels[severity] || severity }))}
                  classNames={mobilePopupClassNames}
                  disabled={!canReadBugs}
                />
                <Select
                  className="bug-management__filter"
                  value={moduleFilter}
                  onChange={setModuleFilter}
                  options={moduleOptions.map((module) => ({ value: module, label: moduleLabels[module] || module }))}
                  classNames={mobilePopupClassNames}
                  disabled={!canReadBugs}
                />
                <Space className="bug-management__scanToggle">
                  <Switch checked={scanQueueOnly} onChange={setScanQueueOnly} aria-label={tx('scanQueueOnly', 'Scan queue')} disabled={!canReadBugs} />
                  <Text>{tx('scanQueueOnly', 'Scan queue')}</Text>
                </Space>
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
                      return (
                        <Spin spinning={loadingDetailIds.has(bug.id)}>
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
                              <Paragraph>{detail.attachmentUrls || '-'}</Paragraph>
                            </div>
                          </div>
                        </Spin>
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

      <Modal
        open={editorOpen}
        title={editingBug ? tx('editBug', 'Edit bug') : tx('createBug', 'Create bug')}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okButtonProps={{ disabled: bugMutationDisabled }}
        width={860}
        className="profile-mobile-safe-modal bug-management__modal"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={tx('titleField', 'Title')} rules={[{ required: true, message: tx('titleRequired', 'Title is required') }]}>
            <Input maxLength={160} />
          </Form.Item>
          <div className="bug-management__formGrid">
            <Form.Item name="module" label={tx('module', 'Module')}>
              <Select options={moduleOptions.filter((item) => item !== 'ALL').map((module) => ({ value: module, label: moduleLabels[module] || module }))} classNames={mobilePopupClassNames} />
            </Form.Item>
            <Form.Item name="severity" label={tx('severity', 'Severity')}>
              <Select options={severityOptions.filter((item) => item !== 'ALL').map((severity) => ({ value: severity, label: severityLabels[severity] || severity }))} classNames={mobilePopupClassNames} />
            </Form.Item>
            <Form.Item name="priority" label={tx('priority', 'Priority')}>
              <Select options={priorityOptions.map((priority) => ({ value: priority, label: priorityLabels[priority] || priority }))} classNames={mobilePopupClassNames} />
            </Form.Item>
            <Form.Item name="assignedTo" label={tx('assignedTo', 'Assigned to')}>
              <Input maxLength={120} />
            </Form.Item>
          </div>
          <Form.Item name="description" label={tx('description', 'Description')} rules={[{ required: true, message: tx('descriptionRequired', 'Description is required') }]}>
            <TextArea rows={4} maxLength={4000} />
          </Form.Item>
          <div className="bug-management__formGrid">
            <Form.Item name="pageUrl" label={tx('pageUrl', 'Page URL')} rules={[{ validator: validatePageUrl }]}>
              <Input maxLength={500} />
            </Form.Item>
            <Form.Item name="environment" label={tx('environment', 'Environment')}>
              <Input maxLength={120} />
            </Form.Item>
          </div>
          <Form.Item name="reproductionSteps" label={tx('reproductionSteps', 'Reproduction steps')}>
            <TextArea rows={4} maxLength={4000} />
          </Form.Item>
          <div className="bug-management__formGrid bug-management__formGrid--wide">
            <Form.Item name="expectedResult" label={tx('expectedResult', 'Expected result')}>
              <TextArea rows={3} maxLength={4000} />
            </Form.Item>
            <Form.Item name="actualResult" label={tx('actualResult', 'Actual result')}>
              <TextArea rows={3} maxLength={4000} />
            </Form.Item>
          </div>
          <Form.Item name="attachmentUrls" label={tx('attachmentUrls', 'Attachment URLs')}>
            <TextArea rows={2} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={statusOpen}
        title={statusMode === 'scan' ? tx('scanBug', 'Scan bug') : tx('updateStatus', 'Update status')}
        onCancel={() => setStatusOpen(false)}
        onOk={handleStatusSave}
        confirmLoading={acting}
        okButtonProps={{ disabled: bugMutationDisabled }}
        width={720}
        className="profile-mobile-safe-modal bug-management__modal bug-management__statusModal"
      >
        <Form form={statusForm} layout="vertical">
          {statusMode === 'status' ? (
            <Form.Item name="status" label={tx('status', 'Status')} rules={[{ required: true, message: tx('statusRequired', 'Status is required') }]}>
              <Select options={getStatusUpdateOptions(statusBug?.status).map((status) => ({ value: status, label: statusLabels[status] || status }))} classNames={mobilePopupClassNames} />
            </Form.Item>
          ) : null}
          <Form.Item name="assignedTo" label={tx('assignedTo', 'Assigned to')}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="scanNote" label={tx('scanNote', 'Scan note')}>
            <TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="fixSummary" label={tx('fixSummary', 'Fix summary')}>
            <TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="regressionNote" label={tx('regressionNote', 'Regression note')}>
            <TextArea rows={3} maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BugManagement;

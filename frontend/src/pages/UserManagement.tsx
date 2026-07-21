import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Table, Tag, Button, Popconfirm, Select, message, Typography, Divider, Space, Card, Progress, Input, Modal, Form } from 'antd';
import { DeleteOutlined, StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined, TeamOutlined, MailOutlined, PhoneOutlined, DownloadOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import { userApi } from '../api';
import { adminApi } from '../api/admin';
import type { AdminRole, User, UserAdminSummary } from '../types';
import { useLanguage } from '../i18n';
import {
  USERS_DELETE_PERMISSION,
  USERS_EXPORT_PERMISSION,
  USERS_STATUS_PERMISSION,
  USERS_WRITE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
  isAdminRole,
  isSuperAdminRole,
  roleColor,
  roleLabelKey,
} from '../utils/roles';
import { hasStoredValue } from '../utils/safeStorage';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import './UserManagement.css';

const { Title, Text } = Typography;
type UserAccountStatus = 'ACTIVE' | 'BANNED' | 'GUEST';
const DEFAULT_USER_PAGE_SIZE = 20;
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };
const userAdminTableCell = (label: string): React.TdHTMLAttributes<HTMLElement> & Record<'data-label', string> => ({
  'data-label': label,
});

type UserProfileFormValues = {
  email?: string;
  phone?: string;
  address?: string;
};

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const normalizeUserAccountStatus = (status?: string): UserAccountStatus => {
  const normalized = (status || 'ACTIVE').trim().toUpperCase();
  if (normalized === 'BANNED' || normalized === 'GUEST') {
    return normalized;
  }
  return 'ACTIVE';
};

const userStatusColors: Record<UserAccountStatus, string> = {
  ACTIVE: 'green',
  BANNED: 'red',
  GUEST: 'blue',
};

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<UserAdminSummary | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [userSnapshotLoaded, setUserSnapshotLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState(0);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [pageState, setPageState] = useState({ page: 1, size: DEFAULT_USER_PAGE_SIZE, total: 0 });
  const [profileForm] = Form.useForm<UserProfileFormValues>();
  const canManageRoles = isSuperAdminRole(currentRole);
  const canWriteUsers = hasAdminPermission(adminPermissions, currentRole, USERS_WRITE_PERMISSION);
  const canChangeUserStatus = hasAdminPermission(adminPermissions, currentRole, USERS_STATUS_PERMISSION);
  const canDeleteUsers = hasAdminPermission(adminPermissions, currentRole, USERS_DELETE_PERMISSION);
  const canExportUsers = hasAdminPermission(adminPermissions, currentRole, USERS_EXPORT_PERMISSION);
  const { t, language } = useLanguage();
  const userActionDisabled = loading || Boolean(userLoadError) || !userSnapshotLoaded;
  const userActionUnavailableMessage = userLoadError || (loading ? t('common.loading') : t('pages.adminUsers.fetchFailed'));
  const formatRoleLabel = useCallback((roleValue?: string | null, fallbackName?: string | null) => {
    const rawValue = String(roleValue || '').trim();
    if (!rawValue) return fallbackName?.trim() || '-';
    const normalized = rawValue.toUpperCase();
    return fallbackName?.trim() || t(roleLabelKey(normalized));
  }, [t]);

  const localUserHealth = useMemo(() => {
    const activeUsers = users.filter((user) => normalizeUserAccountStatus(user.status) === 'ACTIVE').length;
    const admins = users.filter((user) => isAdminRole(getEffectiveRole(user.role, user.roleCode))).length;
    const bannedUsers = users.filter((user) => normalizeUserAccountStatus(user.status) === 'BANNED').length;
    const missingEmail = users.filter((user) => !user.email?.trim()).length;
    const missingPhone = users.filter((user) => !user.phone?.trim()).length;
    const adminRatio = users.length ? admins / users.length : 0;
    const adminRisk = adminRatio > 0.25 && users.length >= 4 ? 1 : 0;
    const score = Math.max(0, 100 - bannedUsers * 8 - missingEmail * 10 - missingPhone * 4 - adminRisk * 18);

    return {
      activeUsers,
      admins,
      bannedUsers,
      missingEmail,
      missingPhone,
      score,
    };
  }, [users]);

  const userHealth = {
    activeUsers: summary?.activeUsers ?? localUserHealth.activeUsers,
    admins: summary?.adminUsers ?? localUserHealth.admins,
    bannedUsers: summary?.bannedUsers ?? localUserHealth.bannedUsers,
    missingEmail: summary?.missingEmailUsers ?? localUserHealth.missingEmail,
    missingPhone: summary?.missingPhoneUsers ?? localUserHealth.missingPhone,
    score: summary?.healthScore ?? localUserHealth.score,
    adminRatioPercent: summary?.adminRatioPercent ?? 0,
  };
  const userHealthLabels = {
    score: `${t('pages.adminUsers.healthScore')}: ${userHealth.score}`,
    activeUsers: `${t('pages.adminUsers.activeUsers')}: ${userHealth.activeUsers}`,
    admins: `${t('pages.adminUsers.adminUsers')}: ${userHealth.admins}`,
    missingEmail: `${t('pages.adminUsers.missingEmail')}: ${userHealth.missingEmail}`,
    missingPhone: `${t('pages.adminUsers.missingPhone')}: ${userHealth.missingPhone}`,
  };

  const getUserReadiness = (user: User) => [
    user.username?.trim(),
    user.email?.trim(),
    user.phone?.trim(),
    normalizeUserAccountStatus(user.status) === 'ACTIVE',
  ].filter(Boolean).length;

  const fetchUsers = useCallback(async (page = 1, size = DEFAULT_USER_PAGE_SIZE) => {
    try {
      setLoading(true);
      const params = { keyword: keyword.trim() || undefined, role: roleFilter, status: statusFilter, page, size };
      const [usersResponse, summaryResponse] = await Promise.all([
        adminApi.getUsersPage(params),
        adminApi.getUserSummary({ keyword: params.keyword, role: params.role, status: params.status }),
      ]);
      setUserLoadError(null);
      setUsers(usersResponse.data.items || []);
      setPageState({
        page: usersResponse.data.page || page,
        size: usersResponse.data.size || size,
        total: usersResponse.data.total || 0,
      });
      setSummary(summaryResponse.data || null);
      setUserSnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.adminUsers.fetchFailed'), language);
      setUserLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [keyword, language, roleFilter, statusFilter, t]);

  useEffect(() => {
    fetchUsers(1, DEFAULT_USER_PAGE_SIZE);
  }, [fetchUsers]);

  useEffect(() => {
    if (!hasStoredValue('token')) return;
    let disposed = false;
    userApi.getProfile()
      .then((res) => {
        if (disposed) return;
        setCurrentUserId(Number(res.data.id || 0));
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
      })
      .catch(() => {
        if (disposed) return;
        setCurrentUserId(0);
        setCurrentRole('');
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((res) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(res.data.role, res.data.roleCode));
        setAdminPermissions(res.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    adminApi.getRoles()
      .then((res) => {
        if (!disposed) setRoles(res.data || []);
      })
      .catch(() => {
        if (!disposed) setRoles([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const handleRoleCodeChange = async (userId: number, roleCode: string) => {
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.assignUserRole(userId, roleCode);
      message.success(t('pages.adminUsers.roleUpdated'));
      fetchUsers(pageState.page, pageState.size);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('messages.updateFailed'), language));
    }
  };

  const confirmRoleCodeChange = (user: User, nextRoleCode: string) => {
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    const userLabel = user.username || user.email || `#${user.id}`;
    const matchedRole = roles.find((role) => String(role.code || '').trim().toUpperCase() === String(nextRoleCode || '').trim().toUpperCase());
    const nextRoleLabel = formatRoleLabel(nextRoleCode, matchedRole?.name);
    const confirmLabel = `${t('pages.adminUsers.roleCode')}: ${userLabel} -> ${nextRoleLabel}`;
    Modal.confirm({
      title: confirmLabel,
      content: `${userLabel} -> ${nextRoleLabel}`,
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okButtonProps: { 'aria-label': confirmLabel, title: confirmLabel },
      cancelButtonProps: { 'aria-label': `${t('common.cancel')}: ${confirmLabel}`, title: `${t('common.cancel')}: ${confirmLabel}` },
      className: 'profile-mobile-safe-modal user-management-page__roleConfirmModal',
      onOk: () => handleRoleCodeChange(user.id, nextRoleCode),
    });
  };

  const handleExport = async () => {
    if (!canExportUsers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    setExporting(true);
    try {
      const res = await adminApi.exportUsers({ keyword: keyword.trim() || undefined, role: roleFilter, status: statusFilter });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'admin-users.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminUsers.exportFailed'), language));
    } finally {
      setExporting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const currentStatus = normalizeUserAccountStatus(user.status);
    if (currentStatus === 'GUEST') {
      message.info(t('pages.adminUsers.guestStatusLocked'));
      return;
    }
    if (!canChangeUserStatus) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    const newStatus = currentStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    try {
      await adminApi.updateUser(user.id, { status: newStatus });
      message.success(newStatus === 'BANNED' ? t('pages.adminUsers.banned') : t('pages.adminUsers.unbanned'));
      fetchUsers(pageState.page, pageState.size);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    }
  };

  const openProfileModal = (user: User) => {
    if (!canWriteUsers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    setEditingUser(user);
    profileForm.resetFields();
    profileForm.setFieldsValue({
      address: user.address || '',
    });
  };

  const handleProfileSubmit = async () => {
    if (!editingUser) return;
    if (!canWriteUsers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    try {
      const values = await profileForm.validateFields();
      setProfileSubmitting(true);
      await adminApi.updateUser(editingUser.id, {
        address: values.address?.trim() || '',
      });
      message.success(t('pages.adminUsers.profileUpdated'));
      setEditingUser(null);
      fetchUsers(pageState.page, pageState.size);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('messages.updateFailed'), language));
    } finally {
      setProfileSubmitting(false);
    }
  };

  const closeProfileModal = () => {
    if (profileSubmitting) return;
    setEditingUser(null);
    profileForm.resetFields();
  };

  const handleDelete = async (id: number) => {
    if (!canDeleteUsers) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (userActionDisabled) {
      message.warning(userActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.deleteUser(id);
      message.success(t('messages.deleteSuccess'));
      fetchUsers(pageState.page, pageState.size);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('messages.deleteFailed'), language));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60, onCell: () => userAdminTableCell('ID') },
    { title: t('pages.adminUsers.username'), dataIndex: 'username', key: 'username', width: 120, onCell: () => userAdminTableCell(t('pages.adminUsers.username')) },
    { title: t('pages.adminUsers.email'), dataIndex: 'email', key: 'email', width: 180, onCell: () => userAdminTableCell(t('pages.adminUsers.email')) },
    { title: t('pages.adminUsers.phone'), dataIndex: 'phone', key: 'phone', width: 120, onCell: () => userAdminTableCell(t('pages.adminUsers.phone')), render: (v: string) => v || '-' },
    {
      title: t('pages.adminUsers.roleCode'),
      dataIndex: 'roleCode',
      key: 'roleCode',
      width: 180,
      onCell: () => userAdminTableCell(t('pages.adminUsers.roleCode')),
      render: (roleCode: string, record: User) => {
        const userLabel = record.username || record.email || `#${record.id}`;
        const isSelf = record.id === currentUserId;
        const effectiveRole = getEffectiveRole(record.role, roleCode);
        const matchedRole = roles.find((role) => String(role.code || '').trim().toUpperCase() === effectiveRole);
        const roleSelectLabel = `${t('pages.adminUsers.roleCode')}: ${userLabel}`;
        if (isSelf || !canManageRoles) {
          return <Tag color={roleColor(effectiveRole)}>{formatRoleLabel(effectiveRole, matchedRole?.name)}</Tag>;
        }
        return (
          <Select
            size="small"
            value={effectiveRole}
            className="user-management-page__roleCodeSelect"
            aria-label={roleSelectLabel}
            title={roleSelectLabel}
            disabled={userActionDisabled}
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            onChange={(val) => confirmRoleCodeChange(record, val)}
            options={[
              { value: 'USER', label: formatRoleLabel('USER') },
              ...roles.map((role) => ({ value: role.code, label: formatRoleLabel(role.code, role.name) })),
            ]}
          />
        );
      },
    },
    {
      title: t('pages.adminUsers.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      onCell: () => userAdminTableCell(t('pages.adminUsers.role')),
      render: (role: string) => <Tag color={roleColor(role)}>{formatRoleLabel(role)}</Tag>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      onCell: () => userAdminTableCell(t('common.status')),
      render: (status: string) => {
        const normalizedStatus = normalizeUserAccountStatus(status);
        const statusLabel = normalizedStatus === 'ACTIVE'
          ? t('pages.adminUsers.normal')
          : normalizedStatus === 'BANNED'
            ? t('pages.adminUsers.bannedStatus')
            : t('status.GUEST');
        return (
          <Tag color={userStatusColors[normalizedStatus]}>
            {statusLabel}
          </Tag>
        );
      },
    },
    {
      title: t('pages.adminUsers.readiness'),
      key: 'readiness',
      width: 130,
      onCell: () => userAdminTableCell(t('pages.adminUsers.readiness')),
      render: (_: unknown, record: User) => {
        const readySignals = getUserReadiness(record);
        return (
          <Tag color={readySignals >= 4 ? 'green' : readySignals >= 3 ? 'orange' : 'red'}>
            {t('pages.adminUsers.readySignals', { count: readySignals })}
          </Tag>
        );
      },
    },
    {
      title: t('pages.adminUsers.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      onCell: () => userAdminTableCell(t('pages.adminUsers.createdAt')),
      render: (v: string) => v ? new Date(v).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 180,
      onCell: () => userAdminTableCell(t('common.actions')),
      render: (_: unknown, record: User) => {
        const userLabel = record.username || record.email || `#${record.id}`;
        const isSelf = record.id === currentUserId;
        const targetRole = getEffectiveRole(record.role, record.roleCode);
        const targetPrivileged = isAdminRole(targetRole);
        const normalizedStatus = normalizeUserAccountStatus(record.status);
        const isGuest = normalizedStatus === 'GUEST';
        const profileEditDisabled = userActionDisabled || !canWriteUsers || (targetPrivileged && !canManageRoles && !isSelf);
        const statusActionDisabled = userActionDisabled || !canChangeUserStatus || isSelf || isGuest || (targetPrivileged && !canManageRoles);
        const deleteDisabled = userActionDisabled || !canDeleteUsers || isSelf || (targetPrivileged && !canManageRoles);
        const statusActionLabel = isGuest
          ? t('status.GUEST')
          : normalizedStatus === 'ACTIVE'
            ? t('pages.adminUsers.ban')
            : t('pages.adminUsers.unban');
        const editActionLabel = `${t('common.edit')}: ${userLabel}`;
        const accountStatusActionLabel = `${statusActionLabel}: ${userLabel}`;
        const deleteActionLabel = `${t('common.delete')}: ${userLabel}`;
        const statusConfirmTitle = normalizedStatus === 'ACTIVE'
          ? t('pages.adminUsers.banConfirm', { user: userLabel })
          : t('pages.adminUsers.unbanConfirm', { user: userLabel });
        return (
          <Space size="small" wrap className="user-management-page__tableActions">
            <Button size="small" icon={<EditOutlined />} aria-label={editActionLabel} title={editActionLabel} disabled={profileEditDisabled} onClick={() => openProfileModal(record)}>
              {t('common.edit')}
            </Button>
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={statusConfirmTitle}
              onConfirm={() => handleToggleStatus(record)}
              disabled={statusActionDisabled}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ disabled: userActionDisabled, 'aria-label': accountStatusActionLabel, title: accountStatusActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${accountStatusActionLabel}`, title: `${t('common.cancel')}: ${accountStatusActionLabel}` }}
            >
              <Button
                size="small"
                icon={normalizedStatus === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />}
                danger={normalizedStatus === 'ACTIVE'}
                type={normalizedStatus === 'BANNED' ? 'primary' : 'default'}
                aria-label={accountStatusActionLabel}
                title={accountStatusActionLabel}
                disabled={statusActionDisabled}
              >
                {statusActionLabel}
              </Button>
            </Popconfirm>
            <Popconfirm
              classNames={mobilePopconfirmClassNames}
              title={`${t('pages.adminUsers.deleteConfirm')}: ${userLabel}`}
              onConfirm={() => handleDelete(record.id)}
              disabled={deleteDisabled}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true, disabled: userActionDisabled, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel} disabled={deleteDisabled}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const pageLabel = t('pages.adminUsers.title');
  const keywordSearchLabel = `${pageLabel}: ${t('pages.adminUsers.searchPlaceholder')}`;
  const roleFilterLabel = `${pageLabel}: ${t('pages.adminUsers.role')}`;
  const statusFilterLabel = `${pageLabel}: ${t('common.status')}`;
  const searchActionLabel = `${pageLabel}: ${t('common.search')}`;
  const exportActionLabel = `${pageLabel}: ${t('pages.adminUsers.export')}`;
  const editingUserLabel = editingUser?.username || editingUser?.email || (editingUser ? `#${editingUser.id}` : t('pages.adminUsers.editProfile'));
  const saveProfileActionLabel = `${t('common.save')}: ${editingUserLabel}`;
  const cancelProfileActionLabel = `${t('common.cancel')}: ${editingUserLabel}`;
  const userPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${pageLabel}`,
    `${t('common.nextPage')}: ${pageLabel}`,
    `${t('common.previousPages')}: ${pageLabel}`,
    `${t('common.nextPages')}: ${pageLabel}`,
  ), [pageLabel, t]);
  const showInitialUserLoading = loading && !userSnapshotLoaded;
  const userSnapshotUnavailable = Boolean(userLoadError) && !userSnapshotLoaded;
  const canRenderUserSnapshot = !showInitialUserLoading && !userSnapshotUnavailable;

  return (
    <div className="user-management-page">
      <Title level={4}>{t('pages.adminUsers.title')}</Title>
      <Divider />
      {userLoadError && userSnapshotLoaded ? (
        <Alert
          className="user-management-page__alert"
          type="warning"
          showIcon
          message={userLoadError}
          description={t('pages.adminUsers.staleDataWarning')}
          action={(
            <Space wrap data-admin-users-stale-recovery="true">
              <Button size="small" type="primary" loading={loading} onClick={() => fetchUsers(pageState.page, pageState.size)}>
                {t('common.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin')}>
                {t('pages.adminDashboard.title')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/orders')}>
                {t('pages.adminDashboard.orders')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/support')}>
                {t('adminLayout.support')}
              </Button>
            </Space>
          )}
        />
      ) : null}

      {userLoadError && !userSnapshotLoaded ? (
        <div className="user-management-page__error" data-admin-users-load-recovery="true">
          <PageError
            title={t('pages.adminUsers.fetchFailed')}
            description={userLoadError}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: () => { void fetchUsers(pageState.page, pageState.size); },
                type: 'primary',
              },
              {
                key: 'dashboard',
                label: t('pages.adminDashboard.title'),
                onClick: () => navigate('/admin'),
                type: 'default',
              },
              {
                key: 'orders',
                label: t('pages.adminDashboard.orders'),
                onClick: () => navigate('/admin/orders'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('adminLayout.support'),
                onClick: () => navigate('/admin/support'),
                type: 'default',
              },
            ]}
          />
        </div>
      ) : null}

      {showInitialUserLoading ? (
        <Card
          className="user-management-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderUserSnapshot ? (
        <>
      <Card className="user-management-page__toolbar">
        <Space wrap className="user-management-page__filters">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={userActionDisabled}
            placeholder={t('pages.adminUsers.searchPlaceholder')}
            aria-label={keywordSearchLabel}
            title={keywordSearchLabel}
            className="user-management-page__keywordInput"
          />
          <Select
            allowClear
            value={roleFilter}
            onChange={setRoleFilter}
            disabled={userActionDisabled}
            placeholder={t('pages.adminUsers.role')}
            className="user-management-page__roleFilter"
            aria-label={roleFilterLabel}
            title={roleFilterLabel}
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            options={[
              { value: 'USER', label: formatRoleLabel('USER') },
              ...roles.map((role) => ({ value: role.code, label: formatRoleLabel(role.code, role.name) })),
            ]}
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={userActionDisabled}
            placeholder={t('common.status')}
            className="user-management-page__statusFilter"
            aria-label={statusFilterLabel}
            title={statusFilterLabel}
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            options={[
              { value: 'ACTIVE', label: t('status.ACTIVE') },
              { value: 'BANNED', label: t('status.BANNED') },
              { value: 'GUEST', label: t('status.GUEST') },
            ]}
          />
          <Button onClick={() => fetchUsers(1, pageState.size)} type="primary" icon={<SearchOutlined />} disabled={userActionDisabled} aria-label={searchActionLabel} title={searchActionLabel}>{t('common.search')}</Button>
          {canExportUsers ? (
            <Button onClick={handleExport} icon={<DownloadOutlined />} loading={exporting} disabled={userActionDisabled} aria-label={exportActionLabel} title={exportActionLabel}>{t('pages.adminUsers.export')}</Button>
          ) : null}
        </Space>
      </Card>
      <section className="user-management-page__health" aria-label={t('pages.adminUsers.healthTitle')}>
        <div className="user-management-page__healthCopy">
          <Text className="user-management-page__eyebrow">{t('pages.adminUsers.healthEyebrow')}</Text>
          <Title level={5}>{t('pages.adminUsers.healthTitle')}</Title>
          <Text type="secondary">{t('pages.adminUsers.healthSubtitle')}</Text>
        </div>
        <div className="user-management-page__score" role="group" aria-label={userHealthLabels.score} title={userHealthLabels.score}>
          <Progress
            type="circle"
            percent={userHealth.score}
            size={86}
            strokeColor={userHealth.score >= 80 ? '#2f855a' : userHealth.score >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.adminUsers.healthScore')}</Text>
        </div>
        <div className="user-management-page__healthGrid">
          <div className="user-management-page__healthItem" role="group" aria-label={userHealthLabels.activeUsers} title={userHealthLabels.activeUsers}>
            <TeamOutlined />
            <strong>{userHealth.activeUsers}</strong>
            <span>{t('pages.adminUsers.activeUsers')}</span>
          </div>
          <div className={`user-management-page__healthItem ${userHealth.admins > 2 ? 'is-risk' : ''}`} role="group" aria-label={userHealthLabels.admins} title={userHealthLabels.admins}>
            <SafetyCertificateOutlined />
            <strong>{userHealth.admins}</strong>
            <span>{t('pages.adminUsers.adminUsers')}</span>
          </div>
          <div className={`user-management-page__healthItem ${userHealth.missingEmail ? 'is-risk' : ''}`} role="group" aria-label={userHealthLabels.missingEmail} title={userHealthLabels.missingEmail}>
            <MailOutlined />
            <strong>{userHealth.missingEmail}</strong>
            <span>{t('pages.adminUsers.missingEmail')}</span>
          </div>
          <div className={`user-management-page__healthItem ${userHealth.missingPhone ? 'is-risk' : ''}`} role="group" aria-label={userHealthLabels.missingPhone} title={userHealthLabels.missingPhone}>
            <PhoneOutlined />
            <strong>{userHealth.missingPhone}</strong>
            <span>{t('pages.adminUsers.missingPhone')}</span>
          </div>
        </div>
      </section>
      <Table
        className="user-management-page__mobileCardTable"
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pageState.page,
          pageSize: pageState.size,
          total: pageState.total,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showTotal: (total) => t('pages.adminUsers.total', { count: total }),
          itemRender: userPaginationItemRender,
          onChange: (page, size) => fetchUsers(page, size),
        }}
        bordered
        size="middle"
        scroll={{ x: 1200 }}
      />
        </>
      ) : null}
      <Modal
        className="profile-mobile-safe-modal user-management-page__profileModal"
        title={t('pages.adminUsers.editProfile')}
        open={Boolean(editingUser)}
        onOk={handleProfileSubmit}
        onCancel={closeProfileModal}
        confirmLoading={profileSubmitting}
        okButtonProps={{ disabled: userActionDisabled, 'aria-label': saveProfileActionLabel, title: saveProfileActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelProfileActionLabel, title: cancelProfileActionLabel }}
        destroyOnHidden
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item label={t('pages.adminUsers.username')}>
            <Input value={editingUser?.username || ''} disabled aria-label={`${editingUserLabel}: ${t('pages.adminUsers.username')}`} title={`${editingUserLabel}: ${t('pages.adminUsers.username')}`} />
          </Form.Item>
          <Form.Item label={t('pages.adminUsers.email')}>
            <Input value={editingUser?.email || ''} disabled autoComplete="email" aria-label={`${editingUserLabel}: ${t('pages.adminUsers.email')}`} title={`${editingUserLabel}: ${t('pages.adminUsers.email')}`} />
          </Form.Item>
          <Form.Item label={t('pages.adminUsers.phone')}>
            <Input value={editingUser?.phone || ''} disabled autoComplete="tel" inputMode="tel" aria-label={`${editingUserLabel}: ${t('pages.adminUsers.phone')}`} title={`${editingUserLabel}: ${t('pages.adminUsers.phone')}`} />
          </Form.Item>
          <Form.Item
            name="address"
            label={t('pages.adminUsers.address')}
            rules={[{ max: 260, message: t('pages.adminUsers.addressTooLong') }]}
          >
            <Input.TextArea rows={3} maxLength={260} showCount autoComplete="street-address" aria-label={`${editingUserLabel}: ${t('pages.adminUsers.address')}`} title={`${editingUserLabel}: ${t('pages.adminUsers.address')}`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;

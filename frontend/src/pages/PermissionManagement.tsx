import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, PlusOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { useLanguage } from '../i18n';
import type { AdminRole } from '../types';
import { ADMIN_PAGE_PERMISSIONS, adminPermissionLabelKey, isSuperAdminRole } from '../utils/roles';
import { getLocalStorageItem } from '../utils/safeStorage';
import { getApiErrorMessage } from '../utils/apiError';
import './PermissionManagement.css';

const { Title, Text } = Typography;
const RESERVED_ROLE_CODES = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);

const isReservedRole = (role?: AdminRole | null) => RESERVED_ROLE_CODES.has(String(role?.code || '').trim().toUpperCase());
const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

const PermissionManagement: React.FC = () => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleLoadError, setRoleLoadError] = useState<string | null>(null);
  const [roleSnapshotLoaded, setRoleSnapshotLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const currentRole = getLocalStorageItem('role') || '';
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const roleActionDisabled = loading || Boolean(roleLoadError) || !roleSnapshotLoaded;
  const roleActionUnavailableMessage = roleLoadError || (loading ? t('common.loading') : t('pages.permissions.fetchFailed'));

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRoles();
      setRoleLoadError(null);
      setRoles(res.data || []);
      setRoleSnapshotLoaded(true);
    } catch (err: unknown) {
      const errorMessage = getApiErrorMessage(err, t('pages.permissions.fetchFailed'), language);
      setRoleLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    if (!isSuperAdminRole(currentRole)) {
      message.error(t('pages.permissions.superAdminOnly'));
      navigate('/admin/users', { replace: true });
      return;
    }
    loadRoles();
  }, [currentRole, loadRoles, navigate, t]);

  const filteredRoles = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return roles;
    return roles.filter((role) => [role.code, role.name, role.description].some((value) => String(value || '').toLowerCase().includes(text)));
  }, [keyword, roles]);

  const openRoleModal = (role?: AdminRole) => {
    if (isReservedRole(role)) {
      message.info(t('pages.permissions.reservedRoleReadonly'));
      return;
    }
    if (roleActionDisabled) {
      message.warning(roleActionUnavailableMessage);
      return;
    }
    setEditingRole(role || null);
    form.resetFields();
    form.setFieldsValue(role || { code: '', name: '', description: '', permissions: ['dashboard', 'support'] });
    setModalOpen(true);
  };

  const closeRoleModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingRole(null);
    form.resetFields();
  };

  const saveRole = async () => {
    if (roleActionDisabled) {
      message.warning(roleActionUnavailableMessage);
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      await adminApi.saveRole({ ...editingRole, ...values });
      message.success(t('messages.updateSuccess'));
      setModalOpen(false);
      setEditingRole(null);
      form.resetFields();
      loadRoles();
    } catch (err: unknown) {
      if (isFormValidationError(err)) return;
      message.error(getApiErrorMessage(err, t('messages.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const exportRoles = () => {
    if (roleActionDisabled) {
      message.warning(roleActionUnavailableMessage);
      return;
    }
    const header = ['code', 'name', 'description', 'status', 'permissions'];
    const rows = filteredRoles.map((role) => [
      role.code,
      role.name,
      role.description || '',
      role.status || '',
      (role.permissions || []).join('|'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admin-roles.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const pageLabel = t('pages.permissions.title');
  const roleEditorLabel = editingRole?.name || editingRole?.code || t('pages.permissions.newRole');
  const searchLabel = `${pageLabel}: ${t('pages.permissions.searchPlaceholder')}`;
  const newRoleActionLabel = `${pageLabel}: ${t('pages.permissions.newRole')}`;
  const exportActionLabel = `${pageLabel}: ${t('pages.permissions.export')}`;
  const saveRoleActionLabel = `${t('common.save')}: ${roleEditorLabel}`;
  const cancelRoleActionLabel = `${t('common.cancel')}: ${roleEditorLabel}`;
  const showInitialRoleLoading = loading && !roleSnapshotLoaded;
  const roleSnapshotUnavailable = Boolean(roleLoadError) && !roleSnapshotLoaded;
  const canRenderRoleSnapshot = !showInitialRoleLoading && !roleSnapshotUnavailable;

  return (
    <div className="permission-management-page">
      <Title level={4}>{t('pages.permissions.title')}</Title>
      <Text type="secondary">{t('pages.permissions.subtitle')}</Text>

      {roleLoadError ? (
        <Alert
          className="permission-management-page__alert"
          type="warning"
          showIcon
          message={roleLoadError}
          description={roleSnapshotLoaded ? t('pages.permissions.staleDataWarning') : undefined}
          action={(
            <Button size="small" loading={loading} onClick={loadRoles}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {showInitialRoleLoading ? (
        <Card
          className="permission-management-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderRoleSnapshot ? (
        <>
      <Card className="permission-management-page__toolbar" style={{ margin: '20px 0 16px' }}>
        <Space wrap className="permission-management-page__actions">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={roleActionDisabled}
            placeholder={t('pages.permissions.searchPlaceholder')}
            aria-label={searchLabel}
            title={searchLabel}
            className="permission-management-page__searchInput"
          />
          <Button type="primary" icon={<PlusOutlined />} disabled={roleActionDisabled} onClick={() => openRoleModal()} aria-label={newRoleActionLabel} title={newRoleActionLabel}>
            {t('pages.permissions.newRole')}
          </Button>
          <Button icon={<DownloadOutlined />} disabled={roleActionDisabled} onClick={exportRoles} aria-label={exportActionLabel} title={exportActionLabel}>
            {t('pages.permissions.export')}
          </Button>
        </Space>
      </Card>

      <Alert
        className="permission-management-page__guard"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.permissions.guardTitle')}
        description={t('pages.permissions.guardText')}
      />

      <Table
        className="permission-management-page__table"
        rowKey="code"
        loading={loading}
        dataSource={filteredRoles}
        pagination={{ pageSize: 10, showTotal: (total) => t('common.tableTotal', { count: total }) }}
        bordered
        scroll={{ x: 980 }}
        columns={[
          { title: t('pages.permissions.roleCode'), dataIndex: 'code', width: 160, render: (value) => <Tag color="purple">{value}</Tag> },
          { title: t('pages.permissions.roleName'), dataIndex: 'name', width: 180 },
          { title: t('pages.permissions.description'), dataIndex: 'description', width: 240, render: (value) => value || '-' },
          {
            title: t('pages.permissions.permissionPages'),
            dataIndex: 'permissions',
            render: (permissions: string[]) => (
              <Space wrap size={[4, 4]}>
                {(permissions || []).map((permission) => <Tag key={permission}>{t(adminPermissionLabelKey(permission))}</Tag>)}
              </Space>
            ),
          },
          {
            title: t('common.actions'),
            width: 120,
            render: (_, role) => {
              if (isReservedRole(role)) return <Tag>{t('pages.permissions.systemRole')}</Tag>;
              const roleLabel = role.name || role.code;
              const editActionLabel = `${t('common.edit')}: ${roleLabel}`;
              return (
                <Button size="small" icon={<SafetyCertificateOutlined />} disabled={roleActionDisabled} aria-label={editActionLabel} title={editActionLabel} onClick={() => openRoleModal(role)}>
                  {t('common.edit')}
                </Button>
              );
            },
          },
        ]}
      />
        </>
      ) : null}

      <Modal
        title={editingRole ? t('pages.permissions.editRole') : t('pages.permissions.newRole')}
        open={modalOpen}
        onOk={saveRole}
        onCancel={closeRoleModal}
        confirmLoading={saving}
        width={720}
        className="profile-mobile-safe-modal permission-management-page__modal"
        okButtonProps={{ disabled: roleActionDisabled, 'aria-label': saveRoleActionLabel, title: saveRoleActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelRoleActionLabel, title: cancelRoleActionLabel }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label={t('pages.permissions.roleCode')} rules={[{ required: true }]}>
            <Input disabled={Boolean(editingRole)} placeholder="CUSTOMER_SERVICE" aria-label={`${roleEditorLabel}: ${t('pages.permissions.roleCode')}`} title={`${roleEditorLabel}: ${t('pages.permissions.roleCode')}`} />
          </Form.Item>
          <Form.Item name="name" label={t('pages.permissions.roleName')} rules={[{ required: true }]}>
            <Input aria-label={`${roleEditorLabel}: ${t('pages.permissions.roleName')}`} title={`${roleEditorLabel}: ${t('pages.permissions.roleName')}`} />
          </Form.Item>
          <Form.Item name="description" label={t('pages.permissions.description')}>
            <Input aria-label={`${roleEditorLabel}: ${t('pages.permissions.description')}`} title={`${roleEditorLabel}: ${t('pages.permissions.description')}`} />
          </Form.Item>
          <Form.Item name="permissions" label={t('pages.permissions.permissionPages')} rules={[{ required: true }]}>
	            <div role="group" aria-label={`${roleEditorLabel}: ${t('pages.permissions.permissionPages')}`} title={`${roleEditorLabel}: ${t('pages.permissions.permissionPages')}`}>
	              <Checkbox.Group className="permission-management-page__checkboxGroup" aria-label={`${roleEditorLabel}: ${t('pages.permissions.permissionPages')}`}>
                <Space wrap className="permission-management-page__permissionGrid">
                  {ADMIN_PAGE_PERMISSIONS.map((permission) => (
                    <Checkbox key={permission} value={permission} title={`${roleEditorLabel}: ${t(adminPermissionLabelKey(permission))}`}>
                      {t(adminPermissionLabelKey(permission))}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionManagement;

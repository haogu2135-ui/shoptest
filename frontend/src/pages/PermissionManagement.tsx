import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, PlusOutlined, SafetyCertificateOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { useLanguage } from '../i18n';
import type { AdminRole } from '../types';
import { ADMIN_PAGE_PERMISSIONS, isSuperAdminRole } from '../utils/roles';

const { Title, Text } = Typography;

const PermissionManagement: React.FC = () => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const currentRole = localStorage.getItem('role') || '';
  const navigate = useNavigate();
  const { t } = useLanguage();

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRoles();
      setRoles(res.data || []);
    } catch {
      message.error(t('pages.permissions.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    setEditingRole(role || null);
    form.setFieldsValue(role || { code: '', name: '', description: '', permissions: ['dashboard', 'support'] });
    setModalOpen(true);
  };

  const saveRole = async () => {
    try {
      const values = await form.validateFields();
      await adminApi.saveRole({ ...editingRole, ...values });
      message.success(t('messages.updateSuccess'));
      setModalOpen(false);
      loadRoles();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.error || t('messages.saveFailed'));
    }
  };

  const exportRoles = () => {
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

  return (
    <div>
      <Title level={4}>{t('pages.permissions.title')}</Title>
      <Text type="secondary">{t('pages.permissions.subtitle')}</Text>

      <Card style={{ margin: '20px 0 16px' }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('pages.permissions.searchPlaceholder')}
            style={{ width: 260 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openRoleModal()}>
            {t('pages.permissions.newRole')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportRoles}>
            {t('pages.permissions.export')}
          </Button>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.permissions.guardTitle')}
        description={t('pages.permissions.guardText')}
      />

      <Table
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
                {(permissions || []).map((permission) => <Tag key={permission}>{t(`adminLayout.${permission.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`)}</Tag>)}
              </Space>
            ),
          },
          {
            title: t('common.actions'),
            width: 120,
            render: (_, role) => (
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => openRoleModal(role)}>
                {t('common.edit')}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={editingRole ? t('pages.permissions.editRole') : t('pages.permissions.newRole')}
        open={modalOpen}
        onOk={saveRole}
        onCancel={() => setModalOpen(false)}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label={t('pages.permissions.roleCode')} rules={[{ required: true }]}>
            <Input disabled={Boolean(editingRole)} placeholder="CUSTOMER_SERVICE" />
          </Form.Item>
          <Form.Item name="name" label={t('pages.permissions.roleName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('pages.permissions.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="permissions" label={t('pages.permissions.permissionPages')} rules={[{ required: true }]}>
            <Checkbox.Group style={{ width: '100%' }}>
              <Space wrap>
                {ADMIN_PAGE_PERMISSIONS.map((permission) => (
                  <Checkbox key={permission} value={permission}>
                    {t(`adminLayout.${permission.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`)}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionManagement;

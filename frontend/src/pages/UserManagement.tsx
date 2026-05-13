import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Tag, Button, Popconfirm, Select, message, Typography, Divider, Space, Card, Progress, Input } from 'antd';
import { DeleteOutlined, StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined, TeamOutlined, MailOutlined, PhoneOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminRole, User } from '../types';
import { useLanguage } from '../i18n';
import { getEffectiveRole, isAdminRole, isSuperAdminRole, roleColor } from '../utils/roles';
import './UserManagement.css';

const { Title, Text } = Typography;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const currentUserId = Number(localStorage.getItem('userId'));
  const currentRole = localStorage.getItem('role') || '';
  const canManageRoles = isSuperAdminRole(currentRole);
  const { t, language } = useLanguage();

  const userHealth = useMemo(() => {
    const activeUsers = users.filter((user) => (user.status || 'ACTIVE') === 'ACTIVE').length;
    const admins = users.filter((user) => isAdminRole(getEffectiveRole(user.role, user.roleCode))).length;
    const bannedUsers = users.filter((user) => user.status === 'BANNED').length;
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

  const getUserReadiness = (user: User) => [
    user.username?.trim(),
    user.email?.trim(),
    user.phone?.trim(),
    (user.status || 'ACTIVE') === 'ACTIVE',
  ].filter(Boolean).length;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers({ keyword: keyword.trim() || undefined, role: roleFilter, status: statusFilter });
      setUsers(res.data);
    } catch {
      message.error(t('pages.adminUsers.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [keyword, roleFilter, statusFilter, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    adminApi.getRoles()
      .then((res) => setRoles(res.data || []))
      .catch(() => setRoles([]));
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await adminApi.updateUser(userId, { role: newRole });
      message.success(t('pages.adminUsers.roleUpdated'));
      fetchUsers();
    } catch {
      message.error(t('messages.updateFailed'));
    }
  };

  const handleRoleCodeChange = async (userId: number, roleCode: string) => {
    try {
      await adminApi.assignUserRole(userId, roleCode);
      message.success(t('pages.adminUsers.roleUpdated'));
      fetchUsers();
    } catch {
      message.error(t('messages.updateFailed'));
    }
  };

  const handleExport = async () => {
    try {
      const res = await adminApi.exportUsers({ keyword: keyword.trim() || undefined, role: roleFilter, status: statusFilter });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'admin-users.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error(t('pages.adminUsers.exportFailed'));
    }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    try {
      await adminApi.updateUser(user.id, { status: newStatus });
      message.success(newStatus === 'BANNED' ? t('pages.adminUsers.banned') : t('pages.adminUsers.unbanned'));
      fetchUsers();
    } catch {
      message.error(t('messages.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteUser(id);
      message.success(t('messages.deleteSuccess'));
      fetchUsers();
    } catch {
      message.error(t('messages.deleteFailed'));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: t('pages.adminUsers.username'), dataIndex: 'username', key: 'username', width: 120 },
    { title: t('pages.adminUsers.email'), dataIndex: 'email', key: 'email', width: 180 },
    { title: t('pages.adminUsers.phone'), dataIndex: 'phone', key: 'phone', width: 120, render: (v: string) => v || '-' },
    {
      title: t('pages.adminUsers.roleCode'),
      dataIndex: 'roleCode',
      key: 'roleCode',
      width: 180,
      render: (roleCode: string, record: User) => {
        const isSelf = record.id === currentUserId;
        if (isSelf || !canManageRoles) {
          return roleCode ? <Tag color="purple">{roleCode}</Tag> : <Tag>{record.role}</Tag>;
        }
        return (
          <Select
            size="small"
            value={getEffectiveRole(record.role, roleCode)}
            style={{ width: 160 }}
            onChange={(val) => handleRoleCodeChange(record.id, val)}
            options={roles.map((role) => ({ value: role.code, label: role.name || role.code }))}
          />
        );
      },
    },
    {
      title: t('pages.adminUsers.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string, record: User) => {
        const isSelf = record.id === currentUserId;
        if (isSelf || !canManageRoles) {
          return <Tag color={roleColor(role)}>{role}</Tag>;
        }
        return (
          <Select
            size="small"
            value={role}
            style={{ width: 130 }}
            onChange={(val) => handleRoleChange(record.id, val)}
            options={[
              { value: 'USER', label: 'USER' },
              { value: 'ADMIN', label: 'ADMIN' },
              { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' },
            ]}
          />
        );
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>
          {status === 'ACTIVE' ? t('pages.adminUsers.normal') : t('pages.adminUsers.bannedStatus')}
        </Tag>
      ),
    },
    {
      title: t('pages.adminUsers.readiness'),
      key: 'readiness',
      width: 130,
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
      render: (v: string) => v ? new Date(v).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 180,
      render: (_: any, record: User) => {
        const isSelf = record.id === currentUserId;
        return (
          <Space size="small">
            <Button
              size="small"
              icon={record.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />}
              danger={record.status === 'ACTIVE'}
              type={record.status === 'ACTIVE' ? 'default' : 'primary'}
              disabled={isSelf}
              onClick={() => handleToggleStatus(record)}
            >
              {record.status === 'ACTIVE' ? t('pages.adminUsers.ban') : t('pages.adminUsers.unban')}
            </Button>
            <Popconfirm
              title={t('pages.adminUsers.deleteConfirm')}
              onConfirm={() => handleDelete(record.id)}
              disabled={isSelf}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={isSelf}>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="user-management-page">
      <Title level={4}>{t('pages.adminUsers.title')}</Title>
      <Divider />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('pages.adminUsers.searchPlaceholder')}
            style={{ width: 240 }}
          />
          <Select
            allowClear
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder={t('pages.adminUsers.role')}
            style={{ width: 180 }}
            options={[
              { value: 'USER', label: 'USER' },
              ...roles.map((role) => ({ value: role.code, label: role.name || role.code })),
            ]}
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t('common.status')}
            style={{ width: 140 }}
            options={[
              { value: 'ACTIVE', label: t('status.ACTIVE') },
              { value: 'BANNED', label: t('status.BANNED') },
            ]}
          />
          <Button onClick={fetchUsers} type="primary" icon={<SearchOutlined />}>{t('common.search')}</Button>
          <Button onClick={handleExport} icon={<DownloadOutlined />}>{t('pages.adminUsers.export')}</Button>
        </Space>
      </Card>
      <section className="user-management-page__health" aria-label={t('pages.adminUsers.healthTitle')}>
        <div className="user-management-page__healthCopy">
          <Text className="user-management-page__eyebrow">{t('pages.adminUsers.healthEyebrow')}</Text>
          <Title level={5}>{t('pages.adminUsers.healthTitle')}</Title>
          <Text type="secondary">{t('pages.adminUsers.healthSubtitle')}</Text>
        </div>
        <div className="user-management-page__score">
          <Progress
            type="circle"
            percent={userHealth.score}
            width={86}
            strokeColor={userHealth.score >= 80 ? '#2f855a' : userHealth.score >= 60 ? '#d97706' : '#dc2626'}
            format={(value) => `${value || 0}`}
          />
          <Text type="secondary">{t('pages.adminUsers.healthScore')}</Text>
        </div>
        <div className="user-management-page__healthGrid">
          <Card className="user-management-page__healthItem">
            <TeamOutlined />
            <strong>{userHealth.activeUsers}</strong>
            <span>{t('pages.adminUsers.activeUsers')}</span>
          </Card>
          <Card className={`user-management-page__healthItem ${userHealth.admins > 2 ? 'is-risk' : ''}`}>
            <SafetyCertificateOutlined />
            <strong>{userHealth.admins}</strong>
            <span>{t('pages.adminUsers.adminUsers')}</span>
          </Card>
          <Card className={`user-management-page__healthItem ${userHealth.missingEmail ? 'is-risk' : ''}`}>
            <MailOutlined />
            <strong>{userHealth.missingEmail}</strong>
            <span>{t('pages.adminUsers.missingEmail')}</span>
          </Card>
          <Card className={`user-management-page__healthItem ${userHealth.missingPhone ? 'is-risk' : ''}`}>
            <PhoneOutlined />
            <strong>{userHealth.missingPhone}</strong>
            <span>{t('pages.adminUsers.missingPhone')}</span>
          </Card>
        </div>
      </section>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => t('pages.adminUsers.total', { count: total }) }}
        bordered
        size="middle"
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default UserManagement;

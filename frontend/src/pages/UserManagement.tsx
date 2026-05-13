import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Tag, Button, Popconfirm, Select, message, Typography, Divider, Space, Card, Progress } from 'antd';
import { DeleteOutlined, StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined, TeamOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { User } from '../types';
import { useLanguage } from '../i18n';
import './UserManagement.css';

const { Title, Text } = Typography;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = Number(localStorage.getItem('userId'));
  const { t, language } = useLanguage();

  const userHealth = useMemo(() => {
    const activeUsers = users.filter((user) => (user.status || 'ACTIVE') === 'ACTIVE').length;
    const admins = users.filter((user) => user.role === 'ADMIN').length;
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
      const res = await adminApi.getUsers();
      setUsers(res.data);
    } catch {
      message.error(t('pages.adminUsers.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await adminApi.updateUser(userId, { role: newRole });
      message.success(t('pages.adminUsers.roleUpdated'));
      fetchUsers();
    } catch {
      message.error(t('messages.updateFailed'));
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
      title: t('pages.adminUsers.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string, record: User) => {
        const isSelf = record.id === currentUserId;
        if (isSelf) {
          return <Tag color={role === 'ADMIN' ? 'volcano' : 'blue'}>{role}</Tag>;
        }
        return (
          <Select
            size="small"
            value={role}
            style={{ width: 90 }}
            onChange={(val) => handleRoleChange(record.id, val)}
            options={[
              { value: 'USER', label: 'USER' },
              { value: 'ADMIN', label: 'ADMIN' },
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
        scroll={{ x: 1000 }}
      />
    </div>
  );
};

export default UserManagement;

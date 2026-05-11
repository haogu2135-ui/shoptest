import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Popconfirm, Select, message, Typography, Divider, Space } from 'antd';
import { DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { User } from '../types';
import { useLanguage } from '../i18n';

const { Title } = Typography;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUserId = Number(localStorage.getItem('userId'));
  const { t, language } = useLanguage();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers();
      setUsers(res.data);
    } catch {
      message.error(t('pages.adminUsers.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
    <div>
      <Title level={4}>{t('pages.adminUsers.title')}</Title>
      <Divider />
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

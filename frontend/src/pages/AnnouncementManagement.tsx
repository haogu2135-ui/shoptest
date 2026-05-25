import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { ClockCircleOutlined, LinkOutlined, PlusOutlined, SoundOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { SiteAnnouncement, SiteAnnouncementAdminSummary } from '../types';
import { isSafeAnnouncementLink } from '../utils/announcementLinks';
import './AnnouncementManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const normalizeDateValue = (value?: string) => {
  const trimmed = String(value || '').trim();
  return trimmed || undefined;
};

const AnnouncementManagement: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SiteAnnouncement[]>([]);
  const [summary, setSummary] = useState<SiteAnnouncementAdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteAnnouncement | null>(null);
  const [form] = Form.useForm();

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAnnouncements();
      setAnnouncements(response.data);
    } catch {
      message.error('公告加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await adminApi.getAnnouncementSummary();
      setSummary(response.data);
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    loadSummary();
  }, []);

  const titleMaxChars = Math.max(1, summary?.titleMaxChars || 120);
  const contentMaxChars = Math.max(1, summary?.contentMaxChars || 500);
  const linkUrlMaxChars = Math.max(1, summary?.linkUrlMaxChars || 500);
  const maxActiveRows = Math.max(1, summary?.maxActiveRows || 10);
  const localSummary = useMemo(() => {
    const now = Date.now();
    return announcements.reduce((stats, announcement) => {
      const status = String(announcement.status || 'ACTIVE').toUpperCase();
      const startsAt = announcement.startsAt ? new Date(announcement.startsAt).getTime() : null;
      const endsAt = announcement.endsAt ? new Date(announcement.endsAt).getTime() : null;
      if (status === 'INACTIVE') stats.inactive += 1;
      if (status === 'ACTIVE' && startsAt && startsAt > now) stats.scheduled += 1;
      if (status === 'ACTIVE' && endsAt && endsAt < now) stats.expired += 1;
      if (status === 'ACTIVE' && (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now)) stats.active += 1;
      if (announcement.linkUrl) stats.linked += 1;
      return stats;
    }, { active: 0, scheduled: 0, expired: 0, inactive: 0, linked: 0 });
  }, [announcements]);
  const announcementStats = summary ? {
    active: summary.activeAnnouncements,
    scheduled: summary.scheduledAnnouncements,
    expired: summary.expiredAnnouncements,
    inactive: summary.inactiveAnnouncements,
    linked: summary.linkedAnnouncements,
  } : localSummary;
  const summaryCheckedAt = useMemo(() => {
    if (!summary?.checkedAt) return '';
    const checkedAt = new Date(summary.checkedAt);
    return Number.isFinite(checkedAt.getTime()) ? checkedAt.toLocaleString() : summary.checkedAt;
  }, [summary]);

  const openEditor = (announcement?: SiteAnnouncement) => {
    setEditing(announcement || null);
    form.setFieldsValue({
      title: announcement?.title || '',
      content: announcement?.content || '',
      linkUrl: announcement?.linkUrl || '',
      status: announcement?.status || 'ACTIVE',
      sortOrder: announcement?.sortOrder ?? 0,
      startsAt: announcement?.startsAt || '',
      endsAt: announcement?.endsAt || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: Partial<SiteAnnouncement> = {
        ...values,
        startsAt: normalizeDateValue(values.startsAt),
        endsAt: normalizeDateValue(values.endsAt),
      };
      if (editing?.id) {
        await adminApi.updateAnnouncement(editing.id, payload);
      } else {
        await adminApi.createAnnouncement(payload);
      }
      message.success('公告已保存');
      setModalOpen(false);
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.error || '公告保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (announcement: SiteAnnouncement, active: boolean) => {
    if (!announcement.id) return;
    try {
      await adminApi.updateAnnouncement(announcement.id, {
        ...announcement,
        status: active ? 'ACTIVE' : 'INACTIVE',
      });
      message.success(active ? '公告已启用' : '公告已停用');
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch {
      message.error('状态更新失败');
    }
  };

  const deleteAnnouncement = async (id?: number) => {
    if (!id) return;
    try {
      await adminApi.deleteAnnouncement(id);
      message.success('公告已删除');
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch {
      message.error('公告删除失败');
    }
  };

  return (
    <div className="announcement-management">
      <div className="announcement-management__hero">
        <div>
          <Text className="announcement-management__eyebrow">CMS</Text>
          <Title level={2}>平台公告</Title>
          <Text type="secondary">管理前台顶部滚动公告，适合发布促销、运维通知、物流时效提醒。</Text>
          <Text type="secondary" className="announcement-management__limitHint">
            前台最多展示 {maxActiveRows} 条公告{summaryCheckedAt ? `，统计更新于 ${summaryCheckedAt}` : ''}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
          新增公告
        </Button>
      </div>

      <section className="announcement-management__stats" aria-label="公告运营概览">
        <div>
          <ThunderboltOutlined />
          <strong>{announcementStats.active}</strong>
          <span>当前生效</span>
        </div>
        <div>
          <ClockCircleOutlined />
          <strong>{announcementStats.scheduled}</strong>
          <span>待生效</span>
        </div>
        <div>
          <SoundOutlined />
          <strong>{announcementStats.expired}</strong>
          <span>已过期</span>
        </div>
        <div>
          <LinkOutlined />
          <strong>{announcementStats.linked}</strong>
          <span>带跳转</span>
        </div>
      </section>

      <Card className="announcement-management__card">
        <Table<SiteAnnouncement>
          rowKey={(record) => String(record.id)}
          dataSource={announcements}
          loading={loading}
          scroll={{ x: 920 }}
          columns={[
            {
              title: '公告',
              dataIndex: 'title',
              render: (_, record) => (
                <Space direction="vertical" size={2}>
                  <Text strong>{record.title}</Text>
                  <Text type="secondary" ellipsis className="announcement-management__contentPreview">{record.content}</Text>
                  {record.linkUrl ? <Text copyable type="secondary">{record.linkUrl}</Text> : null}
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (status: string, record) => (
                <Switch
                  checked={status === 'ACTIVE'}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                  onChange={(checked) => toggleStatus(record, checked)}
                />
              ),
            },
            {
              title: '排序',
              dataIndex: 'sortOrder',
              width: 90,
              render: (value?: number) => <Tag>{value ?? 0}</Tag>,
            },
            {
              title: '生效时间',
              width: 240,
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Text type="secondary">开始：{record.startsAt || '立即'}</Text>
                  <Text type="secondary">结束：{record.endsAt || '长期'}</Text>
                </Space>
              ),
            },
            {
              title: '操作',
              width: 160,
              render: (_, record) => (
                <Space>
                  <Button size="small" onClick={() => openEditor(record)}>编辑</Button>
                  <Popconfirm title="删除这个公告？" onConfirm={() => deleteAnnouncement(record.id)}>
                    <Button size="small" danger>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? '编辑公告' : '新增公告'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入公告标题' }, { max: titleMaxChars, message: `标题最多 ${titleMaxChars} 个字符` }]}>
            <Input maxLength={titleMaxChars} showCount placeholder="例如：周年庆限时优惠" />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }, { max: contentMaxChars, message: `公告内容最多 ${contentMaxChars} 个字符` }]}>
            <TextArea rows={4} maxLength={contentMaxChars} showCount placeholder="会显示在前台顶部滚动公告条" />
          </Form.Item>
          <Form.Item
            name="linkUrl"
            label="跳转链接"
            rules={[
              { max: linkUrlMaxChars, message: `跳转链接最多 ${linkUrlMaxChars} 个字符` },
              {
                validator: (_, value) => isSafeAnnouncementLink(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('跳转链接必须是站内路径或 HTTP(S) 地址')),
              },
            ]}
          >
            <Input maxLength={linkUrlMaxChars} showCount placeholder="/coupons 或 https://example.com" />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="status" label="状态" className="announcement-management__statusField">
              <Select
                options={[
                  { value: 'ACTIVE', label: '启用' },
                  { value: 'INACTIVE', label: '停用' },
                ]}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label="排序" className="announcement-management__sortField">
              <InputNumber min={0} max={9999} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="startsAt" label="开始时间" extra="格式：2026-05-21T10:00:00，可留空">
              <Input placeholder="2026-05-21T10:00:00" />
            </Form.Item>
            <Form.Item name="endsAt" label="结束时间" extra="留空表示长期有效">
              <Input placeholder="2026-06-01T23:59:59" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;

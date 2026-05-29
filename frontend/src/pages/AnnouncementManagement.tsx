import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { ClockCircleOutlined, LinkOutlined, PlusOutlined, SearchOutlined, SoundOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../api';
import type { SiteAnnouncement, SiteAnnouncementAdminSummary } from '../types';
import { useLanguage } from '../i18n';
import { isSafeAnnouncementLink } from '../utils/announcementLinks';
import { getApiErrorMessage } from '../utils/apiError';
import './AnnouncementManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

const normalizeDateValue = (value?: string | dayjs.Dayjs | null) => {
  if (!value) return undefined;
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DDTHH:mm:ss');
  const trimmed = String(value || '').trim();
  return trimmed || undefined;
};

const parseDateValue = (value?: string) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

const AnnouncementManagement: React.FC = () => {
  const [announcements, setAnnouncements] = useState<SiteAnnouncement[]>([]);
  const [summary, setSummary] = useState<SiteAnnouncementAdminSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteAnnouncement | null>(null);
  const [form] = Form.useForm();
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAnnouncements();
      setAnnouncements(response.data);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.fetchFailed'), language));
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

  const filteredAnnouncements = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const status = announcement.status || 'ACTIVE';
      if (statusFilter && status !== statusFilter) return false;
      if (!text) return true;
      return [
        announcement.title,
        announcement.content,
        announcement.linkUrl,
        status,
        announcement.sortOrder,
      ].some((value) => String(value || '').toLowerCase().includes(text));
    });
  }, [announcements, keyword, statusFilter]);

  const openEditor = (announcement?: SiteAnnouncement) => {
    setEditing(announcement || null);
    form.resetFields();
    form.setFieldsValue({
      title: announcement?.title || '',
      content: announcement?.content || '',
      linkUrl: announcement?.linkUrl || '',
      status: announcement?.status || 'ACTIVE',
      sortOrder: announcement?.sortOrder ?? 0,
      startsAt: parseDateValue(announcement?.startsAt),
      endsAt: parseDateValue(announcement?.endsAt),
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
      message.success(t('pages.announcementAdmin.saved'));
      setModalOpen(false);
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (announcement: SiteAnnouncement, active: boolean) => {
    if (!announcement.id) return;
    setStatusUpdatingId(announcement.id);
    try {
      await adminApi.updateAnnouncement(announcement.id, {
        ...announcement,
        status: active ? 'ACTIVE' : 'INACTIVE',
      });
      message.success(active ? t('pages.announcementAdmin.enabled') : t('pages.announcementAdmin.disabled'));
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.statusUpdateFailed'), language));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const closeEditor = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const deleteAnnouncement = async (id?: number) => {
    if (!id) return;
    try {
      await adminApi.deleteAnnouncement(id);
      message.success(t('pages.announcementAdmin.deleted'));
      await Promise.all([loadAnnouncements(), loadSummary()]);
    } catch (error: any) {
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.deleteFailed'), language));
    }
  };

  return (
    <div className="announcement-management">
      <div className="announcement-management__hero">
        <div>
          <Text className="announcement-management__eyebrow">CMS</Text>
          <Title level={2}>{t('pages.announcementAdmin.title')}</Title>
          <Text type="secondary">{t('pages.announcementAdmin.description')}</Text>
          <Text type="secondary" className="announcement-management__limitHint">
            {t('pages.announcementAdmin.limitHint', { count: maxActiveRows })}{summaryCheckedAt ? t('pages.announcementAdmin.checkedAt', { time: summaryCheckedAt }) : ''}
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
          {t('pages.announcementAdmin.add')}
        </Button>
      </div>

      <section className="announcement-management__stats" aria-label={t('pages.announcementAdmin.statsLabel')}>
        <div>
          <ThunderboltOutlined />
          <strong>{announcementStats.active}</strong>
          <span>{t('pages.announcementAdmin.active')}</span>
        </div>
        <div>
          <ClockCircleOutlined />
          <strong>{announcementStats.scheduled}</strong>
          <span>{t('pages.announcementAdmin.scheduled')}</span>
        </div>
        <div>
          <SoundOutlined />
          <strong>{announcementStats.expired}</strong>
          <span>{t('pages.announcementAdmin.expired')}</span>
        </div>
        <div>
          <LinkOutlined />
          <strong>{announcementStats.linked}</strong>
          <span>{t('pages.announcementAdmin.linked')}</span>
        </div>
      </section>

      <Card className="announcement-management__card">
        <Space className="announcement-management__toolbar" wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('common.search')}
            className="announcement-management__keywordInput"
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t('common.status')}
            className="announcement-management__statusFilter"
            popupClassName="shop-mobile-popup-layer"
            getPopupContainer={() => document.body}
            options={[
              { value: 'ACTIVE', label: t('pages.announcementAdmin.enable') },
              { value: 'INACTIVE', label: t('pages.announcementAdmin.disable') },
            ]}
          />
        </Space>
        <Table<SiteAnnouncement>
          rowKey={(record) => String(record.id)}
          dataSource={filteredAnnouncements}
          loading={loading}
          scroll={{ x: 920 }}
          columns={[
            {
              title: t('pages.announcementAdmin.announcement'),
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
              title: t('common.status'),
              dataIndex: 'status',
              width: 110,
              render: (status: string, record) => (
                <Switch
                  checked={status === 'ACTIVE'}
                  checkedChildren={t('pages.announcementAdmin.enable')}
                  unCheckedChildren={t('pages.announcementAdmin.disable')}
                  loading={statusUpdatingId === record.id}
                  onChange={(checked) => toggleStatus(record, checked)}
                />
              ),
            },
            {
              title: t('pages.announcementAdmin.sortOrder'),
              dataIndex: 'sortOrder',
              width: 90,
              render: (value?: number) => <Tag>{value ?? 0}</Tag>,
            },
            {
              title: t('pages.announcementAdmin.activeWindow'),
              width: 240,
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Text type="secondary">{t('pages.announcementAdmin.startsAt')}: {record.startsAt ? new Date(record.startsAt).toLocaleString(dateLocale) : t('pages.announcementAdmin.immediately')}</Text>
                  <Text type="secondary">{t('pages.announcementAdmin.endsAt')}: {record.endsAt ? new Date(record.endsAt).toLocaleString(dateLocale) : t('pages.announcementAdmin.longTerm')}</Text>
                </Space>
              ),
            },
            {
              title: t('common.actions'),
              width: 160,
              render: (_, record) => (
                <Space>
                  <Button size="small" onClick={() => openEditor(record)}>{t('common.edit')}</Button>
                  <Popconfirm title={t('pages.announcementAdmin.deleteConfirm')} onConfirm={() => deleteAnnouncement(record.id)}>
                    <Button size="small" danger>{t('common.delete')}</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editing ? t('pages.announcementAdmin.editTitle') : t('pages.announcementAdmin.addTitle')}
        open={modalOpen}
        onCancel={closeEditor}
        onOk={handleSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={saving}
        width={720}
        className="profile-mobile-safe-modal announcement-management-page__editorModal"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('pages.announcementAdmin.titleField')} rules={[{ required: true, message: t('pages.announcementAdmin.titleRequired') }, { max: titleMaxChars, message: t('pages.announcementAdmin.titleTooLong', { count: titleMaxChars }) }]}>
            <Input maxLength={titleMaxChars} showCount placeholder={t('pages.announcementAdmin.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="content" label={t('pages.announcementAdmin.contentField')} rules={[{ required: true, message: t('pages.announcementAdmin.contentRequired') }, { max: contentMaxChars, message: t('pages.announcementAdmin.contentTooLong', { count: contentMaxChars }) }]}>
            <TextArea rows={4} maxLength={contentMaxChars} showCount placeholder={t('pages.announcementAdmin.contentPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="linkUrl"
            label={t('pages.announcementAdmin.linkUrl')}
            rules={[
              { max: linkUrlMaxChars, message: t('pages.announcementAdmin.linkTooLong', { count: linkUrlMaxChars }) },
              {
                validator: (_, value) => isSafeAnnouncementLink(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('pages.announcementAdmin.linkInvalid'))),
              },
            ]}
          >
            <Input maxLength={linkUrlMaxChars} showCount placeholder={t('pages.announcementAdmin.linkPlaceholder')} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="status" label={t('common.status')} className="announcement-management__statusField">
              <Select
                popupClassName="shop-mobile-popup-layer"
                getPopupContainer={() => document.body}
                options={[
                  { value: 'ACTIVE', label: t('pages.announcementAdmin.enable') },
                  { value: 'INACTIVE', label: t('pages.announcementAdmin.disable') },
                ]}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label={t('pages.announcementAdmin.sortOrder')} className="announcement-management__sortField">
              <InputNumber min={0} max={9999} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="startsAt" label={t('pages.announcementAdmin.startsAt')} extra={t('pages.announcementAdmin.startsAtExtra')}>
              <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" className="announcement-management__datePicker" popupClassName="shop-mobile-popup-layer" getPopupContainer={() => document.body} />
            </Form.Item>
            <Form.Item name="endsAt" label={t('pages.announcementAdmin.endsAt')} extra={t('pages.announcementAdmin.endsAtExtra')}>
              <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" className="announcement-management__datePicker" popupClassName="shop-mobile-popup-layer" getPopupContainer={() => document.body} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { ClockCircleOutlined, LinkOutlined, PlusOutlined, SearchOutlined, SoundOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../api/admin';
import type { SiteAnnouncement, SiteAnnouncementAdminSummary } from '../types';
import { useLanguage } from '../i18n';
import { useDebounce } from '../hooks/useDebounce';
import { isSafeAnnouncementLink } from '../utils/announcementLinks';
import { commercialAnnouncementRejectionReason } from '../utils/commercialAnnouncement';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
import { ANNOUNCEMENTS_DELETE_PERMISSION, ANNOUNCEMENTS_WRITE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import './AnnouncementManagement.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const DEFAULT_PAGE_SIZE = 20;
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };
const validateCommercialAnnouncementFields = (title: unknown, content: unknown, status: unknown, t: (key: string) => string) => {
  if (String(status || '').toUpperCase() !== 'ACTIVE') {
    return Promise.resolve();
  }
  const reason = commercialAnnouncementRejectionReason(
    typeof title === 'string' ? title : '',
    typeof content === 'string' ? content : '',
  );
  if (reason === 'empty') {
    return Promise.reject(new Error(t('pages.announcementAdmin.titleRequired')));
  }
  if (reason === 'placeholder') {
    return Promise.reject(new Error(t('pages.announcementAdmin.placeholderContentBlocked')));
  }
  return Promise.resolve();
};

const announcementDatePopupClassNames = { popup: { root: 'shop-mobile-popup-layer announcement-management-page__datePopup' } };
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };

type AnnouncementFormValues = Omit<SiteAnnouncement, 'id' | 'createdAt' | 'updatedAt' | 'startsAt' | 'endsAt'> & {
  startsAt?: string | dayjs.Dayjs | null;
  endsAt?: string | dayjs.Dayjs | null;
};

const isFormValidationError = (error: unknown): error is { errorFields: unknown[] } => (
  Boolean(error) && typeof error === 'object' && Array.isArray((error as { errorFields?: unknown }).errorFields)
);

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
  const [loading, setLoading] = useState(true);
  const [announcementLoadError, setAnnouncementLoadError] = useState<string | null>(null);
  const [announcementSnapshotLoaded, setAnnouncementSnapshotLoaded] = useState(false);
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null);
  const [summarySnapshotLoaded, setSummarySnapshotLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [pageState, setPageState] = useState({
    page: 1,
    size: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SiteAnnouncement | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const [form] = Form.useForm<AnnouncementFormValues>();
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const canWriteAnnouncements = hasAdminPermission(adminPermissions, currentRole, ANNOUNCEMENTS_WRITE_PERMISSION);
  const canDeleteAnnouncements = hasAdminPermission(adminPermissions, currentRole, ANNOUNCEMENTS_DELETE_PERMISSION);
  const announcementActionDisabled = loading
    || Boolean(announcementLoadError)
    || Boolean(summaryLoadError)
    || !announcementSnapshotLoaded
    || !summarySnapshotLoaded;
  const announcementActionUnavailableMessage = announcementLoadError
    || summaryLoadError
    || (loading ? t('common.loading') : t('pages.announcementAdmin.fetchFailed'));

  const loadAnnouncements = useCallback(async (
    nextPage: number,
    nextSize: number,
    nextStatus = statusFilter,
    nextKeyword = debouncedKeyword,
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.getAnnouncements({
        page: nextPage,
        size: nextSize,
        status: nextStatus,
        keyword: nextKeyword || undefined,
      });
      setAnnouncementLoadError(null);
      setAnnouncements(response.data.items || []);
      const resolvedSize = response.data.size || nextSize;
      pageSizeRef.current = resolvedSize;
      setPageState({
        page: response.data.page || nextPage,
        size: resolvedSize,
        total: response.data.total || 0,
        totalPages: response.data.totalPages || 0,
        hasNext: Boolean(response.data.hasNext),
        hasPrevious: Boolean(response.data.hasPrevious),
      });
      setAnnouncementSnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.announcementAdmin.fetchFailed'), language);
      setAnnouncementLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, language, statusFilter, t]);

  const loadSummary = useCallback(async (
    nextStatus = statusFilter,
    nextKeyword = debouncedKeyword,
  ) => {
    try {
      const response = await adminApi.getAnnouncementSummary({
        status: nextStatus,
        keyword: nextKeyword || undefined,
      });
      setSummaryLoadError(null);
      setSummary(response.data);
      setSummarySnapshotLoaded(true);
    } catch (error) {
      reportNonBlockingError('AnnouncementManagement.loadSummary', error);
      setSummaryLoadError(getApiErrorMessage(error, t('pages.announcementAdmin.fetchFailed'), language));
    }
  }, [debouncedKeyword, language, statusFilter, t]);

  useEffect(() => {
    loadAnnouncements(1, pageSizeRef.current, statusFilter, debouncedKeyword);
    loadSummary(statusFilter, debouncedKeyword);
  }, [debouncedKeyword, loadAnnouncements, loadSummary, statusFilter]);

  useEffect(() => {
    let disposed = false;
    adminApi.getMyPermissions()
      .then((response) => {
        if (disposed) return;
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        if (disposed) return;
        setCurrentRole('');
        setAdminPermissions([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const titleMaxChars = Math.max(1, summary?.titleMaxChars || 120);
  const contentMaxChars = Math.max(1, summary?.contentMaxChars || 500);
  const linkUrlMaxChars = Math.max(1, summary?.linkUrlMaxChars || 500);
  const maxActiveRows = Math.max(1, summary?.maxActiveRows || 10);
  const announcementStats = {
    active: summary?.activeAnnouncements || 0,
    scheduled: summary?.scheduledAnnouncements || 0,
    expired: summary?.expiredAnnouncements || 0,
    inactive: summary?.inactiveAnnouncements || 0,
    linked: summary?.linkedAnnouncements || 0,
  };
  const summaryCheckedAt = useMemo(() => {
    if (!summary?.checkedAt) return '';
    const checkedAt = new Date(summary.checkedAt);
    return Number.isFinite(checkedAt.getTime()) ? checkedAt.toLocaleString(dateLocale) : summary.checkedAt;
  }, [dateLocale, summary]);
  const getAnnouncementLabel = (announcement?: Pick<SiteAnnouncement, 'id' | 'title'> | null) => {
    const title = String(announcement?.title || '').trim();
    if (title) return title;
    return announcement?.id
      ? `${t('pages.announcementAdmin.announcement')} #${announcement.id}`
      : t('pages.announcementAdmin.addTitle');
  };
  const announcementPageLabel = t('pages.announcementAdmin.title');
  const announcementSearchRegionLabel = `${announcementPageLabel} - ${t('common.search')}`;
  const announcementSearchInputLabel = `${t('common.search')}: ${announcementPageLabel}`;
  const selectedStatusLabel = statusFilter === 'ACTIVE'
    ? t('pages.announcementAdmin.enable')
    : statusFilter === 'INACTIVE'
      ? t('pages.announcementAdmin.disable')
      : t('common.all');
  const announcementStatusFilterLabel = `${t('common.status')}: ${announcementPageLabel} - ${selectedStatusLabel}`;
  const addAnnouncementActionLabel = `${t('pages.announcementAdmin.add')}: ${announcementPageLabel}`;
  const editorTitle = editing ? t('pages.announcementAdmin.editTitle') : t('pages.announcementAdmin.addTitle');
  const editorTargetLabel = editing ? `${editorTitle}: ${getAnnouncementLabel(editing)}` : editorTitle;
  const titleFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.titleField')}`;
  const contentFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.contentField')}`;
  const linkUrlFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.linkUrl')}`;
  const editorStatusFieldLabel = `${editorTargetLabel} - ${t('common.status')}`;
  const sortOrderFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.sortOrder')}`;
  const startsAtFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.startsAt')}`;
  const endsAtFieldLabel = `${editorTargetLabel} - ${t('pages.announcementAdmin.endsAt')}`;
  const saveEditorActionLabel = `${t('common.save')}: ${editorTargetLabel}`;
  const cancelEditorActionLabel = `${t('common.cancel')}: ${editorTargetLabel}`;

  const openEditor = (announcement?: SiteAnnouncement) => {
    if (!canWriteAnnouncements) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (announcementActionDisabled) {
      message.warning(announcementActionUnavailableMessage);
      return;
    }
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
    if (!canWriteAnnouncements) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (announcementActionDisabled) {
      message.warning(announcementActionUnavailableMessage);
      return;
    }
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
      await Promise.all([loadAnnouncements(pageState.page, pageState.size), loadSummary()]);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.saveFailed'), language));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (announcement: SiteAnnouncement, active: boolean) => {
    if (!announcement.id) return;
    if (!canWriteAnnouncements) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (announcementActionDisabled) {
      message.warning(announcementActionUnavailableMessage);
      return;
    }
    setStatusUpdatingId(announcement.id);
    try {
      await adminApi.updateAnnouncement(announcement.id, {
        ...announcement,
        status: active ? 'ACTIVE' : 'INACTIVE',
      });
      message.success(active ? t('pages.announcementAdmin.enabled') : t('pages.announcementAdmin.disabled'));
      await Promise.all([loadAnnouncements(pageState.page, pageState.size), loadSummary()]);
    } catch (error: unknown) {
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
    if (!canDeleteAnnouncements) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (announcementActionDisabled) {
      message.warning(announcementActionUnavailableMessage);
      return;
    }
    try {
      await adminApi.deleteAnnouncement(id);
      message.success(t('pages.announcementAdmin.deleted'));
      await Promise.all([loadAnnouncements(pageState.page, pageState.size), loadSummary()]);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.announcementAdmin.deleteFailed'), language));
    }
  };

  const showInitialAnnouncementLoading = loading && !announcementSnapshotLoaded;
  const announcementSnapshotUnavailable = Boolean(announcementLoadError) && !announcementSnapshotLoaded;
  const canRenderAnnouncementSnapshot = !showInitialAnnouncementLoading && !announcementSnapshotUnavailable;
  const canRenderAnnouncementSummary = canRenderAnnouncementSnapshot && summarySnapshotLoaded;

  return (
    <div className="announcement-management">
      <div className="announcement-management__hero">
        <div>
          <Text className="announcement-management__eyebrow">{t('pages.announcementAdmin.eyebrow')}</Text>
          <Title level={2}>{t('pages.announcementAdmin.title')}</Title>
          <Text type="secondary">{t('pages.announcementAdmin.description')}</Text>
          {summarySnapshotLoaded ? (
            <Text type="secondary" className="announcement-management__limitHint">
              {t('pages.announcementAdmin.limitHint', { count: maxActiveRows })}{summaryCheckedAt ? t('pages.announcementAdmin.checkedAt', { time: summaryCheckedAt }) : ''}
            </Text>
          ) : null}
        </div>
        {canWriteAnnouncements ? (
          <Button type="primary" icon={<PlusOutlined />} disabled={announcementActionDisabled} aria-label={addAnnouncementActionLabel} title={addAnnouncementActionLabel} onClick={() => openEditor()}>
            {t('pages.announcementAdmin.add')}
          </Button>
        ) : null}
      </div>

      {announcementLoadError ? (
        <Alert
          className="announcement-management__alert"
          type="warning"
          showIcon
          message={announcementLoadError}
          description={announcementSnapshotLoaded ? t('pages.announcementAdmin.staleDataWarning') : undefined}
          action={(
            <Button size="small" loading={loading} onClick={() => loadAnnouncements(pageState.page, pageState.size)}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {summaryLoadError ? (
        <Alert
          className="announcement-management__alert"
          type="warning"
          showIcon
          message={summaryLoadError}
          description={summarySnapshotLoaded ? t('pages.announcementAdmin.summaryStaleDataWarning') : undefined}
          action={(
            <Button size="small" onClick={() => loadSummary()}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {showInitialAnnouncementLoading ? (
        <Card
          className="announcement-management__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderAnnouncementSummary ? (
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
      ) : null}

      {canRenderAnnouncementSnapshot ? (
        <Card className="announcement-management__card">
        <Space className="announcement-management__toolbar" wrap role="search" aria-label={announcementSearchRegionLabel} title={announcementSearchRegionLabel}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={announcementActionDisabled}
            placeholder={t('common.search')}
            aria-label={announcementSearchInputLabel}
            title={announcementSearchInputLabel}
            className="announcement-management__keywordInput"
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={announcementActionDisabled}
            placeholder={t('common.status')}
            aria-label={announcementStatusFilterLabel}
            title={announcementStatusFilterLabel}
            className="announcement-management__statusFilter"
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            options={[
              { value: 'ACTIVE', label: t('pages.announcementAdmin.enable') },
              { value: 'INACTIVE', label: t('pages.announcementAdmin.disable') },
            ]}
          />
        </Space>
        <Table<SiteAnnouncement>
          rowKey={(record) => String(record.id)}
          dataSource={announcements}
          loading={loading}
          pagination={{
            current: pageState.page,
            pageSize: pageState.size,
            total: pageState.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `${t('common.total')}: ${total}${pageState.totalPages ? ` | ${pageState.page}/${pageState.totalPages}` : ''}`,
            onChange: (page, pageSize) => loadAnnouncements(page, pageSize),
          }}
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
	              render: (status: string, record) => {
                const announcementTitle = getAnnouncementLabel(record);
                const statusActionLabel = `${status === 'ACTIVE' ? t('pages.announcementAdmin.disable') : t('pages.announcementAdmin.enable')}: ${announcementTitle}`;
                return (
	                  <Popconfirm
	                    classNames={mobilePopconfirmClassNames}
	                    title={statusActionLabel}
                    description={announcementTitle}
                    onConfirm={() => toggleStatus(record, status !== 'ACTIVE')}
                    disabled={!canWriteAnnouncements || announcementActionDisabled || statusUpdatingId === record.id}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    okButtonProps={{ danger: status === 'ACTIVE', disabled: announcementActionDisabled, 'aria-label': statusActionLabel, title: statusActionLabel }}
                    cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${statusActionLabel}`, title: `${t('common.cancel')}: ${statusActionLabel}` }}
                  >
                    <Switch
                      checked={status === 'ACTIVE'}
                      checkedChildren={t('pages.announcementAdmin.enable')}
                      unCheckedChildren={t('pages.announcementAdmin.disable')}
                      aria-label={statusActionLabel}
                      title={statusActionLabel}
                      loading={statusUpdatingId === record.id}
                      disabled={!canWriteAnnouncements || announcementActionDisabled || statusUpdatingId === record.id}
                    />
                  </Popconfirm>
                );
              },
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
              render: (_, record) => {
                const announcementTitle = getAnnouncementLabel(record);
                const editActionLabel = `${t('common.edit')}: ${announcementTitle}`;
                const deleteActionLabel = `${t('common.delete')}: ${announcementTitle}`;
                return (
                  <Space>
                    {canWriteAnnouncements ? <Button size="small" disabled={announcementActionDisabled} aria-label={editActionLabel} title={editActionLabel} onClick={() => openEditor(record)}>{t('common.edit')}</Button> : null}
                    {canDeleteAnnouncements ? (
	                      <Popconfirm
	                        classNames={mobilePopconfirmClassNames}
	                        title={t('pages.announcementAdmin.deleteConfirm')}
                        description={announcementTitle}
                        onConfirm={() => deleteAnnouncement(record.id)}
                        disabled={announcementActionDisabled}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        okButtonProps={{ danger: true, disabled: announcementActionDisabled, 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${deleteActionLabel}`, title: `${t('common.cancel')}: ${deleteActionLabel}` }}
                      >
                        <Button size="small" danger disabled={announcementActionDisabled} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
                      </Popconfirm>
                    ) : null}
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>
      ) : null}

      <Modal
        title={editorTitle}
        open={modalOpen}
        onCancel={closeEditor}
        onOk={handleSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: announcementActionDisabled, 'aria-label': saveEditorActionLabel, title: saveEditorActionLabel }}
        cancelButtonProps={{ 'aria-label': cancelEditorActionLabel, title: cancelEditorActionLabel }}
        confirmLoading={saving}
        width={720}
        className="profile-mobile-safe-modal announcement-management-page__editorModal"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label={t('pages.announcementAdmin.titleField')}
            dependencies={['content', 'status']}
            rules={[
              { required: true, message: t('pages.announcementAdmin.titleRequired') },
              { max: titleMaxChars, message: t('pages.announcementAdmin.titleTooLong', { count: titleMaxChars }) },
              {
                validator: async (_, value) => validateCommercialAnnouncementFields(value, form.getFieldValue('content'), form.getFieldValue('status'), t),
              },
            ]}
          >
            <Input maxLength={titleMaxChars} showCount placeholder={t('pages.announcementAdmin.titlePlaceholder')} aria-label={titleFieldLabel} title={titleFieldLabel} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('pages.announcementAdmin.contentField')}
            dependencies={['title', 'status']}
            rules={[
              { required: true, message: t('pages.announcementAdmin.contentRequired') },
              { max: contentMaxChars, message: t('pages.announcementAdmin.contentTooLong', { count: contentMaxChars }) },
              {
                validator: async (_, value) => validateCommercialAnnouncementFields(form.getFieldValue('title'), value, form.getFieldValue('status'), t),
              },
            ]}
          >
            <TextArea rows={4} maxLength={contentMaxChars} showCount placeholder={t('pages.announcementAdmin.contentPlaceholder')} aria-label={contentFieldLabel} title={contentFieldLabel} />
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
            <Input maxLength={linkUrlMaxChars} showCount placeholder={t('pages.announcementAdmin.linkPlaceholder')} aria-label={linkUrlFieldLabel} title={linkUrlFieldLabel} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="status" label={t('common.status')} className="announcement-management__statusField">
              <Select
                aria-label={editorStatusFieldLabel}
                title={editorStatusFieldLabel}
                classNames={mobilePopupClassNames}
                getPopupContainer={() => document.body}
                options={[
                  { value: 'ACTIVE', label: t('pages.announcementAdmin.enable') },
                  { value: 'INACTIVE', label: t('pages.announcementAdmin.disable') },
                ]}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label={t('pages.announcementAdmin.sortOrder')} className="announcement-management__sortField">
              <InputNumber min={0} max={9999} aria-label={sortOrderFieldLabel} title={sortOrderFieldLabel} />
            </Form.Item>
          </Space>
          <Space size="large" wrap>
            <Form.Item name="startsAt" label={t('pages.announcementAdmin.startsAt')} extra={t('pages.announcementAdmin.startsAtExtra')}>
              <div role="group" aria-label={startsAtFieldLabel} title={startsAtFieldLabel}>
                <DatePicker
	                  showTime
	                  format="YYYY-MM-DD HH:mm:ss"
	                  className="announcement-management__datePicker"
	                  classNames={announcementDatePopupClassNames}
	                  getPopupContainer={() => document.body}
	                  placement="bottomLeft"
	                  aria-label={startsAtFieldLabel}
	                  title={startsAtFieldLabel}
	                />
              </div>
            </Form.Item>
            <Form.Item
              name="endsAt"
              label={t('pages.announcementAdmin.endsAt')}
              extra={t('pages.announcementAdmin.endsAtExtra')}
              dependencies={['startsAt']}
              rules={[
                {
                  validator: (_, value) => {
                    const startsAt = form.getFieldValue('startsAt');
                    if (!value || !startsAt || !dayjs.isDayjs(value) || !dayjs.isDayjs(startsAt)) {
                      return Promise.resolve();
                    }
                    return value.isAfter(startsAt)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('pages.announcementAdmin.endsAfterStarts')));
                  },
                },
              ]}
            >
              <div role="group" aria-label={endsAtFieldLabel} title={endsAtFieldLabel}>
                <DatePicker
	                  showTime
	                  format="YYYY-MM-DD HH:mm:ss"
	                  className="announcement-management__datePicker"
	                  classNames={announcementDatePopupClassNames}
	                  getPopupContainer={() => document.body}
	                  placement="bottomLeft"
	                  aria-label={endsAtFieldLabel}
	                  title={endsAtFieldLabel}
	                />
              </div>
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;

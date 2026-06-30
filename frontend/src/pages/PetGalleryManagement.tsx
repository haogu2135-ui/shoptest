import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Image, Input, Popconfirm, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import { CameraOutlined, DeleteOutlined, HeartOutlined, ReloadOutlined, SearchOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons';
import { adminApi } from '../api';
import type { AdminPetGalleryPhoto } from '../types';
import { useLanguage } from '../i18n';
import { useDebounce } from '../hooks/useDebounce';
import { getApiErrorMessage } from '../utils/apiError';
import { imageFallbacks, resolveApiAssetUrl } from '../utils/mediaAssets';
import { PET_GALLERY_DELETE_PERMISSION, getEffectiveRole, hasAdminPermission } from '../utils/roles';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import './PetGalleryManagement.css';

const { Text, Title } = Typography;

const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'DELETED'];
const SOURCE_OPTIONS = ['ALL', 'USER_UPLOAD', 'SEED'];
const DEFAULT_PAGE_SIZE = 12;

const statusColor = (status?: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'green';
  if (normalized === 'DELETED') return 'default';
  return 'gold';
};

const sourceColor = (source?: string) => {
  const normalized = String(source || '').trim().toUpperCase();
  if (normalized === 'USER_UPLOAD') return 'blue';
  if (normalized === 'SEED') return 'purple';
  return 'default';
};

const formatFileSize = (value?: number) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const isRecent = (value?: string) => {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000;
};

const PetGalleryManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const dateLocale = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
  const [photos, setPhotos] = useState<AdminPetGalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryLoadError, setGalleryLoadError] = useState<string | null>(null);
  const [gallerySnapshotLoaded, setGallerySnapshotLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim(), 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [pageState, setPageState] = useState({ page: 1, size: DEFAULT_PAGE_SIZE, total: 0, totalPages: 0 });
  const [gallerySummary, setGallerySummary] = useState<Record<string, number>>({});
  const pageSizeRef = useRef(DEFAULT_PAGE_SIZE);
  const canDeletePhotos = hasAdminPermission(adminPermissions, currentRole, PET_GALLERY_DELETE_PERMISSION);
  const galleryActionDisabled = loading || Boolean(galleryLoadError) || !gallerySnapshotLoaded;
  const galleryActionUnavailableMessage = galleryLoadError || (loading ? t('common.loading') : t('pages.petGalleryAdmin.fetchFailed'));

  const formatTime = useCallback((value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(dateLocale) : '-';
  }, [dateLocale]);

  const getStatusLabel = useCallback((value?: string) => {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.toUpperCase();
    if (!normalized) return t('pages.petGalleryAdmin.status.UNKNOWN');
    if (STATUS_OPTIONS.includes(normalized) || normalized === 'UNKNOWN') {
      return t(`pages.petGalleryAdmin.status.${normalized}`);
    }
    return rawValue;
  }, [t]);
  const getSourceLabel = useCallback((value?: string) => {
    const rawValue = String(value || '').trim();
    const normalized = rawValue.toUpperCase();
    if (!normalized) return t('pages.petGalleryAdmin.sources.UNKNOWN');
    if (SOURCE_OPTIONS.includes(normalized) || normalized === 'UNKNOWN') {
      return t(`pages.petGalleryAdmin.sources.${normalized}`);
    }
    return rawValue;
  }, [t]);
  const pageLabel = t('pages.petGalleryAdmin.title');
  const refreshActionLabel = `${t('common.refresh')}: ${pageLabel}`;
  const keywordSearchLabel = `${t('common.search')}: ${pageLabel}`;
  const statusFilterLabel = `${t('common.status')}: ${pageLabel} - ${getStatusLabel(statusFilter)}`;
  const sourceFilterLabel = `${t('pages.petGalleryAdmin.source')}: ${pageLabel} - ${getSourceLabel(sourceFilter)}`;
  const resetFiltersActionLabel = `${t('common.reset')}: ${pageLabel}`;
  const galleryPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${pageLabel}`,
    `${t('common.nextPage')}: ${pageLabel}`,
    `${t('common.previousPages')}: ${pageLabel}`,
    `${t('common.nextPages')}: ${pageLabel}`,
  ), [pageLabel, t]);

  const fetchPhotos = useCallback(async (
    nextPage: number,
    nextSize: number,
    nextStatus = statusFilter,
    nextSource = sourceFilter,
    nextKeyword = debouncedKeyword,
  ) => {
    setLoading(true);
    try {
      const response = await adminApi.getPetGalleryPhotos({
        page: nextPage,
        size: nextSize,
        status: nextStatus === 'ALL' ? undefined : nextStatus,
        source: nextSource === 'ALL' ? undefined : nextSource,
        keyword: nextKeyword || undefined,
      });
      setGalleryLoadError(null);
      setPhotos(response.data.items || []);
      const resolvedSize = response.data.size || nextSize;
      pageSizeRef.current = resolvedSize;
      setPageState({
        page: response.data.page || nextPage,
        size: resolvedSize,
        total: response.data.total || 0,
        totalPages: response.data.totalPages || 0,
      });
      setGallerySummary(response.data.summary || {});
      setLastLoadedAt(new Date());
      setGallerySnapshotLoaded(true);
    } catch (error: unknown) {
      const errorMessage = getApiErrorMessage(error, t('pages.petGalleryAdmin.fetchFailed'), language);
      setGalleryLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, language, sourceFilter, statusFilter, t]);

  useEffect(() => {
    fetchPhotos(1, pageSizeRef.current, statusFilter, sourceFilter, debouncedKeyword);
  }, [debouncedKeyword, fetchPhotos, sourceFilter, statusFilter]);

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

  const galleryStats = useMemo(() => {
    const summaryNumber = (key: string) => Number(gallerySummary[key] ?? 0);
    const pageRecentUploads = photos.filter((photo) => isRecent(photo.createdAt)).length;
    const pageLargeFiles = photos.filter((photo) => Number(photo.fileSize || 0) > 5 * 1024 * 1024).length;
    return {
      visiblePhotos: summaryNumber('visiblePhotos') || pageState.total,
      userUploads: summaryNumber('userUploads'),
      seedPhotos: summaryNumber('seedPhotos'),
      recentUploads: summaryNumber('recentUploads') || pageRecentUploads,
      largeFiles: summaryNumber('largeFiles') || pageLargeFiles,
    };
  }, [gallerySummary, pageState.total, photos]);

  const handleDelete = useCallback(async (photo: AdminPetGalleryPhoto) => {
    if (!canDeletePhotos) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (galleryActionDisabled) {
      message.warning(galleryActionUnavailableMessage);
      return;
    }
    setDeletingId(photo.id);
    try {
      await adminApi.deletePetGalleryPhoto(photo.id);
      await fetchPhotos(pageState.page, pageState.size);
      message.success(t('pages.petGalleryAdmin.deleted'));
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.petGalleryAdmin.deleteFailed'), language));
    } finally {
      setDeletingId(null);
    }
  }, [canDeletePhotos, fetchPhotos, language, pageState.page, pageState.size, t]);

  const handleTableChange = useCallback((pagination: TablePaginationConfig) => {
    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || pageSizeRef.current;
    fetchPhotos(nextPage, nextSize);
  }, [fetchPhotos]);

  const columns: ColumnsType<AdminPetGalleryPhoto> = useMemo(() => {
    const baseColumns: ColumnsType<AdminPetGalleryPhoto> = [
    {
      title: t('pages.petGalleryAdmin.photo'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 96,
      render: (imageUrl: string, record) => (
        <Image
          src={resolveApiAssetUrl(imageUrl, imageFallbacks.media)}
          alt={record.originalFilename || record.username || t('pages.petGalleryAdmin.photoAlt')}
          width={72}
          height={72}
          fallback={imageFallbacks.media}
          className="pet-gallery-management-page__thumb"
        />
      ),
    },
    {
      title: t('pages.petGalleryAdmin.uploader'),
      key: 'uploader',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.username || t('common.unknown')}</Text>
          <Text type="secondary">{t('common.userId')}: {record.userId || '-'}</Text>
        </Space>
      ),
    },
    {
      title: t('pages.petGalleryAdmin.file'),
      key: 'file',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0} className="pet-gallery-management-page__fileCell">
          <Text ellipsis title={record.originalFilename || ''}>{record.originalFilename || t('pages.petGalleryAdmin.unknownFile')}</Text>
          <Text type="secondary">{record.contentType || '-'} / {formatFileSize(record.fileSize)}</Text>
        </Space>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status?: string) => <Tag color={statusColor(status || 'ACTIVE')}>{getStatusLabel(status || 'ACTIVE')}</Tag>,
    },
    {
      title: t('pages.petGalleryAdmin.source'),
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (source?: string) => <Tag color={sourceColor(source)}>{getSourceLabel(source || 'UNKNOWN')}</Tag>,
    },
    {
      title: t('pages.petGalleryAdmin.likes'),
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: 90,
      render: (value?: number) => <span><HeartOutlined /> {Number(value || 0)}</span>,
    },
    {
      title: t('pages.petGalleryAdmin.ipAddress'),
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 150,
      render: (value?: string) => value || t('pages.petGalleryAdmin.unknownIp'),
    },
    {
      title: t('pages.petGalleryAdmin.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: formatTime,
    },
    ];

    if (canDeletePhotos) {
      baseColumns.push({
        title: t('common.actions'),
        key: 'actions',
        width: 130,
        fixed: 'right',
        render: (_, record) => {
          const photoLabel = record.originalFilename || record.username || `#${record.id}`;
          const removeActionLabel = `${t('pages.petGalleryAdmin.remove')}: ${photoLabel}`;
          return (
            <Popconfirm
              title={t('pages.petGalleryAdmin.deleteConfirmTarget', { photo: photoLabel })}
              description={t('pages.petGalleryAdmin.deleteDescriptionTarget', {
                photo: photoLabel,
                id: record.id,
                owner: record.username || t('common.unknown'),
              })}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              classNames={{ root: 'shop-mobile-popup-layer pet-gallery-management-page__deletePopconfirm' }}
              placement="left"
              getPopupContainer={() => document.body}
              cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${removeActionLabel}`, title: `${t('common.cancel')}: ${removeActionLabel}` }}
              disabled={galleryActionDisabled}
              okButtonProps={{ danger: true, disabled: galleryActionDisabled, 'aria-label': removeActionLabel, title: removeActionLabel }}
              onConfirm={() => handleDelete(record)}
            >
              <Button danger size="small" icon={<DeleteOutlined />} disabled={galleryActionDisabled} aria-label={removeActionLabel} title={removeActionLabel} loading={deletingId === record.id}>
                {t('pages.petGalleryAdmin.remove')}
              </Button>
            </Popconfirm>
          );
        },
      });
    }

    return baseColumns;
  }, [canDeletePhotos, deletingId, formatTime, galleryActionDisabled, getSourceLabel, getStatusLabel, handleDelete, t]);

  const showInitialGalleryLoading = loading && !gallerySnapshotLoaded;
  const gallerySnapshotUnavailable = Boolean(galleryLoadError) && !gallerySnapshotLoaded;
  const canRenderGallerySnapshot = !showInitialGalleryLoading && !gallerySnapshotUnavailable;

  return (
    <div className={`pet-gallery-management-page pet-gallery-management-page--${language}`}>
      <div className="pet-gallery-management-page__hero">
        <div>
          <Text className="pet-gallery-management-page__eyebrow">{t('pages.petGalleryAdmin.eyebrow')}</Text>
          <Title level={4}>{t('pages.petGalleryAdmin.title')}</Title>
          <Text type="secondary">{t('pages.petGalleryAdmin.description')}</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} aria-label={refreshActionLabel} title={refreshActionLabel} onClick={() => fetchPhotos(pageState.page, pageState.size)}>
          {t('common.refresh')}
        </Button>
      </div>

      {galleryLoadError ? (
        <Alert
          className="pet-gallery-management-page__alert"
          type="warning"
          showIcon
          message={galleryLoadError}
          description={gallerySnapshotLoaded ? t('pages.petGalleryAdmin.staleDataWarning') : undefined}
          action={(
            <Button size="small" loading={loading} onClick={() => fetchPhotos(pageState.page, pageState.size)}>
              {t('common.retry')}
            </Button>
          )}
        />
      ) : null}

      {showInitialGalleryLoading ? (
        <Card
          className="pet-gallery-management-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {canRenderGallerySnapshot ? (
        <>
      <section className="pet-gallery-management-page__stats" aria-label={pageLabel}>
        <Card>
          <Statistic title={t('pages.petGalleryAdmin.visiblePhotos')} value={galleryStats.visiblePhotos} prefix={<CameraOutlined />} />
        </Card>
        <Card>
          <Statistic title={t('pages.petGalleryAdmin.userUploads')} value={galleryStats.userUploads} prefix={<UserOutlined />} />
        </Card>
        <Card>
          <Statistic title={t('pages.petGalleryAdmin.seedPhotos')} value={galleryStats.seedPhotos} />
        </Card>
        <Card>
          <Statistic title={t('pages.petGalleryAdmin.recentUploads')} value={galleryStats.recentUploads} />
        </Card>
      </section>

      <Card className="pet-gallery-management-page__card">
        <Alert
          type={galleryStats.largeFiles > 0 ? 'warning' : 'info'}
          showIcon
          icon={galleryStats.largeFiles > 0 ? <WarningOutlined /> : undefined}
          className="pet-gallery-management-page__notice"
          message={galleryStats.largeFiles > 0
            ? t('pages.petGalleryAdmin.largeFileNotice', { count: galleryStats.largeFiles })
            : t('pages.petGalleryAdmin.featureNotice', { count: galleryStats.visiblePhotos })}
        />
        <Space className="pet-gallery-management-page__filters" wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={galleryActionDisabled}
            placeholder={t('pages.petGalleryAdmin.keywordPlaceholder')}
            aria-label={keywordSearchLabel}
            title={keywordSearchLabel}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={galleryActionDisabled}
            options={STATUS_OPTIONS.map((value) => ({ value, label: getStatusLabel(value) }))}
            aria-label={statusFilterLabel}
            title={statusFilterLabel}
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
          />
          <Select
            value={sourceFilter}
            onChange={setSourceFilter}
            disabled={galleryActionDisabled}
            options={SOURCE_OPTIONS.map((value) => ({ value, label: getSourceLabel(value) }))}
            aria-label={sourceFilterLabel}
            title={sourceFilterLabel}
            classNames={{ popup: { root: 'shop-mobile-popup-layer' } }}
            getPopupContainer={() => document.body}
          />
          <Button disabled={galleryActionDisabled} aria-label={resetFiltersActionLabel} title={resetFiltersActionLabel} onClick={() => { setKeyword(''); setStatusFilter('ALL'); setSourceFilter('ALL'); }}>
            {t('common.reset')}
          </Button>
          {lastLoadedAt ? <Text type="secondary">{t('pages.petGalleryAdmin.loadedAt', { time: lastLoadedAt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) })}</Text> : null}
        </Space>

        <Table<AdminPetGalleryPhoto>
          rowKey="id"
          columns={columns}
          dataSource={photos}
          loading={loading}
          pagination={{
            current: pageState.page,
            pageSize: pageState.size,
            total: pageState.total,
            showSizeChanger: true,
            pageSizeOptions: ['12', '24', '48'],
            showTotal: (total) => `${total} | ${pageState.totalPages ? `${pageState.page}/${pageState.totalPages}` : '0/0'}`,
            itemRender: galleryPaginationItemRender,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1230 }}
          locale={{
            emptyText: <Empty description={t('pages.petGalleryAdmin.empty')} />,
          }}
        />
      </Card>
        </>
      ) : null}
    </div>
  );
};

export default PetGalleryManagement;

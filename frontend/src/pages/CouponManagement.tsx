import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, FireOutlined, GiftOutlined, PlusOutlined, SearchOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../api';
import type { Coupon, CouponAdminSummary, PetBirthdayCouponConfig, User } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { getApiErrorMessage } from '../utils/apiError';
import {
  COUPONS_BIRTHDAY_CONFIG_PERMISSION,
  COUPONS_BIRTHDAY_RUN_PERMISSION,
  COUPONS_DELETE_PERMISSION,
  COUPONS_GRANT_PERMISSION,
  COUPONS_WRITE_PERMISSION,
  getEffectiveRole,
  hasAdminPermission,
} from '../utils/roles';
import { buildPaginationItemRender } from '../utils/paginationLabels';
import './CouponManagement.css';

const { Title } = Typography;
const DEFAULT_COUPON_PAGE_SIZE = 10;
const mobilePopupClassNames = { popup: { root: 'shop-mobile-popup-layer' } };
const mobilePopconfirmClassNames = { root: 'shop-mobile-popup-layer' };
const validRangeStartInputId = 'coupon-management-valid-range-start';
const validRangeEndInputId = 'coupon-management-valid-range-end';
type FormValidationError = { errorFields: unknown[] };

const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};

const CouponManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [birthdayCouponLoading, setBirthdayCouponLoading] = useState(false);
  const [birthdayConfigLoading, setBirthdayConfigLoading] = useState(false);
  const [userLookupLoading, setUserLookupLoading] = useState(false);
  const [birthdayConfigSaving, setBirthdayConfigSaving] = useState(false);
  const [birthdayConfig, setBirthdayConfig] = useState<PetBirthdayCouponConfig | null>(null);
  const [couponSummary, setCouponSummary] = useState<CouponAdminSummary | null>(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [pageState, setPageState] = useState({ page: 1, size: DEFAULT_COUPON_PAGE_SIZE, total: 0, totalPages: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [grantVisible, setGrantVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [grantCoupon, setGrantCoupon] = useState<Coupon | null>(null);
  const [currentRole, setCurrentRole] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();
  const [grantForm] = Form.useForm();
  const [birthdayConfigForm] = Form.useForm();
  const pageSizeRef = useRef(DEFAULT_COUPON_PAGE_SIZE);
  const userSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const couponType = Form.useWatch('couponType', form);
  const couponPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${t('adminLayout.coupons')}`,
    `${t('common.nextPage')}: ${t('adminLayout.coupons')}`,
  ), [t]);
  const birthdayCouponType = Form.useWatch('couponType', birthdayConfigForm);
  const birthdayConfigEnabled = Form.useWatch('enabled', birthdayConfigForm);
  const birthdayReductionAmount = Form.useWatch('reductionAmount', birthdayConfigForm);
  const birthdayDiscountPercent = Form.useWatch('discountPercent', birthdayConfigForm);
  const birthdayMaxDiscountAmount = Form.useWatch('maxDiscountAmount', birthdayConfigForm);
  const birthdayValidDays = Form.useWatch('validDays', birthdayConfigForm);
  const birthdayMaxBenefitsPerUser = Form.useWatch('maxBenefitsPerUser', birthdayConfigForm);
  const birthdayQuantityPerCoupon = Form.useWatch('totalQuantityPerCoupon', birthdayConfigForm);
  const { formatMoney } = useMarket();
  const formatOptionalMoney = (value: unknown) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? formatMoney(amount) : '-';
  };
  const canWriteCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_WRITE_PERMISSION);
  const canDeleteCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_DELETE_PERMISSION);
  const canGrantCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_GRANT_PERMISSION);
  const canRunBirthdayCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_BIRTHDAY_RUN_PERMISSION);
  const canConfigureBirthdayCoupons = hasAdminPermission(adminPermissions, currentRole, COUPONS_BIRTHDAY_CONFIG_PERMISSION);
  const localCouponOpsStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return coupons.reduce((stats, coupon) => {
      const isActive = coupon.status === 'ACTIVE';
      if (isActive) stats.active += 1;
      if (coupon.scope === 'PUBLIC' && isActive) stats.publicActive += 1;
      if (coupon.endAt) {
        const endAt = new Date(coupon.endAt).getTime();
        if (Number.isFinite(endAt) && endAt >= now && endAt - now <= sevenDaysMs) {
          stats.expiringSoon += 1;
        }
      }
      if (coupon.totalQuantity) {
        const remaining = Math.max(0, coupon.totalQuantity - (coupon.claimedQuantity || 0));
        if (remaining > 0 && remaining <= 10) stats.lowRemaining += 1;
      }
      return stats;
    }, { active: 0, publicActive: 0, expiringSoon: 0, lowRemaining: 0 });
  }, [coupons]);
  const couponOpsStats = useMemo(() => couponSummary ? {
    active: couponSummary.activeCoupons,
    publicActive: couponSummary.publicActiveCoupons,
    expiringSoon: couponSummary.expiringSoonCoupons,
    lowRemaining: couponSummary.lowRemainingCoupons,
  } : localCouponOpsStats, [couponSummary, localCouponOpsStats]);
  const grantMaxUsers = Math.max(1, couponSummary?.maxGrantUsers || 100);
  const couponNameMaxChars = Math.max(1, couponSummary?.nameMaxChars || 120);
  const couponDescriptionMaxChars = Math.max(1, couponSummary?.descriptionMaxChars || 1000);
  const totalQuantityMax = Math.max(1, couponSummary?.totalQuantityMax || 100000);
  const couponDiscountPercent = (coupon: Pick<Coupon, 'discountPercent'>) => {
    const payablePercent = Math.max(0, Math.min(Number(coupon.discountPercent ?? 100), 100));
    return Math.max(0, 100 - payablePercent);
  };
  const formatCouponType = useCallback((type?: string) => {
    const rawType = String(type || '').trim();
    const normalizedType = rawType.toUpperCase();
    if (normalizedType === 'FULL_REDUCTION') return t('pages.coupons.fullReduction');
    if (normalizedType === 'DISCOUNT') return t('pages.coupons.discount');
    return rawType || '-';
  }, [t]);
  const formatCouponScope = useCallback((scope?: string) => {
    const rawScope = String(scope || '').trim();
    const normalizedScope = rawScope.toUpperCase();
    if (normalizedScope === 'PUBLIC') return t('pages.adminCoupons.publicClaim');
    if (normalizedScope === 'ASSIGNED') return t('pages.adminCoupons.adminAssigned');
    return rawScope || '-';
  }, [t]);
  const formatCouponStatus = useCallback((status?: string) => {
    const rawStatus = String(status || '').trim();
    const normalizedStatus = (rawStatus || 'ACTIVE').toUpperCase();
    if (normalizedStatus === 'ACTIVE' || normalizedStatus === 'INACTIVE') {
      return t(`status.${normalizedStatus}`);
    }
    return rawStatus || '-';
  }, [t]);
  const summaryCheckedAt = useMemo(() => {
    if (!couponSummary?.checkedAt) return null;
    const checkedAt = dayjs(couponSummary.checkedAt);
    return checkedAt.isValid() ? checkedAt.format('YYYY-MM-DD HH:mm') : couponSummary.checkedAt;
  }, [couponSummary]);
  const couponPageLabel = t('pages.adminCoupons.title');
  const allFilterLabel = t('common.all');
  const getCouponLabel = useCallback((coupon?: Pick<Coupon, 'id' | 'name'> | null) => {
    if (!coupon) return t('pages.adminCoupons.grantCoupon');
    return coupon.name || `${t('pages.adminCoupons.name')} #${coupon.id}`;
  }, [t]);
  const createCouponLabel = `${t('pages.adminCoupons.createCoupon')}: ${couponPageLabel}`;
  const couponEditorLabel = editingCoupon
    ? `${t('pages.adminCoupons.editCoupon')}: ${getCouponLabel(editingCoupon)}`
    : createCouponLabel;
  const grantCouponLabel = grantCoupon
    ? `${t('pages.adminCoupons.grantCoupon')}: ${getCouponLabel(grantCoupon)}`
    : t('pages.adminCoupons.grantCoupon');
  const birthdayConfigLabel = `${couponPageLabel}: ${t('pages.adminCoupons.birthdayConfigTitle')}`;
  const runBirthdayCouponsLabel = `${t('pages.adminCoupons.runPetBirthdayCoupons')}: ${birthdayConfigLabel}`;
  const saveBirthdayConfigLabel = `${t('common.save')}: ${birthdayConfigLabel}`;
  const birthdayConfigConfirmDescription = [
    `${t('pages.adminCoupons.birthdayEnabledLabel')}: ${birthdayConfigEnabled ? t('pages.adminCoupons.birthdayEnabled') : t('pages.adminCoupons.birthdayDisabled')}`,
    `${t('pages.adminCoupons.type')}: ${birthdayCouponType ? formatCouponType(birthdayCouponType) : '-'}`,
    birthdayCouponType === 'DISCOUNT'
      ? `${t('pages.adminCoupons.discountPayablePercent')}: ${birthdayDiscountPercent || '-'}% / ${t('pages.adminCoupons.maxDiscountLabel')}: ${formatOptionalMoney(birthdayMaxDiscountAmount)}`
      : `${t('pages.adminCoupons.reductionAmount')}: ${formatOptionalMoney(birthdayReductionAmount)}`,
    `${t('pages.adminCoupons.birthdayValidDays')}: ${birthdayValidDays || '-'}`,
    `${t('pages.adminCoupons.birthdayMaxPerUser')}: ${birthdayMaxBenefitsPerUser ?? '-'}`,
    `${t('pages.adminCoupons.birthdayQuantityPerCoupon')}: ${birthdayQuantityPerCoupon ?? '-'}`,
  ].join(' · ');
  const couponSearchLabel = `${t('common.search')}: ${couponPageLabel}`;
  const couponStatusFilterLabel = `${couponPageLabel}: ${t('pages.adminCoupons.status')} ${statusFilter ? formatCouponStatus(statusFilter) : allFilterLabel}`;
  const couponScopeFilterLabel = `${couponPageLabel}: ${t('pages.adminCoupons.scope')} ${scopeFilter ? formatCouponScope(scopeFilter) : allFilterLabel}`;
  const couponInsightLabels = {
    active: `${couponPageLabel}: ${t('pages.adminCoupons.activeCoupons')} ${couponOpsStats.active}`,
    publicActive: `${couponPageLabel}: ${t('pages.adminCoupons.publicActiveCoupons')} ${couponOpsStats.publicActive}`,
    expiringSoon: `${couponPageLabel}: ${t('pages.adminCoupons.expiringSoonCoupons')} ${couponOpsStats.expiringSoon}`,
    lowRemaining: `${couponPageLabel}: ${t('pages.adminCoupons.lowRemainingCoupons')} ${couponOpsStats.lowRemaining}`,
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const loadCoupons = useCallback(async (page = 1, size = pageSizeRef.current) => {
    setLoading(true);
    try {
      const res = await adminApi.getCoupons({
        keyword: debouncedKeyword || undefined,
        status: statusFilter,
        scope: scopeFilter,
        page,
        size,
      });
      setCoupons(res.data.items);
      pageSizeRef.current = res.data.size || size;
      setPageState({
        page: res.data.page,
        size: pageSizeRef.current,
        total: res.data.total,
        totalPages: res.data.totalPages,
      });
      if (res.data.summary) {
        setCouponSummary(res.data.summary);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.loadFailed'), language));
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, language, scopeFilter, statusFilter, t]);

  const loadCouponSummary = useCallback(async () => {
    try {
      const res = await adminApi.getCouponSummary({
        keyword: debouncedKeyword || undefined,
        status: statusFilter,
        scope: scopeFilter,
      });
      setCouponSummary(res.data);
    } catch {
      setCouponSummary(null);
    }
  }, [debouncedKeyword, scopeFilter, statusFilter]);

  const loadUsers = useCallback(async (search?: string) => {
    setUserLookupLoading(true);
    try {
      const res = await adminApi.getUsersPage({ keyword: search?.trim() || undefined, page: 1, size: 20 });
      setUsers(res.data.items || []);
    } catch {
      setUsers([]);
    } finally {
      setUserLookupLoading(false);
    }
  }, []);

  const handleUserSearch = useCallback((value: string) => {
    if (userSearchTimerRef.current) {
      clearTimeout(userSearchTimerRef.current);
    }
    userSearchTimerRef.current = setTimeout(() => loadUsers(value), 300);
  }, [loadUsers]);

  const loadBirthdayConfig = useCallback(async () => {
    setBirthdayConfigLoading(true);
    try {
      const res = await adminApi.getPetBirthdayCouponConfig();
      setBirthdayConfig(res.data);
      birthdayConfigForm.setFieldsValue(res.data);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.birthdayConfigLoadFailed'), language));
    } finally {
      setBirthdayConfigLoading(false);
    }
  }, [birthdayConfigForm, language, t]);

  useEffect(() => {
    loadCoupons();
    loadCouponSummary();
  }, [loadCouponSummary, loadCoupons]);

  useEffect(() => {
    loadUsers();
    loadBirthdayConfig();
  }, [loadBirthdayConfig, loadUsers]);

  useEffect(() => () => {
    if (userSearchTimerRef.current) {
      clearTimeout(userSearchTimerRef.current);
    }
  }, []);

  useEffect(() => {
    adminApi.getMyPermissions()
      .then((response) => {
        setCurrentRole(getEffectiveRole(response.data.role, response.data.roleCode));
        setAdminPermissions(response.data.permissions || []);
      })
      .catch(() => {
        setCurrentRole('');
        setAdminPermissions([]);
      });
  }, []);

  const openCreate = () => {
    if (!canWriteCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setEditingCoupon(null);
    form.resetFields();
    form.setFieldsValue({ couponType: 'FULL_REDUCTION', scope: 'PUBLIC', status: 'ACTIVE', thresholdAmount: 0, reductionAmount: 0 });
    setModalVisible(true);
  };

  const openEdit = (coupon: Coupon) => {
    if (!canWriteCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setEditingCoupon(coupon);
    form.resetFields();
    form.setFieldsValue({
      ...coupon,
      validRange: coupon.startAt || coupon.endAt ? [coupon.startAt ? dayjs(coupon.startAt) : null, coupon.endAt ? dayjs(coupon.endAt) : null] : undefined,
    });
    setModalVisible(true);
  };

  const submitCoupon = async () => {
    if (!canWriteCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await form.validateFields();
      setCouponSubmitting(true);
      const payload = {
        ...values,
        startAt: values.validRange?.[0] ? values.validRange[0].format('YYYY-MM-DDTHH:mm:ss') : null,
        endAt: values.validRange?.[1] ? values.validRange[1].format('YYYY-MM-DDTHH:mm:ss') : null,
      };
      delete payload.validRange;
      if (payload.couponType === 'FULL_REDUCTION') {
        payload.discountPercent = null;
        payload.maxDiscountAmount = null;
      } else {
        payload.reductionAmount = null;
      }
      if (editingCoupon) {
        await adminApi.updateCoupon(editingCoupon.id, payload);
        message.success(t('pages.adminCoupons.updated'));
      } else {
        await adminApi.createCoupon(payload);
        message.success(t('pages.adminCoupons.created'));
      }
      setModalVisible(false);
      setEditingCoupon(null);
      form.resetFields();
      await Promise.all([loadCoupons(editingCoupon ? pageState.page : 1, pageState.size), loadCouponSummary()]);
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('messages.operationFailed'), language));
    } finally {
      setCouponSubmitting(false);
    }
  };

  const deleteCoupon = async (id: number) => {
    if (!canDeleteCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      await adminApi.deleteCoupon(id);
      message.success(t('pages.adminCoupons.deleted'));
      await Promise.all([loadCoupons(pageState.page, pageState.size), loadCouponSummary()]);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.deleteFailed'), language));
    }
  };

  const openGrant = (coupon: Coupon) => {
    if (!canGrantCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setGrantCoupon(coupon);
    grantForm.resetFields();
    setGrantVisible(true);
  };

  const submitGrant = async () => {
    if (!grantCoupon) return;
    if (!canGrantCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await grantForm.validateFields();
      Modal.confirm({
        title: t('pages.adminCoupons.grantConfirm', { name: getCouponLabel(grantCoupon), count: values.userIds.length }),
        okText: t('pages.adminCoupons.grant'),
        cancelText: t('common.cancel'),
        okButtonProps: {
          'aria-label': `${t('pages.adminCoupons.grant')}: ${getCouponLabel(grantCoupon)} - ${values.userIds.length}`,
          title: `${t('pages.adminCoupons.grant')}: ${getCouponLabel(grantCoupon)} - ${values.userIds.length}`,
        },
        cancelButtonProps: {
          'aria-label': `${t('common.cancel')}: ${getCouponLabel(grantCoupon)}`,
          title: `${t('common.cancel')}: ${getCouponLabel(grantCoupon)}`,
        },
        className: 'profile-mobile-safe-modal coupon-management-page__grantConfirmModal',
        onOk: async () => {
          setGrantSubmitting(true);
          try {
            const res = await adminApi.grantCoupon(grantCoupon.id, values.userIds, grantMaxUsers);
            message.success(t('pages.adminCoupons.granted', { count: res.data.granted }));
            setGrantVisible(false);
            setGrantCoupon(null);
            grantForm.resetFields();
            await Promise.all([loadCoupons(pageState.page, pageState.size), loadCouponSummary()]);
          } catch (error: unknown) {
            message.error(getApiErrorMessage(error, t('pages.adminCoupons.grantFailed'), language));
            throw error;
          } finally {
            setGrantSubmitting(false);
          }
        },
      });
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        message.error(getApiErrorMessage(error, t('pages.adminCoupons.grantFailed'), language));
      }
    }
  };

  const runPetBirthdayCoupons = async () => {
    if (!canRunBirthdayCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    setBirthdayCouponLoading(true);
    try {
      const res = await adminApi.runPetBirthdayCoupons();
      message.success(t('pages.adminCoupons.petBirthdayGranted', { count: res.data.granted }));
      await Promise.all([loadCoupons(pageState.page, pageState.size), loadCouponSummary()]);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.petBirthdayFailed'), language));
    } finally {
      setBirthdayCouponLoading(false);
    }
  };

  const closeCouponModal = () => {
    if (couponSubmitting) return;
    setModalVisible(false);
    setEditingCoupon(null);
    form.resetFields();
  };

  const closeGrantModal = () => {
    if (grantSubmitting) return;
    setGrantVisible(false);
    setGrantCoupon(null);
    grantForm.resetFields();
  };

  const saveBirthdayConfig = async () => {
    if (!canConfigureBirthdayCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    try {
      const values = await birthdayConfigForm.validateFields();
      setBirthdayConfigSaving(true);
      const payload = {
        ...values,
        enabled: Boolean(values.enabled),
        totalQuantityPerCoupon: values.totalQuantityPerCoupon || null,
        maxDiscountAmount: values.maxDiscountAmount || null,
      };
      if (payload.couponType === 'FULL_REDUCTION') {
        payload.discountPercent = null;
        payload.maxDiscountAmount = null;
      } else {
        payload.reductionAmount = null;
      }
      const res = await adminApi.updatePetBirthdayCouponConfig(payload);
      setBirthdayConfig(res.data);
      birthdayConfigForm.setFieldsValue(res.data);
      message.success(t('pages.adminCoupons.birthdayConfigSaved'));
    } catch (error: unknown) {
      if (isFormValidationError(error)) return;
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.birthdayConfigSaveFailed'), language));
    } finally {
      setBirthdayConfigSaving(false);
    }
  };

  const columns = [
    { title: t('pages.adminCoupons.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('pages.adminCoupons.type'),
      dataIndex: 'couponType',
      key: 'couponType',
      render: (type: string) => {
        const normalizedType = String(type || '').trim().toUpperCase();
        return <Tag color={normalizedType === 'FULL_REDUCTION' ? 'volcano' : normalizedType === 'DISCOUNT' ? 'blue' : 'default'}>{formatCouponType(type)}</Tag>;
      },
    },
    {
      title: t('pages.adminCoupons.rule'),
      key: 'rule',
      render: (_: unknown, record: Coupon) => (
        <span className="commerce-atomic">
          {record.couponType === 'FULL_REDUCTION'
            ? `${formatMoney(record.thresholdAmount)} - ${formatMoney(record.reductionAmount)}`
            : t('pages.coupons.discountPayable', { percent: couponDiscountPercent(record) }) + (record.maxDiscountAmount ? `, ${t('pages.coupons.maxDiscount', { amount: formatMoney(record.maxDiscountAmount) })}` : '')}
        </span>
      ),
    },
    { title: t('pages.adminCoupons.scope'), dataIndex: 'scope', key: 'scope', render: (scope: string) => <Tag>{formatCouponScope(scope)}</Tag> },
    {
      title: t('pages.adminCoupons.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const normalizedStatus = String(status || 'ACTIVE').trim().toUpperCase();
        return <Tag color={normalizedStatus === 'ACTIVE' ? 'green' : 'default'}>{formatCouponStatus(status)}</Tag>;
      },
    },
    {
      title: t('pages.adminCoupons.issued'),
      key: 'issued',
      render: (_: unknown, record: Coupon) => `${record.claimedQuantity || 0}${record.totalQuantity ? ` / ${record.totalQuantity}` : ''}`,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, record: Coupon) => {
        const couponName = getCouponLabel(record);
        const grantActionLabel = `${t('pages.adminCoupons.grant')}: ${couponName}`;
        const editActionLabel = `${t('common.edit')}: ${couponName}`;
        const deleteActionLabel = `${t('common.delete')}: ${couponName}`;
        return (
          <Space>
            {canGrantCoupons ? <Button size="small" icon={<SendOutlined />} aria-label={grantActionLabel} title={grantActionLabel} onClick={() => openGrant(record)}>{t('pages.adminCoupons.grant')}</Button> : null}
            {canWriteCoupons ? <Button size="small" icon={<EditOutlined />} aria-label={editActionLabel} title={editActionLabel} onClick={() => openEdit(record)}>{t('common.edit')}</Button> : null}
            {canDeleteCoupons ? (
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={t('pages.adminCoupons.deleteConfirm')}
                onConfirm={() => deleteCoupon(record.id)}
                okButtonProps={{ 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${couponName}`, title: `${t('common.cancel')}: ${couponName}` }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="coupon-management-page">
      <div className="coupon-management-page__header">
        <Title level={3} style={{ margin: 0 }}><GiftOutlined /> {t('pages.adminCoupons.title')}</Title>
        <Space wrap className="coupon-management-page__actions">
          {canWriteCoupons ? <Button type="primary" icon={<PlusOutlined />} aria-label={createCouponLabel} title={createCouponLabel} onClick={openCreate}>{t('pages.adminCoupons.createCoupon')}</Button> : null}
        </Space>
      </div>

      <section className="coupon-management-insights">
        <div className="coupon-management-insights__copy">
          <span>{t('pages.adminCoupons.opsEyebrow')}</span>
          <h2>{t('pages.adminCoupons.opsTitle')}</h2>
          <p>{t('pages.adminCoupons.opsSubtitle')}</p>
          {summaryCheckedAt ? (
            <small className="coupon-management-insights__updated">
              {t('pages.adminCoupons.opsCheckedAt', { time: summaryCheckedAt })}
            </small>
          ) : null}
        </div>
        <div className="coupon-management-insights__cards">
          <div role="group" aria-label={couponInsightLabels.active} title={couponInsightLabels.active}>
            <ThunderboltOutlined />
            <strong>{couponOpsStats.active}</strong>
            <span>{t('pages.adminCoupons.activeCoupons')}</span>
          </div>
          <div role="group" aria-label={couponInsightLabels.publicActive} title={couponInsightLabels.publicActive}>
            <GiftOutlined />
            <strong>{couponOpsStats.publicActive}</strong>
            <span>{t('pages.adminCoupons.publicActiveCoupons')}</span>
          </div>
          <div role="group" aria-label={couponInsightLabels.expiringSoon} title={couponInsightLabels.expiringSoon}>
            <ClockCircleOutlined />
            <strong>{couponOpsStats.expiringSoon}</strong>
            <span>{t('pages.adminCoupons.expiringSoonCoupons')}</span>
          </div>
          <div role="group" aria-label={couponInsightLabels.lowRemaining} title={couponInsightLabels.lowRemaining}>
            <FireOutlined />
            <strong>{couponOpsStats.lowRemaining}</strong>
            <span>{t('pages.adminCoupons.lowRemainingCoupons')}</span>
          </div>
        </div>
      </section>

      <Card
        className="coupon-management-birthday"
        title={
          <Space>
            <GiftOutlined />
            <span>{t('pages.adminCoupons.birthdayConfigTitle')}</span>
            <Tag color={birthdayConfig?.enabled ? 'green' : 'default'}>
              {birthdayConfig?.enabled ? t('pages.adminCoupons.birthdayEnabled') : t('pages.adminCoupons.birthdayDisabled')}
            </Tag>
          </Space>
        }
        extra={
          <Space wrap>
            {canRunBirthdayCoupons ? (
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={t('pages.adminCoupons.runPetBirthdayCouponsConfirm')}
                onConfirm={runPetBirthdayCoupons}
                disabled={birthdayConfigLoading}
                okButtonProps={{ 'aria-label': runBirthdayCouponsLabel, title: runBirthdayCouponsLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${birthdayConfigLabel}`, title: `${t('common.cancel')}: ${birthdayConfigLabel}` }}
              >
                <Button
                  icon={<GiftOutlined />}
                  loading={birthdayCouponLoading}
                  disabled={birthdayConfigLoading}
                  aria-label={runBirthdayCouponsLabel}
                  title={runBirthdayCouponsLabel}
                >
                  {t('pages.adminCoupons.runPetBirthdayCoupons')}
                </Button>
              </Popconfirm>
            ) : null}
            {canConfigureBirthdayCoupons ? (
              <Popconfirm
                classNames={mobilePopconfirmClassNames}
                title={saveBirthdayConfigLabel}
                description={birthdayConfigConfirmDescription}
                onConfirm={saveBirthdayConfig}
                disabled={birthdayConfigLoading || birthdayConfigSaving}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': saveBirthdayConfigLabel, title: saveBirthdayConfigLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${saveBirthdayConfigLabel}`, title: `${t('common.cancel')}: ${saveBirthdayConfigLabel}` }}
              >
                <Button
                  type="primary"
                  loading={birthdayConfigSaving}
                  disabled={birthdayConfigLoading}
                  aria-label={saveBirthdayConfigLabel}
                  title={saveBirthdayConfigLabel}
                >
                  {t('common.save')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        }
        loading={birthdayConfigLoading}
      >
        <Form form={birthdayConfigForm} layout="vertical" className="coupon-management-birthday__form">
          <div className="coupon-management-page__formRow">
            <Form.Item name="enabled" label={t('pages.adminCoupons.birthdayEnabledLabel')} valuePropName="checked">
              <Switch title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayEnabledLabel')}`} />
            </Form.Item>
            <Form.Item name="namePrefix" label={t('pages.adminCoupons.birthdayNamePrefix')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayNamePrefixRequired') }]}>
              <Input aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayNamePrefix')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayNamePrefix')}`} />
            </Form.Item>
          </div>
          <div className="coupon-management-page__formRow">
            <Form.Item name="couponType" label={t('pages.adminCoupons.type')} rules={[{ required: true }]}>
              <Select
                aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.type')} ${birthdayCouponType ? formatCouponType(birthdayCouponType) : ''}`}
                title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.type')}`}
                onChange={() => birthdayConfigForm.validateFields(['reductionAmount', 'discountPercent', 'maxDiscountAmount']).catch(() => undefined)}
                classNames={mobilePopupClassNames}
                getPopupContainer={() => document.body}
                options={[
                  { value: 'FULL_REDUCTION', label: t('pages.coupons.fullReduction') },
                  { value: 'DISCOUNT', label: t('pages.coupons.discount') },
                ]}
              />
            </Form.Item>
            <Form.Item name="thresholdAmount" label={t('pages.adminCoupons.minimumSpend')} rules={[{ required: true, message: t('pages.adminCoupons.minimumSpendRequired') }]}>
              <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.minimumSpend')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.minimumSpend')}`} />
            </Form.Item>
          </div>
          {birthdayCouponType === 'DISCOUNT' ? (
            <>
              <div className="coupon-management-page__formRow">
                <Form.Item name="discountPercent" label={t('pages.adminCoupons.discountPayablePercent')} rules={[{ required: true, message: t('pages.adminCoupons.discountPercentRequired') }]}>
                  <InputNumber min={1} max={99} suffix="%" placeholder={t('pages.adminCoupons.discountPlaceholder')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} />
                </Form.Item>
                <Form.Item name="maxDiscountAmount" label={t('pages.adminCoupons.maxDiscountLabel')}>
                  <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="validDays" label={t('pages.adminCoupons.birthdayValidDays')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayValidDaysRequired') }]}>
                  <InputNumber min={1} max={365} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} />
                </Form.Item>
                <Form.Item name="maxBenefitsPerUser" label={t('pages.adminCoupons.birthdayMaxPerUser')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayMaxPerUserRequired') }]}>
                  <InputNumber min={0} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="totalQuantityPerCoupon" label={t('pages.adminCoupons.birthdayQuantityPerCoupon')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <InputNumber min={1} max={totalQuantityMax} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} />
                </Form.Item>
                <div />
              </div>
            </>
          ) : (
            <>
              <div className="coupon-management-page__formRow">
                <Form.Item name="reductionAmount" label={t('pages.adminCoupons.reductionAmount')} rules={[{ required: true, message: t('pages.adminCoupons.reductionAmountRequired') }]}>
                  <InputNumber min={0.01} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.reductionAmount')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.reductionAmount')}`} />
                </Form.Item>
                <Form.Item name="validDays" label={t('pages.adminCoupons.birthdayValidDays')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayValidDaysRequired') }]}>
                  <InputNumber min={1} max={365} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="maxBenefitsPerUser" label={t('pages.adminCoupons.birthdayMaxPerUser')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayMaxPerUserRequired') }]}>
                  <InputNumber min={0} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} />
                </Form.Item>
                <Form.Item name="totalQuantityPerCoupon" label={t('pages.adminCoupons.birthdayQuantityPerCoupon')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <InputNumber min={1} max={totalQuantityMax} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} />
                </Form.Item>
              </div>
            </>
          )}
          <Form.Item name="description" label={t('pages.adminCoupons.description')} rules={[{ max: couponDescriptionMaxChars, message: t('pages.adminCoupons.descriptionMaxLength', { count: couponDescriptionMaxChars }) }]}>
            <Input.TextArea rows={2} maxLength={couponDescriptionMaxChars} showCount aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.description')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.description')}`} />
          </Form.Item>
          <Typography.Text type="secondary">
            {t('pages.adminCoupons.birthdayConfigHint')}
          </Typography.Text>
        </Form>
      </Card>

      <Card className="coupon-management-page__toolbar">
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('common.search')}
            className="coupon-management-page__keywordInput"
            aria-label={couponSearchLabel}
            title={couponSearchLabel}
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t('pages.adminCoupons.status')}
            className="coupon-management-page__filterSelect"
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            aria-label={couponStatusFilterLabel}
            title={couponStatusFilterLabel}
            options={[
              { value: 'ACTIVE', label: t('status.ACTIVE') },
              { value: 'INACTIVE', label: t('status.INACTIVE') },
            ]}
          />
          <Select
            allowClear
            value={scopeFilter}
            onChange={setScopeFilter}
            placeholder={t('pages.adminCoupons.scope')}
            className="coupon-management-page__filterSelect"
            classNames={mobilePopupClassNames}
            getPopupContainer={() => document.body}
            aria-label={couponScopeFilterLabel}
            title={couponScopeFilterLabel}
            options={[
              { value: 'PUBLIC', label: t('pages.adminCoupons.publicClaim') },
              { value: 'ASSIGNED', label: t('pages.adminCoupons.adminAssigned') },
            ]}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={coupons}
        rowKey="id"
        loading={loading}
        bordered
        scroll={{ x: 980 }}
        pagination={{
          current: pageState.page,
          pageSize: pageState.size,
          total: pageState.total,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          itemRender: couponPaginationItemRender,
          onChange: (page, size) => loadCoupons(page, size),
        }}
      />

      <Modal
        className="profile-mobile-safe-modal coupon-management-page__editorModal"
        title={editingCoupon ? t('pages.adminCoupons.editCoupon') : t('pages.adminCoupons.createCoupon')}
        open={modalVisible}
        onOk={submitCoupon}
        onCancel={closeCouponModal}
        confirmLoading={couponSubmitting}
        width={720}
        destroyOnHidden
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': `${t('common.save')}: ${couponEditorLabel}`, title: `${t('common.save')}: ${couponEditorLabel}` }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${couponEditorLabel}`, title: `${t('common.cancel')}: ${couponEditorLabel}` }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.adminCoupons.name')} rules={[{ required: true, message: t('pages.adminCoupons.nameRequired') }, { max: couponNameMaxChars, message: t('pages.adminCoupons.nameMaxLength', { count: couponNameMaxChars }) }]}>
            <Input maxLength={couponNameMaxChars} showCount aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.name')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.name')}`} />
          </Form.Item>
          <Form.Item name="couponType" label={t('pages.adminCoupons.type')} rules={[{ required: true }]}>
            <Select
              aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.type')} ${couponType ? formatCouponType(couponType) : ''}`}
              title={`${couponEditorLabel}: ${t('pages.adminCoupons.type')}`}
              onChange={() => form.validateFields(['reductionAmount', 'discountPercent', 'maxDiscountAmount']).catch(() => undefined)}
              classNames={mobilePopupClassNames}
              getPopupContainer={() => document.body}
              options={[
                { value: 'FULL_REDUCTION', label: t('pages.coupons.fullReduction') },
                { value: 'DISCOUNT', label: t('pages.coupons.discount') },
              ]}
            />
          </Form.Item>
          <div className="coupon-management-page__formRow">
            <Form.Item name="thresholdAmount" label={t('pages.adminCoupons.minimumSpend')} rules={[{ required: true, message: t('pages.adminCoupons.minimumSpendRequired') }]}>
              <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.minimumSpend')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.minimumSpend')}`} />
            </Form.Item>
            {couponType === 'DISCOUNT' ? (
              <Form.Item name="discountPercent" label={t('pages.adminCoupons.discountPayablePercent')} rules={[{ required: true, message: t('pages.adminCoupons.discountPercentRequired') }]}>
                <InputNumber min={1} max={99} suffix="%" placeholder={t('pages.adminCoupons.discountPlaceholder')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} />
              </Form.Item>
            ) : (
              <Form.Item name="reductionAmount" label={t('pages.adminCoupons.reductionAmount')} rules={[{ required: true, message: t('pages.adminCoupons.reductionAmountRequired') }]}>
                <InputNumber min={0.01} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.reductionAmount')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.reductionAmount')}`} />
              </Form.Item>
            )}
          </div>
          <div className="coupon-management-page__formRow">
            {couponType === 'DISCOUNT' ? (
              <>
                <Form.Item name="maxDiscountAmount" label={t('pages.adminCoupons.maxDiscountLabel')}>
                  <InputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} />
                </Form.Item>
                <Form.Item name="totalQuantity" label={t('pages.adminCoupons.issueQuantity')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <InputNumber min={1} max={totalQuantityMax} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="totalQuantity" label={t('pages.adminCoupons.issueQuantity')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <InputNumber min={1} max={totalQuantityMax} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} />
                </Form.Item>
                <div />
              </>
            )}
          </div>
          <Form.Item name="scope" label={t('pages.adminCoupons.scope')}>
            <Select aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.scope')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.scope')}`} classNames={mobilePopupClassNames} getPopupContainer={() => document.body} options={[{ value: 'PUBLIC', label: t('pages.adminCoupons.publicClaim') }, { value: 'ASSIGNED', label: t('pages.adminCoupons.adminAssigned') }]} />
          </Form.Item>
          <Form.Item name="status" label={t('pages.adminCoupons.status')}>
            <Select aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.status')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.status')}`} classNames={mobilePopupClassNames} getPopupContainer={() => document.body} options={[{ value: 'ACTIVE', label: t('status.ACTIVE') }, { value: 'INACTIVE', label: t('status.INACTIVE') }]} />
          </Form.Item>
          <Form.Item label={t('pages.adminCoupons.validTime')}>
            <div role="group" aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')}`}>
              <Form.Item name="validRange" noStyle>
                <>
                  <label className="coupon-management-page__srOnly" htmlFor={validRangeStartInputId}>
                    {`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')} - ${t('common.start')}`}
                  </label>
                  <label className="coupon-management-page__srOnly" htmlFor={validRangeEndInputId}>
                    {`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')} - ${t('common.end')}`}
                  </label>
                  <DatePicker.RangePicker
                    showTime
                    id={{ start: validRangeStartInputId, end: validRangeEndInputId }}
                    className="coupon-management-page__rangePicker"
                    classNames={mobilePopupClassNames}
                    getPopupContainer={() => document.body}
                  />
                </>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="description" label={t('pages.adminCoupons.description')} rules={[{ max: couponDescriptionMaxChars, message: t('pages.adminCoupons.descriptionMaxLength', { count: couponDescriptionMaxChars }) }]}>
            <Input.TextArea rows={3} maxLength={couponDescriptionMaxChars} showCount aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.description')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.description')}`} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="profile-mobile-safe-modal coupon-management-page__grantModal"
        title={grantCoupon ? t('pages.adminCoupons.grantCouponWithName', { name: getCouponLabel(grantCoupon) }) : t('pages.adminCoupons.grantCoupon')}
        open={grantVisible}
        onOk={submitGrant}
        onCancel={closeGrantModal}
        confirmLoading={grantSubmitting}
        destroyOnHidden
        okText={t('pages.adminCoupons.grant')}
        cancelText={t('common.cancel')}
        okButtonProps={{ 'aria-label': grantCouponLabel, title: grantCouponLabel }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${grantCouponLabel}`, title: `${t('common.cancel')}: ${grantCouponLabel}` }}
      >
        <Form form={grantForm} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pages.adminCoupons.grantHelpTitle')}
            description={(
              <Space direction="vertical" size={6}>
                <span>{t('pages.adminCoupons.grantHelpDescription')}</span>
                <Tag color="blue">{t('pages.adminCoupons.grantLimit', { count: grantMaxUsers })}</Tag>
              </Space>
            )}
          />
          <Form.Item
            name="userIds"
            label={t('pages.adminCoupons.users')}
            rules={[
              { required: true, message: t('pages.adminCoupons.selectUsers') },
              {
                validator: (_, value: number[] = []) => {
                  if (!value?.length || value.length <= grantMaxUsers) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.adminCoupons.grantLimitExceeded', { count: grantMaxUsers })));
                },
              },
            ]}
          >
            <Select
              mode="multiple"
              maxTagCount="responsive"
              showSearch
              filterOption={false}
              aria-label={`${grantCouponLabel}: ${t('pages.adminCoupons.users')}`}
              title={`${grantCouponLabel}: ${t('pages.adminCoupons.users')}`}
              onSearch={handleUserSearch}
              onOpenChange={(open) => {
                if (open && users.length === 0) {
                  loadUsers();
                }
              }}
              loading={userLookupLoading}
              classNames={mobilePopupClassNames}
              getPopupContainer={() => document.body}
              options={users.map((user) => ({ value: user.id, label: `${user.username} (#${user.id})` }))}
              placeholder={t('pages.adminCoupons.selectTargetUsers')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CouponManagement;

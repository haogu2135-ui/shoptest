import { useNavigate } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Form, message, Space, Switch, Table, Tag, Typography } from 'antd';
import ShopInput, { ShopTextArea } from '../components/ShopInput';
import ShopPopconfirm from '../components/ShopPopconfirm';
import ShopSelect from '../components/ShopSelect';
import ShopMultiSelect from '../components/ShopMultiSelect';
import ShopInputNumber from '../components/ShopInputNumber';
import ShopModal from '../components/ShopModal';
import ShopRangePicker from '../components/ShopRangePicker';
import ShopConfirm from '../components/ShopConfirm';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, FireOutlined, GiftOutlined, PlusOutlined, SearchOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../api/admin';
import type { Coupon, CouponAdminSummary, PetBirthdayCouponConfig, User } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';
import { useDebounce } from '../hooks/useDebounce';
import PageError from '../components/PageError';
import { getApiErrorMessage } from '../utils/apiError';
import { reportNonBlockingError } from '../utils/nonBlockingError';
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
import { getCouponPayablePercent } from '../utils/couponCenter';
import './CouponManagement.css';

const { Title } = Typography;
const DEFAULT_COUPON_PAGE_SIZE = 10;
const validRangeStartInputId = 'coupon-management-valid-range-start';
const validRangeEndInputId = 'coupon-management-valid-range-end';
type FormValidationError = { errorFields: unknown[] };

const isFormValidationError = (error: unknown): error is FormValidationError => {
  if (!error || typeof error !== 'object') return false;
  return Array.isArray((error as { errorFields?: unknown }).errorFields);
};

const CouponManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponLoadError, setCouponLoadError] = useState<string | null>(null);
  const [couponSnapshotLoaded, setCouponSnapshotLoaded] = useState(false);
  const [birthdayCouponLoading, setBirthdayCouponLoading] = useState(false);
  const [birthdayConfigLoading, setBirthdayConfigLoading] = useState(true);
  const [birthdayConfigLoadError, setBirthdayConfigLoadError] = useState<string | null>(null);
  const [birthdayConfigLoaded, setBirthdayConfigLoaded] = useState(false);
  const [userLookupLoading, setUserLookupLoading] = useState(false);
  const [birthdayConfigSaving, setBirthdayConfigSaving] = useState(false);
  const [birthdayConfig, setBirthdayConfig] = useState<PetBirthdayCouponConfig | null>(null);
  const [couponSummary, setCouponSummary] = useState<CouponAdminSummary | null>(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantConfirmOpen, setGrantConfirmOpen] = useState(false);
  const [grantConfirmMeta, setGrantConfirmMeta] = useState<{ title: string; actionLabel: string; cancelLabel: string; userIds: number[] } | null>(null);
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword.trim(), 300);
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
  const mountedRef = useRef(true);
  const pageSizeRef = useRef(DEFAULT_COUPON_PAGE_SIZE);
  const userSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const couponType = Form.useWatch('couponType', form);
  const couponPaginationItemRender = useMemo(() => buildPaginationItemRender(
    `${t('common.previousPage')}: ${t('adminLayout.coupons')}`,
    `${t('common.nextPage')}: ${t('adminLayout.coupons')}`,
    `${t('common.previousPages')}: ${t('adminLayout.coupons')}`,
    `${t('common.nextPages')}: ${t('adminLayout.coupons')}`,
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
  const couponMutationDisabled = loading || Boolean(couponLoadError) || !couponSnapshotLoaded;
  const birthdayConfigActionDisabled = birthdayConfigLoading || Boolean(birthdayConfigLoadError) || !birthdayConfigLoaded;
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
    const payablePercent = getCouponPayablePercent(coupon);
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
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (userSearchTimerRef.current) {
        clearTimeout(userSearchTimerRef.current);
        userSearchTimerRef.current = null;
      }
    };
  }, []);

  const loadCoupons = useCallback(async (page = 1, size = pageSizeRef.current, isDisposed?: () => boolean) => {
    const canUpdate = () => mountedRef.current && !isDisposed?.();
    if (!canUpdate()) return;
    setLoading(true);
    try {
      const res = await adminApi.getCoupons({
        keyword: debouncedKeyword || undefined,
        status: statusFilter,
        scope: scopeFilter,
        page,
        size,
      });
      if (!canUpdate()) return;
      setCouponLoadError(null);
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
      setCouponSnapshotLoaded(true);
    } catch (error: unknown) {
      if (!canUpdate()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.adminCoupons.loadFailed'), language);
      setCouponLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      if (canUpdate()) {
        setLoading(false);
      }
    }
  }, [debouncedKeyword, language, scopeFilter, statusFilter, t]);

  const loadCouponSummary = useCallback(async (isDisposed?: () => boolean) => {
    const canUpdate = () => mountedRef.current && !isDisposed?.();
    if (!canUpdate()) return;
    try {
      const res = await adminApi.getCouponSummary({
        keyword: debouncedKeyword || undefined,
        status: statusFilter,
        scope: scopeFilter,
      });
      if (!canUpdate()) return;
      setCouponSummary(res.data);
    } catch (error) {
      reportNonBlockingError('CouponManagement.loadCouponSummary', error);
      if (canUpdate()) {
        setCouponSummary(null);
      }
    }
  }, [debouncedKeyword, scopeFilter, statusFilter]);

  const loadUsers = useCallback(async (search?: string, isDisposed?: () => boolean) => {
    const canUpdate = () => mountedRef.current && !isDisposed?.();
    if (!canUpdate()) return;
    setUserLookupLoading(true);
    try {
      const res = await adminApi.getUsersPage({ keyword: search?.trim() || undefined, page: 1, size: 20 });
      if (!canUpdate()) return;
      setUsers(res.data.items || []);
    } catch (error) {
      reportNonBlockingError('CouponManagement.loadUsers', error);
      if (canUpdate()) {
        setUsers([]);
      }
    } finally {
      if (canUpdate()) {
        setUserLookupLoading(false);
      }
    }
  }, []);

  const handleUserSearch = useCallback((value: string) => {
    if (userSearchTimerRef.current) {
      clearTimeout(userSearchTimerRef.current);
    }
    userSearchTimerRef.current = setTimeout(() => loadUsers(value), 300);
  }, [loadUsers]);

  const loadBirthdayConfig = useCallback(async (isDisposed?: () => boolean) => {
    const canUpdate = () => mountedRef.current && !isDisposed?.();
    if (!canUpdate()) return;
    setBirthdayConfigLoading(true);
    try {
      const res = await adminApi.getPetBirthdayCouponConfig();
      if (!canUpdate()) return;
      setBirthdayConfigLoadError(null);
      setBirthdayConfig(res.data);
      birthdayConfigForm.setFieldsValue(res.data);
      setBirthdayConfigLoaded(true);
    } catch (error: unknown) {
      if (!canUpdate()) return;
      const errorMessage = getApiErrorMessage(error, t('pages.adminCoupons.birthdayConfigLoadFailed'), language);
      setBirthdayConfigLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      if (canUpdate()) {
        setBirthdayConfigLoading(false);
      }
    }
  }, [birthdayConfigForm, language, t]);

  useEffect(() => {
    let disposed = false;
    const isDisposed = () => disposed;
    loadCoupons(1, pageSizeRef.current, isDisposed);
    loadCouponSummary(isDisposed);
    return () => {
      disposed = true;
    };
  }, [loadCouponSummary, loadCoupons]);

  useEffect(() => {
    let disposed = false;
    const isDisposed = () => disposed;
    loadUsers(undefined, isDisposed);
    loadBirthdayConfig(isDisposed);
    return () => {
      disposed = true;
    };
  }, [loadBirthdayConfig, loadUsers]);

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

  const openCreate = () => {
    if (!canWriteCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
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
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
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
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
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
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
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
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
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
    if (couponMutationDisabled) {
      message.warning(couponLoadError || (loading ? t('common.loading') : t('pages.adminCoupons.loadFailed')));
      return;
    }
    try {
      const values = await grantForm.validateFields();
      const selectedUserIds = (values.userIds as Array<string | number>)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0);
      setGrantConfirmMeta({
        title: t('pages.adminCoupons.grantConfirm', { name: getCouponLabel(grantCoupon), count: selectedUserIds.length }),
        actionLabel: `${t('pages.adminCoupons.grant')}: ${getCouponLabel(grantCoupon)} - ${selectedUserIds.length}`,
        cancelLabel: `${t('common.cancel')}: ${getCouponLabel(grantCoupon)}`,
        userIds: selectedUserIds,
      });
      setGrantConfirmOpen(true);
    } catch (error: unknown) {
      if (!isFormValidationError(error)) {
        message.error(getApiErrorMessage(error, t('pages.adminCoupons.grantFailed'), language));
      }
    }
  };

  const closeGrantConfirm = () => {
    if (grantSubmitting) return;
    setGrantConfirmOpen(false);
    setGrantConfirmMeta(null);
  };

  const confirmGrant = async () => {
    if (!grantCoupon || !grantConfirmMeta) return;
    setGrantSubmitting(true);
    try {
      const res = await adminApi.grantCoupon(grantCoupon.id, grantConfirmMeta.userIds, grantMaxUsers);
      message.success(t('pages.adminCoupons.granted', { count: res.data.granted }));
      setGrantConfirmOpen(false);
      setGrantConfirmMeta(null);
      setGrantVisible(false);
      setGrantCoupon(null);
      grantForm.resetFields();
      await Promise.all([loadCoupons(pageState.page, pageState.size), loadCouponSummary()]);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('pages.adminCoupons.grantFailed'), language));
    } finally {
      setGrantSubmitting(false);
    }
  };

  const runPetBirthdayCoupons = async () => {
    if (!canRunBirthdayCoupons) {
      message.error(t('adminLayout.noPermission'));
      return;
    }
    if (birthdayConfigActionDisabled) {
      message.warning(birthdayConfigLoadError || (birthdayConfigLoading ? t('common.loading') : t('pages.adminCoupons.birthdayConfigLoadFailed')));
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
    if (birthdayConfigActionDisabled) {
      message.warning(birthdayConfigLoadError || (birthdayConfigLoading ? t('common.loading') : t('pages.adminCoupons.birthdayConfigLoadFailed')));
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
      setBirthdayConfigLoadError(null);
      setBirthdayConfig(res.data);
      birthdayConfigForm.setFieldsValue(res.data);
      setBirthdayConfigLoaded(true);
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
            {canGrantCoupons ? <Button size="small" icon={<SendOutlined />} disabled={couponMutationDisabled} aria-label={grantActionLabel} title={grantActionLabel} onClick={() => openGrant(record)}>{t('pages.adminCoupons.grant')}</Button> : null}
            {canWriteCoupons ? <Button size="small" icon={<EditOutlined />} disabled={couponMutationDisabled} aria-label={editActionLabel} title={editActionLabel} onClick={() => openEdit(record)}>{t('common.edit')}</Button> : null}
            {canDeleteCoupons ? (
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={t('pages.adminCoupons.deleteConfirm')}
                onConfirm={() => deleteCoupon(record.id)}
                disabled={couponMutationDisabled}
                okButtonProps={{ 'aria-label': deleteActionLabel, title: deleteActionLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${couponName}`, title: `${t('common.cancel')}: ${couponName}` }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} disabled={couponMutationDisabled} aria-label={deleteActionLabel} title={deleteActionLabel}>{t('common.delete')}</Button>
              </ShopPopconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];
  const showInitialCouponLoading = loading && !couponSnapshotLoaded;
  const couponSnapshotUnavailable = Boolean(couponLoadError) && !couponSnapshotLoaded;
  const showInitialBirthdayConfigLoading = birthdayConfigLoading && !birthdayConfigLoaded;
  const birthdayConfigUnavailable = Boolean(birthdayConfigLoadError) && !birthdayConfigLoaded;
  const birthdayConfigStatusLabel = !birthdayConfigLoaded
    ? t('common.unknown')
    : birthdayConfig?.enabled
      ? t('pages.adminCoupons.birthdayEnabled')
      : t('pages.adminCoupons.birthdayDisabled');

  return (
    <div className="coupon-management-page">
      <div className="coupon-management-page__header">
        <Title level={3} style={{ margin: 0 }}><GiftOutlined /> {t('pages.adminCoupons.title')}</Title>
        <Space wrap className="coupon-management-page__actions">
          {canWriteCoupons ? <Button type="primary" icon={<PlusOutlined />} disabled={couponMutationDisabled} aria-label={createCouponLabel} title={createCouponLabel} onClick={openCreate}>{t('pages.adminCoupons.createCoupon')}</Button> : null}
        </Space>
      </div>

      {couponLoadError && couponSnapshotLoaded ? (
        <Alert
          className="coupon-management-page__alert"
          type="warning"
          showIcon
          message={couponLoadError}
          description={t('pages.adminCoupons.staleDataWarning')}
          action={(
            <Space wrap data-admin-coupons-stale-recovery="true">
              <Button size="small" type="primary" onClick={() => loadCoupons(pageState.page, pageState.size)} loading={loading}>
                {t('common.retry')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin')}>
                {t('pages.adminDashboard.title')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/orders')}>
                {t('pages.adminDashboard.orders')}
              </Button>
              <Button size="small" onClick={() => navigate('/admin/support')}>
                {t('adminLayout.support')}
              </Button>
            </Space>
          )}
        />
      ) : null}

      {couponLoadError && !couponSnapshotLoaded ? (
        <div className="coupon-management-page__error" data-admin-coupons-load-recovery="true">
          <PageError
            title={t('pages.adminCoupons.loadFailed')}
            description={couponLoadError}
            actions={[
              {
                key: 'retry',
                label: t('common.retry'),
                onClick: () => { void loadCoupons(pageState.page, pageState.size); },
                type: 'primary',
              },
              {
                key: 'dashboard',
                label: t('pages.adminDashboard.title'),
                onClick: () => navigate('/admin'),
                type: 'default',
              },
              {
                key: 'orders',
                label: t('pages.adminDashboard.orders'),
                onClick: () => navigate('/admin/orders'),
                type: 'default',
              },
              {
                key: 'support',
                label: t('adminLayout.support'),
                onClick: () => navigate('/admin/support'),
                type: 'default',
              },
            ]}
          />
        </div>
      ) : null}

      {showInitialCouponLoading ? (
        <Card
          className="coupon-management-page__loadingState"
          loading
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('common.loading')}
        />
      ) : null}

      {!showInitialCouponLoading && !couponSnapshotUnavailable ? (
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
      ) : null}

      <Card
        className="coupon-management-birthday"
        title={
          <Space>
            <GiftOutlined />
            <span>{t('pages.adminCoupons.birthdayConfigTitle')}</span>
            <Tag color={birthdayConfigLoaded && birthdayConfig?.enabled ? 'green' : 'default'}>
              {birthdayConfigStatusLabel}
            </Tag>
          </Space>
        }
        extra={
          <Space wrap>
            {canRunBirthdayCoupons ? (
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={t('pages.adminCoupons.runPetBirthdayCouponsConfirm')}
                onConfirm={runPetBirthdayCoupons}
                disabled={birthdayConfigActionDisabled}
                okButtonProps={{ 'aria-label': runBirthdayCouponsLabel, title: runBirthdayCouponsLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${birthdayConfigLabel}`, title: `${t('common.cancel')}: ${birthdayConfigLabel}` }}
              >
                <Button
                  icon={<GiftOutlined />}
                  loading={birthdayCouponLoading}
                  disabled={birthdayConfigActionDisabled}
                  aria-label={runBirthdayCouponsLabel}
                  title={runBirthdayCouponsLabel}
                >
                  {t('pages.adminCoupons.runPetBirthdayCoupons')}
                </Button>
              </ShopPopconfirm>
            ) : null}
            {canConfigureBirthdayCoupons ? (
              <ShopPopconfirm rootClassName="shop-mobile-popup-layer"
                title={saveBirthdayConfigLabel}
                description={birthdayConfigConfirmDescription}
                onConfirm={saveBirthdayConfig}
                disabled={birthdayConfigActionDisabled || birthdayConfigSaving}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ 'aria-label': saveBirthdayConfigLabel, title: saveBirthdayConfigLabel }}
                cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${saveBirthdayConfigLabel}`, title: `${t('common.cancel')}: ${saveBirthdayConfigLabel}` }}
              >
                <Button
                  type="primary"
                  loading={birthdayConfigSaving}
                  disabled={birthdayConfigActionDisabled}
                  aria-label={saveBirthdayConfigLabel}
                  title={saveBirthdayConfigLabel}
                >
                  {t('common.save')}
                </Button>
              </ShopPopconfirm>
            ) : null}
          </Space>
        }
        loading={showInitialBirthdayConfigLoading}
      >
        {birthdayConfigLoadError ? (
          <Alert
            className="coupon-management-page__alert"
            type="warning"
            showIcon
            message={birthdayConfigLoadError}
            description={birthdayConfigLoaded ? t('pages.adminCoupons.birthdayConfigStaleWarning') : undefined}
            action={(
              <Button size="small" onClick={() => loadBirthdayConfig()} loading={birthdayConfigLoading}>
                {t('common.retry')}
              </Button>
            )}
          />
        ) : null}

        {birthdayConfigUnavailable ? null : <Form form={birthdayConfigForm} layout="vertical" className="coupon-management-birthday__form">
          <div className="coupon-management-page__formRow">
            <Form.Item name="enabled" label={t('pages.adminCoupons.birthdayEnabledLabel')} valuePropName="checked">
              <Switch title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayEnabledLabel')}`} />
            </Form.Item>
            <Form.Item name="namePrefix" label={t('pages.adminCoupons.birthdayNamePrefix')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayNamePrefixRequired') }]}>
              <ShopInput aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayNamePrefix')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayNamePrefix')}`} />
            </Form.Item>
          </div>
          <div className="coupon-management-page__formRow">
            <Form.Item name="couponType" label={t('pages.adminCoupons.type')} rules={[{ required: true }]}>
              <ShopSelect
                ariaLabel={`${birthdayConfigLabel}: ${t('pages.adminCoupons.type')} ${birthdayCouponType ? formatCouponType(birthdayCouponType) : ''}`}
                title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.type')}`}
                onChange={() => birthdayConfigForm.validateFields(['reductionAmount', 'discountPercent', 'maxDiscountAmount']).catch(() => undefined)} popupClassName="shop-mobile-popup-layer"
                options={[
                  { value: 'FULL_REDUCTION', label: t('pages.coupons.fullReduction') },
                  { value: 'DISCOUNT', label: t('pages.coupons.discount') },
                ]}
              />
            </Form.Item>
            <Form.Item name="thresholdAmount" label={t('pages.adminCoupons.minimumSpend')} rules={[{ required: true, message: t('pages.adminCoupons.minimumSpendRequired') }]}>
              <ShopInputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.minimumSpend')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.minimumSpend')}`} />
            </Form.Item>
          </div>
          {birthdayCouponType === 'DISCOUNT' ? (
            <>
              <div className="coupon-management-page__formRow">
                <Form.Item name="discountPercent" label={t('pages.adminCoupons.discountPayablePercent')} rules={[{ required: true, message: t('pages.adminCoupons.discountPercentRequired') }]}>
                  <ShopInputNumber min={1} max={99} suffix="%" placeholder={t('pages.adminCoupons.discountPlaceholder')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} />
                </Form.Item>
                <Form.Item name="maxDiscountAmount" label={t('pages.adminCoupons.maxDiscountLabel')}>
                  <ShopInputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="validDays" label={t('pages.adminCoupons.birthdayValidDays')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayValidDaysRequired') }]}>
                  <ShopInputNumber min={1} max={365} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} />
                </Form.Item>
                <Form.Item name="maxBenefitsPerUser" label={t('pages.adminCoupons.birthdayMaxPerUser')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayMaxPerUserRequired') }]}>
                  <ShopInputNumber min={0} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="totalQuantityPerCoupon" label={t('pages.adminCoupons.birthdayQuantityPerCoupon')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <ShopInputNumber min={1} max={totalQuantityMax} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} />
                </Form.Item>
                <div />
              </div>
            </>
          ) : (
            <>
              <div className="coupon-management-page__formRow">
                <Form.Item name="reductionAmount" label={t('pages.adminCoupons.reductionAmount')} rules={[{ required: true, message: t('pages.adminCoupons.reductionAmountRequired') }]}>
                  <ShopInputNumber min={0.01} precision={2} prefix={t('common.currencySymbol')} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.reductionAmount')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.reductionAmount')}`} />
                </Form.Item>
                <Form.Item name="validDays" label={t('pages.adminCoupons.birthdayValidDays')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayValidDaysRequired') }]}>
                  <ShopInputNumber min={1} max={365} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayValidDays')}`} />
                </Form.Item>
              </div>
              <div className="coupon-management-page__formRow">
                <Form.Item name="maxBenefitsPerUser" label={t('pages.adminCoupons.birthdayMaxPerUser')} rules={[{ required: true, message: t('pages.adminCoupons.birthdayMaxPerUserRequired') }]}>
                  <ShopInputNumber min={0} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayMaxPerUser')}`} />
                </Form.Item>
                <Form.Item name="totalQuantityPerCoupon" label={t('pages.adminCoupons.birthdayQuantityPerCoupon')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <ShopInputNumber min={1} max={totalQuantityMax} aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.birthdayQuantityPerCoupon')}`} />
                </Form.Item>
              </div>
            </>
          )}
          <Form.Item name="description" label={t('pages.adminCoupons.description')} rules={[{ max: couponDescriptionMaxChars, message: t('pages.adminCoupons.descriptionMaxLength', { count: couponDescriptionMaxChars }) }]}>
            <ShopTextArea rows={2} maxLength={couponDescriptionMaxChars} showCount aria-label={`${birthdayConfigLabel}: ${t('pages.adminCoupons.description')}`} title={`${birthdayConfigLabel}: ${t('pages.adminCoupons.description')}`} />
          </Form.Item>
          <Typography.Text type="secondary">
            {t('pages.adminCoupons.birthdayConfigHint')}
          </Typography.Text>
        </Form>}
      </Card>

      {!showInitialCouponLoading && !couponSnapshotUnavailable ? <Card className="coupon-management-page__toolbar">
        <Space wrap>
          <ShopInput
            allowClear
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('common.search')}
            className="coupon-management-page__keywordInput"
            aria-label={couponSearchLabel}
            title={couponSearchLabel}
          />
          <ShopSelect
            allowClear
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || undefined)}
            placeholder={t('pages.adminCoupons.status')}
            className="coupon-management-page__filterSelect" popupClassName="shop-mobile-popup-layer"
            ariaLabel={couponStatusFilterLabel}
            title={couponStatusFilterLabel}
            options={[
              { value: 'ACTIVE', label: t('status.ACTIVE') },
              { value: 'INACTIVE', label: t('status.INACTIVE') },
            ]}
          />
          <ShopSelect
            allowClear
            value={scopeFilter}
            onChange={(value) => setScopeFilter(value || undefined)}
            placeholder={t('pages.adminCoupons.scope')}
            className="coupon-management-page__filterSelect" popupClassName="shop-mobile-popup-layer"
            ariaLabel={couponScopeFilterLabel}
            title={couponScopeFilterLabel}
            options={[
              { value: 'PUBLIC', label: t('pages.adminCoupons.publicClaim') },
              { value: 'ASSIGNED', label: t('pages.adminCoupons.adminAssigned') },
            ]}
          />
        </Space>
      </Card> : null}

      {!showInitialCouponLoading && !couponSnapshotUnavailable ? <Table
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
      /> : null}

      <ShopModal
        className="profile-mobile-safe-modal coupon-management-page__editorModal"
        title={editingCoupon ? t('pages.adminCoupons.editCoupon') : t('pages.adminCoupons.createCoupon')}
        open={modalVisible}
        onOk={submitCoupon}
        onClose={closeCouponModal}
        confirmLoading={couponSubmitting}
        width={720}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: couponMutationDisabled, 'aria-label': `${t('common.save')}: ${couponEditorLabel}`, title: `${t('common.save')}: ${couponEditorLabel}` }}
        cancelButtonProps={{ 'aria-label': `${t('common.cancel')}: ${couponEditorLabel}`, title: `${t('common.cancel')}: ${couponEditorLabel}` }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.adminCoupons.name')} rules={[{ required: true, message: t('pages.adminCoupons.nameRequired') }, { max: couponNameMaxChars, message: t('pages.adminCoupons.nameMaxLength', { count: couponNameMaxChars }) }]}>
            <ShopInput maxLength={couponNameMaxChars} showCount aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.name')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.name')}`} />
          </Form.Item>
          <Form.Item name="couponType" label={t('pages.adminCoupons.type')} rules={[{ required: true }]}>
            <ShopSelect
              ariaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.type')} ${couponType ? formatCouponType(couponType) : ''}`}
              title={`${couponEditorLabel}: ${t('pages.adminCoupons.type')}`}
              onChange={() => form.validateFields(['reductionAmount', 'discountPercent', 'maxDiscountAmount']).catch(() => undefined)} popupClassName="shop-mobile-popup-layer"
              options={[
                { value: 'FULL_REDUCTION', label: t('pages.coupons.fullReduction') },
                { value: 'DISCOUNT', label: t('pages.coupons.discount') },
              ]}
            />
          </Form.Item>
          <div className="coupon-management-page__formRow">
            <Form.Item name="thresholdAmount" label={t('pages.adminCoupons.minimumSpend')} rules={[{ required: true, message: t('pages.adminCoupons.minimumSpendRequired') }]}>
              <ShopInputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.minimumSpend')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.minimumSpend')}`} />
            </Form.Item>
            {couponType === 'DISCOUNT' ? (
              <Form.Item name="discountPercent" label={t('pages.adminCoupons.discountPayablePercent')} rules={[{ required: true, message: t('pages.adminCoupons.discountPercentRequired') }]}>
                <ShopInputNumber min={1} max={99} suffix="%" placeholder={t('pages.adminCoupons.discountPlaceholder')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.discountPayablePercent')}`} />
              </Form.Item>
            ) : (
              <Form.Item name="reductionAmount" label={t('pages.adminCoupons.reductionAmount')} rules={[{ required: true, message: t('pages.adminCoupons.reductionAmountRequired') }]}>
                <ShopInputNumber min={0.01} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.reductionAmount')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.reductionAmount')}`} />
              </Form.Item>
            )}
          </div>
          <div className="coupon-management-page__formRow">
            {couponType === 'DISCOUNT' ? (
              <>
                <Form.Item name="maxDiscountAmount" label={t('pages.adminCoupons.maxDiscountLabel')}>
                  <ShopInputNumber min={0} precision={2} prefix={t('common.currencySymbol')} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.maxDiscountLabel')}`} />
                </Form.Item>
                <Form.Item name="totalQuantity" label={t('pages.adminCoupons.issueQuantity')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <ShopInputNumber min={1} max={totalQuantityMax} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="totalQuantity" label={t('pages.adminCoupons.issueQuantity')} rules={[{ type: 'number', max: totalQuantityMax, message: t('pages.adminCoupons.issueQuantityMax', { count: totalQuantityMax }) }]}>
                  <ShopInputNumber min={1} max={totalQuantityMax} aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.issueQuantity')}`} />
                </Form.Item>
                <div />
              </>
            )}
          </div>
          <Form.Item name="scope" label={t('pages.adminCoupons.scope')}>
            <ShopSelect ariaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.scope')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.scope')}`} popupClassName="shop-mobile-popup-layer" options={[{ value: 'PUBLIC', label: t('pages.adminCoupons.publicClaim') }, { value: 'ASSIGNED', label: t('pages.adminCoupons.adminAssigned') }]} />
          </Form.Item>
          <Form.Item name="status" label={t('pages.adminCoupons.status')}>
            <ShopSelect ariaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.status')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.status')}`} popupClassName="shop-mobile-popup-layer" options={[{ value: 'ACTIVE', label: t('status.ACTIVE') }, { value: 'INACTIVE', label: t('status.INACTIVE') }]} />
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
                  <ShopRangePicker
                    showTime
                    startId={validRangeStartInputId}
                    endId={validRangeEndInputId}
                    className="coupon-management-page__rangePicker"
                    ariaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')}`}
                    startAriaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')} - ${t('common.start')}`}
                    endAriaLabel={`${couponEditorLabel}: ${t('pages.adminCoupons.validTime')} - ${t('common.end')}`}
                  />
                </>
              </Form.Item>
            </div>
          </Form.Item>
          <Form.Item name="description" label={t('pages.adminCoupons.description')} rules={[{ max: couponDescriptionMaxChars, message: t('pages.adminCoupons.descriptionMaxLength', { count: couponDescriptionMaxChars }) }]}>
            <ShopTextArea rows={3} maxLength={couponDescriptionMaxChars} showCount aria-label={`${couponEditorLabel}: ${t('pages.adminCoupons.description')}`} title={`${couponEditorLabel}: ${t('pages.adminCoupons.description')}`} />
          </Form.Item>
        </Form>
      </ShopModal>

      <ShopModal
        className="profile-mobile-safe-modal coupon-management-page__grantModal"
        title={grantCoupon ? t('pages.adminCoupons.grantCouponWithName', { name: getCouponLabel(grantCoupon) }) : t('pages.adminCoupons.grantCoupon')}
        open={grantVisible}
        onOk={submitGrant}
        onClose={closeGrantModal}
        confirmLoading={grantSubmitting}
        okText={t('pages.adminCoupons.grant')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: couponMutationDisabled, 'aria-label': grantCouponLabel, title: grantCouponLabel }}
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
                validator: (_, value: string[] = []) => {
                  if (!value?.length || value.length <= grantMaxUsers) return Promise.resolve();
                  return Promise.reject(new Error(t('pages.adminCoupons.grantLimitExceeded', { count: grantMaxUsers })));
                },
              },
            ]}
          >
            <ShopMultiSelect
              mode="multiple"
              showSearch
              filterOption={false}
              maxCount={grantMaxUsers}
              ariaLabel={`${grantCouponLabel}: ${t('pages.adminCoupons.users')}`}
              title={`${grantCouponLabel}: ${t('pages.adminCoupons.users')}`}
              onSearch={handleUserSearch}
              onOpenChange={(open) => {
                if (open && users.length === 0) {
                  loadUsers();
                }
              }}
              loading={userLookupLoading}
              popupClassName="shop-mobile-popup-layer"
              options={users.map((user) => ({ value: String(user.id), label: `${user.username} (#${user.id})` }))}
              placeholder={t('pages.adminCoupons.selectTargetUsers')}
            />
          </Form.Item>
        </Form>
      </ShopModal>
      <ShopConfirm
        open={grantConfirmOpen}
        title={grantConfirmMeta?.title || t('pages.adminCoupons.grant')}
        okText={t('pages.adminCoupons.grant')}
        cancelText={t('common.cancel')}
        confirmLoading={grantSubmitting}
        okButtonProps={{
          'aria-label': grantConfirmMeta?.actionLabel,
          title: grantConfirmMeta?.actionLabel,
        }}
        cancelButtonProps={{
          'aria-label': grantConfirmMeta?.cancelLabel || t('common.cancel'),
          title: grantConfirmMeta?.cancelLabel || t('common.cancel'),
        }}
        className="profile-mobile-safe-modal coupon-management-page__grantConfirmModal"
        closeLabel={t('common.close', { defaultValue: 'Close' })}
        onOk={confirmGrant}
        onCancel={closeGrantConfirm}
      />
    </div>
  );
};

export default CouponManagement;

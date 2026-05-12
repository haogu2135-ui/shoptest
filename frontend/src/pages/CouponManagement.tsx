import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApi } from '../api';
import type { Coupon, User } from '../types';
import { useLanguage } from '../i18n';
import { useMarket } from '../hooks/useMarket';

const { Title } = Typography;

const CouponManagement: React.FC = () => {
  const { t } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [birthdayCouponLoading, setBirthdayCouponLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [grantVisible, setGrantVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [grantCoupon, setGrantCoupon] = useState<Coupon | null>(null);
  const [form] = Form.useForm();
  const [grantForm] = Form.useForm();
  const couponType = Form.useWatch('couponType', form);
  const { formatMoney } = useMarket();

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getCoupons();
      setCoupons(res.data);
    } catch {
      message.error(t('pages.adminCoupons.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadUsers = async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadCoupons();
    loadUsers();
  }, [loadCoupons]);

  const openCreate = () => {
    setEditingCoupon(null);
    form.resetFields();
    form.setFieldsValue({ couponType: 'FULL_REDUCTION', scope: 'PUBLIC', status: 'ACTIVE', thresholdAmount: 0, reductionAmount: 0 });
    setModalVisible(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    form.setFieldsValue({
      ...coupon,
      validRange: coupon.startAt || coupon.endAt ? [coupon.startAt ? dayjs(coupon.startAt) : null, coupon.endAt ? dayjs(coupon.endAt) : null] : undefined,
    });
    setModalVisible(true);
  };

  const submitCoupon = async () => {
    try {
      const values = await form.validateFields();
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
      await loadCoupons();
    } catch (error: any) {
      if (error?.response?.data?.error) {
        message.error(error.response.data.error);
      }
    }
  };

  const deleteCoupon = async (id: number) => {
    try {
      await adminApi.deleteCoupon(id);
      message.success(t('pages.adminCoupons.deleted'));
      await loadCoupons();
    } catch {
      message.error(t('pages.adminCoupons.deleteFailed'));
    }
  };

  const openGrant = (coupon: Coupon) => {
    setGrantCoupon(coupon);
    grantForm.resetFields();
    setGrantVisible(true);
  };

  const submitGrant = async () => {
    if (!grantCoupon) return;
    try {
      const values = await grantForm.validateFields();
      const res = await adminApi.grantCoupon(grantCoupon.id, values.userIds);
      message.success(t('pages.adminCoupons.granted', { count: res.data.granted }));
      setGrantVisible(false);
      await loadCoupons();
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.adminCoupons.grantFailed'));
    }
  };

  const runPetBirthdayCoupons = async () => {
    setBirthdayCouponLoading(true);
    try {
      const res = await adminApi.runPetBirthdayCoupons();
      message.success(t('pages.adminCoupons.petBirthdayGranted', { count: res.data.granted }));
      await loadCoupons();
    } catch (error: any) {
      message.error(error?.response?.data?.error || t('pages.adminCoupons.petBirthdayFailed'));
    } finally {
      setBirthdayCouponLoading(false);
    }
  };

  const columns = [
    { title: t('pages.adminCoupons.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('pages.adminCoupons.type'),
      dataIndex: 'couponType',
      key: 'couponType',
      render: (type: string) => <Tag color={type === 'FULL_REDUCTION' ? 'volcano' : 'blue'}>{type === 'FULL_REDUCTION' ? t('pages.coupons.fullReduction') : t('pages.coupons.discount')}</Tag>,
    },
    {
      title: t('pages.adminCoupons.rule'),
      key: 'rule',
      render: (_: any, record: Coupon) => record.couponType === 'FULL_REDUCTION'
        ? `${formatMoney(record.thresholdAmount)} - ${formatMoney(record.reductionAmount)}`
        : t('pages.coupons.discountPayable', { percent: record.discountPercent || 100 }) + (record.maxDiscountAmount ? `, ${t('pages.coupons.maxDiscount', { amount: formatMoney(record.maxDiscountAmount) })}` : ''),
    },
    { title: t('pages.adminCoupons.scope'), dataIndex: 'scope', key: 'scope', render: (scope: string) => <Tag>{scope === 'PUBLIC' ? t('pages.adminCoupons.publicClaim') : t('pages.adminCoupons.adminAssigned')}</Tag> },
    { title: t('pages.adminCoupons.status'), dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{t(`status.${status}`)}</Tag> },
    {
      title: t('pages.adminCoupons.issued'),
      key: 'issued',
      render: (_: any, record: Coupon) => `${record.claimedQuantity || 0}${record.totalQuantity ? ` / ${record.totalQuantity}` : ''}`,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, record: Coupon) => (
        <Space>
          <Button size="small" icon={<SendOutlined />} onClick={() => openGrant(record)}>{t('pages.adminCoupons.grant')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>{t('common.edit')}</Button>
          <Popconfirm title={t('pages.adminCoupons.deleteConfirm')} onConfirm={() => deleteCoupon(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 24px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}><GiftOutlined /> {t('pages.adminCoupons.title')}</Title>
        <Space>
          <Button icon={<GiftOutlined />} loading={birthdayCouponLoading} onClick={runPetBirthdayCoupons}>
            {t('pages.adminCoupons.runPetBirthdayCoupons')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('pages.adminCoupons.createCoupon')}</Button>
        </Space>
      </Space>

      <Table columns={columns} dataSource={coupons} rowKey="id" loading={loading} bordered />

      <Modal title={editingCoupon ? t('pages.adminCoupons.editCoupon') : t('pages.adminCoupons.createCoupon')} open={modalVisible} onOk={submitCoupon} onCancel={() => setModalVisible(false)} width={720}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('pages.adminCoupons.name')} rules={[{ required: true, message: t('pages.adminCoupons.nameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="couponType" label={t('pages.adminCoupons.type')} rules={[{ required: true }]}>
            <Select
              onChange={() => form.validateFields(['reductionAmount', 'discountPercent', 'maxDiscountAmount']).catch(() => undefined)}
              options={[
                { value: 'FULL_REDUCTION', label: t('pages.coupons.fullReduction') },
                { value: 'DISCOUNT', label: t('pages.coupons.discount') },
              ]}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="thresholdAmount" label={t('pages.adminCoupons.minimumSpend')} style={{ flex: 1 }} rules={[{ required: true, message: t('pages.adminCoupons.minimumSpendRequired') }]}>
              <InputNumber min={0} precision={2} style={{ width: 180 }} prefix={t('common.currencySymbol')} />
            </Form.Item>
            {couponType === 'DISCOUNT' ? (
              <Form.Item name="discountPercent" label={t('pages.adminCoupons.discountPayablePercent')} style={{ flex: 1 }} rules={[{ required: true, message: t('pages.adminCoupons.discountPercentRequired') }]}>
                <InputNumber min={1} max={99} style={{ width: 180 }} suffix="%" placeholder={t('pages.adminCoupons.discountPlaceholder')} />
              </Form.Item>
            ) : (
              <Form.Item name="reductionAmount" label={t('pages.adminCoupons.reductionAmount')} style={{ flex: 1 }} rules={[{ required: true, message: t('pages.adminCoupons.reductionAmountRequired') }]}>
                <InputNumber min={0.01} precision={2} style={{ width: 180 }} prefix={t('common.currencySymbol')} />
              </Form.Item>
            )}
          </Space>
          <Space style={{ width: '100%' }} size="large">
            {couponType === 'DISCOUNT' ? (
              <Form.Item name="maxDiscountAmount" label={t('pages.adminCoupons.maxDiscountLabel')} style={{ flex: 1 }}>
                <InputNumber min={0} precision={2} style={{ width: 180 }} prefix={t('common.currencySymbol')} />
              </Form.Item>
            ) : null}
            <Form.Item name="totalQuantity" label={t('pages.adminCoupons.issueQuantity')} style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: 180 }} />
            </Form.Item>
          </Space>
          <Form.Item name="scope" label={t('pages.adminCoupons.scope')}>
            <Select options={[{ value: 'PUBLIC', label: t('pages.adminCoupons.publicClaim') }, { value: 'ASSIGNED', label: t('pages.adminCoupons.adminAssigned') }]} />
          </Form.Item>
          <Form.Item name="status" label={t('pages.adminCoupons.status')}>
            <Select options={[{ value: 'ACTIVE', label: t('status.ACTIVE') }, { value: 'INACTIVE', label: t('status.INACTIVE') }]} />
          </Form.Item>
          <Form.Item name="validRange" label={t('pages.adminCoupons.validTime')}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label={t('pages.adminCoupons.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={grantCoupon ? t('pages.adminCoupons.grantCouponWithName', { name: grantCoupon.name }) : t('pages.adminCoupons.grantCoupon')} open={grantVisible} onOk={submitGrant} onCancel={() => setGrantVisible(false)}>
        <Form form={grantForm} layout="vertical">
          <Form.Item name="userIds" label={t('pages.adminCoupons.users')} rules={[{ required: true, message: t('pages.adminCoupons.selectUsers') }]}>
            <Select
              mode="multiple"
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

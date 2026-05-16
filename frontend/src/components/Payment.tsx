import React, { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Radio, Space, Tag, Typography, message } from 'antd';
import { SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, fallbackPaymentChannels, PaymentMethod } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { navigateToSafeUrl } from '../utils/safeUrl';
import type { PaymentChannel } from '../types';
import './Payment.css';

const { Text, Title } = Typography;
const getDefaultPaymentMethod = (channels: PaymentChannel[]) =>
    channels.find((channel) => channel.recommended)?.code || channels[0]?.code || 'STRIPE';

interface PaymentProps {
    amount: number;
    orderId: number;
    onSuccess: () => void;
    onCancel: () => void;
}

export const Payment: React.FC<PaymentProps> = ({
    amount,
    orderId,
    onSuccess,
    onCancel,
}) => {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => getDefaultPaymentMethod(fallbackPaymentChannels));
    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>(fallbackPaymentChannels);
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();
    const { formatMoney } = useMarket();
    const paymentOptions = useMemo(() => createPaymentMethodOptions(t, paymentChannels), [paymentChannels, t]);
    const selectedChannel = useMemo(
        () => paymentChannels.find((channel) => channel.code === paymentMethod),
        [paymentChannels, paymentMethod],
    );
    const activeMarkets = useMemo(() => Array.from(new Set(paymentChannels
        .map((channel) => String(channel.market || '').toUpperCase())
        .filter(Boolean))), [paymentChannels]);
    const formattedAmount = formatMoney(amount);

    useEffect(() => {
        paymentApi.getChannels()
            .then((res) => {
                const channels = res.data.length > 0 ? res.data : fallbackPaymentChannels;
                setPaymentChannels(channels);
                setPaymentMethod(getDefaultPaymentMethod(channels));
            })
            .catch(() => {
                setPaymentChannels(fallbackPaymentChannels);
                setPaymentMethod(getDefaultPaymentMethod(fallbackPaymentChannels));
            });
    }, []);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const safePaymentMethod = paymentChannels.some((channel) => channel.code === paymentMethod)
                ? paymentMethod
                : getDefaultPaymentMethod(paymentChannels);
            if (safePaymentMethod !== paymentMethod) {
                setPaymentMethod(safePaymentMethod);
            }
            const response = await paymentApi.create(orderId, safePaymentMethod);
            const payment = response.data;
            if (payment.paymentUrl) {
                if (!navigateToSafeUrl(payment.paymentUrl)) {
                    message.error(t('pages.payment.failed'));
                    return;
                }
            }
            onSuccess();
        } catch (error: any) {
            message.error(error?.response?.data?.error || t('pages.payment.createFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={t('pages.payment.title')}
            open={true}
            onCancel={onCancel}
            footer={null}
            className="payment-modal"
        >
            <Space direction="vertical" className="payment-modal__content">
                <div className="payment-modal__summary">
                    <Text className="payment-modal__eyebrow">{t('pages.payment.secureEyebrow')}</Text>
                    <Title level={3}>{t('pages.payment.amount', { amount: formattedAmount })}</Title>
                    <Text type="secondary">{t('pages.payment.secureSubtitle')}</Text>
                    <div className="payment-modal__badges">
                        <Tag icon={<SafetyCertificateOutlined />} color="green">{t('pages.payment.encrypted')}</Tag>
                        <Tag icon={<ThunderboltOutlined />} color="orange">{t('pages.payment.localMethods')}</Tag>
                        {activeMarkets.slice(0, 3).map((market) => (
                            <Tag key={market}>{market}</Tag>
                        ))}
                    </div>
                </div>
                <Radio.Group
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: '100%' }}
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {paymentOptions.map((option) => (
                            <Radio.Button key={option.value} value={option.value} className="payment-modal__method">
                                <Space>{option.label}</Space>
                            </Radio.Button>
                        ))}
                    </Space>
                </Radio.Group>
                {selectedChannel ? (
                    <div className="payment-modal__channelNote">
                        <Text strong>{selectedChannel.displayName}</Text>
                        <Text type="secondary">
                            {selectedChannel.descriptionKey ? t(selectedChannel.descriptionKey) : t('pages.payment.channelFallback')}
                        </Text>
                    </div>
                ) : null}
                <Button
                    type="primary"
                    block
                    onClick={handlePayment}
                    loading={loading}
                    className="payment-modal__confirm"
                >
                    {t('pages.payment.confirm')}
                </Button>
            </Space>
        </Modal>
    );
}; 

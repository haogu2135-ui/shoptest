import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Modal, Radio, Space, Tag, Typography, message } from 'antd';
import { SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, PaymentMethod, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { navigateToSafeUrl } from '../utils/safeUrl';
import { getApiErrorMessage } from '../utils/apiError';
import type { PaymentChannel } from '../types';
import './Payment.css';
import '../styles/mobile-page-contrast.css';

const { Text, Title } = Typography;
const getDefaultPaymentMethod = (channels: PaymentChannel[]) =>
    channels.find((channel) => channel.recommended)?.code || channels[0]?.code || '';

interface PaymentProps {
    amount: number;
    orderId: number;
    orderNo?: string;
    guestEmail?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const Payment: React.FC<PaymentProps> = ({
    amount,
    orderId,
    orderNo,
    guestEmail,
    onSuccess,
    onCancel,
}) => {
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
    const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>([]);
    const [loading, setLoading] = useState(false);
    const { t, language } = useLanguage();
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
    const paymentTargetLabel = orderNo
        ? `${t('pages.paymentInstructions.orderNo')}: ${orderNo}`
        : `${t('pages.adminOrders.orderLabel')} #${orderId}`;
    const paymentContextLabel = `${paymentTargetLabel} · ${formattedAmount}`;
    const paymentMethodGroupLabel = `${t('pages.checkout.paymentMethod')}: ${paymentContextLabel}`;
    const paymentOptionLabel = (method: PaymentMethod) => {
        const channel = paymentChannels.find((item) => item.code === method);
        if (channel?.labelKey) return t(channel.labelKey);
        return channel?.displayName || paymentMethodLabel(method, t);
    };
    const selectedPaymentLabel = paymentMethod ? paymentOptionLabel(paymentMethod) : t('pages.checkout.paymentRequired');
    const confirmPaymentLabel = `${t('pages.payment.confirm')}: ${paymentContextLabel} · ${selectedPaymentLabel}`;

    useEffect(() => {
        let disposed = false;
        paymentApi.getChannels()
            .then((res) => {
                if (disposed) return;
                const channels = res.data;
                setPaymentChannels(channels);
                setPaymentMethod(getDefaultPaymentMethod(channels));
            })
            .catch(() => {
                if (disposed) return;
                setPaymentChannels([]);
                setPaymentMethod('');
            });
        return () => {
            disposed = true;
        };
    }, []);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const safePaymentMethod = paymentChannels.some((channel) => channel.code === paymentMethod)
                ? paymentMethod
                : getDefaultPaymentMethod(paymentChannels);
            if (!safePaymentMethod) {
                message.error(t('pages.checkout.paymentUnavailable'));
                return;
            }
            if (safePaymentMethod !== paymentMethod) {
                setPaymentMethod(safePaymentMethod);
            }
            const response = await paymentApi.create(orderId, safePaymentMethod, guestEmail, orderNo);
            const payment = response.data;
            if (payment.paymentUrl) {
                if (!navigateToSafeUrl(payment.paymentUrl)) {
                    message.error(t('pages.payment.failed'));
                    return;
                }
                message.success(t('pages.checkout.paymentReady'));
                return;
            }
            onSuccess();
        } catch (error: unknown) {
            message.error(getApiErrorMessage(error, t('pages.payment.createFailed'), language));
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
            className="profile-mobile-safe-modal payment-modal"
        >
            <Space direction="vertical" className="payment-modal__content">
                <div className="payment-modal__summary">
                    <Text className="payment-modal__eyebrow">{t('pages.payment.secureEyebrow')}</Text>
                    <Title level={3} className="commerce-money">{t('pages.payment.amount', { amount: formattedAmount })}</Title>
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
                    className="payment-modal__methodGroup"
                    aria-label={paymentMethodGroupLabel}
                >
                    <Space direction="vertical" className="payment-modal__methodList">
                        {paymentOptions.length === 0 ? (
                            <Alert type="warning" showIcon message={t('pages.checkout.paymentUnavailable')} description={t('pages.checkout.paymentUnavailableDescription')} />
                        ) : null}
                        {paymentOptions.map((option) => {
                            const optionLabel = paymentOptionLabel(option.value);
                            const optionActionLabel = `${t('pages.checkout.paymentMethod')}: ${optionLabel} · ${paymentContextLabel}`;
                            return (
                                <Radio.Button
                                    key={option.value}
                                    value={option.value}
                                    className="payment-modal__method"
                                    aria-label={optionActionLabel}
                                    title={optionActionLabel}
                                >
                                    <Space>{option.label}</Space>
                                </Radio.Button>
                            );
                        })}
                    </Space>
                </Radio.Group>
                {selectedChannel ? (
                    <div className="payment-modal__channelNote" role="status" aria-label={`${t('pages.checkout.paymentConfidenceTitle')}: ${selectedPaymentLabel}`}>
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
                    disabled={paymentOptions.length === 0}
                    className="payment-modal__confirm"
                    aria-label={confirmPaymentLabel}
                    title={confirmPaymentLabel}
                >
                    {t('pages.payment.confirm')}
                </Button>
            </Space>
        </Modal>
    );
}; 

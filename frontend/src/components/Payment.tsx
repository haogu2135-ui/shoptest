import React, { useState } from 'react';
import { Button, Modal, Radio, Space, message } from 'antd';
import { paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, PaymentMethod } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';

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
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('VISA');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();
    const { formatMoney } = useMarket();
    const paymentOptions = createPaymentMethodOptions(t);
    const formattedAmount = formatMoney(amount);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const response = await paymentApi.create(orderId, paymentMethod);
            const payment = response.data;
            if (payment.paymentUrl) {
                window.location.href = payment.paymentUrl;
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
        >
            <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2>{t('pages.payment.amount', { amount: formattedAmount })}</h2>
                </div>
                <Radio.Group
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: '100%' }}
                >
                    <Space direction="vertical" style={{ width: '100%' }}>
                        {paymentOptions.map((option) => (
                            <Radio.Button key={option.value} value={option.value} style={{ width: '100%', height: 40 }}>
                                <Space>{option.label}</Space>
                            </Radio.Button>
                        ))}
                    </Space>
                </Radio.Group>
                <Button
                    type="primary"
                    block
                    onClick={handlePayment}
                    loading={loading}
                    style={{ marginTop: 24 }}
                >
                    {t('pages.payment.confirm')}
                </Button>
            </Space>
        </Modal>
    );
}; 

import React from 'react';
import { AlipayOutlined, AppleOutlined, CreditCardOutlined, GoogleOutlined, WechatOutlined, WalletOutlined } from '@ant-design/icons';

export type PaymentMethod = 'STRIPE' | 'SHOP_PAY' | 'PAYPAL' | 'APPLE_PAY' | 'GOOGLE_PAY' | 'VISA' | 'MX_LOCAL_CARD' | 'SPEI' | 'OXXO' | 'ALIPAY' | 'WECHAT';

export interface PaymentMethodOption {
    value: PaymentMethod;
    label: React.ReactNode;
}

export const paymentMethodOrder: PaymentMethod[] = ['STRIPE', 'SHOP_PAY', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'VISA', 'MX_LOCAL_CARD', 'SPEI', 'OXXO', 'ALIPAY', 'WECHAT'];

export const createPaymentMethodOptions = (t: (key: string) => string): PaymentMethodOption[] => ([
    { value: 'STRIPE', label: <span><CreditCardOutlined /> Stripe</span> },
    { value: 'SHOP_PAY', label: <span><WalletOutlined /> Shop Pay</span> },
    { value: 'PAYPAL', label: <span><WalletOutlined /> PayPal</span> },
    { value: 'APPLE_PAY', label: <span><AppleOutlined /> Apple Pay</span> },
    { value: 'GOOGLE_PAY', label: <span><GoogleOutlined /> Google Pay</span> },
    { value: 'VISA', label: <span><CreditCardOutlined /> VISA</span> },
    { value: 'MX_LOCAL_CARD', label: <span><CreditCardOutlined /> {t('pages.checkout.localCard')}</span> },
    { value: 'SPEI', label: <span><WalletOutlined /> SPEI</span> },
    { value: 'OXXO', label: <span><WalletOutlined /> OXXO Pay</span> },
    { value: 'ALIPAY', label: <span><AlipayOutlined /> {t('pages.checkout.alipay')}</span> },
    { value: 'WECHAT', label: <span><WechatOutlined /> {t('pages.checkout.wechat')}</span> },
]);

export const paymentMethodLabel = (method: string, t: (key: string) => string) => {
    switch (method) {
        case 'STRIPE':
            return 'Stripe';
        case 'VISA':
            return 'VISA';
        case 'SHOP_PAY':
            return 'Shop Pay';
        case 'PAYPAL':
            return 'PayPal';
        case 'APPLE_PAY':
            return 'Apple Pay';
        case 'GOOGLE_PAY':
            return 'Google Pay';
        case 'MX_LOCAL_CARD':
            return t('pages.checkout.localCard');
        case 'SPEI':
            return 'SPEI';
        case 'OXXO':
            return 'OXXO Pay';
        case 'ALIPAY':
            return t('pages.checkout.alipay');
        case 'WECHAT':
            return t('pages.checkout.wechat');
        default:
            return method || '-';
    }
};

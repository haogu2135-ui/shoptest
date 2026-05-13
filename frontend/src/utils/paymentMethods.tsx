import React from 'react';
import { AlipayOutlined, AppleOutlined, CreditCardOutlined, GoogleOutlined, WechatOutlined, WalletOutlined } from '@ant-design/icons';
import type { PaymentChannel } from '../types';

export type PaymentMethod = string;

export interface PaymentMethodOption {
    value: PaymentMethod;
    label: React.ReactNode;
}

export interface PaymentMethodDetail {
    value: PaymentMethod;
    title: string;
    descriptionKey: string;
    badgeKey: string;
    market?: string;
}

export const paymentMethodOrder: PaymentMethod[] = ['STRIPE', 'MERCADO_PAGO', 'OXXO', 'SPEI', 'CODI', 'MX_LOCAL_CARD', 'ALIPAY', 'WECHAT_PAY', 'UNIONPAY', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'VISA', 'SHOP_PAY'];

export const paymentSimulationEnabledFallback = process.env.REACT_APP_PAYMENT_SIMULATION_ENABLED === 'true';

export const mexicoPaymentMethodDetails: PaymentMethodDetail[] = [
    { value: 'STRIPE', title: 'Stripe / Tarjeta', descriptionKey: 'pages.checkout.paymentStripeDesc', badgeKey: 'pages.checkout.paymentInstant' },
    { value: 'MERCADO_PAGO', title: 'Mercado Pago', descriptionKey: 'pages.checkout.paymentMercadoPagoDesc', badgeKey: 'pages.checkout.paymentWallet' },
    { value: 'OXXO', title: 'OXXO Pay', descriptionKey: 'pages.checkout.paymentOxxoDesc', badgeKey: 'pages.checkout.paymentCash' },
    { value: 'SPEI', title: 'SPEI', descriptionKey: 'pages.checkout.paymentSpeiDesc', badgeKey: 'pages.checkout.paymentBank' },
    { value: 'CODI', title: 'CoDi', descriptionKey: 'pages.checkout.paymentCodiDesc', badgeKey: 'pages.checkout.paymentInstant' },
    { value: 'MX_LOCAL_CARD', title: 'Tarjeta local', descriptionKey: 'pages.checkout.paymentLocalCardDesc', badgeKey: 'pages.checkout.paymentInstant' },
];

export const fallbackPaymentChannels: PaymentChannel[] = [
    { code: 'STRIPE', displayName: 'Stripe / Card', descriptionKey: 'pages.checkout.paymentStripeDesc', market: 'GLOBAL', currency: 'MXN', badgeKey: 'pages.checkout.paymentInstant', sortOrder: 10 },
    { code: 'MERCADO_PAGO', displayName: 'Mercado Pago', descriptionKey: 'pages.checkout.paymentMercadoPagoDesc', market: 'MX', currency: 'MXN', badgeKey: 'pages.checkout.paymentWallet', sortOrder: 20 },
    { code: 'OXXO', displayName: 'OXXO Pay', descriptionKey: 'pages.checkout.paymentOxxoDesc', market: 'MX', currency: 'MXN', badgeKey: 'pages.checkout.paymentCash', sortOrder: 30 },
    { code: 'SPEI', displayName: 'SPEI', descriptionKey: 'pages.checkout.paymentSpeiDesc', market: 'MX', currency: 'MXN', badgeKey: 'pages.checkout.paymentBank', sortOrder: 40 },
    { code: 'CODI', displayName: 'CoDi', descriptionKey: 'pages.checkout.paymentCodiDesc', market: 'MX', currency: 'MXN', badgeKey: 'pages.checkout.paymentInstant', sortOrder: 50 },
    { code: 'MX_LOCAL_CARD', displayName: 'Tarjeta local', descriptionKey: 'pages.checkout.paymentLocalCardDesc', market: 'MX', currency: 'MXN', badgeKey: 'pages.checkout.paymentInstant', sortOrder: 60 },
    { code: 'ALIPAY', displayName: 'Alipay', descriptionKey: 'pages.checkout.paymentAlipayDesc', market: 'CN', currency: 'CNY', sortOrder: 70 },
    { code: 'WECHAT_PAY', displayName: 'WeChat Pay', descriptionKey: 'pages.checkout.paymentWechatDesc', market: 'CN', currency: 'CNY', sortOrder: 80 },
    { code: 'UNIONPAY', displayName: 'UnionPay', descriptionKey: 'pages.checkout.paymentUnionPayDesc', market: 'CN', currency: 'CNY', sortOrder: 90 },
];

const iconForPaymentMethod = (method: string) => {
    switch (method) {
        case 'ALIPAY':
            return <AlipayOutlined />;
        case 'WECHAT':
        case 'WECHAT_PAY':
            return <WechatOutlined />;
        case 'APPLE_PAY':
            return <AppleOutlined />;
        case 'GOOGLE_PAY':
            return <GoogleOutlined />;
        case 'STRIPE':
        case 'VISA':
        case 'MX_LOCAL_CARD':
        case 'UNIONPAY':
            return <CreditCardOutlined />;
        default:
            return <WalletOutlined />;
    }
};

export const createPaymentMethodOptions = (t: (key: string) => string, channels: PaymentChannel[] = fallbackPaymentChannels): PaymentMethodOption[] =>
    [...channels]
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
        .map((channel) => ({
            value: channel.code,
            label: <span>{iconForPaymentMethod(channel.code)} {channel.labelKey ? t(channel.labelKey) : channel.displayName}</span>,
        }));

export const createPaymentMethodDetails = (channels: PaymentChannel[]): PaymentMethodDetail[] =>
    channels
        .filter((channel) => ['MX', 'CN'].includes(String(channel.market || '').toUpperCase()))
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
        .map((channel) => ({
            value: channel.code,
            title: channel.displayName,
            descriptionKey: channel.descriptionKey || 'pages.checkout.paymentGenericDesc',
            badgeKey: channel.badgeKey || (String(channel.market).toUpperCase() === 'CN' ? 'pages.checkout.paymentChina' : 'pages.checkout.paymentMexico'),
            market: channel.market,
        }));

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
        case 'MERCADO_PAGO':
            return 'Mercado Pago';
        case 'CODI':
            return 'CoDi';
        case 'SPEI':
            return 'SPEI';
        case 'OXXO':
            return 'OXXO Pay';
        case 'ALIPAY':
            return t('pages.checkout.alipay');
        case 'WECHAT':
        case 'WECHAT_PAY':
            return t('pages.checkout.wechat');
        case 'UNIONPAY':
            return 'UnionPay';
        default:
            return method || '-';
    }
};

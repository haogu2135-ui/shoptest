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

const normalizePaymentMarket = (market?: string) => {
    const normalized = String(market || 'GLOBAL').trim().toUpperCase();
    return ['MX', 'CN', 'GLOBAL'].includes(normalized) ? normalized : 'GLOBAL';
};

export const paymentMethodOrder: PaymentMethod[] = ['STRIPE', 'MERCADO_PAGO', 'OXXO', 'SPEI', 'CODI', 'MX_LOCAL_CARD', 'ALIPAY', 'WECHAT_PAY', 'UNIONPAY', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'VISA', 'SHOP_PAY'];

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

export const createPaymentMethodOptions = (t: (key: string) => string, channels: PaymentChannel[] = []): PaymentMethodOption[] =>
    [...channels]
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
        .map((channel) => ({
            value: channel.code,
            label: <span>{iconForPaymentMethod(channel.code)} {channel.labelKey ? t(channel.labelKey) : channel.displayName}</span>,
        }));

export const createPaymentMethodDetails = (channels: PaymentChannel[]): PaymentMethodDetail[] =>
    channels
        .filter((channel) => ['MX', 'CN', 'GLOBAL'].includes(normalizePaymentMarket(channel.market)))
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100))
        .map((channel) => ({
            value: channel.code,
            title: channel.displayName,
            descriptionKey: channel.descriptionKey || 'pages.checkout.paymentGenericDesc',
            badgeKey: channel.badgeKey || (normalizePaymentMarket(channel.market) === 'CN' ? 'pages.checkout.paymentChina' : 'pages.checkout.paymentMexico'),
            market: normalizePaymentMarket(channel.market),
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

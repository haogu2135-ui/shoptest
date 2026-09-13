import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
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
    return PAYMENT_MARKETS.has(normalized) ? normalized : 'GLOBAL';
};

const PAYMENT_MARKETS = new Set(['MX', 'CN', 'GLOBAL']);

/** Market badge for conversion honesty (do not label GLOBAL rails as Mexico). */
export const badgeKeyForPaymentMarket = (market?: string) => {
    const normalized = normalizePaymentMarket(market);
    if (normalized === 'CN') return 'pages.checkout.paymentChina';
    if (normalized === 'MX') return 'pages.checkout.paymentMexico';
    return 'pages.checkout.paymentGlobal';
};

/**
 * Preserve backend geo ranking. Re-sorting by raw sortOrder elevates CN (70-90)
 * above GLOBAL (100+) and undoes Mexico-first channel order from /payments/channels.
 */
export const preservePaymentChannelOrder = <T extends { sortOrder?: number; code?: string }>(
    channels: T[],
): T[] => channels.slice();

export const paymentMethodOrder: PaymentMethod[] = ['MERCADO_PAGO', 'SPEI', 'OXXO', 'CODI', 'MX_LOCAL_CARD', 'PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'VISA', 'SHOP_PAY', 'STRIPE', 'ALIPAY', 'WECHAT_PAY', 'UNIONPAY'];

const iconForPaymentMethod = (method: string) => {
    switch (method) {
        case 'ALIPAY':
            return <ShopIcon path={SI.alipay} />;
        case 'WECHAT':
        case 'WECHAT_PAY':
            return <ShopIcon path={SI.wechat} />;
        case 'APPLE_PAY':
            return <ShopIcon path={SI.apple} />;
        case 'GOOGLE_PAY':
            return <ShopIcon path={SI.google} />;
        case 'STRIPE':
        case 'VISA':
        case 'MX_LOCAL_CARD':
        case 'UNIONPAY':
            return <ShopIcon path={SI.creditCard} />;
        default:
            return <ShopIcon path={SI.wallet} />;
    }
};

export type PaymentMethodChannelFilterOptions = {
    /** Shopper currency (MXN hides CN rails for Mexico-first conversion). */
    currency?: string;
    /** Explicit home market override. */
    homeMarket?: 'MX' | 'CN' | 'GLOBAL';
    /** Force-hide non-home foreign rails (CN when home is MX). Default: true for MXN. */
    hideForeignRails?: boolean;
};

const shouldHideForeignPaymentRails = (options?: PaymentMethodChannelFilterOptions) => {
    if (options?.hideForeignRails === true) return true;
    if (options?.hideForeignRails === false) return false;
    const currency = String(options?.currency || '').trim().toUpperCase();
    if (currency === 'MXN') return true;
    if (options?.homeMarket === 'MX') return true;
    return false;
};

/** Filter + preserve backend geo order for commercial checkout/profile payment UIs. */
export const filterPaymentChannelsForMarket = (
    channels: PaymentChannel[] = [],
    options?: PaymentMethodChannelFilterOptions,
): PaymentChannel[] => {
    const hideForeign = shouldHideForeignPaymentRails(options);
    const filtered: PaymentChannel[] = [];
    for (const channel of channels) {
        const market = normalizePaymentMarket(channel.market);
        // Mexico-first: do not surface Alipay/WeChat/UnionPay for MXN shoppers.
        if (hideForeign && market === 'CN') continue;
        filtered.push(channel);
    }
    return filtered;
};

export const createPaymentMethodOptions = (
    t: (key: string) => string,
    channels: PaymentChannel[] = [],
    options?: PaymentMethodChannelFilterOptions,
): PaymentMethodOption[] => {
    const result: PaymentMethodOption[] = [];
    for (const channel of filterPaymentChannelsForMarket(channels, options)) {
        result.push({
            value: channel.code,
            label: <span>{iconForPaymentMethod(channel.code)} {channel.labelKey ? t(channel.labelKey) : channel.displayName}</span>,
        });
    }
    return result;
};

export const createPaymentMethodDetails = (
    channels: PaymentChannel[],
    options?: PaymentMethodChannelFilterOptions,
): PaymentMethodDetail[] => {
    const result: PaymentMethodDetail[] = [];
    for (const channel of filterPaymentChannelsForMarket(channels, options)) {
        result.push({
            value: channel.code,
            title: channel.displayName,
            descriptionKey: channel.descriptionKey || 'pages.checkout.paymentGenericDesc',
            badgeKey: channel.badgeKey || badgeKeyForPaymentMarket(channel.market),
            market: normalizePaymentMarket(channel.market),
        });
    }
    return result;
};

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

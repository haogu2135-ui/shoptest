import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { announceAccessibleMessage } from '../utils/accessibleMessage';
import { ShopIcon, SI } from './ShopIcon';
import ShopModal from './ShopModal';
import ShopButton from './ShopButton';
import { paymentApi } from '../api';
import { useLanguage } from '../i18n';
import { createPaymentMethodOptions, filterPaymentChannelsForMarket, PaymentMethod, paymentMethodLabel } from '../utils/paymentMethods';
import { useMarket } from '../hooks/useMarket';
import { getApiErrorMessage } from '../utils/apiError';
import type { PaymentChannel } from '../types';
import './Payment.css';
import '../styles/mobile-page-contrast.css';
import { navigateToCommercialPaymentUrl } from '../utils/paymentRecovery';
import ShopTag from './ShopTag';
import ShopAlert from './ShopAlert';

const getDefaultPaymentMethod = (channels: PaymentChannel[], currency: string) => {
    const marketChannels = filterPaymentChannelsForMarket(channels, { currency });
    return marketChannels.find((channel) => channel.recommended)?.code || marketChannels[0]?.code || '';
};

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
    const [paymentChannelsLoading, setPaymentChannelsLoading] = useState(false);
    const [paymentChannelsError, setPaymentChannelsError] = useState('');
    const [loading, setLoading] = useState(false);
    const { t, language } = useLanguage();
    const { formatMoney, currency } = useMarket();
    const languageRef = useRef(language);
    const translateRef = useRef(t);
    languageRef.current = language;
    translateRef.current = t;
    const paymentOptions = useMemo(() => createPaymentMethodOptions(t, paymentChannels, { currency }), [currency, paymentChannels, t]);
    const marketPaymentChannels = useMemo(
        () => filterPaymentChannelsForMarket(paymentChannels, { currency }),
        [currency, paymentChannels],
    );
    const selectedChannel = useMemo(
        () => marketPaymentChannels.find((channel) => channel.code === paymentMethod),
        [marketPaymentChannels, paymentMethod],
    );
    const activeMarkets = useMemo(() => Array.from(new Set(marketPaymentChannels
        .map((channel) => String(channel.market || '').toUpperCase())
        .filter(Boolean))), [marketPaymentChannels]);
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

    const loadPaymentChannels = useCallback(async (isActive: () => boolean = () => true) => {
        setPaymentChannelsLoading(true);
        setPaymentChannelsError('');
        try {
            const res = await paymentApi.getChannels();
            if (!isActive()) return;
            const channels = res.data || [];
            setPaymentChannels(channels);
            setPaymentMethod(getDefaultPaymentMethod(channels, currency));
        } catch (error: unknown) {
            if (!isActive()) return;
            setPaymentChannels([]);
            setPaymentMethod('');
            setPaymentChannelsError(getApiErrorMessage(
                error,
                translateRef.current('pages.checkout.paymentUnavailableDescription'),
                languageRef.current
            ));
        } finally {
            if (isActive()) setPaymentChannelsLoading(false);
        }
    }, [currency]);

    useEffect(() => {
        let disposed = false;
        void loadPaymentChannels(() => !disposed);
        return () => {
            disposed = true;
        };
    }, [loadPaymentChannels]);

    useEffect(() => {
        if (!paymentChannels.length) return;
        if (paymentMethod && paymentOptions.some((option) => option.value === paymentMethod)) return;
        setPaymentMethod(getDefaultPaymentMethod(paymentChannels, currency));
    }, [currency, paymentChannels, paymentMethod, paymentOptions]);

    const handlePayment = async () => {
        setLoading(true);
        try {
            const safePaymentMethod = marketPaymentChannels.some((channel) => channel.code === paymentMethod)
                ? paymentMethod
                : getDefaultPaymentMethod(paymentChannels, currency);
            if (!safePaymentMethod) {
                announceAccessibleMessage(t('pages.checkout.paymentUnavailable'), 'error');
                return;
            }
            if (safePaymentMethod !== paymentMethod) {
                setPaymentMethod(safePaymentMethod);
            }
            const response = await paymentApi.create(orderId, safePaymentMethod, guestEmail, orderNo);
            const payment = response.data;
            if (payment.paymentUrl) {
                if (!navigateToCommercialPaymentUrl(payment.paymentUrl)) {
                    announceAccessibleMessage(t('pages.payment.failed'), 'error');
                    return;
                }
                announceAccessibleMessage(t('pages.checkout.paymentReady'), 'success');
                return;
            }
            onSuccess();
        } catch (error: unknown) {
            announceAccessibleMessage(getApiErrorMessage(error, t('pages.payment.createFailed'), language), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ShopModal
            title={t('pages.payment.title')}
            open
            onClose={onCancel}
            footer={null}
            className="profile-mobile-safe-modal payment-modal"
            rootClassName="payment-modal-root"
            ariaLabel={t('pages.payment.title')}
            closeLabel={t('common.close', { defaultValue: 'Close' })}
        >
            <div className="payment-modal__content payment-modal__stack">
                <div className="payment-modal__summary">
                    <span className="payment-modal__text payment-modal__eyebrow">{t('pages.payment.secureEyebrow')}</span>
                    <h3 className="payment-modal__amount commerce-money">{t('pages.payment.amount', { amount: formattedAmount })}</h3>
                    <span className="payment-modal__text payment-modal__text--secondary">{t('pages.payment.secureSubtitle')}</span>
                    <div className="payment-modal__badges">
                        <ShopTag icon={<ShopIcon path={SI.safety} />} color="green">{t('pages.payment.encrypted')}</ShopTag>
                        <ShopTag icon={<ShopIcon path={SI.thunder} />} color="orange">{t('pages.payment.localMethods')}</ShopTag>
                        {activeMarkets.slice(0, 3).map((market) => (
                            <ShopTag key={market}>{market}</ShopTag>
                        ))}
                    </div>
                </div>
                <div
                    className="payment-modal__methodGroup"
                    role="radiogroup"
                    aria-label={paymentMethodGroupLabel}
                >
                    <div className="payment-modal__methodList payment-modal__stack">
                        {paymentOptions.length === 0 ? (
                            <ShopAlert
                                type="warning"
                                showIcon
                                message={t('pages.checkout.paymentUnavailable')}
                                description={paymentChannelsError || t('pages.checkout.paymentUnavailableDescription')}
                                action={(
                                    <ShopButton
                                        size="small"
                                        onClick={() => void loadPaymentChannels()}
                                        loading={paymentChannelsLoading}
                                    >
                                        {t('common.retry')}
                                    </ShopButton>
                                )}
                            />
                        ) : null}
                        {paymentOptions.map((option) => {
                            const optionLabel = paymentOptionLabel(option.value);
                            const optionActionLabel = `${t('pages.checkout.paymentMethod')}: ${optionLabel} · ${paymentContextLabel}`;
                            const selected = paymentMethod === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    className={`payment-modal__method${selected ? ' payment-modal__method--selected' : ''}`}
                                    aria-label={optionActionLabel}
                                    title={optionActionLabel}
                                    onClick={() => setPaymentMethod(option.value)}
                                >
                                    <span className="payment-modal__methodLabel">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {selectedChannel ? (
                    <div className="payment-modal__channelNote" role="status" aria-label={`${t('pages.checkout.paymentConfidenceTitle')}: ${selectedPaymentLabel}`}>
                        <span className="payment-modal__text payment-modal__text--strong">{selectedChannel.displayName}</span>
                        <span className="payment-modal__text payment-modal__text--secondary">
                            {selectedChannel.descriptionKey ? t(selectedChannel.descriptionKey) : t('pages.payment.channelFallback')}
                        </span>
                    </div>
                ) : null}
                <ShopButton
                    type="primary"
                    block
                    onClick={handlePayment}
                    loading={loading}
                    disabled={paymentChannelsLoading || paymentOptions.length === 0}
                    className="payment-modal__confirm"
                    aria-label={confirmPaymentLabel}
                    title={confirmPaymentLabel}
                >
                    {t('pages.payment.confirm')}
                </ShopButton>
            </div>
        </ShopModal>
    );
}; 

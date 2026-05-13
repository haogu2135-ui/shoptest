# ShopMX Production Payment And Refund Guide

This guide is the production checklist for China/Mexico checkout, payment confirmation, returns, and refunds. Payment methods are configuration-driven: the frontend reads `GET /payments/channels`, and the backend validates and creates payments from the same `payment.channels[...]` properties.

## Supported Channels

- Mexico: `STRIPE`, `MERCADO_PAGO`, `OXXO`, `SPEI`, `CODI`, `MX_LOCAL_CARD`.
- China: `ALIPAY`, `WECHAT_PAY`, `UNIONPAY`.
- Global wallets/cards: `PAYPAL`, `APPLE_PAY`, `GOOGLE_PAY`, `VISA`, `SHOP_PAY`.

Keep only channels you can actually settle in production:

```properties
payment.channels[0].code=STRIPE
payment.channels[0].enabled=true
payment.channels[0].provider=STRIPE
payment.channels[0].refund-mode=STRIPE

payment.channels[1].code=OXXO
payment.channels[1].enabled=true
payment.channels[1].provider=GENERIC_REDIRECT
payment.channels[1].checkout-url=https://your-provider.example.com/checkout
payment.channels[1].refund-mode=MANUAL
```

Set `enabled=false` to hide a channel without code changes. Set `checkout-url` per channel to override the global `PAYMENT_CHECKOUT_BASE_URL`.

## Stripe Setup

Set these environment variables on the backend server:

```powershell
$env:STRIPE_SECRET_KEY="sk_live_xxx"
$env:STRIPE_WEBHOOK_SECRET="whsec_xxx"
$env:STRIPE_SUCCESS_URL="https://your-domain.com/profile?payment=success"
$env:STRIPE_CANCEL_URL="https://your-domain.com/cart?payment=cancelled"
```

Configure the Stripe webhook endpoint:

```text
POST https://your-api-domain.com/payments/stripe/webhook
```

Enable at least these webhook events:

- `checkout.session.completed`
- `checkout.session.expired`

Refunds are created through Stripe when an admin completes a returned order. The code uses the paid Stripe payment intent and an idempotency key based on the order and payment id.

## Non-Stripe Gateway Options

The generic implementation can create pending payment records, generate a provider checkout/reference URL, and accept signed asynchronous callbacks. For production, connect one of these paths:

- Stripe Mexico payment methods where available in your Stripe account.
- Mercado Pago, Conekta, Openpay, Clip, or another Mexico-focused gateway that supports OXXO, SPEI, CoDi and cards.
- Alipay, WeChat Pay and UnionPay through a China-capable payment service provider.
- A bank or acquirer API that can return voucher/reference data and asynchronous status callbacks.

The callback must update `/payments/callback` with:

```json
{
  "orderNo": "SO...",
  "channel": "OXXO",
  "transactionId": "provider-transaction-id",
  "status": "SUCCESS",
  "amount": 123.45,
  "signature": "sha256(orderNo|channel|transactionId|status|amount|PAYMENT_CALLBACK_SECRET)"
}
```

Set a strong callback secret:

```powershell
$env:PAYMENT_CALLBACK_SECRET="replace-with-a-long-random-secret"
$env:PAYMENT_CHECKOUT_BASE_URL="https://your-provider-checkout.example.com/checkout"
$env:PAYMENT_SIMULATION_ENABLED="false"
$env:APP_RUNTIME_MODE="production"
```

Lock browser access to the deployed storefront and admin domains:

```powershell
$env:CORS_ALLOWED_ORIGIN_PATTERNS="https://your-domain.com,https://admin.your-domain.com"
$env:WEBSOCKET_ALLOWED_ORIGIN_PATTERNS="https://your-domain.com,https://admin.your-domain.com"
$env:SUPPORT_WEBSOCKET_MAX_MESSAGE_CHARS="1200"
```

Localhost is the only default browser origin. Add LAN or preview domains explicitly for QA environments.

`PAYMENT_CHECKOUT_BASE_URL` is used for non-Stripe payment records. The backend appends `/{orderNo}?channel=...&expiresAt=...`, so point it to the hosted checkout or reference-generation entry for your provider.

Per-channel checkout URLs are also supported:

```properties
payment.channels[6].code=ALIPAY
payment.channels[6].checkout-url=https://china-provider.example.com/alipay
payment.channels[6].enabled=true
```

Refund behavior is controlled by `refund-mode`:

- `STRIPE`: call Stripe Refund API, then mark the payment `REFUNDED`.
- `MANUAL`: mark the payment `REFUNDED` after the admin completes the return; use this when the external gateway refund is handled in its dashboard or back office.

When you add a custom provider integration later, keep the public channel code stable and change only `provider`, `checkout-url`, and `refund-mode` while preserving the callback payload contract.

The simulation endpoints are for local testing only. Code defaults to production mode when `app.runtime-mode` is absent. In `application.properties`, set:

```properties
app.runtime-mode=production
payment.simulation-enabled=
```

For a local demo or QA environment:

```properties
app.runtime-mode=debug
payment.simulation-enabled=
```

Blank `payment.simulation-enabled` means the backend derives the behavior from `app.runtime-mode`: enabled in `debug/dev/test`, disabled in `production`. You can still force it with `PAYMENT_SIMULATION_ENABLED=true` or `false`. The frontend reads `/app/config`, so the simulation buttons follow the backend config.

## Return And Refund Flow

1. Customer can request a return after receipt within `order.return-window-days`.
2. Admin approves or rejects the return request.
3. Customer enters the return tracking number.
4. Admin confirms the return has arrived.
5. The backend marks the latest paid payment as refunded and, for Stripe payments, calls Stripe Refund API.

Recommended production value:

```properties
order.return-window-days=7
```

Before launch, test one complete live-mode order with a small MXN amount, then refund it from the admin flow and confirm the refund appears in the provider dashboard.

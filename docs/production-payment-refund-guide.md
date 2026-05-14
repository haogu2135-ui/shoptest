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

If your production gateway is not Stripe and you have your own payment adapter service, switch the channel to `GENERIC_API` and configure only URLs and auth headers:

```properties
payment.channels[1].code=OXXO
payment.channels[1].enabled=true
payment.channels[1].provider=GENERIC_API
payment.channels[1].create-url=https://pay-adapter.example.com/api/payments/create
payment.channels[1].refund-mode=GENERIC_API
payment.channels[1].refund-url=https://pay-adapter.example.com/api/payments/refund
payment.channels[1].auth-header-name=Authorization
payment.channels[1].auth-header-value=Bearer your-live-token
payment.channels[1].merchant-id=shopmx-live
```

With this mode the shop backend creates the local payment record, calls your adapter, stores the returned gateway reference, and later reuses the same config for refunds.

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
  "providerReference": "provider-order-or-session-id",
  "status": "SUCCESS",
  "amount": 123.45,
  "callbackTimestamp": 1760000000,
  "signature": "sha256(orderNo|channel|transactionId|status|amount|callbackTimestamp|PAYMENT_CALLBACK_SECRET)"
}
```

`callbackTimestamp` is required. The backend rejects callbacks whose timestamp is missing or older than `payment.callback-max-skew-seconds`.

Set a strong callback secret:

```powershell
$env:PAYMENT_CALLBACK_SECRET="replace-with-a-long-random-secret"
$env:PAYMENT_CALLBACK_MAX_SKEW_SECONDS="300"
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

For `GENERIC_API` channels, the backend sends this create-payment request to `create-url`:

```json
{
  "orderId": 123,
  "orderNo": "SO...",
  "channel": "OXXO",
  "amount": "123.45",
  "currency": "MXN",
  "expiresMinutes": 30,
  "merchantId": "shopmx-live",
  "returnUrl": "https://your-domain.com/profile?payment=success",
  "cancelUrl": "https://your-domain.com/cart?payment=cancelled"
}
```

The adapter should reply with HTTP `2xx` and a payload similar to:

```json
{
  "status": "CREATED",
  "transactionId": "provider-transaction-id",
  "providerReference": "provider-reference-id",
  "paymentUrl": "https://provider.example.com/pay/xxx",
  "expiresAt": "2026-05-13T18:30:00"
}
```

`paymentUrl` and `transactionId` are required for `GENERIC_API` create responses. If either is missing, the backend rejects the payment creation request instead of generating a fake fallback URL.

For `GENERIC_API` refunds, the backend posts:

```json
{
  "orderId": 123,
  "orderNo": "SO...",
  "paymentId": 99,
  "transactionId": "provider-transaction-id",
  "providerReference": "provider-reference-id",
  "channel": "OXXO",
  "amount": "123.45",
  "currency": "MXN",
  "reason": "RETURN_COMPLETED",
  "merchantId": "shopmx-live"
}
```

Recommended response:

```json
{
  "status": "REFUNDED",
  "refundReference": "refund-001"
}
```

For `GENERIC_API` refunds, both a success status and a refund reference are required. A plain `2xx` response without a valid body is treated as a refund failure.

Per-channel checkout URLs are also supported:

```properties
payment.channels[6].code=ALIPAY
payment.channels[6].checkout-url=https://china-provider.example.com/alipay
payment.channels[6].enabled=true
```

Refund behavior is controlled by `refund-mode`:

- `STRIPE`: call Stripe Refund API, then mark the payment `REFUNDED`.
- `GENERIC_API`: call your configured refund API and store the returned `refundReference`.
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

In production mode, `/payments/channels` only exposes enabled channels that are actually configured for checkout. Placeholder redirect URLs and Stripe without a secret key are hidden automatically.

## Geo-Based Payment Recommendation

`GET /payments/channels` now supports request-aware recommendation and sorting. The backend first trusts a country header injected by your CDN or reverse proxy, then optionally falls back to a configurable IP-to-country lookup URL, and finally uses the normal checkout fallback when no country can be resolved.

Recommended production setup behind Cloudflare, Nginx, or another edge:

```powershell
$env:PAYMENT_GEO_ENABLED="true"
$env:PAYMENT_GEO_LOOKUP_URL=""
$env:PAYMENT_GEO_FALLBACK_COUNTRY=""
```

If your edge already injects a country header, keep `PAYMENT_GEO_LOOKUP_URL` empty and forward one of these headers to the app:

- `CF-IPCountry`
- `X-Country-Code`
- `X-Geo-Country`
- `X-Country`

Optional fallback when you want the backend itself to resolve the IP:

```powershell
$env:PAYMENT_GEO_LOOKUP_URL="https://your-geo-service.example.com/lookup?ip={ip}"
$env:PAYMENT_GEO_LOOKUP_TIMEOUT_MS="1200"
```

The lookup endpoint can return either a plain ISO-2 country code like `MX`, or JSON containing `countryCode`, `country_code`, `countryCodeIso2`, or `country`.

Local QA can pin a country without code changes:

```powershell
$env:PAYMENT_GEO_LOCAL_IP_COUNTRY="CN"
```

Recommendation behavior:

- Client country `CN`: China channels are sorted first and the first enabled China channel is marked recommended.
- Client country `MX`: Mexico channels are sorted first and the first enabled Mexico channel is marked recommended.
- Other or unknown countries: frontend falls back to the existing currency-based recommendation.

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

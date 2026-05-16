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
  "idempotencyKey": "return-refund-123-99",
  "transactionId": "provider-transaction-id",
  "providerReference": "provider-reference-id",
  "channel": "OXXO",
  "amount": "123.45",
  "currency": "MXN",
  "reason": "RETURN_COMPLETED",
  "merchantId": "shopmx-live"
}
```

The same idempotency key is also sent as the `Idempotency-Key` HTTP header. The payment adapter must treat repeated refund requests with the same key as the same refund attempt and return the original refund reference.

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

## Storefront Recovery Checklist

Use the same customer-facing loop in checkout, profile orders, and support:

1. Identify the current step: order created, payment pending, payment confirmed, fulfillment queued, return requested, return approved, return shipped, or refunded.
2. Bind the order number before asking the customer to retry payment or submit return tracking.
3. Give one next action only: open payment link, regenerate payment, contact support, submit return tracking, track return shipment, or wait for refund confirmation.
4. Keep the latest payment link visible, but always provide a refresh path for expired or missing links.
5. Keep the after-sales promise visible after payment succeeds, so the customer knows where to return later if needed.

Recommended UI behavior:

- Checkout result page should show the current payment step and recovery actions immediately after order creation.
- Profile payment modal should show the same step rail plus payment history, because returning users need proof and context.
- Profile return modal should show the return step rail before the reason or tracking input.
- Admin order management should show the same four return stages and expose the next eligible status action.

## Admin Refund Operations

Daily refund queue order:

1. Review `RETURN_REQUESTED` first and approve or reject eligibility.
2. Follow up `RETURN_APPROVED` orders that still do not have return tracking.
3. Confirm receipt and refund `RETURN_SHIPPED` orders as the highest risk queue.
4. Leave `RETURNED` orders as reference cases unless the provider refund failed.

Before clicking "confirm return received and refund":

- Check that the return tracking number exists or that warehouse receipt is verified.
- Check that the order has a latest paid payment.
- Check the payment channel refund mode:
  - `STRIPE`: provider refund should be created automatically.
  - `GENERIC_API`: adapter must return `REFUNDED` plus `refundReference`.
  - `MANUAL`: operator must complete the external refund before closing the order.
- Copy the suggested customer reply and send it through support if the customer is waiting.

## Daily Operations Dashboard

Use the admin dashboard as the first stop before opening detailed order queues:

1. Check pending payment count. If it is rising, inspect payment links, channel health, and recent payment failure logs.
2. Check `RETURN_REQUESTED`. These cases need a clear approve or reject decision before the customer loses confidence.
3. Check `RETURN_APPROVED`. These cases need a return tracking reminder if the customer has not shipped the item back.
4. Check `RETURN_SHIPPED`. Treat this as the highest refund-risk queue because money is waiting to be returned.
5. Open audit logs for payment failures, callbacks, and refund events when dashboard counts do not match provider records.

Recommended owner split:

- Customer support owns customer communication, order binding, and reason collection.
- Operations owns return approval, warehouse receipt checks, and refund closure.
- Finance owns provider dashboard reconciliation for Stripe, generic API, and manual refunds.

## Admin Deep Links

Use deep links when wiring dashboard cards, support shortcuts, or incident playbooks. They should land the operator directly in the right queue instead of asking them to filter again:

- `/admin/orders?status=PENDING_PAYMENT`: pending payment recovery queue.
- `/admin/orders?status=RETURN_REQUESTED`: return eligibility review queue.
- `/admin/orders?status=RETURN_APPROVED`: approved returns waiting for customer shipment.
- `/admin/orders?status=RETURN_SHIPPED`: returned parcels waiting for receipt confirmation and refund.
- `/admin/orders?quick=REFUNDED`: refunded/reference cases.
- `/admin/audit-logs?view=payment-failures`: failed payment events.
- `/admin/audit-logs?view=refunds`: refund completion events.
- `/admin/audit-logs?view=callbacks`: payment callback events.
- `/admin/audit-logs?view=payment-ops`: all payment-related audit events.

## Failure Recovery Rules

- Payment record missing after order creation: regenerate the payment for the same order, do not create another order.
- Payment link expired: create a fresh payment with the selected channel and keep the old payment in history.
- Callback delayed: keep the order in pending payment until the callback or manual reconciliation confirms success.
- Refund API failure: keep the order out of `RETURNED` until the provider refund succeeds or a manual refund reference is recorded.
- Duplicate callbacks: rely on provider reference, transaction id, and idempotency keys; do not ship twice or refund twice.

# ShopMX Production Payment And Refund Guide

This guide is the production checklist for Mexico checkout, payment confirmation, and return refunds.

## Supported Channels

- `STRIPE`: recommended production gateway for cards, Apple Pay and Google Pay.
- `OXXO`: cash payment voucher flow. Use Stripe OXXO or another Mexican payment aggregator in production.
- `SPEI`: bank transfer reference flow. Use a Mexican payment aggregator or bank integration in production.
- `MX_LOCAL_CARD`: reserve for a local card acquirer or aggregator that is not Stripe.

Keep only channels you can actually settle in production:

```properties
payment.supported-channels=STRIPE,OXXO,SPEI,MX_LOCAL_CARD
```

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

## OXXO And SPEI Production Options

The current local implementation can create pending payment records and simulate callbacks for development. For production, connect one of these paths:

- Stripe Mexico payment methods where available in your Stripe account.
- Mercado Pago, Conekta, Openpay, Clip, or another Mexico-focused gateway that supports OXXO and SPEI.
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

`PAYMENT_CHECKOUT_BASE_URL` is used for non-Stripe payment records. The backend appends `/{orderNo}?channel=...&expiresAt=...`, so point it to the hosted checkout or reference-generation entry for your provider.

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

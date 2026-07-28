# Meta Purchase Match Quality Setup

The site now saves the Facebook click context immediately before it sends a customer to Stripe. Stripe returns the same reference in its `checkout.session.completed` webhook, allowing the server-side Purchase event to include `_fbp`, `_fbc`, IP address and user agent alongside the hashed purchase email.

## Required Vercel environment variables

Create a Vercel KV database (or an Upstash Redis REST database) and add these production environment variables:

```text
KV_REST_API_URL=https://<your-kv-rest-endpoint>
KV_REST_API_TOKEN=<your-kv-rest-token>
```

The code also accepts the Upstash names:

```text
UPSTASH_REDIS_REST_URL=https://<your-upstash-endpoint>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
```

Keep the existing variables unchanged:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
META_PIXEL_ID=
META_ACCESS_TOKEN=
```

## Stripe Payment Link requirement

No Stripe Dashboard link replacement is needed. The checkout button adds a unique `client_reference_id` to the existing Payment Link URL automatically. Stripe includes that value in `checkout.session.completed`, which is how the webhook retrieves the matching click context.

## Test

1. Redeploy after adding the variables.
2. Open the site from a Facebook ad test URL containing `fbclid`.
3. Begin checkout and complete a Stripe test payment.
4. In Stripe, confirm the webhook received `checkout.session.completed` and returned `200`.
5. In Meta Test Events, confirm the server Purchase includes a stronger Event Match Quality and has the expected value/currency.

If the KV variables are missing, checkout still works normally, but the webhook falls back to email-only matching.

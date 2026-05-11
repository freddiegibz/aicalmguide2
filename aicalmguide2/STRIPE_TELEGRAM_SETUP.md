# Stripe to Telegram Notifications

## Folder structure

```text
aicalmguide2/
  app/
    api/
      stripe-webhook/
        route.js
```

## Environment variables

Set these in Vercel and locally:

```bash
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_CHAT_ID=123456789
```

## Telegram setup

1. Open Telegram and message `@BotFather`.
2. Send `/newbot`.
3. Follow the prompts to create the bot.
4. BotFather will return the bot token. Copy it into `TELEGRAM_BOT_TOKEN`.
5. Start a chat with your bot or add it to a group.
6. Get the chat ID:
   - For a private chat, send a message to the bot, then visit:
     `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the numeric `chat.id` in the JSON response.
   - For a group, add the bot to the group, send a message in the group, then check `getUpdates` the same way.

## Stripe setup

1. In Stripe Dashboard, go to Developers > Webhooks.
2. Click Add endpoint.
3. Set the endpoint URL to:
   `https://your-domain.com/api/stripe-webhook`
4. Listen for exactly this event:
   `checkout.session.completed`
5. After creating the endpoint, copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Vercel setup

1. Open your project in Vercel.
2. Go to Settings > Environment Variables.
3. Add:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
4. Redeploy after adding or changing env vars.
5. Make sure the webhook points to the production deployment URL, not `localhost`.

## Local testing

1. Install dependencies if needed, including `stripe`.
2. Run your Next.js app locally.
3. Use the Stripe CLI to forward webhooks to your local route:
   `stripe listen --forward-to localhost:3000/api/stripe-webhook`
4. Copy the webhook signing secret from the Stripe CLI into `STRIPE_WEBHOOK_SECRET`.
5. Trigger a test Checkout completion from your app.
6. Confirm the Telegram message arrives in the target chat.

## Production testing

1. Deploy the app to Vercel.
2. Update the Stripe webhook endpoint to the live Vercel URL.
3. Run a Stripe test payment through Checkout.
4. Verify the Telegram message contains:
   - customer email
   - amount paid
   - product name if available

## Notes

- The route uses the raw request body for Stripe signature verification.
- The route runs server-side only and does not expose secrets to the client.
- If product name is not available in the session payload, the code falls back to metadata or line item description.

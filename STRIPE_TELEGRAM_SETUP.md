# Stripe to Telegram Notifications

## Folder structure

```text
api/
  stripe-webhook.js
package.json
```

## Environment variables

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
4. Copy the bot token into `TELEGRAM_BOT_TOKEN`.
5. Start a chat with the bot or add it to a group.
6. Send a message to the bot or group.
7. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`.
8. Copy the numeric `chat.id` into `TELEGRAM_CHAT_ID`.

## Stripe setup

1. Go to `Stripe Dashboard > Developers > Webhooks`.
2. Click `Add endpoint`.
3. Set the endpoint URL to `https://www.aiconfidencekit.com/api/stripe-webhook`.
4. Select `checkout.session.completed`.
5. Save the endpoint.
6. Reveal the signing secret and paste it into `STRIPE_WEBHOOK_SECRET`.

## Vercel setup

1. Open the Vercel project.
2. Go to `Settings > Environment Variables`.
3. Add the four environment variables.
4. Redeploy after changing env vars or code.

## Testing

1. Redeploy the site with the `api/stripe-webhook.js` function in the project root.
2. Open `https://www.aiconfidencekit.com/api/stripe-webhook`.
3. A browser `GET` request should no longer return Vercel's plain `404`. A `405 Method not allowed` response is fine.
4. Run a real or test checkout.
5. Check Stripe webhook delivery status.
6. Check Telegram for the message.

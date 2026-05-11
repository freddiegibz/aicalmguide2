import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

function formatAmount(amount, currency) {
  if (typeof amount !== "number") return "Unknown amount";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${String(currency || "usd").toUpperCase()}`;
  }
}

function escapeTelegramMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram environment variables are not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} ${errorText}`);
  }
}

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature header." }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  let event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return Response.json(
      { error: `Invalid webhook signature: ${error.message}` },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true, ignored: event.type });
  }

  try {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email || "Unknown email";
    const amountPaid = formatAmount(session.amount_total ?? session.amount_subtotal, session.currency);
    let productName = session.metadata?.product_name || "Product unavailable";

    if (productName === "Product unavailable") {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 1,
        expand: ["data.price.product"],
      });

      const firstItem = lineItems.data[0];
      productName =
        firstItem?.description ||
        firstItem?.price?.product?.name ||
        firstItem?.price?.product?.description ||
        "Product unavailable";
    }

    const message = [
      "*New Stripe sale*",
      `Product: ${escapeTelegramMarkdown(productName)}`,
      `Email: ${escapeTelegramMarkdown(customerEmail)}`,
      `Amount: ${escapeTelegramMarkdown(amountPaid)}`,
      `Session: ${escapeTelegramMarkdown(session.id)}`,
    ].join("\n");

    await sendTelegramMessage(message);

    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: `Failed to process sale notification: ${error.message}` },
      { status: 500 }
    );
  }
}

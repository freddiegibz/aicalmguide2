const crypto = require("crypto");
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function stripeWebhook(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const metaPixelId = process.env.META_PIXEL_ID;
  const metaAccessToken = process.env.META_ACCESS_TOKEN;

  if (!stripeWebhookSecret || !metaPixelId || !metaAccessToken) {
    return res.status(500).json({ error: "Missing webhook environment variables" });
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];

    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).json({ error: "Stripe signature verification failed" });
  }

  console.log("Stripe webhook received:", event.type);

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true });
  }

  const email = session.customer_details && session.customer_details.email;
  const amountTotal = session.amount_total || 0;
  const currency = session.currency ? session.currency.toUpperCase() : undefined;
  const userData = email ? { em: sha256(email) } : {};

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: event.created || Math.floor(Date.now() / 1000),
        event_id: session.id,
        action_source: "website",
        event_source_url: "https://www.aiconfidencekit.com/",
        user_data: userData,
        custom_data: {
          value: amountTotal / 100,
          currency,
        },
      },
    ],
  };

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/v25.0/${metaPixelId}/events?access_token=${metaAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta CAPI Purchase failed:", metaResult);
      return res.status(502).json({ error: "Meta API request failed" });
    }

    console.log("Meta CAPI Purchase sent:", session.id);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Meta CAPI Purchase request failed:", error.message);
    return res.status(502).json({ error: "Meta API request failed" });
  }
};

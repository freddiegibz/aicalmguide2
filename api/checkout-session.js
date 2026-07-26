const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function isCheckoutSessionId(value) {
  return typeof value === "string" && /^cs_(?:test_|live_)[A-Za-z0-9]+$/.test(value);
}

module.exports = async function checkoutSession(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Missing Stripe environment variable" });
  }

  const sessionId = req.query && req.query.session_id;
  if (!isCheckoutSessionId(sessionId)) {
    return res.status(400).json({ error: "Invalid session" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(409).json({ error: "Payment is not complete" });
    }

    return res.status(200).json({
      session_id: session.id,
      value: (session.amount_total || 0) / 100,
      currency: session.currency ? session.currency.toUpperCase() : "GBP",
    });
  } catch (error) {
    console.error("Unable to retrieve Stripe Checkout Session:", error.message);
    return res.status(404).json({ error: "Checkout session not found" });
  }
};

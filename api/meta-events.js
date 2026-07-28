const crypto = require("crypto");

const ALLOWED_EVENTS = new Set(["PageView", "InitiateCheckout"]);

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value).trim().toLowerCase())
    .digest("hex");
}

function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8"));
  }

  return {};
}

function cleanMetaCookie(value, prefix) {
  if (typeof value !== "string" || value.length > 255) return undefined;
  return value.startsWith(prefix) ? value : undefined;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return req.headers["x-real-ip"] || req.socket?.remoteAddress;
}

module.exports = async function metaEvents(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const metaPixelId = process.env.META_PIXEL_ID;
  const metaAccessToken = process.env.META_ACCESS_TOKEN;

  if (!metaPixelId || !metaAccessToken) {
    return res.status(500).json({ error: "Missing Meta environment variables" });
  }

  let body;

  try {
    body = parseBody(req);
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const eventName = body.event_name;
  const eventId = typeof body.event_id === "string" ? body.event_id.slice(0, 100) : "";
  const eventSourceUrl =
    typeof body.event_source_url === "string" ? body.event_source_url.slice(0, 2048) : "";

  if (!ALLOWED_EVENTS.has(eventName) || !eventId || !eventSourceUrl) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  try {
    const source = new URL(eventSourceUrl);
    const origin = req.headers.origin;

    if (!/^https?:$/.test(source.protocol)) {
      return res.status(400).json({ error: "Invalid event source" });
    }

    if (origin && new URL(origin).host !== source.host) {
      return res.status(403).json({ error: "Origin mismatch" });
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid event source" });
  }

  const userData = {
    client_ip_address: getClientIp(req),
    client_user_agent: req.headers["user-agent"],
  };

  const fbp = cleanMetaCookie(body.fbp, "fb.1.");
  const fbc = cleanMetaCookie(body.fbc, "fb.1.");

  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  if (typeof body.external_id === "string" && body.external_id.length <= 200) {
    userData.external_id = sha256(body.external_id);
  }

  const serverEvent = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: "website",
    user_data: userData,
  };

  if (eventName === "InitiateCheckout") {
    serverEvent.custom_data = {
      content_name: "AI Confidence Kit",
      currency: "GBP",
      value: Number.isFinite(Number(body.value)) ? Number(body.value) : 19,
    };
  }

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/v25.0/${metaPixelId}/events?access_token=${metaAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [serverEvent] }),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("Meta CAPI event failed:", eventName, metaResult);
      return res.status(502).json({ error: "Meta API request failed" });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Meta CAPI event request failed:", eventName, error.message);
    return res.status(502).json({ error: "Meta API request failed" });
  }
};

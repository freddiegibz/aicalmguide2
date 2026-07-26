const { createReference, saveCheckoutContext } = require("./meta-kv");

function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
  return {};
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress;
}

function validMetaCookie(value, prefix) {
  return typeof value === "string" && value.length <= 255 && value.startsWith(prefix) ? value : "";
}

module.exports = async function metaCheckoutContext(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body = parseBody(req);
  } catch (_) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const sourceUrl = typeof body.event_source_url === "string" ? body.event_source_url.slice(0, 2048) : "";
  try {
    const source = new URL(sourceUrl);
    const origin = req.headers.origin;
    if (!/^https?:$/.test(source.protocol) || (origin && new URL(origin).host !== source.host)) {
      return res.status(400).json({ error: "Invalid event source" });
    }
  } catch (_) {
    return res.status(400).json({ error: "Invalid event source" });
  }

  const reference = createReference();
  const context = {
    fbp: validMetaCookie(body.fbp, "fb.1."),
    fbc: validMetaCookie(body.fbc, "fb.1."),
    external_id: typeof body.external_id === "string" ? body.external_id.slice(0, 200) : "",
    event_source_url: sourceUrl,
    client_ip_address: getClientIp(req),
    client_user_agent: (req.headers["user-agent"] || "").slice(0, 1000),
  };

  try {
    await saveCheckoutContext(reference, context);
    return res.status(200).json({ client_reference_id: reference });
  } catch (error) {
    console.error("Saving Meta checkout context failed:", error.message);
    return res.status(503).json({ error: "Checkout tracking is temporarily unavailable" });
  }
};

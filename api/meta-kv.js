const crypto = require("crypto");

const TTL_SECONDS = 7 * 24 * 60 * 60;

function getConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing KV_REST_API_URL and KV_REST_API_TOKEN");
  }

  return { url: url.replace(/\/$/, ""), token };
}

async function command(parts) {
  const { url, token } = getConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
  });

  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error || "KV request failed");
  }

  return result.result;
}

function createReference() {
  return "m_" + crypto.randomUUID().replace(/-/g, "");
}

function isValidReference(value) {
  return typeof value === "string" && /^m_[A-Za-z0-9_-]{12,198}$/.test(value);
}

async function saveCheckoutContext(reference, context) {
  await command(["SETEX", `meta:checkout:${reference}`, String(TTL_SECONDS), JSON.stringify(context)]);
}

async function loadCheckoutContext(reference) {
  if (!isValidReference(reference)) return null;
  const value = await command(["GET", `meta:checkout:${reference}`]);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

module.exports = {
  createReference,
  isValidReference,
  loadCheckoutContext,
  saveCheckoutContext,
};

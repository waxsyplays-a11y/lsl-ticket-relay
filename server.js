// ================================
// EMARI Discord Relay (Validated + Safe)
// ================================

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error("❌ DISCORD_WEBHOOK_URL is missing");
  process.exit(1);
}

// -----------------------------
// Webhook validation cache
// -----------------------------
let webhookValid = false;
let lastValidation = 0;
const VALIDATION_TTL = 10 * 60 * 1000; // 10 minutes

async function validateWebhook(force = false) {
  const now = Date.now();
  if (!force && webhookValid && now - lastValidation < VALIDATION_TTL) {
    return true;
  }

  try {
    const res = await fetch(WEBHOOK_URL, { method: "GET" });

    if (!res.ok) {
      console.error(`❌ Webhook validation failed: HTTP ${res.status}`);
      webhookValid = false;
      return false;
    }

    webhookValid = true;
    lastValidation = now;
    console.log("✅ Discord webhook validated");
    return true;
  } catch (err) {
    console.error("❌ Webhook validation error:", err.message);
    webhookValid = false;
    return false;
  }
}

// Validate once at startup
await validateWebhook(true);

// -----------------------------
// Rate-limit handling
// -----------------------------
let rateLimitedUntil = 0;

async function sendToDiscord(content) {
  const now = Date.now();

  if (now < rateLimitedUntil) {
    throw new Error("Rate limited (cooldown active)");
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (response.status === 429) {
    const retry = response.headers.get("retry-after");
    const delay = retry ? parseInt(retry) * 1000 : 5000;
    rateLimitedUntil = Date.now() + delay;
    throw new Error("Discord rate limit (429)");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord rejected (${response.status}): ${text}`);
  }
}

// -----------------------------
// Routes
// -----------------------------
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay online");
});

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, reason, time } = req.body;

    if (
      typeof avatar !== "string" ||
      typeof uuid !== "string" ||
      typeof reason !== "string" ||
      typeof time !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Revalidate webhook if needed
    const valid = await validateWebhook();
    if (!valid) {
      return res.status(500).json({ error: "Discord webhook invalid" });
    }

    const message = [
      "🚨 **EMARI Alert** 🚨",
      `**Avatar:** ${avatar}`,
      `**UUID:** ${uuid}`,
      `**Reason:**\n${reason}`,
      `**Time:** ${time}`
    ].join("\n\n");

    await sendToDiscord(message);

    res.send("OK");
  } catch (err) {
    console.error("❌ Relay error:", err.message);
    res.status(500).send(err.message);
  }
});

// -----------------------------
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay running on port ${PORT}`);
});

// ================================
// EMARI Discord Relay (Render Safe)
// ================================

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error("❌ DISCORD_WEBHOOK_URL missing");
  process.exit(1);
}

// --------------------
// Webhook validation
// --------------------
let webhookValid = false;
let lastValidation = 0;
const VALIDATE_EVERY = 10 * 60 * 1000; // 10 min

async function validateWebhook() {
  const now = Date.now();
  if (webhookValid && now - lastValidation < VALIDATE_EVERY) {
    return true;
  }

  try {
    const res = await fetch(WEBHOOK_URL, { method: "GET" });
    if (!res.ok) {
      console.error("❌ Webhook invalid:", res.status);
      webhookValid = false;
      return false;
    }

    webhookValid = true;
    lastValidation = now;
    console.log("✅ Discord webhook validated");
    return true;
  } catch (err) {
    console.error("❌ Webhook check failed:", err.message);
    webhookValid = false;
    return false;
  }
}

// --------------------
// Rate-limit protection
// --------------------
let blockedUntil = 0;

async function postToDiscord(content) {
  const now = Date.now();
  if (now < blockedUntil) {
    throw new Error("Rate limited (cooldown active)");
  }

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (res.status === 429) {
    const retry = res.headers.get("retry-after");
    const delay = retry ? parseInt(retry, 10) * 1000 : 5000;
    blockedUntil = Date.now() + delay;
    throw new Error("Discord rate limited (429)");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord rejected: ${res.status} ${text}`);
  }
}

// --------------------
// Routes
// --------------------
app.get("/", (req, res) => {
  res.send("✅ EMARI Discord Relay Online");
});

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, reason, time } = req.body;

    if (!avatar || !uuid || !reason || !time) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const ok = await validateWebhook();
    if (!ok) {
      return res.status(500).json({ error: "Webhook invalid" });
    }

    const message =
      "🚨 **EMARI Alert** 🚨\n\n" +
      `**Avatar:** ${avatar}\n` +
      `**UUID:** ${uuid}\n\n` +
      `**Reason:**\n${reason}\n\n` +
      `**Time:** ${time}`;

    await postToDiscord(message);

    res.send("OK");
  } catch (err) {
    console.error("❌ Relay error:", err.message);
    res.status(500).send(err.message);
  }
});

// --------------------
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay running on port ${PORT}`);
});

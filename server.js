// server.js — EMARI Discord Relay (Multi-Webhook Support)

const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

// Map of channel names to webhook URLs
const WEBHOOKS = {
  default: process.env.DISCORD_WEBHOOK_URL,
  security: process.env.DISCORD_WEBHOOK_SECURITY,
  support: process.env.DISCORD_WEBHOOK_SUPPORT,
  // Add more channels as needed
};

const SEND_DELAY_MS = 10000;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

let queue = [];
let sending = false;
const seen = new Map();

function sanitize(text) {
  return String(text)
    .replace(/[`*_~]/g, "")
    .replace(/</g, "")
    .replace(/>/g, "");
}

async function processQueue() {
  if (sending || queue.length === 0) return;

  sending = true;
  const { content, webhook, retries } = queue.shift();

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      console.error(`❌ Discord rejected: ${res.status}`);

      if (retryAfter) {
        console.warn(`⏳ Rate limited. Retrying in ${retryAfter}s`);
        queue.unshift({ content, webhook, retries });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, Number(retryAfter) * 1000);
        return;
      }

      if (retries < 3) {
        console.warn(`🔁 Retrying (${retries + 1})...`);
        queue.unshift({ content, webhook, retries: retries + 1 });
      }
    }
  } catch (err) {
    console.error("🔥 Send error:", err.message);
    if (retries < 3) {
      queue.unshift({ content, webhook, retries: retries + 1 });
    }
  }

  setTimeout(() => {
    sending = false;
    processQueue();
  }, SEND_DELAY_MS);
}

app.get("/", (req, res) => {
  res.send("✅ EMARI Relay Online (Multi-Channel)");
});

app.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time, channel = "default" } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).send("Invalid payload");
  }

  const webhook = WEBHOOKS[channel];
  if (!webhook) {
    return res.status(400).send("Unknown channel");
  }

  const now = Date.now();
  const last = seen.get(uuid);

  if (last && last.reason === reason && now - last.time < DEDUPE_WINDOW_MS) {
    return res.send("Duplicate skipped");
  }

  seen.set(uuid, { reason, time: now });

  const message =
    "🎟️ **EMARI Gate Log**\n\n" +
    "**Avatar:** " + sanitize(avatar) + "\n" +
    "**UUID:** " + sanitize(uuid) + "\n\n" +
    "**Status:**\n" + sanitize(reason) + "\n\n" +
    "**Time:** " + sanitize(time);

  queue.push({ content: message, webhook, retries: 0 });
  processQueue();

  res.send("Queued");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 EMARI Relay running on port", PORT);
});

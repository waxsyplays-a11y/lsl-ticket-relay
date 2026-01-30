// server.js — EMARI Discord Relay (ANTI-RATE-LIMIT v2)

const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK) {
  console.error("❌ DISCORD_WEBHOOK_URL missing");
  process.exit(1);
}

// Rate limit and deduplication settings
const SEND_DELAY_MS = 3000; // 1 message every 3 seconds
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

let queue = [];
let sending = false;
const seen = new Map();

// Optional: IP whitelist
// const ALLOWED_IPS = ["123.45.67.89", "98.76.54.32"];

function sanitize(text) {
  return String(text)
    .replace(/[`*_~]/g, "")
    .replace(/</g, "")
    .replace(/>/g, "");
}

async function processQueue() {
  if (sending || queue.length === 0) return;

  sending = true;
  const { content, retries } = queue.shift();

  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      console.error(`❌ Discord rejected: ${res.status}`);

      if (retryAfter) {
        console.warn(`⏳ Rate limited. Retrying in ${retryAfter}s`);
        queue.unshift({ content, retries });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, Number(retryAfter) * 1000);
        return;
      }

      if (retries < 3) {
        console.warn(`🔁 Retrying (${retries + 1})...`);
        queue.unshift({ content, retries: retries + 1 });
      }
    }
  } catch (err) {
    console.error("🔥 Send error:", err.message);
    if (retries < 3) {
      queue.unshift({ content, retries: retries + 1 });
    }
  }

  setTimeout(() => {
    sending = false;
    processQueue();
  }, SEND_DELAY_MS);
}

app.get("/", (req, res) => {
  res.send("✅ EMARI Relay Online");
});

app.post("/relay", (req, res) => {
  // Optional: IP filtering
  // const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  // if (!ALLOWED_IPS.includes(ip)) {
  //   console.warn(`⛔ Blocked request from unauthorized IP: ${ip}`);
  //   return res.status(403).send("Forbidden");
  // }

  const { avatar, uuid, reason, time } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).send("Invalid payload");
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

  queue.push({ content: message, retries: 0 });
  processQueue();

  res.send("Queued");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 EMARI Relay running on port", PORT);
});

const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

const WEBHOOKS = {
  default: process.env.DISCORD_WEBHOOK_URL,
  security: process.env.DISCORD_WEBHOOK_SECURITY,
  support: process.env.DISCORD_WEBHOOK_SUPPORT
};

const SEND_DELAY_MS = 10000;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_QUEUE_SIZE = 50;

let queue = [];
let sending = false;
const seen = new Map();

function sanitize(text) {
  return String(text).replace(/[`*_~]/g, "").replace(/[<>]/g, "");
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function processQueue() {
  if (sending || queue.length === 0) return;
  sending = true;

  const { embed, webhook } = queue.shift();

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!res.ok) {
      const retryAfter = res.headers.get("retry-after");
      log(`❌ Discord rejected: ${res.status}`);
      if (retryAfter) {
        log(`⏳ Rate limited. Retrying in ${retryAfter}s`);
        queue.unshift({ embed, webhook });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, Number(retryAfter) * 1000);
        return;
      }
    } else {
      log("✅ Alert sent");
    }
  } catch (err) {
    log("🔥 Send error: " + err.message);
  }

  setTimeout(() => {
    sending = false;
    processQueue();
  }, SEND_DELAY_MS);
}

app.get("/", (req, res) => {
  res.send("✅ EMARI Relay Online (Embed Logging)");
});

app.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time, channel = "default" } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).send("Invalid payload");
  }

  const webhook = WEBHOOKS[channel];
  if (!webhook) return res.status(400).send("Unknown channel");

  const now = Date.now();
  const last = seen.get(uuid);
  if (last && last.reason === reason && now - last.time < DEDUPE_WINDOW_MS) {
    return res.send("Duplicate skipped");
  }

  seen.set(uuid, { reason, time: now });

  if (queue.length >= MAX_QUEUE_SIZE) {
    log("⚠️ Queue full. Dropping message.");
    return res.status(429).send("Queue full");
  }

  const embed = {
    title: "🚨 EMARI Gate Alert",
    color: 0xff0000,
    fields: [
      { name: "Avatar", value: sanitize(avatar), inline: true },
      { name: "UUID", value: sanitize(uuid), inline: true },
      { name: "Status", value: sanitize(reason) },
      { name: "Time", value: sanitize(time) }
    ],
    footer: { text: "EMARI Relay System" },
    timestamp: new Date().toISOString()
  };

  queue.push({ embed, webhook });
  processQueue();

  res.send("Queued");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 EMARI Relay running on port ${PORT}`);
});


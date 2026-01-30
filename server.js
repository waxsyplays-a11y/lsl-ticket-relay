// EMARI Discord Relay — Full Script with Cloudflare Detection and Retry
const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const DEFAULT_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

if (!DEFAULT_WEBHOOK) {
  console.error("❌ Missing DISCORD_WEBHOOK_URL in .env");
  process.exit(1);
}

// Duplicate suppression
const seen = new Map(); // uuid → { reason, lastTime }
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Message queue
const queue = [];
let sending = false;
const SEND_DELAY_MS = 1100; // 1.1s between messages

function formatMessage({ avatar, uuid, reason, time }) {
  return (
    "```" +
    "🚨 EMARI Alert 🚨\n\n" +
    `Avatar: ${avatar} (${uuid})\n\n` +
    `Reason:\n${reason}\n\n` +
    `Time: ${time}\n` +
    "🚨 EMARI Alert 🚨" +
    "```"
  );
}

function isValidWebhook(url) {
  return typeof url === "string" &&
    url.startsWith("https://discord.com/api/webhooks/") &&
    url.length < 300;
}

function enqueueToWebhook(content, webhook) {
  queue.push({ content, webhook });
  processQueue();
}

async function processQueue() {
  if (sending || queue.length === 0) return;
  sending = true;

  const { content, webhook } = queue.shift();

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    const text = await res.text();

    if (!res.ok) {
      const isCloudflareBlock =
        res.status === 429 &&
        text.includes("cloudflare") &&
        (text.includes("Error 1015") || text.includes("You are being rate limited"));

      if (isCloudflareBlock) {
        const delay = 10000; // 10 seconds fallback
        console.warn("🛡️ Cloudflare block detected. Retrying in 10s...");
        queue.unshift({ content, webhook });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, delay);
        return;
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter ? parseFloat(retryAfter) * 1000 : 5000;
        console.warn(`⏳ Discord rate limit. Retrying in ${delay}ms`);
        queue.unshift({ content, webhook });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, delay);
        return;
      }

      console.error(`❌ Discord error: ${res.status} → ${text}`);
    } else {
      console.log("✅ Message sent");
    }
  } catch (err) {
    console.error("🔥 Send error:", err.message);
  }

  setTimeout(() => {
    sending = false;
    processQueue();
  }, SEND_DELAY_MS);
}

// Routes
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is running");
});

app.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time, webhook } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = Date.now();
  const previous = seen.get(uuid);

  if (previous && previous.reason === reason && now - previous.lastTime < COOLDOWN_MS) {
    console.log(`⏩ Skipped duplicate for ${avatar} (${uuid})`);
    return res.send("Duplicate skipped");
  }

  seen.set(uuid, { reason, lastTime: now });

  const content = formatMessage({ avatar, uuid, reason, time });

  if (!content || content.length > 2000) {
    console.error("❌ Invalid message content");
    return res.status(400).send("Invalid message content");
  }

  const targetWebhook = isValidWebhook(webhook) ? webhook : DEFAULT_WEBHOOK;
  enqueueToWebhook(content, targetWebhook);
  res.send("Queued");
});

app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

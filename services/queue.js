const fetch = require("node-fetch");

const queue = [];
let sending = false;
const SEND_DELAY_MS = 1100;
const DEFAULT_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const seen = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

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

function getQueueLength() {
  return queue.length;
}

function getQueuePreview() {
  return queue.map((item, i) => ({
    index: i,
    preview: item.content.slice(0, 100),
    webhook: item.webhook
  }));
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
        const delay = 10000;
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

module.exports = {
  enqueueToWebhook,
  getQueueLength,
  getQueuePreview,
  formatMessage,
  isValidWebhook,
  seen,
  COOLDOWN_MS
};

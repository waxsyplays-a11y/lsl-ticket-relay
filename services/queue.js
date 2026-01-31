const fetch = require("node-fetch");

const queue = [];
let sending = false;
const SEND_DELAY_MS = 1100;
const MAX_RETRIES = 5;

const DEFAULT_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const ADMIN_WEBHOOK = process.env.ADMIN_WEBHOOK_URL || null;
const WEBHOOKS = process.env.DISCORD_WEBHOOKS?.split(",") || [];
let webhookIndex = 0;

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

function getNextWebhook() {
  if (WEBHOOKS.length === 0) return DEFAULT_WEBHOOK;
  const hook = WEBHOOKS[webhookIndex];
  webhookIndex = (webhookIndex + 1) % WEBHOOKS.length;
  return hook;
}

function enqueueToWebhook(content, webhook) {
  const target = isValidWebhook(webhook) ? webhook : getNextWebhook();
  queue.push({ content, webhook: target, retries: 0 });
  processQueue();
}

function getQueueLength() {
  return queue.length;
}

function getQueuePreview() {
  return queue.map((item, i) => ({
    index: i,
    preview: item.content.slice(0, 100),
    webhook: item.webhook,
    retries: item.retries
  }));
}

async function notifyAdmin(message) {
  if (!ADMIN_WEBHOOK) return;
  try {
    await fetch(ADMIN_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.warn("⚠️ Failed to notify admin:", err.message);
  }
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

    const text = await res.text();

    if (!res.ok) {
      const isCloudflareBlock =
        res.status === 429 &&
        text.includes("cloudflare") &&
        (text.includes("Error 1015") || text.includes("You are being rate limited"));

      const retryAfter = res.headers.get("retry-after");
      const delay = isCloudflareBlock
        ? 10000
        : retryAfter
        ? parseFloat(retryAfter) * 1000
        : 5000;

      if (retries < MAX_RETRIES) {
        console.warn(`🛡️ Retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms`);
        await notifyAdmin(`🛡️ Cloudflare block or rate limit for:\n${content}\nRetrying in ${delay / 1000}s`);
        queue.unshift({ content, webhook, retries: retries + 1 });
        setTimeout(() => {
          sending = false;
          processQueue();
        }, delay);
      } else {
        console.error("❌ Max retries reached. Dropping message.");
        await notifyAdmin(`❌ Dropped message after ${MAX_RETRIES} retries:\n${content}`);
        sending = false;
        processQueue();
      }
      return;
    }

    console.log("✅ Message sent");
  } catch (err) {
    console.error("🔥 Send error:", err.message);
    if (retries < MAX_RETRIES) {
      queue.unshift({ content, webhook, retries: retries + 1 });
    }
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

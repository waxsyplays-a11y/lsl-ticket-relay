// server.js — EMARI Discord Relay (Rate-Limit Safe)

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK) {
  console.error("❌ DISCORD_WEBHOOK_URL missing");
  process.exit(1);
}

// Discord safe limits
const SEND_INTERVAL_MS = 5000; // 🔒 1 message every 5 seconds
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/* ================= STATE ================= */

let queue = [];
let sending = false;
const seen = new Map();

/* ================= UTILS ================= */

function sanitize(text) {
  return String(text)
    .replace(/[`*_~]/g, "")
    .replace(/</g, "")
    .replace(/>/g, "");
}

/* ================= QUEUE SENDER ================= */

async function sendNext() {
  if (sending || queue.length === 0) return;

  sending = true;
  const payload = queue.shift();

  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: payload })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Discord error ${res.status}: ${text}`);
    } else {
      console.log("✅ Sent to Discord");
    }
  } catch (err) {
    console.error("🔥 Discord send failed:", err.message);
  }

  setTimeout(() => {
    sending = false;
    sendNext();
  }, SEND_INTERVAL_MS);
}

/* ================= ROUTES ================= */

app.get("/", (_, res) => {
  res.send("✅ EMARI Relay Online");
});

app.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).send("Invalid payload");
  }

  const now = Date.now();
  const last = seen.get(uuid);

  if (last && last.reason === reason && now - last.time < DEDUPE_WINDOW_MS) {
    return res.send("Duplicate ignored");
  }

  seen.set(uuid, { reason, time: now });

  const message =
    "🚨 **EMARI Alert** 🚨\n\n" +
    "**Avatar:** " + sanitize(avatar) + "\n" +
    "**UUID:** " + sanitize(uuid) + "\n" +
    "**Reason:**\n" + sanitize(reason) + "\n\n" +
    "**Time:** " + sanitize(time);

  queue.push(message);
  sendNext();

  res.send("Queued");
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 EMARI Relay listening on port " + PORT);
});

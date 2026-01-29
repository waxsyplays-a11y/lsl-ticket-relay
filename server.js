// server.js — EMARI Discord Relay (Rate-Limited & Safe)

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK) {
  console.error("❌ DISCORD_WEBHOOK_URL missing");
  process.exit(1);
}

// ---- Discord rate safety ----
const QUEUE = [];
let sending = false;
const SEND_INTERVAL = 5000; // ms (safe for Discord)

// ---- Helper ----
function sanitize(text) {
  return String(text)
    .replace(/[`*_~]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---- Queue sender ----
async function processQueue() {
  if (sending || QUEUE.length === 0) return;

  sending = true;
  const msg = QUEUE.shift();

  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg })
    });

    if (!res.ok) {
      console.error(`❌ Discord error ${res.status}`);
    }
  } catch (e) {
    console.error("🔥 Send failed:", e.message);
  }

  setTimeout(() => {
    sending = false;
    processQueue();
  }, SEND_INTERVAL);
}

// ---- Routes ----
app.get("/", (req, res) => {
  res.send("✅ EMARI Discord Relay Online");
});

app.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).send("Invalid payload");
  }

  const message = [
    "📡 **EMARI Log**",
    `👤 ${sanitize(avatar)}`,
    `🆔 ${sanitize(uuid)}`,
    `📝 ${sanitize(reason)}`,
    `🕒 ${sanitize(time)}`
  ].join("\n");

  QUEUE.push(message);
  processQueue();

  res.send("Queued");
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Relay listening on ${PORT}`);
});

// server.js — EMARI Discord Relay (Stable + Render-safe)

import express from "express";
import dotenv from "dotenv";

// Render-safe fetch import
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

dotenv.config();

const app = express();
app.use(express.json());

// ===== CONFIG =====
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DISCORD_LEN = 1900;

// ===== SAFETY CHECK =====
if (!WEBHOOK) {
  console.error("❌ DISCORD_WEBHOOK_URL missing in environment");
  process.exit(1);
}

// Cooldown cache (uuid → timestamp)
const seen = new Map();

// ===== HELPERS =====
function sanitize(text) {
  return String(text || "")
    .replace(/[`*_~]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage({ avatar, uuid, reason, time }) {
  return [
    "🚨 **EMARI Security Alert** 🚨",
    `**Avatar:** ${sanitize(avatar)}`,
    `**UUID:** ${sanitize(uuid)}`,
    `**Reason:**\n${sanitize(reason).slice(0, 1200)}`,
    `**Time:** ${sanitize(time)}`
  ].join("\n\n").slice(0, MAX_DISCORD_LEN);
}

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.send("✅ EMARI Discord Relay is online");
});

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, reason, time } = req.body;

    // Validate payload
    if (!avatar || !uuid || !reason || !time) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    // Cooldown check
    const now = Date.now();
    const last = seen.get(uuid);
    if (last && now - last < COOLDOWN_MS) {
      return res.send("⏩ Duplicate alert skipped");
    }
    seen.set(uuid, now);

    // Build Discord message
    const content = buildMessage({ avatar, uuid, reason, time });

    // Send to Discord
    const response = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    // Discord success = 204 or 200
    if (response.status === 204 || response.status === 200) {
      console.log(`✅ Relayed alert for ${avatar}`);
      return res.send("Alert relayed");
    }

    // Discord error
    const errText = await response.text();
    console.error(
      `❌ Discord webhook error: ${response.status} → ${errText}`
    );
    return res.status(500).send("Discord rejected message");

  } catch (err) {
    console.error("🔥 Relay crash:", err);
    return res.status(500).send("Relay failure");
  }
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

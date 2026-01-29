// server.js — EMARI Discord Relay (Hardened)

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional: IP whitelist (add IPs to allow only trusted sources)
// const ALLOWED_IPS = ["123.45.67.89", "98.76.54.32"];

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.error("❌ DISCORD_WEBHOOK_URL is not set");
  process.exit(1);
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const seen = new Map(); // uuid → { reason, lastTime }

// Root route
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is online and secure");
});

// Relay endpoint
app.post("/relay", async (req, res) => {
  try {
    // Optional: IP filtering
    // const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    // if (!ALLOWED_IPS.includes(ip)) {
    //   console.warn(`⛔ Blocked request from unauthorized IP: ${ip}`);
    //   return res.status(403).send("Forbidden");
    // }

    const { avatar, uuid, reason, time } = req.body;

    // Validate payload
    if (
      typeof avatar !== "string" ||
      typeof uuid !== "string" ||
      typeof reason !== "string" ||
      typeof time !== "string"
    ) {
      console.warn("⚠️ Invalid payload received:", req.body);
      return res.status(400).json({
        error: "Missing or invalid fields: avatar, uuid, reason, or time"
      });
    }

    const now = Date.now();
    const previous = seen.get(uuid);

    if (previous && previous.reason === reason && now - previous.lastTime < COOLDOWN_MS) {
      console.log(`⏩ Duplicate alert skipped for ${avatar} (${uuid})`);
      return res.send("Duplicate alert skipped");
    }

    seen.set(uuid, { reason, lastTime: now });

    // Format message safely
    const content = [
      "🚨 **EMARI Alert** 🚨",
      `**Avatar:** ${sanitize(avatar)} (${sanitize(uuid)})`,
      `**Reason:**\n${sanitize(reason)}`,
      `**Time:** ${sanitize(time)}`
    ].join("\n\n");

    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Discord webhook error: HTTP ${response.status} → ${errorText}`);
      return res.status(500).send("Failed to send to Discord");
    }

    console.log(`✅ Alert relayed for ${avatar} (${uuid})`);
    res.send("Alert relayed successfully");
  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).send("Internal server error");
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Uncaught error:", err);
  res.status(500).send("Unexpected server error");
});

// Sanitize input to prevent Discord formatting issues
function sanitize(text) {
  return String(text)
    .replace(/[`*_~]/g, "") // remove markdown control characters
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

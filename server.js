// server.js — EMARI Discord Relay

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env file (for local dev)
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load Discord webhook from environment
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.error("❌ DISCORD_WEBHOOK_URL is not set");
  process.exit(1);
}

// Cooldown settings
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const seen = new Map(); // uuid → { reason, lastTime }

// Root route
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is running");
});

// Relay endpoint
app.post("/relay", async (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  // Validate input
  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).json({
      error: "Missing required fields: avatar, uuid, reason, or time"
    });
  }

  const now = Date.now();
  const previous = seen.get(uuid);

  // Suppress duplicates
  if (previous && previous.reason === reason && now - previous.lastTime < COOLDOWN_MS) {
    console.log(`⏩ Skipped duplicate alert for ${avatar} (${uuid})`);
    return res.send("Duplicate alert skipped");
  }

  seen.set(uuid, { reason, lastTime: now });

  // Format Discord message
  const content = [
    "```",
    "🚨 EMARI Alert 🚨",
    "",
    `Avatar: ${avatar} (${uuid})`,
    `Reason:\n${reason}`,
    `Time: ${time}`,
    "🚨 EMARI Alert 🚨",
    "```"
  ].join("\n");

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Discord webhook error:", errorText);
      return res.status(500).send("Failed to send to Discord");
    }

    console.log(`✅ Alert sent for ${avatar} (${uuid})`);
    res.send("Alert relayed successfully");
  } catch (err) {
    console.error("🔥 Relay error:", err);
    res.status(500).send("Internal server error");
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 Uncaught error:", err);
  res.status(500).send("Unexpected server error");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

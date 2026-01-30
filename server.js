// ================================
// EMARI Discord Relay (Refined)
// ================================

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error("❌ Missing DISCORD_WEBHOOK_URL in .env");
  process.exit(1);
}

// Duplicate suppression memory
const seen = new Map(); // uuid -> { reason, lastTime }
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Format message for Discord
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

// Routes
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is running");
});

app.post("/relay", async (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

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

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Discord error: ${response.status} → ${errorText}`);
      return res.status(500).send("Discord relay failed");
    }

    console.log(`✅ Alert sent for ${avatar} (${uuid})`);
    res.send("OK");
  } catch (err) {
    console.error("🔥 Relay error:", err.message);
    res.status(500).send("Relay server error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

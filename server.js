import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Load environment variable
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.error("❌ Missing DISCORD_WEBHOOK_URL environment variable");
  process.exit(1);
}

// Constants
const COOLDOWN = 5 * 60 * 1000; // 5 minutes
const seen = new Map(); // uuid -> { reason, lastTime }

// Routes
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is active");
});

app.post("/relay", async (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  // Validate payload
  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).json({
      error: "Missing required fields: avatar, uuid, reason, or time"
    });
  }

  const now = Date.now();
  const previous = seen.get(uuid);

  // Suppress duplicates
  if (previous && previous.reason === reason && now - previous.lastTime < COOLDOWN) {
    console.log(`⏩ Skipped duplicate alert for ${avatar} (${uuid})`);
    return res.send("Duplicate alert skipped");
  }

  seen.set(uuid, { reason, lastTime: now });

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
  } catch (error) {
    console.error("❌ Relay server error:", error);
    res.status(500).send("Internal server error");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay running on port ${PORT}`);
});

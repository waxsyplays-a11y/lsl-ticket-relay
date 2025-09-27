// server.js
const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// Discord webhook URL should be stored in Render → Environment variables
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

if (!DISCORD_WEBHOOK) {
  console.error("❌ ERROR: DISCORD_WEBHOOK env variable is not set!");
  process.exit(1);
}

app.post("/relay", async (req, res) => {
  try {
    const { log, avatar, reason } = req.body;

    if (!log) {
      return res.status(400).json({ error: "Missing 'log' field in request body" });
    }

    // Build the message for Discord
    let content = log;
    if (avatar) content += `\n👤 Avatar: ${avatar}`;
    if (reason) content += `\n📌 Reason: ${reason}`;

    // Send to Discord
    const response = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Discord webhook error:", text);
      return res.status(500).json({ error: "Discord rejected message", details: text });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Relay server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Relay server running on port ${PORT}`));

const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(bodyParser.json());

// Relay endpoint
app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, reason, time } = req.body;

    if (!avatar || !uuid || !reason || !time) {
      return res.status(400).json({ error: "Missing avatar, uuid, reason, or time field" });
    }

    // Format log
    const logMessage = `🚨 EMARI Alert 🚨\n\n` +
      `Avatar: ${avatar} (${uuid})\n` +
      `Reason:\n${reason}\n` +
      `Time: ${time}\n` +
      `🚨 EMARI Alert 🚨`;

    // Send to Discord webhook
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: "Missing DISCORD_WEBHOOK_URL env variable" });
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: logMessage })
    });

    res.json({ success: true, relayed: logMessage });
  } catch (err) {
    console.error("Relay error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Relay server running on port ${PORT}`);
});

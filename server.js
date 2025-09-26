import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

// 🔗 Set your Discord Webhook here
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/XXXX/XXXX";

app.use(express.json());

// LSL will POST logs here
app.post("/relay", async (req, res) => {
  try {
    const log = req.body.log;

    if (!log) {
      return res.status(400).json({ error: "Missing log field" });
    }

    // Send log to Discord
    await axios.post(DISCORD_WEBHOOK, {
      content: log
    });

    console.log("✅ Log relayed to Discord:", log);
    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error relaying log:", err.message);
    res.status(500).json({ error: "Failed to relay log" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ LSL Ticket Relay is running");
});

app.listen(PORT, () => {
  console.log(`🚀 Relay server running on port ${PORT}`);
});

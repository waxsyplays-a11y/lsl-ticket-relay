import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

// Replace with your actual Discord webhook URL
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "YOUR_DISCORD_WEBHOOK_URL";

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ EMARI Relay is running.");
});

// LSL logs endpoint
app.post("/", async (req, res) => {
  try {
    const log = req.body.log || "⚠️ Empty log received";
    console.log("📩 Incoming log:", log);

    await axios.post(DISCORD_WEBHOOK, {
      content: log
    });

    res.status(200).send("✅ Log relayed to Discord");
  } catch (err) {
    console.error("❌ Relay error:", err.message);
    res.status(500).send("Relay error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay running on port ${PORT}`);
});

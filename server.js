import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔑 Discord webhook stored as Render secret
const webhook = process.env.DISCORD_WEBHOOK;

// Root check
app.get("/", (req, res) => {
  res.send("✅ LSL → Discord Relay is running");
});

// LSL POST endpoint
app.post("/relay", async (req, res) => {
  try {
    const log = req.body.log || "⚠️ No log received";

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "📡 **EMARI Log**\n" + log
      })
    });

    res.send("OK");
  } catch (err) {
    console.error("Relay error:", err);
    res.status(500).send("Relay failed");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Relay running on port " + PORT);
});

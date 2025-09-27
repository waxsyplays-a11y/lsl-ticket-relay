import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, log } = req.body;

    if (!avatar || !uuid || !log) {
      return res.status(400).json({ error: "Missing avatar, uuid or log field" });
    }

    // Forward as plain content to ensure line breaks are preserved
    const payload = {
      content: log
    };

    const response = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Relay error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Relay listening on port ${PORT}`);
});

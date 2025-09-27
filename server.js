import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, reason, time } = req.body;
    if (!avatar || !uuid || !reason || !time) {
      return res.status(400).json({ error: "Missing avatar, uuid, reason, or time field" });
    }

    const content = `🚨 EMARI Alert 🚨

Avatar: ${avatar} (${uuid})
Reason:
${reason}
Time: ${time}
🚨 EMARI Alert 🚨`;

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(3000, () => console.log("Relay server running on port 3000"));

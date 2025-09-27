import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make sure you set this in Render → Environment
const webhook = process.env.DISCORD_WEBHOOK_URL;

if (!webhook) {
  console.error("❌ Missing DISCORD_WEBHOOK_URL env variable");
  process.exit(1);
}

app.get("/", (req, res) => {
  res.send("Relay is running ✅");
});

app.post("/relay", async (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  // Validate input
  if (!avatar || !uuid || !reason || !time) {
    return res
      .status(400)
      .json({ error: "Missing avatar, uuid, reason, or time field" });
  }

  // Format the Discord message
  const content =
    "```" +
    "🚨 EMARI Alert 🚨\n\n" +
    `Avatar: ${avatar} (${uuid})\n` +
    `Reason:\n${reason}` +
    `Time: ${time}\n` +
    "🚨 EMARI Alert 🚨" +
    "```";

  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!r.ok) {
      console.error("❌ Discord error:", await r.text());
      return res.status(500).send("Discord relay failed");
    }

    console.log("✅ Logged alert for", avatar, uuid);
    res.send("OK");
  } catch (err) {
    console.error("❌ Relay error:", err);
    res.status(500).send("Relay server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Relay running on port " + PORT));

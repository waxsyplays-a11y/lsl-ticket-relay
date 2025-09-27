// server.js
const seen = new Map(); // uuid -> lastReason

app.post("/relay", async (req, res) => {
  const { avatar, uuid, reason, time } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).json({ error: "Missing avatar, uuid, reason, or time field" });
  }

  // Prevent duplicates
  const lastReason = seen.get(uuid);
  if (lastReason === reason) {
    console.log("⏩ Skipping duplicate alert for", avatar, uuid);
    return res.send("Skipped duplicate");
  }
  seen.set(uuid, reason);

  const log = `🚨 EMARI Alert 🚨\n\nAvatar: ${avatar} (${uuid})\nReason:\n${reason}\nTime: ${time}\n🚨 EMARI Alert 🚨`;

  try {
    const r = await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "```" + log + "```" })
    });

    if (!r.ok) {
      console.error("Discord error:", await r.text());
      return res.status(500).send("Discord relay failed");
    }

    console.log("✅ Logged alert for", avatar, uuid);
    res.send("OK");
  } catch (err) {
    console.error("Relay error:", err);
    res.status(500).send("Relay server error");
  }
});

// server.js
const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// Valid tickets + whitelist here (or load from JSON/DB)
const validTickets = ["GA", "RSS", "HCPCREW", "ROOMONE", "ROOMTWO"];
const whitelist = ["owner-uuid-here", "another-uuid-here"];
const SCRIPT_LIMIT = 70;

function checkAvatar(avatar, uuid, attachments, scriptCount) {
  if (whitelist.includes(uuid)) return null; // skip

  let reasons = [];
  let hasTicket = attachments.some(att =>
    validTickets.some(ticket =>
      att.toLowerCase().includes(ticket.toLowerCase())
    )
  );

  if (!hasTicket) reasons.push("❌ No valid ticket");
  if (scriptCount > SCRIPT_LIMIT) reasons.push(`⚠️ Script count: ${scriptCount} > ${SCRIPT_LIMIT}`);

  return reasons.length > 0 ? reasons.join("\n") : null;
}

app.post("/relay", async (req, res) => {
  try {
    const { avatar, uuid, attachments = [], scriptCount = 0 } = req.body;

    if (!avatar || !uuid) {
      return res.status(400).json({ error: "Missing avatar or uuid field" });
    }

    const reason = checkAvatar(avatar, uuid, attachments, scriptCount);
    if (!reason) return res.json({ ok: true, skipped: true });

    const log =
      `🚨 EMARI Alert 🚨\n\n` +
      `Avatar: ${avatar} (${uuid})\n` +
      `Reason:\n${reason}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `🚨 EMARI Alert 🚨`;

    const response = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: log })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Discord rejected message", details: text });
    }

    res.json({ ok: true, sent: true });
  } catch (err) {
    console.error("Relay error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Relay running on port ${PORT}`));

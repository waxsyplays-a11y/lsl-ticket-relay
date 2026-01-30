const express = require("express");
const { enqueueToWebhook, getQueueLength, formatMessage, isValidWebhook, seen, COOLDOWN_MS } = require("../services/queue");

const router = express.Router();

router.get("/status", (req, res) => {
  const uptime = Math.floor(process.uptime());
  const minutes = Math.floor(uptime / 60);
  const seconds = uptime % 60;
  res.json({
    status: "ok",
    queueLength: getQueueLength(),
    uptime: `${minutes}m ${seconds}s`
  });
});

router.get("/queue", (req, res) => {
  res.json({ queue: require("../services/queue").getQueuePreview() });
});

router.post("/relay", (req, res) => {
  const { avatar, uuid, reason, time, webhook, log } = req.body;

  if (!avatar || !uuid || !reason || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = Date.now();
  const previous = seen.get(uuid);

  if (previous && previous.reason === reason && now - previous.lastTime < COOLDOWN_MS) {
    console.log(`⏩ Skipped duplicate for ${avatar} (${uuid})`);
    return res.send("Duplicate skipped");
  }

  seen.set(uuid, { reason, lastTime: now });

  const content = formatMessage({ avatar, uuid, reason, time });

  if (!content || content.length > 2000) {
    return res.status(400).send("Invalid message content");
  }

  const shouldLog = log !== false && log !== "false";
  if (shouldLog) {
    const targetWebhook = isValidWebhook(webhook) ? webhook : process.env.DISCORD_WEBHOOK_URL;
    enqueueToWebhook(content, targetWebhook);
    console.log(`📨 Queued alert for ${avatar}`);
  } else {
    console.log(`🛑 Logging skipped for ${avatar}`);
  }

  res.send("Processed");
});

module.exports = router;

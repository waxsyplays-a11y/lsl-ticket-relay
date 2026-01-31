const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Main Relay Endpoint
app.post('/api/relay', async (req, res) => {
    const { webhook, avatar, uuid, reason, time, content } = req.body;

    // 1. Validate the Webhook
    if (!webhook || !webhook.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).send("❌ Invalid or missing Webhook URL.");
    }

    // 2. Format the message
    // If LSL sends 'content', use it. Otherwise, build a nice string from the other fields.
    let discordContent = content;
    if (!discordContent) {
        discordContent = `🚨 **EMARI Security Alert**\n` +
                         `👤 **User:** ${avatar || 'Unknown'}\n` +
                         `🆔 **UUID:** ${uuid || 'N/A'}\n` +
                         `⚠️ **Reason:** ${reason || 'Rule Violation'}\n` +
                         `⏰ **Time:** ${time || 'N/A'}`;
    }

    // 3. Send to Discord
    try {
        await axios.post(webhook, {
            content: discordContent,
            username: "EMARI Scanner Relay"
        });

        console.log(`✅ Logged violation for ${avatar}`);
        res.status(200).send("🚀 Message delivered to Discord.");

    } catch (error) {
        if (error.response) {
            // Discord rejected it (Rate Limit or Bad Webhook)
            const status = error.response.status;
            if (status === 429) {
                console.error("⚠️ Discord Rate Limit hit!");
                return res.status(429).send("🐢 Rate limited by Discord. Slow down LSL scans.");
            }
            return res.status(status).send(`❌ Discord Error: ${status}`);
        }
        
        console.error("🌐 Connection Error:", error.message);
        res.status(500).send("🔥 Internal Server Error.");
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`📡 Relay active on port ${PORT}`);
});

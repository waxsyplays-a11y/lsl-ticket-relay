const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// CONFIGURATION: Paste your actual Discord Webhook URL here
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1467197651169575096/q75TbQ08LKSwxMd-3Z0I2ARZJvwl_cChD005izkbYSyiMa7QCS6viQm5RyZJrky8YNTH";

app.post('/api/relay', async (req, res) => {
    // The LSL script sends { "content": "..." }
    const { content } = req.body;

    if (!content) {
        return res.status(400).send("No content provided");
    }

    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            content: content,
            username: "EMARI Security Relay"
        });

        res.status(200).send("Sent to Discord");
    } catch (error) {
        console.error("Discord Error:", error.response?.status || error.message);
        res.status(500).send("Relay failed to reach Discord");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Relay running on port ${PORT}`));

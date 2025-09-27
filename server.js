// EMARI Discord Relay v5.0
// Receives scan logs from LSL and forwards to Discord

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔧 Replace with your actual Discord webhook URL
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1421196532992049253/Lo4rVU2g_InE3yZXKNv2hypgkjQL80SthRODlCqVnbYZoh-5clKmXr0kmVYE2Z9o6Jqq';

app.use(bodyParser.json());

app.post('/relay', async (req, res) => {
    try {
        const { event, log } = req.body;

        if (!log) {
            return res.status(400).send('Missing log message');
        }

        const timestamp = new Date().toISOString();
        const content = `📡 **EMARI Scan Log**\n\n**Event:** ${event || 'Unknown'}\n**Time:** ${timestamp}\n**Message:**\n${decodeURIComponent(log)}`;

        await axios.post(DISCORD_WEBHOOK, { content });

        console.log(`[${timestamp}] Log relayed: ${log}`);
        res.status(200).send('Log relayed to Discord');
    } catch (err) {
        console.error('Relay error:', err.message);
        res.status(500).send('Internal server error');
    }
});

app.get('/', (req, res) => {
    res.send('✅ EMARI Relay is running.');
});

app.listen(PORT, () => {
    console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

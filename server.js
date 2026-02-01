const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1467197651169575096/q75TbQ08LKSwxMd-3Z0I2ARZJvwl_cChD005izkbYSyiMa7QCS6viQm5RyZJrky8YNTH";

// A small helper to force a wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/relay', async (req, res) => {
    const { content } = req.body;

    // Add a 1-second "buffer" to every request to prevent 429 errors
    await wait(1000); 

    try {
        await axios.post(DISCORD_WEBHOOK_URL, { content });
        res.status(200).send("✅ Delivered");
    } catch (error) {
        if (error.response?.status === 429) {
            console.error("🔥 DISCORD RATE LIMIT HIT! Slow down the LSL script.");
            return res.status(429).send("Discord is overwhelmed.");
        }
        res.status(500).send("Error");
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Relay active on ${PORT}`));

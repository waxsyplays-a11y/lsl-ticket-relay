const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/962111321;kj/q75TbQ08LKSwxMd-3Z0I2ARZJvwl_cChD005izkbYSyiMa7QCS6viQm5RyZJrky8YNTH";

// Function to send with automatic retry on 429
async function sendToDiscord(payload, retries = 3) {
    try {
        await axios.post(DISCORD_WEBHOOK_URL, payload);
        console.log("✅ Delivered to Discord");
        return { success: true };
    } catch (error) {
        if (error.response?.status === 429 && retries > 0) {
            const retryAfter = (error.response.data.retry_after || 5) * 1000;
            console.log(`⚠️ Rate Limited. Retrying in ${retryAfter}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return sendToDiscord(payload, retries - 1);
        }
        throw error;
    }
}

app.post('/api/relay', async (req, res) => {
    try {
        await sendToDiscord(req.body);
        res.status(200).send("OK");
    } catch (err) {
        console.error("❌ Failed after retries:", err.message);
        res.status(500).send("Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart Relay active on ${PORT}`));

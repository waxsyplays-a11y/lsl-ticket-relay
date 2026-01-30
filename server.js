const express = require("express");
const dotenv = require("dotenv");
const relayRoutes = require("./routes/relay");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("✅ EMARI Relay API is live");
});

app.use("/api", relayRoutes);

app.listen(PORT, () => {
  console.log(`🚀 EMARI Relay listening on port ${PORT}`);
});

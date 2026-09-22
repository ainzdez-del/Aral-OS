const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "ARAL OS",
    status: "online",
    message: "ARAL OS is alive"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ARAL OS running on port ${PORT}`);
});

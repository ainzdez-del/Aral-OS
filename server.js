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

// Telegram webhook
app.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      await sendTelegramMessage(
        chatId,
        `ARAL OS получил сообщение:\n\n${text}`
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram error:", error);
    res.sendStatus(500);
  }
});

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ARAL OS running on port ${PORT}`);
});

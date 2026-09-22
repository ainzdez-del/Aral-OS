const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "ARAL OS",
    status: "online",
    message: "ARAL OS AI is alive"
  });
});

// Telegram webhook
app.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;

    if (!update.message) {
      return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const userText = update.message.text || "";

    const aiAnswer = await askAI(userText);

    await sendTelegramMessage(chatId, aiAnswer);

    res.sendStatus(200);

  } catch (error) {
    console.error("ERROR:", error);
    res.sendStatus(500);
  }
});


// =========================
// AI
// =========================

async function askAI(userText) {

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content: `
Ты — ARAL OS, центральный AI-агент.

Отвечай на русском языке.

Твоя задача:
- понимать запрос пользователя;
- анализировать информацию;
- давать конкретные и полезные ответы;
- не повторять вопрос пользователя;
- если задача сложная — разбивать её на этапы;
- не придумывать факты.

В дальнейшем ты будешь центральным агентом системы ARAL OS,
который сможет управлять специализированными AI-агентами.
`
          },
          {
            role: "user",
            content: userText
          }
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenRouter error:", data);
    throw new Error("OpenRouter API error");
  }

  return data.choices[0].message.content;
}


// =========================
// Telegram
// =========================

async function sendTelegramMessage(chatId, text) {

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
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


// =========================
// Server
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ARAL OS running on port ${PORT}`);
});

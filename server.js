const express = require("express");
const {
  initMemory,
  saveMemory,
  getProjectContext,
  saveConversationTurn,
  getRecentConversation
} = require("./memory");
 
const app = express();
 
app.use(express.json());
 
 
// ========================================
// ARAL OS — HOME
// ========================================
 
app.get("/", (req, res) => {
  res.json({
    name: "ARAL OS",
    status: "online",
    system: "Master Agent + AI Team"
  });
});
 
 
// ========================================
// TELEGRAM WEBHOOK
// ========================================
 
app.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
 
    if (!update.message) {
      return res.sendStatus(200);
    }
 
    const chatId = update.message.chat.id;
    const userText = update.message.text || "";
 
    if (!userText) {
      return res.sendStatus(200);
    }
 
    console.log("USER:", userText);
 
    // Сохраняем сообщение пользователя в историю диалога
    await saveConversationTurn({ chatId, role: "user", content: userText });
 
    // Передаём задачу главному агенту
    const result = await masterAgent(userText, chatId);
 
    // Сохраняем ответ бота в историю диалога
    await saveConversationTurn({ chatId, role: "assistant", content: result });
 
    await sendTelegramMessage(chatId, result);
 
    res.sendStatus(200);
 
  } catch (error) {
    console.error("ARAL OS ERROR:", error);
 
    if (req.body?.message?.chat?.id) {
      await sendTelegramMessage(
        req.body.message.chat.id,
        "Произошла ошибка при обработке задачи. Проверь логи ARAL OS."
      );
    }
 
    res.sendStatus(200);
  }
});
 
 
// ========================================
// MASTER AGENT
// ========================================
 
async function masterAgent(userText, chatId) {
 
  console.log("MASTER получил задачу:", userText);
 
  // Сначала Master определяет специалиста
  const agent = await chooseAgent(userText);
 
  console.log("MASTER выбрал:", agent);
 
  // Передаём задачу выбранному агенту
  const result = await runAgent(agent, userText, chatId);
 
  return result;
}
 
 
// ========================================
// ВЫБОР СПЕЦИАЛИСТА
// ========================================
 
async function chooseAgent(userText) {
 
  const prompt = `
Ты — MASTER AGENT системы ARAL OS.
 
Твоя задача — определить, какой специалист должен выполнить задачу пользователя.
 
Доступные специалисты:
 
MARKETING
- маркетинг
- маркетинговые стратегии
- реклама
- CTR
- hooks
- retention
- воронки
- позиционирование
- аудитория
- продвижение
 
RESEARCH
- исследование
- конкуренты
- анализ рынка
- тренды
- поиск информации
- изучение ниши
 
STRATEGY
- стратегия проекта
- план запуска
- контент-план
- развитие канала
- бизнес-стратегия
- долгосрочный план
 
SCRIPTWRITER
- сценарий
- текст ролика
- структура видео
- диалог
- storytelling
- сценарий TikTok
- сценарий YouTube
 
GENERAL
- если задача не подходит ни под одного специалиста.
 
Ответь ТОЛЬКО одним словом:
 
MARKETING
или
RESEARCH
или
STRATEGY
или
SCRIPTWRITER
или
GENERAL
 
Задача пользователя:
${userText}
`;
 
  const answer = await askAI(prompt);
 
  const normalized = answer
    .trim()
    .toUpperCase();
 
  if (normalized.includes("MARKETING")) {
    return "MARKETING";
  }
 
  if (normalized.includes("RESEARCH")) {
    return "RESEARCH";
  }
 
  if (normalized.includes("STRATEGY")) {
    return "STRATEGY";
  }
 
  if (normalized.includes("SCRIPTWRITER")) {
    return "SCRIPTWRITER";
  }
 
  return "GENERAL";
}
 
 
// ========================================
// СООТВЕТСТВИЕ АГЕНТА И ТИПА ЗАПИСИ В ПАМЯТИ
// ========================================
 
function memoryTypeFor(agent) {
  switch (agent) {
    case "MARKETING":
      return "marketing_strategy";
    case "RESEARCH":
      return "research";
    case "STRATEGY":
      return "strategy";
    case "SCRIPTWRITER":
      return "script";
    default:
      return "general";
  }
}
 
 
// ========================================
// ВЕБ-ПОИСК (Tavily) — только для Research Agent
// ========================================
 
async function webSearch(query, maxResults = 5) {
 
  const apiKey = process.env.TAVILY_API_KEY;
 
  if (!apiKey) {
    console.error("TAVILY_API_KEY is missing — пропускаем веб-поиск");
    return null;
  }
 
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        max_results: maxResults,
        search_depth: "basic"
      })
    });
 
    const data = await response.json();
 
    if (!response.ok) {
      console.error("TAVILY ERROR:", data);
      return null;
    }
 
    return data.results || [];
 
  } catch (err) {
    console.error("TAVILY REQUEST ERROR:", err);
    return null;
  }
}
 
function formatSearchResults(results) {
 
  if (!results || results.length === 0) {
    return "";
  }
 
  const formatted = results
    .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");
 
  return `WEB SEARCH RESULTS (реальные результаты поиска в интернете — используй их, ссылайся на источники по URL):\n\n${formatted}`;
}
 
 
// ========================================
// ЗАПУСК СПЕЦИАЛИСТА
// ========================================
 
async function runAgent(agent, userText, chatId) {
 
  let systemPrompt = "";
 
  if (agent === "MARKETING") {
 
    systemPrompt = `
Ты — MARKETING AGENT команды ARAL OS.
 
Ты профессиональный AI-маркетолог.
 
Твоя специализация:
 
- маркетинговые стратегии
- TikTok
- YouTube
- hooks
- CTR
- retention
- storytelling
- позиционирование
- психология внимания
- контент-маркетинг
- анализ аудитории
- идеи продвижения
 
Давай конкретные результаты.
 
Если пользователь просит стратегии —
объясняй механизм каждой стратегии и как её применить.
 
Если пользователь просит идеи —
давай конкретные идеи, а не общие советы.
 
Если речь идёт о коротких видео —
особое внимание уделяй первым 1–5 секундам,
удержанию внимания и причинам досмотра.
`;
 
  }
 
  else if (agent === "RESEARCH") {
 
    systemPrompt = `
Ты — RESEARCH AGENT команды ARAL OS.
 
Твоя задача — исследовательская аналитика.
 
Анализируй:
 
- конкурентов
- рынки
- ниши
- тренды
- контент
- повторяющиеся закономерности
- аудитории
- форматы
- темы
- механики привлечения внимания
 
Разделяй:
1. Факты
2. Наблюдения
3. Гипотезы
4. Выводы
 
У тебя ЕСТЬ доступ к реальному веб-поиску.
Если ниже есть блок WEB SEARCH RESULTS — опирайся на него,
цитируй конкретные факты и указывай источник (URL) рядом с фактом.
 
Если блока WEB SEARCH RESULTS нет — честно скажи,
что не смог выполнить поиск, и не выдумывай источники.
`;
 
  }
 
  else if (agent === "STRATEGY") {
 
    systemPrompt = `
Ты — STRATEGY AGENT команды ARAL OS.
 
Ты отвечаешь за стратегию проекта.
 
Создавай:
 
- планы запуска
- контент-планы
- стратегии развития
- последовательности действий
- тестовые гипотезы
- KPI
- этапы проекта
- варианты масштабирования
 
Всегда превращай идею в конкретный план действий.
 
Если задача большая — разбивай её на этапы.
`;
 
  }
 
  else if (agent === "SCRIPTWRITER") {
 
    systemPrompt = `
Ты — SCRIPTWRITER AGENT команды ARAL OS.
 
Ты профессиональный сценарист коротких и длинных видео.
 
Твоя специализация:
 
- TikTok
- YouTube Shorts
- YouTube
- storytelling
- hooks
- retention
- структура сценария
- эмоциональные повороты
- CTA
 
При создании короткого видео думай о структуре:
 
HOOK
↓
CURIOSITY
↓
VALUE / STORY
↓
ESCALATION
↓
PAYOFF
↓
CTA
 
Первые секунды должны сразу создавать причину продолжить просмотр.
 
Не пиши скучные вступления вроде:
"Сегодня я расскажу вам..."
 
Делай сценарии конкретными и пригодными для съёмки.
`;
 
  }
 
  else {
 
    systemPrompt = `
Ты — MASTER AGENT ARAL OS.
 
Отвечай как центральный AI-ассистент проекта.
 
Помогай пользователю решать задачу максимально конкретно.
 
Если задача относится к маркетингу, исследованиям,
стратегии или сценариям — объясни, какой специалист
из команды лучше всего подходит.
`;
 
  }
 
  // === ПАМЯТЬ ПРОЕКТА: что уже сделали агенты ===
  let projectContext = "";
 
  try {
    projectContext = await getProjectContext("default");
  } catch (memError) {
    console.error("MEMORY READ ERROR:", memError);
  }
 
  // === ПАМЯТЬ РАЗГОВОРА: недавний диалог с этим чатом ===
  let conversationContext = "";
 
  try {
    conversationContext = await getRecentConversation(chatId);
  } catch (convError) {
    console.error("CONVERSATION READ ERROR:", convError);
  }
 
  // === ВЕБ-ПОИСК: только для Research Agent ===
  let searchContext = "";
 
  if (agent === "RESEARCH") {
    const results = await webSearch(userText);
    searchContext = formatSearchResults(results);
  }
 
  const contextBlocks = [systemPrompt, conversationContext, projectContext, searchContext]
    .filter(Boolean)
    .join("\n\n");
 
  const result = await askAIWithSystem(
    contextBlocks,
    userText
  );
 
  // === ПАМЯТЬ: сохраняем результат этого агента ===
  try {
    await saveMemory({
      project: "default",
      type: memoryTypeFor(agent),
      topic: userText.slice(0, 100),
      content: result
    });
  } catch (memError) {
    console.error("MEMORY SAVE ERROR:", memError);
  }
 
  return result;
}
 
 
// ========================================
// AI REQUEST
// ========================================
 
async function askAI(userText) {
 
  return await askAIWithSystem(
    `
Ты — ARAL OS MASTER AGENT.
 
Определи задачу пользователя максимально точно.
`,
    userText
  );
 
}
 
 
async function askAIWithSystem(systemPrompt, userText) {
 
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
            content: systemPrompt
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
    console.error("OPENROUTER ERROR:", data);
    throw new Error("OpenRouter API error");
  }
 
  if (
    !data.choices ||
    !data.choices[0] ||
    !data.choices[0].message
  ) {
    console.error("BAD AI RESPONSE:", data);
    throw new Error("Invalid AI response");
  }
 
  return data.choices[0].message.content;
}
 
 
// ========================================
// TELEGRAM
// ========================================
 
async function sendTelegramMessage(chatId, text) {
 
  const token = process.env.TELEGRAM_BOT_TOKEN;
 
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }
 
  const MAX_LENGTH = 4000; // чуть меньше лимита Telegram (4096) для запаса
  const chunks = [];
 
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.slice(i, i + MAX_LENGTH));
  }
 
  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
 
        headers: {
          "Content-Type": "application/json"
        },
 
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk
        })
      }
    );
 
    if (!response.ok) {
 
      const errorText = await response.text();
 
      console.error(
        "TELEGRAM ERROR:",
        errorText
      );
 
      throw new Error(errorText);
    }
  }
}
 
 
// ========================================
// SERVER
// ========================================
 
const PORT = process.env.PORT || 3000;
 
app.listen(PORT, () => {
  console.log(
    `ARAL OS running on port ${PORT}`
  );
 
  // Создаём таблицы памяти при старте (если их ещё нет)
  initMemory().catch((err) => {
    console.error("MEMORY INIT ERROR:", err);
  });
});
 

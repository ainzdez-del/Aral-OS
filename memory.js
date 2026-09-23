// memory.js
// Project Memory + Conversation History для ARAL OS.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Вызвать один раз при старте сервера — создаёт таблицы, если их ещё нет.
async function initMemory() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id SERIAL PRIMARY KEY,
      project TEXT NOT NULL DEFAULT 'default',
      type TEXT NOT NULL,
      topic TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user' или 'assistant'
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log('[memory] tables ready (project_memory, conversation_history)');
}

// ===== PROJECT MEMORY (результаты работы агентов) =====

async function saveMemory({ project = 'default', type, topic = null, content }) {
  await pool.query(
    `INSERT INTO project_memory (project, type, topic, content)
     VALUES ($1, $2, $3, $4)`,
    [project, type, topic, content]
  );
}

async function getProjectContext(project = 'default', limit = 10) {
  const { rows } = await pool.query(
    `SELECT type, topic, content, created_at
     FROM project_memory
     WHERE project = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [project, limit]
  );

  if (rows.length === 0) return '';

  const chronological = rows.reverse();

  const formatted = chronological
    .map((r) => {
      const label = r.topic ? `${r.type.toUpperCase()} (${r.topic})` : r.type.toUpperCase();
      return `[${label}]\n${r.content}`;
    })
    .join('\n\n---\n\n');

  return `PROJECT CONTEXT (результаты предыдущей работы других агентов по этому проекту):\n\n${formatted}`;
}

// ===== CONVERSATION HISTORY (обычный диалог, по чату) =====

async function saveConversationTurn({ chatId, role, content }) {
  await pool.query(
    `INSERT INTO conversation_history (chat_id, role, content)
     VALUES ($1, $2, $3)`,
    [String(chatId), role, content]
  );
}

async function getRecentConversation(chatId, limit = 6) {
  const { rows } = await pool.query(
    `SELECT role, content
     FROM conversation_history
     WHERE chat_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [String(chatId), limit]
  );

  if (rows.length === 0) return '';

  const chronological = rows.reverse();

  const formatted = chronological
    .map((r) => `${r.role === 'user' ? 'ПОЛЬЗОВАТЕЛЬ' : 'БОТ'}: ${r.content}`)
    .join('\n\n');

  return `RECENT CONVERSATION (последние сообщения этого диалога):\n\n${formatted}`;
}

module.exports = {
  pool,
  initMemory,
  saveMemory,
  getProjectContext,
  saveConversationTurn,
  getRecentConversation,
};

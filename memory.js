// memory.js
// Project Memory для ARAL OS.
// Хранит результаты работы агентов в Postgres, чтобы Research -> Marketing -> Scriptwriter
// видели работу друг друга.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // нужно для Supabase/Render
});

// Вызвать один раз при старте сервера — создаёт таблицу, если её ещё нет.
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
  console.log('[memory] project_memory table ready');
}

// Сохранить результат работы агента.
async function saveMemory({ project = 'default', type, topic = null, content }) {
  await pool.query(
    `INSERT INTO project_memory (project, type, topic, content)
     VALUES ($1, $2, $3, $4)`,
    [project, type, topic, content]
  );
}

// Достать последние N записей проекта и собрать в текстовый контекст.
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

module.exports = { pool, initMemory, saveMemory, getProjectContext };

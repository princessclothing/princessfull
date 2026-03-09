// User model backed by PostgreSQL.
// Provides find, create and save operations used by auth modules.

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

// Ensure the users table exists (idempotent, runs once on first import)
let _tableReady = false;
async function ensureTable() {
  if (_tableReady || !pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                   SERIAL PRIMARY KEY,
      email                TEXT UNIQUE NOT NULL,
      password_hash        TEXT NOT NULL,
      name                 TEXT,
      role                 TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin', 'usuario')),
      must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Adiciona a coluna em bancos existentes que ainda não a possuem
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS
      must_change_password BOOLEAN NOT NULL DEFAULT TRUE
  `);
  _tableReady = true;
}

// In-memory fallback when DATABASE_URL is not set (demo/dev without DB)
const _mem = [];

module.exports = {
  async findOne({ where: { email } }) {
    if (!pool) return _mem.find(u => u.email === email) || null;
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT id, email, password_hash AS "passwordHash", name, role,
              must_change_password AS "mustChangePassword"
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findByPk(id) {
    if (!pool) return _mem.find(u => u.id === id) || null;
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT id, email, password_hash AS "passwordHash", name, role,
              must_change_password AS "mustChangePassword"
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, password, name = null, role = 'usuario', mustChangePassword = true }) {
    const passwordHash = await bcrypt.hash(password, 10);
    if (!pool) {
      const user = { id: _mem.length + 1, email, passwordHash, name, role, mustChangePassword };
      _mem.push(user);
      return user;
    }
    await ensureTable();
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash AS "passwordHash", name, role,
                 must_change_password AS "mustChangePassword"`,
      [email, passwordHash, name, role, mustChangePassword]
    );
    return rows[0];
  },

  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (!pool) {
      const user = _mem.find(u => u.id === id);
      if (user) { user.passwordHash = passwordHash; user.mustChangePassword = false; }
      return user || null;
    }
    await ensureTable();
    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = FALSE
       WHERE id = $2
       RETURNING id, email, name, role, must_change_password AS "mustChangePassword"`,
      [passwordHash, id]
    );
    return rows[0] || null;
  },

  async save(user) { return user; },
};

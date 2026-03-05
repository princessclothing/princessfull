// Encrypted OAuth2 token store for Bling credentials
// Problem being solved:
//   - Storing refresh_token in process memory means it's lost on restart
//     and is visible to any memory-profiling tool or crash dump.
//   - Storing it in plain text in the DB or .env exposes it to DB admins
//     and log scraping.
//
// Solution:
//   - Persist tokens in a PostgreSQL table `bling_tokens`
//   - Encrypt all token values with AES-256-GCM (reusing piiCrypto.js)
//   - Load into memory on startup; write back whenever tokens refresh

const { Pool } = require('pg');
const { encrypt, decrypt } = require('./piiCrypto');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
});

const TABLE = 'bling_tokens';

/**
 * Persist (upsert) the current token set encrypted at rest.
 * @param {{ access_token, refresh_token, expires_in }} data
 */
async function saveTokens(data) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ${TABLE}(id, access_token_enc, refresh_token_enc, expires_at)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         access_token_enc  = EXCLUDED.access_token_enc,
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         expires_at        = EXCLUDED.expires_at`,
      [
        encrypt(data.access_token),
        encrypt(data.refresh_token),
        new Date(Date.now() + data.expires_in * 1000),
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Load previously saved tokens from the database.
 * Returns null if no tokens are stored yet.
 */
async function loadTokens() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT * FROM ${TABLE} WHERE id = 1`);
    if (!res.rows.length) return null;
    const row = res.rows[0];
    return {
      accessToken:  decrypt(row.access_token_enc),
      refreshToken: decrypt(row.refresh_token_enc),
      expiresAt:    new Date(row.expires_at).getTime(),
    };
  } finally {
    client.release();
  }
}

module.exports = { saveTokens, loadTokens };

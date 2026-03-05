// PII encryption utility using AES-256-GCM
// Used to encrypt customer personal data (nome, email, endereço) before
// writing to the database, in compliance with LGPD Art. 46 (security measures)
// and GDPR Art. 32 (encryption at rest).
//
// Algorithm: AES-256-GCM
//   - 256-bit key (from PII_ENCRYPTION_KEY env var, must be exactly 32 bytes hex-decoded)
//   - 16-byte random IV per encryption (prevents IV reuse attacks)
//   - 16-byte auth tag (provides authenticated encryption / tamper detection)
//
// Storage format (stored as TEXT or VARCHAR in PostgreSQL):
//   base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)
//
// Required env variable:
//   PII_ENCRYPTION_KEY = 64-character hex string (32 bytes)
//   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LEN    = 16;

function getKey() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('PII_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns an opaque string safe to store in a TEXT column.
 * Returns null if value is null/undefined (preserves NULL semantics in DB).
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key  = getKey();
  const iv   = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc  = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * Decrypt a value previously produced by encrypt().
 * Returns null if value is null/undefined.
 * Throws if the ciphertext has been tampered with (auth tag mismatch).
 */
function decrypt(stored) {
  if (stored === null || stored === undefined) return null;
  const parts = String(stored).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivB64, tagB64, dataB64] = parts;
  const key    = getKey();
  const iv     = Buffer.from(ivB64,   'base64');
  const tag    = Buffer.from(tagB64,  'base64');
  const data   = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };

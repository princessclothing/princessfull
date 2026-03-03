// LGPD (Lei 14.058/2020) compliance controller
// Implements the "direito ao esquecimento" (Art. 18, III / IV) and
// "direito de acesso" (Art. 18, I) for customer personal data.
//
// These endpoints should be:
// - Accessible only to authenticated users with 'admin' or 'dpo' role
// - Logged to an audit table (who requested the deletion, when)
// - Responded within 15 days per ANPD guidance

const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
});

/**
 * GET /lgpd/data/:email
 * Returns all personal data held for a given customer email.
 * Used to respond to "direito de acesso" (Art. 18, I LGPD) requests.
 */
exports.getDataByEmail = async (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  // NOTE: if PII fields are encrypted, decrypt them before returning
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, bling_order_id, shop_id, cliente_nome, cliente_email,
              status, data_pedido, data_integracao
       FROM orders
       WHERE cliente_email = $1`,
      [email]
    );
    res.json({ total: result.rowCount, records: result.rows });
  } finally {
    client.release();
  }
};

/**
 * DELETE /lgpd/erase/:email
 * Erases (anonymises) all personal data for a customer email.
 * Uses anonymisation rather than hard delete to preserve order integrity
 * for accounting / NF-e legal obligations (tax records must be kept 5 years).
 *
 * Anonymisation strategy (Art. 5, XI LGPD):
 *   - cliente_nome  → 'ANONIMIZADO'
 *   - cliente_email → SHA-256 hash (pseudonymisation)
 *   - itens         → items without personal identifiers retained for tax audit
 */
exports.eraseByEmail = async (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const crypto = require('crypto');
  const anonymisedEmail = 'anon_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE orders SET
         cliente_nome  = 'ANONIMIZADO',
         cliente_email = $2
       WHERE cliente_email = $1
       RETURNING id`,
      [email, anonymisedEmail]
    );

    // write to audit log
    await client.query(
      `INSERT INTO lgpd_erasure_log(requested_by, target_email, affected_rows, requested_at)
       VALUES($1, $2, $3, now())`,
      [req.user?.id || 'system', email, result.rowCount]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Personal data anonymised successfully',
      affectedOrders: result.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[LGPD] Erasure failed', err.message); // do NOT log email in error
    res.status(500).json({ message: 'Erasure failed' });
  } finally {
    client.release();
  }
};

// Service to synchronize and query inventory between Bling and Dreng depot
// Responsibilities:
// 1. Fetch stock from Bling V3 by SKU
// 2. Filter by configured depot ID (DEPOSITO_DRENG_ID)
// 3. Upsert data into PostgreSQL table 'inventory'

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
});
const DRENG_ID = process.env.DEPOSITO_DRENG_ID;

async function fetchStockFromBling(sku) {
  const token = await require('./blingService').authenticate(); // reuse auth
  const url = `${process.env.BLING_API_URL}/v3/estoques?codigo=${encodeURIComponent(sku)}`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'enable-jwt': '1',  // Bling JWT migration requirement
    },
  });
  // response shape: resp.data.retorno.estoques
  const entries = resp.data?.estoques || [];
  // find entry matching depot
  return entries.find(e => String(e.deposito?.id) === String(DRENG_ID)) || null;
}

async function upsertInventory(entry) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO inventory(
        sku,
        produto_nome,
        qtd_disponivel,
        qtd_prevista,
        deposito_id,
        deposito_nome,
        custo,
        ultima_atualizacao
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (sku) DO UPDATE SET
        produto_nome = EXCLUDED.produto_nome,
        qtd_disponivel = EXCLUDED.qtd_disponivel,
        qtd_prevista = EXCLUDED.qtd_prevista,
        deposito_id = EXCLUDED.deposito_id,
        deposito_nome = EXCLUDED.deposito_nome,
        custo = EXCLUDED.custo,
        ultima_atualizacao = EXCLUDED.ultima_atualizacao;
    `;
    const values = [
      entry.codigo,
      entry.produto_nome,
      entry.qtd_disponivel,
      entry.qtd_prevista,
      entry.deposito?.id,
      entry.deposito?.nome,
      entry.custo,
      new Date(),
    ];
    await client.query(query, values);
  } finally {
    client.release();
  }
}

/**
 * Synchronize a single SKU
 */
exports.syncSku = async (sku) => {
  if (!sku) return null;
  const entry = await fetchStockFromBling(sku);
  if (entry) {
    await upsertInventory(entry);
    return entry;
  }
  return null;
};

/**
 * Query inventory table for a SKU
 */
exports.getInventory = async (sku) => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM inventory WHERE sku = $1', [sku]);
    return res.rows[0] || null;
  } finally {
    client.release();
  }
};

/**
 * Bulk sync of multiple SKUs
 */
exports.syncMultiple = async (skus) => {
  const results = [];
  for (const sku of skus) {
    const r = await exports.syncSku(sku);
    if (r) results.push(r);
  }
  return results;
};

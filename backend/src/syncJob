// Scheduled job using node-cron to sync a list of SKUs every 30 minutes.
// SKUs are loaded from the inventory table (dynamic) rather than a static
// env variable, so new products added at runtime are picked up automatically.
//
// NOTE: For high-volume production environments, move this to a dedicated
// worker process (e.g. BullMQ / Celery equivalent) instead of running
// in the same Express process. This avoids memory pressure and CPU
// contention with the web server under load.

const cron = require('node-cron');
const { Pool } = require('pg');
const stockService = require('./services/stockService');

// Skip sync job if DATABASE_URL not configured (demo mode)
if (!process.env.DATABASE_URL) {
  console.warn('[syncJob] DATABASE_URL not configured — inventory sync disabled');
  return;
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
});

async function loadSkusFromDb() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT sku FROM inventory');
    return res.rows.map(r => r.sku);
  } finally {
    client.release();
  }
}

// schedule task every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('[syncJob] Starting inventory sync');
    const skus = await loadSkusFromDb();
    if (!skus.length) {
      console.warn('[syncJob] No SKUs found in inventory table — skipping');
      return;
    }
    await stockService.syncMultiple(skus);
    console.log(`[syncJob] Completed. Synced ${skus.length} SKUs.`);
  } catch (err) {
    console.error('[syncJob] Error during sync:', err.message);
    // TODO: send alert to monitoring (e.g. Sentry)
  }
});

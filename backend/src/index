// Entry point for the backend server
// Sets up Express app, security middleware, and routes
const express = require('express');
const helmet  = require('helmet');
const app = express();

// ---- Startup security validation ------------------------------------------
// Fail fast if critical secrets are missing or too weak.
// DATABASE_URL and PII_ENCRYPTION_KEY are optional for demo/testing (logs warning)
const REQUIRED_ENV = ['JWT_SECRET', 'BLING_CLIENT_ID', 'BLING_CLIENT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) throw new Error(`Missing required env variable: ${key}`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// Warn if DB or PII encryption key missing (non-fatal for demo mode)
if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL not set — using in-memory storage (data not persisted)');
}
if (!process.env.PII_ENCRYPTION_KEY) {
  console.warn('[WARN] PII_ENCRYPTION_KEY not set — PII fields will not be encrypted');
} else if (process.env.PII_ENCRYPTION_KEY.length !== 64) {
  throw new Error('PII_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
}

// ---- Security headers (helmet) ----------------------------------------
// Sets: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
//       Strict-Transport-Security, Referrer-Policy, etc.
app.use(helmet());

// ---- CORS ---------------------------------------------------------------
// Production: same-domain (Vercel), no CORS header needed
// Development: allow localhost Vite dev server
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowAll = process.env.CORS_ALLOW_ALL === 'true';
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
  if (allowAll || allowed.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ---- Body parsing ---------------------------------------------------------
// Limit JSON payload size to prevent request flooding / memory exhaustion
app.use(express.json({ limit: '1mb' }));

// ---- Application routes ---------------------------------------------------

// authentication routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Bling integration routes
const blingRoutes = require('./routes/blingRoutes');
app.use('/bling', blingRoutes);

// stock/inventory routes
const stockRoutes = require('./routes/stockRoutes');
app.use('/stock', stockRoutes);

// LGPD compliance routes (access + erasure)
const lgpdRoutes = require('./routes/lgpdRoutes');
app.use('/lgpd', lgpdRoutes);

// Orders CRUD
const ordersRoutes = require('./routes/ordersRoutes');
app.use('/orders', ordersRoutes);

// Webhook endpoints (Bling and future integrations)
const webhookRoutes = require('./routes/webhookRoutes');
app.use('/webhooks', webhookRoutes);

// Pusher channel authentication (private channels)
const pusherAuth = require('./routes/pusherAuth');
app.use('/pusher', pusherAuth);

// start sync job (node-cron)
require('./syncJob');

// Bootstrap Bling tokens from DB on startup so cold-starts don't use stale env tokens
(async () => {
  try {
    const blingService = require('./services/blingService');
    const { loadTokens } = require('./utils/blingTokenStore');
    const stored = await loadTokens();
    if (stored && stored.accessToken) {
      blingService.setTokenData(stored);
      console.log('[startup] Bling tokens loaded from DB');
    }
  } catch (err) {
    console.warn('[startup] Could not load Bling tokens from DB:', err.message);
  }
})();

// ---- Health check (no sensitive data in response) -------------------------
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// ---- Global error handler (sanitise errors before responding) ------------
// Prevents internal error details / stack traces from leaking to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // log full error server-side without PII
  console.error('[ERROR]', err.message);
  // never expose stack traces or internal messages to the client
  res.status(err.status || 500).json({ message: 'An unexpected error occurred' });
});

// ---- Export for Vercel Serverless / local dev -----------------------------
// Vercel uses exports directly; local dev calls .listen()
module.exports = app;

if (require.main === module) {
  // Only run HTTP server when executed directly (not imported by Vercel)
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

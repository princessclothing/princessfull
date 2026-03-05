// Service for integrating with Bling V3 API using OAuth2 and managing orders
// Responsibilities:
// 1. handle OAuth2 authentication with automatic token refresh
// 2. fetch sales orders per shop_id (Bling V3 accepts ONE idLoja per request)
// 3. filter by numeric status codes and persist via upsert

const axios = require('axios');
const { Pool } = require('pg');

// connection pool for PostgreSQL
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
});

// in-memory token cache (initialize from environment variables for serverless)
// Read actual `exp` from JWT payload so we never use an already-expired env token
function jwtExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : 0;
  } catch (_) {
    return 0;
  }
}

let tokenData = {
  accessToken: process.env.BLING_ACCESS_TOKEN || null,
  refreshToken: process.env.BLING_REFRESH_TOKEN || null,
  // Use real JWT exp claim instead of an arbitrary 6-hour offset
  expiresAt: process.env.BLING_ACCESS_TOKEN
    ? jwtExpiry(process.env.BLING_ACCESS_TOKEN)
    : 0,
};

// Log token status on startup
if (tokenData.accessToken) {
  const expired = Date.now() >= tokenData.expiresAt;
  console.log(`[blingService] Initialized with JWT token (${tokenData.accessToken.length} chars, expires: ${new Date(tokenData.expiresAt).toISOString()}, expired: ${expired})`);
  if (expired) {
    console.warn('[blingService] Token already expired — will refresh on first request');
  }
} else {
  console.warn('[blingService] No BLING_ACCESS_TOKEN found in environment');
}

// Bling V3 token endpoint uses HTTP Basic auth:
// Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
function blingBasicAuth() {
  const credentials = `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

async function authenticate() {
  // reuse token if valid for at least another minute
  if (tokenData.accessToken && Date.now() < tokenData.expiresAt - 60000) {
    return tokenData.accessToken;
  }

  // NOTE: Bling V3 uses Authorization Code OAuth2 flow.
  // The initial access_token + refresh_token must be obtained via the
  // browser-based consent flow and stored in the environment.
  // This function only handles *refreshing* an existing token.
  if (!tokenData.refreshToken) {
    throw new Error(
      'Bling refresh_token not available. Complete the OAuth2 authorization flow first and set tokenData.refreshToken.'
    );
  }

  const resp = await axios.post(
    `${process.env.BLING_API_URL}/oauth/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refreshToken,
    }),
    {
      headers: {
        'Authorization': blingBasicAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'enable-jwt': '1',  // Bling JWT migration requirement
      },
    }
  );

  storeTokenResponse(resp.data);
  return tokenData.accessToken;
}

const { saveTokens, loadTokens } = require('../utils/blingTokenStore');

function storeTokenResponse(data) {
  tokenData.accessToken  = data.access_token;
  tokenData.refreshToken = data.refresh_token;
  // expires_in is in seconds
  tokenData.expiresAt = Date.now() + (data.expires_in * 1000);
  // persist encrypted to DB asynchronously (non-blocking)
  // so tokens survive process restarts and are never in plain text on disk
  saveTokens(data).catch(err =>
    console.error('[blingService] Failed to persist tokens:', err.message)
  );
}

/**
 * Allow external bootstrap of tokens (e.g. on startup, load from DB).
 * Call this once at application startup:
 *   const { loadTokens } = require('./utils/blingTokenStore');
 *   loadTokens().then(t => { if (t) blingService.setTokenData(t); });
 */
exports.setTokenData = (data) => {
  tokenData.accessToken  = data.accessToken  || data.access_token;
  tokenData.refreshToken = data.refreshToken || data.refresh_token;
  // Prefer real JWT exp claim over expires_in arithmetic to avoid clock drift
  const at = tokenData.accessToken;
  tokenData.expiresAt = data.expiresAt
    || (at ? jwtExpiry(at) : 0)
    || (Date.now() + (data.expires_in || 0) * 1000);
  // Persist to DB so tokens survive cold starts (non-blocking)
  if (tokenData.accessToken && tokenData.refreshToken && process.env.PII_ENCRYPTION_KEY) {
    const expiresInSeconds = Math.max(0, Math.floor((tokenData.expiresAt - Date.now()) / 1000));
    saveTokens({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      expires_in: expiresInSeconds,
    }).catch(err => console.error('[blingService] setTokenData persist error:', err.message));
  }
};

/**
 * Force token refresh - usado pelo cronjob para renovar tokens antes de expirarem
 * Retorna o novo access token ou o atual se ainda válido
 */
exports.forceTokenRefresh = async () => {
  console.log('[blingService] Forcing token refresh (cron job)...');
  
  // Resetar expiresAt para forçar refresh
  const oldExpiry = tokenData.expiresAt;
  tokenData.expiresAt = 0;
  
  try {
    // authenticate() vai detectar token expirado e fazer refresh
    const newToken = await authenticate();
    
    console.log('[blingService] Token refresh successful');
    console.log(`[blingService] Old expiry: ${new Date(oldExpiry).toISOString()}`);
    console.log(`[blingService] New expiry: ${new Date(tokenData.expiresAt).toISOString()}`);
    
    return newToken;
  } catch (err) {
    // Restaurar expiry anterior em caso de erro
    tokenData.expiresAt = oldExpiry;
    console.error('[blingService] Token refresh failed:', err.message);
    throw err;
  }
};

// Bling V3 numeric status codes allowed for sync:
// 6 = Em aberto, 9 = Atendido
const ALLOWED_STATUS_CODES = [6, 9];

/**
 * Fetch all orders for a single shopId with pagination.
 * Bling V3 does NOT support comma-separated idLoja in a single request.
 */
async function fetchOrdersForShop(token, shopId) {
  const results = [];
  let pagina = 1;
  let hasMore = true;
  const MAX_PAGES = 1; // Only fetch first page (100 orders) to avoid hitting Vercel 10s timeout
  const result = { orders: [], pagesFetched: 0 };

  while (hasMore && pagina <= MAX_PAGES) {
    // Bling V3 real response shape: { data: [...] }
    const resp = await axios.get(`${process.env.BLING_API_URL}/pedidos/vendas`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'enable-jwt': '1',  // Bling JWT migration requirement
      },
      params: {
        idLoja: shopId,
        pagina,
        limite: 100,
      },
    });

    const page = resp.data?.data || [];
    if (!page.length) {
      hasMore = false;
    } else {
      result.pagesFetched = pagina;
      // Log first order structure for debugging (only on first page)
      if (pagina === 1 && page[0]) {
        console.log('[Bling] Sample order structure:', JSON.stringify({
          id: page[0].id,
          situacao: page[0].situacao,
          hasItens: !!page[0].itens,
          itensCount: page[0].itens?.length || 0,
          hasContato: !!page[0].contato,
          hasEndereco: !!page[0].contato?.endereco,
        }));
      }
      
      // filter by status inside the loop to reduce memory
      const filtered = page.filter(p => ALLOWED_STATUS_CODES.includes(p.situacao?.id));
      results.push(...filtered);
      pagina++;
      // Bling returns up to 100 records; fewer means last page
      if (page.length < 100) hasMore = false;
      
      // Rate limit: Bling allows 3 req/sec, wait 350ms between requests
      if (hasMore && pagina <= MAX_PAGES) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
  }
  
  if (pagina > MAX_PAGES) {
    console.log(`[Bling] Reached max pages limit (${MAX_PAGES}) for shop ${shopId}`);
  }
  result.orders = results;
  return result;
}

async function fetchOrders(shopIds = []) {
  const token = await authenticate();
  let allOrders = [];
  // iterate each shopId separately — Bling V3 requirement
  for (const shopId of shopIds) {
    const orders = await fetchOrdersForShop(token, shopId);
    allOrders = allOrders.concat(orders);
  }
  return allOrders;
}

async function upsertOrder(order) {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO orders(
        bling_order_id,
        shop_id,
        numero_bling,
        numero_loja,
        cliente_nome,
        cliente_email,
        status,
        data_pedido,
        data_integracao,
        itens,
        billing_address,
        shipping_address
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (bling_order_id) DO UPDATE SET
        shop_id = EXCLUDED.shop_id,
        numero_bling = EXCLUDED.numero_bling,
        numero_loja = EXCLUDED.numero_loja,
        cliente_nome = EXCLUDED.cliente_nome,
        cliente_email = EXCLUDED.cliente_email,
        status = EXCLUDED.status,
        data_pedido = EXCLUDED.data_pedido,
        data_integracao = EXCLUDED.data_integracao,
        itens = EXCLUDED.itens,
        billing_address = EXCLUDED.billing_address,
        shipping_address = EXCLUDED.shipping_address;
    `;

    // Log order data for debugging
    console.log(`[Bling] Upserting order ${order.id} (nº ${order.numero}, loja: ${order.numeroLoja}): items=${order.itens?.length || 0}, status=${order.situacao?.nome || order.situacao?.id}`);

    const values = [
      String(order.id),
      order.loja?.id ? String(order.loja.id) : null,
      order.numero != null ? String(order.numero) : null,
      order.numeroLoja || null,
      order.contato?.nome || null,
      order.contato?.email || null,
      order.situacao?.nome || order.situacao?.valor || String(order.situacao?.id) || null,
      order.data ? new Date(order.data) : null,
      new Date(),
      JSON.stringify(order.itens || []),
      JSON.stringify(order.contato?.endereco || null),
      JSON.stringify(order.contato?.endereco || null),
    ];

    await client.query(query, values);
  } finally {
    client.release();
  }
}

/**
 * Exported so that other services (e.g. stockService) can reuse the
 * OAuth2 token without duplicating the auth logic.
 */
exports.authenticate = authenticate;

/**
 * Fetch linkPDF (DANFE) from a NF-e ID.
 * Returns the linkPDF string or null.
 */
exports.fetchDanfeUrl = async (nfId) => {
  const token = await authenticate();
  try {
    const resp = await axios.get(`${process.env.BLING_API_URL}/nfe/${nfId}`, {
      headers: { Authorization: `Bearer ${token}`, 'enable-jwt': '1' },
    });
    return resp.data?.data?.linkPDF || null;
  } catch (err) {
    console.error(`[Bling] Error fetching NF-e ${nfId}:`, err.message);
    return null;
  }
};

/**
 * Fetch complete order details by ID (includes products, addresses, etc.)
 */
exports.fetchOrderDetails = async (orderId) => {
  const token = await authenticate();
  try {
    const resp = await axios.get(`${process.env.BLING_API_URL}/pedidos/vendas/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'enable-jwt': '1',
      },
    });
    return resp.data?.data || null;
  } catch (err) {
    console.error(`[Bling] Error fetching order ${orderId}:`, err.message);
    return null;
  }
};

/**
 * Public: synchronize orders from Bling for the given shop IDs.
 * Returns a summary object { synced: <count> }.
 */
exports.syncOrders = async (shopIds = []) => {
  let total = 0;
  let pages = 0;
  // fetch and upsert per shop to avoid holding too many records
  for (const shopId of shopIds) {
    const result = await fetchOrdersForShop(await authenticate(), shopId);
    pages += result.pagesFetched || 0;
    for (const ord of result.orders) {
      await upsertOrder(ord);
      total++;
    }
  }
  return { synced: total, pagesFetched: pages, maxPages: 1 };
};

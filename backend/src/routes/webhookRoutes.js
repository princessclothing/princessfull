// routes/webhookRoutes.js
// Endpoint for Bling webhook notifications (serverless function)
// Security hardening applied:
//   - timingSafeEqual token comparison (prevents timing attacks)
//   - timestamp validation ±300s (prevents replay attacks)
//   - in-memory rate limiter (max 60 req/min per IP)
//   - all async work done BEFORE res.send (Vercel serverless safety)

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const blingService = require('../services/blingService');
const {
  triggerNewOrder,
  triggerOrderUpdated,
  triggerOrderCancelled,
} = require('../../lib/pusher');

// ── FIX #1: timing-safe token validation ─────────────────────────────────────
function validateBlingToken(req, res, next) {
  const header = req.get('Authorization') || req.get('X-Bling-Token') || '';
  const token  = header.replace(/^Bearer\s+/i, '').trim();
  const secret = process.env.BLING_WEBHOOK_SECRET || '';

  // lengths must match before timingSafeEqual (it requires equal-length buffers)
  if (!token || token.length !== secret.length) {
    console.warn('bling webhook: invalid token (length mismatch)');
    return res.status(401).send('unauthorized');
  }
  const tokBuf = Buffer.from(token);
  const secBuf = Buffer.from(secret);
  if (!crypto.timingSafeEqual(tokBuf, secBuf)) {
    console.warn('bling webhook: invalid token (value mismatch)');
    return res.status(401).send('unauthorized');
  }
  next();
}

// ── FIX #2: replay-attack protection (±5 min timestamp window) ───────────────
// Bling V3 sends `X-Bling-Timestamp` (Unix seconds). Adjust if Bling uses
// a different header; disable by leaving BLING_WEBHOOK_CHECK_TIMESTAMP=false.
function validateTimestamp(req, res, next) {
  if (process.env.BLING_WEBHOOK_CHECK_TIMESTAMP === 'false') return next();
  const ts = req.get('X-Bling-Timestamp');
  if (!ts) return next(); // header absent — skip (Bling may not send it)
  const diff = Math.abs(Date.now() / 1000 - Number(ts));
  if (diff > 300) {
    console.warn('bling webhook: stale timestamp, possible replay', ts);
    return res.status(400).send('stale request');
  }
  next();
}

// ── FIX #3: simple in-memory rate limiter (60 req/min per IP) ────────────────
const rateBuckets = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60_000; }
  bucket.count++;
  rateBuckets.set(ip, bucket);
  // prune old entries occasionally
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets) { if (now > v.reset) rateBuckets.delete(k); }
  }
  if (bucket.count > 60) {
    return res.status(429).send('too many requests');
  }
  next();
}

// ── helpers ───────────────────────────────────────────────────────────────────
function shopAllowed(shopId) {
  const env = process.env.BLING_ALLOWED_SHOP_IDS || '';
  if (!env) return true;
  return env.split(',').map(s => s.trim()).includes(String(shopId));
}

// ── POST /webhooks/bling ──────────────────────────────────────────────────────
// FIX #4 (Vercel): ALL async work runs BEFORE res.send so Vercel does not
// freeze the execution context with pending work. Total budget: 4.5s
// (Bling requires 200 within 5s; we keep 0.5s safety margin).
router.post(
  '/bling',
  rateLimit,
  express.json({ limit: '256kb' }),
  validateBlingToken,
  validateTimestamp,
  async (req, res) => {
    try {
      const payload   = req.body || {};
      const eventType = payload.evento || payload.tipo || payload.event || '';
      const order     = payload.pedido || payload.order || payload;

      if (!order || !order.id) {
        console.warn('bling webhook: no order data', JSON.stringify(payload).slice(0, 200));
        return res.status(400).send('missing order');
      }

      const shopId = order.loja?.id ? String(order.loja.id) : '';
      if (!shopAllowed(shopId)) {
        console.log('bling webhook: shop filtered out', shopId);
        return res.status(200).send('ignored');
      }

      // upsert first — if this fails, we still return 200 to avoid Bling
      // retrying indefinitely, but we log the error for alerting
      await blingService.upsertOrder(order);

      const summary = {
        id:     String(order.id),
        shopId,
        status: order.situacao?.id || null,
      };

      // Pusher failure must NOT prevent us from acknowledging Bling
      try {
        if (eventType === 'pedido.criado')     await triggerNewOrder(summary);
        else if (eventType === 'pedido.atualizado') await triggerOrderUpdated(summary);
        else if (eventType === 'pedido.cancelado')  await triggerOrderCancelled(summary);
        else console.log('bling webhook: unhandled event', eventType);
      } catch (pusherErr) {
        // DB already updated — Pusher outage does not affect data integrity
        console.error('bling webhook: pusher trigger failed (non-fatal)', pusherErr.message);
      }

      return res.status(200).send('ok');
    } catch (err) {
      console.error('bling webhook processing error', err);
      // return 200 to Bling so it does not keep retrying for DB-side errors
      return res.status(200).send('error logged');
    }
  }
);

module.exports = router;

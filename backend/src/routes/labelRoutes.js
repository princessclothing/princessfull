/**
 * labelRoutes.js
 * POST /orders/:id/label  — faz upload do PDF para Vercel Blob, salva URL no banco
 * GET  /orders/:id/label  — retorna { labelUrl } para o frontend abrir em nova aba
 * DELETE /orders/:id/label — remove a etiqueta atual
 */
const express = require('express');
const router  = express.Router({ mergeParams: true });
const multer  = require('multer');
const { put, del } = require('@vercel/blob');
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// Multer: armazena em memória (Vercel não tem disco persistente)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype)) {
      return cb(new Error('Apenas PDF ou imagem são permitidos'));
    }
    cb(null, true);
  },
});

// ── helpers ──────────────────────────────────────────────────────────────────
async function findOrder(orderId) {
  const idAsInt = parseInt(orderId, 10);
  const isDbId  = !isNaN(idAsInt) && idAsInt < 1_000_000;
  const { rows } = await pool.query(
    isDbId
      ? 'SELECT id, bling_order_id, label_url FROM orders WHERE id = $1 LIMIT 1'
      : 'SELECT id, bling_order_id, label_url FROM orders WHERE bling_order_id = $1 LIMIT 1',
    [isDbId ? idAsInt : orderId]
  );
  return rows[0] || null;
}

// ── POST /orders/:id/label ────────────────────────────────────────────────────
router.post('/', upload.single('label'), async (req, res) => {
  if (!pool) return res.status(501).json({ message: 'Database not configured' });
  if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Ordem não encontrada' });

    const ext      = req.file.mimetype === 'application/pdf' ? 'pdf' : req.file.mimetype.split('/')[1];
    const blobPath = `labels/order-${order.bling_order_id || order.id}.${ext}`;

    // Fazer upload para Vercel Blob (substitui se já existia)
    const blob = await put(blobPath, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
      addRandomSuffix: false, // mesmo nome = sobrescreve versão anterior
    });

    // Salvar URL no banco
    await pool.query(
      'UPDATE orders SET label_url = $1 WHERE id = $2',
      [blob.url, order.id]
    );

    console.log(`[Label] Uploaded label for order ${order.bling_order_id}: ${blob.url}`);
    res.json({ labelUrl: blob.url });
  } catch (err) {
    console.error('[Label] Upload error:', err.message);
    res.status(500).json({ message: 'Erro ao fazer upload da etiqueta', error: err.message });
  }
});

// ── GET /orders/:id/label ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (!pool) return res.status(501).json({ message: 'Database not configured' });

  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Ordem não encontrada' });

    if (!order.label_url) {
      return res.status(404).json({ message: 'Etiqueta não enviada ainda' });
    }

    res.json({ labelUrl: order.label_url });
  } catch (err) {
    console.error('[Label] Get error:', err.message);
    res.status(500).json({ message: 'Erro ao buscar etiqueta' });
  }
});

// ── DELETE /orders/:id/label ──────────────────────────────────────────────────
router.delete('/', async (req, res) => {
  if (!pool) return res.status(501).json({ message: 'Database not configured' });

  try {
    const order = await findOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Ordem não encontrada' });
    if (!order.label_url) return res.status(404).json({ message: 'Sem etiqueta para remover' });

    // Remover do Vercel Blob
    await del(order.label_url);

    // Limpar no banco
    await pool.query('UPDATE orders SET label_url = NULL WHERE id = $1', [order.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('[Label] Delete error:', err.message);
    res.status(500).json({ message: 'Erro ao remover etiqueta' });
  }
});

module.exports = router;

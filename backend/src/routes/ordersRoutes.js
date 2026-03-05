const express = require('express');
const router  = express.Router();
const { Pool } = require('pg');
const blingService = require('../services/blingService');
// Note: requireAuth removed for demo - in production, validate user authentication

// Mock data when DATABASE_URL not configured
const MOCK_ORDERS = [
  {
    id: 'DEMO-001',
    dbId: 1,
    refCliente: 'DEMO_SHOP',
    dataIntegracao: new Date().toISOString().split('T')[0],
    dataPedido: new Date().toISOString().split('T')[0],
    statusLabel: 'Faturado',
    marketplace: 'DEMO_SHOP',
    status: { etiquetaDisponivel: true, etiquetaImportada: true, picking: false, packing: false, transportadora: false },
    products: [{ sku: 'DEMO-SKU-001', name: 'Produto Demo', qtyRequested: 1, qtyShipped: 0 }],
    billingAddress: null,
    shippingAddress: null,
    timeline: [],
    chatHistory: [],
    lastDeliveryOrders: [],
  },
];

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false, ca: undefined }
    : { rejectUnauthorized: false },
}) : null;

// Map DB row → frontend order shape
function rowToOrder(row) {
  const status = row.status || ''

  // Derive fulfillment steps from status text (extend as needed)
  const lower = status.toLowerCase()
  const steps = {
    etiquetaDisponivel: lower.includes('etiqueta') || lower.includes('label') || lower.includes('approved') || lower.includes('faturad'),
    etiquetaImportada:  lower.includes('importad') || lower.includes('faturad'),
    picking:            lower.includes('picking') || lower.includes('separaç') || lower.includes('separado'),
    packing:            lower.includes('packing') || lower.includes('embalad') || lower.includes('embalagem'),
    transportadora:     lower.includes('entregue') || lower.includes('postado') || lower.includes('transporte') || lower.includes('transit'),
  }

  // Parse products from itens (Bling V3 structure)
  let itens = row.itens;
  if (typeof itens === 'string') {
    try {
      itens = JSON.parse(itens);
    } catch {
      itens = [];
    }
  }
  if (!Array.isArray(itens)) {
    itens = [];
  }

  let products = [];
  products = itens.map(it => ({
    sku:          it.codigo || it.produto?.codigo || it.sku || '—',
    name:         it.descricao || it.produto?.descricao || it.nome || 'Produto sem nome',
    qtyRequested: it.quantidade || it.qty || 0,
    qtyShipped:   it.quantidadeEntregue || it.qtyShipped || 0,
  }));

  // Parse addresses (JSONB from database)
  const parseAddress = (addr) => {
    if (!addr) return null;
    if (typeof addr === 'string') {
      try {
        addr = JSON.parse(addr);
      } catch {
        return null;
      }
    }
    return addr;
  };

  return {
    id:             String(row.bling_order_id || row.id),
    dbId:           row.id,
    numeroBling:    row.numero_bling || null,
    numeroLoja:     row.numero_loja  || null,
    rastreio:       row.rastreio     || null,
    labelUrl:       row.label_url    || null,
    danfeUrl:       row.danfe_url    || null,
    refCliente:     row.shop_id || '—',
    dataIntegracao: row.data_integracao
      ? new Date(row.data_integracao).toISOString().split('T')[0]
      : null,
    dataPedido:     row.data_pedido
      ? new Date(row.data_pedido).toISOString().split('T')[0]
      : null,
    statusLabel:    status,
    marketplace:    row.shop_id || null,
    status:         steps,
    products:       products,
    billingAddress:  parseAddress(row.billing_address),
    shippingAddress: parseAddress(row.shipping_address),
    timeline:        row.timeline         || [],
    chatHistory:     row.chat_history     || [],
    lastDeliveryOrders: [],
  }
}

// GET /orders
router.get('/', async (req, res) => {
  // Return mock data when DB not configured
  if (!pool) {
    return res.json({ orders: MOCK_ORDERS, total: MOCK_ORDERS.length });
  }

  try {
    const { status, marketplace, from, to, limit = 200, offset = 0 } = req.query

    const conditions = []
    const params     = []
    let   idx        = 1

    if (status)      { conditions.push(`status = $${idx++}`);          params.push(status) }
    if (marketplace) { conditions.push(`shop_id = $${idx++}`);         params.push(marketplace) }
    if (from)        { conditions.push(`data_integracao >= $${idx++}`); params.push(from) }
    if (to)          { conditions.push(`data_integracao <= $${idx++}`); params.push(to) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT * FROM orders ${where} ORDER BY data_integracao DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, Number(limit), Number(offset)]
    )

    res.json({ orders: rows.map(rowToOrder), total: rows.length })
  } catch (err) {
    console.error('GET /orders error', err)
    res.status(500).json({ message: 'Erro ao buscar ordens' })
  }
})

// GET /orders/:id
router.get('/:id', async (req, res) => {
  // Return mock data when DB not configured
  if (!pool) {
    const found = MOCK_ORDERS.find(o => o.id === req.params.id || o.dbId === Number(req.params.id));
    if (!found) return res.status(404).json({ message: 'Ordem não encontrada' });
    return res.json(found);
  }

  try {
    const orderId = req.params.id;
    
    // Bling IDs are large numbers (9+ digits), always search as string in bling_order_id
    // Only use numeric id column if it's a small number (internal database ID)
    const idAsInt = parseInt(orderId, 10);
    const isDbId = !isNaN(idAsInt) && idAsInt < 1000000; // DB IDs are small (< 1M)
    
    let query, params;
    if (isDbId) {
      // Small number = internal DB ID
      query = `SELECT * FROM orders WHERE id = $1 LIMIT 1`;
      params = [idAsInt];
    } else {
      // Large number or string = Bling Order ID
      query = `SELECT * FROM orders WHERE bling_order_id = $1 LIMIT 1`;
      params = [orderId];
    }
    
    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ message: 'Ordem não encontrada' })
    
    const order = rows[0];
    
    // Fetch details from Bling if: no products yet OR rastreio not saved yet OR danfe_url not saved
    const parsedItens = typeof order.itens === 'string' ? (() => { try { return JSON.parse(order.itens); } catch { return []; } })() : (order.itens || []);
    const hasDetails = Array.isArray(parsedItens) && parsedItens.length > 0;
    const needsRastreio = !order.rastreio;
    const needsDanfe = !order.danfe_url;
    
    if (((!hasDetails) || needsRastreio || needsDanfe) && order.bling_order_id) {
      console.log(`[Orders] Fetching details for order ${order.bling_order_id} from Bling (hasDetails=${hasDetails}, needsRastreio=${needsRastreio}, needsDanfe=${needsDanfe})...`);
      const details = await blingService.fetchOrderDetails(order.bling_order_id);
      
      if (details) {
        const rastreio = details.transporte?.volumes?.[0]?.codigoRastreamento || null;

        // Try to fetch DANFE linkPDF if order has a notaFiscal and we don't have it yet
        let danfeUrl = order.danfe_url || null;
        const nfId = details.notaFiscal?.id;
        if (nfId && needsDanfe) {
          danfeUrl = await blingService.fetchDanfeUrl(nfId);
        }

        // Update database with complete details + rastreio + danfe_url
        await pool.query(
          `UPDATE orders SET
            itens = $1,
            billing_address = $2,
            shipping_address = $3,
            status = $4,
            rastreio = $5,
            danfe_url = $6
          WHERE bling_order_id = $7`,
          [
            JSON.stringify(details.itens || []),
            JSON.stringify(details.contato?.endereco || null),
            JSON.stringify(details.contato?.endereco || null),
            details.situacao?.nome || details.situacao?.valor || String(details.situacao?.id) || order.status,
            rastreio,
            danfeUrl,
            order.bling_order_id,
          ]
        );
        
        // Refetch updated order
        const { rows: updated } = await pool.query(query, params);
        return res.json(rowToOrder(updated[0]));
      }
    }
    
    res.json(rowToOrder(order))
  } catch (err) {
    console.error('GET /orders/:id error', err)
    res.status(500).json({ message: 'Erro ao buscar ordem', error: err.message })
  }
})

// PATCH /orders/:id - Update order details (carrier, files, etc.)
router.patch('/:id', async (req, res) => {
  if (!pool) {
    return res.status(501).json({ message: 'Database not configured' });
  }

  try {
    const orderId = req.params.id;
    const idAsInt = parseInt(orderId, 10);
    const isDbId = !isNaN(idAsInt) && idAsInt < 1000000;
    const updates = req.body;
    
    // Build dynamic update query
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    // Allow updating these fields
    if (updates.transportadora) {
      setClauses.push(`transportadora_nome = $${paramIndex++}`);
      values.push(updates.transportadora);
    }
    
    if (updates.files) {
      setClauses.push(`files = $${paramIndex++}`);
      values.push(JSON.stringify(updates.files));
    }
    
    if (updates.status) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    
    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);
    
    if (setClauses.length === 1) { // Only updated_at
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    // Add WHERE clause parameter
    let whereClause;
    if (isDbId) {
      whereClause = `WHERE id = $${paramIndex}`;
      values.push(idAsInt);
    } else {
      whereClause = `WHERE bling_order_id = $${paramIndex}`;
      values.push(orderId);
    }
    
    const query = `
      UPDATE orders
      SET ${setClauses.join(', ')}
      ${whereClause}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, values);
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Ordem não encontrada' });
    }
    
    res.json(rowToOrder(rows[0]));
  } catch (err) {
    console.error('PATCH /orders/:id error', err);
    res.status(500).json({ message: 'Erro ao atualizar ordem', error: err.message });
  }
});

// DELETE /orders/:id - cancel or remove an order
router.delete('/:id', async (req, res) => {
  // simple demo-friendly behaviour: if no pool, remove from mock array
  if (!pool) {
    const idx = MOCK_ORDERS.findIndex(o => o.id === req.params.id || o.dbId === Number(req.params.id));
    if (idx === -1) {
      return res.status(404).json({ message: 'Ordem não encontrada' });
    }
    MOCK_ORDERS.splice(idx, 1);
    return res.json({ success: true });
  }

  try {
    const orderId = req.params.id;
    const idAsInt = parseInt(orderId, 10);
    const isDbId = !isNaN(idAsInt) && idAsInt < 1000000;
    let query, params;
    if (isDbId) {
      query = `DELETE FROM orders WHERE id = $1 RETURNING *`;
      params = [idAsInt];
    } else {
      query = `DELETE FROM orders WHERE bling_order_id = $1 RETURNING *`;
      params = [orderId];
    }

    const { rows } = await pool.query(query, params);
    if (!rows.length) {
      return res.status(404).json({ message: 'Ordem não encontrada' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /orders/:id error', err);
    res.status(500).json({ message: 'Erro ao remover ordem', error: err.message });
  }
});

module.exports = router

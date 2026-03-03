// Routes for inventory queries and manual sync
// GET /stock/:sku  -> returns row from inventory table
// POST /stock/sync -> triggers a sync for provided SKU(s)

const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');

// query current inventory by SKU
router.get('/:sku', async (req, res) => {
  try {
    const sku = req.params.sku;
    const inv = await stockService.getInventory(sku);
    if (!inv) return res.status(404).json({ message: 'Not found' });
    res.json(inv);
  } catch (err) {
    console.error('Stock query error', err);
    res.status(500).json({ message: 'Error fetching inventory' });
  }
});

// sync SKU(s) manually via request body { skus: ['A','B'] }
router.post('/sync', async (req, res) => {
  try {
    const skus = req.body.skus || [];
    const result = await stockService.syncMultiple(skus);
    res.json({ synced: result.length });
  } catch (err) {
    console.error('Stock manual sync error', err);
    res.status(500).json({ message: 'Error syncing inventory' });
  }
});

module.exports = router;
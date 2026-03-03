// LGPD compliance routes
// Requires authentication + admin/dpo role (enforced by authMiddleware)

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const lgpdController = require('../controllers/lgpdController');

// Both endpoints require a valid JWT (full auth, not temp 2FA token)
router.use(authMiddleware);

// GET /lgpd/data/:email — retrieve all personal data by customer email
router.get('/data/:email', lgpdController.getDataByEmail);

// DELETE /lgpd/erase/:email — anonymise all personal data by customer email
router.delete('/erase/:email', lgpdController.eraseByEmail);

module.exports = router;

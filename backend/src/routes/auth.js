// Rotas de autenticação
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Limite: 10 tentativas de login por 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// POST /auth/login — email + senha → JWT
router.post('/login', loginLimiter, authController.login);

// GET /auth/me — retorna dados do usuário autenticado
router.get('/me', authMiddleware, authController.me);

// POST /auth/change-password — troca senha do usuário autenticado
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;

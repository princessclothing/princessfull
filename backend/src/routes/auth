// Routes for authentication (login, 2FA verify, setup)
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again later.' },
});

// 5 TOTP attempts per 5 minutes per IP
// TOTP codes rotate every 30 seconds so 5 attempts is already generous.
// Without this a 6-digit code can be brute-forced in ~83 minutes at 200 req/s.
const totpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { message: 'Too many 2FA attempts. Please wait before trying again.' },
});

// login with email/password → returns temporary token
router.post('/login', loginLimiter, authController.login);

// verify a TOTP code using temporary token → returns final JWT
router.post('/2fa/verify', totpLimiter, authController.verify2fa);

// generate a QR code for 2FA setup; user must already be authenticated
router.get('/2fa/setup', authMiddleware, authController.generate2faSetup);

module.exports = router;

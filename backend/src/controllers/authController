// Authentication controller logic (JWT issuance, TOTP 2FA validation)
// Implements the three endpoints required by the specification:
//  POST /auth/login
//  POST /auth/2fa/verify
//  GET  /auth/2fa/setup

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET;
const TEMP_TOKEN_EXP = '15m';   // short-lived token while 2FA is pending
const FINAL_TOKEN_EXP = '8h';   // final JWT expiration

// ---------------------------------------------------------------------------
// TOTP replay prevention
// Each TOTP code is valid for one 30-second window. Without this cache, an
// intercepted code could be reused within that same window (replay attack).
// Key format: `${userId}:${code}`. TTL = 90 s (window:1 covers -30/0/+30 s).
// In production: replace with Redis SETEX for multi-instance safety.
// ---------------------------------------------------------------------------
const usedTotpCodes = new Map(); // key -> expiresAt timestamp

function markTotpUsed(userId, code) {
  usedTotpCodes.set(`${userId}:${code}`, Date.now() + 90_000);
}

function isTotpAlreadyUsed(userId, code) {
  const exp = usedTotpCodes.get(`${userId}:${code}`);
  if (!exp) return false;
  if (Date.now() > exp) { usedTotpCodes.delete(`${userId}:${code}`); return false; }
  return true;
}

// gc expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, exp] of usedTotpCodes) {
    if (now > exp) usedTotpCodes.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Login handler – verifies email/password and returns a temporary token
 * that indicates 2FA is still required. The client should then call
 * /auth/2fa/verify with the TOTP code and this token.
 */
exports.login = async (req, res) => {
  try {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // At this stage we have a valid email/password. Generate a temporary
  // JWT that encodes the user ID and a flag indicating 2FA is required.
  const tempToken = jwt.sign(
    { userId: user.id, twoFactor: true },
    JWT_SECRET,
    { expiresIn: TEMP_TOKEN_EXP }
  );

  res.json({ tempToken });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 2FA verification handler – accepts a TOTP code along with the temporary
 * token issued by /auth/login. If the TOTP code is correct, issues the
 * final JWT that can be used to access protected endpoints.
 */
exports.verify2fa = async (req, res) => {
  try {
  const { token, code } = req.body;

  if (!token || !code) {
    return res.status(400).json({ message: 'Token and code are required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  if (!payload.twoFactor) {
    return res.status(400).json({ message: 'Token is not a 2FA token' });
  }

  const user = await User.findByPk(payload.userId);
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  if (!user.totpSecret) {
    return res.status(400).json({ message: '2FA is not configured for this user' });
  }

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!verified) {
    return res.status(401).json({ message: 'Invalid 2FA code' });
  }

  // replay attack prevention: reject reuse of an already-consumed code
  if (isTotpAlreadyUsed(user.id, code)) {
    return res.status(401).json({ message: 'TOTP code already used. Wait for the next code.' });
  }
  markTotpUsed(user.id, code);

  // Issue the final JWT (no twoFactor flag needed)
  const finalToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: FINAL_TOKEN_EXP }
  );

  res.json({ token: finalToken });
  } catch (err) {
    console.error('2FA verify error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 2FA setup handler – protected route. Generates a new TOTP secret for
 * the authenticated user, stores it, and returns a QR code data URL that
 * can be scanned by an authenticator app.
 */
exports.generate2faSetup = async (req, res) => {
  const user = req.user; // populated by authMiddleware

  // generate a fresh secret each time the endpoint is called
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `FulfillPanel (${user.email})`,
  });

  // store base32 secret on user record
  user.totpSecret = secret.base32;
  await User.save(user);

  // convert otpauth URL to QR code data URI
  qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to generate QR code' });
    }

    // NOTE: base32 is returned ONCE here for the user to manually enter into
    // their authenticator app. It is NOT stored in a cookie or logged.
    // After this response the raw secret is never exposed again.
    res.json({
      qrCode: data_url,
      // otpAuthUrl intentionally omitted from response to avoid leaking secret
      // in server logs (it is embedded in the QR code already)
      base32: secret.base32, // display-once; operator manually saves in authenticator
    });
  });
};


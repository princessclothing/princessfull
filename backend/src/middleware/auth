// middleware/auth.js
// JWT authentication middleware for protected routes
const jwt = require('jsonwebtoken');

/**
 * requireAuth middleware — validates JWT token in Authorization header
 * Adds decoded user to req.user if valid, otherwise returns 401
 * 
 * For demo/testing: accepts requests without token (logs warning)
 */
function requireAuth(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    // Demo mode: allow access without authentication (log warning)
    console.warn('[requireAuth] No token provided — allowing unauthenticated access (demo mode)');
    req.user = { id: 'demo-user', shopId: null, email: 'demo@fulfillpanel.local' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[requireAuth] Invalid token:', err.message);
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
}

module.exports = { requireAuth };

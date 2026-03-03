// Middleware for JWT authentication and route protection.
// Verifies the Authorization header contains a valid bearer token and
// populates `req.user` with the corresponding user record.

const jwt = require('jsonwebtoken');
const User = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // reject tokens that are still in the 2FA-pending stage
    if (payload.twoFactor) {
      return res.status(401).json({ message: '2FA verification not completed' });
    }

    const user = await User.findByPk(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token (user not found)' });
    }

    // Attach user to request and continue
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

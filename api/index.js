/**
 * api/index.js — Vercel Serverless Function entry point (project root)
 *
 * O Vercel detecta esta pasta /api na raiz do projecto e expõe cada
 * ficheiro como um handler HTTP. Este ficheiro delega tudo ao app Express
 * que vive em backend/src/index.js.
 */

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config({
      path: require('path').resolve(__dirname, '../backend/.env'),
    });
  } catch (_) {}
}

let app;
let loadError;
try {
  app = require('../backend/src/index');
} catch (err) {
  loadError = err;
  console.error('[api/index] Failed to load backend app:', err.message);
  console.error(err.stack);
}

// Vercel sends URLs like: /api/bling/sync
// Express expects: /bling/sync
// So we need to strip /api prefix before passing to Express
module.exports = (req, res) => {
  if (loadError) {
    return res.status(500).json({
      error: 'Backend failed to load',
      message: loadError.message,
      stack: loadError.stack,
    });
  }
  // Strip /api prefix
  req.url = req.url.replace(/^\/api/, '') || '/';
  app(req, res);
};



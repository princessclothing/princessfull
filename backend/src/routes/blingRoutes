// HTTP routes exposing Bling integration endpoints
// For example: GET /bling/sync?shop_ids=1,2,3

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const blingService = require('../services/blingService');

// Generate authorization URL for Bling OAuth2 flow
router.get('/auth', (req, res) => {
  const state = crypto.randomBytes(24).toString('base64url');
  const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.BLING_CLIENT_ID);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', process.env.BLING_REDIRECT_URI);
  
  res.json({ 
    url: authUrl.toString(),
    instructions: 'Open this URL in your browser, authorize, then call /api/bling/callback?code={code}'
  });
});

// OAuth2 callback — GET: browser redirect from Bling (Authorization Code flow)
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) return res.status(400).send(`Bling authorization denied: ${error}`);
    if (!code) return res.status(400).send('Missing code parameter');

    const credentials = `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`;
    const basicAuth = `Basic ${Buffer.from(credentials).toString('base64')}`;

    const resp = await axios.post(
      `${process.env.BLING_API_URL}/oauth/token`,
      new URLSearchParams({ grant_type: 'authorization_code', code }),
      {
        headers: {
          'Authorization': basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
          'enable-jwt': '1',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = resp.data;
    blingService.setTokenData({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
    });

    // Redirect to frontend with success message
    const frontendUrl = process.env.PRODUCTION_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?bling_auth=success`);
  } catch (err) {
    console.error('Bling GET callback error:', err.response?.data || err.message);
    res.status(500).send(`Failed to exchange code for tokens: ${err.response?.data?.error?.message || err.message}`);
  }
});

// OAuth2 callback endpoint - exchanges code for JWT tokens (manual / API call)
router.post('/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Missing code parameter' });

    const credentials = `${process.env.BLING_CLIENT_ID}:${process.env.BLING_CLIENT_SECRET}`;
    const basicAuth = `Basic ${Buffer.from(credentials).toString('base64')}`;

    const resp = await axios.post(
      `${process.env.BLING_API_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
      }),
      {
        headers: {
          'Authorization': basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
          'enable-jwt': '1',  // ⚠️ CRITICAL: Enable JWT tokens
        },
      }
    );

    const { access_token, refresh_token, expires_in } = resp.data;
    
    // Store tokens in service
    blingService.setTokenData({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
    });

    res.json({ 
      success: true,
      message: 'JWT tokens obtained successfully',
      tokenSize: access_token.length,
      expiresIn: expires_in,
      tokens: {
        access_token: access_token.substring(0, 50) + '...',
        refresh_token: refresh_token,
      }
    });
  } catch (err) {
    console.error('Bling callback error:', err.response?.data || err.message);
    res.status(500).json({ 
      message: 'Failed to exchange code for tokens',
      error: err.response?.data || err.message 
    });
  }
});

router.get('/sync', async (req, res) => {
  try {
    const shopIds = req.query.shop_ids
      ? req.query.shop_ids.split(',').map(s => s.trim())
      : [];
    const result = await blingService.syncOrders(shopIds);
    res.json(result);
  } catch (err) {
    console.error('Bling sync error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      message: 'Failed to synchronize orders',
      error: err.message,
      details: err.response?.data || err.toString(),
    });
  }
});

module.exports = router;
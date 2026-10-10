const express = require('express');
const axios = require('axios');
const tokenStore = require('../utils/tokenStore');
const logger = require('../utils/logger');

const authRoutes = express.Router();
const adminRoutes = express.Router();

const API_BASE = 'https://api.upstox.com/v2';

// Get Auth URL
adminRoutes.get('/login-url', (req, res) => {
  const apiKey = process.env.UPSTOX_API_KEY;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;
  if (!apiKey || !redirectUri) {
    return res.status(500).json({ error: 'API Key or Redirect URI not configured in .env' });
  }
  
  const url = `${API_BASE}/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${redirectUri}`;
  res.json({ url });
});

// Admin status
adminRoutes.get('/status', (req, res) => {
  const tokenData = tokenStore.load();
  res.json({
    hasToken: !!tokenData,
    tokenExpires: tokenData ? new Date(tokenData.expiresAt).toISOString() : null,
    dataSource: process.env.DATA_SOURCE
  });
});

// Public callback for Upstox OAuth
authRoutes.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const response = await axios.post(`${API_BASE}/login/authorization/token`, new URLSearchParams({
      code,
      client_id: process.env.UPSTOX_API_KEY,
      client_secret: process.env.UPSTOX_API_SECRET,
      redirect_uri: process.env.UPSTOX_REDIRECT_URI,
      grant_type: 'authorization_code'
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    if (data && data.access_token) {
      // Upstox token is valid for 1 day usually, assuming 24h if not provided
      // No expires_in field in some docs, assuming 24h
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); 
      
      tokenStore.save({
        accessToken: data.access_token,
        expiresAt
      });
      
      logger.info('OAuth successful, token saved');
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h2>Upstox Authorization Successful!</h2>
            <p>You can close this tab and return to the application.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
      
      // Need to restart connection
      logger.info('Please restart server to apply new token and connect to feed.');
    } else {
      res.status(500).send('Invalid token response from Upstox');
    }
  } catch (err) {
    logger.error('OAuth Callback Error:', err.response ? err.response.data : err.message);
    res.status(500).send(`Error during authorization: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
});

module.exports = {
  authRoutes,
  adminRoutes
};

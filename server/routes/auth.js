const express = require('express');
const angelAuth = require('../services/angeloneAuth');
const angelone = require('../dataSource/angelone');
const tokenStore = require('../utils/tokenStore');
const marketSession = require('../services/marketSession');
const logger = require('../utils/logger');

const authRoutes = express.Router();
const adminRoutes = express.Router();

/**
 * GET /admin/status or /auth/status
 * Returns connection and authentication status without exposing credentials
 */
function getStatusHandler(req, res) {
  const tokenData = tokenStore.load();
  const credentialsConfigured = !!(
    process.env.ANGEL_API_KEY &&
    process.env.ANGEL_CLIENT_CODE &&
    process.env.ANGEL_PIN &&
    process.env.ANGEL_TOTP_SECRET
  );

  const marketStatus = marketSession.getMarketStatus();

  res.json({
    dataSource: process.env.DATA_SOURCE || 'mock',
    credentialsConfigured,
    hasToken: !!tokenData?.jwtToken,
    tokenExpires: tokenData?.expiresAt ? new Date(tokenData.expiresAt).toISOString() : null,
    clientCode: tokenData?.clientCode ? `${tokenData.clientCode.substring(0, 2)}***` : null,
    market: marketStatus
  });
}

adminRoutes.get('/status', getStatusHandler);
authRoutes.get('/status', getStatusHandler);

/**
 * POST /admin/connect or POST /auth/connect
 * Triggers authentication with Angel One using configured env or provided credentials
 */
async function handleConnect(req, res) {
  const apiKey = req.body?.apiKey || process.env.ANGEL_API_KEY;
  const clientCode = req.body?.clientCode || process.env.ANGEL_CLIENT_CODE;
  const pin = req.body?.pin || process.env.ANGEL_PIN;
  const totpSecret = req.body?.totpSecret || process.env.ANGEL_TOTP_SECRET;

  if (!apiKey || !clientCode || !pin || !totpSecret) {
    return res.status(400).json({
      success: false,
      error: 'Missing required credentials (API Key, Client Code, PIN, TOTP Secret)'
    });
  }

  try {
    const authResult = await angelAuth.login(apiKey, clientCode, pin, totpSecret);
    tokenStore.save({
      jwtToken: authResult.jwtToken,
      refreshToken: authResult.refreshToken,
      feedToken: authResult.feedToken,
      clientCode: authResult.clientCode,
      expiresAt: authResult.expiresAt,
      loginTime: authResult.loginTime
    });

    // Also trigger reconnect in angelone data source if loaded
    try {
      await angelone.reconnect();
    } catch (e) {
      logger.warn('AngelOne data source reconnect trigger:', e.message);
    }

    res.json({
      success: true,
      message: 'Successfully connected to Angel One SmartAPI',
      tokenExpires: new Date(authResult.expiresAt).toISOString()
    });
  } catch (err) {
    logger.error('Connect failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to connect to Angel One SmartAPI'
    });
  }
}

adminRoutes.post('/connect', handleConnect);
authRoutes.post('/connect', handleConnect);

/**
 * POST /admin/reconnect
 * Reconnects using current credentials or cached refresh token
 */
adminRoutes.post('/reconnect', async (req, res) => {
  try {
    await angelone.reconnect();
    res.json({ success: true, message: 'Reconnected successfully' });
  } catch (err) {
    logger.error('Reconnect failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /admin/logout
 * Logs out and clears local session tokens
 */
adminRoutes.post('/logout', async (req, res) => {
  try {
    const tokenData = tokenStore.load();
    if (tokenData && process.env.ANGEL_API_KEY) {
      await angelAuth.logout(process.env.ANGEL_API_KEY, tokenData.clientCode, tokenData.jwtToken);
    }
    tokenStore.clear();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error:', err.message);
    tokenStore.clear();
    res.json({ success: true, message: 'Logged out locally' });
  }
});

module.exports = {
  authRoutes,
  adminRoutes
};

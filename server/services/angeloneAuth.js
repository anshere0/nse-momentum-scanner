const axios = require('axios');
const logger = require('../utils/logger');

const API_BASE = 'https://apiconnect.angelone.in';

// Standard headers required by Angel One SmartAPI
function getBaseHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': apiKey
  };
}

function getAuthHeaders(apiKey, jwtToken) {
  return {
    ...getBaseHeaders(apiKey),
    'Authorization': `Bearer ${jwtToken}`
  };
}

const crypto = require('crypto');

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = [];

  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/**
 * Generate TOTP from secret key using RFC 6238 HMAC-SHA1
 */
function generateTotp(totpSecret) {
  if (!totpSecret) {
    throw new Error('TOTP secret is missing or empty');
  }

  try {
    const key = base32Decode(totpSecret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return String(otp).padStart(6, '0');
  } catch (err) {
    logger.error('Failed to generate TOTP:', err.message);
    throw new Error(`TOTP generation failed: ${err.message}`);
  }
}

/**
 * Login to Angel One SmartAPI
 * Returns: { jwtToken, refreshToken, feedToken, clientCode }
 */
async function login(apiKey, clientCode, pin, totpSecret) {
  if (!apiKey || !clientCode || !pin || !totpSecret) {
    throw new Error('Missing required credentials: ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_PIN, ANGEL_TOTP_SECRET');
  }

  const totpCode = generateTotp(totpSecret);
  logger.info(`Authenticating with Angel One SmartAPI (client: ${clientCode.substring(0, 2)}***)`);

  try {
    const response = await axios.post(
      `${API_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`,
      {
        clientcode: clientCode,
        password: pin,
        totp: totpCode
      },
      { headers: getBaseHeaders(apiKey) }
    );

    const data = response.data;

    if (!data.status || !data.data) {
      throw new Error(data.message || 'Login failed: Invalid response from Angel One');
    }

    const result = {
      jwtToken: data.data.jwtToken,
      refreshToken: data.data.refreshToken,
      feedToken: data.data.feedToken,
      clientCode: clientCode,
      apiKey: apiKey,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // Tokens valid until next 5 AM IST roughly
      loginTime: Date.now()
    };

    logger.info('Angel One authentication successful');
    return result;
  } catch (err) {
    if (err.response) {
      const errData = err.response.data;
      const errMsg = errData?.message || JSON.stringify(errData);
      logger.error(`Angel One login failed (HTTP ${err.response.status}): ${errMsg}`);
      throw new Error(`Authentication failed: ${errMsg}`);
    }
    logger.error('Angel One login error:', err.message);
    throw err;
  }
}

/**
 * Refresh the JWT token using refresh token
 */
async function refreshSession(apiKey, refreshToken) {
  try {
    const response = await axios.post(
      `${API_BASE}/rest/auth/angelbroking/jwt/v1/generateTokens`,
      { refreshToken },
      { headers: getBaseHeaders(apiKey) }
    );

    const data = response.data;
    if (!data.status || !data.data) {
      throw new Error(data.message || 'Token refresh failed');
    }

    return {
      jwtToken: data.data.jwtToken,
      refreshToken: data.data.refreshToken,
      feedToken: data.data.feedToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
  } catch (err) {
    logger.error('Token refresh failed:', err.response?.data?.message || err.message);
    throw err;
  }
}

/**
 * Logout from Angel One SmartAPI
 */
async function logout(apiKey, clientCode, jwtToken) {
  try {
    await axios.post(
      `${API_BASE}/rest/secure/angelbroking/user/v1/logout`,
      { clientcode: clientCode },
      { headers: getAuthHeaders(apiKey, jwtToken) }
    );
    logger.info('Angel One logout successful');
  } catch (err) {
    logger.warn('Logout request failed (non-critical):', err.message);
  }
}

/**
 * Get user profile
 */
async function getProfile(apiKey, jwtToken) {
  try {
    const response = await axios.get(
      `${API_BASE}/rest/secure/angelbroking/user/v1/getProfile`,
      { headers: getAuthHeaders(apiKey, jwtToken) }
    );
    return response.data?.data || null;
  } catch (err) {
    logger.warn('Failed to fetch profile:', err.message);
    return null;
  }
}

/**
 * Check if token is still valid (by making a lightweight API call)
 */
async function validateSession(apiKey, jwtToken) {
  try {
    const profile = await getProfile(apiKey, jwtToken);
    return !!profile;
  } catch {
    return false;
  }
}

module.exports = {
  login,
  refreshSession,
  logout,
  getProfile,
  validateSession,
  generateTotp,
  getAuthHeaders,
  getBaseHeaders,
  API_BASE
};

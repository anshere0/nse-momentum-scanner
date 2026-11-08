const axios = require('axios');
const logger = require('../utils/logger');

const PRIMARY_URL = process.env.PRIMARY_SCANNER_URL || 'http://localhost:3000';
const FALLBACK_URL = 'http://52.66.84.144:3000';

let cachedSnapshot = null;
let lastSnapshotFetch = 0;
const CACHE_TTL_MS = 1000; // 1 second cache

/**
 * Fetch latest market snapshot from port 3000
 */
async function fetchSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && (now - lastSnapshotFetch) < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  // Attempt 1: PRIMARY_URL (localhost:3000 on EC2)
  try {
    const res = await axios.get(`${PRIMARY_URL}/api/snapshot`, { timeout: 2500 });
    if (res.data && res.data.status) {
      cachedSnapshot = res.data;
      lastSnapshotFetch = now;
      return cachedSnapshot;
    }
  } catch (err) {
    // If running in development and localhost:3000 is down, try remote EC2
    if (PRIMARY_URL.includes('localhost') && process.env.NODE_ENV !== 'production') {
      try {
        const fallbackRes = await axios.get(`${FALLBACK_URL}/api/snapshot`, { timeout: 3500 });
        if (fallbackRes.data && fallbackRes.data.status) {
          cachedSnapshot = fallbackRes.data;
          lastSnapshotFetch = now;
          return cachedSnapshot;
        }
      } catch (fbErr) {
        // Fall through to mock/stale cache
      }
    }
  }

  // If we have stale cache, return it
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  return null;
}

/**
 * Check health of primary scanner on port 3000
 */
async function checkPort3000Health() {
  try {
    const res = await axios.get(`${PRIMARY_URL}/api/snapshot`, { timeout: 2000 });
    return {
      status: 'UP',
      url: PRIMARY_URL,
      statusCode: res.status,
      connection: res.data?.status?.connection || 'UNKNOWN',
      dataMode: res.data?.status?.dataMode || 'UNKNOWN',
      tickCount: res.data?.status?.tickCount || 0
    };
  } catch (err) {
    // Also test fallback if development
    if (PRIMARY_URL.includes('localhost') && process.env.NODE_ENV !== 'production') {
      try {
        const fb = await axios.get(`${FALLBACK_URL}/api/snapshot`, { timeout: 3000 });
        return {
          status: 'UP_REMOTE',
          url: FALLBACK_URL,
          statusCode: fb.status,
          connection: fb.data?.status?.connection || 'UNKNOWN',
          dataMode: fb.data?.status?.dataMode || 'UNKNOWN',
          tickCount: fb.data?.status?.tickCount || 0
        };
      } catch (e) {
        // Fall through
      }
    }
    return {
      status: 'DOWN',
      url: PRIMARY_URL,
      error: err.message
    };
  }
}

module.exports = {
  fetchSnapshot,
  checkPort3000Health
};

const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const router = express.Router();
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    logger.error('Failed to read settings file:', err.message);
  }
  return {};
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * GET /api/pro/settings
 */
router.get('/', (req, res) => {
  res.json(loadSettings());
});

/**
 * POST /api/pro/settings
 */
router.post('/', (req, res) => {
  try {
    const current = loadSettings();
    const updated = { ...current, ...req.body };
    saveSettings(updated);
    logger.info('Pro-suite settings saved successfully');
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings', message: err.message });
  }
});

/**
 * POST /api/pro/settings/reset
 */
router.post('/reset', (req, res) => {
  try {
    const defaultSettings = {
      quadrant: { enabled: true, minPriceChangePct: 0.5, minOiChangePct: 5.0 },
      vwap: { enabled: true, idealDistanceMinPct: 0.5, idealDistanceMaxPct: 1.0, overextendedLimitPct: 3.0 },
      orb: { enabled: true, windowMinutes: 15, requireVolumeConfirmation: false },
      rvol: { enabled: true, lookbackDays: 10, highThreshold: 2.0, veryHighThreshold: 3.0 },
      sector: { enabled: true, rsThreshold: 0.5, onlyShowAligned: false },
      risk: {
        enabled: true,
        totalCapital: 100000,
        riskType: 'FIXED_AMOUNT',
        maxRiskPerTrade: 2000,
        riskPct: 2.0,
        slMethod: 'VWAP',
        target1Multiplier: 1.5,
        target2Multiplier: 2.0,
        maxTradesPerDay: 3,
        maxDailyRisk: 5000
      },
      derivatives: {
        enabled: true,
        pcrOverbought: 1.4,
        pcrOversold: 0.6,
        vixCalmLimit: 13.0,
        vixVolatileLimit: 18.0,
        wallProximityPct: 1.5
      },
      alerts: {
        enabled: true,
        soundEnabled: true,
        volume: 0.8,
        cooldownMinutes: 30,
        maxAlertsPerDay: 10,
        requirePdhOrOrb: true,
        requireVwap: true,
        requireRvol: true,
        requireQuadrant: true,
        requireSector: true
      },
      journal: { evalTargetPct: 1.0, evalSlPct: 0.5, useDynamicLevels: true }
    };
    saveSettings(defaultSettings);
    res.json({ success: true, settings: defaultSettings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

module.exports = router;

const express = require('express');
const cashUniverseService = require('../services/cashUniverseService');

const router = express.Router();

/**
 * GET /api/simple/stocks
 * Supports: segment ('CASH' | 'FNO'), search, filter, sortField, sortDir, page, limit
 * and all editable filter thresholds.
 */
router.get('/stocks', async (req, res) => {
  try {
    const {
      segment = 'CASH',
      search = '',
      filter = 'ALL',
      sortField = 'pChange',
      sortDir = 'desc',
      page = 1,
      limit = 50,
      priceChangeEnabled,
      minPriceChange,
      maxPriceChange,
      ltpFilterEnabled,
      minLtp,
      maxLtp,
      volumeFilterEnabled,
      minVolume,
      pdhFilterEnabled,
      pdlFilterEnabled,
      oiFilterEnabled,
      minOiChangePct,
      maxOiChangePct,
      oiPositiveOnly,
      oiNegativeOnly
    } = req.query;

    const result = await cashUniverseService.getStocks({
      segment,
      search,
      filter,
      sortField,
      sortDir,
      page,
      limit,
      priceChangeEnabled: priceChangeEnabled === 'true' || priceChangeEnabled === true,
      minPriceChange: parseFloat(minPriceChange) || 0.5,
      maxPriceChange: parseFloat(maxPriceChange) || 20.0,
      ltpFilterEnabled: ltpFilterEnabled === 'true' || ltpFilterEnabled === true,
      minLtp: parseFloat(minLtp) || 0,
      maxLtp: parseFloat(maxLtp) || 999999,
      volumeFilterEnabled: volumeFilterEnabled === 'true' || volumeFilterEnabled === true,
      minVolume: parseFloat(minVolume) || 0,
      pdhFilterEnabled: pdhFilterEnabled === 'true' || pdhFilterEnabled === true,
      pdlFilterEnabled: pdlFilterEnabled === 'true' || pdlFilterEnabled === true,
      oiFilterEnabled: oiFilterEnabled === 'true' || oiFilterEnabled === true,
      minOiChangePct: parseFloat(minOiChangePct) || 5.0,
      maxOiChangePct: parseFloat(maxOiChangePct) || 500.0,
      oiPositiveOnly: oiPositiveOnly === 'true' || oiPositiveOnly === true,
      oiNegativeOnly: oiNegativeOnly === 'true' || oiNegativeOnly === true
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stocks', message: err.message });
  }
});

/**
 * GET /api/simple/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const segment = req.query.segment || 'CASH';
    const all = (await cashUniverseService.getStocks({ segment, limit: 5000 })).stocks || [];
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;

    for (const s of all) {
      if (s.pChange > 0) advancing++;
      else if (s.pChange < 0) declining++;
      else unchanged++;
    }

    res.json({
      segment,
      total: all.length,
      advancing,
      declining,
      unchanged,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

module.exports = router;

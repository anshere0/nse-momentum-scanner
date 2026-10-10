const express = require('express');
const marketState = require('../state/marketState');

const apiRoutes = express.Router();

apiRoutes.get('/snapshot', (req, res) => {
  res.json(marketState.getSnapshot());
});

apiRoutes.get('/universe', (req, res) => {
  res.json({
    fno: marketState.fnoUniverse.map(u => ({
      key: u.instrument_key,
      symbol: u.tradingsymbol,
      name: u.name
    })),
    indices: marketState.indicesUniverse.map(u => ({
      key: u.instrument_key,
      symbol: u.tradingsymbol,
      name: u.name
    }))
  });
});

apiRoutes.get('/config', (req, res) => {
  res.json(marketState.getConfig());
});

apiRoutes.post('/config', (req, res) => {
  const newConfig = req.body;
  
  // Validate and parse numerical fields
  if (newConfig.MIN_PCT_CHANGE !== undefined) newConfig.MIN_PCT_CHANGE = parseFloat(newConfig.MIN_PCT_CHANGE);
  if (newConfig.MAX_PCT_CHANGE !== undefined) newConfig.MAX_PCT_CHANGE = parseFloat(newConfig.MAX_PCT_CHANGE);
  if (newConfig.MIN_OI_CHANGE_PCT !== undefined) newConfig.MIN_OI_CHANGE_PCT = parseFloat(newConfig.MIN_OI_CHANGE_PCT);
  if (newConfig.MAX_OI_CHANGE_PCT !== undefined) newConfig.MAX_OI_CHANGE_PCT = parseFloat(newConfig.MAX_OI_CHANGE_PCT);
  
  marketState.updateConfig(newConfig);
  res.json({ success: true, config: marketState.getConfig() });
});

module.exports = apiRoutes;

const express = require('express');
const proxyClient = require('../services/proxyClient');

const router = express.Router();
const startTime = Date.now();

router.get('/', async (req, res) => {
  const mem = process.memoryUsage();
  const primaryHealth = await proxyClient.checkPort3000Health();

  const proHealth = {
    port: process.env.PORT || 3001,
    status: 'UP',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    memoryRssMB: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    memoryHeapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    nodeVersion: process.version
  };

  const isAllHealthy = proHealth.status === 'UP' && (primaryHealth.status === 'UP' || primaryHealth.status === 'UP_REMOTE');

  res.status(isAllHealthy ? 200 : 207).json({
    status: isAllHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    proSuite: proHealth,
    primaryScanner: primaryHealth,
    message: isAllHealthy
      ? 'Both Port 3000 and Port 3001 are responding normally.'
      : 'Pro-Suite is UP, but Primary Scanner on Port 3000 has warning/fallback.'
  });
});

module.exports = router;

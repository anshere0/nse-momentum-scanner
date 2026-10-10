const express = require('express');
const sseRoutes = express.Router();
const logger = require('../utils/logger');

// Set to hold all active SSE connections
const clients = new Set();

sseRoutes.get('/live', (req, res) => {
  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  res.write('\n'); // Initiate connection

  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
  });
});

// Helper function to broadcast to all connected clients
sseRoutes.broadcast = (data) => {
  if (clients.size === 0) return;
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach(client => {
    try {
      client.write(payload);
    } catch (err) {
      logger.error('Error broadcasting to client, removing from list:', err.message);
      clients.delete(client);
    }
  });
};

module.exports = sseRoutes;

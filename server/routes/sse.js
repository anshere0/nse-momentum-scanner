const express = require('express');
const sseRoutes = express.Router();
const logger = require('../utils/logger');

// Set to hold all active SSE connections
const clients = new Set();

sseRoutes.get('/live', (req, res) => {
  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  res.write(': keepalive\n\n');

  clients.add(res);

  const cleanup = () => {
    clients.delete(res);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

// Periodic keepalive ping so intermediate proxies/firewalls do not drop idle SSE connections
setInterval(() => {
  if (clients.size === 0) return;
  clients.forEach(client => {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(': ping\n\n');
      } else {
        clients.delete(client);
      }
    } catch {
      clients.delete(client);
    }
  });
}, 15000);

// Helper function to broadcast to all connected clients
sseRoutes.broadcast = (data) => {
  if (clients.size === 0) return;
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach(client => {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(payload);
      } else {
        clients.delete(client);
      }
    } catch (err) {
      logger.error('Error broadcasting to client, removing from list:', err.message);
      clients.delete(client);
    }
  });
};

module.exports = sseRoutes;

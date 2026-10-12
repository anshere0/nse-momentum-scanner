const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const tokenFile = path.join(__dirname, '..', '..', 'data', 'token.json');

const tokenStore = {
  save: (data) => {
    try {
      const dir = path.dirname(tokenFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(tokenFile, JSON.stringify(data, null, 2));
      logger.info('Access token saved to disk');
    } catch (err) {
      logger.error('Failed to save token:', err);
    }
  },
  load: () => {
    try {
      if (fs.existsSync(tokenFile)) {
        const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        // Check if expired
        if (data.expiresAt && Date.now() < data.expiresAt) {
          return data;
        } else {
          logger.info('Saved token has expired');
        }
      }
    } catch (err) {
      logger.error('Failed to load token:', err);
    }
    return null;
  },
  clear: () => {
    try {
      if (fs.existsSync(tokenFile)) {
        fs.unlinkSync(tokenFile);
        logger.info('Saved token cleared from disk');
      }
    } catch (err) {
      logger.error('Failed to clear token:', err);
    }
  }
};

module.exports = tokenStore;

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const oiFile = path.join(__dirname, '..', '..', 'data', 'oi_reference.json');

const oiCache = {
  save: (data, sessionDate = null) => {
    try {
      const dir = path.dirname(oiFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(oiFile, JSON.stringify({
        date: sessionDate || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        data
      }, null, 2));
      logger.info('OI reference baseline saved to data/oi_reference.json');
    } catch (err) {
      logger.error('Failed to save OI cache:', err.message);
    }
  },

  load: () => {
    try {
      if (fs.existsSync(oiFile)) {
        const cache = JSON.parse(fs.readFileSync(oiFile, 'utf8'));
        return cache;
      }
    } catch (err) {
      logger.error('Failed to load OI cache:', err.message);
    }
    return null;
  }
};

module.exports = oiCache;

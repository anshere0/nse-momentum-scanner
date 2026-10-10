const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const pdhFile = path.join(__dirname, '..', '..', 'data', 'pdh.json');

const pdhCache = {
  save: (data) => {
    try {
      const dir = path.dirname(pdhFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(pdhFile, JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        data
      }, null, 2));
      logger.info('PDH/PDL cache saved');
    } catch (err) {
      logger.error('Failed to save PDH cache:', err);
    }
  },
  load: () => {
    try {
      if (fs.existsSync(pdhFile)) {
        const cache = JSON.parse(fs.readFileSync(pdhFile, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        if (cache.date === today) {
          return cache.data;
        }
      }
    } catch (err) {
      logger.error('Failed to load PDH cache:', err);
    }
    return null;
  }
};

module.exports = pdhCache;

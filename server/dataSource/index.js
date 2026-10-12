const angelone = require('./angelone');
const mock = require('./mock');
const logger = require('../utils/logger');

function getDataSource(type = 'mock') {
  const t = type.toLowerCase();
  
  if (t === 'angelone' || t === 'angel') {
    return angelone;
  }
  
  logger.info('Using mock data source');
  return mock;
}

module.exports = {
  getDataSource
};

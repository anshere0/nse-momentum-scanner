const upstox = require('./upstox');
const mock = require('./mock');
const dhan = require('./dhan');
const logger = require('../utils/logger');

function getDataSource(type = 'mock') {
  if (type.toLowerCase() === 'upstox') {
    return upstox;
  }
  if (type.toLowerCase() === 'dhan') {
    return dhan;
  }
  
  logger.info('Using mock data source');
  return mock;
}

module.exports = {
  getDataSource
};

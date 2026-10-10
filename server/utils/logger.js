const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', '..', 'app.log');

const logger = {
  info: (...args) => {
    const msg = `[INFO] ${new Date().toISOString()} - ${args.join(' ')}`;
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
  },
  error: (...args) => {
    const msg = `[ERROR] ${new Date().toISOString()} - ${args.join(' ')}`;
    console.error(msg);
    fs.appendFileSync(logFile, msg + '\n');
  },
  warn: (...args) => {
    const msg = `[WARN] ${new Date().toISOString()} - ${args.join(' ')}`;
    console.warn(msg);
    fs.appendFileSync(logFile, msg + '\n');
  }
};

module.exports = logger;

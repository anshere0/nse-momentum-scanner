const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'pro-suite.log');
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function rotateLogIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size >= MAX_LOG_SIZE_BYTES) {
        const backupFile = path.join(LOGS_DIR, 'pro-suite.log.1');
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        fs.renameSync(LOG_FILE, backupFile);
      }
    }
  } catch (err) {
    console.error('Failed to rotate log file:', err.message);
  }
}

function writeLog(level, message, meta = '') {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${typeof meta === 'object' ? JSON.stringify(meta) : meta}` : '';
  const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  // Console output
  if (level === 'ERROR') {
    console.error(`[${level}] ${message}${metaStr}`);
  } else if (level === 'WARN') {
    console.warn(`[${level}] ${message}${metaStr}`);
  } else {
    console.log(`[${level}] ${message}${metaStr}`);
  }

  // File output with rotation
  try {
    rotateLogIfNeeded();
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (err) {
    console.error('Failed to write log file:', err.message);
  }
}

const logger = {
  info: (msg, meta) => writeLog('INFO', msg, meta),
  warn: (msg, meta) => writeLog('WARN', msg, meta),
  error: (msg, meta) => writeLog('ERROR', msg, meta),
  debug: (msg, meta) => writeLog('DEBUG', msg, meta),
};

module.exports = logger;

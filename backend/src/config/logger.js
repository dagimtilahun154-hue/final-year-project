'use strict';
/**
 * src/config/logger.js
 * Winston logger — console in dev, file in prod.
 * SRS Refs: NFR-MNT-03 (log errors, never log passwords/tokens)
 */
const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),    // capture stack traces
    logFormat
  ),
  transports: [
    // Console — always active
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),
  ],
});

// Add file transports in production (NFR-MNT-03)
if (process.env.NODE_ENV === 'production') {
  logger.add(new transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    maxsize:  5242880, // 5 MB
    maxFiles: 5,
  }));
  logger.add(new transports.File({
    filename: path.join('logs', 'combined.log'),
    maxsize:  5242880,
    maxFiles: 5,
  }));
}

// Add http level for morgan integration
logger.http = (message) => logger.log('http', message);

module.exports = logger;

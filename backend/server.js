'use strict';
require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Ankelba backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// Graceful shutdown — close pool connections on SIGTERM/SIGINT
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

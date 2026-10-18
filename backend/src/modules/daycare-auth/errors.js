'use strict';

function failure(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function unavailable(error) {
  // SQL errors can include parameter values and constraint details. Do not pass
  // them to either the shared response mapper or its logger.
  if (error && Number.isInteger(error.statusCode)) return error;
  return failure(503, 'Authentication service temporarily unavailable');
}

module.exports = { failure, unavailable };

const crypto = require('node:crypto');

function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = { generateTraceId, generateSpanId };

const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldBlockPath } = require('./should-block-path');

const CONFIG = {
  denyPatterns: ['.env', '.env.*', '*.pem', 'credentials.json'],
  allowPatterns: ['.env.example', '.env.sample'],
};

test('blocks a plain .env file', () => {
  assert.equal(shouldBlockPath('.env', CONFIG), true);
});

test('blocks a .env.production file matching the wildcard deny pattern', () => {
  assert.equal(shouldBlockPath('.env.production', CONFIG), true);
});

test('allow pattern overrides a matching deny pattern — the critical precedence case', () => {
  // .env.example matches the ".env.*" deny pattern too, but the explicit
  // allow pattern must win — this is the whole point of having an allow
  // list at all.
  assert.equal(shouldBlockPath('.env.example', CONFIG), false);
});

test('does not block a file matching neither list', () => {
  assert.equal(shouldBlockPath('README.md', CONFIG), false);
});

test('blocks regardless of directory depth', () => {
  assert.equal(shouldBlockPath('config/nested/deep/.env', CONFIG), true);
});

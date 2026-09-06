const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesAnyPattern } = require('./glob-pattern-matcher');

test('matches an exact literal filename', () => {
  assert.equal(matchesAnyPattern('.env', ['.env']), true);
  assert.equal(matchesAnyPattern('other.txt', ['.env']), false);
});

test('matches a wildcard suffix pattern', () => {
  assert.equal(matchesAnyPattern('.env.local', ['.env.*']), true);
  assert.equal(matchesAnyPattern('.env.production', ['.env.*']), true);
  assert.equal(matchesAnyPattern('.env', ['.env.*']), false); // no trailing segment
});

test('matches a wildcard prefix pattern (extension-style)', () => {
  assert.equal(matchesAnyPattern('server.pem', ['*.pem']), true);
  assert.equal(matchesAnyPattern('server.pem.bak', ['*.pem']), false); // exact suffix required
});

test('matches against basename only, ignoring directory', () => {
  assert.equal(matchesAnyPattern('/deep/nested/path/id_rsa', ['id_rsa']), true);
  assert.equal(matchesAnyPattern('config/.env', ['.env']), true);
});

test('matches against any pattern in a list', () => {
  const patterns = ['.env', '*.pem', 'id_rsa', 'credentials.json'];
  assert.equal(matchesAnyPattern('credentials.json', patterns), true);
  assert.equal(matchesAnyPattern('server.key', patterns), false);
});

test('special regex characters in a pattern are treated literally, not as regex', () => {
  assert.equal(matchesAnyPattern('a.env', ['a.env']), true);
  assert.equal(matchesAnyPattern('aXenv', ['a.env']), false); // "." must be literal, not "any char"
});

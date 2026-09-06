const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeSuperpowersRedirect, MARKER } = require('./redirect-superpowers');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-redirect-test-'));
}

test('creates CLAUDE.md with the redirect block when none exists', () => {
  const repo = makeTempRepo();
  const result = writeSuperpowersRedirect(repo);

  assert.equal(result.updated, true);
  const content = fs.readFileSync(result.path, 'utf8');
  assert.match(content, /zenno\/plans\//);
  assert.match(content, /zenno\/specs\//);
});

test('appends to an existing CLAUDE.md without destroying prior content', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), '# My Project\n\nSome existing notes.\n');

  writeSuperpowersRedirect(repo);

  const content = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8');
  assert.match(content, /My Project/);
  assert.match(content, /Some existing notes/);
  assert.match(content, /zenno\/plans\//);
});

test('is idempotent — does not duplicate the block on rerun', () => {
  const repo = makeTempRepo();
  writeSuperpowersRedirect(repo);
  const second = writeSuperpowersRedirect(repo);

  assert.equal(second.updated, false);
  const content = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8');
  const occurrences = content.split(MARKER).length - 1;
  assert.equal(occurrences, 2); // opening + closing marker, exactly one block
});

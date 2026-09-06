const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isInManifest } = require('./check-manifest');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-manifest-test-'));
}

test('finds a package already in package.json dependencies', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({ dependencies: { express: '^4.0.0' }, devDependencies: { jest: '^29.0.0' } })
  );

  assert.equal(isInManifest(repo, 'npm', 'express'), true);
  assert.equal(isInManifest(repo, 'npm', 'jest'), true); // devDependencies too
  assert.equal(isInManifest(repo, 'npm', 'lodash'), false);
});

test('finds a package already in requirements.txt', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, 'requirements.txt'), 'requests==2.31.0\nflask>=2.0\nnumpy\n');

  assert.equal(isInManifest(repo, 'pip', 'requests'), true);
  assert.equal(isInManifest(repo, 'pip', 'flask'), true);
  assert.equal(isInManifest(repo, 'pip', 'numpy'), true); // no version pin at all
  assert.equal(isInManifest(repo, 'pip', 'django'), false);
});

test('finds a package already in Cargo.toml', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(
    path.join(repo, 'Cargo.toml'),
    '[package]\nname = "myapp"\n\n[dependencies]\nserde = "1.0"\ntokio = { version = "1", features = ["full"] }\n'
  );

  assert.equal(isInManifest(repo, 'cargo', 'serde'), true);
  assert.equal(isInManifest(repo, 'cargo', 'tokio'), true);
  assert.equal(isInManifest(repo, 'cargo', 'reqwest'), false);
});

test('returns false when the manifest file does not exist at all', () => {
  const repo = makeTempRepo();
  assert.equal(isInManifest(repo, 'npm', 'express'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeAttributionDefault } = require('./write-attribution');

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-attribution-test-'));
}

test('creates ~/.claude/settings.json with attribution off when nothing exists', () => {
  const home = makeTempHome();
  const result = writeAttributionDefault(home);

  assert.equal(result.updated, true);
  const settings = JSON.parse(fs.readFileSync(result.path, 'utf8'));
  assert.deepEqual(settings.attribution, { commit: '', pr: '' });
});

test('preserves unrelated existing settings keys', () => {
  const home = makeTempHome();
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ someOtherSetting: 'keepme' })
  );

  writeAttributionDefault(home);

  const settings = JSON.parse(
    fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')
  );
  assert.equal(settings.someOtherSetting, 'keepme');
  assert.deepEqual(settings.attribution, { commit: '', pr: '' });
});

test('is idempotent — reports no update on second run', () => {
  const home = makeTempHome();
  writeAttributionDefault(home);
  const second = writeAttributionDefault(home);

  assert.equal(second.updated, false);
});

test('never overwrites an existing attribution value, even a non-default one — protects a deliberate user restoration', () => {
  const home = makeTempHome();
  fs.mkdirSync(path.join(home, '.claude'));
  fs.writeFileSync(
    path.join(home, '.claude', 'settings.json'),
    JSON.stringify({
      attribution: { commit: 'Co-Authored-By: Claude', pr: 'Generated with Claude' },
    })
  );

  const result = writeAttributionDefault(home);

  assert.equal(result.updated, false);
  const settings = JSON.parse(
    fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')
  );
  assert.equal(settings.attribution.commit, 'Co-Authored-By: Claude');
});

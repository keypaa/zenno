const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyInstallCommand } = require('./classify-install-command');

test('classifies a plain npm install', () => {
  const result = classifyInstallCommand('npm install express');
  assert.deepEqual(result, { ecosystem: 'npm', packages: ['express'], isGlobal: false });
});

test('classifies npm install -g as global', () => {
  const result = classifyInstallCommand('npm install -g nodemon');
  assert.equal(result.isGlobal, true);
  assert.deepEqual(result.packages, ['nodemon']);
});

test('classifies npm i shorthand', () => {
  const result = classifyInstallCommand('npm i lodash');
  assert.equal(result.ecosystem, 'npm');
});

test('classifies pip install', () => {
  const result = classifyInstallCommand('pip install requests');
  assert.deepEqual(result, { ecosystem: 'pip', packages: ['requests'], isGlobal: false });
});

test('classifies pip install --user as global-ish', () => {
  const result = classifyInstallCommand('pip install --user requests');
  assert.equal(result.isGlobal, true);
});

test('classifies cargo add as project-scoped, not global', () => {
  const result = classifyInstallCommand('cargo add serde');
  assert.deepEqual(result, { ecosystem: 'cargo', packages: ['serde'], isGlobal: false });
});

test('classifies cargo install as always global', () => {
  const result = classifyInstallCommand('cargo install ripgrep');
  assert.equal(result.isGlobal, true);
});

test('classifies yarn add and pnpm add', () => {
  assert.equal(classifyInstallCommand('yarn add axios').ecosystem, 'yarn');
  assert.equal(classifyInstallCommand('pnpm add axios').ecosystem, 'pnpm');
});

test('handles multiple packages in one command', () => {
  const result = classifyInstallCommand('npm install express lodash axios');
  assert.deepEqual(result.packages, ['express', 'lodash', 'axios']);
});

test('returns null for unrelated commands', () => {
  assert.equal(classifyInstallCommand('npm test'), null);
  assert.equal(classifyInstallCommand('git commit -m "wip"'), null);
  assert.equal(classifyInstallCommand('ls -la'), null);
});

test('does not misclassify the -r requirements file argument as a package', () => {
  // -r/--requirement takes the following token as its own argument (a
  // file path), not a package name being installed. Without special
  // handling, "requirements.txt" itself would be treated as a package.
  const result = classifyInstallCommand('pip install -r requirements.txt');
  assert.deepEqual(result.packages, []);
});

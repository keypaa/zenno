const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateGraph } = require('./generate-graph');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-generate-graph-test-'));
}

test('skips generation entirely for a repo too small to be worth graphing', () => {
  const repo = makeTempRepo();
  fs.writeFileSync(path.join(repo, 'README.md'), '# hello');
  const outputDir = path.join(repo, 'zenno', 'graph');

  const result = generateGraph(repo, outputDir);

  assert.equal(result.generated, false);
  assert.equal(result.reason, 'repo-too-small');
  assert.equal(fs.existsSync(outputDir), false);
});

test('generates a real tags file for a repo with actual source code', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(
    path.join(repo, 'src', 'greeter.js'),
    'function greet(name) {\n  return "hi " + name;\n}\nmodule.exports = { greet };\n'
  );
  fs.writeFileSync(
    path.join(repo, 'src', 'math.js'),
    'function add(a, b) {\n  return a + b;\n}\nexports.add = add;\n'
  );
  fs.writeFileSync(path.join(repo, 'src', 'index.js'), 'require("./greeter");\n');
  const outputDir = path.join(repo, 'zenno', 'graph');

  const result = generateGraph(repo, outputDir);

  assert.equal(result.generated, true);
  assert.ok(result.tagCount > 0);
  assert.ok(fs.existsSync(result.path));

  const content = fs.readFileSync(result.path, 'utf8');
  assert.match(content, /greet/);
  assert.match(content, /add/);
});

test('excludes .git, node_modules, and zenno/ from the graph', () => {
  const repo = makeTempRepo();
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src', 'real.js'), 'function realFunction() {}\n');
  fs.writeFileSync(path.join(repo, 'src', 'real2.js'), 'function anotherRealFunction() {}\n');
  fs.writeFileSync(path.join(repo, 'src', 'real3.js'), 'function thirdRealFunction() {}\n');
  fs.mkdirSync(path.join(repo, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'node_modules', 'dep', 'index.js'),
    'function shouldNeverAppearInGraph() {}\n'
  );
  const outputDir = path.join(repo, 'zenno', 'graph');

  const result = generateGraph(repo, outputDir);

  assert.equal(result.generated, true);
  const content = fs.readFileSync(result.path, 'utf8');
  assert.doesNotMatch(content, /shouldNeverAppearInGraph/);
});

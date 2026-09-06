const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  readSessionUsage,
  sumUsage,
  usageByModel,
  countToolUses,
} = require('./session-usage-reader');

function writeFixture(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenno-usage-reader-test-'));
  const p = path.join(dir, 'session.jsonl');
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
  return p;
}

function assistantLine({ model, usage, content }) {
  const message = { role: 'assistant', model, content };
  if (usage !== undefined) message.usage = usage;
  return JSON.stringify({ type: 'assistant', message });
}

function fullUsage(input, output) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: 10,
    cache_read_input_tokens: 20,
  };
}

// 3-message session: normal assistant msg (usage + Bash tool_use),
// assistant msg with NO usage key (text + Agent tool_use), one user
// message, one garbage line, one blank line.
function threeMessageFixture() {
  return writeFixture([
    assistantLine({
      model: 'model-a',
      usage: fullUsage(100, 50),
      content: [
        { type: 'text', text: 'hi' },
        { type: 'tool_use', id: 't1', name: 'Bash', input: {} },
      ],
    }),
    assistantLine({
      model: 'model-b',
      content: [
        { type: 'text', text: 'x' },
        { type: 'tool_use', id: 't2', name: 'Agent', input: {} },
      ],
    }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' } }),
    'this is not json{{{',
    '',
  ]);
}

// --- reader: 6 tests ---

test('returns one row per assistant message with extracted tokens', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    model: 'model-a',
    inputTokens: 100,
    outputTokens: 50,
    cacheCreation: 10,
    cacheRead: 20,
    toolUses: ['Bash'],
  });
});

test('assistant message without usage yields zero tokens', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(rows[1], {
    model: 'model-b',
    inputTokens: 0,
    outputTokens: 0,
    cacheCreation: 0,
    cacheRead: 0,
    toolUses: ['Agent'],
  });
});

test('user messages, garbage lines and blanks are skipped, never thrown on', () => {
  const { rows, skipped } = readSessionUsage(threeMessageFixture());
  assert.equal(rows.length, 2);
  assert.equal(skipped, 3);
});

test('toolUses lists tool names per message in order', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(rows[0].toolUses, ['Bash']);
  assert.deepEqual(rows[1].toolUses, ['Agent']);
});

test('model string is passed through as-is, no normalization', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.equal(rows[0].model, 'model-a');
  assert.equal(rows[1].model, 'model-b');
});

test('assistant message without content yields empty toolUses', () => {
  const p = writeFixture([
    assistantLine({ model: 'model-a', usage: fullUsage(5, 5) }),
  ]);
  const { rows, skipped } = readSessionUsage(p);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].toolUses, []);
  assert.equal(rows[0].inputTokens, 5);
  assert.equal(skipped, 0);
});

// --- sumUsage: 3 tests ---

test('sums tokens, cache and messages across rows', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(sumUsage(rows), {
    messages: 2,
    inputTokens: 100,
    outputTokens: 50,
    cacheCreation: 10,
    cacheRead: 20,
  });
});

test('empty rows sum to zeros', () => {
  assert.deepEqual(sumUsage([]), {
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreation: 0,
    cacheRead: 0,
  });
});

test('zero-token rows still count as messages', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  const summary = sumUsage([rows[1]]);
  assert.equal(summary.messages, 1);
  assert.equal(summary.inputTokens, 0);
});

// --- usageByModel: 3 tests ---

test('splits usage by model string', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(usageByModel(rows), {
    'model-a': { messages: 1, inputTokens: 100, outputTokens: 50 },
    'model-b': { messages: 1, inputTokens: 0, outputTokens: 0 },
  });
});

test('single model yields one key', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(usageByModel([rows[0]]), {
    'model-a': { messages: 1, inputTokens: 100, outputTokens: 50 },
  });
});

test('empty rows yield an empty object', () => {
  assert.deepEqual(usageByModel([]), {});
});

// --- countToolUses: 2 tests ---

test('counts each tool name across rows', () => {
  const { rows } = readSessionUsage(threeMessageFixture());
  assert.deepEqual(countToolUses(rows), { Bash: 1, Agent: 1 });
});

test('empty rows yield empty counts', () => {
  assert.deepEqual(countToolUses([]), {});
});

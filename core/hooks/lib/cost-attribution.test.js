const test = require('node:test');
const assert = require('node:assert/strict');
const {
  attributeCosts,
  summarizeAttribution,
  NEAR_MISS_THRESHOLD,
} = require('./cost-attribution');

function rows() {
  return [
    { model: 'model-a', inputTokens: 3000, outputTokens: 800, cacheCreation: 100, cacheRead: 200, toolUses: ['Bash', 'Agent'] },
    { model: 'model-a', inputTokens: 104, outputTokens: 92, cacheCreation: 0, cacheRead: 0, toolUses: [] },
    { model: 'model-b', inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0, toolUses: ['Read'] },
  ];
}

function agentState(spawned) {
  return { totalSpawned: spawned, currentActive: 0, depthByAgentId: {}, pendingDepthStack: [] };
}

function caps(total) {
  return { depthCap: 3, concurrentCap: 8, totalPerTaskCap: total };
}

// --- proximity: 4 tests ---

test('8/10 spawns is a near miss at exactly the threshold', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(8), caps: caps(10), guardFirings: [] });
  assert.deepEqual(report.agentTeam, { spawned: 8, totalCap: 10, proximity: 0.8 });
  assert.equal(report.agentTeam.proximity >= NEAR_MISS_THRESHOLD, true);
});

test('10/10 spawns tripped the cap', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(10), caps: caps(10), guardFirings: [] });
  assert.equal(report.agentTeam.proximity, 1);
});

test('3/10 spawns is neither near miss nor tripped', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(3), caps: caps(10), guardFirings: [] });
  assert.equal(report.agentTeam.proximity, 0.3);
  assert.equal(report.agentTeam.proximity >= NEAR_MISS_THRESHOLD, false);
});

test('totalCap 0 yields proximity 0, no division crash', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(5), caps: caps(0), guardFirings: [] });
  assert.equal(report.agentTeam.proximity, 0);
});

// --- guard fold: 4 tests ---

test('empty firings fold to zero counts', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(0), caps: caps(10), guardFirings: [] });
  assert.deepEqual(report.guards, { firings: 0, byGuard: {} });
});

test('two provenance blocks and one haruspex warn fold by guard', () => {
  const report = attributeCosts({
    rows: rows(),
    agentState: agentState(0),
    caps: caps(10),
    guardFirings: [
      { guardName: 'provenance-guard', result: 'block' },
      { guardName: 'provenance-guard', result: 'block' },
      { guardName: 'haruspex-guard', result: 'warn' },
    ],
  });
  assert.deepEqual(report.guards, {
    firings: 3,
    byGuard: {
      'provenance-guard': { block: 2, warn: 0 },
      'haruspex-guard': { block: 0, warn: 1 },
    },
  });
});

test('totals and byModel pass through the reader verbatim', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(0), caps: caps(10), guardFirings: [] });
  assert.deepEqual(report.totals, {
    messages: 3,
    inputTokens: 3104,
    outputTokens: 892,
    cacheCreation: 100,
    cacheRead: 200,
  });
  assert.deepEqual(report.byModel, {
    'model-a': { messages: 2, inputTokens: 3104, outputTokens: 892 },
    'model-b': { messages: 1, inputTokens: 0, outputTokens: 0 },
  });
});

test('unknown result values count as neither block nor warn', () => {
  const report = attributeCosts({
    rows: [],
    agentState: agentState(0),
    caps: caps(10),
    guardFirings: [{ guardName: 'provenance-guard', result: 'weird' }],
  });
  assert.deepEqual(report.guards.byGuard['provenance-guard'], { block: 0, warn: 0 });
  assert.equal(report.guards.firings, 1);
});

// --- summary: 3 tests ---

test('summary paragraph exact match on a fixed fixture', () => {
  const report = attributeCosts({
    rows: rows(),
    agentState: agentState(8),
    caps: caps(10),
    guardFirings: [
      { guardName: 'provenance-guard', result: 'block' },
      { guardName: 'haruspex-guard', result: 'warn' },
    ],
  });
  assert.equal(
    summarizeAttribution(report),
    '3,104 input / 892 output tokens across 3 messages (2 models); ' +
      'agent team 8/10 spawns (80% of cap — near miss); ' +
      '2 guard firings (1 block, 1 warn)'
  );
});

test('summary without near miss omits the near-miss clause', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(3), caps: caps(10), guardFirings: [] });
  assert.equal(
    summarizeAttribution(report),
    '3,104 input / 892 output tokens across 3 messages (2 models); ' +
      'agent team 3/10 spawns (30% of cap); ' +
      '0 guard firings (0 block, 0 warn)'
  );
});

test('summary marks a tripped cap distinctly', () => {
  const report = attributeCosts({ rows: rows(), agentState: agentState(10), caps: caps(10), guardFirings: [] });
  assert.match(summarizeAttribution(report), /10\/10 spawns \(100% of cap — cap tripped\)/);
});

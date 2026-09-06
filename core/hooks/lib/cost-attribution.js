// Plan 13 (Cost Tracker/Failure Journal): pure attribution fold over
// reader rows + agent-team state + guard-firing entries. No I/O, no dollars
// (usage blocks carry no prices — token counts are the stable unit).
const { sumUsage, usageByModel } = require('./session-usage-reader');

// Single definition of the near-miss threshold — the cap-near-miss hook
// (Task 4) imports this, never duplicates the literal.
const NEAR_MISS_THRESHOLD = 0.8;

function agentTeamAttribution(agentState, caps) {
  const spawned = agentState.totalSpawned;
  const totalCap = caps.totalPerTaskCap;
  const proximity = totalCap > 0 ? spawned / totalCap : 0;
  return { spawned, totalCap, proximity };
}

function guardAttribution(guardFirings) {
  const byGuard = {};
  for (const f of guardFirings) {
    if (!byGuard[f.guardName]) {
      byGuard[f.guardName] = { block: 0, warn: 0 };
    }
    if (f.result === 'block') byGuard[f.guardName].block += 1;
    else if (f.result === 'warn') byGuard[f.guardName].warn += 1;
  }
  return { firings: guardFirings.length, byGuard };
}

function attributeCosts({ rows, agentState, caps, guardFirings }) {
  return {
    totals: sumUsage(rows),
    byModel: usageByModel(rows),
    agentTeam: agentTeamAttribution(agentState, caps),
    guards: guardAttribution(guardFirings),
  };
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function summarizeAttribution(report) {
  const t = report.totals;
  const modelCount = Object.keys(report.byModel).length;
  const modelWord = modelCount === 1 ? '1 model' : `${modelCount} models`;
  const head =
    `${formatNumber(t.inputTokens)} input / ${formatNumber(t.outputTokens)} output tokens ` +
    `across ${t.messages} messages (${modelWord})`;

  const a = report.agentTeam;
  const pct = Math.round(a.proximity * 100);
  let teamClause = `agent team ${a.spawned}/${a.totalCap} spawns (${pct}% of cap`;
  if (a.proximity >= 1) teamClause += ' — cap tripped';
  else if (a.proximity >= NEAR_MISS_THRESHOLD) teamClause += ' — near miss';
  teamClause += ')';

  const g = report.guards;
  const blocks = Object.values(g.byGuard).reduce((n, x) => n + x.block, 0);
  const warns = Object.values(g.byGuard).reduce((n, x) => n + x.warn, 0);
  const firingWord = g.firings === 1 ? '1 guard firing' : `${g.firings} guard firings`;
  const tail = `${firingWord} (${blocks} block, ${warns} warn)`;

  return `${head}; ${teamClause}; ${tail}`;
}

module.exports = { attributeCosts, summarizeAttribution, NEAR_MISS_THRESHOLD };

---
name: reading-cost-reports
description: Use this when interpreting `zenno cost report` output, when a cap-near-miss journal entry needs explaining, or when deciding whether Agent Team caps need adjusting. Covers what the report numbers mean and what to do about them.
---

# Reading Cost Reports

`zenno cost report` is a thin attribution layer over Claude Code's own session transcripts — token counts attributed to Zenno's constructs (Agent Team usage, cap proximity, Shield guard activity). Run it:

```
node <plugin-root>/core/hooks/lib/cost-report-cli.js [--session <id>] [--json]
```

It reads the repo's `*.jsonl` transcripts (most recent by default), the Agent Team state, and the audit journal — then appends a `cost-report` entry to the journal recording what it reported.

## What each section means

- **Totals are tokens, not dollars.** `3,104 input / 892 output tokens across 3 messages (2 models)` — no prices exist in the transcript data, and hardcoding a price table would rot. Dollars are `/cost`'s job; this report answers "where did the tokens go *in Zenno terms*."
- **Agent team proximity** — `8/10 spawns (80% of cap — near miss)`: how close the task came to the total-per-task cap. 100% means the cap tripped and blocked spawns (working as designed). 80%+ without tripping is the early warning: the task nearly exhausted its agent budget.
- **Guard activity** — firings folded by guard (`provenance-guard: 1 block`), mirrored from the same classification the telemetry bridge uses.

## What a near-miss means

A `cap-near-miss` journal entry (written automatically at session/subagent stop when proximity crossed 80%) means: this task nearly hit the agent cap. Two legitimate responses, both deliberate human choices:

1. **Tighten the task** — the work genuinely needed fewer agents; restructure the request (smaller scope, fewer parallel lines of inquiry).
2. **Raise the cap deliberately via config** — the work legitimately needs more agents; edit `agentTeam.totalPerTaskCap` in `zenno/config.json` yourself.

## `guard-warning` vs telemetry guard events

Same firings, two consumers: `guard-warning` journal entries are the **audit trail** (append-only, in `zenno/audit/journal.jsonl` alongside everything else); telemetry guard events are the **observability trail** (spans for export). If they ever disagree on counts, the journal is authoritative — the telemetry bridge only syncs entries it classifies as firings.

## Never auto-tune caps from a report

A report never changes configuration itself, and neither should you on its behalf mid-conversation without the user explicitly asking. Same deliberate-human-choice rule as every other Zenno override: a security-relevant change to Zenno's own protections must be a conscious decision, never something negotiated or applied automatically.

---
name: bounded-research
description: Use this for research-heavy tasks that would otherwise tempt an uncapped fan-out (e.g. Claude Code's native Dynamic Workflow, which can spawn dozens of agents across sequential waves). Dispatches exactly 3 parallel explorer agents on distinct sub-angles plus 1 synthesis agent, via native Agent Teams. Never spawns more, never adds a second synthesis wave. This is the direct, fixed-size replacement for open-ended research fan-out.
---

# Bounded Research

A fixed-size, 4-agent research pattern: 3 explorers + 1 synthesizer. Exists specifically to prevent the failure mode where research tasks spiral into dozens of agents across multiple waves (a real observed case: 25 research agents → 50 synthesis agents → 15 gather agents = 90 agents for one request).

## When to use this

- A task genuinely needs research from multiple independent angles before an answer can be given (e.g. "compare these 3 approaches," "investigate why X might be happening from multiple possible causes").
- You'd otherwise be tempted to let the model decide "how many angles this needs" at runtime.

## When NOT to use this

- Single-angle research a single agent (or no subagent at all) can handle directly — don't reach for 4 agents when 1 will do.
- Anything that isn't actually research — this isn't a general-purpose parallelization pattern for arbitrary work.

## Steps

1. Confirm native Agent Teams is available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set, session restarted if it was just enabled).
2. Identify exactly 3 distinct, non-overlapping sub-angles of the research question. If you can't cleanly identify 3 (e.g. the question only really has 1 or 2 genuine angles), use fewer explorers rather than padding to 3 for its own sake — but never exceed 3.
3. Dispatch exactly 3 named explorer agents via the Agent tool, one per sub-angle, running in parallel.
4. Once all 3 report back, dispatch exactly 1 synthesis agent that consolidates their findings into a single coherent answer.
5. **No recursive fan-out.** The synthesis agent does not itself dispatch further explorers, and explorers do not dispatch sub-explorers. If an explorer's findings suggest a genuinely new angle worth investigating, that's a signal to run Bounded Research again as a fresh, separate pass — not to let this one grow past 4 agents.

## Note on enforcement

This directly targets the exact failure mode Zenno's Agent Team hard caps also guard against (see the design spec's "25+50+15=90 agents" reference case) — this skill prevents it by construction (fixed team size), while the hard-cap hooks catch it as a backstop if something still tries to exceed reasonable bounds.

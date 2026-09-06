---
name: plan-stress-test
description: Use this as an optional escalation step after superpowers:writing-plans produces a plan, before any implementation begins, for plans with real security/scope/architecture stakes (not trivial or purely mechanical changes). Dispatches exactly 4 fixed-role reviewer agents via native Agent Teams to critique the plan from four distinct angles in parallel. Never spawns more or fewer than 4 — the fixed size is deliberate, not a suggestion the model can expand.
---

# Plan Stress-Test

A fixed-size, 4-agent review pass on a plan document before implementation starts. This is the Zenno equivalent of a hyperplan-style stress test — never a runtime-decided team size, always exactly these four roles.

## When to use this

- After a plan has been written (via superpowers:writing-plans), before any task in it is executed.
- When the plan touches security-sensitive code, has real scope-creep risk, or changes architecture/conventions other code depends on.

## When NOT to use this

- Trivial, mechanical, or purely additive plans (e.g. adding a single well-scoped utility function) — the overhead of 4 parallel reviewers isn't worth it for low-stakes changes.
- Mid-implementation. This is a pre-implementation gate, not a code review of work already done — that's `superpowers:requesting-code-review`'s job.

## Steps

1. Confirm native Agent Teams is available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set, session restarted if it was just enabled).
2. Dispatch exactly 4 named agents via the Agent tool, one per role below. Do not add a 5th, do not merge two roles into one agent, do not skip a role because it "doesn't seem relevant this time" — the fixed composition is the point; a role that finds nothing to flag still confirms the plan is clean from that angle.
   - **security-reviewer** — attack surface, injection points, trust boundaries, anything an adversarial input could exploit.
   - **scope-reviewer** — YAGNI/scope-creep: does the plan build only what's needed, or does it speculatively add capability nobody asked for?
   - **test-coverage-reviewer** — edge cases, boundary values, error paths the plan's own tests don't cover.
   - **architecture-reviewer** — consistency with existing patterns/conventions in the codebase; does this plan quietly diverge from how similar things are already done?
3. Each reviewer reports back a short, structured verdict: pass, or specific concerns with the exact task/line in the plan they apply to.
4. Do not begin implementing any task in the plan until all 4 have reported. If any reviewer raises a concern, resolve it in the plan document itself before execution starts — don't patch it in during implementation.

## Note on enforcement

Zenno's own Agent Team hard caps (depth/concurrent/total-per-task) apply regardless of this skill — dispatching these 4 reviewers counts toward the total-per-task cap like any other agent spawn. This skill's fixed size (4) is well within all three caps by design.

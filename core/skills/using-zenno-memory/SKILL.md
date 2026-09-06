---
name: using-zenno-memory
description: Use this whenever you learn something durable about a project (an architectural fact, a convention, a decision) or want to leave a note for a future session. Zenno's memory system automatically loads known facts and recent session notes at the start of every session — this skill covers how to WRITE to it, since that side requires an explicit call.
---

# Using Zenno Memory

Zenno maintains project memory in Claude Code's own per-project memory location, split into layers: episodic (short-term session notes), semantic (long-term project facts), working (active scratch state), and snapshots (git-versioned rollback points for semantic memory).

## Reading memory — automatic, no action needed

At the start of every session, a `SessionStart` hook automatically loads known semantic facts and recent episodic notes into context. You don't need to do anything to read this — if relevant memory exists, it's already there.

## Writing memory — requires an explicit call

Unlike reading, writing is not automatic — a bare session-end hook has no way to know what's worth remembering, since that's a judgment call only you can make. Two write paths:

1. **Episodic (short-term session note):**
   ```
   echo '{"cwd":"<project-root>","session_id":"<current-session-id>"}' | node <plugin-root>/core/hooks/lib/memory-remember-cli.js --episodic "text to remember"
   ```
   Use this for anything worth noting for a future session, but not yet confirmed durable — a decision made this session, a pattern observed, something you'd want a future session to know if it comes up again.

2. **Semantic (long-term project fact) — use sparingly:**
   ```
   echo '{"cwd":"<project-root>"}' | node <plugin-root>/core/hooks/lib/memory-remember-cli.js --semantic "text to remember"
   ```
   Use this only for facts you're confident are durable and project-wide (e.g. "the API layer uses REST, not GraphQL"). This is the **explicit flagging** promotion mechanism — the other mechanism, cross-session corroboration, happens automatically when the same episodic note appears independently across 2+ sessions.

## Doctor checks the memory repo too

`zenno doctor` (see the running-zenno-doctor skill) verifies the snapshots dir and its private git repo exist and are readable. If it reports the snapshots dir without a git repo ("history lost"), do not re-init blindly — the history is unrecoverable and a fresh init would silently pretend otherwise.

## Important: corroboration is near-verbatim only, not semantic

Cross-session promotion uses deterministic keyword-overlap matching, not real language understanding — it reliably catches the same fact restated in similar words across sessions, but will **not** recognize a genuine paraphrase that shares few literal words. If you want something to promote reliably regardless of how it's worded next time, use explicit `--semantic` flagging rather than relying on corroboration.

## When NOT to use this

- Trivial, session-specific details that have no value beyond the current task (e.g. "ran the tests, they passed") — not everything needs to be remembered.
- Anything already covered by `zenno/config.json` or other project configuration — memory is for facts *about* the project, not settings that control Zenno's own behavior.

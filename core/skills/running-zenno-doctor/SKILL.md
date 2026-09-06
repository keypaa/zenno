---
name: running-zenno-doctor
description: Use this when Zenno reports a problem at session start, when `zenno doctor` output needs interpreting, or when verifying a Zenno installation is healthy. Runs read-only health checks over the Shield guards, Agent Team caps, memory repo, and tool dependencies.
---

# Running Zenno Doctor

`zenno doctor` is a pure observer: read-only by default, never auto-fixes — the same report-and-flag principle as Config Import and memory rollback. Run it:

```
node <plugin-root>/core/hooks/lib/doctor-cli.js
```

from the repo root (`CLAUDE_PLUGIN_ROOT` env or cwd resolution handles paths).

## The two levels

**SessionStart nudge** (automatic): runs only the three *cheap* groups — install health, hook-file registration, external tools. No hook-sanity subprocesses (a full doctor costs ~30 node spawns — too hot for every session start). Silent when everything is OK; prints only WARN/FAIL lines plus `run zenno doctor for details`.

**Full doctor** (on demand, what this skill covers): all five check groups — the three cheap ones plus deterministic hook sanity (each Shield guard + Agent Team cap run against a benign and a should-block payload in a throwaway sandbox repo) and broken config references.

## Output format

One line per check: `[OK  ] name — detail` / `[WARN] name — detail` / `[FAIL] name — detail`, with an indented `fix:` command under anything not OK. Trailing summary (`doctor: 31 checks — 27 OK, 4 WARN, 0 FAIL`), exit 0 iff everything is OK.

## What each fix means

- **bootstrap marker WARN** — `zenno/.initialized` missing: bootstrap hasn't completed for this repo. It re-runs automatically next session; nothing to do unless it persists.
- **config.json FAIL** — schema violation with the offending fields named: fix the file, validate + apply via `config-import-cli.js <fixed-file> --confirm` (the Plan 11 flagged-changes path).
- **memory repo FAIL (history lost)** — snapshots dir exists but its private git repo is gone: do NOT re-init blindly; the history is unrecoverable and re-init would silently start a fresh one. See the using-zenno-memory skill.
- **hook-sanity FAIL** — serious: a guard silently stopped guarding (passes what it must block, or blocks benign input). Treat as a Zenno bug, not a config problem — check for manual edits to the hook file or its dependencies.
- **external tool FAIL** — install ripgrep / universal-ctags with the named package command.

## Never auto-fix from a nudge

Every fix is a user-invoked command. The nudge prints findings, never applies anything — same rule as every Shield guard's override mechanism: a security-relevant change to Zenno's own protections must be a deliberate human choice.

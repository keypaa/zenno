---
name: using-trace-export
description: Use this when the user asks to export session history for fine-tuning, training data, or dataset creation. Wraps Claude Code's own session transcript files (~/.claude/projects/<project>/*.jsonl) with a mandatory secret-redaction pass before anything is written to disk. On-demand only — never runs automatically.
---

# Using Trace Export

Exports this project's Claude Code session transcripts into `zenno/traces/`, for building a fine-tuning or training dataset from real session history.

## Steps

1. Run the export CLI:
   ```
   node <plugin-root>/core/hooks/lib/export-traces-cli.js --mode=raw
   ```
   Omit `--mode=raw` to use whatever `traces.defaultMode` is set to in `zenno/config.json` (raw by default).

2. Every session transcript passes through a **mandatory** secret-redaction pass before being written — both high-confidence pattern matches (API keys, private key blocks) and medium-confidence high-entropy values are replaced with `[ZENNO-REDACTED-SECRET]`. This cannot be skipped or disabled; it isn't optional the way a Shield guard's allowlist override is.

3. Exported files land in `zenno/traces/raw/`, one file per session, with the original filename preserved.

## Curated mode is not yet available

`--mode=curated` (segmenting exports at Zenno's own task boundaries rather than raw full-session dumps) is explicitly not implemented yet — it depends on task-tracking mechanics that don't exist in Zenno as of this skill. Attempting `--mode=curated` fails with a clear message rather than silently falling back to something else. Use raw mode.

## When NOT to use this

- Routine session work with no intent to build a training dataset — this isn't something to run automatically or "just in case."
- If the user wants curated, task-segmented exports specifically — that mode isn't built yet; explain this rather than attempting a workaround.

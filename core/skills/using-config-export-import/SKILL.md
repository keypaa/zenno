---
name: using-config-export-import
description: Use this when the user wants to back up, share, or restore Zenno's zenno/config.json — exporting a copy, or importing a config from another project/backup. Import always validates schema, diffs against the current config, and flags any security-relevant weakening before applying — never a silent overwrite.
---

# Using Config Export/Import

## Export

```
node <plugin-root>/core/hooks/lib/config-export.js <destination-path>
```

Reads and copies `zenno/config.json` as-is. No validation needed — you already trust your own current config.

## Import

```
node <plugin-root>/core/hooks/lib/config-import-cli.js <source-path>
```

This always runs three checks, in order, before touching anything:

1. **Schema validation** — rejects the source file outright if it's missing required top-level keys or has obviously wrong types.
2. **Diff against the current config** — every meaningful field is compared.
3. **Security-relevant change classification** — a change that *weakens* protection (removing a deny pattern, disabling `blockGlobalInstalls`, raising an Agent Team cap, adding to the Secret Scanner allowlist, or enabling telemetry content recording) is flagged and **not applied** until you re-run with `--confirm`.

If there are no security-relevant changes, the import applies immediately. If there are, the CLI prints exactly what would change and exits without writing anything — re-run with `--confirm` once you've reviewed it:

```
node <plugin-root>/core/hooks/lib/config-import-cli.js <source-path> --confirm
```

## Important: this is a deliberate, user-invoked action, not something to automate

Never run config import as part of a larger automated task without the user explicitly asking for it, and never add `--confirm` to a command on the user's behalf without them having seen the flagged changes first. This mirrors the same principle behind every Shield guard's override mechanism in this project: a security-relevant change to Zenno's own protections must be a deliberate human choice, never something negotiated or applied mid-conversation.

## When NOT to use this

- Making a small, targeted tweak to one config field — just edit `zenno/config.json` directly; import is for wholesale replacement from an external source (a backup, another project, a shared team config).

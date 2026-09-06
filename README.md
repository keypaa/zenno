# Zenno

Security guards, disciplined multi-agent orchestration, and persistent memory for Claude Code.

Zenno is a Claude Code plugin that watches what agents do and keeps them honest: four Shield guards block secret leaks, confidential-file reads, risky installs, and self-modification of Zenno itself; hard caps stop runaway subagent fan-out; a memory layer carries project knowledge across sessions; and a doctor, cost tracker, and trace exporter keep the whole thing observable.

- **432 tests, all passing** (`npm test` — pure Node.js, zero dependencies)
- MIT licensed, by Keylhan Paumard--André

## What it does

### Shield guards (PreToolUse hooks)

| Guard | Blocks |
|---|---|
| Secret Scanner | Commits/pushes containing high-confidence secrets (AWS keys, GitHub PATs, private key blocks, Slack/Stripe tokens) plus high-entropy strings |
| Confidential File Guard | Reads of sensitive files (`.env`, `*.pem`, … — configurable deny/allow patterns) |
| Provenance Guard | Global installs, typosquat packages, and very-recently-published packages |
| Haruspex Guard | Any write to Zenno's own files (guard logic, `hooks.json`, `config.json`) unless explicitly overridden |

Guards fail safe (deny on uncertainty where it matters), never auto-fix, and every override is a deliberate human action — never something negotiated mid-conversation.

### Agent Team caps

Hard caps on subagent spawning (default: depth 3, concurrent 8, 10 per task) plus two fixed-size team templates (`plan-stress-test`, `bounded-research`) as a disciplined alternative to open-ended fan-out.

### Memory, telemetry, and the rest

- **Memory layer** — episodic/semantic/working memory with git-versioned snapshots and rollback
- **Repo graph** — ctags-based symbol index with staleness nudges
- **Telemetry & trace export** — OTLP-style spans, raw session export with mandatory secret redaction
- **Config export/import** — schema-validated, diffed, security-relevant changes need `--confirm`
- **`zenno doctor`** — 30+ health checks including live sanity runs of every guard
- **Cost tracker / failure journal** — token attribution per session, cap near-miss warnings, one unified append-only audit journal

## Requirements

- **Node.js 20+** (hooks are plain Node scripts, tests use the built-in `node:test` runner; developed and tested with Node v24)
- **ripgrep** (`rg`) — secret scanning
- **universal-ctags** (`ctags`) — repo graph
- **git** — memory snapshots, journal checkpointing

```bash
# Arch
sudo pacman -S ripgrep universal-ctags git
# Debian/Ubuntu
sudo apt install ripgrep universal-ctags git
```

## Installation

Add the marketplace, then install the plugin (user scope by default):

```
/plugin marketplace add keypaa/zenno
/plugin install zenno@zenno-marketplace
```

If it reports `Run /reload-plugins to activate`, run `/reload-plugins`. Verify under `/plugin` — zenno should be listed with no errors.

On the next session start in any repo, bootstrap runs automatically (creates `zenno/.initialized` + `zenno/config.json` plus memory scaffolding). To contain the blast radius while evaluating, install with **project scope** instead of user scope.

## Updating

Refresh the marketplace catalog, then reload:

```
/plugin marketplace update zenno-marketplace
/reload-plugins
```

Third-party marketplaces have background auto-update **off** by default; you can enable it per marketplace under `/plugin` → **Marketplaces**. Either way, the running session keeps its loaded versions until you reload or restart.

## Removing

Uninstall the plugin (keeps the marketplace catalog):

```
/plugin uninstall zenno@zenno-marketplace
```

To also drop the catalog (this removes anything installed from it):

```
/plugin marketplace remove zenno-marketplace
```

Uninstalling leaves your repos' `zenno/` directories and `~/.claude/projects/` memory data in place — delete those manually if you want a full purge.

## Usage

Skills are namespaced as `/zenno:<name>`:

| Skill | When to use it |
|---|---|
| `using-zenno-memory` | Reading/writing project memory across sessions |
| `running-zenno-doctor` | Interpreting `zenno doctor` output |
| `reading-cost-reports` | Interpreting cost reports and cap near-misses |
| `using-the-repo-graph` | Querying the ctags symbol index |
| `using-trace-export` | Exporting session history for fine-tuning datasets |
| `using-config-export-import` | Backing up / restoring `zenno/config.json` |
| `bounded-research` | Fixed-size research team template |
| `plan-stress-test` | Fixed-size adversarial-plan-review team template |

Key commands (run from the repo root):

```bash
node <plugin-root>/core/hooks/lib/doctor-cli.js            # health check
node <plugin-root>/core/hooks/lib/cost-report-cli.js        # token attribution report
node <plugin-root>/core/hooks/lib/cost-report-cli.js --json
node <plugin-root>/core/hooks/lib/config-import-cli.js <file> [--confirm]
```

## Adding features

Zenno follows a few hard conventions — please keep them:

1. **TDD, no exceptions.** Every `lib/*.js` module has a co-located `*.test.js`. Write the test, watch it fail (`Cannot find module` / assertion), implement minimally, watch it pass.
2. **Zero new dependencies.** Pure Node.js stdlib only. If you think you need a package, you probably need a smaller design.
3. **Pure logic, impure shell.** Decision functions take injected state and do no I/O (so they're unit-testable); hook entrypoints own stdin/stdout/exit codes/filesystem.
4. **Wire up in `core/hooks/hooks.json`.** New hooks get an entry; keep every existing entry byte-identical. Verify with `node -e "JSON.parse(require('fs').readFileSync('core/hooks/hooks.json','utf8'))"`.
5. **Report, never silently self-modify.** Security-relevant behavior needs an explicit human confirmation path (env flag, `--confirm`, config edit) — never an automatic one.
6. **Run the full suite and the doctor** before opening a PR: `npm test` (432 tests) and `node core/hooks/lib/doctor-cli.js` must both be clean.

```
core/
  hooks/
    hooks.json          # hook registry (SessionStart, PreToolUse, …)
    bootstrap-cli.js    # first-run setup
    *.js                # hook entrypoints (stdin JSON → exit code)
    lib/                # pure modules + co-located *.test.js
    lib/test-support/   # shared test helpers (e.g. run-hook.js)
  skills/
    <name>/SKILL.md     # one dir per skill
```

## License

MIT — see `LICENSE` (or the `license` field in `.claude-plugin/plugin.json`).

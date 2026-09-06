{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/core/hooks/bootstrap-cli.js\""
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/core/hooks/lib/graph-staleness-nudge-cli.js\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 6: Validate the updated hooks.json parses correctly**

Run: `node -e "JSON.parse(require('fs').readFileSync('core/hooks/hooks.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 7: Commit**

```bash
git add core/hooks/lib/graph-staleness-nudge-cli.js core/hooks/lib/graph-staleness-nudge-cli.test.js core/hooks/hooks.json
git commit -m "feat: non-blocking SessionStart staleness nudge for repo graph"
```

---

### Task 7: Orientation Skill

**Files:**
- Create: `core/skills/using-the-repo-graph/SKILL.md`

**Interfaces:**
- Consumes: nothing programmatically — this is prose content read by Claude, not code. References `zenno/graph/tags` (Task 2's output path) and `generate-graph-cli.js` (Task 5's entrypoint) by name.

This task has no test cycle — skill content isn't unit-testable the way code is. Verification is manual review against Superpowers' own skill-writing conventions (imperative, second person, clear "when to use" / "when not to use" boundaries).

- [ ] **Step 1: Write the skill**

```markdown
---
name: using-the-repo-graph
description: Use this at the start of any task in an existing codebase, before exploring the repo manually. Checks for a pre-generated, deterministic symbol index at zenno/graph/tags and reads it to get oriented instantly, instead of spending tool calls re-discovering file/symbol structure. Especially valuable when dispatched as a subagent, since the cost of re-exploration multiplies by however many agents are spawned in a session.
---

# Using the Repo Graph

Before exploring an unfamiliar codebase with `Glob`, `Grep`, or repeated `Read` calls to map out structure, check whether a pre-generated symbol index already exists.

## Steps

1. Check whether `zenno/graph/tags` exists in the current repo.
   - If it doesn't exist: this repo either hasn't been graphed yet, or was too small to be worth graphing when Zenno last checked. Proceed with normal exploration — do not block on this.
   - If it exists: continue to step 2.

2. Read `zenno/graph/tags`. It's a flat, plain-text symbol index — one line per symbol, in the format `<symbol-name>\t<file-path>\t<pattern-or-line>;"\t<kind>`. This tells you every function, class, enum, and other named symbol in the codebase, and exactly where each one is defined, without reading a single source file yet.

3. Use it to jump directly to relevant code instead of searching for it:
   - Looking for where something is defined? Search the tags file for the symbol name first — it's a single grep-able file, faster than searching the whole repo.
   - Getting oriented in a new area of the codebase? Skim the tags file entries for the relevant directory to see what's already there before writing anything new.

4. **Known limitation, state it plainly if it matters to the task:** this is a symbol index (name → file:line), not a full dependency or call graph. It tells you *where* something is defined, not *what calls it* or *what it depends on*. For call-graph-level questions, you still need to read the actual code — the tags file only shortens the search, it doesn't replace reading code that matters to the task.

5. If `zenno/graph/tags` looks stale relative to the current code (e.g. a symbol you expect isn't listed, or file paths look wrong), don't silently trust it — fall back to direct exploration for that specific question, and mention that the graph may need regenerating.

## When NOT to use this

- Brand-new or near-empty projects — there's nothing meaningful to graph, and `zenno/graph/tags` won't exist.
- Questions about runtime behavior, call relationships, or data flow — the graph only answers "where is X defined," not "what happens when X runs."

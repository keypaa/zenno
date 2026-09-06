// Plan 13 (Cost Tracker/Failure Journal): pure reader for Claude Code
// session JSONL files (~/.claude/projects/<project>/*.jsonl). Every row is
// defensive: blank/unparseable/non-assistant lines are counted as skipped,
// missing usage keys default to 0. Verified live against a real 1,699-line
// transcript: assistant messages carry message: { model, content[], usage }
// with usage keys input_tokens/output_tokens/cache_creation_input_tokens/
// cache_read_input_tokens, and tool calls are content[] blocks
// {type:"tool_use", name, id, input}. No prices anywhere — token counts are
// the stable unit, dollars are the reporter's job.
const fs = require('node:fs');

function rowFromMessage(message) {
  const usage = message.usage || {};
  const content = Array.isArray(message.content) ? message.content : [];
  const toolUses = content
    .filter((b) => b && b.type === 'tool_use')
    .map((b) => b.name);
  return {
    model: message.model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreation: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    toolUses,
  };
}

function readSessionUsage(jsonlPath) {
  const rows = [];
  let skipped = 0;
  const text = fs.readFileSync(jsonlPath, 'utf8');
  // A file ending in "\n" splits into a phantom empty element — not a real
  // line, so it must not count as skipped (verified: fixture files written
  // with a trailing newline reported skipped: 4 instead of 3).
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
    lines.pop();
  }
  for (const line of lines) {
    if (line.trim().length === 0) {
      skipped += 1;
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (parsed.type !== 'assistant' || !parsed.message || typeof parsed.message !== 'object') {
      skipped += 1;
      continue;
    }
    rows.push(rowFromMessage(parsed.message));
  }
  return { rows, skipped };
}

function sumUsage(rows) {
  const totals = { messages: rows.length, inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };
  for (const r of rows) {
    totals.inputTokens += r.inputTokens;
    totals.outputTokens += r.outputTokens;
    totals.cacheCreation += r.cacheCreation;
    totals.cacheRead += r.cacheRead;
  }
  return totals;
}

function usageByModel(rows) {
  const byModel = {};
  for (const r of rows) {
    if (!byModel[r.model]) {
      byModel[r.model] = { messages: 0, inputTokens: 0, outputTokens: 0 };
    }
    byModel[r.model].messages += 1;
    byModel[r.model].inputTokens += r.inputTokens;
    byModel[r.model].outputTokens += r.outputTokens;
  }
  return byModel;
}

function countToolUses(rows) {
  const counts = {};
  for (const r of rows) {
    for (const name of r.toolUses) {
      counts[name] = (counts[name] || 0) + 1;
    }
  }
  return counts;
}

module.exports = { readSessionUsage, sumUsage, usageByModel, countToolUses };

const fs = require('node:fs');
const path = require('node:path');

// Session transcript files live directly in the project's own Claude Code
// directory, as *.jsonl files — siblings of the memory/ subfolder Zenno's
// own Memory Layer (Plan #8) uses. This lists them, filtered to plain
// top-level .jsonl files only, so Zenno's own memory/ subdirectory (or
// anything else nested) is never mistaken for a session transcript.
function listSessionFiles(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return [];
  return fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => path.join(sessionsDir, entry.name))
    .sort();
}

module.exports = { listSessionFiles };

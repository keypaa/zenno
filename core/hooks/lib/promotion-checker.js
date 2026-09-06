const { significantWords } = require('./semantic-memory');

// Known, disclosed limitation: this is pure keyword-overlap matching, not
// semantic understanding. It reliably catches near-verbatim restatements
// of the same fact across sessions (the realistic case when an agent
// re-describes the same code/architecture it's looking at again), but
// will NOT recognize a genuine paraphrase that shares few literal words
// (e.g. "the repo uses PostgreSQL" vs "storage is handled via Postgres").
// True paraphrase detection needs semantic judgment, which the design
// spec deliberately keeps out of this deterministic mechanism — that's
// explicitly deferred to the LLM-assisted promotion tier (Section 8),
// gated on this simple mechanism proving insufficient in practice.
function findCorroboration(episodicEntries, candidateText, minSessions = 2) {
  const candidateWords = significantWords(candidateText);
  if (candidateWords.size === 0) return { corroborated: false, sessionIds: [] };
  const matchingSessions = new Set();
  for (const entry of episodicEntries) {
    if (!entry.sessionId || !entry.text) continue;
    const entryWords = significantWords(entry.text);
    if (entryWords.size === 0) continue;
    const overlap = [...candidateWords].filter((w) => entryWords.has(w)).length;
    const ratio = overlap / Math.min(candidateWords.size, entryWords.size);
    if (ratio >= 0.5) matchingSessions.add(entry.sessionId);
  }
  return { corroborated: matchingSessions.size >= minSessions, sessionIds: [...matchingSessions] };
}
module.exports = { findCorroboration };

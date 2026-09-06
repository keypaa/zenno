const fs = require('node:fs');
const path = require('node:path');
const { semanticDir, ensureMemoryDirs } = require('./memory-paths');
function semanticFactsPath(memoryDir) { return path.join(semanticDir(memoryDir), 'facts.jsonl'); }
function readSemanticFacts(memoryDir) {
  const p = semanticFactsPath(memoryDir);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function appendSemanticFact(memoryDir, fact) {
  ensureMemoryDirs(memoryDir);
  const entry = { text: fact.text, source: fact.source || 'unknown', sessionIds: fact.sessionIds || [], createdAt: new Date().toISOString() };
  fs.appendFileSync(semanticFactsPath(memoryDir), JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}
function significantWords(text) { return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length >= 4)); }
function findContradictionCandidates(existingFacts, newText) {
  const newWords = significantWords(newText);
  if (newWords.size === 0) return [];
  const candidates = [];
  for (const fact of existingFacts) {
    const existingWords = significantWords(fact.text);
    if (existingWords.size === 0) continue;
    const overlap = [...newWords].filter((w) => existingWords.has(w)).length;
    const ratio = overlap / Math.min(newWords.size, existingWords.size);
    if (ratio >= 0.5) candidates.push(fact);
  }
  return candidates;
}
module.exports = { readSemanticFacts, appendSemanticFact, findContradictionCandidates, semanticFactsPath, significantWords };

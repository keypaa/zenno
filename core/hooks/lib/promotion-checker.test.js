const test = require('node:test');
const assert = require('node:assert/strict');
const { findCorroboration } = require('./promotion-checker');

test('reports corroborated when 2+ distinct sessions mention a near-verbatim claim', () => {
  // Realistic scope for a keyword-overlap heuristic: near-verbatim
  // restatements, not creative paraphrases (see the disclosed limitation
  // documented in promotion-checker.js).
  const episodic = [
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's2', text: 'confirmed the repo uses PostgreSQL as its database' },
  ];
  const result = findCorroboration(episodic, 'the repo uses PostgreSQL as its database');
  assert.equal(result.corroborated, true);
  assert.equal(result.sessionIds.length, 2);
});

test('does not report corroborated from a single session alone', () => {
  const episodic = [
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database, again' },
  ];
  const result = findCorroboration(episodic, 'the repo uses PostgreSQL as its database');
  assert.equal(result.corroborated, false);
});

test('does not corroborate unrelated entries', () => {
  const episodic = [
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's2', text: 'the CI pipeline runs on GitHub Actions' },
  ];
  const result = findCorroboration(episodic, 'the repo uses PostgreSQL as its database');
  assert.equal(result.corroborated, false);
});

test('a genuine paraphrase with low keyword overlap is NOT corroborated — documents the disclosed limitation directly', () => {
  const episodic = [
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's2', text: 'this project relies on PostgreSQL for storage' },
  ];
  const result = findCorroboration(episodic, 'the repo uses PostgreSQL as its database');
  assert.equal(result.corroborated, false); // s2 shares too few literal words to match
});

test('respects a custom minSessions threshold', () => {
  const episodic = [
    { sessionId: 's1', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's2', text: 'the repo uses PostgreSQL as its database' },
    { sessionId: 's3', text: 'the repo uses PostgreSQL as its database' },
  ];
  const result = findCorroboration(episodic, 'the repo uses PostgreSQL as its database', 3);
  assert.equal(result.corroborated, true);
});

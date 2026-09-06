const test = require('node:test');
const assert = require('node:assert/strict');
const { detectTyposquat, levenshteinDistance } = require('./detect-typosquat');

test('levenshteinDistance is 0 for identical strings', () => {
  assert.equal(levenshteinDistance('express', 'express'), 0);
});

test('levenshteinDistance counts a single substitution', () => {
  assert.equal(levenshteinDistance('expres5', 'express'), 1);
});

test('flags a single-character-off typosquat of a known npm package', () => {
  const result = detectTyposquat('expres', 'npm'); // missing a character from "express"
  assert.equal(result.isTyposquat, true);
  assert.equal(result.suspectedRealPackage, 'express');
});

test('does not flag the exact real package name as a typosquat of itself', () => {
  const result = detectTyposquat('express', 'npm');
  assert.equal(result.isTyposquat, false);
});

test('does not flag a genuinely unrelated package name', () => {
  const result = detectTyposquat('my-totally-unrelated-package', 'npm');
  assert.equal(result.isTyposquat, false);
});

test('checks against the correct ecosystem list', () => {
  // "reqeusts" is a near-miss of pip's "requests", not any npm package
  const pipResult = detectTyposquat('reqeusts', 'pip');
  assert.equal(pipResult.isTyposquat, true);
  assert.equal(pipResult.suspectedRealPackage, 'requests');

  const npmResult = detectTyposquat('reqeusts', 'npm');
  assert.equal(npmResult.isTyposquat, false);
});

test('flags a typosquat of a cargo crate', () => {
  const result = detectTyposquat('serdee', 'cargo');
  assert.equal(result.isTyposquat, true);
  assert.equal(result.suspectedRealPackage, 'serde');
});

test('protects a short (3-char) known package name', () => {
  const result = detectTyposquat('logg', 'cargo');
  assert.equal(result.isTyposquat, true);
  assert.equal(result.suspectedRealPackage, 'log');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExecuteToolSpan, buildInvokeAgentSpan, buildGuardEvent } = require('./span-builder');

test('buildExecuteToolSpan includes core gen_ai attributes', () => {
  const span = buildExecuteToolSpan({
    traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), toolName: 'Bash',
    startTime: 1000, endTime: 1005, recordContent: false,
  });
  assert.equal(span.name, 'execute_tool');
  assert.equal(span.attributes['gen_ai.tool.name'], 'Bash');
  assert.equal(span.events.length, 0);
});

test('buildExecuteToolSpan omits tool input content when recordContent is false', () => {
  const span = buildExecuteToolSpan({
    traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), toolName: 'Bash',
    startTime: 1000, endTime: 1005, recordContent: false, toolInput: { command: 'rm -rf /' },
  });
  assert.equal(span.events.length, 0);
});

test('buildExecuteToolSpan includes tool input content only when recordContent is true', () => {
  const span = buildExecuteToolSpan({
    traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), toolName: 'Bash',
    startTime: 1000, endTime: 1005, recordContent: true, toolInput: { command: 'echo hi' },
  });
  assert.equal(span.events.length, 1);
  assert.match(span.events[0].attributes.content, /echo hi/);
});

test('buildInvokeAgentSpan includes depth as a zenno-specific attribute', () => {
  const span = buildInvokeAgentSpan({
    traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), agentType: 'security-reviewer', depth: 2, startTime: 1000,
  });
  assert.equal(span.name, 'invoke_agent');
  assert.equal(span.attributes['zenno.agent.depth'], 2);
  assert.equal(span.attributes['gen_ai.agent.name'], 'security-reviewer');
});

test('buildGuardEvent captures guard name, result, and reason', () => {
  const event = buildGuardEvent({
    traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), guardName: 'secret-scanner', result: 'block', reason: 'aws-access-key-id',
  });
  assert.equal(event.attributes['zenno.shield.guard'], 'secret-scanner');
  assert.equal(event.attributes['zenno.shield.result'], 'block');
  assert.equal(event.attributes['zenno.shield.reason'], 'aws-access-key-id');
});

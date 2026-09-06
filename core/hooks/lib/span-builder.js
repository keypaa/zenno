function buildExecuteToolSpan({ traceId, spanId, toolName, startTime, endTime, recordContent, toolInput }) {
  const attributes = {
    'gen_ai.operation.name': 'execute_tool',
    'gen_ai.tool.name': toolName,
  };
  const span = {
    traceId,
    spanId,
    name: 'execute_tool',
    startTimeUnixNano: String(startTime * 1e6),
    endTimeUnixNano: String(endTime * 1e6),
    attributes,
    events: [],
  };
  if (recordContent && toolInput !== undefined) {
    span.events.push({
      name: 'gen_ai.tool.input',
      timeUnixNano: String(startTime * 1e6),
      attributes: { content: JSON.stringify(toolInput) },
    });
  }
  return span;
}

function buildInvokeAgentSpan({ traceId, spanId, parentSpanId, agentType, depth, startTime }) {
  return {
    traceId,
    spanId,
    parentSpanId: parentSpanId || undefined,
    name: 'invoke_agent',
    startTimeUnixNano: String(startTime * 1e6),
    attributes: {
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.agent.name': agentType || 'unknown',
      'zenno.agent.depth': depth,
    },
    events: [],
  };
}

function buildGuardEvent({ traceId, spanId, guardName, result, reason, time }) {
  return {
    traceId,
    spanId,
    name: 'zenno.shield.guard_fired',
    timeUnixNano: String((time || Date.now()) * 1e6),
    attributes: {
      'zenno.shield.guard': guardName,
      'zenno.shield.result': result,
      ...(reason ? { 'zenno.shield.reason': reason } : {}),
    },
  };
}

module.exports = { buildExecuteToolSpan, buildInvokeAgentSpan, buildGuardEvent };

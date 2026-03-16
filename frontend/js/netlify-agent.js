/**
 * netlify-agent.js
 *
 * Drop-in replacement for agent.js (mock).
 * Calls real Netlify serverless functions — the ANTHROPIC_API_KEY
 * lives only on the server and is never exposed to the browser.
 *
 * Exported interface is identical to agent.js so views need no changes.
 *
 * Usage: swap the import in any view from:
 *   import { chat, resolveApproval, getSkills } from '../agent.js';
 * to:
 *   import { chat, resolveApproval, getSkills } from '../netlify-agent.js';
 *
 * Function endpoints hit:
 *   POST /api/agent-chat           → agent-chat.mjs       (SSE stream)
 *   POST /api/agent-approve        → agent-approve.mjs    (approve write action)
 *   POST /api/agent-deny           → agent-deny.mjs       (deny write action)
 *   GET  /api/agent-skills         → agent-skills.mjs
 *   GET  /api/agent-soul           → agent-soul.mjs
 *   PUT  /api/agent-soul           → agent-soul.mjs
 *   GET  /api/agent-conversations  → agent-conversations.mjs
 *   GET  /api/agent-rules          → agent-rules.mjs
 *   POST /api/agent-rules          → agent-rules.mjs
 *   PUT  /api/agent-rules          → agent-rules.mjs
 *   DELETE /api/agent-rules        → agent-rules.mjs
 *   GET  /api/agent-rule-history   → agent-rule-history.mjs
 *   GET  /api/agent-events         → agent-events.mjs
 *   POST /api/agent-events         → agent-events.mjs
 */

import { state } from './app.js';

// Base path for all Netlify Function calls.
// Works on Netlify (deployed) and with `netlify dev` locally.
const FN = '/api';

// ---------------------------------------------------------------------------
// SSE parser
// Netlify Functions buffer the full response body, so we fetch the whole
// text and split on the SSE line protocol.
// ---------------------------------------------------------------------------

function* parseSSEBody(text) {
  for (const chunk of text.split('\n\n')) {
    const line = chunk.trim();
    if (!line.startsWith('data:')) continue;
    const json = line.slice(5).trim();
    if (!json) continue;
    try {
      yield JSON.parse(json);
    } catch {
      // malformed event — skip
    }
  }
}

// ---------------------------------------------------------------------------
// Pending approval registry
// When the server emits { type: 'approval_needed', action_id }
// the chat generator pauses here until resolveApproval() is called.
// ---------------------------------------------------------------------------

const _pendingApprovals = new Map();

export function resolveApproval(actionId, approved) {
  const resolve = _pendingApprovals.get(actionId);
  if (resolve) {
    _pendingApprovals.delete(actionId);
    resolve(approved);
  }
}

function _waitForApproval(actionId) {
  return new Promise(resolve => _pendingApprovals.set(actionId, resolve));
}

// ---------------------------------------------------------------------------
// chat()
// Async generator — yields the same event objects the mock agent did:
//   { type: 'text',               content }
//   { type: 'tool_call',          name, input }
//   { type: 'tool_result',        name, result }
//   { type: 'web_search',         query }
//   { type: 'web_search_result',  sources }
//   { type: 'approval_needed',    action_id, name, input, permission }
//   { type: 'done',               session_id, cost? }
//   { type: 'error',              message }
// ---------------------------------------------------------------------------

export async function* chat(sessionId, userMessage, backendUrl) {
  const effectiveBackend = backendUrl ?? state.backendUrl ?? 'http://localhost:8000';

  let response;
  try {
    response = await fetch(`${FN}/agent-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:     userMessage,
        session_id:  sessionId,
        backend_url: effectiveBackend,
      }),
    });
  } catch (err) {
    yield { type: 'error', message: `Network error: ${err.message}` };
    yield { type: 'done' };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    yield { type: 'error', message: `Agent error ${response.status}: ${text}` };
    yield { type: 'done' };
    return;
  }

  const body = await response.text();

  for (const event of parseSSEBody(body)) {
    // When the server signals approval is needed, pause the generator
    // and wait for the user to approve or deny via resolveApproval().
    if (event.type === 'approval_needed') {
      yield event; // Let the UI render the approval prompt

      const approved = await _waitForApproval(event.action_id);

      // Inform the server of the user's decision
      try {
        const endpoint = approved ? 'agent-approve' : 'agent-deny';
        await fetch(`${FN}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_id:   event.action_id,
            backend_url: effectiveBackend,
          }),
        });
      } catch (_) {}

      // Yield a synthetic result so the UI knows the decision was made
      yield {
        type:      'approval_resolved',
        action_id: event.action_id,
        approved,
      };

      continue;
    }

    yield event;

    if (event.type === 'done' || event.type === 'error') break;
  }
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function getSkills() {
  try {
    const res = await fetch(`${FN}/agent-skills`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.skills ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Soul memory
// ---------------------------------------------------------------------------

export async function getSoul() {
  try {
    const res = await fetch(`${FN}/agent-soul`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    return data.content ?? '';
  } catch {
    return '';
  }
}

export async function updateSoul(content) {
  const res = await fetch(`${FN}/agent-soul`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function getConversations() {
  try {
    const res = await fetch(`${FN}/agent-conversations`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return [];
  }
}

export async function getConversation(sessionId) {
  try {
    const res = await fetch(`${FN}/agent-conversations/${sessionId}`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Automation rules
// ---------------------------------------------------------------------------

export async function getRules() {
  try {
    const res = await fetch(`${FN}/agent-rules`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return [];
  }
}

export async function createRule(rule) {
  const res = await fetch(`${FN}/agent-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return res.json();
}

export async function updateRule(ruleId, data) {
  const res = await fetch(`${FN}/agent-rules/${ruleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteRule(ruleId) {
  const res = await fetch(`${FN}/agent-rules/${ruleId}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function getRuleHistory(ruleId) {
  try {
    const res = await fetch(`${FN}/agent-rule-history/${ruleId}`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export async function getEventLog() {
  try {
    const res = await fetch(`${FN}/agent-events`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch {
    return [];
  }
}

export async function logEvent(eventType, description, metadata = null) {
  try {
    const res = await fetch(`${FN}/agent-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, description, metadata }),
    });
    return res.json();
  } catch {
    return null;
  }
}

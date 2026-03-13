/**
 * approvalPrompt.js -- Write action confirmation card.
 * Returns a Promise that resolves true (approve) or false (deny).
 */

import { resolveApproval } from '../agent.js';

export function createApprovalPrompt(event) {
  const el = document.createElement('div');
  el.className = 'approval-prompt';

  const paramsStr = Object.entries(event.params || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  el.innerHTML = `
    <div class="approval-header">
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M10 3l7.5 13H2.5L10 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <line x1="10" y1="9" x2="10" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="10" cy="14.5" r="0.75" fill="currentColor"/>
      </svg>
      Approval Required
    </div>
    <div class="approval-description">${escapeText(event.description)}</div>
    <pre class="approval-params">${escapeText(paramsStr)}</pre>
    <div class="approval-actions">
      <button class="btn btn-success btn-sm approve-btn">
        <svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4.5 4.5L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        Approve
      </button>
      <button class="btn btn-danger btn-sm deny-btn">
        <svg viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Deny
      </button>
    </div>
  `;

  el.querySelector('.approve-btn').addEventListener('click', () => {
    disable(el);
    markResolved(el, true);
    resolveApproval(event.actionId, true);
  });

  el.querySelector('.deny-btn').addEventListener('click', () => {
    disable(el);
    markResolved(el, false);
    resolveApproval(event.actionId, false);
  });

  return el;
}

function disable(el) {
  el.querySelectorAll('button').forEach(b => { b.disabled = true; });
}

function markResolved(el, approved) {
  const actions = el.querySelector('.approval-actions');
  if (actions) {
    actions.innerHTML = `<span class="badge ${approved ? 'badge-success' : 'badge-error'}">${approved ? 'Approved' : 'Denied'}</span>`;
  }
  el.style.borderColor = approved ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
  el.style.boxShadow   = approved ? '0 0 20px rgba(16,185,129,0.15)' : '0 0 20px rgba(239,68,68,0.15)';
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * views/automation.js -- Automation rule manager.
 */

import { getRules, createRule, getRuleHistory, getEventLog, relativeTime } from '../api.js';
import { createRuleCard } from '../components/ruleCard.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div>
        <div class="page-title">Automation</div>
        <div class="page-subtitle">Background rules that run on your node</div>
      </div>
      <button class="btn btn-primary" id="new-rule-btn">
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        New Rule
      </button>
    </div>

    <div class="grid-2" style="align-items:start;gap:20px">
      <div>
        <div class="section-title">Active Rules</div>
        <div id="rules-list">
          <div class="loading-bar"></div>
        </div>
      </div>
      <div>
        <div class="section-title">Event Log</div>
        <div class="card">
          <div id="event-log">
            <div class="loading-bar"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#new-rule-btn').addEventListener('click', () => showNewRuleModal(root));

  await loadRules(root);
  await loadEventLog(root);
}

async function loadRules(root) {
  const list = root.querySelector('#rules-list');
  try {
    const rules = await getRules();
    list.innerHTML = '';

    if (rules.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No rules yet</div>
          <div class="empty-state-text">Create a rule to automate actions on your node.</div>
        </div>
      `;
      return;
    }

    rules.forEach(rule => {
      const card = createRuleCard(rule, () => loadRules(root));
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">Failed to load rules</div>`;
  }
}

async function loadEventLog(root) {
  const logEl = root.querySelector('#event-log');
  try {
    const events = await getEventLog();
    logEl.innerHTML = '';

    if (events.length === 0) {
      logEl.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:8px 0">No events recorded</div>`;
      return;
    }

    events.slice(0, 20).forEach(e => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--border-subtle)';

      const typeColors = {
        rule_exec:    'var(--success)',
        agent_action: 'var(--accent)',
        agent_deny:   'var(--error)',
      };

      row.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div>
            <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${typeColors[e.type] ?? 'var(--text-dim)'}">${e.type.replace('_', ' ')}</span>
            <div style="font-size:13px;color:var(--text-primary);margin-top:2px">${escapeText(e.message)}</div>
          </div>
          <span style="font-size:11px;color:var(--text-dim);white-space:nowrap;flex-shrink:0">${relativeTime(e.timestamp)}</span>
        </div>
      `;

      logEl.appendChild(row);
    });
  } catch (err) {
    logEl.innerHTML = `<div style="color:var(--error);font-size:13px">Failed to load events</div>`;
  }
}

function showNewRuleModal(root) {
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="modal-title">New Automation Rule</div>

    <div class="form-group">
      <label class="form-label">Rule Name</label>
      <input class="form-input" id="rule-name" placeholder="e.g. Auto-mine on low mempool">
    </div>

    <div class="form-group">
      <label class="form-label">Trigger Type</label>
      <select class="form-input" id="rule-trigger">
        <option value="threshold">Threshold -- metric crosses a value</option>
        <option value="schedule">Schedule -- runs on an interval</option>
        <option value="event">Event -- on-chain occurrence</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Condition</label>
      <input class="form-input mono" id="rule-condition" placeholder="e.g. pendingTxs >= 2">
    </div>

    <div class="form-group">
      <label class="form-label">Action</label>
      <select class="form-input" id="rule-action">
        <option value="mine_block">mine_block -- mine the next block</option>
        <option value="notify">notify -- log an alert message</option>
        <option value="add_peer">add_peer -- connect to a peer</option>
      </select>
    </div>

    <div style="font-size:12px;color:var(--text-muted);background:var(--bg-elevated);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:16px">
      The agent will explain exactly what this rule will do before it creates it. Rules run in the background on your Python node.
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" id="cancel-rule">Cancel</button>
      <button class="btn btn-primary" id="confirm-rule">Create Rule</button>
    </div>
  `;

  form.querySelector('#cancel-rule').addEventListener('click', closeModal);

  form.querySelector('#confirm-rule').addEventListener('click', async () => {
    const name      = form.querySelector('#rule-name').value.trim();
    const trigger   = form.querySelector('#rule-trigger').value;
    const condition = form.querySelector('#rule-condition').value.trim();
    const action    = form.querySelector('#rule-action').value;

    if (!name)      return showToast('Rule name is required', 'warning');
    if (!condition) return showToast('Condition is required', 'warning');

    const btn = form.querySelector('#confirm-rule');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      await createRule({ name, trigger, condition, action, actionParams: {}, enabled: true });
      showToast('Rule created', 'success');
      closeModal();
      await loadRules(root);
    } catch (err) {
      showToast('Failed to create rule', 'error');
      btn.disabled = false;
      btn.textContent = 'Create Rule';
    }
  });

  openModal(form);
  setTimeout(() => form.querySelector('#rule-name')?.focus(), 50);
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

export function cleanup() {}

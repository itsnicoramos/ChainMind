/**
 * ruleCard.js -- Automation rule display card.
 */

import { relativeTime } from '../api.js';
import { updateRule, deleteRule } from '../api.js';
import { showToast } from './toast.js';

export function createRuleCard(rule, onUpdate) {
  const el = document.createElement('div');
  el.className = 'rule-card';

  const lastRunStr = rule.lastRun ? relativeTime(rule.lastRun) : 'Never';
  const statusCls  = !rule.enabled ? 'inactive' : rule.lastStatus === 'error' ? 'error' : 'active';

  el.innerHTML = `
    <div class="rule-card-header">
      <span class="status-dot ${statusCls}"></span>
      <span class="rule-card-name">${escapeText(rule.name)}</span>
      <label class="toggle">
        <input type="checkbox" class="rule-toggle" ${rule.enabled ? 'checked' : ''}>
        <span class="toggle-track"></span>
      </label>
    </div>
    <div class="rule-card-trigger">${escapeText(rule.trigger)}: ${escapeText(rule.condition)}</div>
    <div style="font-size:12px;color:var(--text-muted)">
      Action: <span style="color:var(--accent);font-family:var(--font-mono)">${escapeText(rule.action)}</span>
    </div>
    <div class="rule-card-footer">
      <span class="rule-last-run">Last run: ${lastRunStr}${rule.lastStatus ? ` &middot; ${rule.lastStatus}` : ''}</span>
      <button class="btn btn-ghost btn-sm delete-rule-btn" style="color:var(--error)">Delete</button>
    </div>
  `;

  el.querySelector('.rule-toggle').addEventListener('change', async e => {
    try {
      await updateRule(rule.id, { enabled: e.target.checked });
      const dot = el.querySelector('.status-dot');
      dot.className = `status-dot ${e.target.checked ? 'active' : 'inactive'}`;
      showToast(`Rule ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
      if (onUpdate) onUpdate();
    } catch (err) {
      showToast('Failed to update rule', 'error');
      e.target.checked = !e.target.checked;
    }
  });

  el.querySelector('.delete-rule-btn').addEventListener('click', async () => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteRule(rule.id);
      el.remove();
      showToast('Rule deleted', 'success');
      if (onUpdate) onUpdate();
    } catch (err) {
      showToast('Failed to delete rule', 'error');
    }
  });

  return el;
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

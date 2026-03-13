/**
 * views/dashboard.js -- Blockchain explorer with live stats.
 */

import { getBlocks, getStats, getPendingTransactions, relativeTime } from '../api.js';
import { createBlockCard, createConnector } from '../components/blockCard.js';
import { createTxRow } from '../components/txRow.js';

let refreshInterval = null;

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  root.innerHTML = `
    <div class="page-title">Dashboard</div>
    <div class="page-subtitle">Live blockchain overview</div>

    <div class="stats-bar" id="stats-bar">
      ${[1,2,3,4,5].map(() => `<div class="stat-card"><div class="loading-bar"></div></div>`).join('')}
    </div>

    <div class="chain-section">
      <div class="section-title">Chain</div>
      <div class="chain-strip-wrap">
        <div class="chain-strip" id="chain-strip">
          <div style="padding:40px;color:var(--text-dim);font-size:13px">Loading chain...</div>
        </div>
      </div>
    </div>

    <div class="grid-2" style="align-items:start">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Transactions</span>
          <span class="badge badge-muted" id="tx-count">--</span>
        </div>
        <div class="tx-list" id="tx-list">
          <div class="loading-bar" style="margin:20px 0"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Network Health</span>
        </div>
        <div id="network-health"></div>
      </div>
    </div>
  `;

  await loadAll(root);

  refreshInterval = setInterval(() => loadAll(root), 10000);
}

async function loadAll(root) {
  const [stats, blocks, pending] = await Promise.all([
    getStats(),
    getBlocks(),
    getPendingTransactions(),
  ]);

  renderStats(root.querySelector('#stats-bar'), stats);
  renderChain(root.querySelector('#chain-strip'), blocks);
  renderTxList(root.querySelector('#tx-list'), root.querySelector('#tx-count'), blocks, pending);
  renderNetworkHealth(root.querySelector('#network-health'), stats);
}

function renderStats(bar, stats) {
  const items = [
    { number: stats.totalBlocks,  label: 'Total Blocks' },
    { number: stats.pendingTxs,   label: 'Pending Txs' },
    { number: stats.difficulty,   label: 'Difficulty' },
    { number: `${stats.totalSupply} CMC`, label: 'Total Supply' },
    { number: stats.peerCount,    label: 'Peers' },
  ];

  bar.innerHTML = items.map(item => `
    <div class="stat-card">
      <div class="stat-number">${item.number}</div>
      <div class="stat-label">${item.label}</div>
    </div>
  `).join('');
}

function renderChain(strip, blocks) {
  strip.innerHTML = '';
  // Show last 15 blocks max, oldest to newest (left to right)
  const visible = blocks.slice(-15);
  const latest  = visible[visible.length - 1];

  for (let i = 0; i < visible.length; i++) {
    const block   = visible[i];
    const isLast  = block.hash === latest.hash;
    const card    = createBlockCard(block, isLast);
    strip.appendChild(card);

    if (i < visible.length - 1) {
      strip.appendChild(createConnector());
    }
  }

  // Scroll to the newest block
  requestAnimationFrame(() => {
    strip.closest('.chain-strip-wrap').scrollLeft = strip.scrollWidth;
  });
}

function renderTxList(list, countEl, blocks, pending) {
  list.innerHTML = '';

  // Collect last 8 confirmed txs across blocks
  const confirmed = [];
  for (let i = blocks.length - 1; i >= 0 && confirmed.length < 8; i--) {
    for (const tx of blocks[i].transactions) {
      confirmed.push({ tx, blockIndex: blocks[i].index });
      if (confirmed.length >= 8) break;
    }
  }

  const all = [
    ...pending.slice(0, 2).map(tx => ({ tx, blockIndex: null })),
    ...confirmed,
  ].slice(0, 10);

  if (all.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-title">No transactions yet</div></div>';
    return;
  }

  all.forEach(({ tx, blockIndex }) => {
    const row = createTxRow(tx, blockIndex);
    // Mark pending
    if (blockIndex === null) {
      row.style.opacity = '0.65';
      const hashEl = row.querySelector('.tx-row-sub');
      if (hashEl) hashEl.textContent = 'Pending -- ' + hashEl.textContent;
    }
    list.appendChild(row);
  });

  if (countEl) countEl.textContent = all.length;
}

function renderNetworkHealth(el, stats) {
  const peerColor = stats.peerCount >= 2 ? 'var(--success)' : stats.peerCount === 1 ? 'var(--warning)' : 'var(--error)';
  const diffPct   = Math.min((Math.log(stats.difficulty + 1) / Math.log(500)) * 100, 100).toFixed(1);

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;color:var(--text-muted)">Peers connected</span>
          <span style="font-size:13px;font-weight:700;color:${peerColor}">${stats.peerCount}</span>
        </div>
        <div class="difficulty-bar"><div class="difficulty-fill" style="width:${stats.peerCount > 0 ? Math.min(stats.peerCount * 33, 100) : 5}%"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;color:var(--text-muted)">Mining difficulty</span>
          <span style="font-size:13px;font-weight:700">${stats.difficulty.toLocaleString()}</span>
        </div>
        <div class="difficulty-bar"><div class="difficulty-fill" style="width:${diffPct}%"></div></div>
      </div>
      <div style="font-size:12px;color:var(--text-dim)">
        Auto-refreshes every 10 seconds
      </div>
    </div>
  `;
}

export function cleanup() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

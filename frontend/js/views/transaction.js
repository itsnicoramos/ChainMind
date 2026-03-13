/**
 * views/transaction.js -- Transaction detail view.
 * Also handles ?block=HASH query to auto-load a block.
 */

import { getBlocks, getTransaction, getConfirmations, satoshiToCoins, formatHash, relativeTime } from '../api.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  // Parse query params from the hash
  const hash = window.location.hash;
  const blockHash = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '').get('block');

  root.innerHTML = `
    <div class="page-title">Transaction Explorer</div>
    <div class="page-subtitle">Search transactions or view block contents</div>

    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;gap:8px">
        <input class="form-input mono" id="tx-search-inp" placeholder="Search by transaction ID or block hash..." style="flex:1">
        <button class="btn btn-primary" id="tx-search-btn">Search</button>
      </div>
    </div>

    <div id="tx-result"></div>
    <div id="block-view"></div>
  `;

  const searchBtn = root.querySelector('#tx-search-btn');
  const searchInp = root.querySelector('#tx-search-inp');

  searchBtn.addEventListener('click', () => handleSearch(root));
  searchInp.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(root); });

  // Auto-load block if navigated from chain strip
  if (blockHash) {
    await renderBlock(root, blockHash);
  } else {
    await renderRecentBlocks(root);
  }
}

async function handleSearch(root) {
  const inp   = root.querySelector('#tx-search-inp');
  const query = inp.value.trim();
  if (!query) return;

  const blocks = await getBlocks();

  // Try as block hash first
  const block = blocks.find(b => b.hash === query || b.hash.startsWith(query));
  if (block) {
    await renderBlock(root, block.hash);
    return;
  }

  // Try as tx id
  for (const b of blocks) {
    const tx = b.transactions.find(t => t.id === query || t.id.startsWith(query));
    if (tx) {
      await renderTxDetail(root, tx, b);
      return;
    }
  }

  showToast('Not found', 'warning');
}

async function renderRecentBlocks(root) {
  const resultEl = root.querySelector('#block-view');
  const blocks   = await getBlocks();
  const recent   = blocks.slice(-6).reverse();

  resultEl.innerHTML = `
    <div class="section-title">Recent Blocks</div>
    <div class="card">
      ${recent.map(b => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer" class="block-row-item" data-hash="${b.hash}">
          <div>
            <div style="font-weight:700">#${b.index}</div>
            <div class="hash" style="font-size:11px">${formatHash(b.hash)}</div>
          </div>
          <div class="text-right">
            <div style="font-size:13px;color:var(--text-muted)">${b.transactions.length} txs</div>
            <div style="font-size:11px;color:var(--text-dim)">${relativeTime(b.timestamp)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  resultEl.querySelectorAll('.block-row-item').forEach(row => {
    row.addEventListener('click', () => renderBlock(root, row.dataset.hash));
  });
}

async function renderBlock(root, blockHash) {
  const resultEl = root.querySelector('#block-view');
  const txEl     = root.querySelector('#tx-result');
  if (txEl) txEl.innerHTML = '';

  const blocks = await getBlocks();
  const block  = blocks.find(b => b.hash === blockHash);

  if (!block) {
    resultEl.innerHTML = `<div style="color:var(--error)">Block not found</div>`;
    return;
  }

  resultEl.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div style="font-family:var(--font-display);font-weight:800;font-size:20px">Block #${block.index}</div>
          <div class="hash" style="font-size:12px">${block.hash}</div>
        </div>
        <span class="badge badge-success">Confirmed</span>
      </div>
      <div class="grid-2" style="gap:12px;margin-top:4px">
        ${infoRow('Hash', formatHash(block.hash), block.hash)}
        ${infoRow('Previous Hash', formatHash(block.previousHash), block.previousHash)}
        ${infoRow('Timestamp', new Date(block.timestamp).toLocaleString())}
        ${infoRow('Difficulty', block.difficulty.toLocaleString())}
        ${infoRow('Nonce', block.nonce.toLocaleString())}
        ${infoRow('Transactions', block.transactions.length)}
      </div>
    </div>
    <div class="section-title">Transactions in this block</div>
    <div class="card">
      <div id="block-txs"></div>
    </div>
  `;

  const txContainer = resultEl.querySelector('#block-txs');
  block.transactions.forEach(tx => {
    const item = createTxDetailItem(tx, block);
    txContainer.appendChild(item);
  });

  // Make hash values copyable
  resultEl.querySelectorAll('.copyable-hash').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.dataset.full ?? el.textContent).catch(() => {});
      showToast('Copied', 'success');
    });
  });
}

async function renderTxDetail(root, tx, block) {
  const resultEl = root.querySelector('#tx-result');
  const confirms = await getConfirmations(tx.id);

  const totalIn  = tx.inputs.reduce((s, i) => s + i.amount, 0);
  const totalOut = tx.outputs.reduce((s, o) => s + o.amount, 0);

  resultEl.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div>
          <div style="font-family:var(--font-display);font-weight:800;font-size:18px">Transaction</div>
          <div class="hash" style="font-size:12px">${tx.id}</div>
        </div>
        <span class="badge ${confirms.confirmations > 0 ? 'badge-success' : 'badge-warning'}">
          ${confirms.confirmations} confirmation${confirms.confirmations !== 1 ? 's' : ''}
        </span>
      </div>
      <div class="grid-2" style="gap:12px;margin-top:4px">
        ${infoRow('Type', tx.type)}
        ${infoRow('Block', `#${block.index}`)}
        ${infoRow('Timestamp', new Date(tx.timestamp).toLocaleString())}
        ${infoRow('Total out', `${satoshiToCoins(totalOut)} CMC`)}
      </div>
    </div>
    <div class="grid-2" style="gap:16px;align-items:start">
      <div class="card">
        <div class="section-title">Inputs (${tx.inputs.length})</div>
        ${tx.inputs.length === 0
          ? '<div style="color:var(--text-dim);font-size:13px">Coinbase (no inputs)</div>'
          : tx.inputs.map(i => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
              <div class="hash" style="font-size:11px">${formatHash(i.address, 8, 6)}</div>
              <div style="font-weight:700;margin-top:4px">${satoshiToCoins(i.amount)} CMC</div>
            </div>
          `).join('')}
      </div>
      <div class="card">
        <div class="section-title">Outputs (${tx.outputs.length})</div>
        ${tx.outputs.map(o => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div class="hash" style="font-size:11px">${formatHash(o.address, 8, 6)}</div>
            <div style="font-weight:700;color:var(--success);margin-top:4px">+${satoshiToCoins(o.amount)} CMC</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createTxDetailItem(tx, block) {
  const el = document.createElement('div');
  el.style.cssText = 'padding:12px 0;border-bottom:1px solid var(--border-subtle);cursor:pointer';

  const totalOut = tx.outputs.reduce((s, o) => s + o.amount, 0);
  const typeColors = { regular: 'var(--accent)', reward: 'var(--success)', fee: 'var(--warning)' };

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <span style="font-size:11px;font-weight:600;color:${typeColors[tx.type] ?? 'var(--text-muted)'};text-transform:uppercase;letter-spacing:0.06em">${tx.type}</span>
        <div class="hash" style="font-size:11px;margin-top:2px">${formatHash(tx.id, 8, 4)}</div>
      </div>
      <div style="font-weight:700;color:var(--text-primary)">
        ${tx.type === 'fee' ? `${totalOut} sat` : `${satoshiToCoins(totalOut)} CMC`}
      </div>
    </div>
  `;

  el.addEventListener('click', () => renderTxDetail(document.querySelector('#content .view-root'), tx, block));
  return el;
}

function infoRow(label, value, fullValue) {
  const displayValue = fullValue
    ? `<span class="hash copyable-hash" data-full="${fullValue}">${value}</span>`
    : `<span style="font-weight:600">${value}</span>`;

  return `
    <div style="font-size:13px">
      <div style="color:var(--text-dim);margin-bottom:3px">${label}</div>
      ${displayValue}
    </div>
  `;
}

export function cleanup() {}

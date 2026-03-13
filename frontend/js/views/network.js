/**
 * views/network.js -- Peer management view.
 */

import { getPeers, addPeer, getStats, getBlocks, relativeTime } from '../api.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  root.innerHTML = `
    <div class="page-title">Network</div>
    <div class="page-subtitle">Manage peer connections and monitor sync</div>

    <div class="grid-2" style="align-items:start;gap:20px">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Connected Peers</span>
          <span class="badge badge-accent" id="peer-count">0</span>
        </div>
        <div id="peer-list"></div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle)">
          <div class="section-title">Add Peer</div>
          <div style="display:flex;gap:8px">
            <input class="form-input mono" id="peer-url-inp" placeholder="http://node.example.com:8000" style="flex:1">
            <button class="btn btn-primary" id="add-peer-btn">Add</button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-title" style="margin-bottom:16px">Sync Status</div>
          <div id="sync-status"></div>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:16px">Network Info</div>
          <div id="net-info"></div>
        </div>
      </div>
    </div>
  `;

  await loadNetwork(root);

  root.querySelector('#add-peer-btn').addEventListener('click', () => handleAddPeer(root));

  root.querySelector('#peer-url-inp').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddPeer(root);
  });
}

async function loadNetwork(root) {
  try {
    const [peers, stats, blocks] = await Promise.all([
      getPeers(),
      getStats(),
      getBlocks(),
    ]);

    // Peer list
    const peerList  = root.querySelector('#peer-list');
    const peerCount = root.querySelector('#peer-count');
    const connected = peers.filter(p => p.status === 'connected');
    peerCount.textContent = `${connected.length} connected`;

    if (peers.length === 0) {
      peerList.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:8px 0">No peers. Add a peer URL to connect.</div>`;
    } else {
      peerList.innerHTML = '';
      peers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'peer-row';
        row.innerHTML = `
          <span class="status-dot ${p.status === 'connected' ? 'active' : 'inactive'}"></span>
          <span class="peer-url">${escapeText(p.url)}</span>
          <span class="peer-meta">${p.status === 'connected' ? `${relativeTime(p.lastSeen)}` : 'Stale'}</span>
        `;
        peerList.appendChild(row);
      });
    }

    // Warning if low peers
    if (connected.length < 2) {
      const warn = document.createElement('div');
      warn.style.cssText = 'margin-top:10px;padding:8px 12px;background:var(--warning-glow);border-radius:var(--radius-md);font-size:12px;color:var(--warning)';
      warn.textContent = connected.length === 0
        ? 'No peers connected. Your node is isolated and cannot sync with the network.'
        : 'Only 1 peer connected. Consider adding more nodes for better resilience.';
      peerList.appendChild(warn);
    }

    // Sync status
    const syncEl   = root.querySelector('#sync-status');
    const latest   = blocks[blocks.length - 1];
    syncEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:var(--text-muted)">Local chain height</span>
          <span style="font-weight:700">${latest.index}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:var(--text-muted)">Latest block hash</span>
          <span class="hash" style="font-size:12px">${latest.hash.slice(0,8)}...${latest.hash.slice(-4)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="font-size:13px;color:var(--text-muted)">Sync status</span>
          <span class="badge ${connected.length > 0 ? 'badge-success' : 'badge-error'}">
            ${connected.length > 0 ? 'In sync' : 'Isolated'}
          </span>
        </div>
      </div>
    `;

    // Network info
    const netEl = root.querySelector('#net-info');
    netEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Total blocks</span>
          <span style="font-weight:700">${stats.totalBlocks}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Difficulty</span>
          <span style="font-weight:700">${stats.difficulty.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Total supply</span>
          <span style="font-weight:700">${stats.totalSupply} CMC</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">Pending txs</span>
          <span style="font-weight:700">${stats.pendingTxs}</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load network data:', err);
  }
}

async function handleAddPeer(root) {
  const inp = root.querySelector('#peer-url-inp');
  const url = inp.value.trim();
  if (!url) return showToast('Enter a peer URL', 'warning');

  const btn = root.querySelector('#add-peer-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    await addPeer(url);
    showToast('Peer added successfully', 'success');
    inp.value = '';
    await loadNetwork(root);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add';
  }
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

export function cleanup() {}

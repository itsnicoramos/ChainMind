/**
 * views/miner.js -- Mining interface.
 */

import { mine, listWallets, listAddresses, getPendingTransactions, getDifficulty, getBlocks, satoshiToCoins, formatHash } from '../api.js';
import { showToast } from '../components/toast.js';
import { createTxRow } from '../components/txRow.js';

let nonceTimer = null;

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  root.innerHTML = `
    <div class="page-title">Miner</div>
    <div class="page-subtitle">Mine blocks and earn rewards</div>

    <div class="grid-2" style="align-items:start;gap:24px">
      <!-- Left: mine panel -->
      <div class="card">
        <div class="mine-section" id="mine-section">
          <div class="form-group w-full" style="max-width:320px">
            <label class="form-label">Reward Address</label>
            <select class="form-input" id="miner-addr-select">
              <option value="">Loading addresses...</option>
            </select>
          </div>

          <div class="mine-btn-wrap" id="mine-btn-wrap">
            <button class="mine-btn" id="mine-btn">
              <svg class="mine-svg" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l2.5 5h5.5l-4.5 3.5 1.5 5.5L12 14l-5 3 1.5-5.5L4 8h5.5L12 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
              Mine
            </button>
            <div class="mine-ring"></div>
            <div class="mine-ring"></div>
            <div class="mine-ring"></div>
          </div>

          <div class="nonce-display" id="nonce-display">Ready to mine</div>

          <div style="width:100%;max-width:320px;margin-top:20px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:13px;color:var(--text-muted)">Current difficulty</span>
              <span style="font-size:13px;font-weight:700" id="difficulty-val">--</span>
            </div>
            <div class="difficulty-bar">
              <div class="difficulty-fill" id="difficulty-fill" style="width:0%"></div>
            </div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:6px" id="difficulty-next"></div>
          </div>
        </div>
      </div>

      <!-- Right: stats + mempool + recent blocks -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Mempool</span>
            <span class="badge badge-accent" id="mempool-count">0 pending</span>
          </div>
          <div id="mempool-list" class="tx-list"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Mined Blocks</span>
          </div>
          <div id="recent-blocks"></div>
        </div>
      </div>
    </div>
  `;

  await loadMinerData(root);

  root.querySelector('#mine-btn').addEventListener('click', () => doMine(root));
}

async function loadMinerData(root) {
  try {
    const [wallets, diff, pending, blocks] = await Promise.all([
      listWallets(),
      getDifficulty(),
      getPendingTransactions(),
      getBlocks(),
    ]);

    // Populate address selector
    const select = root.querySelector('#miner-addr-select');
    select.innerHTML = '';
    for (const w of wallets) {
      try {
        const addrs = await listAddresses(w.id);
        addrs.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.address;
          opt.textContent = `${formatHash(a.address)} (${satoshiToCoins(a.balance)} CMC)`;
          select.appendChild(opt);
        });
      } catch {}
    }

    if (!select.options.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No addresses -- create a wallet first';
      select.appendChild(opt);
    }

    // Difficulty
    const diffPct = Math.min((Math.log(diff.current + 1) / Math.log(500)) * 100, 100);
    root.querySelector('#difficulty-val').textContent = diff.current.toLocaleString();
    root.querySelector('#difficulty-fill').style.width = `${diffPct}%`;
    root.querySelector('#difficulty-next').textContent =
      `Next increase at block #${diff.nextIncreaseAtBlock} (${diff.blocksUntilIncrease} blocks away)`;

    // Mempool
    const mempoolList  = root.querySelector('#mempool-list');
    const mempoolCount = root.querySelector('#mempool-count');
    mempoolCount.textContent = `${pending.length} pending`;
    mempoolList.innerHTML = '';
    if (pending.length === 0) {
      mempoolList.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:8px 0">Mempool is empty</div>`;
    } else {
      pending.slice(0, 5).forEach(tx => mempoolList.appendChild(createTxRow(tx)));
    }

    // Recent blocks (last 5, reward txs)
    const recentEl = root.querySelector('#recent-blocks');
    const recentBlocks = blocks.slice(-5).reverse();
    recentEl.innerHTML = recentBlocks.map(b => {
      const reward = b.transactions.find(t => t.type === 'reward');
      const rewardAmt = reward ? satoshiToCoins(reward.outputs[0]?.amount ?? 0) : '?';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-subtle)">
          <div>
            <div style="font-weight:700;font-size:14px">Block #${b.index}</div>
            <div class="hash" style="font-size:11px">${formatHash(b.hash)}</div>
          </div>
          <div class="text-right">
            <div style="color:var(--success);font-weight:700">+${rewardAmt} CMC</div>
            <div style="font-size:11px;color:var(--text-dim)">${b.transactions.length} txs</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load miner data:', err);
  }
}

async function doMine(root) {
  const select  = root.querySelector('#miner-addr-select');
  const mineBtn = root.querySelector('#mine-btn');
  const mineWrap = root.querySelector('#mine-btn-wrap');
  const nonceEl = root.querySelector('#nonce-display');
  const miner   = select.value;

  if (!miner) return showToast('Select a reward address first', 'warning');

  mineBtn.classList.add('mining');
  mineWrap.classList.add('mining-active');
  mineBtn.disabled = true;

  // Animate nonce counter
  let nonce = 0;
  nonceEl.textContent = 'Nonce: 0';
  nonceTimer = setInterval(() => {
    nonce += Math.floor(Math.random() * 12000 + 4000);
    nonceEl.textContent = `Nonce: ${nonce.toLocaleString()}`;
  }, 80);

  try {
    const result = await mine(miner);
    clearInterval(nonceTimer);
    nonceTimer = null;
    nonceEl.textContent = `Nonce: ${result.block.nonce.toLocaleString()} -- Found!`;
    showToast(`Block #${result.block.index} mined! +50 CMC reward`, 'success');
    await loadMinerData(root);
  } catch (err) {
    showToast(err.message ?? 'Mining failed', 'error');
    nonceEl.textContent = 'Mining failed';
  } finally {
    if (nonceTimer) { clearInterval(nonceTimer); nonceTimer = null; }
    mineBtn.classList.remove('mining');
    mineWrap.classList.remove('mining-active');
    mineBtn.disabled = false;
  }
}

export function cleanup() {
  if (nonceTimer) { clearInterval(nonceTimer); nonceTimer = null; }
}

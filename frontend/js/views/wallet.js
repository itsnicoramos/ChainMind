/**
 * views/wallet.js -- Wallet management view.
 */

import { listWallets, listAddresses, createWallet, createAddress, sendTransaction, satoshiToCoins, formatHash } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';

let selectedWalletId = null;

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  container.appendChild(root);

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div>
        <div class="page-title">Wallet</div>
        <div class="page-subtitle">Manage your wallets and addresses</div>
      </div>
      <button class="btn btn-primary" id="create-wallet-btn">
        <svg viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        New Wallet
      </button>
    </div>

    <div class="wallet-layout">
      <div>
        <div class="section-title">Your Wallets</div>
        <div class="wallet-list" id="wallet-list">
          <div class="loading-bar"></div>
        </div>
      </div>
      <div id="wallet-detail">
        <div class="empty-state">
          <div class="empty-state-title">Select a wallet</div>
          <div class="empty-state-text">Choose a wallet from the left panel to view addresses and balances.</div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#create-wallet-btn').addEventListener('click', showCreateWalletModal);

  await loadWallets(root);
}

async function loadWallets(root) {
  const list = root.querySelector('#wallet-list');
  try {
    const wallets = await listWallets();
    list.innerHTML = '';

    if (wallets.length === 0) {
      list.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:12px">No wallets yet. Create one to get started.</div>`;
      return;
    }

    wallets.forEach(w => {
      const item = document.createElement('div');
      item.className = `wallet-item${w.id === selectedWalletId ? ' active' : ''}`;
      item.innerHTML = `
        <div class="wallet-item-id">${w.id}</div>
        <div class="wallet-item-balance">${satoshiToCoins(w.totalBalance)} CMC</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:3px">${w.addressCount} address${w.addressCount !== 1 ? 'es' : ''}</div>
      `;
      item.addEventListener('click', () => {
        list.querySelectorAll('.wallet-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        selectedWalletId = w.id;
        loadWalletDetail(root, w.id);
      });
      list.appendChild(item);

      // Auto-select first wallet
      if (!selectedWalletId && wallets.indexOf(w) === 0) {
        item.classList.add('active');
        selectedWalletId = w.id;
        loadWalletDetail(root, w.id);
      }
    });
  } catch (err) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">Failed to load wallets</div>`;
  }
}

async function loadWalletDetail(root, walletId) {
  const detail = root.querySelector('#wallet-detail');
  detail.innerHTML = `<div class="loading-bar"></div>`;

  try {
    const addresses = await listAddresses(walletId);
    detail.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Addresses</span>
          <button class="btn btn-secondary btn-sm" id="add-addr-btn">Add Address</button>
        </div>
        <div id="address-list"></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:16px">Send Coins</div>
        <div class="form-group">
          <label class="form-label">From Address</label>
          <select class="form-input" id="from-addr">
            ${addresses.map(a => `<option value="${a.address}">${formatHash(a.address)} -- ${satoshiToCoins(a.balance)} CMC</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">To Address</label>
          <input class="form-input mono" id="to-addr" placeholder="CM1..." spellcheck="false">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (CMC)</label>
          <input class="form-input" id="send-amount" type="number" min="0.000000001" step="0.001" placeholder="0.0000">
        </div>
        <div class="form-group">
          <label class="form-label">Wallet Password</label>
          <input class="form-input" id="send-password" type="password" placeholder="Enter password to authorize">
        </div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px">Fee: 1 satoshi</div>
        <button class="btn btn-primary w-full" id="send-btn">Send</button>
      </div>
    `;

    const addrList = detail.querySelector('#address-list');
    if (addresses.length === 0) {
      addrList.innerHTML = `<div style="font-size:13px;color:var(--text-dim);padding:8px 0">No addresses yet.</div>`;
    } else {
      addresses.forEach(a => {
        const row = document.createElement('div');
        row.className = 'address-row';
        row.innerHTML = `
          <div class="address-value" title="${a.address}">${formatHash(a.address, 10, 6)}</div>
          <div class="address-balance">${satoshiToCoins(a.balance)} CMC</div>
          <button class="copy-btn" title="Copy address">
            <svg viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M13 7V5a1.5 1.5 0 00-1.5-1.5H5A1.5 1.5 0 003.5 5v6.5A1.5 1.5 0 005 13h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        `;
        row.querySelector('.copy-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(a.address).catch(() => {});
          showToast('Address copied', 'success');
        });
        addrList.appendChild(row);
      });
    }

    detail.querySelector('#add-addr-btn').addEventListener('click', () => showAddAddressModal(root, walletId));

    detail.querySelector('#send-btn').addEventListener('click', async () => {
      const fromAddress = detail.querySelector('#from-addr').value;
      const toAddress   = detail.querySelector('#to-addr').value.trim();
      const amount      = parseFloat(detail.querySelector('#send-amount').value);
      const password    = detail.querySelector('#send-password').value;

      if (!toAddress) return showToast('Enter a destination address', 'warning');
      if (!amount || amount <= 0) return showToast('Enter a valid amount', 'warning');
      if (!password) return showToast('Password required', 'warning');

      const btn = detail.querySelector('#send-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        const result = await sendTransaction({ walletId, fromAddress, toAddress, amount, _password: password });
        showToast('Transaction submitted: ' + formatHash(result.transactionId, 6, 4), 'success');
        detail.querySelector('#to-addr').value = '';
        detail.querySelector('#send-amount').value = '';
        detail.querySelector('#send-password').value = '';
        await loadWallets(root);
        await loadWalletDetail(root, walletId);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send';
      }
    });

  } catch (err) {
    detail.innerHTML = `<div style="color:var(--error);font-size:13px">Failed to load wallet</div>`;
  }
}

function showCreateWalletModal() {
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="modal-title">Create Wallet</div>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Your password encrypts the private key. It cannot be recovered if lost.</p>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" id="new-wallet-pw" type="password" placeholder="Strong password">
    </div>
    <div class="form-group">
      <label class="form-label">Confirm Password</label>
      <input class="form-input" id="new-wallet-pw2" type="password" placeholder="Repeat password">
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="confirm-create-btn">Create</button>
    </div>
  `;

  form.querySelector('#cancel-btn').addEventListener('click', closeModal);

  form.querySelector('#confirm-create-btn').addEventListener('click', async () => {
    const pw  = form.querySelector('#new-wallet-pw').value;
    const pw2 = form.querySelector('#new-wallet-pw2').value;

    if (pw.length < 6)  return showToast('Password must be at least 6 characters', 'warning');
    if (pw !== pw2)     return showToast('Passwords do not match', 'warning');

    const btn = form.querySelector('#confirm-create-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const result = await createWallet(pw);
      showToast(`Wallet created: ${result.id}`, 'success');
      closeModal();
      // Trigger wallet list reload
      const root = document.querySelector('#content .view-root');
      if (root) await loadWallets(root);
    } catch (err) {
      showToast('Failed to create wallet', 'error');
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  });

  openModal(form);
  setTimeout(() => form.querySelector('#new-wallet-pw')?.focus(), 50);
}

function showAddAddressModal(root, walletId) {
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="modal-title">Add Address</div>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Confirm with your wallet password to generate a new address.</p>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" id="addr-pw" type="password" placeholder="Wallet password">
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="confirm-addr-btn">Generate</button>
    </div>
  `;

  form.querySelector('#cancel-btn').addEventListener('click', closeModal);

  form.querySelector('#confirm-addr-btn').addEventListener('click', async () => {
    const pw  = form.querySelector('#addr-pw').value;
    if (!pw)  return showToast('Password required', 'warning');

    const btn = form.querySelector('#confirm-addr-btn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const result = await createAddress(walletId, pw);
      showToast(`Address created: ${formatHash(result.address)}`, 'success');
      closeModal();
      await loadWallets(root);
      await loadWalletDetail(root, walletId);
    } catch (err) {
      showToast('Failed to create address', 'error');
      btn.disabled = false;
      btn.textContent = 'Generate';
    }
  });

  openModal(form);
  setTimeout(() => form.querySelector('#addr-pw')?.focus(), 50);
}

export function cleanup() {
  selectedWalletId = null;
}

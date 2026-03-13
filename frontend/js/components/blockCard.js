/**
 * blockCard.js -- Single block card for the chain strip.
 */

import { formatHash, relativeTime } from '../api.js';

export function createBlockCard(block, isLatest = false) {
  const el = document.createElement('div');
  el.className = `block-card${isLatest ? ' latest' : ''}`;
  el.dataset.hash = block.hash;

  const txCount = block.transactions.length;
  const timeStr = relativeTime(block.timestamp);

  el.innerHTML = `
    <div class="block-index">#${block.index}</div>
    <div class="block-hash">${formatHash(block.hash)}</div>
    <div class="block-meta">
      <span class="block-txs">${txCount} tx${txCount !== 1 ? 's' : ''}</span>
      <span class="block-time">${timeStr}</span>
    </div>
  `;

  el.addEventListener('click', () => {
    window.location.hash = `#/transaction?block=${block.hash}`;
  });

  return el;
}

export function createConnector() {
  const el = document.createElement('div');
  el.className = 'chain-connector';
  return el;
}

/**
 * txRow.js -- Transaction list row component.
 */

import { formatHash, satoshiToCoins, relativeTime } from '../api.js';

const TYPE_ICONS = {
  regular: { icon: '&#8646;', cls: 'regular' },
  reward:  { icon: '&#9733;', cls: 'reward' },
  fee:     { icon: '&#9889;', cls: 'fee' },
};

export function createTxRow(tx, blockIndex = null) {
  const el = document.createElement('div');
  el.className = 'tx-row';

  const { icon, cls } = TYPE_ICONS[tx.type] ?? TYPE_ICONS.regular;

  const totalOut = tx.outputs.reduce((s, o) => s + o.amount, 0);
  const amountStr = tx.type === 'fee'
    ? `${totalOut} sat`
    : `${satoshiToCoins(totalOut)} CMC`;

  const fromAddr = tx.inputs[0]?.address ?? '(coinbase)';
  const toAddr   = tx.outputs[0]?.address ?? '???';

  const sub = tx.type === 'reward'
    ? 'Block reward'
    : `${formatHash(fromAddr)} to ${formatHash(toAddr)}`;

  const time = relativeTime(tx.timestamp);

  el.innerHTML = `
    <div class="tx-type-icon ${cls}">${icon}</div>
    <div class="tx-row-body">
      <div class="tx-row-hash hash" title="${tx.id}">${formatHash(tx.id, 8, 4)}</div>
      <div class="tx-row-sub">${sub} &middot; ${time}${blockIndex !== null ? ` &middot; block #${blockIndex}` : ''}</div>
    </div>
    <div class="tx-row-amount">${amountStr}</div>
  `;

  // Copy hash on click
  el.querySelector('.tx-row-hash').addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(tx.id).catch(() => {});
  });

  return el;
}

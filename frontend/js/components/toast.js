/**
 * toast.js -- Notification popup component.
 * show(message, type) -- types: success | error | info | warning
 */

let container;

function getContainer() {
  if (!container) container = document.getElementById('toast-container');
  return container;
}

export function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-dot"></span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <span class="toast-close" role="button" aria-label="Dismiss">&times;</span>
  `;

  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };

  el.querySelector('.toast-close').addEventListener('click', close);
  getContainer().appendChild(el);
  setTimeout(close, 4500);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

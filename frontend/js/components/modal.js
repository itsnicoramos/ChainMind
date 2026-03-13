/**
 * modal.js -- Reusable centered modal wrapper.
 */

let overlay, modalContainer, backdropEl;

function ensureElements() {
  if (!overlay) {
    overlay         = document.getElementById('modal-overlay');
    modalContainer  = document.getElementById('modal-container');
    backdropEl      = document.getElementById('modal-backdrop');
    backdropEl.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
}

export function openModal(contentEl) {
  ensureElements();
  modalContainer.innerHTML = '';
  modalContainer.appendChild(typeof contentEl === 'string' ? (() => { const d = document.createElement('div'); d.innerHTML = contentEl; return d; })() : contentEl);
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  ensureElements();
  overlay.classList.add('hidden');
  modalContainer.innerHTML = '';
  document.body.style.overflow = '';
}

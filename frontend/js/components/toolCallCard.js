/**
 * toolCallCard.js -- Inline collapsible tool execution card.
 */

export function createToolCard(toolName, input, status = 'running') {
  const card = document.createElement('div');
  card.className = 'tool-card';

  card.innerHTML = `
    <div class="tool-card-header">
      <div class="tool-card-icon">
        <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 3.5l2 2-9 9-2.5.5.5-2.5 9-9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </div>
      <span class="tool-card-name">${toolName}</span>
      <span class="tool-card-status ${status}">${status}</span>
      <svg class="tool-card-chevron" viewBox="0 0 20 20" fill="none"><path d="M7 8l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </div>
    <div class="tool-card-body">
      <div class="tool-label">Input</div>
      <pre>${JSON.stringify(input, null, 2)}</pre>
      <div class="output-section"></div>
    </div>
  `;

  card.querySelector('.tool-card-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  return card;
}

export function updateToolCard(card, output) {
  const statusEl = card.querySelector('.tool-card-status');
  if (statusEl) {
    statusEl.textContent = 'done';
    statusEl.className = 'tool-card-status done';
  }

  const outputSection = card.querySelector('.output-section');
  if (outputSection) {
    outputSection.innerHTML = `
      <div class="tool-label" style="margin-top:8px">Output</div>
      <pre>${JSON.stringify(output, null, 2)}</pre>
    `;
  }
}

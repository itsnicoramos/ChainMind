/**
 * webSearchCard.js -- Inline web search display card.
 */

export function createSearchCard(query) {
  const card = document.createElement('div');
  card.className = 'search-card';

  card.innerHTML = `
    <div class="search-card-header">
      <svg class="search-globe" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 2a14 14 0 010 16M10 2a14 14 0 000 16M2 10h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="search-query">Searching: ${escapeText(query)}</span>
      <svg style="width:14px;height:14px;color:var(--text-dim);transition:transform .15s" viewBox="0 0 20 20" fill="none"><path d="M7 8l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </div>
    <div class="search-body"></div>
  `;

  card.querySelector('.search-card-header').addEventListener('click', () => {
    card.classList.toggle('open');
    const chevron = card.querySelector('.search-card-header svg:last-child');
    if (chevron) chevron.style.transform = card.classList.contains('open') ? 'rotate(180deg)' : '';
  });

  return card;
}

export function updateSearchCard(card, sources) {
  const body = card.querySelector('.search-body');
  if (!body) return;

  body.innerHTML = sources.map(s => `
    <div class="search-source">
      <span style="color:var(--text-dim)">&#8599;</span>
      <a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">${escapeText(s.title)}</a>
    </div>
  `).join('');

  const label = card.querySelector('.search-query');
  if (label) label.textContent = `Web search: ${label.textContent.replace('Searching: ', '')}`;
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

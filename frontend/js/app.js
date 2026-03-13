/**
 * app.js -- Application entry point.
 * Handles routing, global state, theme toggle, and nav highlighting.
 */

// -- Global state ------------------------------------------------

export const state = {
  currentView:  null,
  backendUrl:   localStorage.getItem('cm-backend-url') ?? 'http://localhost:8000',
  theme:        localStorage.getItem('cm-theme') ?? 'dark',
};

// -- Route map ---------------------------------------------------

const ROUTES = {
  '#/dashboard':   () => import('./views/dashboard.js'),
  '#/wallet':      () => import('./views/wallet.js'),
  '#/miner':       () => import('./views/miner.js'),
  '#/network':     () => import('./views/network.js'),
  '#/transaction': () => import('./views/transaction.js'),
  '#/agent':       () => import('./views/agent.js'),
  '#/automation':  () => import('./views/automation.js'),
};

// -- Router ------------------------------------------------------

let currentCleanup = null;

async function navigate(rawHash) {
  // Strip query string to match route key
  const routeKey = rawHash.split('?')[0] || '#/dashboard';
  const loader   = ROUTES[routeKey] ?? ROUTES['#/dashboard'];

  const content = document.getElementById('content');
  if (!content) return;

  // Cleanup previous view
  if (currentCleanup) {
    try { currentCleanup(); } catch {}
    currentCleanup = null;
  }

  // Update nav highlight
  const allItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
  allItems.forEach(item => item.classList.remove('active'));

  const viewKey   = routeKey.replace('#/', '');
  const activeNav = document.querySelector(`.nav-item[data-view="${viewKey}"], .mobile-nav-item[data-view="${viewKey}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Load and render the view
  try {
    const mod = await loader();

    if (document.startViewTransition) {
      document.startViewTransition(() => mod.render(content));
    } else {
      await mod.render(content);
    }

    currentCleanup = mod.cleanup ?? null;
    state.currentView = viewKey;
  } catch (err) {
    console.error('Navigation error:', err);
    content.innerHTML = `
      <div class="view-root" style="padding:40px;text-align:center;color:var(--error)">
        <div style="font-size:48px;margin-bottom:16px">&#9888;</div>
        <div style="font-weight:700;font-size:18px">Failed to load view</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:8px">${err.message}</div>
        <button class="btn btn-secondary" style="margin-top:20px" onclick="location.hash='#/dashboard'">Go to Dashboard</button>
      </div>
    `;
  }
}

// -- Theme -------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cm-theme', theme);
  state.theme = theme;
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// -- Node URL selector -------------------------------------------

function initNodeSelector() {
  const input = document.getElementById('node-url-input');
  if (!input) return;

  input.value = new URL(state.backendUrl).host;

  input.addEventListener('change', () => {
    const val = input.value.trim();
    if (!val) return;
    const url = val.startsWith('http') ? val : `http://${val}`;
    state.backendUrl = url;
    localStorage.setItem('cm-backend-url', url);
  });
}

// -- Init --------------------------------------------------------

function init() {
  // Apply saved theme
  applyTheme(state.theme);

  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Node selector
  initNodeSelector();

  // Handle hash changes
  window.addEventListener('hashchange', () => navigate(window.location.hash));

  // Initial navigation
  const initialHash = window.location.hash || '#/dashboard';
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    navigate(initialHash);
  }
}

document.addEventListener('DOMContentLoaded', init);

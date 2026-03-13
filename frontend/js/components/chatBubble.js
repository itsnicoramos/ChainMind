/**
 * chatBubble.js -- Chat message bubble component.
 * Returns { wrap, bubble } DOM elements.
 */

export function createBubble(role) {
  const wrap = document.createElement('div');
  wrap.className = `chat-bubble-wrap ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `bubble-avatar ${role === 'user' ? 'user-av' : 'agent-av'}`;

  if (role === 'user') {
    avatar.textContent = 'N';
  } else {
    avatar.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);

  return { wrap, bubble };
}

const THINKING_PHRASES = [
  'Thinking',
  'Reading the chain',
  'Checking balances',
  'Analyzing blocks',
  'Formulating response',
  'Consulting the ledger',
];

export function createThinkingBubble() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-bubble-wrap agent';

  const avatar = document.createElement('div');
  avatar.className = 'bubble-avatar agent-av';
  avatar.innerHTML = `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const bubble = document.createElement('div');
  bubble.className = 'thinking-bubble';
  bubble.innerHTML = `
    <span class="thinking-label">Thinking</span>
    <div class="thinking-dots">
      <div class="thinking-dot"></div>
      <div class="thinking-dot"></div>
      <div class="thinking-dot"></div>
    </div>
  `;

  // Cycle through phrases
  const label = bubble.querySelector('.thinking-label');
  let idx = 0;
  const interval = setInterval(() => {
    idx = (idx + 1) % THINKING_PHRASES.length;
    label.classList.add('thinking-label-fade');
    setTimeout(() => {
      label.textContent = THINKING_PHRASES[idx];
      label.classList.remove('thinking-label-fade');
    }, 150);
  }, 1800);

  // Store interval on the element so streamHandler can clear it
  wrap._thinkingInterval = interval;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  return wrap;
}

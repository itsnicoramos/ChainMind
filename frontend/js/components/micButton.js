/**
 * micButton.js -- Animated microphone button.
 * States: idle | listening | speaking | error
 */

export function createMicButton() {
  const el = document.createElement('button');
  el.className = 'mic-btn';
  el.title = 'Hold to speak';
  el.type = 'button';
  el.setAttribute('aria-label', 'Voice input');

  el.innerHTML = `
    <svg class="mic-icon-idle" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <svg class="mic-icon-speaking hidden" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M15.5 8.5a5 5 0 010 7M19 6a9 9 0 010 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  return el;
}

export function setMicState(btn, state) {
  btn.className = `mic-btn ${state}`;
  const idleIcon     = btn.querySelector('.mic-icon-idle');
  const speakingIcon = btn.querySelector('.mic-icon-speaking');

  if (idleIcon)     idleIcon.classList.toggle('hidden', state === 'speaking');
  if (speakingIcon) speakingIcon.classList.toggle('hidden', state !== 'speaking');

  const labels = {
    idle:      'Tap to speak',
    listening: 'Listening...',
    speaking:  'Agent speaking...',
    error:     'Voice unavailable',
  };

  btn.title = labels[state] ?? 'Voice input';
}

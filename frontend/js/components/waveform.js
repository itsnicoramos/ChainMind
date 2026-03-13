/**
 * waveform.js -- CSS expanding ring animation that wraps the mic button.
 */

export function createWaveform() {
  const el = document.createElement('div');
  el.className = 'mic-waveform';
  el.style.cssText = `
    position: absolute;
    inset: -16px;
    pointer-events: none;
    border-radius: 50%;
  `;

  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div');
    ring.className = 'mic-waveform-ring';
    ring.style.cssText = `
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1px solid var(--accent);
      opacity: 0;
      animation: none;
    `;
    el.appendChild(ring);
  }

  return el;
}

export function startWaveform(waveform) {
  const rings = waveform.querySelectorAll('.mic-waveform-ring');
  rings.forEach((r, i) => {
    r.style.animation = `ring-expand 2s ${i * 0.55}s ease-out infinite`;
  });
}

export function stopWaveform(waveform) {
  const rings = waveform.querySelectorAll('.mic-waveform-ring');
  rings.forEach(r => { r.style.animation = 'none'; });
}

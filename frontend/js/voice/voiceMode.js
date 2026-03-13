/**
 * voiceMode.js -- Orchestrates the full voice conversation loop.
 *
 * When active, replaces the text input bar with a mic button.
 * Flow: user presses mic -> speech captured -> submitted to agent ->
 *       response streamed + spoken aloud -> mic auto-reopens.
 */

import { isRecognitionSupported, createSpeechInput } from './speechInput.js';
import { isSynthesisSupported, loadVoices, speak, stopSpeaking } from './speechOutput.js';
import { createMicButton, setMicState } from '../components/micButton.js';
import { createWaveform, startWaveform, stopWaveform } from '../components/waveform.js';

export function isVoiceSupported() {
  return isRecognitionSupported() && isSynthesisSupported();
}

let micBtn    = null;
let waveform  = null;
let input     = null;
let composing = null;
let recognition = null;

export function initVoiceMode(root, onSubmit) {
  if (!isVoiceSupported()) return;

  loadVoices().catch(() => {});

  const inputBar = root.querySelector('.chat-input-bar');
  if (!inputBar) return;

  // Create mic UI
  const voiceRow = document.createElement('div');
  voiceRow.id = 'voice-row';
  voiceRow.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;flex:1';

  composing = document.createElement('div');
  composing.className = 'voice-composing';
  composing.textContent = 'Tap the mic to speak';

  const micWrap = document.createElement('div');
  micWrap.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center';

  micBtn   = createMicButton();
  waveform = createWaveform();

  micWrap.appendChild(waveform);
  micWrap.appendChild(micBtn);

  voiceRow.appendChild(composing);
  voiceRow.appendChild(micWrap);

  // Find the text input wrap and insert voice row in its place
  const textWrap = inputBar.querySelector('#text-input-wrap');
  if (textWrap) textWrap.before(voiceRow);

  micBtn.addEventListener('click', () => handleMicClick(onSubmit));
}

function handleMicClick(onSubmit) {
  if (!micBtn) return;

  // If currently speaking, cancel and reopen mic
  stopSpeaking();

  if (recognition) {
    recognition.stop();
    recognition = null;
    setMicState(micBtn, 'idle');
    stopWaveform(waveform);
    if (composing) composing.textContent = 'Tap the mic to speak';
    return;
  }

  startListening(onSubmit);
}

function startListening(onSubmit) {
  if (!micBtn) return;

  setMicState(micBtn, 'listening');
  startWaveform(waveform);
  if (composing) composing.textContent = 'Listening...';

  recognition = createSpeechInput({
    onInterim(text) {
      if (composing) composing.textContent = text;
    },
    onFinal(text) {
      if (!text) return;
      if (composing) composing.textContent = text;
      setMicState(micBtn, 'idle');
      stopWaveform(waveform);
      recognition = null;
      submitAndRespond(text, onSubmit);
    },
    onError(err) {
      setMicState(micBtn, 'idle');
      stopWaveform(waveform);
      recognition = null;
      if (composing) composing.textContent = `Error: ${err}. Tap to try again.`;
    },
    onEnd() {
      if (recognition) return; // already handled by onFinal
      setMicState(micBtn, 'idle');
      stopWaveform(waveform);
      recognition = null;
      if (composing && composing.textContent === 'Listening...') {
        composing.textContent = 'No speech detected. Tap to try again.';
      }
    },
  });

  recognition?.start();
}

function submitAndRespond(text, onSubmit) {
  if (!micBtn || !composing) return;

  composing.textContent = `You: "${text}"`;
  setMicState(micBtn, 'idle');

  // Intercept the stream to speak the response
  const originalOnSubmit = onSubmit;

  // Monkey-patch: we let the chat view handle the stream,
  // but also collect the text tokens for TTS.
  // The chat view calls onSubmit(text) which triggers handleStream.
  // We wrap the generator via a global hook.
  window.__ttsEnabled = true;
  window.__ttsBuffer  = '';

  // Override the stream text handler temporarily via a flag
  onSubmit(text);

  // After agent responds, auto-reopen mic
  const pollForDone = setInterval(() => {
    if (!window.__agentStreaming) {
      clearInterval(pollForDone);
      window.__ttsEnabled = false;

      const responseText = window.__ttsBuffer ?? '';
      window.__ttsBuffer = '';

      if (responseText) {
        setMicState(micBtn, 'speaking');
        speak(responseText, {
          onEnd() {
            if (micBtn) {
              setMicState(micBtn, 'idle');
              if (composing) composing.textContent = 'Tap the mic to speak';
              // Auto-reopen mic for next turn
              setTimeout(() => startListening(originalOnSubmit), 400);
            }
          },
        });
      } else {
        if (composing) composing.textContent = 'Tap the mic to speak';
      }
    }
  }, 200);
}

export function destroyVoiceMode(root) {
  if (recognition) { recognition.abort(); recognition = null; }
  stopSpeaking();
  window.__ttsEnabled = false;
  window.__ttsBuffer  = '';

  const voiceRow = root?.querySelector('#voice-row');
  if (voiceRow) voiceRow.remove();

  micBtn   = null;
  waveform = null;
  composing = null;
}

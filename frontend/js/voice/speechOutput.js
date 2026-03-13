/**
 * speechOutput.js -- Text to speech via Web Speech Synthesis API.
 */

export function isSynthesisSupported() {
  return !!window.speechSynthesis;
}

let preferredVoice = null;

export function loadVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      preferredVoice = pickVoice(voices);
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        const v = window.speechSynthesis.getVoices();
        preferredVoice = pickVoice(v);
        resolve(v);
      };
    }
  });
}

function pickVoice(voices) {
  // Prefer a natural English voice
  const saved = localStorage.getItem('cm-preferred-voice');
  if (saved) {
    const found = voices.find(v => v.name === saved);
    if (found) return found;
  }
  // Google US English > any en-US > any English > first available
  return (
    voices.find(v => v.name === 'Google US English') ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0] ||
    null
  );
}

export function getAvailableVoices() {
  return window.speechSynthesis?.getVoices() ?? [];
}

export function setPreferredVoice(name) {
  localStorage.setItem('cm-preferred-voice', name);
  preferredVoice = getAvailableVoices().find(v => v.name === name) ?? preferredVoice;
}

// Patterns to skip (tool call JSON, raw hashes, etc.)
const SKIP_PATTERNS = [
  /^\s*[\{\[]/,     // JSON
  /CM1[a-f0-9]{20,}/i, // addresses
];

function shouldSpeak(text) {
  return !SKIP_PATTERNS.some(p => p.test(text));
}

// Split text into speakable sentences
function splitSentences(text) {
  // Remove markdown bold/code markers
  const clean = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ');

  return clean
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && shouldSpeak(s));
}

let speakQueue  = [];
let isSpeaking  = false;
let cancelFlag  = false;

async function processQueue(onStart, onEnd) {
  if (isSpeaking || speakQueue.length === 0) return;
  isSpeaking = true;
  cancelFlag = false;
  if (onStart) onStart();

  while (speakQueue.length > 0 && !cancelFlag) {
    const sentence = speakQueue.shift();
    await speakSentence(sentence);
    if (cancelFlag) break;
  }

  isSpeaking = false;
  speakQueue  = [];
  if (onEnd) onEnd();
}

function speakSentence(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || cancelFlag) { resolve(); return; }

    const utt  = new SpeechSynthesisUtterance(text);
    utt.rate   = 1.0;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    if (preferredVoice) utt.voice = preferredVoice;

    utt.onend   = () => resolve();
    utt.onerror = () => resolve();

    window.speechSynthesis.speak(utt);
  });
}

export function speak(text, { onStart, onEnd } = {}) {
  if (!isSynthesisSupported()) return;
  const sentences = splitSentences(text);
  speakQueue.push(...sentences);
  processQueue(onStart, onEnd);
}

export function stopSpeaking() {
  cancelFlag = true;
  isSpeaking = false;
  speakQueue  = [];
  try { window.speechSynthesis.cancel(); } catch {}
}

export function getIsSpeaking() {
  return isSpeaking;
}

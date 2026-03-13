/**
 * speechInput.js -- Microphone to text via Web Speech API.
 */

export function isRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createSpeechInput({ onInterim, onFinal, onError, onEnd }) {
  if (!isRecognitionSupported()) return null;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();

  recognition.lang            = 'en-US';
  recognition.continuous      = false;
  recognition.interimResults  = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = '';
    let final   = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    if (interim && onInterim) onInterim(interim);
    if (final   && onFinal)   onFinal(final.trim());
  };

  recognition.onerror = (event) => {
    const ignored = ['no-speech', 'aborted'];
    if (!ignored.includes(event.error) && onError) {
      onError(event.error);
    }
    if (onEnd) onEnd();
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return {
    start() {
      try { recognition.start(); } catch {}
    },
    stop() {
      try { recognition.stop(); } catch {}
    },
    abort() {
      try { recognition.abort(); } catch {}
    },
  };
}

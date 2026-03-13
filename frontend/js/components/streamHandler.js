/**
 * streamHandler.js -- Consumes the agent async generator
 * and dispatches DOM mutations into the chat area.
 */

import { createBubble, createThinkingBubble } from './chatBubble.js';
import { createToolCard, updateToolCard } from './toolCallCard.js';
import { createSearchCard, updateSearchCard } from './webSearchCard.js';
import { createApprovalPrompt } from './approvalPrompt.js';

function removeThinkingWrap(el) {
  if (!el) return;
  if (el._thinkingInterval) clearInterval(el._thinkingInterval);
  el.remove();
}

export async function handleStream(generator, chatArea, onDone) {
  // Remove any existing thinking indicator
  const existing = chatArea.querySelector('.thinking-wrap');
  if (existing) removeThinkingWrap(existing);

  let agentBubble = null;
  let agentBubbleText = '';
  let activeToolCards = {};   // name -> card element
  let activeSearchCards = {}; // query -> card element

  function ensureAgentBubble() {
    if (!agentBubble) {
      const { wrap, bubble } = createBubble('agent');
      chatArea.appendChild(wrap);
      agentBubble = bubble;
      agentBubble.classList.add('streaming-cursor');
    }
    return agentBubble;
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  try {
    for await (const event of generator) {
      switch (event.type) {

        case 'text': {
          const bubble = ensureAgentBubble();
          isStreaming = true;
          agentBubbleText += event.content;
          // Render with basic markdown: **bold**, newlines
          bubble.innerHTML = renderMarkdown(agentBubbleText);
          scrollToBottom();
          break;
        }

        case 'tool_call': {
          // Insert tool card before the text bubble (or at end if no bubble yet)
          const card = createToolCard(event.name, event.input, 'running');
          const wrap = document.createElement('div');
          wrap.className = 'chat-bubble-wrap agent';
          wrap.style.maxWidth = '95%';
          wrap.appendChild(card);

          if (agentBubble) {
            chatArea.insertBefore(wrap, agentBubble.closest('.chat-bubble-wrap'));
          } else {
            chatArea.appendChild(wrap);
          }

          activeToolCards[event.name] = card;
          scrollToBottom();
          break;
        }

        case 'tool_result': {
          const card = activeToolCards[event.name];
          if (card) updateToolCard(card, event.output);
          scrollToBottom();
          break;
        }

        case 'web_search': {
          const card = createSearchCard(event.query);
          const wrap = document.createElement('div');
          wrap.className = 'chat-bubble-wrap agent';
          wrap.style.maxWidth = '95%';
          wrap.appendChild(card);

          if (agentBubble) {
            chatArea.insertBefore(wrap, agentBubble.closest('.chat-bubble-wrap'));
          } else {
            chatArea.appendChild(wrap);
          }

          activeSearchCards[event.query] = card;
          scrollToBottom();
          break;
        }

        case 'web_search_result': {
          // Find the most recent search card
          const keys = Object.keys(activeSearchCards);
          const lastKey = keys[keys.length - 1];
          if (lastKey && activeSearchCards[lastKey]) {
            updateSearchCard(activeSearchCards[lastKey], event.sources);
          }
          scrollToBottom();
          break;
        }

        case 'approval_needed': {
          // Stop streaming text, insert approval prompt, pause (handled in agent.js)
          if (agentBubble) {
            agentBubble.classList.remove('streaming-cursor');
          }

          const prompt = createApprovalPrompt(event);
          const wrap = document.createElement('div');
          wrap.className = 'chat-bubble-wrap agent';
          wrap.style.maxWidth = '95%';
          wrap.appendChild(prompt);
          chatArea.appendChild(wrap);

          // Reset bubble so follow-up response goes in a new bubble
          agentBubble = null;
          agentBubbleText = '';
          scrollToBottom();
          break;
        }

        case 'done': {
          if (agentBubble) {
            agentBubble.classList.remove('streaming-cursor');
          }
          scrollToBottom();
          if (onDone) onDone();
          break;
        }

        case 'error': {
          if (agentBubble) agentBubble.classList.remove('streaming-cursor');
          const errBubble = ensureAgentBubble();
          errBubble.textContent = `Error: ${event.message ?? 'Unknown error'}`;
          errBubble.style.color = 'var(--error)';
          errBubble.classList.remove('streaming-cursor');
          scrollToBottom();
          if (onDone) onDone();
          break;
        }
      }
    }
  } catch (err) {
    if (agentBubble) agentBubble.classList.remove('streaming-cursor');
    const b = ensureAgentBubble();
    b.textContent = 'An unexpected error occurred.';
    b.style.color = 'var(--error)';
    b.classList.remove('streaming-cursor');
    if (onDone) onDone();
  }
}

export function insertThinkingIndicator(chatArea) {
  const wrap = createThinkingBubble();
  wrap.classList.add('thinking-wrap');
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
  return wrap;
}

export { removeThinkingWrap };

// -- Minimal markdown renderer (bold + line breaks) ---------------
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);font-size:0.9em;background:var(--bg-primary);padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\n/g, '<br>');
}

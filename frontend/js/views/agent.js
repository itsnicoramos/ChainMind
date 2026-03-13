/**
 * views/agent.js -- AI agent chat interface.
 */

import { chat, getSkills } from '../agent.js';
import { getSoul, updateSoul, getEventLog, relativeTime } from '../api.js';
import { createBubble } from '../components/chatBubble.js';
import { handleStream, insertThinkingIndicator, removeThinkingWrap } from '../components/streamHandler.js';
import { showToast } from '../components/toast.js';
import { initVoiceMode, destroyVoiceMode, isVoiceSupported } from '../voice/voiceMode.js';

const sessionMessages = [];
let sessionId = crypto.randomUUID();
let isStreaming = false;
let voiceActive = false;

export async function render(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'view-root';
  root.style.height = 'calc(100vh - 64px)';
  container.appendChild(root);

  root.innerHTML = `
    <div class="agent-layout">
      <!-- Chat panel -->
      <div class="chat-panel">
        <div class="chat-header">
          <div class="chat-header-left">
            <div class="chat-agent-avatar">
              <svg viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <div class="chat-agent-name">ChainMind Agent</div>
              <div class="chat-agent-status">Online &middot; claude-sonnet-4-6</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost btn-sm" id="new-session-btn" title="New conversation">
              <svg viewBox="0 0 20 20" fill="none" style="width:16px;height:16px">
                <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              New
            </button>
          </div>
        </div>

        <div class="chat-area" id="chat-area"></div>

        <div class="chat-input-bar">
          <button class="voice-toggle-btn ${isVoiceSupported() ? '' : 'hidden'}" id="voice-toggle-btn" title="Toggle voice mode">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
              <path d="M5 10a7 7 0 0014 0M12 19v3M9 22h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="chat-input-wrap" id="text-input-wrap">
            <textarea id="chat-input" rows="1" placeholder="Ask about your chain, wallet, or anything..." maxlength="2000"></textarea>
            <button class="chat-send-btn" id="send-btn">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M17 10L3 3l3 7-3 7 14-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Context sidebar -->
      <div class="context-sidebar">
        <div class="context-panel" id="soul-panel">
          <div class="context-panel-header">
            <span class="context-panel-title">Soul Memory</span>
            <button class="btn btn-ghost btn-sm" id="edit-soul-btn" style="padding:2px 6px;font-size:11px">Edit</button>
          </div>
          <div class="context-panel-body" id="soul-body">
            <div class="loading-bar"></div>
          </div>
        </div>

        <div class="context-panel">
          <div class="context-panel-header">
            <span class="context-panel-title">Skills</span>
          </div>
          <div class="context-panel-body" id="skills-body">
            <div class="loading-bar"></div>
          </div>
        </div>

        <div class="context-panel">
          <div class="context-panel-header">
            <span class="context-panel-title">Event Log</span>
          </div>
          <div class="context-panel-body" id="event-body">
            <div class="loading-bar"></div>
          </div>
        </div>

        <div class="context-panel">
          <div class="context-panel-header">
            <span class="context-panel-title">Session</span>
          </div>
          <div class="context-panel-body">
            <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono)">${sessionId.slice(0,16)}...</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px" id="session-cost">Cost: ~$0.00</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const chatArea = root.querySelector('#chat-area');
  const input    = root.querySelector('#chat-input');
  const sendBtn  = root.querySelector('#send-btn');

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  // Send on Enter (Shift+Enter = newline)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(root, input.value.trim());
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(root, input.value.trim()));

  root.querySelector('#new-session-btn').addEventListener('click', () => {
    sessionId = crypto.randomUUID();
    chatArea.innerHTML = '';
    sessionMessages.length = 0;
    showWelcomeMessage(chatArea);
    showToast('New session started', 'info');
  });

  // Voice toggle
  const voiceBtn = root.querySelector('#voice-toggle-btn');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => toggleVoice(root, voiceBtn));
  }

  // Load sidebar data
  loadSidebar(root);

  // Show welcome message
  showWelcomeMessage(chatArea);
}

function showWelcomeMessage(chatArea) {
  const { wrap, bubble } = createBubble('agent');
  bubble.innerHTML = `Hello! I'm the ChainMind agent. I can help you explore the blockchain, manage your wallet, mine blocks, and more.<br><br>What would you like to do?`;
  chatArea.appendChild(wrap);
}

async function sendMessage(root, text) {
  if (!text || isStreaming) return;

  const chatArea = root.querySelector('#chat-area');
  const input    = root.querySelector('#chat-input');
  const sendBtn  = root.querySelector('#send-btn');

  // Clear input
  input.value = '';
  input.style.height = 'auto';

  // Add user bubble
  const { wrap: userWrap, bubble: userBubble } = createBubble('user');
  userBubble.textContent = text;
  chatArea.appendChild(userWrap);
  chatArea.scrollTop = chatArea.scrollHeight;

  // Show thinking indicator
  const thinkingWrap = insertThinkingIndicator(chatArea);

  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.style.opacity = '0.5';

  try {
    const generator = chat(sessionId, text);

    // Remove thinking indicator once first event arrives
    let thinkingRemoved = false;
    const wrappedGenerator = wrapGenerator(generator, () => {
      if (!thinkingRemoved) {
        thinkingRemoved = true;
        removeThinkingWrap(thinkingWrap);
      }
    });

    await handleStream(wrappedGenerator, chatArea, () => {
      isStreaming = false;
      sendBtn.disabled = false;
      sendBtn.style.opacity = '';
      updateSessionCost(root);
    });
  } catch (err) {
    removeThinkingWrap(thinkingWrap);
    const { wrap, bubble } = createBubble('agent');
    bubble.textContent = 'An error occurred. Please try again.';
    bubble.style.color = 'var(--error)';
    chatArea.appendChild(wrap);
    isStreaming = false;
    sendBtn.disabled = false;
    sendBtn.style.opacity = '';
  }
}

// Wraps the generator to fire a callback on the first yielded event
async function* wrapGenerator(gen, onFirst) {
  let first = true;
  for await (const event of gen) {
    if (first) { first = false; onFirst(); }
    yield event;
  }
}

async function loadSidebar(root) {
  // Soul
  try {
    const soul = await getSoul();
    const soulBody = root.querySelector('#soul-body');
    if (soulBody) {
      const lines = soul.split('\n').filter(l => l.trim()).slice(0, 6);
      soulBody.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);line-height:1.6">${lines.map(l => escapeText(l)).join('<br>')}</div>
      `;
    }
  } catch {}

  // Edit soul button
  root.querySelector('#edit-soul-btn')?.addEventListener('click', () => editSoul(root));

  // Skills
  try {
    const skills = await getSkills();
    const skillsBody = root.querySelector('#skills-body');
    if (skillsBody) {
      skillsBody.innerHTML = skills.map(s =>
        `<span class="skill-tag">${escapeText(s.name.replace('_', ' '))}</span>`
      ).join('');
    }
  } catch {}

  // Event log
  try {
    const events = await getEventLog();
    const eventBody = root.querySelector('#event-body');
    if (eventBody) {
      if (events.length === 0) {
        eventBody.innerHTML = `<div style="font-size:12px;color:var(--text-dim)">No events yet</div>`;
      } else {
        eventBody.innerHTML = events.slice(0, 5).map(e => `
          <div style="font-size:11px;margin-bottom:8px">
            <div style="color:var(--text-muted)">${escapeText(e.message)}</div>
            <div style="color:var(--text-dim)">${relativeTime(e.timestamp)}</div>
          </div>
        `).join('');
      }
    }
  } catch {}
}

async function editSoul(root) {
  try {
    const soul = await getSoul();
    const { openModal, closeModal } = await import('../components/modal.js');

    const form = document.createElement('div');
    form.innerHTML = `
      <div class="modal-title">Edit Soul Memory</div>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">This content is injected into the agent system prompt at the start of every conversation.</p>
      <textarea class="form-input" id="soul-editor" rows="10" style="font-family:var(--font-mono);font-size:12px;resize:vertical">${escapeText(soul)}</textarea>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-soul">Cancel</button>
        <button class="btn btn-primary" id="save-soul">Save</button>
      </div>
    `;

    form.querySelector('#cancel-soul').addEventListener('click', closeModal);
    form.querySelector('#save-soul').addEventListener('click', async () => {
      const btn = form.querySelector('#save-soul');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        await updateSoul(form.querySelector('#soul-editor').value);
        showToast('Soul updated', 'success');
        closeModal();
        loadSidebar(root);
      } catch {
        showToast('Failed to save soul', 'error');
        btn.disabled = false;
        btn.textContent = 'Save';
      }
    });

    openModal(form);
  } catch {}
}

let msgCount = 0;
function updateSessionCost(root) {
  msgCount++;
  const estimate = (msgCount * 0.02).toFixed(2);
  const costEl = root.querySelector('#session-cost');
  if (costEl) costEl.textContent = `Cost: ~$${estimate}`;
}

function toggleVoice(root, btn) {
  voiceActive = !voiceActive;
  btn.classList.toggle('active', voiceActive);

  if (voiceActive) {
    const textWrap = root.querySelector('#text-input-wrap');
    if (textWrap) textWrap.style.display = 'none';
    initVoiceMode(root, (text) => sendMessage(root, text));
    showToast('Voice mode on', 'info');
  } else {
    const textWrap = root.querySelector('#text-input-wrap');
    if (textWrap) textWrap.style.display = '';
    destroyVoiceMode(root);
    showToast('Voice mode off', 'info');
  }
}

function escapeText(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

export function cleanup() {
  isStreaming = false;
  voiceActive = false;
  destroyVoiceMode(document.getElementById('content'));
}

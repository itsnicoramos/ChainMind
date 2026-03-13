# ChainMind

**An AI-agent blockchain platform. Chat with your chain. Talk to your coins.**

fouder: Nico Ramos | Computer Science and Econ Student at VIU 
[ChainMind Repository](https://github.com/itsnicoramos/ChainMind)
website link coming soon
---

## What is ChainMind?

ChainMind is a blockchain platform with a conversational AI layer built directly into its core. Instead of interacting with a blockchain through raw commands, technical dashboards, or developer tooling, users interact through natural language — by talking to an intelligent agent that understands the chain, manages wallets, executes transactions, and automates operations on their behalf.

The platform targets two audiences: technically sophisticated users who want efficiency, and non-technical users who want accessibility. Both groups can operate a full blockchain node, mine blocks, send coins, and analyze on-chain data through a single conversational interface, either by typing or by speaking.

ChainMind is not a wrapper on top of an existing chain. It is a purpose-built blockchain with an AI agent designed from the ground up to be the primary interface.

---

## Brand Identity

**Name:** ChainMind
**Tagline:** "Your blockchain, with a brain."

### Visual Identity

| Element | Specification |
|---------|---------------|
| Primary mark | The letters CM as a single continuous stroke — the bottom curve of the C flows into the top of the M, forming one unbroken chain-like ligature |
| Icon mark | A single chain link with a neural pulse running through it — a glowing signal traveling along the link like electricity through a circuit |
| Primary color | Electric cyan `#00e5ff` on near-black `#0a0a0f` |
| Typography | Bold geometric sans-serif for the wordmark (Satoshi, General Sans, or Clash Display) |
| Favicon | The chain-link-with-pulse icon, simplified for 16x16 rendering |

### Color System

```
--bg-primary:       #0a0a0f    Near-black base
--bg-surface:       #12121a    Card and panel surfaces
--bg-elevated:      #1a1a2e    Hover states and active panels
--accent:           #00e5ff    Primary cyan
--accent-glow:      #00e5ff33  Accent at 20% opacity for glows
--accent-secondary: #7c3aed    Violet for secondary actions
--text-primary:     #f0f0f5    Main text
--text-muted:       #6b7280    Secondary text
--text-mono:        #a5b4fc    Hashes, addresses, and code
--success:          #10b981    Confirmed, mined, connected
--warning:          #f59e0b    Approval needed, pending
--error:            #ef4444    Failed, denied, error
--border-subtle:    #ffffff08  Ultra-subtle 1-2% white borders
```

### Typography

```
--font-display:  'Clash Display', sans-serif    Headings and stat numbers
--font-body:     'General Sans', sans-serif     Body text and UI
--font-mono:     'JetBrains Mono', monospace    Hashes, addresses, code, tool output
```

### Design Principles

- Dark mode primary with light mode as a toggle
- No hard borders — ultra-subtle box-shadow with colored glow on hover
- Rounded corners: 12–16px on cards, 8px on buttons
- Backdrop blur on overlapping panels
- CSS `oklch()` color space for perceptually even gradients
- `View Transition API` for smooth view swaps
- Large bold stat numbers (48–64px) for dashboard metrics
- Monospaced font for all hashes and addresses with truncation and copy-on-click

---

## System Architecture

ChainMind is composed of three independent layers: a static frontend served globally via CDN, a serverless AI agent layer, and a persistent Python blockchain backend running on a VPS. Each layer has a clearly defined responsibility and communicates with the others over HTTP.

```
┌──────────────────────────────────────────────────────────────────┐
│                      NETLIFY (hosted)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   STATIC FRONTEND                          │  │
│  │              Served from /frontend                         │  │
│  │                                                            │  │
│  │  Dashboard | Wallet | Miner | Network | Agent Chat | Auto  │  │
│  │                                                            │  │
│  │  Voice: Web Speech API (SpeechRecognition + Synthesis)     │  │
│  │                         |                                  │  │
│  │                   fetch("/api/*")                          │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
│                            |                                     │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │            NETLIFY FUNCTIONS (/api)                        │  │
│  │            Node.js serverless runtime                      │  │
│  │                                                            │  │
│  │  agent-chat.mjs ──── Claude Sonnet 4.6 + Web Search       │  │
│  │  agent-approve.mjs    agent-deny.mjs                       │  │
│  │  agent-conversations.mjs    agent-soul.mjs                 │  │
│  │  agent-skills.mjs     agent-rules.mjs                      │  │
│  │  agent-rule-history.mjs     agent-events.mjs               │  │
│  │                         |                                  │  │
│  │  Shared: claude-client / skill-loader / tool-proxy /       │  │
│  │          permissions / sse-helpers / cost-tracker          │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────────┘
                             |  HTTP (tool calls + data)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                 PYTHON BACKEND (VPS)                             │
│                                                                  │
│  FastAPI --- Blockchain / Miner / Operator / Node                │
│              Agent Data: Soul / Conversations / Rules / Events   │
│              Background: Automation rule runner (asyncio)        │
│                              |                                   │
│  SQLite --- blocks, transactions, wallets, peers                 │
│             agent_conversations, agent_soul, agent_rules,        │
│             agent_rule_executions, agent_event_log               │
└──────────────────────────────────────────────────────────────────┘
```

### What Runs Where

| Component | Runs On | Reason |
|-----------|---------|--------|
| Static frontend (HTML/CSS/JS) | Netlify CDN | Free global edge hosting, zero configuration |
| AI agent functions (Claude API calls + web search) | Netlify Functions | Stateless, scales to zero, API key stays server-side |
| Blockchain engine (Python/FastAPI) | VPS (DigitalOcean, Linode, or local) | Long-running, stateful, manages SQLite and peer connections |
| SQLite database | VPS, co-located with backend | No separate database server required |
| Automation rule runner | VPS asyncio background task | Requires a persistent background process |
| Skill definitions | Netlify repo (bundled) | Read by functions at cold start, versioned in git |
| Voice input and output | Browser (client-side) | Web Speech API — zero cost, zero dependencies |
| Soul memory | SQLite on VPS | Persistent across sessions |

---

## Complete Project Structure

```
chainmind/
│
├── netlify.toml                            Project configuration
│   ├── publish = "frontend"
│   ├── functions = "netlify/functions"
│   ├── NODE_VERSION = "20"
│   └── Redirect rules:
│       ├── /api/*          → Netlify Functions
│       ├── /blockchain/*   → Python VPS
│       ├── /operator/*     → Python VPS
│       ├── /miner/*        → Python VPS
│       └── /node/*         → Python VPS
│
├── package.json
│   └── @anthropic-ai/sdk                   Claude Sonnet 4.6 SDK
│
├── .env.example
│   ├── ANTHROPIC_API_KEY
│   ├── PYTHON_BACKEND_URL
│   ├── AGENT_MAX_TOOL_LOOPS = 10
│   └── AGENT_DEFAULT_MODEL = claude-sonnet-4-6
│
│
│   ── FRONTEND ──────────────────────────────────────────────────
│   Static site served by Netlify CDN
│
├── frontend/
│   │
│   ├── index.html                          Single-page application shell
│   │   ├── Sidebar navigation (Dashboard, Wallet, Miner,
│   │   │   Network, Agent, Automation)
│   │   ├── Node selector dropdown
│   │   ├── Theme toggle (dark / light)
│   │   └── Dynamic content area
│   │
│   ├── css/
│   │   └── style.css
│   │       ├── CSS custom properties (all design tokens)
│   │       ├── Layout (sidebar, content area, card grid)
│   │       ├── Dashboard (stats bar, chain strip, block cards)
│   │       ├── Wallet (selector, address rows, send form)
│   │       ├── Miner (mine button, difficulty meter, nonce counter)
│   │       ├── Agent chat (bubbles, tool cards, approval prompts,
│   │       │   streaming cursor, context sidebar)
│   │       ├── Voice mode (mic button states, waveform rings,
│   │       │   composing bubble, voice toggle)
│   │       ├── Automation (rule cards, execution timeline,
│   │       │   new rule form)
│   │       └── Components (toasts, modals, hash display, tx rows)
│   │
│   ├── js/
│   │   │
│   │   ├── app.js                          Application init, routing, global state
│   │   │   ├── State: currentView, backendUrl, sessionId, theme, voiceEnabled
│   │   │   ├── Router: hash-based (#/dashboard, #/wallet, #/miner,
│   │   │   │   #/network, #/agent, #/automation)
│   │   │   ├── Theme toggle with localStorage persistence
│   │   │   └── Node selector for switching backend URLs
│   │   │
│   │   ├── api.js                          All Python backend API calls
│   │   │   ├── Blockchain: getBlocks, getBlockByHash, getLatestBlock,
│   │   │   │   getTransaction, getPendingTransactions, getUnspentOutputs
│   │   │   ├── Operator: createWallet, listWallets, createAddress,
│   │   │   │   listAddresses, getBalance, sendTransaction
│   │   │   ├── Miner: mine(minerAddress)
│   │   │   └── Node: getPeers, addPeer, getConfirmations
│   │   │
│   │   ├── agent.js                        All Netlify Function calls (AI agent)
│   │   │   ├── Chat: chat (SSE stream), approveAction, denyAction
│   │   │   ├── Memory: getConversations, getConversation, getSoul, updateSoul
│   │   │   ├── Skills: getSkills
│   │   │   └── Automation: getRules, createRule, updateRule,
│   │   │       deleteRule, getRuleHistory, getEventLog
│   │   │
│   │   ├── views/
│   │   │   ├── dashboard.js                Blockchain explorer + live stats
│   │   │   │   ├── Stats bar: total blocks, pending transactions,
│   │   │   │   │   difficulty, total supply, peer count
│   │   │   │   ├── Chain strip: horizontally scrollable connected
│   │   │   │   │   block cards with animated gradient connectors
│   │   │   │   ├── Latest transactions: auto-refreshing list
│   │   │   │   ├── Network health: peer count, sync status
│   │   │   │   └── Auto-refresh: poll every 10 seconds
│   │   │   │
│   │   │   ├── wallet.js                   Wallet management
│   │   │   │   ├── Create wallet form with password input
│   │   │   │   ├── Wallet selector dropdown
│   │   │   │   ├── Address list with balances and copy button
│   │   │   │   ├── Generate address button
│   │   │   │   └── Send coins form with fee preview
│   │   │   │
│   │   │   ├── miner.js                    Mining interface
│   │   │   │   ├── Large accent mine button with loading state
│   │   │   │   ├── Reward address selector
│   │   │   │   ├── Live mempool count
│   │   │   │   ├── Difficulty display with next increase block
│   │   │   │   ├── Animated nonce counter during mining
│   │   │   │   └── Recent mined blocks with reward transactions
│   │   │   │
│   │   │   ├── network.js                  Peer management
│   │   │   │   ├── Peer list with URL, last seen, status dot
│   │   │   │   ├── Add peer form
│   │   │   │   └── Sync status: local height vs peer heights
│   │   │   │
│   │   │   ├── transaction.js              Transaction detail view
│   │   │   │   ├── Search by transaction hash
│   │   │   │   ├── Input/output flow diagram
│   │   │   │   └── Live confirmation count
│   │   │   │
│   │   │   ├── agent.js                    AI agent chat interface
│   │   │   │   ├── Scrolling message history with auto-scroll
│   │   │   │   ├── Text input mode (default)
│   │   │   │   ├── Voice input mode (mic button replaces text input)
│   │   │   │   ├── Voice toggle in header
│   │   │   │   ├── SSE character-by-character stream rendering
│   │   │   │   ├── Inline collapsible tool call cards
│   │   │   │   ├── Web search cards with source links
│   │   │   │   ├── Approval prompts (amber glow, approve/deny)
│   │   │   │   ├── Session switcher (tabs or dropdown)
│   │   │   │   └── Context sidebar: soul summary, active rules,
│   │   │   │       event log, loaded skills, session cost estimate
│   │   │   │
│   │   │   └── automation.js               Automation rule manager
│   │   │       ├── Rule list: name, trigger, action, toggle, status
│   │   │       ├── New rule form: trigger type → condition →
│   │   │       │   skill + tool + parameters
│   │   │       ├── Per-rule execution timeline (expandable history)
│   │   │       └── Global event log: chronological audit
│   │   │
│   │   ├── components/
│   │   │   ├── blockCard.js                Single block display
│   │   │   ├── txRow.js                    Transaction list row
│   │   │   ├── toast.js                    Notification popups
│   │   │   │                               (success, error, info — auto-dismiss 5s)
│   │   │   ├── modal.js                    Reusable modal with backdrop blur
│   │   │   ├── chatBubble.js               Chat message bubble
│   │   │   │                               (user: right-aligned; agent: left with
│   │   │   │                               accent border gradient; markdown-lite)
│   │   │   ├── toolCallCard.js             Inline tool execution display
│   │   │   │                               (collapsible, JSON-highlighted input/output)
│   │   │   ├── webSearchCard.js            Inline web search display
│   │   │   │                               (query text, clickable source links)
│   │   │   ├── approvalPrompt.js           Write action confirmation
│   │   │   │                               (plain-English description, params,
│   │   │   │                               approve/deny — pauses stream until resolved)
│   │   │   ├── ruleCard.js                 Automation rule display
│   │   │   │                               (status dot, enable/disable toggle,
│   │   │   │                               last execution, expandable history)
│   │   │   ├── streamHandler.js            SSE parser for agent responses
│   │   │   │   └── Event types handled:
│   │   │   │       text, tool_call, tool_result, web_search,
│   │   │   │       web_search_result, approval_needed, done, error
│   │   │   ├── micButton.js                Animated microphone button
│   │   │   │                               (states: idle, listening, speaking, error)
│   │   │   └── waveform.js                 CSS expanding ring animation around mic
│   │   │
│   │   └── voice/
│   │       ├── speechInput.js              Microphone to text (SpeechRecognition API)
│   │       │   ├── Lang: en-US, continuous: false, interimResults: true
│   │       │   ├── Interim transcript shown in composing bubble (gray)
│   │       │   ├── Final transcript auto-submitted to agent
│   │       │   └── Error handling: not-allowed, no-speech, network, aborted
│   │       │
│   │       ├── speechOutput.js             Text to speech (SpeechSynthesis API)
│   │       │   ├── Selects best English voice by default
│   │       │   ├── Splits long responses by sentence for queued utterances
│   │       │   ├── Skips tool call JSON and raw technical output
│   │       │   ├── Skips web search result dumps (reads summary only)
│   │       │   └── User can select preferred voice (saved to localStorage)
│   │       │
│   │       └── voiceMode.js                Full voice conversation orchestrator
│   │           ├── Feature detection for both SpeechRecognition
│   │           │   and SpeechSynthesis — hides toggle if unsupported
│   │           ├── Conversation loop:
│   │           │   1. User presses mic
│   │           │   2. speechInput captures and transcribes
│   │           │   3. Text submitted to agent-chat endpoint
│   │           │   4. Response streams in (rendered in chat)
│   │           │   5. speechOutput reads response aloud
│   │           │   6. Mic automatically reopens for next turn
│   │           ├── Interrupt: click during TTS cancels speech and reopens mic
│   │           ├── Voice approvals: TTS reads action aloud, user says
│   │           │   "yes"/"approve" or "no"/"deny" to resolve
│   │           └── Fallback: voice toggle hidden if unsupported;
│   │               text chat always available
│   │
│   └── assets/
│       ├── favicon.svg                     Chain-link-with-pulse icon
│       ├── logo.svg                        Full CM wordmark
│       └── og-image.png                    Social preview image (1200x630)
│
│
│   ── NETLIFY FUNCTIONS ─────────────────────────────────────────
│   AI agent serverless layer
│
├── netlify/
│   └── functions/
│       │
│       ├── agent-chat.mjs                  Main agent endpoint (SSE streaming)
│       │   │
│       │   ├── 1. Parse request
│       │   │   └── Extract: session_id, message, backend_url
│       │   │
│       │   ├── 2. Load context from Python backend
│       │   │   ├── GET {backend}/agent/soul          → soul markdown
│       │   │   └── GET {backend}/agent/conversations/{session} → last 50 messages
│       │   │
│       │   ├── 3. Load skills
│       │   │   └── skill-loader scans /skills/*/SKILL.md + tools.json
│       │   │
│       │   ├── 4. Build Claude request
│       │   │   ├── model: claude-sonnet-4-6
│       │   │   ├── max_tokens: 4096
│       │   │   ├── stream: true
│       │   │   ├── system: soul + all SKILL.md files concatenated
│       │   │   ├── tools: web_search_20250305 (built-in) + all skill tools
│       │   │   └── messages: history + new user message
│       │   │
│       │   ├── 5. Handle response stream
│       │   │   ├── text block       → SSE: { type: "text", content: chunk }
│       │   │   ├── web search       → SSE: { type: "web_search", query }
│       │   │   ├── search result    → SSE: { type: "web_search_result", sources }
│       │   │   ├── tool_use (read)  → auto-execute via tool-proxy, stream result
│       │   │   └── tool_use (write) → pause, emit approval_needed, wait for
│       │   │                          agent-approve or agent-deny
│       │   │
│       │   ├── 6. Finalize
│       │   │   ├── SSE: { type: "done" }
│       │   │   ├── POST conversation to Python for persistence
│       │   │   └── Log token and search costs via cost-tracker
│       │   │
│       │   └── Loop continues until Claude returns final text
│       │       Maximum iterations: AGENT_MAX_TOOL_LOOPS (default 10)
│       │
│       ├── agent-approve.mjs               Approve a pending write action
│       │   ├── Validate action_id is pending
│       │   ├── Execute: proxy held tool call to Python backend
│       │   ├── Resume Claude with tool result
│       │   └── Log approval event to Python /agent/events
│       │
│       ├── agent-deny.mjs                  Deny a pending write action
│       │   ├── Validate action_id
│       │   ├── Feed denial to Claude: tool_result = "User denied this action"
│       │   ├── Resume Claude to generate alternative response
│       │   └── Log denial event to Python /agent/events
│       │
│       ├── agent-conversations.mjs         List and retrieve conversation history
│       ├── agent-soul.mjs                  Read and update soul memory
│       ├── agent-skills.mjs                List available skills and tools
│       ├── agent-rules.mjs                 CRUD operations for automation rules
│       ├── agent-rule-history.mjs          Execution history for a specific rule
│       ├── agent-events.mjs                Full audit event log
│       │
│       └── utils/
│           ├── claude-client.mjs           Anthropic SDK wrapper
│           │   ├── model: claude-sonnet-4-6
│           │   ├── max_tokens: 4096
│           │   └── temperature: 0.7
│           │
│           ├── skill-loader.mjs            Reads and caches skills at cold start
│           │   ├── scanSkills(): walks /skills/*, reads SKILL.md + tools.json
│           │   ├── buildSystemPrompt(soul): concatenates soul + all SKILL.md files
│           │   ├── buildToolsList(): merges all tools.json into Claude tools format,
│           │   │   appends built-in web_search_20250305 tool
│           │   └── Skills are loaded once per cold start, cached in memory
│           │
│           ├── tool-proxy.mjs              Maps tool calls to Python backend HTTP requests
│           │   │
│           │   ├── TOOL_ENDPOINT_MAP:
│           │   │   ├── get_all_blocks           → GET  /blockchain/blocks
│           │   │   ├── get_block_by_hash        → GET  /blockchain/blocks/{hash}
│           │   │   ├── get_latest_block         → GET  /blockchain/blocks/latest
│           │   │   ├── get_transaction          → GET  /blockchain/blocks/{hash}/transactions/{txId}
│           │   │   ├── get_pending_transactions → GET  /blockchain/transactions
│           │   │   ├── get_unspent_outputs      → GET  /blockchain/transactions/unspent?address=
│           │   │   ├── get_confirmations        → GET  /node/transactions/{txId}/confirmations
│           │   │   ├── create_wallet            → POST /operator/wallets
│           │   │   ├── list_wallets             → GET  /operator/wallets
│           │   │   ├── create_address           → POST /operator/wallets/{id}/addresses
│           │   │   ├── list_addresses           → GET  /operator/wallets/{id}/addresses
│           │   │   ├── get_balance              → GET  /operator/wallets/{id}/addresses/{addr}/balance
│           │   │   ├── send_transaction         → POST /operator/wallets/{id}/transactions
│           │   │   ├── mine_block               → POST /miner/mine
│           │   │   ├── list_peers               → GET  /node/peers
│           │   │   ├── add_peer                 → POST /node/peers
│           │   │   ├── get_total_supply         → GET  /blockchain/stats/supply
│           │   │   ├── get_richest_addresses    → GET  /blockchain/stats/richest
│           │   │   ├── get_address_history      → GET  /blockchain/stats/address/{addr}
│           │   │   ├── get_block_stats          → GET  /blockchain/stats/blocks
│           │   │   ├── get_transaction_volume   → GET  /blockchain/stats/volume
│           │   │   ├── get_difficulty           → GET  /miner/difficulty
│           │   │   ├── create_rule              → POST /agent/rules
│           │   │   ├── list_rules               → GET  /agent/rules
│           │   │   ├── update_rule              → PUT  /agent/rules/{id}
│           │   │   ├── delete_rule              → DELETE /agent/rules/{id}
│           │   │   └── get_rule_history         → GET  /agent/rules/{id}/history
│           │   │
│           │   └── executeToolCall(name, input, backendUrl)
│           │       Resolves path parameters from input, makes HTTP request, returns JSON
│           │
│           ├── permissions.mjs             Permission tier logic
│           │   ├── READ_ONLY   → auto-execute without user approval
│           │   │   get_*, list_*, get_balance, get_difficulty
│           │   ├── WRITE       → pause stream, emit approval_needed, wait for user
│           │   │   send_transaction, create_wallet, create_address,
│           │   │   add_peer, create_rule, update_rule, delete_rule
│           │   ├── AUTO        → execute without approval only if auto-mode enabled
│           │   │   mine_block
│           │   └── BLOCKED     → always denied
│           │       replace_chain
│           │
│           ├── sse-helpers.mjs             SSE stream formatting utilities
│           │   ├── sendTextChunk(res, text)
│           │   ├── sendToolCall(res, data)
│           │   ├── sendToolResult(res, data)
│           │   ├── sendWebSearch(res, query)
│           │   ├── sendWebSearchResult(res, sources)
│           │   ├── sendApprovalNeeded(res, action)
│           │   ├── sendDone(res)
│           │   └── sendError(res, message)
│           │
│           └── cost-tracker.mjs            API and search cost tracking per session
│               ├── logSearchUsage(sessionId)
│               ├── logTokenUsage(sessionId, inputTokens, outputTokens)
│               └── getSessionCost(sessionId)
│                   Calculates: (search count x $0.01) + token costs
│
│
│   ── SKILLS ─────────────────────────────────────────────────────
│   Modular AI capability definitions
│
├── skills/
│   │
│   ├── blockchain_explorer/
│   │   ├── SKILL.md        Instructs Claude how to present block data,
│   │   │                   truncate hashes, order results chronologically
│   │   └── tools.json      get_all_blocks, get_block_by_hash,
│   │                       get_latest_block, get_transaction,
│   │                       get_unspent_outputs, get_confirmations
│   │
│   ├── wallet_manager/
│   │   ├── SKILL.md        Password handling rules, balance display in coins
│   │   │                   (satoshi conversion), privacy constraints
│   │   └── tools.json      create_wallet, list_wallets, create_address,
│   │                       list_addresses, get_balance
│   │
│   ├── transaction_sender/
│   │   ├── SKILL.md        Pre-send balance check, explicit user confirmation,
│   │   │                   fee explanation, change amount display
│   │   └── tools.json      send_transaction, get_utxos_for_address
│   │
│   ├── miner_control/
│   │   ├── SKILL.md        Block reward rules, difficulty progression,
│   │   │                   pending transaction check before mining
│   │   └── tools.json      mine_block, get_pending_transactions, get_difficulty
│   │
│   ├── network_admin/
│   │   ├── SKILL.md        Peer addition behavior, chain sync rules,
│   │   │                   low-peer-count security warning
│   │   └── tools.json      list_peers, add_peer, get_sync_status
│   │
│   ├── chain_analyst/
│   │   ├── SKILL.md        On-chain data analysis: supply, richest addresses,
│   │   │                   address activity, block and transaction statistics
│   │   └── tools.json      get_total_supply, get_richest_addresses,
│   │                       get_address_history, get_block_stats,
│   │                       get_transaction_volume
│   │
│   ├── auto_trader/
│   │   ├── SKILL.md        Automation rule explanation requirements,
│   │   │                   trigger types (threshold, schedule, event),
│   │   │                   execution logging and auditing rules
│   │   └── tools.json      create_rule, list_rules, update_rule,
│   │                       delete_rule, get_rule_history
│   │
│   └── web_researcher/
│       ├── SKILL.md        Guidelines for using Claude's built-in web search:
│       │                   when to search, how to cite sources, how to
│       │                   combine live data with on-chain context
│       └── tools.json      web_search (built-in Claude tool, no custom endpoint)
│
│
│   ── PYTHON BACKEND ──────────────────────────────────────────────
│   Blockchain node — runs on VPS
│
└── backend/
    │
    ├── main.py                             FastAPI app entry point
    │   └── Mounts all routers, starts automation runner background task
    │
    ├── blockchain/
    │   ├── chain.py                        Core blockchain logic
    │   │   ├── Block validation and proof-of-work
    │   │   ├── Chain integrity verification
    │   │   ├── UTXO model for unspent outputs
    │   │   └── Difficulty: exponential increase every 5 blocks (power of 5)
    │   │
    │   ├── transaction.py                  Transaction construction and validation
    │   │   ├── Input/output structure
    │   │   ├── Fee transaction (1 satoshi)
    │   │   └── Coinbase/reward transaction (50 coins)
    │   │
    │   ├── miner.py                        Proof-of-work mining
    │   │   ├── Nonce iteration until hash meets difficulty target
    │   │   ├── Up to 2 pending transactions per block
    │   │   └── Always includes fee tx + reward tx
    │   │
    │   └── routes.py                       FastAPI router: /blockchain/*
    │       GET  /blocks
    │       GET  /blocks/latest
    │       GET  /blocks/{hash}
    │       GET  /blocks/{hash}/transactions/{txId}
    │       GET  /transactions            (pending mempool)
    │       GET  /transactions/unspent    (UTXO set by address)
    │       GET  /stats/supply
    │       GET  /stats/richest
    │       GET  /stats/address/{addr}
    │       GET  /stats/blocks
    │       GET  /stats/volume
    │
    ├── operator/
    │   ├── wallet.py                       HD wallet implementation
    │   │   ├── Password-encrypted key storage
    │   │   └── Address derivation from seed
    │   │
    │   └── routes.py                       FastAPI router: /operator/*
    │       GET  /wallets
    │       POST /wallets
    │       GET  /wallets/{id}/addresses
    │       POST /wallets/{id}/addresses
    │       GET  /wallets/{id}/addresses/{addr}/balance
    │       POST /wallets/{id}/transactions
    │
    ├── node/
    │   ├── peer.py                         Peer-to-peer networking
    │   │   ├── Peer discovery and registration
    │   │   ├── Chain sync: longest valid chain wins
    │   │   └── Block propagation to peers
    │   │
    │   └── routes.py                       FastAPI router: /node/*
    │       GET  /peers
    │       POST /peers
    │       GET  /transactions/{txId}/confirmations
    │
    ├── miner/
    │   └── routes.py                       FastAPI router: /miner/*
    │       POST /mine
    │       GET  /difficulty
    │
    ├── agent/
    │   ├── soul.py                         Soul memory read/write
    │   ├── conversations.py                Conversation persistence
    │   ├── rules.py                        Automation rule CRUD
    │   ├── events.py                       Audit event log
    │   ├── automation_runner.py            Background asyncio task
    │   │   ├── Polls active rules on interval
    │   │   ├── Evaluates trigger conditions against live chain data
    │   │   ├── Executes tool calls when conditions are met
    │   │   └── Logs every execution to agent_rule_executions table
    │   │
    │   └── routes.py                       FastAPI router: /agent/*
    │       GET  /soul
    │       PUT  /soul
    │       GET  /conversations
    │       GET  /conversations/{session_id}
    │       POST /conversations/{session_id}
    │       GET  /rules
    │       POST /rules
    │       PUT  /rules/{id}
    │       DELETE /rules/{id}
    │       GET  /rules/{id}/history
    │       GET  /events
    │       POST /events
    │
    └── db/
        ├── database.py                     SQLite connection and session management
        ├── models.py                       SQLAlchemy table definitions
        │   ├── blocks
        │   ├── transactions
        │   ├── wallets
        │   ├── peers
        │   ├── agent_conversations
        │   ├── agent_soul
        │   ├── agent_rules
        │   ├── agent_rule_executions
        │   └── agent_event_log
        └── migrations.py                   Schema creation and versioning
```

---

## Data Flow: A User Sends Coins via Voice

This walkthrough illustrates how all three layers cooperate for a single user action.

```
User speaks:  "Send 10 coins to address abc123"
     |
     ▼
[Browser]
speechInput.js       Records audio via Web Speech API
                     Transcribes: "Send 10 coins to address abc123"
                     Submits to agent.js chat()
     |
     ▼
[Netlify Function: agent-chat.mjs]
1.  Loads soul memory + conversation history from Python backend
2.  Loads skill definitions (transaction_sender SKILL.md + tools.json)
3.  Sends message to Claude Sonnet 4.6 with full context
4.  Claude decides to call: get_balance (to check funds first)
     |
     ▼
[permissions.mjs]    get_balance → READ_ONLY → auto-execute
[tool-proxy.mjs]     GET /operator/wallets/{id}/addresses/{addr}/balance
[Python backend]     Returns: { balance: 15000000000 } (15 coins in satoshis)
     |
     ▼
[agent-chat.mjs]     Feeds balance result back to Claude
                     Claude decides to call: send_transaction
[permissions.mjs]    send_transaction → WRITE → emit approval_needed
     |
     ▼
[SSE to browser]     { type: "approval_needed",
                       action_id: "act_xyz",
                       description: "Send 10 coins to address abc123",
                       params: { to: "abc123", amount: 10 } }
     |
     ▼
[Browser]
voiceMode.js         speechOutput.js reads aloud:
                     "I want to send 10 coins to address abc123. Approve?"
                     speechInput.js listens for: "yes" or "approve"
     |
     ▼
[Browser → Netlify Function: agent-approve.mjs]
                     Validates action_id, executes tool call
                     POST /operator/wallets/{id}/transactions → Python backend
                     Python creates, signs, and broadcasts transaction
                     Returns: { transaction_id: "tx_abc..." }
     |
     ▼
[agent-approve.mjs]  Feeds tool result to Claude
                     Claude generates: "Done. 10 coins sent. Transaction ID: tx_abc..."
     |
     ▼
[SSE to browser]     { type: "text", content: "Done. 10 coins sent..." }
                     { type: "done" }
     |
     ▼
[Browser]
speechOutput.js      Reads response aloud
voiceMode.js         Automatically reopens mic for next turn
```

---

## Agent Intelligence Layer

The agent is powered by Claude Sonnet 4.6. Its behavior is shaped by two inputs loaded at the start of every conversation: the soul and the loaded skill set.

### Soul Memory

The soul is a persistent markdown document stored in SQLite on the Python backend. It is loaded at the start of every agent conversation and injected as part of the system prompt. The soul can contain the user's preferences, the agent's personality, operational rules, and any context the user wants the agent to maintain across sessions. Users can edit it directly from the frontend.

### Skills

Skills are modular capability bundles stored as folders in `/skills/`. Each skill contains:

- `SKILL.md` — a plain-English instruction document appended to the system prompt
- `tools.json` — tool definitions in Claude's tool use format

Skills are loaded at function cold start and cached in memory. The agent gains capabilities by having skill folders present in the repository. Adding a new skill folder gives the agent access to new tools and new behavioral instructions without touching any other code.

### Permission System

Every tool the agent can call is assigned a permission tier before any conversation begins:

| Tier | Behavior | Examples |
|------|----------|---------|
| READ_ONLY | Execute automatically, no user approval | get_balance, list_wallets, get_all_blocks |
| WRITE | Pause stream, request explicit user approval | send_transaction, create_wallet, add_peer |
| AUTO | Execute automatically only if auto-mode is enabled by user | mine_block |
| BLOCKED | Always denied, never executed | replace_chain |

### Automation Rules

Users can instruct the agent to create background automation rules that run persistently on the Python backend. Rules are evaluated by an asyncio background task and consist of:

- **Trigger**: threshold (a chain metric crosses a value), schedule (time interval), or event (on-chain occurrence)
- **Condition**: the specific value or state to evaluate
- **Action**: the skill and tool to invoke, with parameters

Every rule execution is logged to the `agent_rule_executions` table and surfaced in the automation view's execution timeline.

---

## Python Backend Detail

The Python backend is a FastAPI application that runs on a VPS. It is responsible for the blockchain state machine, wallet management, peer networking, and all persistent agent data.

### Blockchain Model

- Proof-of-work consensus with SHA-256 hashing
- UTXO (Unspent Transaction Output) model — no account balances, only spendable outputs
- Every block contains up to 2 regular transactions, one fee transaction, and one block reward transaction
- Block reward: 50 coins
- Transaction fee: 1 satoshi
- Difficulty: exponential, increases by a factor of 5 every 5 blocks
- Peer-to-peer chain sync: the node always adopts the longest valid chain from connected peers

### Database Schema

All data is stored in a single SQLite file co-located with the backend process.

| Table | Purpose |
|-------|---------|
| blocks | Block headers and metadata |
| transactions | All confirmed transactions |
| wallets | Encrypted wallet records |
| peers | Known peer node URLs and status |
| agent_conversations | Full message history per session |
| agent_soul | Current soul markdown content |
| agent_rules | Active and inactive automation rules |
| agent_rule_executions | Per-execution log for every rule run |
| agent_event_log | Chronological audit log of all agent actions |

---

## Setup

### Prerequisites

- Node.js 20 or later
- Python 3.11 or later
- A Netlify account
- An Anthropic API key


### Netlify Deployment

1. Link the repository to a new Netlify site
2. Set the following environment variables in the Netlify dashboard:

```
ANTHROPIC_API_KEY       Your Anthropic API key
PYTHON_BACKEND_URL      The public URL of your Python backend (e.g. https://your-vps.example.com)
AGENT_MAX_TOOL_LOOPS    10
AGENT_DEFAULT_MODEL     claude-sonnet-4-6
```

3. Deploy. Netlify will build and publish the frontend and activate the serverless functions automatically.

### First Run

1. Open the deployed URL
2. Navigate to Wallet and create your first wallet with a password
3. Generate an address for that wallet
4. Navigate to Miner, select the address, and mine your first block to receive the 50-coin reward
5. Navigate to Agent and ask: "What is my current balance?"

---

## Running Multiple Nodes

Multiple Python backend instances can run on separate machines or ports to form a peer-to-peer network.

```bash
# Node 1 — port 8000
uvicorn main:app --port 8000

# Node 2 — port 8001
uvicorn main:app --port 8001
```

From the Network view, add Node 2 as a peer of Node 1 by entering its URL. Chain sync is automatic — the node with the longest valid chain propagates it to its peers.

The frontend's node selector dropdown allows switching between backend URLs without reloading the page, enabling a single frontend instance to inspect and operate multiple nodes.

---

## Adding Custom Skills

To give the agent a new capability, create a folder in `/skills/` with two files:

```
skills/
└── your_skill_name/
    ├── SKILL.md        Plain-English instructions for Claude
    └── tools.json      Tool definitions in Claude tool use format
```

`SKILL.md` content is appended to the agent's system prompt. `tools.json` defines the tools Claude can call, which must map to entries in `tool-proxy.mjs`'s `TOOL_ENDPOINT_MAP` if they require backend calls.

Deploy to Netlify to activate the new skill. No other configuration is required.

---

## Cost Estimation

ChainMind uses two paid external services: the Anthropic API and Claude's built-in web search.

| Usage | Cost |
|-------|------|
| Claude Sonnet 4.6 input tokens | $3.00 per million tokens |
| Claude Sonnet 4.6 output tokens | $15.00 per million tokens |
| Web search per query | $0.01 per use (max 5 per conversation turn) |

A typical blockchain query (e.g., "show me the last 5 blocks and their transactions") consumes approximately 2,000–4,000 input tokens and 500–1,000 output tokens, costing under $0.02. A conversation with multiple tool calls and a web search typically costs $0.05–$0.15.

Session cost estimates are tracked per conversation and displayed in the agent view's context sidebar.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS, JavaScript (ES modules, no framework) |
| AI agent functions | Node.js 20, Netlify Functions, Anthropic SDK |
| AI model | Claude Sonnet 4.6 (claude-sonnet-4-6) |
| Voice interface | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Blockchain backend | Python 3.11, FastAPI, SQLAlchemy |
| Database | SQLite |
| Hosting | Netlify (frontend + functions), VPS (backend) |
| CSS color space | oklch() for perceptually uniform gradients |
| View transitions | View Transition API for smooth navigation |



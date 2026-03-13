/**
 * api.js -- All calls to the Python blockchain backend.
 *
 * In mock mode (no backend), every function returns from MOCK_DB.
 * Swap the implementations here when the backend is ready.
 */

const MOCK_DELAY = 120; // ms

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -- Utilities ------------------------------------------------

export function formatHash(hash, start = 6, end = 4) {
  if (!hash || hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

export function satoshiToCoins(satoshi) {
  return (satoshi / 1e9).toFixed(4);
}

export function coinsToSatoshi(coins) {
  return Math.round(parseFloat(coins) * 1e9);
}

export function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// -- Mock data seed -------------------------------------------

function mkHash(seed) {
  let h = '';
  const chars = '0123456789abcdef';
  // Deterministic-looking hash based on seed string
  let x = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = 0; i < 64; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    h += chars[x % 16];
  }
  return h;
}

function mkAddr(suffix) {
  return `CM1${mkHash('addr' + suffix).slice(0, 31)}`;
}

const WALLET_A_ID  = 'wlt_9f2a3b';
const WALLET_B_ID  = 'wlt_c741e0';
const ADDR_A1 = mkAddr('a1');
const ADDR_A2 = mkAddr('a2');
const ADDR_B1 = mkAddr('b1');

function buildGenesis() {
  const hash = mkHash('genesis');
  return {
    index: 0,
    hash,
    previousHash: '0'.repeat(64),
    timestamp: Date.now() - 15 * 120000,
    nonce: 0,
    difficulty: 1,
    transactions: [
      {
        id: mkHash('genesis-reward'),
        type: 'reward',
        inputs:  [],
        outputs: [{ address: ADDR_A1, amount: 50000000000 }],
        timestamp: Date.now() - 15 * 120000,
      }
    ]
  };
}

function buildBlock(index, prevHash, age, addressBook) {
  const hash = mkHash(`block-${index}`);
  const ts   = Date.now() - age;
  const txs  = [];

  // Reward tx every block
  const miner = addressBook[index % addressBook.length];
  txs.push({
    id: mkHash(`reward-${index}`),
    type: 'reward',
    inputs:  [],
    outputs: [{ address: miner, amount: 50000000000 }],
    timestamp: ts,
  });

  // Include 1-2 regular transfers for most blocks
  if (index > 2 && index % 3 !== 0) {
    const from = addressBook[(index + 1) % addressBook.length];
    const to   = addressBook[(index + 2) % addressBook.length];
    const amt  = (index * 137 % 20 + 1) * 1000000000;
    txs.push({
      id: mkHash(`tx-regular-${index}`),
      type: 'regular',
      inputs:  [{ address: from, amount: amt + 1 }],
      outputs: [{ address: to, amount: amt }],
      timestamp: ts + 200,
    });
    // Fee tx
    txs.push({
      id: mkHash(`tx-fee-${index}`),
      type: 'fee',
      inputs:  [{ address: from, amount: 1 }],
      outputs: [{ address: miner, amount: 1 }],
      timestamp: ts + 200,
    });
  }

  return { index, hash, previousHash: prevHash, timestamp: ts, nonce: index * 84731, difficulty: Math.pow(5, Math.floor(index / 5)), transactions: txs };
}

const ADDRESS_BOOK = [ADDR_A1, ADDR_A2, ADDR_B1];

function seedBlocks() {
  const blocks = [];
  const genesis = buildGenesis();
  blocks.push(genesis);
  for (let i = 1; i <= 12; i++) {
    const prev = blocks[blocks.length - 1];
    blocks.push(buildBlock(i, prev.hash, (13 - i) * 120000 + Math.random() * 30000, ADDRESS_BOOK));
  }
  return blocks;
}

// The in-memory database -- all mutations go here
const MOCK_DB = {
  blocks: seedBlocks(),

  pendingTxs: [
    {
      id: mkHash('pending-1'),
      type: 'regular',
      inputs:  [{ address: ADDR_A1, amount: 5000000001 }],
      outputs: [{ address: ADDR_B1, amount: 5000000000 }],
      timestamp: Date.now() - 45000,
    },
    {
      id: mkHash('pending-2'),
      type: 'regular',
      inputs:  [{ address: ADDR_B1, amount: 3000000001 }],
      outputs: [{ address: ADDR_A2, amount: 3000000000 }],
      timestamp: Date.now() - 12000,
    },
  ],

  wallets: [
    { id: WALLET_A_ID, addresses: [ADDR_A1, ADDR_A2] },
    { id: WALLET_B_ID, addresses: [ADDR_B1] },
  ],

  balances: {
    [ADDR_A1]: 285000000000,
    [ADDR_A2]:  50000000000,
    [ADDR_B1]: 135000000000,
  },

  peers: [
    { url: 'http://node2.chainmind.local:8001', lastSeen: Date.now() - 8000,  status: 'connected' },
    { url: 'http://node3.chainmind.local:8002', lastSeen: Date.now() - 22000, status: 'connected' },
    { url: 'http://archive.chainmind.local:9000', lastSeen: Date.now() - 3600000, status: 'stale' },
  ],

  soul: `# Agent Soul

You are the ChainMind agent. You help users interact with the ChainMind blockchain.

## Personality
- Professional but approachable
- Precise with numbers (always show full amounts, not rounded)
- Proactively check balances before sending transactions
- Never repeat or log passwords

## Rules
- Always confirm destination address before sending
- Warn users when difficulty increases are approaching
- Keep responses concise unless user asks for detail
`,

  conversations: {},

  rules: [
    {
      id: 'rule_001',
      name: 'Auto-mine when mempool fills',
      trigger: 'threshold',
      condition: 'pendingTxs >= 2',
      action: 'mine_block',
      actionParams: { minerAddress: ADDR_A1 },
      enabled: true,
      lastRun: Date.now() - 7200000,
      lastStatus: 'success',
    },
    {
      id: 'rule_002',
      name: 'Alert when peer count drops',
      trigger: 'threshold',
      condition: 'peers < 2',
      action: 'notify',
      actionParams: { message: 'Peer count is low' },
      enabled: false,
      lastRun: null,
      lastStatus: null,
    },
  ],

  ruleHistory: {
    rule_001: [
      { timestamp: Date.now() - 7200000,  status: 'success', output: 'Block 11 mined' },
      { timestamp: Date.now() - 14400000, status: 'success', output: 'Block 8 mined' },
      { timestamp: Date.now() - 21600000, status: 'error',   output: 'Mining failed: no pending txs' },
    ]
  },

  eventLog: [
    { timestamp: Date.now() - 7200000,  type: 'rule_exec',   message: 'Rule "Auto-mine" triggered and succeeded' },
    { timestamp: Date.now() - 86400000, type: 'agent_action', message: 'User approved: send_transaction (5 coins)' },
    { timestamp: Date.now() - 90000000, type: 'agent_deny',   message: 'User denied: add_peer (unknown host)' },
  ],
};

// -- Blockchain endpoints ----------------------------------------

export async function getBlocks() {
  await delay(MOCK_DELAY);
  return [...MOCK_DB.blocks];
}

export async function getLatestBlock() {
  await delay(MOCK_DELAY);
  return MOCK_DB.blocks[MOCK_DB.blocks.length - 1];
}

export async function getBlockByHash(hash) {
  await delay(MOCK_DELAY);
  return MOCK_DB.blocks.find(b => b.hash === hash) ?? null;
}

export async function getTransaction(blockHash, txId) {
  await delay(MOCK_DELAY);
  const block = MOCK_DB.blocks.find(b => b.hash === blockHash);
  if (!block) return null;
  return block.transactions.find(t => t.id === txId) ?? null;
}

export async function getPendingTransactions() {
  await delay(MOCK_DELAY);
  return [...MOCK_DB.pendingTxs];
}

export async function getUnspentOutputs(address) {
  await delay(MOCK_DELAY);
  const balance = MOCK_DB.balances[address] ?? 0;
  return [{ address, amount: balance }];
}

export async function getStats() {
  await delay(MOCK_DELAY);
  const totalSupply = MOCK_DB.blocks.length * 50;
  return {
    totalBlocks:  MOCK_DB.blocks.length,
    pendingTxs:   MOCK_DB.pendingTxs.length,
    difficulty:   MOCK_DB.blocks[MOCK_DB.blocks.length - 1].difficulty,
    totalSupply,
    peerCount:    MOCK_DB.peers.filter(p => p.status === 'connected').length,
  };
}

export async function getTotalSupply() {
  await delay(MOCK_DELAY);
  return MOCK_DB.blocks.length * 50;
}

export async function getRichestAddresses() {
  await delay(MOCK_DELAY);
  return Object.entries(MOCK_DB.balances)
    .map(([address, amount]) => ({ address, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getAddressHistory(address) {
  await delay(MOCK_DELAY);
  const txs = [];
  for (const block of MOCK_DB.blocks) {
    for (const tx of block.transactions) {
      const involved = [...tx.inputs, ...tx.outputs].some(io => io.address === address);
      if (involved) txs.push({ ...tx, blockIndex: block.index, blockHash: block.hash });
    }
  }
  return txs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getDifficulty() {
  await delay(MOCK_DELAY);
  const latest = MOCK_DB.blocks[MOCK_DB.blocks.length - 1];
  const nextIncrease = Math.ceil(MOCK_DB.blocks.length / 5) * 5;
  return {
    current: latest.difficulty,
    nextIncreaseAtBlock: nextIncrease,
    blocksUntilIncrease: nextIncrease - MOCK_DB.blocks.length,
  };
}

// -- Operator endpoints ------------------------------------------

export async function listWallets() {
  await delay(MOCK_DELAY);
  return MOCK_DB.wallets.map(w => ({
    id: w.id,
    addressCount: w.addresses.length,
    totalBalance: w.addresses.reduce((sum, a) => sum + (MOCK_DB.balances[a] ?? 0), 0),
  }));
}

export async function createWallet(_password) {
  await delay(MOCK_DELAY * 3);
  const id = `wlt_${mkHash('new' + Date.now()).slice(0, 6)}`;
  const wallet = { id, addresses: [] };
  MOCK_DB.wallets.push(wallet);
  return { id };
}

export async function listAddresses(walletId) {
  await delay(MOCK_DELAY);
  const wallet = MOCK_DB.wallets.find(w => w.id === walletId);
  if (!wallet) throw new Error('Wallet not found');
  return wallet.addresses.map(a => ({
    address: a,
    balance: MOCK_DB.balances[a] ?? 0,
  }));
}

export async function createAddress(walletId, _password) {
  await delay(MOCK_DELAY * 2);
  const wallet = MOCK_DB.wallets.find(w => w.id === walletId);
  if (!wallet) throw new Error('Wallet not found');
  const newAddr = mkAddr(`new-${Date.now()}`);
  wallet.addresses.push(newAddr);
  MOCK_DB.balances[newAddr] = 0;
  return { address: newAddr };
}

export async function getBalance(walletId, address) {
  await delay(MOCK_DELAY);
  const wallet = MOCK_DB.wallets.find(w => w.id === walletId);
  if (!wallet || !wallet.addresses.includes(address)) throw new Error('Address not found in wallet');
  return { balance: MOCK_DB.balances[address] ?? 0 };
}

export async function sendTransaction({ walletId, fromAddress, toAddress, amount, _password }) {
  await delay(MOCK_DELAY * 4);
  const satoshis = typeof amount === 'number' ? amount : coinsToSatoshi(amount);
  const balance  = MOCK_DB.balances[fromAddress] ?? 0;
  if (balance < satoshis + 1) throw new Error('Insufficient balance');

  MOCK_DB.balances[fromAddress] = (MOCK_DB.balances[fromAddress] ?? 0) - satoshis - 1;

  const txId = mkHash('tx-' + Date.now());
  MOCK_DB.pendingTxs.push({
    id: txId,
    type: 'regular',
    inputs:  [{ address: fromAddress, amount: satoshis + 1 }],
    outputs: [{ address: toAddress, amount: satoshis }],
    timestamp: Date.now(),
  });

  return { transactionId: txId };
}

// -- Miner endpoint ----------------------------------------------

export async function mine(minerAddress) {
  await delay(2200); // Simulate real mining time
  const latest   = MOCK_DB.blocks[MOCK_DB.blocks.length - 1];
  const newIndex = latest.index + 1;
  const newHash  = mkHash(`mined-${newIndex}-${Date.now()}`);
  const ts       = Date.now();

  const txs = [];

  // Pull up to 2 pending txs
  const pulled = MOCK_DB.pendingTxs.splice(0, 2);
  txs.push(...pulled);

  // Fee tx (1 satoshi for each pulled tx)
  if (pulled.length > 0) {
    txs.push({
      id: mkHash(`fee-${newIndex}`),
      type: 'fee',
      inputs:  [{ address: 'mempool', amount: pulled.length }],
      outputs: [{ address: minerAddress, amount: pulled.length }],
      timestamp: ts,
    });
  }

  // Reward tx
  txs.push({
    id: mkHash(`reward-${newIndex}`),
    type: 'reward',
    inputs:  [],
    outputs: [{ address: minerAddress, amount: 50000000000 }],
    timestamp: ts,
  });

  // Update miner balance
  MOCK_DB.balances[minerAddress] = (MOCK_DB.balances[minerAddress] ?? 0) + 50000000000 + pulled.length;

  const difficulty = Math.pow(5, Math.floor(newIndex / 5));
  const block = {
    index: newIndex,
    hash: newHash,
    previousHash: latest.hash,
    timestamp: ts,
    nonce: Math.floor(Math.random() * 9999999),
    difficulty,
    transactions: txs,
  };

  MOCK_DB.blocks.push(block);

  // Add one fresh pending tx after mining so the pool isn't empty
  if (MOCK_DB.pendingTxs.length === 0) {
    const addrs = Object.keys(MOCK_DB.balances);
    if (addrs.length >= 2) {
      MOCK_DB.pendingTxs.push({
        id: mkHash('auto-pending-' + Date.now()),
        type: 'regular',
        inputs:  [{ address: addrs[0], amount: 2000000001 }],
        outputs: [{ address: addrs[1], amount: 2000000000 }],
        timestamp: Date.now(),
      });
    }
  }

  return { block };
}

// -- Node endpoints ----------------------------------------------

export async function getPeers() {
  await delay(MOCK_DELAY);
  return [...MOCK_DB.peers];
}

export async function addPeer(url) {
  await delay(MOCK_DELAY * 2);
  const exists = MOCK_DB.peers.some(p => p.url === url);
  if (exists) throw new Error('Peer already added');
  MOCK_DB.peers.push({ url, lastSeen: Date.now(), status: 'connected' });
  return { success: true };
}

export async function getConfirmations(txId) {
  await delay(MOCK_DELAY);
  for (let i = 0; i < MOCK_DB.blocks.length; i++) {
    const block = MOCK_DB.blocks[i];
    const found = block.transactions.some(t => t.id === txId);
    if (found) {
      return { confirmations: MOCK_DB.blocks.length - i, blockIndex: i };
    }
  }
  return { confirmations: 0, blockIndex: null };
}

// -- Agent data endpoints ----------------------------------------

export async function getSoul() {
  await delay(MOCK_DELAY);
  return MOCK_DB.soul;
}

export async function updateSoul(content) {
  await delay(MOCK_DELAY);
  MOCK_DB.soul = content;
  return { success: true };
}

export async function getConversations() {
  await delay(MOCK_DELAY);
  return Object.entries(MOCK_DB.conversations).map(([sessionId, msgs]) => ({
    sessionId,
    messageCount: msgs.length,
    lastMessage: msgs[msgs.length - 1]?.timestamp ?? 0,
  }));
}

export async function getConversation(sessionId) {
  await delay(MOCK_DELAY);
  return MOCK_DB.conversations[sessionId] ?? [];
}

export async function saveConversation(sessionId, messages) {
  MOCK_DB.conversations[sessionId] = messages;
}

export async function getRules() {
  await delay(MOCK_DELAY);
  return [...MOCK_DB.rules];
}

export async function createRule(rule) {
  await delay(MOCK_DELAY);
  const newRule = { ...rule, id: `rule_${mkHash(Date.now().toString()).slice(0, 6)}`, lastRun: null, lastStatus: null };
  MOCK_DB.rules.push(newRule);
  return newRule;
}

export async function updateRule(id, data) {
  await delay(MOCK_DELAY);
  const idx = MOCK_DB.rules.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Rule not found');
  MOCK_DB.rules[idx] = { ...MOCK_DB.rules[idx], ...data };
  return MOCK_DB.rules[idx];
}

export async function deleteRule(id) {
  await delay(MOCK_DELAY);
  const idx = MOCK_DB.rules.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Rule not found');
  MOCK_DB.rules.splice(idx, 1);
  return { success: true };
}

export async function getRuleHistory(ruleId) {
  await delay(MOCK_DELAY);
  return MOCK_DB.ruleHistory[ruleId] ?? [];
}

export async function getEventLog() {
  await delay(MOCK_DELAY);
  return [...MOCK_DB.eventLog].sort((a, b) => b.timestamp - a.timestamp);
}

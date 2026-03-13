/**
 * agent.js -- Mock AI agent with streaming simulation.
 *
 * Simulates the Netlify Function SSE protocol:
 *   { type: 'text', content }
 *   { type: 'tool_call', name, input }
 *   { type: 'tool_result', name, output }
 *   { type: 'web_search', query }
 *   { type: 'web_search_result', sources }
 *   { type: 'approval_needed', actionId, description, params }
 *   { type: 'done' }
 *   { type: 'error', message }
 *
 * chat() returns an async generator that yields event objects.
 */

import { getStats, getBlocks, listWallets, getSoul } from './api.js';

const CHAR_DELAY    = 16;  // ms per character (~60 chars/sec)
const TOOL_DELAY    = 500; // ms for a tool call to "execute"
const THINK_DELAY   = 600; // ms before first response token

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function* streamText(text) {
  for (const char of text) {
    yield { type: 'text', content: char };
    await sleep(CHAR_DELAY);
  }
}

// -- Response scripts keyed by intent ---------------------------

const RESPONSES = {
  balance: async function*(params) {
    const wallets = await listWallets();
    const total   = wallets.reduce((s, w) => s + w.totalBalance, 0);
    const coins   = (total / 1e9).toFixed(4);

    yield { type: 'tool_call', name: 'list_wallets', input: {} };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'list_wallets', output: { wallets } };
    await sleep(300);

    yield* streamText(`Your wallets currently hold a combined balance of ${coins} CMC.\n\nBreakdown:\n`);
    for (const w of wallets) {
      const c = (w.totalBalance / 1e9).toFixed(4);
      yield* streamText(`- ${w.id}: ${c} CMC across ${w.addressCount} address${w.addressCount !== 1 ? 'es' : ''}\n`);
    }
    yield* streamText('\nLet me know if you want to see individual address balances or send coins.');
  },

  blocks: async function*(params) {
    const blocks = await getBlocks();
    const latest = blocks[blocks.length - 1];

    yield { type: 'tool_call', name: 'get_all_blocks', input: {} };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'get_all_blocks', output: { count: blocks.length } };
    await sleep(300);

    yield* streamText(`The chain currently has ${blocks.length} confirmed blocks.\n\n`);
    yield* streamText(`Latest block:\n`);
    yield* streamText(`- Index: ${latest.index}\n`);
    yield* streamText(`- Hash: ${latest.hash.slice(0,8)}...${latest.hash.slice(-4)}\n`);
    yield* streamText(`- Transactions: ${latest.transactions.length}\n`);
    yield* streamText(`- Difficulty: ${latest.difficulty}\n\n`);
    yield* streamText('Would you like to see the full chain history or details on a specific block?');
  },

  send: async function*(params) {
    // First do a read (auto-executes, no approval needed)
    yield { type: 'tool_call', name: 'get_balance', input: { address: 'your address' } };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'get_balance', output: { balance: 285000000000 } };
    await sleep(400);

    yield* streamText('I checked your balance: 285.0000 CMC available.\n\n');

    // Now the write operation triggers approval
    const actionId = `action_${Date.now()}`;
    yield {
      type: 'approval_needed',
      actionId,
      description: 'Send 10 CMC from your primary address to the specified destination. This action will create a pending transaction on the network.',
      params: {
        tool: 'send_transaction',
        from: 'CM1' + '9f2a3b'.padEnd(31, '0'),
        to: '(destination address)',
        amount: '10 CMC',
        fee: '1 satoshi',
      },
    };
    // Stream pauses here -- streamHandler resolves the approval
    yield { type: '_await_approval', actionId };
  },

  send_approved: async function*(params) {
    yield { type: 'tool_call', name: 'send_transaction', input: { amount: 10 } };
    await sleep(TOOL_DELAY * 2);
    yield { type: 'tool_result', name: 'send_transaction', output: { transactionId: 'tx_' + Math.random().toString(16).slice(2,10) } };
    await sleep(400);
    yield* streamText('Transaction submitted successfully. The transaction is now in the mempool and will be included in the next mined block.\n\nYou will receive 49 CMC in change (after the 1 satoshi fee). Mine a block to confirm it.');
  },

  send_denied: async function*(params) {
    yield* streamText('Understood, the transaction was not sent. Let me know if you want to try a different amount or address.');
  },

  mine: async function*(params) {
    const stats = await getStats();

    yield { type: 'tool_call', name: 'get_pending_transactions', input: {} };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'get_pending_transactions', output: { count: stats.pendingTxs } };
    await sleep(300);

    yield* streamText(`There are currently ${stats.pendingTxs} pending transaction${stats.pendingTxs !== 1 ? 's' : ''} in the mempool.\n\n`);

    const actionId = `action_mine_${Date.now()}`;
    yield {
      type: 'approval_needed',
      actionId,
      description: `Mine a new block that will include ${stats.pendingTxs} pending transaction(s). You will receive the 50 CMC block reward plus any transaction fees.`,
      params: {
        tool: 'mine_block',
        minerAddress: 'your primary address',
        pendingTxs: stats.pendingTxs,
        reward: '50 CMC',
      },
    };
    yield { type: '_await_approval', actionId };
  },

  mine_approved: async function*(params) {
    yield { type: 'tool_call', name: 'mine_block', input: { minerAddress: '...' } };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'mine_block', output: { blockIndex: 'new block', reward: '50 CMC' } };
    await sleep(400);
    yield* streamText('Block mined successfully! The 50 CMC reward has been added to your address balance. The chain now has one additional confirmed block.\n\nNavigate to the Dashboard to see it in the chain strip.');
  },

  network: async function*(params) {
    yield { type: 'tool_call', name: 'list_peers', input: {} };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'list_peers', output: { peers: ['node2', 'node3'] } };
    await sleep(300);

    yield* streamText('The network currently has 2 connected peers:\n\n');
    yield* streamText('- node2.chainmind.local:8001 -- connected\n');
    yield* streamText('- node3.chainmind.local:8002 -- connected\n\n');
    yield* streamText('The network is healthy. Chain sync uses the longest valid chain rule, so your node automatically adopts the best chain from peers.\n\nWould you like to add a new peer?');
  },

  search: async function*(params) {
    const query = params.query ?? 'blockchain technology overview';

    yield { type: 'web_search', query };
    await sleep(800);
    yield {
      type: 'web_search_result',
      sources: [
        { title: 'What is Blockchain? -- IBM', url: 'https://www.ibm.com/topics/blockchain' },
        { title: 'Blockchain Basics -- Investopedia', url: 'https://www.investopedia.com/terms/b/blockchain.asp' },
        { title: 'How Proof of Work Functions', url: 'https://en.bitcoin.it/wiki/Proof_of_work' },
      ],
    };
    await sleep(400);

    yield* streamText('Based on the search results:\n\n');
    yield* streamText('A blockchain is a distributed ledger that records transactions across a network of computers. Each block in the chain contains a cryptographic hash of the previous block, a timestamp, and transaction data.\n\n');
    yield* streamText('ChainMind uses proof-of-work consensus where miners compete to find a nonce that produces a hash meeting the current difficulty target. Difficulty increases exponentially every 5 blocks (factor of 5) to maintain consistent block production.\n\n');
    yield* streamText('Is there a specific aspect of blockchain technology you want to explore further?');
  },

  create_wallet: async function*(params) {
    const actionId = `action_wallet_${Date.now()}`;
    yield* streamText('I can create a new wallet for you. Please note:\n\n');
    yield* streamText('- Your password encrypts the private key -- it cannot be recovered if lost\n');
    yield* streamText('- Store your password somewhere safe\n\n');

    yield {
      type: 'approval_needed',
      actionId,
      description: 'Create a new encrypted wallet. You will need to provide a password to protect the private key.',
      params: { tool: 'create_wallet', warning: 'Password cannot be recovered if lost' },
    };
    yield { type: '_await_approval', actionId };
  },

  create_wallet_approved: async function*(params) {
    yield { type: 'tool_call', name: 'create_wallet', input: { password: '****' } };
    await sleep(TOOL_DELAY * 2);
    const id = 'wlt_' + Math.random().toString(16).slice(2, 8);
    yield { type: 'tool_result', name: 'create_wallet', output: { walletId: id } };
    await sleep(400);
    yield* streamText(`Wallet created. Your new wallet ID is: ${id}\n\nNext step: generate an address for this wallet so you can start receiving coins. Would you like me to do that now?`);
  },

  stats: async function*(params) {
    const stats = await getStats();

    yield { type: 'tool_call', name: 'get_stats', input: {} };
    await sleep(TOOL_DELAY);
    yield { type: 'tool_result', name: 'get_stats', output: stats };
    await sleep(300);

    yield* streamText(`Current ChainMind network stats:\n\n`);
    yield* streamText(`- Total blocks: ${stats.totalBlocks}\n`);
    yield* streamText(`- Pending transactions: ${stats.pendingTxs}\n`);
    yield* streamText(`- Current difficulty: ${stats.difficulty}\n`);
    yield* streamText(`- Total supply mined: ${stats.totalSupply} CMC\n`);
    yield* streamText(`- Connected peers: ${stats.peerCount}\n`);
  },

  default: async function*(params) {
    yield* streamText("I'm the ChainMind agent. I can help you with:\n\n");
    yield* streamText('- **Check balances** -- ask about your wallet\n');
    yield* streamText('- **Explore the chain** -- view blocks and transactions\n');
    yield* streamText('- **Send coins** -- transfer CMC between addresses\n');
    yield* streamText('- **Mine blocks** -- mine new blocks and earn rewards\n');
    yield* streamText('- **Network info** -- view peers and sync status\n');
    yield* streamText('- **Web search** -- ask me to look something up\n\n');
    yield* streamText('What would you like to do?');
  },
};

// -- Intent detection -------------------------------------------

function detectIntent(message) {
  const msg = message.toLowerCase();
  if (msg.includes('balance') || msg.includes('how much') || msg.includes('coins do i'))    return 'balance';
  if (msg.includes('block') && (msg.includes('show') || msg.includes('list') || msg.includes('chain') || msg.includes('how many'))) return 'blocks';
  if (msg.includes('send') || msg.includes('transfer') || msg.includes('pay'))              return 'send';
  if (msg.includes('mine') || msg.includes('mining'))                                       return 'mine';
  if (msg.includes('peer') || msg.includes('network') || msg.includes('node'))              return 'network';
  if (msg.includes('search') || msg.includes('look up') || msg.includes('what is') || msg.includes('explain')) return 'search';
  if (msg.includes('create wallet') || msg.includes('new wallet'))                         return 'create_wallet';
  if (msg.includes('stat') || msg.includes('overview') || msg.includes('status'))          return 'stats';
  return 'default';
}

// -- Approval state management -----------------------------------

const pendingApprovals = new Map();

export function resolveApproval(actionId, approved) {
  const resolver = pendingApprovals.get(actionId);
  if (resolver) {
    pendingApprovals.delete(actionId);
    resolver(approved);
  }
}

// -- Main chat function ------------------------------------------

export async function* chat(sessionId, userMessage) {
  await sleep(THINK_DELAY);

  const intent = detectIntent(userMessage);
  const generator = RESPONSES[intent] ?? RESPONSES.default;

  // Handle search query extraction
  const searchMatch = userMessage.match(/(?:search|look up|find|what is|explain)\s+(.+)/i);
  const params = {
    query: searchMatch ? searchMatch[1] : userMessage,
  };

  for await (const event of generator(params)) {
    if (event.type === '_await_approval') {
      // Pause the stream until user approves or denies
      const approved = await new Promise(resolve => {
        pendingApprovals.set(event.actionId, resolve);
      });

      // Resume with appropriate follow-up
      const followUp = approved
        ? RESPONSES[intent + '_approved'] ?? RESPONSES.default
        : RESPONSES[intent + '_denied'] ?? RESPONSES.send_denied;

      for await (const followEvent of followUp(params)) {
        yield followEvent;
      }
      break;
    }

    yield event;
  }

  yield { type: 'done' };
}

// -- Agent context data -----------------------------------------

export async function getSkills() {
  return [
    { name: 'blockchain_explorer', description: 'Explore blocks and transactions', tools: ['get_all_blocks', 'get_block_by_hash', 'get_latest_block', 'get_transaction'] },
    { name: 'wallet_manager',      description: 'Manage wallets and addresses',    tools: ['create_wallet', 'list_wallets', 'create_address', 'get_balance'] },
    { name: 'transaction_sender',  description: 'Send coins between addresses',    tools: ['send_transaction'] },
    { name: 'miner_control',       description: 'Control block mining',            tools: ['mine_block', 'get_pending_transactions', 'get_difficulty'] },
    { name: 'network_admin',       description: 'Manage peer connections',         tools: ['list_peers', 'add_peer'] },
    { name: 'chain_analyst',       description: 'Analyze on-chain data',           tools: ['get_total_supply', 'get_richest_addresses', 'get_block_stats'] },
    { name: 'web_researcher',      description: 'Search the web for context',      tools: ['web_search'] },
  ];
}

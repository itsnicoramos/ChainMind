import hashlib
import json
import time

SATOSHIS_PER_COIN = 100_000_000
BLOCK_REWARD = 50 * SATOSHIS_PER_COIN
TX_FEE = 1  # 1 satoshi


def make_tx_id(*parts) -> str:
    """Deterministically hash a set of parts into a transaction ID."""
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()


def create_coinbase_tx(miner_address: str, height: int) -> dict:
    """Create a block-reward (coinbase) transaction for the given miner."""
    tx_id = make_tx_id("coinbase", miner_address, height, time.time())
    return {
        "tx_id": tx_id,
        "tx_type": "reward",
        "from_address": None,
        "to_address": miner_address,
        "amount": BLOCK_REWARD,
        "timestamp": time.time(),
    }


def create_fee_tx(from_address: str, miner_address: str) -> dict:
    """Create a 1-satoshi fee transaction paid from the sender to the miner."""
    tx_id = make_tx_id("fee", from_address, miner_address, time.time())
    return {
        "tx_id": tx_id,
        "tx_type": "fee",
        "from_address": from_address,
        "to_address": miner_address,
        "amount": TX_FEE,
        "timestamp": time.time(),
    }


def create_regular_tx(from_address: str, to_address: str, amount: int) -> dict:
    """Create a standard peer-to-peer transaction."""
    tx_id = make_tx_id("tx", from_address, to_address, amount, time.time())
    return {
        "tx_id": tx_id,
        "tx_type": "regular",
        "from_address": from_address,
        "to_address": to_address,
        "amount": amount,
        "timestamp": time.time(),
    }

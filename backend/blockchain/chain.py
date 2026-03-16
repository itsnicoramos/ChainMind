import hashlib
import json
import time
from typing import Optional

from sqlalchemy.orm import Session

from db.models import Block as BlockModel, Transaction as TxModel, UTXO
from blockchain.transaction import create_coinbase_tx, BLOCK_REWARD


def compute_difficulty(height: int) -> int:
    """Difficulty increases exponentially: 1 leading zero per 5 blocks, capped at 8."""
    zeros = min(1 + (height // 5), 8)
    return zeros


def compute_hash(block_dict: dict) -> str:
    """SHA-256 hash of a canonically serialised block dictionary."""
    block_str = json.dumps(block_dict, sort_keys=True)
    return hashlib.sha256(block_str.encode()).hexdigest()


def get_chain(db: Session) -> list:
    """Return all blocks ordered by height ascending."""
    from db.models import Block
    return db.query(Block).order_by(Block.height).all()


def get_latest_block(db: Session):
    """Return the block at the tip of the chain."""
    from db.models import Block
    return db.query(Block).order_by(Block.height.desc()).first()


def get_block_by_hash(db: Session, block_hash: str):
    """Return a single block by its hash, or None."""
    from db.models import Block
    return db.query(Block).filter(Block.hash == block_hash).first()


def is_valid_proof(block_hash: str, difficulty: int) -> bool:
    """Check that the hash satisfies the required leading-zeros target."""
    return block_hash.startswith("0" * difficulty)


def validate_chain(blocks) -> bool:
    """Walk the chain and verify hash linkage and proof-of-work for every block."""
    for i in range(1, len(blocks)):
        current = blocks[i]
        previous = blocks[i - 1]
        block_dict = {
            "previous_hash": current.previous_hash,
            "timestamp": current.timestamp,
            "nonce": current.nonce,
            "height": current.height,
        }
        if not is_valid_proof(compute_hash(block_dict), current.difficulty):
            return False
        if current.previous_hash != previous.hash:
            return False
    return True


def create_genesis_block(db: Session):
    """Mine and persist block 0 (genesis) with a coinbase reward to 'genesis'."""
    from db.models import Block, Transaction

    genesis_tx = create_coinbase_tx("genesis", 0)
    block_dict = {"previous_hash": "0" * 64, "timestamp": 0.0, "nonce": 0, "height": 0}
    block_hash = compute_hash(block_dict)

    block = Block(
        hash=block_hash,
        previous_hash="0" * 64,
        timestamp=0.0,
        nonce=0,
        difficulty=1,
        miner_address="genesis",
        height=0,
    )
    db.add(block)
    db.flush()

    tx = Transaction(
        tx_id=genesis_tx["tx_id"],
        block_hash=block_hash,
        tx_type="reward",
        from_address=None,
        to_address="genesis",
        amount=BLOCK_REWARD,
        timestamp=0.0,
    )
    db.add(tx)

    utxo = UTXO(
        tx_id=genesis_tx["tx_id"],
        output_index=0,
        address="genesis",
        amount=BLOCK_REWARD,
        spent=False,
    )
    db.add(utxo)
    db.commit()
    return block


def ensure_genesis(db: Session):
    """Create the genesis block if the chain is empty."""
    from db.models import Block
    if db.query(Block).count() == 0:
        create_genesis_block(db)


def get_utxos_for_address(db: Session, address: str) -> list:
    """Return all unspent outputs belonging to an address."""
    return db.query(UTXO).filter(UTXO.address == address, UTXO.spent == False).all()


def get_balance(db: Session, address: str) -> int:
    """Return the confirmed balance (in satoshis) for an address."""
    utxos = get_utxos_for_address(db, address)
    return sum(u.amount for u in utxos)


def get_total_supply(db: Session) -> int:
    """Return the total number of satoshis ever minted via block rewards."""
    from db.models import Transaction
    total = db.query(Transaction).filter(Transaction.tx_type == "reward").all()
    return sum(t.amount for t in total)


def get_richest_addresses(db: Session, limit: int = 10) -> list:
    """Return the top addresses by confirmed UTXO balance."""
    from sqlalchemy import func

    result = (
        db.query(UTXO.address, func.sum(UTXO.amount).label("balance"))
        .filter(UTXO.spent == False)
        .group_by(UTXO.address)
        .order_by(func.sum(UTXO.amount).desc())
        .limit(limit)
        .all()
    )
    return [{"address": r.address, "balance": r.balance} for r in result]


def get_address_history(db: Session, address: str) -> list:
    """Return all transactions where the address is sender or receiver."""
    from db.models import Transaction

    txs = db.query(Transaction).filter(
        (Transaction.from_address == address) | (Transaction.to_address == address)
    ).order_by(Transaction.timestamp.desc()).all()
    return txs


def get_block_stats(db: Session) -> dict:
    """Return aggregate statistics about the chain."""
    from db.models import Block

    blocks = db.query(Block).all()
    return {
        "total_blocks": len(blocks),
        "latest_height": max((b.height for b in blocks), default=0),
        "avg_difficulty": sum(b.difficulty for b in blocks) / max(len(blocks), 1),
    }


def get_transaction_volume(db: Session) -> dict:
    """Return the count and total volume of regular (non-coinbase) transactions."""
    from db.models import Transaction

    txs = db.query(Transaction).filter(Transaction.tx_type == "regular").all()
    return {
        "total_transactions": len(txs),
        "total_volume": sum(t.amount for t in txs),
    }

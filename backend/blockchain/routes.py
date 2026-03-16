from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Block, Transaction, UTXO, PendingTransaction
from blockchain.chain import (
    get_chain,
    get_latest_block,
    get_block_by_hash,
    get_total_supply,
    get_richest_addresses,
    get_address_history,
    get_block_stats,
    get_transaction_volume,
    get_utxos_for_address,
)

router = APIRouter(prefix="/blockchain", tags=["blockchain"])


# ---------------------------------------------------------------------------
# Helper serialisers
# ---------------------------------------------------------------------------

def _serialise_tx(tx: Transaction) -> dict:
    return {
        "id": tx.id,
        "tx_id": tx.tx_id,
        "block_hash": tx.block_hash,
        "tx_type": tx.tx_type,
        "from_address": tx.from_address,
        "to_address": tx.to_address,
        "amount": tx.amount,
        "timestamp": tx.timestamp,
    }


def _serialise_block(block: Block, db: Session) -> dict:
    txs = db.query(Transaction).filter(Transaction.block_hash == block.hash).all()
    return {
        "id": block.id,
        "hash": block.hash,
        "previous_hash": block.previous_hash,
        "timestamp": block.timestamp,
        "nonce": block.nonce,
        "difficulty": block.difficulty,
        "miner_address": block.miner_address,
        "height": block.height,
        "transactions": [_serialise_tx(t) for t in txs],
    }


# ---------------------------------------------------------------------------
# Block endpoints
# ---------------------------------------------------------------------------

@router.get("/blocks")
def list_blocks(db: Session = Depends(get_db)):
    """Return all blocks with their transactions, ordered by height ascending."""
    blocks = get_chain(db)
    return [_serialise_block(b, db) for b in blocks]


@router.get("/blocks/latest")
def latest_block(db: Session = Depends(get_db)):
    """Return the current chain tip."""
    block = get_latest_block(db)
    if block is None:
        raise HTTPException(status_code=404, detail="No blocks found")
    return _serialise_block(block, db)


@router.get("/blocks/{block_hash}")
def get_block(block_hash: str, db: Session = Depends(get_db)):
    """Return a single block by its hash."""
    block = get_block_by_hash(db, block_hash)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    return _serialise_block(block, db)


@router.get("/blocks/{block_hash}/transactions/{tx_id}")
def get_transaction_in_block(block_hash: str, tx_id: str, db: Session = Depends(get_db)):
    """Return a single transaction that belongs to the specified block."""
    block = get_block_by_hash(db, block_hash)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    tx = (
        db.query(Transaction)
        .filter(Transaction.block_hash == block_hash, Transaction.tx_id == tx_id)
        .first()
    )
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _serialise_tx(tx)


# ---------------------------------------------------------------------------
# Transaction / mempool endpoints
# ---------------------------------------------------------------------------

@router.get("/transactions")
def list_pending(db: Session = Depends(get_db)):
    """Return all pending (mempool) transactions."""
    pending = db.query(PendingTransaction).all()
    return [
        {
            "id": p.id,
            "tx_id": p.tx_id,
            "from_address": p.from_address,
            "to_address": p.to_address,
            "amount": p.amount,
            "timestamp": p.timestamp,
        }
        for p in pending
    ]


@router.get("/transactions/unspent")
def list_utxos(address: str, db: Session = Depends(get_db)):
    """Return the unspent output set for the given address."""
    utxos = get_utxos_for_address(db, address)
    return [
        {
            "id": u.id,
            "tx_id": u.tx_id,
            "output_index": u.output_index,
            "address": u.address,
            "amount": u.amount,
            "spent": u.spent,
            "spent_tx_id": u.spent_tx_id,
        }
        for u in utxos
    ]


# ---------------------------------------------------------------------------
# Stats endpoints
# ---------------------------------------------------------------------------

@router.get("/stats/supply")
def total_supply(db: Session = Depends(get_db)):
    """Return the total number of satoshis in circulation."""
    supply = get_total_supply(db)
    return {"total_supply_satoshis": supply, "total_supply_coins": supply / 100_000_000}


@router.get("/stats/richest")
def richest_addresses(db: Session = Depends(get_db)):
    """Return the top 10 addresses by confirmed balance."""
    return get_richest_addresses(db, limit=10)


@router.get("/stats/address/{address}")
def address_history(address: str, db: Session = Depends(get_db)):
    """Return all confirmed transactions involving the given address."""
    txs = get_address_history(db, address)
    return [_serialise_tx(t) for t in txs]


@router.get("/stats/blocks")
def block_stats(db: Session = Depends(get_db)):
    """Return aggregate block-chain statistics."""
    return get_block_stats(db)


@router.get("/stats/volume")
def transaction_volume(db: Session = Depends(get_db)):
    """Return total regular-transaction count and volume."""
    return get_transaction_volume(db)

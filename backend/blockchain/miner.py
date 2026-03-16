import time

from sqlalchemy.orm import Session

from db.models import Block as BlockModel, Transaction as TxModel, UTXO, PendingTransaction
from blockchain.chain import compute_hash, compute_difficulty, get_latest_block, is_valid_proof
from blockchain.transaction import create_coinbase_tx, create_fee_tx, TX_FEE


def get_difficulty(db: Session) -> dict:
    """Return the current mining difficulty and next scheduled increase."""
    latest = get_latest_block(db)
    height = latest.height if latest else 0
    next_height = height + 1
    difficulty = compute_difficulty(next_height)
    next_increase = ((next_height // 5) + 1) * 5
    return {
        "current_difficulty": difficulty,
        "current_height": height,
        "next_increase_at": next_increase,
        "leading_zeros": difficulty,
    }


def mine_block(db: Session, miner_address: str) -> dict:
    """
    Execute proof-of-work, build a new block including up to 2 pending transactions,
    persist everything to the database, and return a summary dict.
    """
    latest = get_latest_block(db)
    previous_hash = latest.hash if latest else "0" * 64
    height = (latest.height + 1) if latest else 1
    difficulty = compute_difficulty(height)
    target = "0" * difficulty

    # Pick up to 2 pending transactions
    pending = db.query(PendingTransaction).limit(2).all()
    included_txs = []
    for p in pending:
        included_txs.append(
            {
                "tx_id": p.tx_id,
                "tx_type": "regular",
                "from_address": p.from_address,
                "to_address": p.to_address,
                "amount": p.amount,
                "timestamp": p.timestamp,
            }
        )

    # Add a fee transaction for the first pending tx (if any)
    fee_tx = None
    if included_txs and included_txs[0]["from_address"]:
        fee_tx = create_fee_tx(included_txs[0]["from_address"], miner_address)

    # Coinbase reward
    coinbase = create_coinbase_tx(miner_address, height)

    # --- Proof-of-work loop ---
    nonce = 0
    timestamp = time.time()
    while True:
        block_dict = {
            "previous_hash": previous_hash,
            "timestamp": timestamp,
            "nonce": nonce,
            "height": height,
        }
        block_hash = compute_hash(block_dict)
        if is_valid_proof(block_hash, difficulty):
            break
        nonce += 1

    # Persist block
    block = BlockModel(
        hash=block_hash,
        previous_hash=previous_hash,
        timestamp=timestamp,
        nonce=nonce,
        difficulty=difficulty,
        miner_address=miner_address,
        height=height,
    )
    db.add(block)
    db.flush()

    all_txs = included_txs + ([fee_tx] if fee_tx else []) + [coinbase]

    for tx_data in all_txs:
        tx = TxModel(
            tx_id=tx_data["tx_id"],
            block_hash=block_hash,
            tx_type=tx_data["tx_type"],
            from_address=tx_data.get("from_address"),
            to_address=tx_data["to_address"],
            amount=tx_data["amount"],
            timestamp=tx_data["timestamp"],
        )
        db.add(tx)

        # Create UTXO for recipient
        utxo = UTXO(
            tx_id=tx_data["tx_id"],
            output_index=0,
            address=tx_data["to_address"],
            amount=tx_data["amount"],
            spent=False,
        )
        db.add(utxo)

        # Mark sender UTXOs as spent for regular transactions and create change output
        if tx_data["tx_type"] == "regular" and tx_data.get("from_address"):
            spent_utxos = (
                db.query(UTXO)
                .filter(
                    UTXO.address == tx_data["from_address"],
                    UTXO.spent == False,
                )
                .all()
            )
            remaining = tx_data["amount"] + TX_FEE
            for u in spent_utxos:
                if remaining <= 0:
                    break
                u.spent = True
                u.spent_tx_id = tx_data["tx_id"]
                remaining -= u.amount

            # Change UTXO if overspent
            if remaining < 0:
                change_utxo = UTXO(
                    tx_id=tx_data["tx_id"],
                    output_index=1,
                    address=tx_data["from_address"],
                    amount=abs(remaining),
                    spent=False,
                )
                db.add(change_utxo)

    # Remove included pending transactions from the mempool
    for p in pending:
        db.delete(p)

    db.commit()

    return {
        "block_hash": block_hash,
        "height": height,
        "nonce": nonce,
        "difficulty": difficulty,
        "transactions_included": len(all_txs),
        "miner_address": miner_address,
        "reward": coinbase["amount"],
    }

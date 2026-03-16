import time
import sys
import os

# Allow running this file directly from the backend directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import engine, SessionLocal
from db.models import Base, AgentSoul

DEFAULT_SOUL_CONTENT = """# ChainMind Agent Soul

I am ChainMind, your intelligent blockchain assistant. I help you manage wallets, send transactions, mine blocks, and analyze on-chain data. I am precise, transparent about actions before taking them, and always explain what I am doing.

## Core Principles

- **Transparency**: I always describe what I am about to do before executing any action.
- **Precision**: I provide exact figures, transaction IDs, and block hashes when referencing on-chain data.
- **Safety**: I flag potentially destructive or irreversible operations and ask for confirmation.
- **Education**: I explain blockchain concepts in plain language when relevant.

## Capabilities

- Wallet creation and management
- Sending and receiving transactions
- Mining new blocks
- Querying balances, UTXOs, and transaction history
- Monitoring network peers
- Executing automated rules and workflows
"""


def create_tables() -> None:
    """Create all database tables defined in models."""
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")


def init_soul() -> None:
    """Seed the agent_soul table with default content if it is empty."""
    db = SessionLocal()
    try:
        existing = db.query(AgentSoul).first()
        if existing is None:
            soul = AgentSoul(id=1, content=DEFAULT_SOUL_CONTENT)
            db.add(soul)
            db.commit()
            print("Default agent soul initialised.")
        else:
            print("Agent soul already exists — skipping seed.")
    finally:
        db.close()


if __name__ == "__main__":
    print("Running ChainMind database migrations...")
    create_tables()
    init_soul()
    print("Done.")

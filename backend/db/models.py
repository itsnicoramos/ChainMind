from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, ForeignKey, Index
)
from db.database import Base


class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True)
    hash = Column(String, unique=True, index=True, nullable=False)
    previous_hash = Column(String, nullable=False)
    timestamp = Column(Float, nullable=False)
    nonce = Column(Integer, nullable=False)
    difficulty = Column(Integer, nullable=False)
    miner_address = Column(String, nullable=False)
    height = Column(Integer, index=True, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_id = Column(String, unique=True, index=True, nullable=False)
    block_hash = Column(String, ForeignKey("blocks.hash"), nullable=True)
    tx_type = Column(String, nullable=False)  # "regular", "fee", "reward"
    from_address = Column(String, nullable=True)
    to_address = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)  # satoshis
    timestamp = Column(Float, nullable=False)


class UTXO(Base):
    __tablename__ = "utxos"

    id = Column(Integer, primary_key=True, index=True)
    tx_id = Column(String, index=True, nullable=False)
    output_index = Column(Integer, nullable=False)
    address = Column(String, index=True, nullable=False)
    amount = Column(Integer, nullable=False)  # satoshis
    spent = Column(Boolean, default=False, nullable=False)
    spent_tx_id = Column(String, nullable=True)


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String, primary_key=True)  # uuid
    name = Column(String, nullable=False)
    encrypted_seed = Column(String, nullable=False)  # AES-encrypted mnemonic
    created_at = Column(Float, nullable=False)


class Address(Base):
    __tablename__ = "addresses"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(String, ForeignKey("wallets.id"), nullable=False)
    address = Column(String, unique=True, index=True, nullable=False)  # hex-encoded public key hash
    derivation_index = Column(Integer, nullable=False)
    created_at = Column(Float, nullable=False)


class Peer(Base):
    __tablename__ = "peers"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, nullable=False)
    last_seen = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class AgentSoul(Base):
    __tablename__ = "agent_soul"

    id = Column(Integer, primary_key=True, default=1)
    content = Column(Text, nullable=False)  # markdown


class AgentConversation(Base):
    __tablename__ = "agent_conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)  # JSON string for tool calls
    timestamp = Column(Float, nullable=False)


class AgentRule(Base):
    __tablename__ = "agent_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    trigger_type = Column(String, nullable=False)  # "threshold", "schedule", "event"
    trigger_condition = Column(Text, nullable=False)  # JSON
    action_skill = Column(String, nullable=False)
    action_tool = Column(String, nullable=False)
    action_params = Column(Text, nullable=False)  # JSON
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(Float, nullable=False)
    last_run = Column(Float, nullable=True)


class AgentRuleExecution(Base):
    __tablename__ = "agent_rule_executions"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("agent_rules.id"), nullable=False)
    executed_at = Column(Float, nullable=False)
    success = Column(Boolean, nullable=False)
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)


class AgentEventLog(Base):
    __tablename__ = "agent_event_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, nullable=False)  # "tool_call", "approval", "denial", "rule_execution"
    session_id = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    metadata = Column(Text, nullable=True)  # JSON
    timestamp = Column(Float, nullable=False)


class PendingTransaction(Base):
    __tablename__ = "pending_transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_id = Column(String, unique=True, nullable=False)
    from_address = Column(String, nullable=False)
    to_address = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)  # satoshis
    timestamp = Column(Float, nullable=False)

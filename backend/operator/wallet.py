import os, hashlib, json, time, uuid
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import base64
from mnemonic import Mnemonic
from ecdsa import SigningKey, SECP256k1
from sqlalchemy.orm import Session
from db.models import Wallet, Address


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend(),
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def _encrypt_seed(mnemonic: str, password: str) -> str:
    salt = os.urandom(16)
    key = _derive_key(password, salt)
    f = Fernet(key)
    encrypted = f.encrypt(mnemonic.encode())
    return base64.b64encode(salt + encrypted).decode()


def _decrypt_seed(encrypted_data: str, password: str) -> str:
    raw = base64.b64decode(encrypted_data.encode())
    salt = raw[:16]
    encrypted = raw[16:]
    key = _derive_key(password, salt)
    f = Fernet(key)
    return f.decrypt(encrypted).decode()


def _mnemonic_to_private_key(mnemonic: str, index: int) -> SigningKey:
    seed = hashlib.pbkdf2_hmac("sha512", mnemonic.encode(), f"chainmind{index}".encode(), 2048)[:32]
    return SigningKey.from_string(seed, curve=SECP256k1)


def _public_key_to_address(public_key_bytes: bytes) -> str:
    sha256 = hashlib.sha256(public_key_bytes).digest()
    ripemd160 = hashlib.new("ripemd160")
    ripemd160.update(sha256)
    return ripemd160.hexdigest()


def create_wallet(db: Session, name: str, password: str) -> dict:
    mnemo = Mnemonic("english")
    mnemonic = mnemo.generate(strength=128)
    wallet_id = str(uuid.uuid4())
    encrypted_seed = _encrypt_seed(mnemonic, password)
    wallet = Wallet(id=wallet_id, name=name, encrypted_seed=encrypted_seed, created_at=time.time())
    db.add(wallet)
    db.commit()
    return {"id": wallet_id, "name": name, "created_at": wallet.created_at}


def list_wallets(db: Session) -> list:
    wallets = db.query(Wallet).all()
    return [{"id": w.id, "name": w.name, "created_at": w.created_at} for w in wallets]


def create_address(db: Session, wallet_id: str, password: str) -> dict:
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise ValueError("Wallet not found")
    mnemonic = _decrypt_seed(wallet.encrypted_seed, password)
    existing_count = db.query(Address).filter(Address.wallet_id == wallet_id).count()
    index = existing_count
    sk = _mnemonic_to_private_key(mnemonic, index)
    vk = sk.get_verifying_key()
    address = _public_key_to_address(vk.to_string())
    addr = Address(wallet_id=wallet_id, address=address, derivation_index=index, created_at=time.time())
    db.add(addr)
    db.commit()
    return {"address": address, "derivation_index": index}


def list_addresses(db: Session, wallet_id: str) -> list:
    addrs = db.query(Address).filter(Address.wallet_id == wallet_id).all()
    return [{"address": a.address, "derivation_index": a.derivation_index, "created_at": a.created_at} for a in addrs]


def get_balance_for_address(db: Session, address: str) -> dict:
    from blockchain.chain import get_balance
    balance = get_balance(db, address)
    return {"address": address, "balance": balance, "balance_coins": balance / 100_000_000}


def send_transaction(db: Session, wallet_id: str, password: str, from_address: str, to_address: str, amount_satoshis: int) -> dict:
    from blockchain.chain import get_balance
    from blockchain.transaction import create_regular_tx, TX_FEE
    from db.models import PendingTransaction
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id).first()
    if not wallet:
        raise ValueError("Wallet not found")
    # Verify password by attempting decryption
    _decrypt_seed(wallet.encrypted_seed, password)
    balance = get_balance(db, from_address)
    total_needed = amount_satoshis + TX_FEE
    if balance < total_needed:
        raise ValueError(f"Insufficient balance. Have {balance} satoshis, need {total_needed}")
    tx = create_regular_tx(from_address, to_address, amount_satoshis)
    pending = PendingTransaction(
        tx_id=tx["tx_id"],
        from_address=from_address,
        to_address=to_address,
        amount=amount_satoshis,
        timestamp=tx["timestamp"],
    )
    db.add(pending)
    db.commit()
    return {"transaction_id": tx["tx_id"], "status": "pending", "amount": amount_satoshis, "fee": TX_FEE}

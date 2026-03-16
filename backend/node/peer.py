import httpx, time
from sqlalchemy.orm import Session
from db.models import Peer


def list_peers(db: Session) -> list:
    peers = db.query(Peer).all()
    return [{"id": p.id, "url": p.url, "last_seen": p.last_seen, "is_active": p.is_active} for p in peers]


def add_peer(db: Session, url: str) -> dict:
    existing = db.query(Peer).filter(Peer.url == url).first()
    if existing:
        return {"id": existing.id, "url": existing.url, "already_existed": True}
    peer = Peer(url=url, last_seen=None, is_active=True)
    db.add(peer)
    db.commit()
    return {"id": peer.id, "url": peer.url, "already_existed": False}


async def get_sync_status(db: Session) -> dict:
    from blockchain.chain import get_latest_block
    local_block = get_latest_block(db)
    local_height = local_block.height if local_block else 0
    peers = db.query(Peer).filter(Peer.is_active == True).all()
    peer_heights = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for peer in peers:
            try:
                resp = await client.get(f"{peer.url}/blockchain/blocks/latest")
                if resp.status_code == 200:
                    data = resp.json()
                    peer_heights[peer.url] = data.get("height", 0)
                    peer.last_seen = time.time()
            except Exception:
                peer.is_active = False
    db.commit()
    return {
        "local_height": local_height,
        "peer_count": len(peers),
        "peer_heights": peer_heights,
        "is_synced": all(h <= local_height for h in peer_heights.values()),
    }


def get_confirmations(db: Session, tx_id: str) -> dict:
    from db.models import Transaction
    from blockchain.chain import get_latest_block
    tx = db.query(Transaction).filter(Transaction.tx_id == tx_id).first()
    if not tx:
        return {"tx_id": tx_id, "confirmations": 0, "found": False}
    latest = get_latest_block(db)
    tx_block = db.query(__import__("db.models", fromlist=["Block"]).Block).filter(
        __import__("db.models", fromlist=["Block"]).Block.hash == tx.block_hash
    ).first()
    if not tx_block or not latest:
        return {"tx_id": tx_id, "confirmations": 0, "found": True}
    confirmations = (latest.height - tx_block.height) + 1
    return {"tx_id": tx_id, "confirmations": confirmations, "found": True}

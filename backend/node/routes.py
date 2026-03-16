from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.session import get_db
from node.peer import list_peers, add_peer, get_sync_status, get_confirmations

router = APIRouter(prefix="/node", tags=["node"])


class AddPeerRequest(BaseModel):
    url: str


@router.get("/peers")
def get_peers(db: Session = Depends(get_db)):
    return list_peers(db)


@router.post("/peers")
def post_peer(body: AddPeerRequest, db: Session = Depends(get_db)):
    return add_peer(db, body.url)


@router.get("/transactions/{tx_id}/confirmations")
def get_tx_confirmations(tx_id: str, db: Session = Depends(get_db)):
    return get_confirmations(db, tx_id)


@router.get("/sync")
async def get_sync(db: Session = Depends(get_db)):
    return await get_sync_status(db)

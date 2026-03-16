from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.session import get_db
from blockchain.miner import mine_block, get_difficulty

router = APIRouter(prefix="/miner", tags=["miner"])


class MineRequest(BaseModel):
    miner_address: str


@router.post("/mine")
def post_mine(body: MineRequest, db: Session = Depends(get_db)):
    return mine_block(db, body.miner_address)


@router.get("/difficulty")
def get_current_difficulty(db: Session = Depends(get_db)):
    return get_difficulty(db)

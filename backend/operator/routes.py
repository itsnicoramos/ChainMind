from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.session import get_db
from operator.wallet import (
    list_wallets,
    create_wallet,
    list_addresses,
    create_address,
    get_balance_for_address,
    send_transaction,
)

router = APIRouter(prefix="/operator", tags=["operator"])


class CreateWalletRequest(BaseModel):
    name: str
    password: str


class CreateAddressRequest(BaseModel):
    password: str


class SendTransactionRequest(BaseModel):
    password: str
    from_address: str
    to_address: str
    amount: int


@router.get("/wallets")
def get_wallets(db: Session = Depends(get_db)):
    return list_wallets(db)


@router.post("/wallets")
def post_wallets(body: CreateWalletRequest, db: Session = Depends(get_db)):
    return create_wallet(db, body.name, body.password)


@router.get("/wallets/{wallet_id}/addresses")
def get_addresses(wallet_id: str, db: Session = Depends(get_db)):
    return list_addresses(db, wallet_id)


@router.post("/wallets/{wallet_id}/addresses")
def post_address(wallet_id: str, body: CreateAddressRequest, db: Session = Depends(get_db)):
    try:
        return create_address(db, wallet_id, body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wallets/{wallet_id}/addresses/{address}/balance")
def get_balance(wallet_id: str, address: str, db: Session = Depends(get_db)):
    return get_balance_for_address(db, address)


@router.post("/wallets/{wallet_id}/transactions")
def post_transaction(wallet_id: str, body: SendTransactionRequest, db: Session = Depends(get_db)):
    try:
        return send_transaction(
            db,
            wallet_id,
            body.password,
            body.from_address,
            body.to_address,
            body.amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

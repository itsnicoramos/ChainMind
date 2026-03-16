from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
from sqlalchemy.orm import Session
from db.session import get_db
from agent.soul import get_soul, update_soul
from agent.conversations import get_conversations, get_conversation, append_message
from agent.rules import list_rules, create_rule, update_rule, delete_rule, get_rule_history
from agent.events import get_events, log_event

router = APIRouter(prefix="/agent", tags=["agent"])


# ── Soul ──────────────────────────────────────────────────────────────────────

class UpdateSoulRequest(BaseModel):
    content: str


@router.get("/soul")
def route_get_soul(db: Session = Depends(get_db)):
    return get_soul(db)


@router.put("/soul")
def route_update_soul(body: UpdateSoulRequest, db: Session = Depends(get_db)):
    return update_soul(db, body.content)


# ── Conversations ─────────────────────────────────────────────────────────────

class AppendMessageRequest(BaseModel):
    role: str
    content: Any


@router.get("/conversations")
def route_get_conversations(db: Session = Depends(get_db)):
    return get_conversations(db)


@router.get("/conversations/{session_id}")
def route_get_conversation(session_id: str, db: Session = Depends(get_db)):
    return get_conversation(db, session_id)


@router.post("/conversations/{session_id}")
def route_append_message(session_id: str, body: AppendMessageRequest, db: Session = Depends(get_db)):
    return append_message(db, session_id, body.role, body.content)


# ── Rules ─────────────────────────────────────────────────────────────────────

class CreateRuleRequest(BaseModel):
    name: str
    trigger_type: str
    trigger_condition: Optional[dict] = {}
    action_skill: str
    action_tool: str
    action_params: Optional[dict] = {}
    is_active: Optional[bool] = True


class UpdateRuleRequest(BaseModel):
    name: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_condition: Optional[dict] = None
    action_skill: Optional[str] = None
    action_tool: Optional[str] = None
    action_params: Optional[dict] = None
    is_active: Optional[bool] = None


@router.get("/rules")
def route_list_rules(db: Session = Depends(get_db)):
    return list_rules(db)


@router.post("/rules")
def route_create_rule(body: CreateRuleRequest, db: Session = Depends(get_db)):
    return create_rule(db, body.model_dump())


@router.put("/rules/{rule_id}")
def route_update_rule(rule_id: int, body: UpdateRuleRequest, db: Session = Depends(get_db)):
    try:
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        return update_rule(db, rule_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/rules/{rule_id}")
def route_delete_rule(rule_id: int, db: Session = Depends(get_db)):
    try:
        return delete_rule(db, rule_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/rules/{rule_id}/history")
def route_get_rule_history(rule_id: int, db: Session = Depends(get_db)):
    return get_rule_history(db, rule_id)


# ── Events ────────────────────────────────────────────────────────────────────

class LogEventRequest(BaseModel):
    event_type: str
    description: str
    session_id: Optional[str] = None
    metadata: Optional[dict] = None


@router.get("/events")
def route_get_events(db: Session = Depends(get_db)):
    return get_events(db)


@router.post("/events")
def route_log_event(body: LogEventRequest, db: Session = Depends(get_db)):
    return log_event(
        db,
        event_type=body.event_type,
        description=body.description,
        session_id=body.session_id,
        metadata=body.metadata,
    )

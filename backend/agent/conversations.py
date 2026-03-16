import json, time
from sqlalchemy.orm import Session
from db.models import AgentConversation


def get_conversations(db: Session) -> list:
    rows = db.query(AgentConversation.session_id).distinct().all()
    sessions = []
    for row in rows:
        sid = row.session_id
        messages = db.query(AgentConversation).filter(AgentConversation.session_id == sid).order_by(AgentConversation.timestamp.desc()).limit(1).all()
        last_msg = messages[0] if messages else None
        count = db.query(AgentConversation).filter(AgentConversation.session_id == sid).count()
        sessions.append({
            "session_id": sid,
            "message_count": count,
            "last_message_at": last_msg.timestamp if last_msg else None,
        })
    return sessions


def get_conversation(db: Session, session_id: str, limit: int = 50) -> list:
    rows = db.query(AgentConversation).filter(
        AgentConversation.session_id == session_id
    ).order_by(AgentConversation.timestamp).limit(limit).all()
    result = []
    for row in rows:
        try:
            content = json.loads(row.content)
        except (json.JSONDecodeError, TypeError):
            content = row.content
        result.append({"role": row.role, "content": content, "timestamp": row.timestamp})
    return result


def append_message(db: Session, session_id: str, role: str, content) -> dict:
    if not isinstance(content, str):
        content = json.dumps(content)
    msg = AgentConversation(
        session_id=session_id,
        role=role,
        content=content,
        timestamp=time.time(),
    )
    db.add(msg)
    db.commit()
    return {"session_id": session_id, "role": role, "saved": True}

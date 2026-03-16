import json, time
from sqlalchemy.orm import Session
from db.models import AgentEventLog


def get_events(db: Session, limit: int = 100) -> list:
    events = db.query(AgentEventLog).order_by(AgentEventLog.timestamp.desc()).limit(limit).all()
    return [_event_to_dict(e) for e in events]


def log_event(db: Session, event_type: str, description: str, session_id: str = None, metadata: dict = None) -> dict:
    event = AgentEventLog(
        event_type=event_type,
        session_id=session_id,
        description=description,
        metadata=json.dumps(metadata) if metadata else None,
        timestamp=time.time(),
    )
    db.add(event)
    db.commit()
    return _event_to_dict(event)


def _event_to_dict(e: AgentEventLog) -> dict:
    return {
        "id": e.id,
        "event_type": e.event_type,
        "session_id": e.session_id,
        "description": e.description,
        "metadata": json.loads(e.metadata) if e.metadata else None,
        "timestamp": e.timestamp,
    }

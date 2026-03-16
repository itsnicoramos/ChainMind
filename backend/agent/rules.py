import json, time
from sqlalchemy.orm import Session
from db.models import AgentRule, AgentRuleExecution


def list_rules(db: Session) -> list:
    rules = db.query(AgentRule).all()
    return [_rule_to_dict(r) for r in rules]


def create_rule(db: Session, data: dict) -> dict:
    rule = AgentRule(
        name=data["name"],
        trigger_type=data["trigger_type"],
        trigger_condition=json.dumps(data.get("trigger_condition", {})),
        action_skill=data["action_skill"],
        action_tool=data["action_tool"],
        action_params=json.dumps(data.get("action_params", {})),
        is_active=data.get("is_active", True),
        created_at=time.time(),
    )
    db.add(rule)
    db.commit()
    return _rule_to_dict(rule)


def update_rule(db: Session, rule_id: int, data: dict) -> dict:
    rule = db.query(AgentRule).filter(AgentRule.id == rule_id).first()
    if not rule:
        raise ValueError("Rule not found")
    for field in ["name", "trigger_type", "action_skill", "action_tool", "is_active"]:
        if field in data:
            setattr(rule, field, data[field])
    if "trigger_condition" in data:
        rule.trigger_condition = json.dumps(data["trigger_condition"])
    if "action_params" in data:
        rule.action_params = json.dumps(data["action_params"])
    db.commit()
    return _rule_to_dict(rule)


def delete_rule(db: Session, rule_id: int) -> dict:
    rule = db.query(AgentRule).filter(AgentRule.id == rule_id).first()
    if not rule:
        raise ValueError("Rule not found")
    db.delete(rule)
    db.commit()
    return {"deleted": True, "rule_id": rule_id}


def get_rule_history(db: Session, rule_id: int, limit: int = 50) -> list:
    execs = db.query(AgentRuleExecution).filter(
        AgentRuleExecution.rule_id == rule_id
    ).order_by(AgentRuleExecution.executed_at.desc()).limit(limit).all()
    return [{"id": e.id, "executed_at": e.executed_at, "success": e.success, "result": e.result, "error": e.error} for e in execs]


def _rule_to_dict(rule: AgentRule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "trigger_type": rule.trigger_type,
        "trigger_condition": json.loads(rule.trigger_condition or "{}"),
        "action_skill": rule.action_skill,
        "action_tool": rule.action_tool,
        "action_params": json.loads(rule.action_params or "{}"),
        "is_active": rule.is_active,
        "created_at": rule.created_at,
        "last_run": rule.last_run,
    }

import asyncio, json, time, logging
from sqlalchemy.orm import Session

logger = logging.getLogger("automation_runner")


async def evaluate_rule(rule, db: Session) -> bool:
    """Evaluate if a rule's trigger condition is met."""
    trigger = json.loads(rule.trigger_condition or "{}")
    trigger_type = rule.trigger_type

    if trigger_type == "schedule":
        interval = trigger.get("interval_seconds", 3600)
        last_run = rule.last_run or 0
        return (time.time() - last_run) >= interval

    elif trigger_type == "threshold":
        metric = trigger.get("metric")
        threshold = trigger.get("value", 0)
        operator = trigger.get("operator", ">=")

        try:
            from blockchain.chain import get_latest_block, get_balance, get_total_supply
            if metric == "block_height":
                latest = get_latest_block(db)
                current = latest.height if latest else 0
            elif metric == "total_supply":
                current = get_total_supply(db)
            else:
                return False

            if operator == ">=":
                return current >= threshold
            elif operator == "<=":
                return current <= threshold
            elif operator == "==":
                return current == threshold
            elif operator == ">":
                return current > threshold
            elif operator == "<":
                return current < threshold
        except Exception as e:
            logger.error(f"Error evaluating threshold: {e}")
            return False

    return False


async def execute_rule_action(rule, db: Session) -> dict:
    """Execute the rule's action tool."""
    params = json.loads(rule.action_params or "{}")
    tool = rule.action_tool

    # Simple action executor — maps to blockchain operations
    try:
        if tool == "mine_block":
            from blockchain.miner import mine_block
            result = mine_block(db, params.get("miner_address", "automation"))
            return {"success": True, "result": json.dumps(result)}
        else:
            return {"success": False, "error": f"Automation tool '{tool}' not supported"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def run_automation_loop(get_db_func):
    """Background task that polls active rules every 30 seconds."""
    from db.models import AgentRule, AgentRuleExecution
    while True:
        try:
            db: Session = next(get_db_func())
            rules = db.query(AgentRule).filter(AgentRule.is_active == True).all()
            for rule in rules:
                try:
                    should_run = await evaluate_rule(rule, db)
                    if should_run:
                        result = await execute_rule_action(rule, db)
                        execution = AgentRuleExecution(
                            rule_id=rule.id,
                            executed_at=time.time(),
                            success=result["success"],
                            result=result.get("result"),
                            error=result.get("error"),
                        )
                        db.add(execution)
                        rule.last_run = time.time()
                        db.commit()
                        logger.info(f"Rule '{rule.name}' executed: success={result['success']}")
                except Exception as e:
                    logger.error(f"Error running rule {rule.id}: {e}")
            db.close()
        except Exception as e:
            logger.error(f"Automation loop error: {e}")

        await asyncio.sleep(30)

import asyncio
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import SessionLocal
from db.migrations import create_tables, init_soul
from blockchain.chain import ensure_genesis

# Routers
from blockchain.routes import router as blockchain_router
from operator.routes import router as operator_router
from miner.routes import router as miner_router
from node.routes import router as node_router
from agent.routes import router as agent_router
from agent.automation_runner import run_automation_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chainmind")

app = FastAPI(
    title="ChainMind API",
    description="AI-agent blockchain platform backend",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow all origins for development
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(blockchain_router)
app.include_router(operator_router)
app.include_router(miner_router)
app.include_router(node_router)
app.include_router(agent_router)


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    logger.info("Running database migrations...")
    create_tables()

    logger.info("Seeding agent soul...")
    init_soul()

    logger.info("Ensuring genesis block exists...")
    db = SessionLocal()
    try:
        ensure_genesis(db)
    finally:
        db.close()

    logger.info("Starting automation runner...")
    asyncio.create_task(run_automation_loop(SessionLocal))

    logger.info("ChainMind backend is ready.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
def health_check():
    return {"status": "ok", "version": "1.0.0"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

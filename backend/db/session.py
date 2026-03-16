# Compatibility shim — re-exports everything from db.database so that
# modules written against either import path work correctly.
from db.database import engine, SessionLocal, Base, get_db  # noqa: F401

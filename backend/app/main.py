from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.api.routes import router as api_router
from app.core.config import settings
from app.database.session import Base, SessionLocal, engine
from app.services.workspace_service import ensure_demo_workspace_seeded


def _run_sqlite_column_migrations():
    """Ensures newly added columns exist in older SQLite databases."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_sqlite_column_migrations()
    db = SessionLocal()
    try:
        ensure_demo_workspace_seeded(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="INSTANTLY Communications Intelligence API",
    description="AI-Powered Communications Intelligence and Productivity Platform",
    version=settings.VERSION,
    lifespan=lifespan,
)

_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL.rstrip("/") not in _cors_origins:
    _cors_origins.append(settings.FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "instantly-backend",
        "version": settings.VERSION,
        "ai_provider": settings.AI_PROVIDER,
    }


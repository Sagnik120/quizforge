from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import (
    auth_router, subjects_router, tests_router,
    attempts_router, analytics_router, leaderboard_router, profile_router,
    planner_router
)
from app.db.base import Base, engine, AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import inspect, text, select, func
import secrets

app = FastAPI(
    title="QuizForge API",
    description="""
## QuizForge — Self-hosted exam practice platform

### Features
- 📝 **Test Creation** — Create MCQ and MSQ tests manually or import from JSON
- 🎯 **Test Attempts** — Attempt any test multiple times with full scoring
- 📊 **Analytics** — Track your performance, identify weak topics
- 🔁 **Revision Queue** — Automatically queues wrongly answered questions
- 🏆 **Leaderboard** — Your personal performance leaderboard + streaks
- 👤 **Profile** — Manage your profile information

### Authentication
Use `/api/v1/auth/register` to create an account, then `/api/v1/auth/login` to get your JWT token.
Click **Authorize** above and paste: `Bearer <your_token>`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
PREFIX = settings.API_V1_STR
app.include_router(auth_router, prefix=PREFIX)
app.include_router(subjects_router, prefix=PREFIX)
app.include_router(tests_router, prefix=PREFIX)
app.include_router(attempts_router, prefix=PREFIX)
app.include_router(analytics_router, prefix=PREFIX)
app.include_router(leaderboard_router, prefix=PREFIX)
app.include_router(profile_router, prefix=PREFIX)
app.include_router(planner_router, prefix=PREFIX)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
    await _seed_people()


# Columns added after the first release; create_all never alters existing tables.
_NEW_COLUMNS = [
    ("subjects", "space", "VARCHAR(10) NOT NULL DEFAULT 'private'"),
    ("topics", "parent_id", "VARCHAR(36)"),
]


def _add_missing_columns(conn):
    inspector = inspect(conn)
    for table, column, ddl in _NEW_COLUMNS:
        if column not in [c["name"] for c in inspector.get_columns(table)]:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


async def _seed_people():
    """Make sure every configured person has an account to click into."""
    async with AsyncSessionLocal() as db:
        for name in settings.USERS:
            existing = await db.execute(select(User).where(func.lower(User.username) == name.lower()))
            if not existing.scalar_one_or_none():
                db.add(User(
                    email=f"{name.lower()}@prepduo.app",
                    username=name.lower(),
                    full_name=name,
                    hashed_password=get_password_hash(secrets.token_hex(16)),
                ))
        await db.commit()


@app.get("/", tags=["Health"])
async def root():
    return {"message": "QuizForge API is running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}

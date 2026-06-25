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

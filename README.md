# QuizForge ⚡

> Self-hosted exam practice platform — create tests, attempt them unlimited times, track your mastery.

## Features

- **Test Creation** — Build MCQ & MSQ tests manually or import from JSON
- **Unlimited Attempts** — Attempt any test as many times as you want
- **Analytics** — Performance charts, weak topic detection, accuracy tracking
- **Revision Queue** — Wrongly answered questions are automatically queued for review
- **Leaderboard** — Personal leaderboard sorted by best score across all tests
- **Streak Tracking** — Daily streak to build study habits
- **Subjects & Topics** — Hierarchical organisation: Subject → Topic → Test

---

## Quick Start (Local Dev)

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit env
cp ../.env.example .env           # Edit .env if needed (SQLite works out of the box)

# Run migrations (creates the DB on first run)
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```

API docs at: **http://localhost:8000/docs**

### Frontend

```bash

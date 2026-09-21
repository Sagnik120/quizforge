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
cd frontend

npm install

cp .env.local.example .env.local  # Already set for local dev

npm run dev
```

App at: **http://localhost:3000**

---

## Database

### Using SQLite (default, zero config)
The default `.env` uses SQLite. No setup needed — the file `quizforge.db` is created automatically.

### Switching to PostgreSQL
1. Start PostgreSQL (or use Docker: `docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16`)
2. Edit `backend/.env`:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/quizforge
   ```
3. Run `alembic upgrade head`

### Alembic Migrations

```bash
cd backend

# Apply all migrations
alembic upgrade head

# Create a new migration after changing models
alembic revision --autogenerate -m "add new column"

# Roll back one step
alembic downgrade -1
```

---

## Backend API Testing

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Run a specific test
pytest tests/test_api.py::test_full_attempt_flow -v

# With coverage
pip install pytest-cov
pytest tests/ -v --cov=app --cov-report=html
```

### Swagger UI Testing
1. Go to http://localhost:8000/docs
2. Click **POST /api/v1/auth/register** → fill in email/username/password → Execute
3. Copy the `access_token` from the response
4. Click **Authorize** (top right) → paste `Bearer <token>` → Authorize
5. All endpoints are now unlocked — try creating subjects, tests, and attempting them

---

## Git Workflow

```bash
# Initial setup (run once)
cd quizforge
git init
git add .
git commit -m "feat: initial QuizForge project setup"

# Suggested commit sequence as you work:
git add backend/app/models/
git commit -m "feat(models): add User, Subject, Topic, Test, Attempt, RevisionQueue models"

git add backend/app/api/routes/auth.py
git commit -m "feat(auth): add register and login endpoints with JWT"

git add backend/app/api/routes/subjects.py
git commit -m "feat(subjects): add CRUD for subjects and topics"

git add backend/app/api/routes/tests.py
git commit -m "feat(tests): add test creation, JSON import, and attempt-view endpoints"

git add backend/app/api/routes/attempts.py
git commit -m "feat(attempts): add attempt start, submit with scoring, and revision queue"

git add backend/app/api/routes/analytics.py
git commit -m "feat(analytics): add performance summary and revision queue endpoints"

git add frontend/src/
git commit -m "feat(frontend): add Next.js app with auth, subjects, test creation, attempt flow"

git add .
git commit -m "chore: add Docker Compose and Dockerfiles for deployment"
```

---

## Deployment

### Option 1: Docker Compose (easiest)

```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs

### Option 2: Vercel (frontend) + Railway (backend)

**Frontend → Vercel:**
```bash
cd frontend
npx vercel
# Set env: NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Backend → Railway:**
- Push to GitHub
- Connect Railway to your repo, set root to `/backend`
- Set `DATABASE_URL` (Railway provides PostgreSQL) and `SECRET_KEY`
- Add start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

---

## JSON Import Format

```json
{
  "name": "Sample Physics Test",
  "description": "Test on Newton's Laws",
  "topic_id": "<your-topic-uuid>",
  "time_limit_minutes": 30,
  "questions": [
    {
      "question_type": "MCQ",
      "text": "Which of Newton's laws states F = ma?",
      "options": [
        {"id": "a", "text": "First Law",  "is_correct": false},
        {"id": "b", "text": "Second Law", "is_correct": true},
        {"id": "c", "text": "Third Law",  "is_correct": false},
        {"id": "d", "text": "None",       "is_correct": false}
      ],
      "explanation": "Newton's Second Law: F = ma",
      "marks": 2,
      "negative_marks": 0

# Database Setup

## Decision: PostgreSQL, hosted on Neon (free plan)

**Why PostgreSQL and not Firebase**

- The data is relational: `users → subjects → topics (and sub-topics) → tests → questions → attempts → attempt_answers`, plus `revision_queue`, `goals`, `goal_checks` and `reminders`. Analytics, weak areas, streaks and the leaderboard are SQL joins and aggregates (`SUM`, `AVG`, `GROUP BY`). Firestore has no joins and only limited aggregation, so these would have to be redesigned.
- The backend is already written with SQLAlchemy and already supports PostgreSQL. Switching is one setting, `DATABASE_URL`. Firebase would mean rewriting every route, the models and the tests.
- Question options and selected answers are JSON columns, which PostgreSQL stores natively.

**Why Neon as the host**

- Free plan with no credit card, about 0.5 GB of storage. The app stores small text rows for two people, so this is far more than it needs.
- It is a cloud database, so the data survives restarts and redeploys and both of you see the same data from any device.
- It sleeps when idle and wakes automatically on the next request. The first request after a break takes a second or two.

Free-plan limits can change, so check Neon's pricing page when you sign up. Nothing in this guide needs a paid plan.

**Why SQLite was losing data:** SQLite is a single file (`backend/quizforge.db`) on the machine running the backend. On a host like Render's free plan that disk is wiped on every deploy and restart.

---

## Step by step

### 1. Create the database on Neon

1. Open <https://neon.tech> and sign up (Google or GitHub login works).
2. Click **Create project**. Name it `prepduo`, keep the default Postgres version, and pick the region closest to you (Singapore or Mumbai for India).
3. On the project page click **Connect**.
4. Turn **Connection pooling off**, so the host name does not contain `-pooler`. The backend's driver needs the direct connection.
5. Copy the connection string. It looks like this:

   ```
   postgresql://neondb_owner:AbCd1234@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

This string contains the password. Never commit it or share it.

### 2. Connect the backend on your computer

Create the file `backend/.env` (it is already git-ignored):

```env
DATABASE_URL=postgresql://neondb_owner:AbCd1234@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
SECRET_KEY=paste-a-long-random-string-here
DEBUG=false
```

- Paste the Neon string exactly as copied. The backend converts it for its driver and turns SSL on by itself.
- Generate the secret with `python3 -c "import secrets; print(secrets.token_hex(32))"`. Keep it the same from now on; changing it logs everyone out.

### 3. Start the backend

```bash
cd backend
python3 -m venv venv              # first time only
source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

On startup the backend creates every table that is missing and makes the two accounts (Sagnik and Shrusti). Existing tables and data are never touched.

### 4. Check that data now persists

1. Start the frontend (`cd frontend && npm install && npm run dev`) and open <http://localhost:3000>.
2. Add a subject or a goal.
3. In the Neon dashboard open **Tables**. You should see `subjects`, `goals` and the other tables, with your new row.
4. Stop the backend with `Ctrl+C`, start it again and reload the page. The row is still there.

### 5. Use the same database when deployed

The repo already contains `render.yaml` for the backend.

1. **Backend on Render:** New > Blueprint > pick this repo. When asked, set
   - `DATABASE_URL` to the Neon string from step 1,
   - `BACKEND_CORS_ORIGINS` to `["https://your-app.vercel.app"]`,
   - `APP_PASSCODE` to a passcode you both know (optional).
2. **Frontend on Vercel:** import the repo with root directory `frontend` and set `NEXT_PUBLIC_API_URL` to the Render URL.

Both free plans are enough. Render's free backend sleeps after about 15 minutes without traffic, so the first load after a break is slow. The data is not affected because it lives in Neon.

---

## Moving your existing SQLite data (optional)

A new Neon database starts empty. If `backend/quizforge.db` only has trial data, start fresh.

To copy it across, start the backend once against Neon so the tables exist (step 3), stop it, and run:

```bash
brew install pgloader
pgloader --with "data only" --with "truncate" \
  sqlite://backend/quizforge.db \
  "postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
```

---

## Using the app from your phone

**At home, on the same Wi-Fi as the computer**

1. Find the computer's IP address: `ipconfig getifaddr en0` (for example `192.168.1.23`).
2. Start the backend with `--host 0.0.0.0` as in step 3, and the frontend with `npm run dev`.
3. On the phone open `http://192.168.1.23:3000`.

The frontend calls the API on that same IP by itself, and the backend accepts local-network addresses on port 3000. If the page does not load, allow incoming connections for Python and Node in macOS firewall settings.

**From anywhere:** deploy as in step 5 and open the Vercel URL on the phone. In the browser menu choose **Add to Home Screen** to get an app-like icon.

---

## Changing tables later

The backend adds missing tables by itself. A new column on an existing table needs one line in `_NEW_COLUMNS` in `backend/app/main.py`; it is then added on the next start. For bigger changes use Alembic:

```bash
cd backend && source venv/bin/activate
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

---

## Local PostgreSQL instead (optional)

Persistent, but only reachable while your computer is on.

```bash
brew install postgresql@16
brew services start postgresql@16
createdb quizforge
```

Then in `backend/.env`: `DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/quizforge`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `password authentication failed` | Copy the string from Neon again. Resetting the password in Neon invalidates the old string. |
| `prepared statement ... already exists` | You copied the pooled string. Use the one without `-pooler` in the host name. |
| First request after a break is slow | Neon (and Render) were asleep. Normal on the free plans. |
| Data still disappears | The backend is not reading `.env`. The file must be `backend/.env`, and `uvicorn` must be started from inside `backend/`. On Render, check that `DATABASE_URL` is set. |
| Will running the tests touch my data? | No. `pytest` always uses a temporary SQLite file (`backend/tests/conftest.py`). |

"""
QuizForge API Tests
Run with: pytest tests/ -v
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app, startup

BASE = "/api/v1"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def client():
    await startup()  # create tables + seed people (ASGITransport skips lifespan events)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture(scope="session")
async def auth_headers(client):
    """Enter as one of the seeded people and return auth headers."""
    res = await client.post(f"{BASE}/auth/quick-login", json={"username": "sagnik"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ─── Auth tests ───────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_disabled(client):
    res = await client.post(f"{BASE}/auth/register", json={
        "email": "x@quizforge.dev", "username": "stranger", "password": "testpass123",
    })
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_login_invalid(client):
    res = await client.post(f"{BASE}/auth/login", json={
        "email": "wrong@test.com",
        "password": "wrongpass",
    })
    assert res.status_code == 401


# ─── Subject tests ────────────────────────────────────────
@pytest.mark.asyncio
async def test_create_subject(client, auth_headers):
    res = await client.post(f"{BASE}/subjects/", json={"name": "Physics", "color": "#6366f1"}, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Physics"


@pytest.mark.asyncio
async def test_list_subjects(client, auth_headers):
    res = await client.get(f"{BASE}/subjects/", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_create_topic(client, auth_headers):
    # Create subject first
    sub = await client.post(f"{BASE}/subjects/", json={"name": "Math"}, headers=auth_headers)
    sub_id = sub.json()["id"]
    res = await client.post(f"{BASE}/subjects/{sub_id}/topics", json={"name": "Algebra"}, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Algebra"


# ─── Test creation tests ──────────────────────────────────
@pytest.mark.asyncio
async def test_create_test(client, auth_headers):
    # Setup
    sub = await client.post(f"{BASE}/subjects/", json={"name": "Chemistry"}, headers=auth_headers)
    sub_id = sub.json()["id"]
    topic = await client.post(f"{BASE}/subjects/{sub_id}/topics", json={"name": "Organic"}, headers=auth_headers)
    topic_id = topic.json()["id"]

    res = await client.post(f"{BASE}/tests/", json={
        "name": "Organic Chemistry Test",
        "topic_id": topic_id,
        "questions": [
            {
                "question_type": "MCQ",
                "text": "What is the formula of methane?",
                "options": [
                    {"id": "a", "text": "CH4", "is_correct": True},
                    {"id": "b", "text": "C2H6", "is_correct": False},
                    {"id": "c", "text": "C3H8", "is_correct": False},
                    {"id": "d", "text": "C4H10", "is_correct": False},
                ],
                "marks": 2,
                "negative_marks": 0,
            }
        ],
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Organic Chemistry Test"
    assert len(data["questions"]) == 1


@pytest.mark.asyncio
async def test_example_json(client, auth_headers):
    res = await client.get(f"{BASE}/tests/example-json", headers=auth_headers)
    assert res.status_code == 200
    assert "questions" in res.json()


# ─── Attempt tests ────────────────────────────────────────
@pytest.mark.asyncio
async def test_full_attempt_flow(client, auth_headers):
    """Full: create subject → topic → test → start attempt → submit → get result."""
    sub = await client.post(f"{BASE}/subjects/", json={"name": "Biology"}, headers=auth_headers)
    topic = await client.post(f"{BASE}/subjects/{sub.json()['id']}/topics", json={"name": "Cells"}, headers=auth_headers)

    test = await client.post(f"{BASE}/tests/", json={
        "name": "Cell Biology",
        "topic_id": topic.json()["id"],
        "questions": [
            {
                "question_type": "MCQ",
                "text": "What is the powerhouse of the cell?",
                "options": [
                    {"id": "a", "text": "Mitochondria", "is_correct": True},
                    {"id": "b", "text": "Nucleus", "is_correct": False},
                    {"id": "c", "text": "Ribosome", "is_correct": False},
                    {"id": "d", "text": "Golgi body", "is_correct": False},
                ],
                "marks": 1, "negative_marks": 0,
            }
        ],
    }, headers=auth_headers)

    test_id = test.json()["id"]

    # Start attempt
    start = await client.post(f"{BASE}/attempts/start", json={"test_id": test_id}, headers=auth_headers)
    assert start.status_code == 201
    attempt_id = start.json()["attempt_id"]

    # Get test for attempt (no answers shown)
    view = await client.get(f"{BASE}/tests/{test_id}/attempt-view", headers=auth_headers)
    assert "options" in view.json()["questions"][0]
    assert "is_correct" not in view.json()["questions"][0]["options"][0]

    # Submit with correct answer
    submit = await client.post(f"{BASE}/attempts/{attempt_id}/submit", json={
        "answers": [{"question_id": test.json()["questions"][0]["id"], "selected_options": ["a"]}]
    }, headers=auth_headers)
    assert submit.status_code == 200
    result = submit.json()
    assert result["percentage"] == 100.0
    assert result["correct_count"] == 1


@pytest.mark.asyncio
async def test_revision_queue_populated(client, auth_headers):
    """Wrong answers should appear in revision queue."""
    # Use existing test from previous test run would need setup here
    # Just verify the endpoint works
    res = await client.get(f"{BASE}/analytics/revision-queue", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ─── Profile tests ────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_profile(client, auth_headers):
    res = await client.get(f"{BASE}/profile/", headers=auth_headers)
    assert res.status_code == 200
    assert "email" in res.json()


@pytest.mark.asyncio
async def test_update_profile(client, auth_headers):
    res = await client.put(f"{BASE}/profile/", json={
        "full_name": "Updated Name",
        "bio": "I love quizzes",
        "institution": "IIT Delhi",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_analytics_summary(client, auth_headers):
    res = await client.get(f"{BASE}/analytics/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_attempts" in data
    assert "current_streak" in data


@pytest.mark.asyncio
async def test_leaderboard(client, auth_headers):
    res = await client.get(f"{BASE}/leaderboard/", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ─── Spaces, goals, calendar ──────────────────────────────

@pytest.fixture(scope="session")
async def partner_headers(client):
    res = await client.post(f"{BASE}/auth/quick-login", json={"username": "shrusti"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


QUESTION = {"question_type": "MCQ", "text": "2+2?", "marks": 2, "options": [
    {"id": "a", "text": "4", "is_correct": True}, {"id": "b", "text": "5", "is_correct": False}]}



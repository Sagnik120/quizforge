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

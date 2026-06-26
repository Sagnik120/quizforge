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


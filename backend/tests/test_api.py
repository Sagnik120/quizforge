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

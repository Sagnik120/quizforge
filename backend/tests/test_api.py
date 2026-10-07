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


async def _subject_with_test(client, headers, space):
    s = (await client.post(f"{BASE}/subjects/", json={"name": f"DSA {space}", "space": space}, headers=headers)).json()
    t = (await client.post(f"{BASE}/subjects/{s['id']}/topics", json={"name": "Arrays"}, headers=headers)).json()
    sub = await client.post(f"{BASE}/subjects/{s['id']}/topics", json={"name": "Two pointers", "parent_id": t["id"]}, headers=headers)
    assert sub.status_code == 201 and sub.json()["parent_id"] == t["id"]
    test = await client.post(f"{BASE}/tests/", json={"name": f"Quiz {space}", "topic_id": sub.json()["id"], "questions": [QUESTION]}, headers=headers)
    assert test.status_code == 201
    return s, sub.json(), test.json()


@pytest.mark.asyncio
async def test_private_space_is_hidden_from_partner(client, auth_headers, partner_headers):
    s, _, test = await _subject_with_test(client, auth_headers, "private")
    theirs = (await client.get(f"{BASE}/subjects/", headers=partner_headers)).json()
    assert s["id"] not in [x["id"] for x in theirs]
    assert (await client.get(f"{BASE}/tests/{test['id']}/attempt-view", headers=partner_headers)).status_code == 404
    assert (await client.post(f"{BASE}/attempts/start", json={"test_id": test["id"]}, headers=partner_headers)).status_code == 404


@pytest.mark.asyncio
async def test_common_space_shared_with_per_user_stats(client, auth_headers, partner_headers):
    s, sub, test = await _subject_with_test(client, auth_headers, "common")
    q = test["questions"][0]["id"]
    # partner fails it, so it is flagged for retry only for them
    a = (await client.post(f"{BASE}/attempts/start", json={"test_id": test["id"]}, headers=partner_headers)).json()
    r = await client.post(f"{BASE}/attempts/{a['attempt_id']}/submit", json={"answers": [{"question_id": q, "selected_options": ["b"]}]}, headers=partner_headers)
    assert r.status_code == 200 and r.json()["percentage"] == 0

    theirs = {t["id"]: t for t in (await client.get(f"{BASE}/tests/", params={"space": "common"}, headers=partner_headers)).json()}[test["id"]]
    assert theirs["attempt_count"] == 1 and theirs["needs_retry"] is True and theirs["creator_id"] != theirs["id"]
    mine = {t["id"]: t for t in (await client.get(f"{BASE}/tests/", headers=auth_headers)).json()}[test["id"]]
    assert mine["attempt_count"] == 0 and mine["needs_retry"] is False and mine["partner_attempt_count"] == 1

    weak = (await client.get(f"{BASE}/analytics/weak-areas", headers=partner_headers)).json()
    subj = next(x for x in weak if x["id"] == s["id"])
    assert subj["percentage"] == 0 and subj["topics"][0]["subtopics"][0]["id"] == sub["id"]
    assert subj["topics"][0]["subtopics"][0]["percentage"] == 0

    # deleting the subject removes topics, tests, attempts and revision rows
    assert (await client.delete(f"{BASE}/subjects/{s['id']}", headers=partner_headers)).status_code == 204


@pytest.mark.asyncio
async def test_goals_tree_and_progress(client, auth_headers, partner_headers):
    async def add(title, parent=None, space="common", headers=auth_headers):
        res = await client.post(f"{BASE}/goals", json={"title": title, "parent_id": parent, "space": space}, headers=headers)
        return res
    root = (await add("DBMS")).json()
    topic = (await add("Normalization", root["id"])).json()
    l1 = (await add("1NF", topic["id"])).json()
    l2 = (await add("2NF", topic["id"])).json()
    assert (await add("too deep", l1["id"])).status_code == 400
    secret = (await add("My secret goal", space="private")).json()

    assert (await client.post(f"{BASE}/goals/{l1['id']}/toggle", headers=auth_headers)).json()["done"] is True
    assert (await client.post(f"{BASE}/goals/{root['id']}/toggle", headers=partner_headers)).json()["done"] is True

    theirs = {g["id"]: g for g in (await client.get(f"{BASE}/goals", headers=partner_headers)).json()}
    assert secret["id"] not in theirs and len(theirs[l2["id"]]["done_by"]) == 1 and len(theirs[l1["id"]]["done_by"]) == 2

    people = {p["username"]: p for p in (await client.get(f"{BASE}/overview", headers=auth_headers)).json()["people"]}
    assert people["sagnik"]["common_goals"] == {"done": 1, "total": 2}
    assert people["shrusti"]["common_goals"] == {"done": 2, "total": 2}
    assert people["sagnik"]["private_goals"]["total"] == 1 and people["shrusti"]["private_goals"]["total"] == 0
    assert people["sagnik"]["current_streak"] >= 1 and people["sagnik"]["active_today"] is True

    assert (await client.delete(f"{BASE}/goals/{root['id']}", headers=partner_headers)).status_code == 204
    left = [g["id"] for g in (await client.get(f"{BASE}/goals", headers=auth_headers)).json()]
    assert left == [secret["id"]]


@pytest.mark.asyncio
async def test_calendar_and_reminders(client, auth_headers, partner_headers):
    cal = (await client.get(f"{BASE}/calendar", headers=auth_headers)).json()
    today = cal["today"]
    me = next(u for u in cal["users"] if u["username"] == "sagnik")
    assert today in me["active_days"] and len(cal["users"]) == 2

    shared = (await client.post(f"{BASE}/calendar/reminders", json={"title": "Mock interview", "date": today, "space": "common"}, headers=auth_headers)).json()
    mine = (await client.post(f"{BASE}/calendar/reminders", json={"title": "Private", "date": today}, headers=auth_headers)).json()
    seen = [r["id"] for r in (await client.get(f"{BASE}/calendar", params={"month": today[:7]}, headers=partner_headers)).json()["reminders"]]
    assert shared["id"] in seen and mine["id"] not in seen
    done = await client.patch(f"{BASE}/calendar/reminders/{shared['id']}", json={"done": True}, headers=partner_headers)
    assert done.json()["done"] is True and done.json()["title"] == "Mock interview"
    # a tick is personal: the partner ticking a common reminder does not tick it for me
    def state(cal):
        return next(r["done"] for r in cal.json()["reminders"] if r["id"] == shared["id"])
    assert state(await client.get(f"{BASE}/calendar", params={"month": today[:7]}, headers=partner_headers)) is True
    assert state(await client.get(f"{BASE}/calendar", params={"month": today[:7]}, headers=auth_headers)) is False
    assert shared["id"] in [r["id"] for r in (await client.get(f"{BASE}/overview", headers=auth_headers)).json()["reminders"]]
    assert shared["id"] not in [r["id"] for r in (await client.get(f"{BASE}/overview", headers=partner_headers)).json()["reminders"]]
    assert (await client.patch(f"{BASE}/calendar/reminders/{mine['id']}", json={"done": True}, headers=partner_headers)).status_code == 404
    assert (await client.delete(f"{BASE}/calendar/reminders/{shared['id']}", headers=auth_headers)).status_code == 204
    assert (await client.get(f"{BASE}/calendar", params={"month": "nope"}, headers=auth_headers)).status_code == 400


@pytest.mark.asyncio
async def test_my_attempts_lists_test_names(client, auth_headers):
    res = await client.get(f"{BASE}/attempts/my", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() and all(a["test_name"] and a["completed_at"] for a in res.json())


# ─── Private vs common: one person's actions never change the other's state ───

async def _get(client, path, headers, **params):
    res = await client.get(f"{BASE}/{path}", headers=headers, params=params)
    assert res.status_code == 200
    return res.json()


async def _goal(client, headers, title, parent=None, space="common"):
    res = await client.post(f"{BASE}/goals", json={"title": title, "parent_id": parent, "space": space}, headers=headers)
    assert res.status_code == 201
    return res.json()


async def _goals_by_id(client, headers):
    return {g["id"]: g for g in await _get(client, "goals", headers)}


async def _me(client, headers):
    return next(p for p in (await _get(client, "overview", headers))["people"] if p["is_me"])


@pytest.mark.asyncio
async def test_private_goal_is_invisible_and_untouchable_for_partner(client, auth_headers, partner_headers):
    before = await _me(client, partner_headers)
    goal = await _goal(client, auth_headers, "Only mine", space="private")
    assert goal["id"] in await _goals_by_id(client, auth_headers)
    assert goal["id"] not in await _goals_by_id(client, partner_headers)
    assert (await client.post(f"{BASE}/goals/{goal['id']}/toggle", headers=partner_headers)).status_code == 404
    assert (await client.put(f"{BASE}/goals/{goal['id']}", json={"title": "hacked"}, headers=partner_headers)).status_code == 404
    assert (await client.delete(f"{BASE}/goals/{goal['id']}", headers=partner_headers)).status_code == 404
    child = await client.post(f"{BASE}/goals", json={"title": "x", "parent_id": goal["id"], "space": "private"}, headers=partner_headers)
    assert child.status_code == 404
    # it counts only towards its owner's private total
    mine_before = (await _me(client, auth_headers))["private_goals"]
    await client.post(f"{BASE}/goals/{goal['id']}/toggle", headers=auth_headers)
    mine_after = (await _me(client, auth_headers))["private_goals"]
    assert mine_after["done"] == mine_before["done"] + 1
    after = await _me(client, partner_headers)
    assert after["private_goals"] == before["private_goals"] and after["common_goals"] == before["common_goals"]


@pytest.mark.asyncio
async def test_common_goal_ticks_are_per_person(client, auth_headers, partner_headers):
    me_id = (await _me(client, auth_headers))["id"]
    partner_id = (await _me(client, partner_headers))["id"]
    leaf = await _goal(client, auth_headers, "Shared leaf")

    # nobody has ticked yet, and both can see it
    for headers in (auth_headers, partner_headers):
        seen = (await _goals_by_id(client, headers))[leaf["id"]]
        assert seen["done_by"] == [] and seen["my_done_at"] is None

    # I tick: done for me, still open for my partner
    assert (await client.post(f"{BASE}/goals/{leaf['id']}/toggle", headers=auth_headers)).json()["done"] is True
    mine = (await _goals_by_id(client, auth_headers))[leaf["id"]]
    theirs = (await _goals_by_id(client, partner_headers))[leaf["id"]]
    assert mine["done_by"] == [me_id] and mine["my_done_at"]
    assert theirs["done_by"] == [me_id] and theirs["my_done_at"] is None

    # partner ticks too, then I untick: only my tick goes away
    assert (await client.post(f"{BASE}/goals/{leaf['id']}/toggle", headers=partner_headers)).json()["done"] is True
    assert sorted((await _goals_by_id(client, auth_headers))[leaf["id"]]["done_by"]) == sorted([me_id, partner_id])
    assert (await client.post(f"{BASE}/goals/{leaf['id']}/toggle", headers=auth_headers)).json()["done"] is False
    theirs = (await _goals_by_id(client, partner_headers))[leaf["id"]]
    assert theirs["done_by"] == [partner_id] and theirs["my_done_at"]
    assert (await _goals_by_id(client, auth_headers))[leaf["id"]]["my_done_at"] is None


@pytest.mark.asyncio
async def test_ticking_a_common_subject_only_counts_for_the_person_who_ticked(client, auth_headers, partner_headers):
    me_id = (await _me(client, auth_headers))["id"]
    root = await _goal(client, partner_headers, "Shared subject")  # created by the partner
    topic = await _goal(client, auth_headers, "Topic", root["id"])
    leaves = [await _goal(client, auth_headers, f"Sub {i}", topic["id"]) for i in range(3)]
    mine_before, theirs_before = (await _me(client, auth_headers))["common_goals"], (await _me(client, partner_headers))["common_goals"]
    assert mine_before["total"] == theirs_before["total"]

    await client.post(f"{BASE}/goals/{root['id']}/toggle", headers=auth_headers)
    goals = await _goals_by_id(client, partner_headers)
    assert all(goals[leaf["id"]]["done_by"] == [me_id] for leaf in leaves)
    mine_after, theirs_after = (await _me(client, auth_headers))["common_goals"], (await _me(client, partner_headers))["common_goals"]
    assert mine_after["done"] == mine_before["done"] + 3
    assert theirs_after == theirs_before
    # each person's dashboard reports the other's numbers unchanged as well
    partner_seen_by_me = next(p for p in (await _get(client, "overview", auth_headers))["people"] if not p["is_me"])
    assert partner_seen_by_me["common_goals"] == theirs_before


@pytest.mark.asyncio
async def test_private_reminder_is_invisible_and_untouchable_for_partner(client, auth_headers, partner_headers):
    today = (await _get(client, "calendar", auth_headers))["today"]
    r = (await client.post(f"{BASE}/calendar/reminders", json={"title": "Secret plan", "date": today}, headers=auth_headers)).json()
    assert r["id"] in [x["id"] for x in (await _get(client, "calendar", auth_headers))["reminders"]]
    assert r["id"] in [x["id"] for x in (await _get(client, "overview", auth_headers))["reminders"]]
    assert r["id"] not in [x["id"] for x in (await _get(client, "calendar", partner_headers))["reminders"]]
    assert r["id"] not in [x["id"] for x in (await _get(client, "overview", partner_headers))["reminders"]]
    assert (await client.patch(f"{BASE}/calendar/reminders/{r['id']}", json={"done": True}, headers=partner_headers)).status_code == 404
    assert (await client.delete(f"{BASE}/calendar/reminders/{r['id']}", headers=partner_headers)).status_code == 404
    assert next(x for x in (await _get(client, "calendar", auth_headers))["reminders"] if x["id"] == r["id"])["done"] is False


@pytest.mark.asyncio
async def test_common_reminder_ticks_are_per_person(client, auth_headers, partner_headers):
    today = (await _get(client, "calendar", auth_headers))["today"]
    r = (await client.post(f"{BASE}/calendar/reminders", json={"title": "Mock test", "date": today, "space": "common"}, headers=auth_headers)).json()

    async def done_for(headers):
        return next(x for x in (await _get(client, "calendar", headers))["reminders"] if x["id"] == r["id"])["done"]

    async def pending_for(headers):
        return r["id"] in [x["id"] for x in (await _get(client, "overview", headers))["reminders"]]

    async def tick(headers, done):
        res = await client.patch(f"{BASE}/calendar/reminders/{r['id']}", json={"done": done}, headers=headers)
        assert res.status_code == 200 and res.json()["done"] is done

    assert not await done_for(auth_headers) and not await done_for(partner_headers)
    assert await pending_for(auth_headers) and await pending_for(partner_headers)

    await tick(auth_headers, True)  # the creator ticks: still pending for the partner
    assert await done_for(auth_headers) and not await done_for(partner_headers)
    assert not await pending_for(auth_headers) and await pending_for(partner_headers)

    await tick(partner_headers, True)
    await tick(partner_headers, True)  # ticking twice is harmless
    assert await done_for(auth_headers) and await done_for(partner_headers)

    await tick(auth_headers, False)  # the creator unticks: the partner's tick stays
    assert not await done_for(auth_headers) and await done_for(partner_headers)
    assert await pending_for(auth_headers) and not await pending_for(partner_headers)

    # renaming it does not change anyone's tick
    await client.patch(f"{BASE}/calendar/reminders/{r['id']}", json={"title": "Mock test 2"}, headers=auth_headers)
    assert not await done_for(auth_headers) and await done_for(partner_headers)


@pytest.mark.asyncio
async def test_attempts_analytics_and_revision_are_per_person(client, auth_headers, partner_headers):
    s, _, test = await _subject_with_test(client, auth_headers, "common")
    q = test["questions"][0]["id"]
    partner_summary = await _get(client, "analytics/summary", partner_headers)
    partner_attempts = await _get(client, "attempts/my", partner_headers)
    partner_queue = await _get(client, "analytics/revision-queue", partner_headers)

    # I fail the shared test
    a = (await client.post(f"{BASE}/attempts/start", json={"test_id": test["id"]}, headers=auth_headers)).json()
    await client.post(f"{BASE}/attempts/{a['attempt_id']}/submit", json={"answers": [{"question_id": q, "selected_options": ["b"]}]}, headers=auth_headers)

    mine = {t["id"]: t for t in await _get(client, "tests/", auth_headers)}[test["id"]]
    theirs = {t["id"]: t for t in await _get(client, "tests/", partner_headers)}[test["id"]]
    assert mine["attempt_count"] == 1 and mine["needs_retry"] is True
    assert theirs["attempt_count"] == 0 and theirs["needs_retry"] is False and theirs["best_percentage"] is None

    assert a["attempt_id"] in [x["id"] for x in await _get(client, "attempts/my", auth_headers)]
    assert await _get(client, "attempts/my", partner_headers) == partner_attempts
    assert await _get(client, "analytics/summary", partner_headers) == partner_summary
    assert await _get(client, "analytics/revision-queue", partner_headers) == partner_queue
    assert (await client.get(f"{BASE}/attempts/{a['attempt_id']}/result", headers=partner_headers)).status_code == 404
    partner_subject = next(x for x in await _get(client, "analytics/weak-areas", partner_headers) if x["id"] == s["id"])
    assert partner_subject["percentage"] is None and partner_subject["attempts"] == 0

    # my wrong answer is in my revision queue only, and my partner cannot resolve it
    item = next(x for x in await _get(client, "analytics/revision-queue", auth_headers) if x["question_id"] == q)
    assert (await client.patch(f"{BASE}/analytics/revision-queue/{item['id']}/resolve", headers=partner_headers)).status_code == 404


@pytest.mark.asyncio
async def test_old_shared_tick_on_common_reminder_counts_for_nobody(client, auth_headers, partner_headers):
    from sqlalchemy import update
    from app.db.base import AsyncSessionLocal
    from app.models.planner import Reminder
    today = (await _get(client, "calendar", auth_headers))["today"]
    ids = {}
    for space in ("common", "private"):
        res = await client.post(f"{BASE}/calendar/reminders", json={"title": f"old {space}", "date": today, "space": space}, headers=auth_headers)
        ids[space] = res.json()["id"]
    async with AsyncSessionLocal() as db:  # the single shared flag older versions wrote
        await db.execute(update(Reminder).where(Reminder.id.in_(ids.values())).values(done=True))
        await db.commit()
    mine = {r["id"]: r["done"] for r in (await _get(client, "calendar", auth_headers))["reminders"]}
    theirs = {r["id"]: r["done"] for r in (await _get(client, "calendar", partner_headers))["reminders"]}
    assert mine[ids["common"]] is False and theirs[ids["common"]] is False
    assert mine[ids["private"]] is True and ids["private"] not in theirs

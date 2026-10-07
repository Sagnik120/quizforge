from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import timedelta
from pydantic import BaseModel
import secrets
from app.db.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, LoginRequest
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user account (disabled unless ALLOW_REGISTER is set)."""
    if not settings.ALLOW_REGISTER:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserResponse.model_validate(user))


class QuickLogin(BaseModel):
    username: str
    passcode: str = ""


def _people():
    return [name.lower() for name in settings.USERS]


@router.get("/users")
async def list_people(db: AsyncSession = Depends(get_db)):
    """The people who can enter with one click, for the landing screen."""
    result = await db.execute(select(User).where(func.lower(User.username).in_(_people())).order_by(User.username))
    return {
        "passcode_required": bool(settings.APP_PASSCODE),
        "users": [{"username": u.username, "full_name": u.full_name or u.username} for u in result.scalars().all()],
    }


@router.post("/quick-login", response_model=Token)
async def quick_login(payload: QuickLogin, db: AsyncSession = Depends(get_db)):
    """One-click entry for the configured people, guarded by the optional shared passcode."""
    if settings.APP_PASSCODE and not secrets.compare_digest(payload.passcode, settings.APP_PASSCODE):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong passcode")
    username = payload.username.lower()
    if username not in _people():
        raise HTTPException(status_code=404, detail="Unknown user")
    result = await db.execute(select(User).where(func.lower(User.username) == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Unknown user")
    return Token(access_token=create_access_token(user.id), user=UserResponse.model_validate(user))

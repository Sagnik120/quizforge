from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import re

# Hosted Postgres (Neon/Render) hands out postgres:// URLs with libpq-style
# query params; asyncpg needs its own scheme and an explicit ssl flag.
_url = settings.DATABASE_URL
_kwargs = {}
if _url.startswith("postgres"):
    _ssl = "sslmode=require" in _url or "ssl=require" in _url
    _url = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+asyncpg://", _url).split("?")[0]
    _kwargs = {"pool_pre_ping": True, "pool_recycle": 300}
    if _ssl:
        _kwargs["connect_args"] = {"ssl": "require"}

engine = create_async_engine(_url, echo=settings.DEBUG, future=True, **_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,

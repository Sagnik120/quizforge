from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "QuizForge"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Access: the people who use this app, and an optional shared passcode
    USERS: List[str] = ["Sagnik", "Shrusti"]
    APP_PASSCODE: str = ""
    ALLOW_REGISTER: bool = False
    # Minutes ahead of UTC used for streak/calendar days (330 = IST)
    TZ_OFFSET_MINUTES: int = 330
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./quizforge.db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # .env is shared with frontend keys (NEXT_PUBLIC_*)


settings = Settings()

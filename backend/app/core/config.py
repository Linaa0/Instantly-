from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Instantly"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = "sqlite:///./instantly.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "instantly-dev-secret-key-9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e"
    TOKEN_ENCRYPTION_KEY: Optional[str] = None
    ENCRYPTION_KEY: str = "ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM1Pg="
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DEMO_MODE: bool = True

    AI_PROVIDER: str = "heuristic"  # openai | groq | heuristic
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/gmail/callback"

    SLACK_CLIENT_ID: Optional[str] = None
    SLACK_CLIENT_SECRET: Optional[str] = None
    SLACK_SIGNING_SECRET: Optional[str] = None
    SLACK_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/slack/callback"
    SLACK_BOT_TOKEN: Optional[str] = None

    FRONTEND_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


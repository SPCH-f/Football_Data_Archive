"""
Football RAG Chatbot — Application Configuration
All settings loaded from .env via pydantic BaseSettings.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration — every value comes from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM Provider ─────────────────────────────────────────
    llm_provider: str = Field(default="openai", description="'openai' or 'anthropic'")

    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-ada-002"
    embedding_dimension: int = 1536

    # Anthropic
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-3-haiku-20240307"

    # ── Football APIs ─────────────────────────────────────────
    football_data_api_key: Optional[str] = None
    football_data_base_url: str = "https://api.football-data.org/v4"

    api_football_key: Optional[str] = None
    api_football_base_url: str = "https://v3.football.api-sports.io"

    # ── PostgreSQL ────────────────────────────────────────────
    postgres_user: str = "football_rag"
    postgres_password: str = "changeme_strong_password_123"
    postgres_db: str = "football_rag_db"
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    database_url: Optional[str] = None

    @property
    def async_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── Redis ─────────────────────────────────────────────────
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: Optional[str] = None
    redis_url: Optional[str] = None

    @property
    def redis_connection_url(self) -> str:
        if self.redis_url:
            return self.redis_url
        pwd = f":{self.redis_password}@" if self.redis_password else "@"
        return f"redis://{pwd}{self.redis_host}:{self.redis_port}/0"

    # ── Backend ───────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_workers: int = 1
    backend_reload: bool = True
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    log_level: str = "info"

    # ── Scheduler ─────────────────────────────────────────────
    sync_fixtures_interval_hours: int = 6
    sync_standings_interval_hours: int = 24
    h2h_cache_ttl_days: int = 7

    # ── Cache TTLs (seconds) ──────────────────────────────────
    cache_ttl_fixtures: int = 3600        # 1 hour
    cache_ttl_standings: int = 86400      # 24 hours
    cache_ttl_team_form: int = 3600       # 1 hour
    cache_ttl_h2h: int = 604800           # 7 days

    # ── RAG Settings ──────────────────────────────────────────
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.75
    rag_use_mmr: bool = True
    rag_mmr_diversity: float = 0.3
    chat_memory_length: int = 6

    # ── Admin ─────────────────────────────────────────────────
    admin_api_key: str = "changeme_admin_secret_key"

    # ── Competitions ──────────────────────────────────────────
    tracked_competitions: str = "PL,PD,BL1,SA,FL1,CL"

    @property
    def competition_codes(self) -> List[str]:
        return [c.strip() for c in self.tracked_competitions.split(",")]

    @field_validator("llm_provider")
    @classmethod
    def validate_llm_provider(cls, v: str) -> str:
        v = v.lower()
        if v not in ("openai", "anthropic"):
            raise ValueError("llm_provider must be 'openai' or 'anthropic'")
        return v


# Singleton — import this everywhere
settings = Settings()

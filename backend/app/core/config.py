"""Application configuration and settings for WindSight."""

import os
from typing import List, Union

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field

    class Settings(BaseSettings):
        """WindSight application configuration backed by pydantic-settings."""

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )

        ELEXON_BASE_URL: str = Field(
            default="https://data.elexon.co.uk/bmrs/api/v1",
            description="Base URL for Elexon BMRS API",
        )
        DEFAULT_CUTOFF_HOUR: int = Field(
            default=9,
            description="Day-ahead auction decision cutoff hour (UTC, e.g. 09:30 GMT)",
        )
        DEFAULT_CUTOFF_MINUTE: int = Field(
            default=30,
            description="Day-ahead auction decision cutoff minute",
        )
        ANALYSIS_START_DATE: str = Field(
            default="2026-01-01",
            description="Start date for January 2026 analysis window (YYYY-MM-DD)",
        )
        ANALYSIS_END_DATE: str = Field(
            default="2026-01-31",
            description="End date for January 2026 analysis window (YYYY-MM-DD)",
        )
        CORS_ORIGINS: Union[List[str], str] = Field(
            default=["*"],
            description="Allowed CORS origins",
        )
        REQUEST_TIMEOUT: float = Field(
            default=30.0,
            description="HTTP request timeout in seconds",
        )
        MAX_RETRIES: int = Field(
            default=3,
            description="Maximum number of HTTP retries for Elexon API requests",
        )

except ImportError:
    class Settings:  # type: ignore[no-redef]
        """Fallback configuration object when pydantic-settings is not yet installed."""

        def __init__(self) -> None:
            self.ELEXON_BASE_URL: str = os.getenv(
                "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
            )
            self.DEFAULT_CUTOFF_HOUR: int = int(os.getenv("DEFAULT_CUTOFF_HOUR", "9"))
            self.DEFAULT_CUTOFF_MINUTE: int = int(os.getenv("DEFAULT_CUTOFF_MINUTE", "30"))
            self.ANALYSIS_START_DATE: str = os.getenv("ANALYSIS_START_DATE", "2026-01-01")
            self.ANALYSIS_END_DATE: str = os.getenv("ANALYSIS_END_DATE", "2026-01-31")
            cors_raw = os.getenv("CORS_ORIGINS", "*")
            if isinstance(cors_raw, str):
                self.CORS_ORIGINS: List[str] = [orig.strip() for orig in cors_raw.split(",")]
            else:
                self.CORS_ORIGINS = cors_raw
            self.REQUEST_TIMEOUT: float = float(os.getenv("REQUEST_TIMEOUT", "30.0"))
            self.MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))


settings = Settings()

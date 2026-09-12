"""Application settings.

Everything is driven by environment variables so the same code runs on your
laptop (SQLite) and on Render/Supabase (Postgres) with no source changes.
Copy `.env.example` to `.env` and edit if you want to override anything.
"""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "JAL 24x7 API"
    api_v1_prefix: str = "/api"

    # --- Database -----------------------------------------------------------
    # SQLite for local dev. To move to Supabase / Render Postgres, set:
    #   DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
    # ...and nothing else in the codebase has to change.
    database_url: str = "sqlite:///./jal24x7.db"

    # --- Auth ---------------------------------------------------------------
    jwt_secret: str = "change-me-in-production-jal24x7"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- Demo behaviour -----------------------------------------------------
    # In demo mode the OTP is returned in the API response and printed to the
    # server console instead of being sent over SMS. Production would swap this
    # for an MSG91 / Twilio call. Documented in the project report.
    demo_mode: bool = True
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5

    # --- Security ---------------------------------------------------------
    # Turned off inside the test suite so a run does not trip its own limiter.
    rate_limit_enabled: bool = True

    # --- CORS ---------------------------------------------------------------
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Business rules -----------------------------------------------------
    gst_rate: float = 0.18

    # Delivery is priced into the catalogue rather than added at checkout: a
    # 20L jar is about Rs 20 from a local supplier and lists here at Rs 30,
    # and that Rs 10 is what pays the delivery partner and the platform. A
    # separate fee on top would charge for the same trip twice, so standard
    # delivery is free and only express, which genuinely costs more to serve,
    # carries a charge.
    free_delivery_threshold: float = 0.0
    base_delivery_fee: float = 0.0
    express_delivery_fee: float = 20.0
    service_radius_km: float = 25.0

    @field_validator("database_url", mode="before")
    @classmethod
    def _fall_back_to_sqlite(cls, v: object) -> object:
        """Treat an empty DATABASE_URL as "not set".

        Render's blueprint prompts for this and writes an empty string when
        it is skipped, which would otherwise override the SQLite default and
        fail at startup with an unreadable SQLAlchemy error.
        """
        if v is None or (isinstance(v, str) and not v.strip()):
            return "sqlite:///./jal24x7.db"
        return v

    @field_validator("database_url")
    @classmethod
    def _normalise_postgres_scheme(cls, v: str) -> str:
        """Point bare postgres URLs at the driver that is actually installed.

        Hosted Postgres providers hand out `postgresql://...` (and Heroku-era
        tooling still emits `postgres://`). SQLAlchemy would then reach for
        psycopg2, which is not a dependency, and fail at import. requirements
        ships psycopg 3, so say so explicitly rather than making everyone
        remember to rewrite the prefix by hand.
        """
        for prefix in ("postgresql://", "postgres://"):
            if v.startswith(prefix):
                return f"postgresql+psycopg://{v[len(prefix):]}"
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed browser origins.

        CORS needs a full origin, but a hostname is sometimes configured
        without one, so a missing scheme is filled in as https. Localhost
        stays on http.
        """
        origins: list[str] = []
        for raw in self.cors_origins.split(","):
            origin = raw.strip().rstrip("/")
            if not origin:
                continue
            if not origin.startswith(("http://", "https://")):
                scheme = "http" if origin.startswith(("localhost", "127.0.0.1")) else "https"
                origin = f"{scheme}://{origin}"
            origins.append(origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

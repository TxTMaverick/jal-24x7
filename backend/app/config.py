"""Application settings.

Everything is driven by environment variables so the same code runs on your
laptop (SQLite) and on Render/Supabase (Postgres) with no source changes.
Copy `.env.example` to `.env` and edit if you want to override anything.
"""

from functools import lru_cache

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
    free_delivery_threshold: float = 500.0
    base_delivery_fee: float = 40.0
    express_delivery_fee: float = 80.0
    service_radius_km: float = 25.0

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed browser origins.

        Render's blueprint passes a bare hostname when one service references
        another (jal24x7-web.onrender.com), but CORS needs a full origin, so a
        missing scheme is filled in as https. Localhost stays on http.
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

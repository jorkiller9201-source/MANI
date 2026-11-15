from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data"
DEFAULT_SQLITE = f"sqlite:///{(DATA_DIR / 'mani.db').as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MANI"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "mani-change-this-secret-key-in-production-nova3"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    database_url: str = DEFAULT_SQLITE

    cors_allow_origins: str = (
        "http://localhost:3100,http://127.0.0.1:3100,"
        "https://158.101.2.100:9543"
    )

    login_fail_max_attempts: int = 10
    login_fail_max_attempts_per_ip: int = 40
    login_fail_window_minutes: int = 15

    backend_port: int = 8100
    public_url: str = "https://158.101.2.100:9543"

    data_dir: str = str(DATA_DIR)

    # Horizons: auto-probe reachability unless forced offline (demo sin red).
    horizons_force_offline: bool = False
    horizons_max_compare_days: int = 120

    # SMTP (password reset). Leave host empty to disable outbound mail.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    # When SMTP is unset and APP_ENV=development, log the temp password instead of failing.
    smtp_password_reset_dev_log: bool = True


settings = Settings()


def cors_origins_list() -> list[str]:
    return [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]

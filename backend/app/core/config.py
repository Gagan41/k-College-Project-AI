import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from dotenv import load_dotenv

# Load .env from root or current directory with override enabled
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"), override=True)
load_dotenv(override=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="allow"
    )

    PROJECT_NAME: str = "Smart AI-Based CCTV Attendance Ledger"
    PROJECT_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ROOT_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    STUDENT_PHOTOS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "student_photos")
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api")
    
    # Server configuration
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    
    # Database Configuration (Supabase PostgreSQL / SQLite fallback)
    DATABASE_URL: str = (
        f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'attendance.db').replace(chr(92), '/')}"
        if os.getenv("DATABASE_URL", "sqlite:///./attendance.db").startswith("sqlite:///.")
        else os.getenv("DATABASE_URL", "sqlite:///./attendance.db")
    )
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "cctv_attendance_super_secure_jwt_secret_key_2026_x89f")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

    # Initial Administrator Bootstrap Credentials
    ADMIN_BOOTSTRAP_EMAIL: str = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "cortinexwebstudio@gmail.com")
    ADMIN_BOOTSTRAP_PASSWORD: str = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "admin123")
    ADMIN_BOOTSTRAP_NAME: str = os.getenv("ADMIN_BOOTSTRAP_NAME", "System Administrator")
    
    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "pfbxognr")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "965964265717522")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "p7J5cC6DnKwdaV2-eTwate2dbKE")
    CLOUDINARY_URL: str = os.getenv("CLOUDINARY_URL", "cloudinary://965964265717522:p7J5cC6DnKwdaV2-eTwate2dbKE@pfbxognr")
    
    # SMTP & OTP Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or "cortinexwebstudio@gmail.com"
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or "bbztphxpvhosnahh"
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_USER") or "cortinexwebstudio@gmail.com"
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Smart CCTV Attendance Ledger")
    OTP_EXPIRE_MINUTES: int = int(os.getenv("OTP_EXPIRE_MINUTES", "5"))
    REQUIRE_EMAIL_OTP: bool = os.getenv("REQUIRE_EMAIL_OTP", "true").lower() in ("true", "1", "yes")
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if not v or v.strip() == "" or v.startswith("sqlite:///."):
            root_db = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "attendance.db").replace("\\", "/")
            return f"sqlite:///{root_db}"
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        return v

settings = Settings()

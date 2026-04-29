import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "User Service"
    VERSION: str = "1.0.0"

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@user-db:5432/userdb"
    )

    # JWT
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "changeme-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    # Security
    BCRYPT_ROUNDS: int = 12

settings = Settings()
"""
Configuration settings using Pydantic
"""

from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./kyamatu.db"
    
    # JWT
    JWT_SECRET_KEY: str = "dev_secret_key_12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Africa's Talking
    AFRICASTALKING_USERNAME: str = "sandbox"
    AFRICASTALKING_API_KEY: str = "sandbox"
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = "demo"
    CLOUDINARY_API_KEY: str = "123"
    CLOUDINARY_API_SECRET: str = "abc"
    
    # OpenAI (Required for production)
    OPENAI_API_KEY: str  # No default - must be set in .env
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # Environment
    ENVIRONMENT: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields

settings = Settings()

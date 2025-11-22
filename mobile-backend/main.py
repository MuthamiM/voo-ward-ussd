"""
FastAPI Main Application
Mobile backend for Kyamatu Ward Citizen App
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import auth, issues, bursaries, upload

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting Kyamatu Ward Mobile API...")
    yield
    # Shutdown
    print("👋 Shutting down...")

app = FastAPI(
    title="Kyamatu Ward Mobile API",
    description="Backend API for Kyamatu Ward Citizen Mobile App",
    version="1.0.0",
    lifespan=lifespan
)

        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "kyamatu-mobile-api",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

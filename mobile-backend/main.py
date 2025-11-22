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
from app.api.v1 import auth, issues, bursaries, upload, voter_registration, ussd

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
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(issues.router, prefix="/api/v1/issues", tags=["Issues"])
app.include_router(bursaries.router, prefix="/api/v1/bursaries", tags=["Bursaries"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["Upload"])
app.include_router(voter_registration.router, prefix="/api/v1/voter-registration", tags=["Voter Registration"])
app.include_router(ussd.router, prefix="/api/v1/ussd", tags=["USSD"])

@app.get("/")
async def root():
    return {
        "message": "Kyamatu Ward Mobile API",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Voter Registration",
            "Issue Reporting",
            "USSD Integration",
            "Announcements",
            "Bursary Status"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "kyamatu-mobile-api",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

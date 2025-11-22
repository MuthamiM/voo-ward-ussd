"""
Bursaries API endpoints
View bursary application status
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from app.core.database import get_db

router = APIRouter()

# Response model
class BursaryResponse(BaseModel):
    id: int
    reference: str
    student_name: str
    institution: str
    amount: float
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[BursaryResponse])
async def get_bursaries(
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Get all bursary applications for a citizen"""
    
    # TODO: Query actual bursary table
    # For now, return empty list
    return []

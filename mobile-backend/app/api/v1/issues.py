"""
Issues API endpoints
CRUD operations for citizen-reported issues
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models import Issue, IssueStatus, IssuePriority

router = APIRouter()

# Request/Response models
class IssueCreate(BaseModel):
    category: str
    description: str
    location: Optional[str] = None
    photo_url: Optional[str] = None

class IssueResponse(BaseModel):
    id: int
    ticket: str
    category: str
    description: str
    location: Optional[str]
    photo_url: Optional[str]
    status: str
    priority: str
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[IssueResponse])
async def get_issues(
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Get all issues for a citizen"""
    issues = db.query(Issue).filter(
        Issue.citizen_phone == phone_number
    ).order_by(Issue.created_at.desc()).all()
    
    return issues

@router.post("/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(
    issue: IssueCreate,
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Create a new issue"""
    
    # Generate ticket number
    count = db.query(Issue).count()
    ticket = f"ISS-{str(count + 1).zfill(4)}"
    
    # Create issue
    new_issue = Issue(
        ticket=ticket,
        citizen_phone=phone_number,
        category=issue.category,
        description=issue.description,
        location=issue.location,
        photo_url=issue.photo_url,
        status=IssueStatus.OPEN,
        priority=IssuePriority.MEDIUM
    )
    
    db.add(new_issue)
    db.commit()
    db.refresh(new_issue)
    
    # TODO: Trigger AI categorization
    # TODO: Send WhatsApp notification
    
    return new_issue

@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: int,
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Get a specific issue"""
    issue = db.query(Issue).filter(
        Issue.id == issue_id,
        Issue.citizen_phone == phone_number
    ).first()
    
    if not issue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Issue not found"
        )
    
    return issue

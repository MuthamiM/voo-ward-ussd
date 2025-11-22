"""
Issue model - represents citizen-reported issues
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class IssueStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class IssuePriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class Issue(Base):
    __tablename__ = "issues_mobile"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket = Column(String(20), unique=True, index=True, nullable=False)
    citizen_phone = Column(String(15), index=True, nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    status = Column(SQLEnum(IssueStatus), default=IssueStatus.OPEN)
    priority = Column(SQLEnum(IssuePriority), default=IssuePriority.MEDIUM)
    ai_category = Column(String(100), nullable=True)
    ai_confidence = Column(Integer, nullable=True)  # 0-100
    
    # Engagement Fields
    views = Column(Integer, default=0)
    upvotes = Column(Integer, default=0)
    upvoted_by = Column(String(5000), default='[]')  # JSON array of user IDs
    
    # Comments stored as JSON
    comments = Column(String(10000), default='[]')  # JSON array of comment objects
    
    # Rating (after resolution)
    rating = Column(Integer, nullable=True)  # 1-5
    rating_comment = Column(String(500), nullable=True)
    rated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Performance Metrics
    response_time = Column(Integer, nullable=True)  # minutes to acknowledgment
    resolution_time = Column(Integer, nullable=True)  # minutes to resolution
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Issue {self.ticket}>"

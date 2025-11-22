"""
Announcement model for ward/constituency announcements
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum, Boolean
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class AnnouncementPriority(str, enum.Enum):
    NORMAL = "normal"
    IMPORTANT = "important"
    URGENT = "urgent"

class AnnouncementCategory(str, enum.Enum):
    EVENT = "event"
    SERVICE = "service"
    ALERT = "alert"
    GENERAL = "general"

class AnnouncementStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class Announcement(Base):
    __tablename__ = "announcements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Content
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    summary = Column(String(500), nullable=True)
    attachments = Column(String(2000), default='[]')  # JSON array of URLs
    
    # Targeting
    county = Column(String(100), nullable=True)
    constituency = Column(String(100), nullable=True)
    ward = Column(String(100), nullable=True)
    
    # Priority & Type
    priority = Column(SQLEnum(AnnouncementPriority), default=AnnouncementPriority.NORMAL)
    category = Column(SQLEnum(AnnouncementCategory), default=AnnouncementCategory.GENERAL)
    
    # Publication
    status = Column(SQLEnum(AnnouncementStatus), default=AnnouncementStatus.DRAFT)
    published_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Engagement
    views = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(Integer, nullable=True)  # User ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Announcement {self.title}>"

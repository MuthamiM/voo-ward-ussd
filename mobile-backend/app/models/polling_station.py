"""
Polling Station model for voter registration
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class PollingStation(Base):
    __tablename__ = "polling_stations"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    
    # Location
    ward = Column(String(100), nullable=False)
    constituency = Column(String(100), nullable=False)
    county = Column(String(100), nullable=False)
    
    # GPS coordinates
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    address = Column(String(500), nullable=True)
    
    # Capacity
    registered_voters = Column(Integer, default=0)
    capacity = Column(Integer, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<PollingStation {self.code} - {self.name}>"

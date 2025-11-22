"""
Citizen model - represents mobile app users
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Citizen(Base):
    __tablename__ = "citizens_mobile"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(15), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    national_id = Column(String(20), unique=True, nullable=True, index=True)
    location = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Voter Registration Fields
    is_registered_voter = Column(Boolean, default=False)
    voter_registration_number = Column(String(50), unique=True, nullable=True)
    polling_station_id = Column(Integer, nullable=True)
    polling_station_name = Column(String(255), nullable=True)
    registration_date = Column(DateTime(timezone=True), nullable=True)
    registration_status = Column(String(20), default='pending')  # pending, verified, rejected
    id_document_url = Column(String(500), nullable=True)
    selfie_url = Column(String(500), nullable=True)
    digital_voter_card_url = Column(String(500), nullable=True)
    
    # Personal Information
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    gender = Column(String(10), nullable=True)  # male, female, other
    county = Column(String(100), nullable=True)
    constituency = Column(String(100), nullable=True)
    ward = Column(String(100), nullable=True)
    sub_location = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Citizen {self.phone_number}>"

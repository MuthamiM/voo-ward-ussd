"""
OTP model - for phone number verification
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from app.core.database import Base

class OTP(Base):
    __tablename__ = "otp_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(15), index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def is_valid(self) -> bool:
        """Check if OTP is still valid"""
        return not self.is_used and datetime.utcnow() < self.expires_at
    
    def __repr__(self):
        return f"<OTP {self.phone_number}>"

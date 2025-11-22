"""
Authentication API endpoints
Handles OTP request, verification, and JWT token generation
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

from app.core.database import get_db
from app.core.security import create_access_token
from app.models import Citizen, OTP

router = APIRouter()

# Request models
class OTPRequest(BaseModel):
    phone_number: str

class OTPVerify(BaseModel):
    phone_number: str
    otp_code: str

# Response models
class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/request-otp")
async def request_otp(request: OTPRequest, db: Session = Depends(get_db)):
    """
    Request OTP for phone number
    Sends 6-digit code via SMS
    """
    phone = request.phone_number.strip()
    
    # Validate phone number
    if len(phone) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number"
        )
    
    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    
    # Delete old OTPs for this number
    db.query(OTP).filter(OTP.phone_number == phone).delete()
    
    # Create new OTP
    otp = OTP(
        phone_number=phone,
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    db.add(otp)
    db.commit()
    
    # TODO: Send SMS via Africa's Talking
    print(f"📱 OTP for {phone}: {otp_code}")
    
    return {
        "success": True,
        "message": "OTP sent to your phone",
        # Remove in production!
        "dev_otp": otp_code if True else None
    }

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify, db: Session = Depends(get_db)):
    """
    Verify OTP and return JWT token
    Auto-registers new users
    """
    phone = request.phone_number.strip()
    code = request.otp_code.strip()
    
    # Find OTP
    otp = db.query(OTP).filter(
        OTP.phone_number == phone,
        OTP.otp_code == code,
        OTP.is_used == False
    ).first()
    
    if not otp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP"
        )
    
    if not otp.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP has expired"
        )
    
    # Mark OTP as used
    otp.is_used = True
    db.commit()
    
    # Get or create citizen
    citizen = db.query(Citizen).filter(Citizen.phone_number == phone).first()
    
    if not citizen:
        # Auto-register new citizen
        citizen = Citizen(phone_number=phone)
        db.add(citizen)
        db.commit()
        db.refresh(citizen)
    
    # Create JWT token
    access_token = create_access_token(
        data={"sub": phone, "citizen_id": citizen.id}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": citizen.id,
            "phone_number": citizen.phone_number,
            "full_name": citizen.full_name,
            "location": citizen.location
        }
    }

@router.get("/me")
async def get_current_user(
    db: Session = Depends(get_db),
    # TODO: Add JWT authentication dependency
):
    """Get current authenticated user"""
    # Placeholder - implement JWT auth dependency
    return {"message": "Current user endpoint"}

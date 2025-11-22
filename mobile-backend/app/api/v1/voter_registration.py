"""
Voter Registration API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import json

from app.core.database import get_db
from app.models import Citizen, PollingStation

router = APIRouter()

# Request/Response Models
class VoterRegistrationRequest(BaseModel):
    national_id: str
    full_name: str
    date_of_birth: str
    gender: str
    county: str
    constituency: str
    ward: str
    sub_location: Optional[str] = None
    id_document_url: Optional[str] = None
    selfie_url: Optional[str] = None

class VoterRegistrationResponse(BaseModel):
    id: int
    voter_registration_number: str
    registration_status: str
    full_name: str
    national_id: str
    polling_station_name: Optional[str]
    registration_date: datetime
    
    class Config:
        from_attributes = True

class PollingStationResponse(BaseModel):
    id: int
    code: str
    name: str
    ward: str
    constituency: str
    county: str
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    
    class Config:
        from_attributes = True

@router.post("/", response_model=VoterRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def submit_voter_registration(
    registration: VoterRegistrationRequest,
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Submit voter registration"""
    
    # Check if already registered
    existing = db.query(Citizen).filter(
        Citizen.national_id == registration.national_id
    ).first()
    
    if existing and existing.is_registered_voter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This ID is already registered"
        )
    
    # Get or create citizen
    citizen = db.query(Citizen).filter(Citizen.phone_number == phone_number).first()
    
    if not citizen:
        citizen = Citizen(phone_number=phone_number)
        db.add(citizen)
    
    # Update with registration data
    citizen.national_id = registration.national_id
    citizen.full_name = registration.full_name
    citizen.date_of_birth = datetime.fromisoformat(registration.date_of_birth)
    citizen.gender = registration.gender
    citizen.county = registration.county
    citizen.constituency = registration.constituency
    citizen.ward = registration.ward
    citizen.sub_location = registration.sub_location
    citizen.id_document_url = registration.id_document_url
    citizen.selfie_url = registration.selfie_url
    citizen.is_registered_voter = True
    citizen.registration_status = 'pending'
    citizen.registration_date = datetime.utcnow()
    
    # Generate registration number
    citizen.voter_registration_number = f"VOT-{datetime.utcnow().strftime('%Y%m%d')}-{citizen.id:04d}"
    
    # Assign polling station (simplified - find nearest in same ward)
    polling_station = db.query(PollingStation).filter(
        PollingStation.ward == registration.ward,
        PollingStation.is_active == True
    ).first()
    
    if polling_station:
        citizen.polling_station_id = polling_station.id
        citizen.polling_station_name = polling_station.name
    
    db.commit()
    db.refresh(citizen)
    
    return citizen

@router.get("/{registration_id}", response_model=VoterRegistrationResponse)
async def get_registration_status(
    registration_id: int,
    phone_number: str,  # TODO: Get from JWT token
    db: Session = Depends(get_db)
):
    """Get voter registration status"""
    
    citizen = db.query(Citizen).filter(
        Citizen.id == registration_id,
        Citizen.phone_number == phone_number
    ).first()
    
    if not citizen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration not found"
        )
    
    return citizen

@router.get("/check/{national_id}")
async def check_registration(
    national_id: str,
    db: Session = Depends(get_db)
):
    """Check if ID is already registered"""
    
    citizen = db.query(Citizen).filter(
        Citizen.national_id == national_id
    ).first()
    
    if not citizen:
        return {"registered": False}
    
    return {
        "registered": citizen.is_registered_voter,
        "status": citizen.registration_status,
        "voter_number": citizen.voter_registration_number
    }

@router.get("/polling-stations/", response_model=list[PollingStationResponse])
async def list_polling_stations(
    ward: Optional[str] = None,
    constituency: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List polling stations"""
    
    query = db.query(PollingStation).filter(PollingStation.is_active == True)
    
    if ward:
        query = query.filter(PollingStation.ward == ward)
    elif constituency:
        query = query.filter(PollingStation.constituency == constituency)
    
    stations = query.all()
    return stations

@router.get("/polling-stations/nearby")
async def find_nearby_station(
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db)
):
    """Find nearest polling station (simplified - returns first active)"""
    
    # TODO: Implement proper geospatial query
    station = db.query(PollingStation).filter(
        PollingStation.is_active == True
    ).first()
    
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No polling stations found"
        )
    
    return station

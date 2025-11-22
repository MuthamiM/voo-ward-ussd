"""
Upload API endpoints
Handle photo uploads to Cloudinary
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
import cloudinary
import cloudinary.uploader
from app.core.config import settings

router = APIRouter()

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

class UploadResponse(BaseModel):
    url: str
    public_id: str

@router.post("/photo", response_model=UploadResponse)
async def upload_photo(file: UploadFile = File(...)):
    """
    Upload photo to Cloudinary
    Returns public URL
    """
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image"
        )
    
    try:
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            file.file,
            folder="kyamatu-issues",
            resource_type="image"
        )
        
        return {
            "url": result["secure_url"],
            "public_id": result["public_id"]
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )

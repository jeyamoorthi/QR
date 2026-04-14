from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# --- Request Schemas ---


class LocationCreate(BaseModel):
    """Payload for creating a new location with QR mapping."""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class LocationUpdate(BaseModel):
    """Payload for updating an existing location."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    isActive: Optional[bool] = None


# --- Response Schemas ---


class LocationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    qrCodeValue: str
    address: Optional[str] = None
    isActive: bool
    createdBy: str
    createdAt: datetime
    updatedAt: datetime
    taskCount: Optional[int] = None

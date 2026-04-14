from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CompanyCreate(BaseModel):
    name: str


class CompanyResponse(BaseModel):
    id: str
    name: str
    createdBy: Optional[str] = None
    createdAt: Optional[datetime] = None
    logoUrl: Optional[str] = None

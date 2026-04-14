from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    EMPLOYEE = "employee"


class UserStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISABLED = "disabled"


class UserResponse(BaseModel):
    uid: str
    email: EmailStr
    displayName: Optional[str] = None
    role: UserRole
    status: str = UserStatus.ACTIVE.value
    password_set: bool = False
    companyId: Optional[str] = None
    companyName: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    isActive: bool
    assignedLocations: list[str] = Field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserLocationAssignment(BaseModel):
    locationIds: list[str] = Field(..., min_length=0)


class UserCreate(BaseModel):
    """Used when an admin creates a new user directly."""
    email: EmailStr
    displayName: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    assignedLocations: list[str] = Field(default_factory=list)


class UserRegister(BaseModel):
    """Self-registration payload for both Admin and Employee."""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    displayName: str
    role: UserRole = UserRole.EMPLOYEE
    # For admin: creates a new company
    companyName: Optional[str] = None
    # For employee: join existing company
    companyId: Optional[str] = None


class UserUpdate(BaseModel):
    displayName: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    isActive: Optional[bool] = None


class UserInvite(BaseModel):
    """Admin invites an employee email (pre-approval)."""
    email: EmailStr


class CheckUserResponse(BaseModel):
    exists: bool
    password_set: bool = False
    status: Optional[str] = None


class SetPasswordRequest(BaseModel):
    email: EmailStr
    newPassword: str = Field(..., min_length=6, max_length=128)

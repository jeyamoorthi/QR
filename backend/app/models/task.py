from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    ONE_TIME = "one_time"


class TaskStatus(str, Enum):
    COMPLETED = "completed"
    SKIPPED = "skipped"
    ISSUE_REPORTED = "issue_reported"


# --- Request Schemas ---


class CompletedTask(BaseModel):
    """A single task completion entry within a submission."""
    taskId: str
    status: TaskStatus
    notes: Optional[str] = None
    photoUrl: Optional[str] = None
    completedAt: datetime


class TaskSubmission(BaseModel):
    """Payload for submitting completed tasks from a scan session."""
    sessionId: str
    locationId: str
    completedTasks: list[CompletedTask] = Field(..., min_length=1)


class TaskCreate(BaseModel):
    """Payload for creating a new task (admin only)."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    locationId: str
    priority: Priority = Priority.MEDIUM
    frequencyType: Frequency = Frequency.DAILY
    order: int = 0
    estimatedMinutes: Optional[int] = Field(None, ge=1, le=480)


class TaskUpdate(BaseModel):
    """Payload for updating an existing task (admin only)."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[Priority] = None
    frequencyType: Optional[Frequency] = None
    order: Optional[int] = None
    estimatedMinutes: Optional[int] = Field(None, ge=1, le=480)
    isActive: Optional[bool] = None


# --- Response Schemas ---


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    locationId: str
    priority: Priority
    frequencyType: Frequency
    isActive: bool
    order: int
    estimatedMinutes: Optional[int] = None
    createdBy: str
    createdAt: datetime
    updatedAt: datetime


class TaskForScan(BaseModel):
    """Task item returned when a QR code is scanned."""
    id: str
    title: str
    description: Optional[str] = None
    priority: str
    estimatedMinutes: Optional[int] = None
    order: int
    isCompletedToday: bool


class LocationBrief(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class ScanResponse(BaseModel):
    """Response when employee scans a QR code."""
    location: LocationBrief
    tasks: list[TaskForScan]
    sessionId: str

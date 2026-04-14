from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TaskLogResponse(BaseModel):
    id: str
    taskId: str
    locationId: str
    completedBy: str
    completedByName: str
    status: str
    notes: Optional[str] = None
    photoUrl: Optional[str] = None
    completedAt: datetime
    submittedAt: datetime
    sessionId: str

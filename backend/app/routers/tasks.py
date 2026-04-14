from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore import AsyncClient
from datetime import datetime, timezone
from typing import Optional
import uuid

from app.core.security import require_approved, require_admin, require_supervisor, get_company_id
from app.core.dependencies import get_firestore
from app.models.task import (
    TaskSubmission,
    TaskCreate,
    TaskUpdate,
    ScanResponse,
    LocationBrief,
    TaskForScan,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("")
async def list_tasks(
    location_id: Optional[str] = Query(None, description="Filter by location"),
    active_only: bool = Query(True, description="Only show active tasks"),
    claims: dict = Depends(require_supervisor),
    db: AsyncClient = Depends(get_firestore),
):
    """Supervisor+: List all tasks with optional filters (company-scoped)."""
    company_id = get_company_id(claims)
    tasks_ref = db.collection("tasks")

    # Always filter by companyId
    query = tasks_ref.where("companyId", "==", company_id)

    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        if location_id and data.get("locationId") != location_id:
            continue
        if active_only and not data.get("isActive", True):
            continue
        results.append({"id": doc.id, **data})

    # Sort by locationId then order
    results.sort(key=lambda x: (x.get("locationId", ""), x.get("order", 0)))

    return {"tasks": results, "total": len(results)}


@router.get("/by-qr/{qr_code_value}", response_model=ScanResponse)
async def get_tasks_by_qr(
    qr_code_value: str,
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Fetch all active tasks for a scanned QR code (company-scoped).
    Called by the mobile app after scanning a QR code at a location.
    Employee from Company A scanning Company B's QR gets 404.
    """
    company_id = get_company_id(claims)

    # 1. Find location by QR value — must belong to caller's company
    locations_ref = db.collection("locations")
    query = (
        locations_ref
        .where("qrCodeValue", "==", qr_code_value)
        .where("companyId", "==", company_id)
        .where("isActive", "==", True)
        .limit(1)
    )
    location_docs = [doc async for doc in query.stream()]

    if not location_docs:
        raise HTTPException(
            status_code=404,
            detail="No active location found for this QR code.",
        )

    location = location_docs[0]
    location_data = location.to_dict()
    location_id = location.id

    # 2. Get active tasks for this location, ordered
    tasks_ref = db.collection("tasks")
    tasks_query = (
        tasks_ref
        .where("locationId", "==", location_id)
        .where("isActive", "==", True)
        .order_by("order")
    )
    task_docs = [doc async for doc in tasks_query.stream()]

    # 3. Check which tasks are already completed today by anyone
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    logs_ref = db.collection("task_logs")
    # Avoid composite-index dependency in dev/local by filtering date in memory.
    today_logs_query = logs_ref.where("locationId", "==", location_id)
    today_completed_task_ids = set()
    async for doc in today_logs_query.stream():
        log_data = doc.to_dict()
        completed_at = log_data.get("completedAt")
        if completed_at and completed_at >= today_start and log_data.get("status") == "completed":
            today_completed_task_ids.add(log_data["taskId"])

    # 4. Build session ID
    session_id = (
        f"sess_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        f"_{claims['uid'][:8]}"
    )

    # 5. Build response
    tasks = []
    for doc in task_docs:
        task = doc.to_dict()
        tasks.append(
            TaskForScan(
                id=doc.id,
                title=task["title"],
                description=task.get("description"),
                priority=task.get("priority", "medium"),
                estimatedMinutes=task.get("estimatedMinutes"),
                order=task.get("order", 0),
                isCompletedToday=doc.id in today_completed_task_ids,
            )
        )

    return ScanResponse(
        location=LocationBrief(
            id=location_id,
            name=location_data["name"],
            description=location_data.get("description"),
        ),
        tasks=tasks,
        sessionId=session_id,
    )


@router.get("/by-qr", response_model=ScanResponse)
async def get_tasks_by_qr_query(
    qr_code_value: str = Query(..., description="Raw QR code value"),
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Query-string variant for web clients.
    Avoids path-segment encoding issues when QR values contain special characters.
    """
    return await get_tasks_by_qr(qr_code_value=qr_code_value, claims=claims, db=db)


@router.post("/submit", status_code=201)
async def submit_tasks(
    submission: TaskSubmission,
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Submit completed/skipped/issue tasks from a scan session.
    Creates immutable task_log entries with timestamps (company-scoped).
    """
    company_id = get_company_id(claims)
    user_id = claims["uid"]
    user_name = claims.get("name", claims.get("email", "Unknown"))
    now = datetime.now(timezone.utc)

    # Verify location exists and belongs to this company
    location_ref = db.collection("locations").document(submission.locationId)
    location_doc = await location_ref.get()
    if not location_doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")
    if location_doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    # Batch write all log entries
    batch = db.batch()
    logs_ref = db.collection("task_logs")

    for task in submission.completedTasks:
        log_ref = logs_ref.document(str(uuid.uuid4()))
        batch.set(log_ref, {
            # Canonical fields used by current backend/admin queries
            "taskId": task.taskId,
            "locationId": submission.locationId,
            "companyId": company_id,
            "completedBy": user_id,
            "completedByName": user_name,
            "status": task.status.value,
            "notes": task.notes,
            "photoUrl": task.photoUrl,
            "completedAt": task.completedAt,
            "submittedAt": now,
            "sessionId": submission.sessionId,
            # Normalized aliases for cross-client compatibility
            "task_id": task.taskId,
            "location_id": submission.locationId,
            "user_id": user_id,
            "status_text": task.status.value,
            "timestamp": now,
        })

    await batch.commit()

    return {
        "message": "Tasks submitted successfully",
        "logsCreated": len(submission.completedTasks),
        "sessionId": submission.sessionId,
    }


@router.post("", status_code=201)
async def create_task(
    task: TaskCreate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Create a new task assigned to a location (company-scoped)."""
    company_id = get_company_id(claims)

    # Verify location exists and belongs to this company
    location_ref = db.collection("locations").document(task.locationId)
    location_doc = await location_ref.get()
    if not location_doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")
    if location_doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    now = datetime.now(timezone.utc)
    doc_ref = db.collection("tasks").document()
    await doc_ref.set({
        "title": task.title,
        "description": task.description,
        "locationId": task.locationId,
        "companyId": company_id,
        "priority": task.priority.value,
        "frequencyType": task.frequencyType.value,
        "isActive": True,
        "order": task.order,
        "estimatedMinutes": task.estimatedMinutes,
        "createdBy": claims["uid"],
        "createdAt": now,
        "updatedAt": now,
    })

    return {"id": doc_ref.id, "message": "Task created successfully"}


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    update: TaskUpdate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Update an existing task (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("tasks").document(task_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Task not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Task not found.")

    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    # Convert enums to values
    for key in ("priority", "frequencyType"):
        if key in update_data and hasattr(update_data[key], "value"):
            update_data[key] = update_data[key].value

    update_data["updatedAt"] = datetime.now(timezone.utc)
    await doc_ref.update(update_data)

    return {"id": task_id, "message": "Task updated successfully"}


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Soft-delete a task (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("tasks").document(task_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Task not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Task not found.")

    await doc_ref.update({
        "isActive": False,
        "updatedAt": datetime.now(timezone.utc),
    })

    return {"id": task_id, "message": "Task deactivated"}

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import AsyncClient
from datetime import datetime, timezone
import uuid

from app.core.security import require_admin, require_approved, get_company_id
from app.core.dependencies import get_firestore
from app.models.location import LocationCreate, LocationUpdate, LocationResponse

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("")
async def list_locations(
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """List all locations scoped to the caller's company. Admins see all; others see only active and assigned."""
    company_id = get_company_id(claims)
    caller_role = claims.get("role", "employee")
    locations_ref = db.collection("locations")

    # Always filter by companyId
    query = locations_ref.where("companyId", "==", company_id)

    # Get user's assigned locations for filtering
    user_doc = await db.collection("users").document(claims["uid"]).get()
    assigned_locations = user_doc.to_dict().get("assignedLocations", []) if user_doc.exists else []

    results = []
    async for doc in query.stream():
        data = doc.to_dict()

        # Non-admins only see active locations
        if caller_role not in ("admin", "super_admin") and not data.get("isActive", True):
            continue

        # Supervisors/employees only see their assigned locations (if any assigned)
        if caller_role not in ("admin", "super_admin") and assigned_locations:
            if doc.id not in assigned_locations:
                continue

        # Count tasks for each location
        tasks_query = (
            db.collection("tasks")
            .where("locationId", "==", doc.id)
            .where("isActive", "==", True)
        )
        task_count = len([d async for d in tasks_query.stream()])

        results.append({
            "id": doc.id,
            "name": data["name"],
            "description": data.get("description"),
            "qrCodeValue": data["qrCodeValue"],
            "address": data.get("address"),
            "isActive": data.get("isActive", True),
            "createdBy": data.get("createdBy", ""),
            "createdAt": data.get("createdAt"),
            "updatedAt": data.get("updatedAt"),
            "taskCount": task_count,
            "companyId": data.get("companyId"),
        })

    # Sort by name
    results.sort(key=lambda x: x.get("name", ""))

    return {"locations": results, "total": len(results)}


@router.get("/{location_id}")
async def get_location(
    location_id: str,
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """Get a single location by ID (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("locations").document(location_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")

    data = doc.to_dict()
    if data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    return {"id": doc.id, **data}


@router.get("/{location_id}/tasks")
async def get_location_tasks(
    location_id: str,
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """Get all tasks assigned to a specific location (company-scoped)."""
    company_id = get_company_id(claims)

    # Verify location exists and belongs to this company
    location_ref = db.collection("locations").document(location_id)
    location_doc = await location_ref.get()
    if not location_doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")
    if location_doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    tasks_ref = db.collection("tasks")
    caller_role = claims.get("role", "employee")

    if caller_role in ("admin", "super_admin"):
        query = tasks_ref.where("locationId", "==", location_id).order_by("order")
    else:
        query = (
            tasks_ref
            .where("locationId", "==", location_id)
            .where("isActive", "==", True)
            .order_by("order")
        )

    tasks = []
    async for doc in query.stream():
        task_data = doc.to_dict()
        # Also verify companyId on each task (defense in depth)
        if task_data.get("companyId") != company_id:
            continue
        tasks.append({"id": doc.id, **task_data})

    return {"locationId": location_id, "tasks": tasks, "total": len(tasks)}


@router.post("", status_code=201)
async def create_location(
    location: LocationCreate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Create a new location with auto-generated QR code value (company-scoped)."""
    company_id = get_company_id(claims)
    now = datetime.now(timezone.utc)
    qr_code_value = str(uuid.uuid4())  # unique QR payload

    doc_ref = db.collection("locations").document()
    await doc_ref.set({
        "name": location.name,
        "description": location.description,
        "qrCodeValue": qr_code_value,
        "address": location.address,
        "isActive": True,
        "companyId": company_id,
        "createdBy": claims["uid"],
        "createdAt": now,
        "updatedAt": now,
    })

    return {
        "id": doc_ref.id,
        "qrCodeValue": qr_code_value,
        "message": "Location created successfully",
    }


@router.put("/{location_id}")
async def update_location(
    location_id: str,
    update: LocationUpdate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Update an existing location (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("locations").document(location_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    update_data["updatedAt"] = datetime.now(timezone.utc)
    await doc_ref.update(update_data)

    return {"id": location_id, "message": "Location updated successfully"}


@router.delete("/{location_id}")
async def delete_location(
    location_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Soft-delete a location (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("locations").document(location_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Location not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="Location not found.")

    await doc_ref.update({
        "isActive": False,
        "updatedAt": datetime.now(timezone.utc),
    })

    return {"id": location_id, "message": "Location deactivated"}

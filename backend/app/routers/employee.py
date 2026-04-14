"""
Employee-facing endpoints — scoped to the authenticated user's own data.
All data is further filtered by companyId for multi-tenant isolation.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore import AsyncClient
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.core.security import require_approved, get_company_id
from app.core.dependencies import get_firestore

router = APIRouter(prefix="/employee", tags=["Employee"])


@router.get("/my-stats")
async def get_my_stats(
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Personal performance stats for the logged-in employee.
    Returns today's completed count, weekly count, total completion rate,
    locations visited, and current streak.
    """
    company_id = get_company_id(claims)
    uid = claims["uid"]

    now = datetime.now(timezone.utc)

    # Today's start
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Week start (Monday)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # Fetch all the employee's task logs for the past 30 days to compute stats
    thirty_days_ago = now - timedelta(days=30)

    logs_ref = db.collection("task_logs")
    # Keep query index-light for local/dev; filter time range in memory.
    query = (
        logs_ref
        .where("completedBy", "==", uid)
        .where("companyId", "==", company_id)
    )

    today_completed = 0
    weekly_completed = 0
    total_completed = 0
    total_logs = 0
    locations_set = set()
    daily_activity: dict[str, bool] = {}  # date_str -> has_activity

    async for doc in query.stream():
        data = doc.to_dict()
        total_logs += 1
        completed_at = data.get("completedAt")
        status = data.get("status", "")
        location_id = data.get("locationId", "")

        if location_id:
            locations_set.add(location_id)

        if status == "completed":
            total_completed += 1

        if completed_at:
            if completed_at < thirty_days_ago:
                continue
            if isinstance(completed_at, datetime):
                ts = completed_at
            else:
                ts = completed_at

            if ts >= today_start:
                if status == "completed":
                    today_completed += 1
            if ts >= week_start:
                if status == "completed":
                    weekly_completed += 1

            # Track daily activity for streak
            day_str = ts.strftime("%Y-%m-%d")
            if status == "completed":
                daily_activity[day_str] = True

    # Compute streak (consecutive days with activity ending today or yesterday)
    current_streak = 0
    check_date = now.date()
    # Allow streak to start from today or yesterday
    for _ in range(30):
        if check_date.strftime("%Y-%m-%d") in daily_activity:
            current_streak += 1
            check_date -= timedelta(days=1)
        elif check_date == now.date():
            # Today might not have activity yet, check yesterday
            check_date -= timedelta(days=1)
        else:
            break

    # Completion rate (completed out of total logged actions in 30 days)
    completion_rate = (total_completed / total_logs * 100) if total_logs > 0 else 0

    # Pending tasks for today — get today's assigned tasks not yet completed
    today_pending = 0
    # Get user's assigned locations
    user_doc = await db.collection("users").document(uid).get()
    assigned_locations = []
    if user_doc.exists:
        assigned_locations = user_doc.to_dict().get("assignedLocations", [])

    return {
        "todayCompleted": today_completed,
        "todayPending": today_pending,
        "weeklyCompleted": weekly_completed,
        "totalCompleted": total_completed,
        "completionRate": round(completion_rate, 1),
        "totalLocations": len(locations_set),
        "currentStreak": current_streak,
        "assignedLocations": len(assigned_locations),
    }


@router.get("/task-history")
async def get_task_history(
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Paginated task history for the logged-in employee.
    Returns their own task_logs filterable by date range and location.
    """
    company_id = get_company_id(claims)
    uid = claims["uid"]

    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    logs_ref = db.collection("task_logs")
    # Keep query index-light for local/dev; filter time range in memory.
    query = (
        logs_ref
        .where("completedBy", "==", uid)
        .where("companyId", "==", company_id)
    )

    logs = []
    async for doc in query.stream():
        data = doc.to_dict()
        completed_at = data.get("completedAt")
        if completed_at and completed_at < start_date:
            continue
        # Apply optional filters
        if location_id and data.get("locationId") != location_id:
            continue
        if status_filter and data.get("status") != status_filter:
            continue
        data["id"] = doc.id
        logs.append(data)

    # Sort by completedAt descending
    logs.sort(key=lambda x: x.get("completedAt", datetime.min), reverse=True)

    # Enrich with task titles and location names
    enriched = []
    # Cache for task and location names
    task_cache: dict[str, str] = {}
    location_cache: dict[str, str] = {}

    for log in logs[:100]:
        task_id = log.get("taskId", "")
        loc_id = log.get("locationId", "")

        # Get task title
        if task_id and task_id not in task_cache:
            task_doc = await db.collection("tasks").document(task_id).get()
            task_cache[task_id] = task_doc.to_dict().get("title", "Unknown Task") if task_doc.exists else "Deleted Task"

        # Get location name
        if loc_id and loc_id not in location_cache:
            loc_doc = await db.collection("locations").document(loc_id).get()
            location_cache[loc_id] = loc_doc.to_dict().get("name", "Unknown Location") if loc_doc.exists else "Deleted Location"

        enriched.append({
            "id": log["id"],
            "taskId": task_id,
            "taskTitle": task_cache.get(task_id, "Unknown"),
            "locationId": loc_id,
            "locationName": location_cache.get(loc_id, "Unknown"),
            "status": log.get("status", ""),
            "notes": log.get("notes"),
            "completedAt": log.get("completedAt"),
            "sessionId": log.get("sessionId", ""),
        })

    return {"history": enriched, "total": len(enriched)}


@router.get("/location-history")
async def get_location_history(
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Distinct locations the employee has scanned/worked at.
    Returns locations with visit count and last-visited timestamp.
    """
    company_id = get_company_id(claims)
    uid = claims["uid"]

    # Fetch all the employee's logs (within 90 days for perf)
    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)

    logs_ref = db.collection("task_logs")
    # Keep query index-light for local/dev; filter time range in memory.
    query = (
        logs_ref
        .where("completedBy", "==", uid)
        .where("companyId", "==", company_id)
    )

    location_stats: dict[str, dict] = {}

    async for doc in query.stream():
        data = doc.to_dict()
        loc_id = data.get("locationId", "")
        if not loc_id:
            continue

        completed_at = data.get("completedAt")
        if completed_at and completed_at < ninety_days_ago:
            continue

        if loc_id not in location_stats:
            location_stats[loc_id] = {
                "locationId": loc_id,
                "visitCount": 0,
                "tasksCompleted": 0,
                "lastVisited": None,
            }

        location_stats[loc_id]["visitCount"] += 1
        if data.get("status") == "completed":
            location_stats[loc_id]["tasksCompleted"] += 1

        if completed_at:
            current_last = location_stats[loc_id]["lastVisited"]
            if current_last is None or completed_at > current_last:
                location_stats[loc_id]["lastVisited"] = completed_at

    # Enrich with location names
    results = []
    for loc_id, stats in location_stats.items():
        loc_doc = await db.collection("locations").document(loc_id).get()
        if loc_doc.exists:
            loc_data = loc_doc.to_dict()
            stats["locationName"] = loc_data.get("name", "Unknown")
            stats["address"] = loc_data.get("address")
        else:
            stats["locationName"] = "Deleted Location"
            stats["address"] = None
        results.append(stats)

    # Sort by lastVisited descending
    results.sort(
        key=lambda x: x.get("lastVisited") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    return {"locations": results, "total": len(results)}

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore import AsyncClient
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.core.security import require_supervisor, require_admin, role_level, get_company_id
from app.core.dependencies import get_firestore

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


def _filter_by_assigned_locations(locations: list[str], items: list[dict], key: str = "locationId") -> list[dict]:
    """If user has assigned locations, filter items to only those locations."""
    if not locations:
        return items  # empty = access all
    return [item for item in items if item.get(key) in locations]


@router.get("/dashboard")
async def get_dashboard(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    claims: dict = Depends(require_supervisor),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Dashboard with today's summary statistics (company-scoped).
    Supervisors+ can access. Data is filtered by assigned locations for non-super-admins.
    """
    company_id = get_company_id(claims)
    caller_role = claims.get("role", "employee")

    # Parse date or default to today
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    else:
        target_date = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    next_day = target_date + timedelta(days=1)

    # Get user's assigned locations for filtering
    user_doc = await db.collection("users").document(claims["uid"]).get()
    assigned_locations = user_doc.to_dict().get("assignedLocations", []) if user_doc.exists else []
    # Super admins and admins see everything if no locations are explicitly assigned
    if caller_role in ("super_admin", "admin"):
        assigned_locations = []

    # Fetch task logs for the target date, scoped to company
    logs_ref = db.collection("task_logs")
    logs_query = (
        logs_ref
        .where("companyId", "==", company_id)
        .where("completedAt", ">=", target_date)
        .where("completedAt", "<", next_day)
    )

    logs = []
    async for doc in logs_query.stream():
        log_data = doc.to_dict()
        logs.append(log_data)

    # Apply location filter for supervisors
    if assigned_locations:
        logs = _filter_by_assigned_locations(assigned_locations, logs)

    # Compute summary stats
    total_completed = sum(1 for l in logs if l.get("status") == "completed")
    total_skipped = sum(1 for l in logs if l.get("status") == "skipped")
    total_issues = sum(1 for l in logs if l.get("status") == "issue_reported")
    active_employees = len(set(l.get("completedBy") for l in logs))

    # Count all active tasks across all active locations (company-scoped)
    tasks_ref = db.collection("tasks")
    total_tasks_query = (
        tasks_ref
        .where("companyId", "==", company_id)
        .where("isActive", "==", True)
    )
    all_tasks = [d async for d in total_tasks_query.stream()]
    if assigned_locations:
        all_tasks = [t for t in all_tasks if t.to_dict().get("locationId") in assigned_locations]
    total_tasks = len(all_tasks)

    completion_rate = (total_completed / total_tasks * 100) if total_tasks > 0 else 0

    # Location-wise breakdown
    location_logs: dict[str, dict] = {}
    for log in logs:
        loc_id = log.get("locationId", "unknown")
        if loc_id not in location_logs:
            location_logs[loc_id] = {
                "locationId": loc_id,
                "completed": 0,
                "skipped": 0,
                "issues": 0,
            }
        status = log.get("status")
        if status == "completed":
            location_logs[loc_id]["completed"] += 1
        elif status == "skipped":
            location_logs[loc_id]["skipped"] += 1
        elif status == "issue_reported":
            location_logs[loc_id]["issues"] += 1

    # Enrich location stats with names
    location_stats = []
    for loc_id, stats in location_logs.items():
        loc_doc = await db.collection("locations").document(loc_id).get()
        loc_name = loc_doc.to_dict().get("name", "Unknown") if loc_doc.exists else "Unknown"

        # Count tasks for this location
        loc_tasks_query = (
            tasks_ref
            .where("locationId", "==", loc_id)
            .where("isActive", "==", True)
        )
        loc_total = len([d async for d in loc_tasks_query.stream()])

        location_stats.append({
            "locationId": loc_id,
            "locationName": loc_name,
            "totalTasks": loc_total,
            "completed": stats["completed"],
            "pending": max(0, loc_total - stats["completed"]),
            "issues": stats["issues"],
        })

    # Recent activity (last 10 unique sessions)
    recent_sessions: dict[str, dict] = {}
    for log in sorted(logs, key=lambda x: x.get("completedAt", datetime.min), reverse=True):
        sid = log.get("sessionId", "")
        if sid and sid not in recent_sessions:
            recent_sessions[sid] = {
                "employeeName": log.get("completedByName", "Unknown"),
                "employeeId": log.get("completedBy", ""),
                "locationId": log.get("locationId", ""),
                "tasksCompleted": 0,
                "completedAt": log.get("completedAt"),
            }
        if sid in recent_sessions:
            recent_sessions[sid]["tasksCompleted"] += 1

    # Enrich recent activity with location names
    recent_activity = []
    for session in list(recent_sessions.values())[:10]:
        loc_doc = await db.collection("locations").document(session["locationId"]).get()
        session["locationName"] = (
            loc_doc.to_dict().get("name", "Unknown") if loc_doc.exists else "Unknown"
        )
        recent_activity.append(session)

    return {
        "date": target_date.strftime("%Y-%m-%d"),
        "callerRole": caller_role,
        "summary": {
            "totalTasks": total_tasks,
            "completedToday": total_completed,
            "skippedToday": total_skipped,
            "issuesReported": total_issues,
            "completionRate": round(completion_rate, 1),
            "activeEmployees": active_employees,
        },
        "locationStats": location_stats,
        "recentActivity": recent_activity,
    }


@router.get("/activity")
async def get_activity_log(
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    employee_id: Optional[str] = Query(None, description="Filter by employee UID"),
    location_id: Optional[str] = Query(None, description="Filter by location ID"),
    claims: dict = Depends(require_supervisor),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Activity feed: recent task completions with optional filters (company-scoped).
    Supervisors+ can access.
    """
    company_id = get_company_id(claims)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    logs_ref = db.collection("task_logs")
    query = (
        logs_ref
        .where("companyId", "==", company_id)
        .where("completedAt", ">=", start_date)
    )

    logs = []
    async for doc in query.stream():
        data = doc.to_dict()
        # Apply optional filters
        if employee_id and data.get("completedBy") != employee_id:
            continue
        if location_id and data.get("locationId") != location_id:
            continue
        data["id"] = doc.id
        logs.append(data)

    # Sort by completedAt descending
    logs.sort(key=lambda x: x.get("completedAt", datetime.min), reverse=True)

    return {"logs": logs[:100], "total": len(logs)}


@router.get("/employees")
async def get_employee_stats(
    claims: dict = Depends(require_supervisor),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Employee performance summary for the current week (company-scoped).
    Supervisors+ can access.
    """
    company_id = get_company_id(claims)

    # Get start of current week (Monday)
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # Fetch all logs for current week (company-scoped)
    logs_ref = db.collection("task_logs")
    query = (
        logs_ref
        .where("companyId", "==", company_id)
        .where("completedAt", ">=", week_start)
    )

    employee_stats: dict[str, dict] = {}
    async for doc in query.stream():
        data = doc.to_dict()
        uid = data.get("completedBy", "unknown")
        if uid not in employee_stats:
            employee_stats[uid] = {
                "uid": uid,
                "name": data.get("completedByName", "Unknown"),
                "completed": 0,
                "issues": 0,
                "locations_visited": set(),
            }
        if data.get("status") == "completed":
            employee_stats[uid]["completed"] += 1
        elif data.get("status") == "issue_reported":
            employee_stats[uid]["issues"] += 1
        employee_stats[uid]["locations_visited"].add(data.get("locationId", ""))

    # Convert sets to counts
    results = []
    for stats in employee_stats.values():
        stats["locationsVisited"] = len(stats.pop("locations_visited"))
        results.append(stats)

    # Sort by completed count descending
    results.sort(key=lambda x: x["completed"], reverse=True)

    return {"employees": results, "weekStart": week_start.strftime("%Y-%m-%d")}


@router.get("/roles")
async def get_available_roles(
    claims: dict = Depends(require_admin),
):
    """
    Return available roles the caller can assign to users.
    You can only assign roles below your own level.
    """
    caller_role = claims.get("role", "employee")
    caller_level = role_level(caller_role)

    from app.core.security import ROLE_HIERARCHY
    assignable = [r for r in ROLE_HIERARCHY if role_level(r) < caller_level]

    return {
        "callerRole": caller_role,
        "assignableRoles": assignable,
    }

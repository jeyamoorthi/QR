from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud.firestore import AsyncClient
from firebase_admin import auth as firebase_auth
from datetime import datetime, timezone
from typing import Optional
from pydantic import EmailStr

from app.core.security import (
    require_admin,
    require_approved,
    can_manage_role,
    role_level,
    get_company_id,
)
from app.core.dependencies import get_firestore
from app.models.user import (
    UserRoleUpdate,
    UserCreate,
    UserUpdate,
    UserRegister,
    UserLocationAssignment,
    UserInvite,
    CheckUserResponse,
    SetPasswordRequest,
)

router = APIRouter(prefix="/users", tags=["Users"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def _find_user_doc_by_email(db: AsyncClient, email: str):
    normalized_email = _normalize_email(email)
    candidates = [normalized_email]
    raw_email = email.strip()
    if raw_email and raw_email not in candidates:
        candidates.append(raw_email)

    for candidate in candidates:
        query = db.collection("users").where("email", "==", candidate).limit(1)
        docs = [doc async for doc in query.stream()]
        if docs:
            return docs[0]

    return None


# ──────────────────────────────────────────────────────
# PUBLIC — Self Registration
# ──────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register_user(
    data: UserRegister,
    db: AsyncClient = Depends(get_firestore),
):
    """
    Public: Self-registration for Admin or Employee.

    - Admin: creates a new company doc, user is auto-approved.
    - Employee: must select an existing companyId, starts as 'pending'.
      If an invite exists for their email, auto-approved.
    """
    role = data.role.value
    email = _normalize_email(str(data.email))

    # ── Admin registration: must provide companyName ──
    if role == "admin":
        if not data.companyName:
            raise HTTPException(
                status_code=400,
                detail="companyName is required when registering as admin.",
            )

        # 1. Create Firebase Auth user
        try:
            firebase_user = firebase_auth.create_user(
                email=email,
                password=data.password,
                display_name=data.displayName,
            )
        except firebase_auth.EmailAlreadyExistsError:
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

        # 2. Create company doc
        now = datetime.now(timezone.utc)
        company_ref = db.collection("companies").document()
        await company_ref.set({
            "name": data.companyName,
            "createdBy": firebase_user.uid,
            "createdAt": now,
            "logoUrl": None,
        })
        company_id = company_ref.id

        # 3. Set claims
        firebase_auth.set_custom_user_claims(firebase_user.uid, {
            "role": "admin",
            "companyId": company_id,
        })

        # 4. Create Firestore user profile — admin is auto-approved
        profile = {
            "uid": firebase_user.uid,
            "email": email,
            "displayName": data.displayName,
            "role": "admin",
            "status": "active",
            "password_set": True,
            "companyId": company_id,
            "phone": None,
            "department": None,
            "isActive": True,
            "assignedLocations": [],
            "createdAt": now,
            "updatedAt": now,
        }
        await db.collection("users").document(firebase_user.uid).set(profile)

        return {
            "uid": firebase_user.uid,
            "email": email,
            "role": "admin",
            "status": "active",
            "companyId": company_id,
            "companyName": data.companyName,
            "message": "Admin registered successfully. Company created.",
        }

    # ── Employee registration: must provide companyId ──
    if not data.companyId:
        raise HTTPException(
            status_code=400,
            detail="companyId is required when registering as employee.",
        )

    # Validate company exists
    company_doc = await db.collection("companies").document(data.companyId).get()
    if not company_doc.exists:
        raise HTTPException(status_code=404, detail="Company not found.")

    company_name = company_doc.to_dict().get("name", "")

    # 1. Create Firebase Auth user
    try:
        firebase_user = firebase_auth.create_user(
            email=email,
            password=data.password,
            display_name=data.displayName,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

    # 2. Check for pre-existing invite → auto-approve
    invites_query = (
        db.collection("invites")
        .where("email", "==", email)
        .where("companyId", "==", data.companyId)
        .limit(1)
    )
    invite_docs = [doc async for doc in invites_query.stream()]
    is_invited = len(invite_docs) > 0
    user_status = "active" if is_invited else "pending"

    # 3. Set claims
    firebase_auth.set_custom_user_claims(firebase_user.uid, {
        "role": "employee",
        "companyId": data.companyId,
    })

    # 4. Create Firestore user profile
    now = datetime.now(timezone.utc)
    profile = {
        "uid": firebase_user.uid,
        "email": email,
        "displayName": data.displayName,
        "role": "employee",
        "status": user_status,
        "password_set": True,
        "companyId": data.companyId,
        "phone": None,
        "department": None,
        "isActive": True,
        "assignedLocations": [],
        "createdAt": now,
        "updatedAt": now,
    }
    await db.collection("users").document(firebase_user.uid).set(profile)

    # 5. Clean up used invite
    if is_invited:
        await invites_query.stream().__aiter__().__anext__()  # already fetched above
        for inv_doc in invite_docs:
            await db.collection("invites").document(inv_doc.id).delete()

    return {
        "uid": firebase_user.uid,
        "email": email,
        "role": "employee",
        "status": user_status,
        "companyId": data.companyId,
        "companyName": company_name,
        "message": (
            "Employee registered and auto-approved via invite."
            if is_invited
            else "Employee registered. Pending approval from company admin."
        ),
    }


# ──────────────────────────────────────────────────────
# AUTHENTICATED — Current User
# ──────────────────────────────────────────────────────

@router.get("/me")
async def get_current_user(
    claims: dict = Depends(require_approved),
    db: AsyncClient = Depends(get_firestore),
):
    """Get the current authenticated user's profile."""
    uid = claims["uid"]
    doc_ref = db.collection("users").document(uid)
    doc = await doc_ref.get()

    if not doc.exists:
        # Auto-create profile on first login (legacy fallback)
        company_id = claims.get("companyId", "")
        user_data = {
            "uid": uid,
            "email": claims.get("email", ""),
            "displayName": claims.get("name", ""),
            "role": claims.get("role", "employee"),
            "status": "approved",
            "password_set": True,
            "companyId": company_id,
            "phone": claims.get("phone_number"),
            "department": None,
            "isActive": True,
            "assignedLocations": [],
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        await doc_ref.set(user_data)
        return {"id": uid, **user_data}

    data = doc.to_dict()
    if "password_set" not in data:
        data["password_set"] = True
    if "status" not in data:
        data["status"] = "approved"

    # Enrich with company name if companyId exists
    company_id = data.get("companyId")
    company_name = None
    if company_id:
        company_doc = await db.collection("companies").document(company_id).get()
        if company_doc.exists:
            company_name = company_doc.to_dict().get("name")

    return {"id": uid, "companyName": company_name, **data}


@router.get("/check-user", response_model=CheckUserResponse)
async def check_user(
    email: EmailStr = Query(..., description="Employee email"),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Public: Check whether a user exists and whether first-time password is set.
    """
    user_doc = await _find_user_doc_by_email(db, str(email))
    if not user_doc:
        return CheckUserResponse(exists=False, password_set=False, status=None)

    user_data = user_doc.to_dict()
    return CheckUserResponse(
        exists=True,
        password_set=user_data.get("password_set", True),
        status=user_data.get("status", "approved"),
    )


@router.post("/set-password")
async def set_password(
    payload: SetPasswordRequest,
    db: AsyncClient = Depends(get_firestore),
):
    """
    Public: First-time password setup for invited employees.
    Updates existing Firebase Auth user; does not create a new user.
    """
    normalized_email = _normalize_email(str(payload.email))
    user_doc = await _find_user_doc_by_email(db, str(payload.email))
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data = user_doc.to_dict()
    uid = user_data.get("uid", user_doc.id)

    if user_data.get("password_set", False):
        raise HTTPException(status_code=409, detail="Password is already set for this user.")

    if not user_data.get("isActive", True) or user_data.get("status") in {"disabled", "rejected"}:
        raise HTTPException(status_code=403, detail="This account is disabled.")

    try:
        firebase_auth.update_user(uid, password=payload.newPassword)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="Authentication account not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set password: {str(e)}")

    await db.collection("users").document(user_doc.id).update({
        "password_set": True,
        "status": "active",
        "isActive": True,
        "updatedAt": datetime.now(timezone.utc),
    })

    return {
        "uid": uid,
        "email": normalized_email,
        "password_set": True,
        "status": "active",
        "message": "Password set successfully. You can now sign in.",
    }


# ──────────────────────────────────────────────────────
# ADMIN — Approval Workflow
# ──────────────────────────────────────────────────────

@router.get("/approval/pending")
async def list_pending_employees(
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin: List employees pending approval in the admin's company."""
    company_id = get_company_id(claims)

    users_ref = db.collection("users")
    query = (
        users_ref
        .where("companyId", "==", company_id)
        .where("status", "==", "pending")
    )

    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        if data.get("password_set", True) is False:
            continue
        results.append({"id": doc.id, **data})

    return {"users": results, "total": len(results)}


@router.put("/{user_id}/approve")
async def approve_employee(
    user_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin: Approve a pending employee."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data = doc.to_dict()
    if user_data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="User is not in pending status.")

    if user_data.get("password_set", True) is False:
        raise HTTPException(status_code=400, detail="User must set a password before approval.")

    # Update Firestore
    await doc_ref.update({
        "status": "active",
        "isActive": True,
        "updatedAt": datetime.now(timezone.utc),
    })

    # Refresh Firebase custom claims
    existing_claims = {"role": user_data.get("role", "employee"), "companyId": company_id}
    firebase_auth.set_custom_user_claims(user_id, existing_claims)

    return {"userId": user_id, "status": "active", "message": "Employee approved successfully."}


@router.put("/{user_id}/reject")
async def reject_employee(
    user_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin: Reject a pending employee and disable their Firebase Auth account."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    user_data = doc.to_dict()
    if user_data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="User is not in pending status.")

    # Update Firestore
    await doc_ref.update({
        "status": "rejected",
        "isActive": False,
        "updatedAt": datetime.now(timezone.utc),
    })

    # Disable Firebase Auth account
    try:
        firebase_auth.update_user(user_id, disabled=True)
    except Exception:
        pass  # Non-fatal — user is already rejected in Firestore

    return {"userId": user_id, "status": "rejected", "message": "Employee rejected."}


@router.post("/invite", status_code=201)
async def invite_employee(
    invite: UserInvite,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin: Pre-invite an email. When that email registers, they are auto-approved."""
    company_id = get_company_id(claims)
    email = _normalize_email(str(invite.email))

    # Check if invite already exists
    existing_query = (
        db.collection("invites")
        .where("email", "==", email)
        .where("companyId", "==", company_id)
        .limit(1)
    )
    existing = [doc async for doc in existing_query.stream()]
    if existing:
        raise HTTPException(status_code=409, detail="Invite already exists for this email.")

    now = datetime.now(timezone.utc)
    invite_ref = db.collection("invites").document()
    await invite_ref.set({
        "email": email,
        "companyId": company_id,
        "invitedBy": claims["uid"],
        "createdAt": now,
    })

    return {
        "inviteId": invite_ref.id,
        "email": email,
        "companyId": company_id,
        "message": "Invite sent. Employee will be auto-approved on registration.",
    }


# ──────────────────────────────────────────────────────
# ADMIN — User Management (company-scoped)
# ──────────────────────────────────────────────────────

@router.get("")
async def list_users(
    role: Optional[str] = Query(None, description="Filter by role"),
    active_only: bool = Query(False, description="Only show active users"),
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: List all users scoped to the caller's company."""
    company_id = get_company_id(claims)
    users_ref = db.collection("users")
    query = users_ref.where("companyId", "==", company_id)

    users = []
    async for doc in query.stream():
        data = doc.to_dict()
        data.setdefault("password_set", True)
        data.setdefault("status", "approved")

        # Apply filters
        if role and data.get("role") != role:
            continue
        if active_only and not data.get("isActive", True):
            continue

        # Non-super-admins can only see users at their level or below
        caller_role = claims.get("role", "employee")
        user_role = data.get("role", "employee")
        if caller_role != "super_admin" and role_level(user_role) >= role_level(caller_role):
            if data.get("uid") != claims["uid"]:
                continue

        users.append({"id": doc.id, **data})

    return {"users": users, "total": len(users)}


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Get a specific user's profile (company-scoped)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    data = doc.to_dict()
    if data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")
    data.setdefault("password_set", True)
    data.setdefault("status", "approved")

    return {"id": doc.id, **data}


@router.post("", status_code=201)
async def create_user(
    user_data: UserCreate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Admin+: Create an employee/supervisor/admin account without password.
    The invited user sets their first password via /users/set-password.
    """
    company_id = get_company_id(claims)
    caller_role = claims.get("role", "employee")
    target_role = user_data.role.value
    normalized_email = _normalize_email(str(user_data.email))
    display_name = user_data.displayName or normalized_email.split("@")[0]

    # Can only create users with roles below your own
    if not can_manage_role(caller_role, target_role):
        raise HTTPException(
            status_code=403,
            detail=f"You cannot create users with role '{target_role}'.",
        )

    existing = await _find_user_doc_by_email(db, normalized_email)
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    try:
        # Create Firebase Auth user (no password at invite time)
        firebase_user = firebase_auth.create_user(
            email=normalized_email,
            display_name=display_name,
        )

        try:
            # Set custom claims with companyId
            firebase_auth.set_custom_user_claims(firebase_user.uid, {
                "role": target_role,
                "companyId": company_id,
            })

            # Create Firestore profile
            now = datetime.now(timezone.utc)
            profile = {
                "uid": firebase_user.uid,
                "email": normalized_email,
                "displayName": display_name,
                "role": target_role,
                "status": "pending",
                "password_set": False,
                "companyId": company_id,
                "phone": user_data.phone,
                "department": user_data.department,
                "isActive": True,
                "assignedLocations": user_data.assignedLocations,
                "createdBy": claims["uid"],
                "createdAt": now,
                "updatedAt": now,
            }
            await db.collection("users").document(firebase_user.uid).set(profile)
        except Exception:
            # Roll back Firebase user when profile setup fails.
            try:
                firebase_auth.delete_user(firebase_user.uid)
            except Exception:
                pass
            raise

        return {
            "uid": firebase_user.uid,
            "email": normalized_email,
            "role": target_role,
            "status": "pending",
            "password_set": False,
            "companyId": company_id,
            "message": "User created. Ask the employee to set password from the login page.",
        }
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}",
        )


@router.put("/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_update: UserRoleUpdate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """
    Admin+: Update a user's role.
    Sets Firebase custom claims AND updates Firestore document.
    Only users with higher roles can change lower roles.
    """
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    data = doc.to_dict()
    if data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    caller_role = claims.get("role", "employee")
    current_user_role = data.get("role", "employee")
    new_role = role_update.role.value

    # Prevent self-demotion
    if user_id == claims["uid"] and role_level(new_role) < role_level(caller_role):
        raise HTTPException(
            status_code=400,
            detail="Cannot demote yourself.",
        )

    # Can only manage users at or below your level, and assign roles below your level
    if not can_manage_role(caller_role, current_user_role):
        raise HTTPException(
            status_code=403,
            detail="Cannot modify a user with equal or higher authority.",
        )
    if not can_manage_role(caller_role, new_role):
        raise HTTPException(
            status_code=403,
            detail=f"Cannot assign role '{new_role}' — it requires higher authority than yours.",
        )

    try:
        firebase_auth.set_custom_user_claims(user_id, {
            "role": new_role,
            "companyId": company_id,
        })
        await doc_ref.update({
            "role": new_role,
            "updatedAt": datetime.now(timezone.utc),
        })
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update role: {str(e)}",
        )

    return {
        "userId": user_id,
        "role": new_role,
        "message": f"Role updated to '{new_role}'. User must re-login for changes to take effect.",
    }


@router.put("/{user_id}/locations")
async def assign_locations(
    user_id: str,
    assignment: UserLocationAssignment,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Assign locations to a user (supervisor/employee)."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    # Verify all location IDs exist and belong to this company
    for loc_id in assignment.locationIds:
        loc_doc = await db.collection("locations").document(loc_id).get()
        if not loc_doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Location '{loc_id}' not found.",
            )
        if loc_doc.to_dict().get("companyId") != company_id:
            raise HTTPException(
                status_code=404,
                detail=f"Location '{loc_id}' not found.",
            )

    await doc_ref.update({
        "assignedLocations": assignment.locationIds,
        "updatedAt": datetime.now(timezone.utc),
    })

    return {
        "userId": user_id,
        "assignedLocations": assignment.locationIds,
        "message": "Locations assigned successfully.",
    }


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    update: UserUpdate,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Update a user's profile fields."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    if doc.to_dict().get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    update_data = update.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    update_data["updatedAt"] = datetime.now(timezone.utc)
    await doc_ref.update(update_data)

    return {"userId": user_id, "message": "User updated successfully."}


@router.put("/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    claims: dict = Depends(require_admin),
    db: AsyncClient = Depends(get_firestore),
):
    """Admin+: Toggle a user's active/inactive status."""
    company_id = get_company_id(claims)
    doc_ref = db.collection("users").document(user_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found.")

    data = doc.to_dict()
    if data.get("companyId") != company_id:
        raise HTTPException(status_code=404, detail="User not found.")

    current_status = data.get("isActive", True)
    new_status = not current_status
    current_user_status = data.get("status", "approved")

    if new_status:
        if data.get("password_set", True) is False:
            next_status = "pending"
        elif current_user_status == "approved":
            next_status = "approved"
        else:
            next_status = "active"
    else:
        next_status = "disabled"

    await doc_ref.update({
        "isActive": new_status,
        "status": next_status,
        "updatedAt": datetime.now(timezone.utc),
    })

    return {
        "userId": user_id,
        "isActive": new_status,
        "status": next_status,
        "message": f"User {'activated' if new_status else 'deactivated'}.",
    }

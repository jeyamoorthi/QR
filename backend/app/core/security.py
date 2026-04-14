"""
Role-based access control with 4-tier authority hierarchy.

Hierarchy (highest to lowest):
    super_admin > admin > supervisor > employee

Multi-tenant: companyId is extracted from custom claims on every request.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth

bearer_scheme = HTTPBearer()

# Role hierarchy — index determines power level
ROLE_HIERARCHY = ["employee", "supervisor", "admin", "super_admin"]

VALID_ROLES = set(ROLE_HIERARCHY)


def role_level(role: str) -> int:
    """Return the power level of a role (0 = weakest)."""
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Verify Firebase ID token from Authorization header.
    Returns the decoded token claims dict containing uid, email, role, companyId, etc.
    """
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please re-authenticate.",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )


def _require_min_role(min_role: str):
    """
    Factory that creates a dependency requiring at minimum the given role.
    Roles above the required role in the hierarchy are also accepted.
    """
    min_level = role_level(min_role)

    async def dependency(
        claims: dict = Depends(verify_firebase_token),
    ) -> dict:
        user_role = claims.get("role", "employee")
        if role_level(user_role) < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"'{min_role}' or higher access required for this operation.",
            )
        return claims

    return dependency


# Pre-built role guards
require_employee = _require_min_role("employee")
require_supervisor = _require_min_role("supervisor")
require_admin = _require_min_role("admin")
require_super_admin = _require_min_role("super_admin")


async def require_approved(
    claims: dict = Depends(verify_firebase_token),
) -> dict:
    """
    Dependency that ensures the user's account is allowed to access protected APIs.
    Reads status from the Firestore user document.
    Allows legacy `approved` users and new-flow `active` users.
    """
    from app.core.dependencies import get_firestore
    db = await get_firestore()
    uid = claims["uid"]
    doc = await db.collection("users").document(uid).get()
    if doc.exists:
        user_data = doc.to_dict()
        user_status = user_data.get("status", "approved")
        password_set = user_data.get("password_set", True)
        is_active = user_data.get("isActive", True)

        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is disabled. Please contact your administrator.",
            )

        if not password_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Complete your first-time password setup before signing in.",
            )

        if user_status not in {"active", "approved"}:
            if user_status == "pending":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account is pending approval or setup.",
                )
            if user_status == "rejected":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account has been rejected. Please contact your company admin.",
                )
            if user_status == "disabled":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your account is disabled. Please contact your administrator.",
                )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not active.",
            )
    return claims


def get_company_id(claims: dict) -> str:
    """Extract companyId from token claims. Raises 403 if missing."""
    company_id = claims.get("companyId")
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No company associated with your account. Please contact support.",
        )
    return company_id


def can_manage_role(manager_role: str, target_role: str) -> bool:
    """Check if manager_role can assign/revoke target_role."""
    return role_level(manager_role) > role_level(target_role)

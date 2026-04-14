from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore import AsyncClient
from datetime import datetime, timezone

from app.core.dependencies import get_firestore
from app.models.company import CompanyResponse

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("")
async def list_companies(
    db: AsyncClient = Depends(get_firestore),
):
    """
    Public: List all companies.
    Used by employees during self-registration to choose their company.
    No auth required so the sign-up form can fetch companies.
    """
    companies_ref = db.collection("companies")
    query = companies_ref.order_by("name")

    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        results.append({
            "id": doc.id,
            "name": data.get("name", ""),
            "createdBy": data.get("createdBy"),
            "createdAt": data.get("createdAt"),
            "logoUrl": data.get("logoUrl"),
        })

    return {"companies": results, "total": len(results)}


@router.get("/{company_id}")
async def get_company(
    company_id: str,
    db: AsyncClient = Depends(get_firestore),
):
    """
    Public: Get a single company's info.
    Used during registration and on pending-approval screens.
    """
    doc_ref = db.collection("companies").document(company_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Company not found.")

    data = doc.to_dict()
    return {
        "id": doc.id,
        "name": data.get("name", ""),
        "createdBy": data.get("createdBy"),
        "createdAt": data.get("createdAt"),
        "logoUrl": data.get("logoUrl"),
    }
